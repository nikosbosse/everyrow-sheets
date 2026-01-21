/**
 * Main entry point for everyrow Sheets add-on.
 * Creates menu and handles quick actions.
 */

/**
 * Runs when the spreadsheet is opened.
 * Creates the everyrow menu.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('everyrow')
    .addItem('Open Sidebar', 'showSidebar')
    .addSeparator()
    .addItem('Quick Rank...', 'showQuickRank')
    .addItem('Quick Screen...', 'showQuickScreen')
    .addItem('Quick Dedupe...', 'showQuickDedupe')
    .addSeparator()
    .addItem('Check Previous Task', 'showCheckPreviousTask')
    .addSeparator()
    .addItem('Settings', 'showSettings')
    .addToUi();
}

/**
 * Show the main sidebar.
 */
function showSidebar() {
  const html = HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('everyrow')
    .setWidth(350);
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
 * Show quick rank dialog.
 */
function showQuickRank() {
  if (!isConfigured()) {
    showSettings();
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Quick Rank',
    'Enter the ranking task (e.g., "Rank companies by growth potential"):',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    const task = result.getResponseText().trim();
    if (task) {
      try {
        ui.alert('Starting...', 'Running rank operation. This may take a few minutes.', ui.ButtonSet.OK);
        const opResult = runRank(task, 'score', false);
        if (opResult.status === 'completed') {
          ui.alert('Complete', 'Rank completed. ' + opResult.rowCount + ' rows written to new sheet.', ui.ButtonSet.OK);
        } else if (opResult.status === 'timeout') {
          ui.alert('Timeout', opResult.message, ui.ButtonSet.OK);
        }
      } catch (e) {
        ui.alert('Error', e.message, ui.ButtonSet.OK);
      }
    }
  }
}

/**
 * Show quick screen dialog.
 */
function showQuickScreen() {
  if (!isConfigured()) {
    showSettings();
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Quick Screen',
    'Enter the screening criteria (e.g., "Companies with revenue > $1M"):',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    const task = result.getResponseText().trim();
    if (task) {
      try {
        ui.alert('Starting...', 'Running screen operation. This may take a few minutes.', ui.ButtonSet.OK);
        const opResult = runScreen(task);
        if (opResult.status === 'completed') {
          ui.alert('Complete', 'Screen completed. ' + opResult.rowCount + ' rows written to new sheet.', ui.ButtonSet.OK);
        } else if (opResult.status === 'timeout') {
          ui.alert('Timeout', opResult.message, ui.ButtonSet.OK);
        }
      } catch (e) {
        ui.alert('Error', e.message, ui.ButtonSet.OK);
      }
    }
  }
}

/**
 * Show quick dedupe dialog.
 */
function showQuickDedupe() {
  if (!isConfigured()) {
    showSettings();
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Quick Dedupe',
    'Enter what makes records duplicates (e.g., "Same company, possibly different names"):',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    const relation = result.getResponseText().trim();
    if (relation) {
      try {
        ui.alert('Starting...', 'Running dedupe operation. This may take a few minutes.', ui.ButtonSet.OK);
        const opResult = runDedupe(relation);
        if (opResult.status === 'completed') {
          ui.alert('Complete', 'Dedupe completed. ' + opResult.rowCount + ' unique rows written to new sheet.', ui.ButtonSet.OK);
        } else if (opResult.status === 'timeout') {
          ui.alert('Timeout', opResult.message, ui.ButtonSet.OK);
        }
      } catch (e) {
        ui.alert('Error', e.message, ui.ButtonSet.OK);
      }
    }
  }
}

/**
 * Show check previous task dialog.
 */
function showCheckPreviousTask() {
  const ui = SpreadsheetApp.getUi();

  try {
    const result = checkPreviousTask();

    if (result.status === 'completed') {
      const writeResult = ui.alert(
        'Task Completed',
        'The previous task has completed. Would you like to write the results to a new sheet?',
        ui.ButtonSet.YES_NO
      );

      if (writeResult === ui.Button.YES) {
        const opResult = retrieveTaskResults(result.taskId, 'Results');
        ui.alert('Complete', opResult.rowCount + ' rows written to new sheet.', ui.ButtonSet.OK);
      }
    } else if (result.status === 'running') {
      ui.alert('Still Running', result.message, ui.ButtonSet.OK);
    }
  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Show settings dialog.
 */
function showSettings() {
  const ui = SpreadsheetApp.getUi();
  const currentKey = getApiKey();
  const maskedKey = currentKey ? currentKey.substring(0, 10) + '...' : '(not set)';

  const result = ui.prompt(
    'API Key Settings',
    'Current API key: ' + maskedKey + '\n\nEnter new API key (sk-cho-...):\n(Get your key at https://cohort.futuresearch.ai/settings/api-keys)',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    const newKey = result.getResponseText().trim();
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
