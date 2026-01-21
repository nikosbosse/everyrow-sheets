/**
 * Data handling utilities for converting between
 * Google Sheets ranges and JSON records.
 */

/**
 * Convert the current selection to an array of record objects.
 * First row is treated as headers.
 * @return {Object[]} Array of objects where keys are header names.
 * @throws {Error} If no selection or selection is too small.
 */
function selectionToRecords() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();

  if (!range) {
    throw new Error('No cells selected. Please select the data you want to process.');
  }

  const values = range.getValues();

  if (values.length < 2) {
    throw new Error('Selection must have at least 2 rows (1 header row + 1 data row).');
  }

  const headers = values[0].map(h => String(h).trim());

  // Validate headers
  if (headers.some(h => h === '')) {
    throw new Error('All header cells must have values. Please check your selection.');
  }

  // Check for duplicate headers
  const uniqueHeaders = new Set(headers);
  if (uniqueHeaders.size !== headers.length) {
    throw new Error('Duplicate header names found. Please ensure all headers are unique.');
  }

  const records = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const record = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = row[j];
    }
    records.push(record);
  }

  return records;
}

/**
 * Get the headers from the current selection.
 * @return {string[]} Array of header names.
 */
function getSelectionHeaders() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();

  if (!range) {
    return [];
  }

  const values = range.getValues();
  if (values.length < 1) {
    return [];
  }

  return values[0].map(h => String(h).trim()).filter(h => h !== '');
}

/**
 * Write records to a new sheet with formatting.
 * @param {Object[]} records - Array of record objects.
 * @param {string} sheetName - Name for the new sheet.
 * @return {Sheet} The created sheet.
 */
function writeResultsToSheet(records, sheetName) {
  if (!records || records.length === 0) {
    throw new Error('No results to write.');
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // Generate unique sheet name if needed
  let finalName = sheetName;
  let counter = 1;
  while (spreadsheet.getSheetByName(finalName)) {
    finalName = sheetName + ' (' + counter + ')';
    counter++;
  }

  const sheet = spreadsheet.insertSheet(finalName);

  // Get all unique headers from records
  const headerSet = new Set();
  records.forEach(record => {
    Object.keys(record).forEach(key => headerSet.add(key));
  });
  const headers = Array.from(headerSet);

  // Build data array
  const data = [headers];
  records.forEach(record => {
    const row = headers.map(h => {
      const val = record[h];
      // Handle nested objects/arrays by converting to string
      if (val !== null && typeof val === 'object') {
        return JSON.stringify(val);
      }
      return val !== undefined ? val : '';
    });
    data.push(row);
  });

  // Write data
  const range = sheet.getRange(1, 1, data.length, headers.length);
  range.setValues(data);

  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#f3f3f3');

  // Freeze header row
  sheet.setFrozenRows(1);

  // Auto-resize columns
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  // Activate the new sheet
  spreadsheet.setActiveSheet(sheet);

  return sheet;
}

/**
 * Get info about the current selection for display.
 * @return {Object} Selection info with rowCount, columnCount, headers.
 */
function getSelectionInfo() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();

  if (!range) {
    return {
      hasSelection: false,
      rowCount: 0,
      columnCount: 0,
      headers: []
    };
  }

  const values = range.getValues();
  const headers = values.length > 0
    ? values[0].map(h => String(h).trim()).filter(h => h !== '')
    : [];

  return {
    hasSelection: true,
    rowCount: values.length - 1, // Exclude header row
    columnCount: headers.length,
    headers: headers
  };
}
