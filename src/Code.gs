/**
 * Main entry point for everyrow Sheets add-on.
 * Creates menu and handles sidebar operations.
 */

/**
 * Runs when the spreadsheet is opened.
 * Creates the Everyrow menu.
 * Handles AuthMode.NONE for unauthenticated state.
 */
function onOpen(e) {
  var menu = SpreadsheetApp.getUi().createMenu('Everyrow');
  if (e && e.authMode === ScriptApp.AuthMode.NONE) {
    // AuthMode.NONE: only add menu items that don't require authorization
    menu.addItem('Open', 'showSidebar');
  } else {
    // AuthMode.LIMITED or FULL: safe to add items that require auth
    menu.addItem('Open', 'showSidebar');
  }
  menu.addToUi();
}

/**
 * Runs when the add-on is first installed.
 * Delegates to onOpen to populate the menu immediately.
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Show the main sidebar.
 */
function showSidebar() {
  var html = HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('Everyrow')
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
