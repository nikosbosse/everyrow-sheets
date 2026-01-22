/**
 * HTTP client for Cohort Engine API.
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
  var result = makeApiRequest('POST', '/sessions/create', { name: name });
  return { id: result.session_id };
}

/**
 * Submit a task to the Engine.
 * @param {Object} payload - Task payload.
 * @param {string} sessionId - Session ID to associate task with.
 * @return {Object} Task object with task_id.
 */
function submitTask(payload, sessionId) {
  return makeApiRequest('POST', '/tasks', {
    payload: payload,
    session_id: sessionId
  });
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
 * Get artifacts by IDs.
 * @param {string[]} artifactIds - Array of artifact IDs.
 * @return {Object[]} Array of artifact objects.
 */
function getArtifacts(artifactIds) {
  var params = artifactIds.map(function(id) {
    return 'artifact_ids=' + encodeURIComponent(id);
  }).join('&');
  return makeApiRequest('GET', '/artifacts?' + params);
}
