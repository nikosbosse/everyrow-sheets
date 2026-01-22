/**
 * Core everyrow operations: rank, dedupe, screen.
 * Handles task submission, polling, and result retrieval.
 */

// Maximum time to poll before giving up (5 minutes)
var MAX_POLL_TIME_MS = 5 * 60 * 1000;

// Initial poll interval (2 seconds)
var INITIAL_POLL_INTERVAL_MS = 2000;

// Maximum poll interval (10 seconds)
var MAX_POLL_INTERVAL_MS = 10000;

/**
 * Run a task with polling until completion or timeout.
 * @param {Object} payload - Task payload.
 * @param {string} sessionId - Session ID.
 * @return {Object} Result with status, artifactId, data.
 */
function runTaskWithPolling(payload, sessionId) {
  // Submit the task
  var task = submitTask(payload, sessionId);
  var taskId = task.task_id;

  // Save task ID for resumption
  saveLastTaskId(taskId);

  // Poll for completion
  var startTime = Date.now();
  var pollInterval = INITIAL_POLL_INTERVAL_MS;

  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    Utilities.sleep(pollInterval);

    var status = getTaskStatus(taskId);

    if (status.status === 'completed') {
      clearLastTaskId();
      return {
        status: 'completed',
        taskId: taskId,
        artifactId: status.artifact_id,
        data: null
      };
    }

    if (status.status === 'failed') {
      clearLastTaskId();
      throw new Error('Task failed: ' + (status.error || 'Unknown error'));
    }

    // Exponential backoff
    pollInterval = Math.min(pollInterval * 1.5, MAX_POLL_INTERVAL_MS);
  }

  // Timeout - task ID is saved for resumption
  return {
    status: 'timeout',
    taskId: taskId,
    message: 'Task is still running. Use "Check Previous Task" to check status later.'
  };
}

/**
 * Check the status of a previous task (for resumption after timeout).
 * @param {string} [taskId] - Task ID to check. Uses saved ID if not provided.
 * @return {Object} Status result.
 */
function checkPreviousTask(taskId) {
  taskId = taskId || getLastTaskId();

  if (!taskId) {
    throw new Error('No previous task found. Run an operation first.');
  }

  var status = getTaskStatus(taskId);

  if (status.status === 'completed') {
    clearLastTaskId();
    return {
      status: 'completed',
      taskId: taskId,
      artifactId: status.artifact_id
    };
  }

  if (status.status === 'failed') {
    clearLastTaskId();
    throw new Error('Task failed: ' + (status.error || 'Unknown error'));
  }

  return {
    status: 'running',
    taskId: taskId,
    message: 'Task is still running. Check again later.'
  };
}

/**
 * Create an input artifact from sheet data using CREATE_GROUP task.
 * @param {Object[]} records - Array of record objects.
 * @param {string} sessionId - Session ID.
 * @return {string} Artifact ID.
 */
function createInputArtifact(records, sessionId) {
  var payload = {
    task_type: 'create_group',
    processing_mode: 'transform',
    query: {
      data_to_create: records
    },
    input_artifacts: []
  };

  var result = runTaskWithPolling(payload, sessionId);

  if (result.status !== 'completed') {
    throw new Error('Failed to create input data: ' + (result.message || 'Unknown error'));
  }

  return result.artifactId;
}

/**
 * Run a Deep Rank operation.
 * @param {string} task - The ranking task description.
 * @param {string} fieldName - Field name for the score (default: 'score').
 * @param {boolean} ascending - Sort ascending (default: false).
 * @return {Object} Operation result.
 */
function runRank(task, fieldName, ascending) {
  fieldName = fieldName || 'score';
  ascending = ascending === true;

  // Get data from selection
  var records = selectionToRecords();

  // Create session
  var session = createSession('Sheets Rank - ' + new Date().toISOString());

  // Create input artifact first
  var inputArtifactId = createInputArtifact(records, session.id);

  // Build rank payload - use 'int' for Cohort's custom schema format
  var responseSchema = {};
  responseSchema[fieldName] = { type: 'int', description: 'Score for ranking' };

  var payload = {
    task_type: 'deep_rank',
    processing_mode: 'map',
    query: {
      task: task,
      response_schema: responseSchema,
      field_to_sort_by: fieldName,
      ascending_order: ascending
    },
    input_artifacts: [inputArtifactId],
    context_artifacts: [],
    join_with_input: true
  };

  // Run task
  var result = runTaskWithPolling(payload, session.id);

  if (result.status === 'completed') {
    // Fetch results and write to sheet
    var artifacts = getArtifacts([result.artifactId]);
    var resultRecords = extractArtifactData(artifacts);
    writeResultsToSheet(resultRecords, 'Rank Results');
    return { status: 'completed', rowCount: resultRecords.length, sessionId: session.id };
  }

  result.sessionId = session.id;
  return result;
}

/**
 * Run a Deep Screen operation.
 * @param {string} task - The screening task/criteria description.
 * @return {Object} Operation result.
 */
function runScreen(task) {
  // Get data from selection
  var records = selectionToRecords();

  // Create session
  var session = createSession('Sheets Screen - ' + new Date().toISOString());

  // Create input artifact first
  var inputArtifactId = createInputArtifact(records, session.id);

  // Build payload - use 'bool' and 'str' for Cohort's custom schema format
  var payload = {
    task_type: 'deep_screen',
    processing_mode: 'map',
    query: {
      task: task,
      response_schema: {
        passes_screen: { type: 'bool', description: 'Whether the row passes the screen' },
        reason: { type: 'str', description: 'Reason for the decision' }
      }
    },
    input_artifacts: [inputArtifactId],
    context_artifacts: [],
    join_with_input: true
  };

  // Run task
  var result = runTaskWithPolling(payload, session.id);

  if (result.status === 'completed') {
    // Fetch results and write to sheet
    var artifacts = getArtifacts([result.artifactId]);
    var resultRecords = extractArtifactData(artifacts);
    writeResultsToSheet(resultRecords, 'Screen Results');
    return { status: 'completed', rowCount: resultRecords.length, sessionId: session.id };
  }

  result.sessionId = session.id;
  return result;
}

/**
 * Run a Dedupe operation.
 * @param {string} equivalenceRelation - Description of what makes two records duplicates.
 * @return {Object} Operation result.
 */
function runDedupe(equivalenceRelation) {
  // Get data from selection
  var records = selectionToRecords();

  // Create session
  var session = createSession('Sheets Dedupe - ' + new Date().toISOString());

  // Create input artifact first
  var inputArtifactId = createInputArtifact(records, session.id);

  // Build payload
  var payload = {
    task_type: 'dedupe',
    processing_mode: 'transform',
    query: {
      equivalence_relation: equivalenceRelation
    },
    input_artifacts: [inputArtifactId]
  };

  // Run task
  var result = runTaskWithPolling(payload, session.id);

  if (result.status === 'completed') {
    // Fetch results and write to sheet
    var artifacts = getArtifacts([result.artifactId]);
    var resultRecords = extractArtifactData(artifacts);
    writeResultsToSheet(resultRecords, 'Dedupe Results');
    return { status: 'completed', rowCount: resultRecords.length, sessionId: session.id };
  }

  result.sessionId = session.id;
  return result;
}

/**
 * Extract data from artifact response.
 * Handles both group artifacts (with nested artifacts array) and standalone artifacts.
 * @param {Object[]} artifacts - Array of artifacts from API.
 * @return {Object[]} Array of data records.
 */
function extractArtifactData(artifacts) {
  if (!artifacts || artifacts.length === 0) return [];

  var artifact = artifacts[0];

  // If it's a group with nested artifacts, extract data from each child
  if (artifact.type === 'group' && artifact.artifacts && artifact.artifacts.length > 0) {
    var results = [];
    for (var i = 0; i < artifact.artifacts.length; i++) {
      if (artifact.artifacts[i].data) {
        results.push(artifact.artifacts[i].data);
      }
    }
    return results;
  }

  // If it has direct data array, return it
  if (Array.isArray(artifact.data)) {
    return artifact.data;
  }

  // Single artifact with data object
  if (artifact.data) {
    return [artifact.data];
  }

  return [];
}

/**
 * Retrieve and write results for a completed task.
 * @param {string} taskId - Task ID.
 * @param {string} sheetName - Name for the results sheet.
 * @return {Object} Result with row count.
 */
function retrieveTaskResults(taskId, sheetName) {
  var status = getTaskStatus(taskId);

  if (status.status !== 'completed') {
    throw new Error('Task is not completed. Status: ' + status.status);
  }

  var artifacts = getArtifacts([status.artifact_id]);
  var records = extractArtifactData(artifacts);

  if (records.length === 0) {
    throw new Error('Task completed but no results found.');
  }

  writeResultsToSheet(records, sheetName || 'Results');
  clearLastTaskId();

  return { status: 'completed', rowCount: records.length };
}
