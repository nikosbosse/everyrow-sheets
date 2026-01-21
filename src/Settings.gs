/**
 * Settings management for everyrow Sheets add-on.
 * Stores API key and other user preferences.
 */

const SETTINGS_KEY = 'everyrow_settings';

/**
 * Get the stored API key.
 * @return {string|null} The API key or null if not set.
 */
function getApiKey() {
  const settings = getSettings_();
  return settings.apiKey || null;
}

/**
 * Save the API key.
 * @param {string} apiKey - The API key to save.
 */
function saveApiKey(apiKey) {
  const settings = getSettings_();
  settings.apiKey = apiKey;
  saveSettings_(settings);
}

/**
 * Get the last task ID (for resumption after timeout).
 * @return {string|null} The task ID or null.
 */
function getLastTaskId() {
  const settings = getSettings_();
  return settings.lastTaskId || null;
}

/**
 * Save the last task ID.
 * @param {string} taskId - The task ID to save.
 */
function saveLastTaskId(taskId) {
  const settings = getSettings_();
  settings.lastTaskId = taskId;
  saveSettings_(settings);
}

/**
 * Clear the last task ID.
 */
function clearLastTaskId() {
  const settings = getSettings_();
  delete settings.lastTaskId;
  saveSettings_(settings);
}

/**
 * Get the Engine API base URL.
 * @return {string} The base URL.
 */
function getApiBaseUrl() {
  return 'https://engine.futuresearch.ai';
}

/**
 * Check if the API key is configured.
 * @return {boolean} True if API key is set.
 */
function isConfigured() {
  const apiKey = getApiKey();
  return apiKey !== null && apiKey.startsWith('sk-cho-');
}

/**
 * Get all settings.
 * @return {Object} Settings object.
 * @private
 */
function getSettings_() {
  const userProps = PropertiesService.getUserProperties();
  const settingsJson = userProps.getProperty(SETTINGS_KEY);
  return settingsJson ? JSON.parse(settingsJson) : {};
}

/**
 * Save all settings.
 * @param {Object} settings - Settings object to save.
 * @private
 */
function saveSettings_(settings) {
  const userProps = PropertiesService.getUserProperties();
  userProps.setProperty(SETTINGS_KEY, JSON.stringify(settings));
}
