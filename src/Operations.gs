/**
 * Core everyrow operations: rank, dedupe, screen.
 * Handles task submission, polling, and result retrieval.
 */

// Maximum time to poll before giving up (5 minutes)
const MAX_POLL_TIME_MS = 5 * 60 * 1000;

// Initial poll interval (2 seconds)
const INITIAL_POLL_INTERVAL_MS = 2000;

// Maximum poll interval (10 seconds)
const MAX_POLL_INTERVAL_MS = 10000;

/**
 * Run a task with polling until completion or timeout.
 * @param {Object} payload - Task payload.
 * @param {string} sessionId - Session ID.
 * @return {Object} Result with status, artifactId, data.
 */
function runTaskWithPolling(payload, sessionId) {
  // Submit the task
  const task = submitTask(payload, sessionId);
  const taskId = task.id;

  // Save task ID for resumption
  saveLastTaskId(taskId);

  // Poll for completion
  const startTime = Date.now();
  let pollInterval = INITIAL_POLL_INTERVAL_MS;

  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    Utilities.sleep(pollInterval);

    const status = getTaskStatus(taskId);

    if (status.status === 'completed') {
      clearLastTaskId();
      return {
        status: 'completed',
        taskId: taskId,
        artifactId: status.artifact_id,
        data: null // Will be fetched separately if needed
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

  const status = getTaskStatus(taskId);

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
 * Create an input artifact from sheet data.
 * @param {Object[]} records - Array of record objects.
 * @param {string} sessionId - Session ID.
 * @return {string} Artifact ID.
 */
function createInputArtifact(records, sessionId) {
  const artifact = createArtifact(records, sessionId, 'group');
  return artifact.id;
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
  const records = selectionToRecords();

  // Create session
  const session = createSession('Sheets Rank - ' + new Date().toISOString());

  // Create input artifact
  const inputArtifactId = createInputArtifact(records, session.id);

  // Build payload
  const payload = {
    task_type: 'deep_rank',
    query: {
      task: task,
      response_schema: {
        [fieldName]: { type: 'number' }
      },
      field_to_sort_by: fieldName,
      ascending_order: ascending
    },
    input_artifacts: [inputArtifactId],
    processing_mode: 'map',
    join_with_input: true
  };

  // Run task
  const result = runTaskWithPolling(payload, session.id);

  if (result.status === 'completed') {
    // Fetch results and write to sheet
    const artifact = getArtifact(result.artifactId);
    const resultRecords = artifact.data || [];
    writeResultsToSheet(resultRecords, 'Rank Results');
    return { status: 'completed', rowCount: resultRecords.length };
  }

  return result;
}

/**
 * Run a Deep Screen operation.
 * @param {string} task - The screening task/criteria description.
 * @return {Object} Operation result.
 */
function runScreen(task) {
  // Get data from selection
  const records = selectionToRecords();

  // Create session
  const session = createSession('Sheets Screen - ' + new Date().toISOString());

  // Create input artifact
  const inputArtifactId = createInputArtifact(records, session.id);

  // Build payload
  const payload = {
    task_type: 'deep_screen',
    query: {
      task: task,
      response_schema: {
        passes_screen: { type: 'boolean' },
        reason: { type: 'string' }
      }
    },
    input_artifacts: [inputArtifactId],
    processing_mode: 'map',
    join_with_input: true
  };

  // Run task
  const result = runTaskWithPolling(payload, session.id);

  if (result.status === 'completed') {
    // Fetch results and write to sheet
    const artifact = getArtifact(result.artifactId);
    const resultRecords = artifact.data || [];
    writeResultsToSheet(resultRecords, 'Screen Results');
    return { status: 'completed', rowCount: resultRecords.length };
  }

  return result;
}

/**
 * Run a Dedupe operation.
 * @param {string} equivalenceRelation - Description of what makes two records duplicates.
 * @return {Object} Operation result.
 */
function runDedupe(equivalenceRelation) {
  // Get data from selection
  const records = selectionToRecords();

  // Create session
  const session = createSession('Sheets Dedupe - ' + new Date().toISOString());

  // Create input artifact
  const inputArtifactId = createInputArtifact(records, session.id);

  // Build payload
  const payload = {
    task_type: 'dedupe',
    query: {
      equivalence_relation: equivalenceRelation
    },
    input_artifacts: [inputArtifactId]
  };

  // Run task
  const result = runTaskWithPolling(payload, session.id);

  if (result.status === 'completed') {
    // Fetch results and write to sheet
    const artifact = getArtifact(result.artifactId);
    const resultRecords = artifact.data || [];
    writeResultsToSheet(resultRecords, 'Dedupe Results');
    return { status: 'completed', rowCount: resultRecords.length };
  }

  return result;
}

/**
 * Retrieve and write results for a completed task.
 * @param {string} taskId - Task ID.
 * @param {string} sheetName - Name for the results sheet.
 * @return {Object} Result with row count.
 */
function retrieveTaskResults(taskId, sheetName) {
  const status = getTaskStatus(taskId);

  if (status.status !== 'completed') {
    throw new Error('Task is not completed. Status: ' + status.status);
  }

  const artifact = getArtifact(status.artifact_id);
  const records = artifact.data || [];

  if (records.length === 0) {
    throw new Error('Task completed but no results found.');
  }

  writeResultsToSheet(records, sheetName || 'Results');
  clearLastTaskId();

  return { status: 'completed', rowCount: records.length };
}
