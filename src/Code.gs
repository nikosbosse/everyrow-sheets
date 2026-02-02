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
    .addItem('Open', 'showSidebar')
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
 * Get sidebar data for initial load.
 * Called from Sidebar.html.
 * Optimized to minimize API calls.
 * @return {Object} Initial state data.
 */
function getSidebarData() {
  // Load settings once instead of multiple calls
  var settings = getAllSettings();
  var apiKey = settings.apiKey || null;

  return {
    isConfigured: !!(apiKey && apiKey.startsWith('sk-cho-')),
    apiKeyMasked: apiKey ? apiKey.substring(0, 10) + '...' : null,
    lastTaskId: settings.lastTaskId || null,
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

/**
 * Get list of all available sheets in the workbook.
 * @return {Object} Object with sheets array and currentSheet name.
 */
function getAvailableSheets() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = spreadsheet.getSheets();
  var activeSheet = spreadsheet.getActiveSheet();

  return {
    sheets: sheets.map(function(sheet) {
      return { name: sheet.getName() };
    }),
    currentSheet: activeSheet.getName()
  };
}
