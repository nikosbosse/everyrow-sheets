/**
 * HTTP client for everyrow API.
 * Handles authentication and request formatting.
 */

/**
 * Make an authenticated API request to the Engine.
 * @param {string} method - HTTP method (GET, POST, etc.).
 * @param {string} path - API path (e.g., '/sessions/create').
 * @param {Object} [body] - Request body for POST/PUT.
 * @return {Object} Parsed JSON response.
 * @throws {Error} If request fails or API returns error.
 */
function makeApiRequest(method, path, body) {
  var apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API key not configured. Please set your API key in Settings.');
  }

  var baseUrl = getApiBaseUrl();
  var url = baseUrl + path;

  var options = {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.payload = JSON.stringify(body);
  }

  var response = UrlFetchApp.fetch(url, options);
  var statusCode = response.getResponseCode();
  var responseText = response.getContentText();

  if (statusCode === 401) {
    throw new Error('Invalid API key. Please insert valid API key below.');
  }

  if (statusCode === 403) {
    throw new Error('Access denied. Your API key may not have permission for this operation.');
  }

  if (statusCode >= 400) {
    var errorMessage = 'API error: ' + statusCode;
    try {
      var errorBody = JSON.parse(responseText);
      if (errorBody.detail) {
        errorMessage = typeof errorBody.detail === 'string'
          ? errorBody.detail
          : JSON.stringify(errorBody.detail);
      } else if (errorBody.message) {
        errorMessage = errorBody.message;
      }
    } catch (e) {
      errorMessage = 'API error ' + statusCode + ': ' + responseText.substring(0, 200);
    }
    throw new Error(errorMessage);
  }

  return JSON.parse(responseText);
}

/**
 * Create a new session for grouping tasks.
 * @param {string} name - Session name.
 * @return {Object} Session object with id.
 */
function createSession(name) {
  var result = makeApiRequest('POST', '/sessions', { name: name });
  return { id: result.session_id };
}

/**
 * Get the status of a task.
 * @param {string} taskId - Task ID.
 * @return {Object} Task status with status, artifact_id, error fields.
 */
function getTaskStatus(taskId) {
  return makeApiRequest('GET', '/tasks/' + taskId + '/status');
}

/**
 * Get task results directly (for completed tasks).
 * @param {string} taskId - Task ID.
 * @return {Object} Task result with data array.
 */
function getTaskResult(taskId) {
  return makeApiRequest('GET', '/tasks/' + taskId + '/result');
}

/**
 * Submit a screen operation.
 * @param {Object[]} data - Input data records.
 * @param {string} task - Screening task description.
 * @param {Object} [responseSchema] - Optional JSON Schema for response.
 * @param {string} [sessionId] - Optional session ID.
 * @return {Object} Operation response with task_id.
 */
function submitScreen(data, task, responseSchema, sessionId) {
  var body = {
    input: data,
    task: task
  };
  if (responseSchema) {
    body.response_schema = responseSchema;
  }
  if (sessionId) {
    body.session_id = sessionId;
  }
  return makeApiRequest('POST', '/operations/screen', body);
}

/**
 * Submit a rank operation.
 * @param {Object[]} data - Input data records.
 * @param {string} task - Ranking task description.
 * @param {string} sortBy - Field name to sort by.
 * @param {boolean} ascending - Sort order (true = ascending).
 * @param {Object} [responseSchema] - Optional JSON Schema for response.
 * @param {string} [sessionId] - Optional session ID.
 * @return {Object} Operation response with task_id.
 */
function submitRank(data, task, sortBy, ascending, responseSchema, sessionId) {
  var body = {
    input: data,
    task: task,
    sort_by: sortBy,
    ascending: ascending
  };
  if (responseSchema) {
    body.response_schema = responseSchema;
  }
  if (sessionId) {
    body.session_id = sessionId;
  }
  return makeApiRequest('POST', '/operations/rank', body);
}

/**
 * Submit a dedupe operation.
 * @param {Object[]} data - Input data records.
 * @param {string} equivalenceRelation - Description of what makes rows duplicates.
 * @param {string} [sessionId] - Optional session ID.
 * @return {Object} Operation response with task_id.
 */
function submitDedupe(data, equivalenceRelation, sessionId) {
  var body = {
    input: data,
    equivalence_relation: equivalenceRelation
  };
  if (sessionId) {
    body.session_id = sessionId;
  }
  return makeApiRequest('POST', '/operations/dedupe', body);
}

/**
 * Submit a merge operation.
 * @param {Object[]} leftData - Left table data records.
 * @param {Object[]} rightData - Right table data records.
 * @param {string} task - Merge task description.
 * @param {string} [leftKey] - Optional column name to match on from left table.
 * @param {string} [rightKey] - Optional column name to match on from right table.
 * @param {string} [sessionId] - Optional session ID.
 * @return {Object} Operation response with task_id.
 */
function submitMerge(leftData, rightData, task, leftKey, rightKey, sessionId) {
  var body = {
    left_input: leftData,
    right_input: rightData,
    task: task
  };
  if (leftKey) {
    body.left_key = leftKey;
  }
  if (rightKey) {
    body.right_key = rightKey;
  }
  if (sessionId) {
    body.session_id = sessionId;
  }
  return makeApiRequest('POST', '/operations/merge', body);
}

/**
 * Submit an agent-map operation.
 * @param {Object[]} data - Input data records.
 * @param {string} task - Agent task description.
 * @param {Object} [responseSchema] - Optional JSON Schema for response.
 * @param {string} [effortLevel] - Effort level: 'low', 'medium', or 'high'.
 * @param {string} [sessionId] - Optional session ID.
 * @return {Object} Operation response with task_id.
 */
function submitAgentMap(data, task, responseSchema, effortLevel, sessionId) {
  var body = {
    input: data,
    task: task,
    effort_level: effortLevel || 'low',
    join_with_input: true
  };
  if (responseSchema) {
    body.response_schema = responseSchema;
  }
  if (sessionId) {
    body.session_id = sessionId;
  }
  return makeApiRequest('POST', '/operations/agent-map', body);
}
