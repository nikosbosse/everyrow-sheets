/**
 * Core everyrow operations: rank, dedupe, screen.
 * Uses the public API v0 endpoints.
 * Each run* function submits the task and returns immediately.
 * Polling is handled client-side in the sidebar JavaScript.
 */

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
 * Submit a Deep Rank operation. Returns immediately with task info.
 * @param {string} task - The ranking task description.
 * @param {string} fieldName - Field name for the score (default: 'score').
 * @param {boolean} ascending - Sort ascending (default: false).
 * @param {string} sheetName - Name of the sheet to read data from.
 * @return {Object} {taskId, sessionId}
 */
function runRank(task, fieldName, ascending, sheetName) {
  fieldName = fieldName || 'score';
  ascending = ascending === true;

  var records = sheetToRecords(sheetName);

  var responseSchema = {
    type: 'object',
    properties: {},
    required: [fieldName]
  };
  responseSchema.properties[fieldName] = { type: 'number', description: 'Score for ranking' };

  var response = submitRank(records, task, fieldName, ascending, responseSchema);
  return { taskId: response.task_id, sessionId: response.session_id };
}

/**
 * Submit a Deep Screen operation. Returns immediately with task info.
 * @param {string} task - The screening task/criteria description.
 * @param {string} sheetName - Name of the sheet to read data from.
 * @return {Object} {taskId, sessionId}
 */
function runScreen(task, sheetName) {
  var records = sheetToRecords(sheetName);

  var responseSchema = {
    type: 'object',
    properties: {
      passes_screen: { type: 'boolean', description: 'Whether the row passes the screen' }
    },
    required: ['passes_screen']
  };

  var response = submitScreen(records, task, responseSchema);
  return { taskId: response.task_id, sessionId: response.session_id };
}

/**
 * Submit a Dedupe operation. Returns immediately with task info.
 * @param {string} equivalenceRelation - Description of what makes two records duplicates.
 * @param {string} sheetName - Name of the sheet to read data from.
 * @return {Object} {taskId, sessionId}
 */
function runDedupe(equivalenceRelation, sheetName) {
  var records = sheetToRecords(sheetName);

  var response = submitDedupe(records, equivalenceRelation);
  return { taskId: response.task_id, sessionId: response.session_id };
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
 * Submit an Agent Map operation. Returns immediately with task info.
 * @param {string} task - The task description for the agent.
 * @param {string} sheetName - Name of the sheet to read data from.
 * @param {Object} [responseSchema] - Optional JSON Schema for output columns.
 * @param {string} [effortLevel] - Effort level: 'low', 'medium', or 'high'. Default: 'medium'.
 * @return {Object} {taskId, sessionId}
 */
function runAgentMap(task, sheetName, responseSchema, effortLevel) {
  var records = sheetToRecords(sheetName);
  effortLevel = effortLevel || DEFAULT_EFFORT_LEVEL;

  var response = submitAgentMap(records, task, responseSchema || null, effortLevel);
  return { taskId: response.task_id, sessionId: response.session_id };
}

/**
 * Submit a Forecast operation. Returns immediately with task info.
 * @param {string} task - Context or instructions for the forecast.
 * @param {string} sheetName - Name of the sheet to read data from.
 * @return {Object} {taskId, sessionId}
 */
function runForecast(task, sheetName) {
  var records = sheetToRecords(sheetName);

  var response = submitForecast(records, task);
  return { taskId: response.task_id, sessionId: response.session_id };
}

/**
 * Submit a Merge operation combining two tables. Returns immediately with task info.
 * @param {string} leftSheetName - Name of the sheet for the left/primary table.
 * @param {string} rightSheetName - Name of the sheet for the right/secondary table.
 * @param {string} task - Description of how to merge the tables.
 * @param {string} [mergeOnLeft] - Optional column name to match on from left table.
 * @param {string} [mergeOnRight] - Optional column name to match on from right table.
 * @return {Object} {taskId, sessionId}
 */
function runMerge(leftSheetName, rightSheetName, task, mergeOnLeft, mergeOnRight) {
  var leftRecords = sheetToRecords(leftSheetName);
  var rightRecords = sheetToRecords(rightSheetName);

  var response = submitMerge(leftRecords, rightRecords, task, mergeOnLeft, mergeOnRight);
  return { taskId: response.task_id, sessionId: response.session_id };
}

/**
 * Retrieve and write results for a completed task.
 * @param {string} taskId - Task ID.
 * @param {string} sheetName - Name for the results sheet.
 * @param {string} [operationType] - Operation type (e.g. 'screen') for special extraction logic.
 * @return {Object} Result with row count.
 */
function retrieveTaskResults(taskId, sheetName, operationType) {
  var status = getTaskStatus(taskId);

  if (status.status !== 'completed') {
    throw new Error('Task is not completed. Status: ' + status.status);
  }

  var taskResult = getTaskResult(taskId);
  var records;
  if (operationType === 'screen') {
    records = extractScreenResults(taskResult);
  } else if (operationType === 'dedupe') {
    records = extractDedupeResults(taskResult);
  } else {
    records = extractResultData(taskResult);
  }

  if (records.length === 0) {
    throw new Error('Task completed but no results found.');
  }

  writeResultsToSheet(records, sheetName || 'Results');
  clearLastTaskId();

  return { status: 'completed', rowCount: records.length };
}
