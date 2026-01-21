/**
 * Main entry point for everyrow Sheets add-on.
 * Creates menu and handles sidebar operations.
 */

/**
 * Runs when the spreadsheet is opened.
 * Creates the everyrow menu.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('everyrow')
    .addItem('Open Sidebar', 'showSidebar')
    .addSeparator()
    .addItem('Settings', 'showSettings')
    .addToUi();
}

/**
 * Show the main sidebar.
 */
function showSidebar() {
  var html = HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('everyrow')
    .setWidth(380);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Include HTML files (for templates).
 * @param {string} filename - Filename without extension.
 * @return {string} File content.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Show settings dialog.
 */
function showSettings() {
  var ui = SpreadsheetApp.getUi();
  var currentKey = getApiKey();
  var maskedKey = currentKey ? currentKey.substring(0, 10) + '...' : '(not set)';

  var result = ui.prompt(
    'API Key Settings',
    'Current API key: ' + maskedKey + '\n\nEnter new API key (sk-cho-...):\n(Get your key at https://cohort.futuresearch.ai/settings/api-keys)',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    var newKey = result.getResponseText().trim();
    if (newKey) {
      if (!newKey.startsWith('sk-cho-')) {
        ui.alert('Invalid Key', 'API key should start with "sk-cho-"', ui.ButtonSet.OK);
        return;
      }
      saveApiKey(newKey);
      ui.alert('Saved', 'API key saved successfully.', ui.ButtonSet.OK);
    }
  }
}

/**
 * Get sidebar data for initial load.
 * Called from Sidebar.html.
 * @return {Object} Initial state data.
 */
function getSidebarData() {
  return {
    isConfigured: isConfigured(),
    apiKeyMasked: getApiKey() ? getApiKey().substring(0, 10) + '...' : null,
    lastTaskId: getLastTaskId(),
    selectionInfo: getSelectionInfo()
  };
}

/**
 * Save API key from sidebar.
 * @param {string} apiKey - API key to save.
 * @return {Object} Result with success status.
 */
function saveApiKeyFromSidebar(apiKey) {
  if (!apiKey || !apiKey.startsWith('sk-cho-')) {
    return { success: false, error: 'Invalid API key format. Should start with sk-cho-' };
  }
  saveApiKey(apiKey);
  return { success: true };
}
