/**
 * Core everyrow operations: rank, dedupe, screen.
 * Uses the public API v0 endpoints.
 */

// Maximum time to poll before giving up (5 minutes)
var MAX_POLL_TIME_MS = 5 * 60 * 1000;

// Initial poll interval (2 seconds)
var INITIAL_POLL_INTERVAL_MS = 2000;

// Maximum poll interval (10 seconds)
var MAX_POLL_INTERVAL_MS = 10000;

/**
 * Poll a task until completion or timeout.
 * @param {string} taskId - Task ID to poll.
 * @param {string} sessionId - Session ID (for result tracking).
 * @return {Object} Result with status, taskId, sessionId.
 */
function pollTaskUntilComplete(taskId, sessionId) {
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
        sessionId: sessionId,
        artifactId: status.artifact_id
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
    sessionId: sessionId,
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

  // Build JSON Schema for the response
  var responseSchema = {
    type: 'object',
    properties: {},
    required: [fieldName]
  };
  responseSchema.properties[fieldName] = { type: 'number', description: 'Score for ranking' };

  // Submit rank operation directly with inline data
  var response = submitRank(records, task, fieldName, ascending, responseSchema);
  var taskId = response.task_id;
  var sessionId = response.session_id;

  // Poll for completion
  var result = pollTaskUntilComplete(taskId, sessionId);

  if (result.status === 'completed') {
    // Fetch results and write to sheet
    var taskResult = getTaskResult(taskId);
    var resultRecords = extractResultData(taskResult);
    writeResultsToSheet(resultRecords, 'Rank Results');
    return { status: 'completed', rowCount: resultRecords.length, sessionId: sessionId };
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
  var records = selectionToRecords();

  // Screen requires a response_schema with at least one boolean field
  var responseSchema = {
    type: 'object',
    properties: {
      passes_screen: { type: 'boolean', description: 'Whether the row passes the screen' }
    },
    required: ['passes_screen']
  };

  // Submit screen operation directly with inline data
  var response = submitScreen(records, task, responseSchema);
  var taskId = response.task_id;
  var sessionId = response.session_id;

  // Poll for completion
  var result = pollTaskUntilComplete(taskId, sessionId);

  if (result.status === 'completed') {
    // Fetch results and write to sheet
    var taskResult = getTaskResult(taskId);
    var resultRecords = extractScreenResults(taskResult);
    writeResultsToSheet(resultRecords, 'Screen Results');
    return { status: 'completed', rowCount: resultRecords.length, sessionId: sessionId };
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
  var records = selectionToRecords();

  // Submit dedupe operation directly with inline data
  var response = submitDedupe(records, equivalenceRelation);
  var taskId = response.task_id;
  var sessionId = response.session_id;

  // Poll for completion
  var result = pollTaskUntilComplete(taskId, sessionId);

  if (result.status === 'completed') {
    // Fetch results and write to sheet
    // Results include: selected (bool), equivalence_class_id, equivalence_class_name
    // Users can filter by selected=true to get deduplicated rows
    var taskResult = getTaskResult(taskId);
    var resultRecords = extractResultData(taskResult);
    writeResultsToSheet(resultRecords, 'Dedupe Results');
    return { status: 'completed', rowCount: resultRecords.length, sessionId: sessionId };
  }

  return result;
}

/**
 * Extract data from task result response.
 * The public API v0 returns data directly in the result.
 * @param {Object} taskResult - Task result from getTaskResult().
 * @return {Object[]} Array of data records.
 */
function extractResultData(taskResult) {
  if (!taskResult || !taskResult.data) return [];

  // Public API returns data directly as list (for tables) or single record (for scalars)
  if (Array.isArray(taskResult.data)) {
    return taskResult.data;
  }

  // Single record - wrap in array
  return [taskResult.data];
}

/**
 * Extract and format screen results.
 * Adds a 'reason' column from research.screening_result.
 * @param {Object} taskResult - Task result from getTaskResult().
 * @return {Object[]} Array of data records with passes_screen and reason.
 */
function extractScreenResults(taskResult) {
  var records = extractResultData(taskResult);

  // Format results: extract reason from research.screening_result
  return records.map(function(record) {
    var result = {};

    // Copy all fields except 'research'
    for (var key in record) {
      if (key !== 'research') {
        result[key] = record[key];
      }
    }

    // Add reason from research.screening_result if available
    if (record.research && record.research.screening_result) {
      result.reason = record.research.screening_result;
    }

    return result;
  });
}

/**
 * Extract dedupe results, filtering to only selected (non-duplicate) rows.
 * @param {Object} taskResult - Task result from getTaskResult().
 * @return {Object[]} Array of deduplicated records.
 */
function extractDedupeResults(taskResult) {
  var records = extractResultData(taskResult);

  // Filter to only selected rows (the canonical representative of each group)
  var dedupedRecords = records.filter(function(record) {
    return record.selected === true;
  });

  // Remove deduplication metadata columns from output
  return dedupedRecords.map(function(record) {
    var result = {};
    for (var key in record) {
      // Skip internal dedupe fields
      if (key !== 'selected' && key !== 'equivalence_class_id' && key !== 'equivalence_class_name') {
        result[key] = record[key];
      }
    }
    return result;
  });
}

/**
 * Run an Agent Map operation.
 * @param {string} task - The task description for the agent.
 * @return {Object} Operation result.
 */
function runAgentMap(task) {
  // Get data from selection
  var records = selectionToRecords();

  // Submit agent-map operation directly with inline data
  // Using 'low' effort level for quick results in spreadsheet context
  var response = submitAgentMap(records, task, null, 'low');
  var taskId = response.task_id;
  var sessionId = response.session_id;

  // Poll for completion
  var result = pollTaskUntilComplete(taskId, sessionId);

  if (result.status === 'completed') {
    // Fetch results and write to sheet
    var taskResult = getTaskResult(taskId);
    var resultRecords = extractResultData(taskResult);
    writeResultsToSheet(resultRecords, 'Agent Results');
    return { status: 'completed', rowCount: resultRecords.length, sessionId: sessionId };
  }

  return result;
}

/**
 * Run a Merge operation combining two tables.
 * @param {Object[]} leftRecords - Records from the left/primary table.
 * @param {Object[]} rightRecords - Records from the right/secondary table.
 * @param {string} task - Description of how to merge the tables.
 * @param {string} [mergeOnLeft] - Optional column name to match on from left table.
 * @param {string} [mergeOnRight] - Optional column name to match on from right table.
 * @return {Object} Operation result.
 */
function runMerge(leftRecords, rightRecords, task, mergeOnLeft, mergeOnRight) {
  // Submit merge operation directly with inline data
  var response = submitMerge(leftRecords, rightRecords, task, mergeOnLeft, mergeOnRight);
  var taskId = response.task_id;
  var sessionId = response.session_id;

  // Poll for completion
  var result = pollTaskUntilComplete(taskId, sessionId);

  if (result.status === 'completed') {
    // Fetch results and write to sheet
    var taskResult = getTaskResult(taskId);
    var resultRecords = extractResultData(taskResult);
    writeResultsToSheet(resultRecords, 'Merge Results');
    return { status: 'completed', rowCount: resultRecords.length, sessionId: sessionId };
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
  var status = getTaskStatus(taskId);

  if (status.status !== 'completed') {
    throw new Error('Task is not completed. Status: ' + status.status);
  }

  var taskResult = getTaskResult(taskId);
  var records = extractResultData(taskResult);

  if (records.length === 0) {
    throw new Error('Task completed but no results found.');
  }

  writeResultsToSheet(records, sheetName || 'Results');
  clearLastTaskId();

  return { status: 'completed', rowCount: records.length };
}
