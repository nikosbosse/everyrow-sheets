/**
 * Data handling utilities for converting between
 * Google Sheets ranges and JSON records.
 */

/**
 * Check if a value is empty (null, undefined, or empty string).
 * @param {*} val - Value to check.
 * @return {boolean} True if empty.
 */
function isEmpty_(val) {
  return val === null || val === undefined || val === '';
}

/**
 * Convert column index to letter (0 -> A, 1 -> B, 26 -> AA, etc.)
 * @param {number} index - Zero-based column index.
 * @return {string} Column letter.
 */
function columnToLetter_(index) {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Convert the current selection to an array of record objects.
 * First row is treated as headers.
 * Automatically removes empty rows and columns.
 * Generates placeholder headers for columns with data but missing headers.
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

  // Get raw headers
  const rawHeaders = values[0].map(h => String(h).trim());

  // Find which columns have at least one non-empty data value
  const validColumnIndices = [];
  for (let j = 0; j < rawHeaders.length; j++) {
    for (let i = 1; i < values.length; i++) {
      if (!isEmpty_(values[i][j])) {
        validColumnIndices.push(j);
        break;
      }
    }
  }

  if (validColumnIndices.length === 0) {
    throw new Error('No columns with data found. Please select cells with data.');
  }

  // Build headers, generating placeholders for empty ones
  const headers = validColumnIndices.map(j => {
    if (rawHeaders[j] !== '') {
      return rawHeaders[j];
    }
    // Generate placeholder like "Column A", "Column B"
    return 'Column ' + columnToLetter_(j);
  });

  // Check for duplicate headers
  const uniqueHeaders = new Set(headers);
  if (uniqueHeaders.size !== headers.length) {
    throw new Error('Duplicate header names found. Please ensure all headers are unique.');
  }

  // Build records, skipping entirely empty rows
  const records = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];

    // Check if row is entirely empty (across valid columns)
    let rowHasData = false;
    for (let k = 0; k < validColumnIndices.length; k++) {
      if (!isEmpty_(row[validColumnIndices[k]])) {
        rowHasData = true;
        break;
      }
    }
    if (!rowHasData) continue; // Skip empty row

    // Build record from valid columns
    const record = {};
    for (let k = 0; k < validColumnIndices.length; k++) {
      record[headers[k]] = row[validColumnIndices[k]];
    }
    records.push(record);
  }

  if (records.length === 0) {
    throw new Error('No data rows found. Please select cells with data.');
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
 * Counts only non-empty rows and columns.
 * @return {Object} Selection info with rowCount, columnCount, headers, range.
 */
function getSelectionInfo() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();

  if (!range) {
    return {
      hasSelection: false,
      rowCount: 0,
      columnCount: 0,
      headers: [],
      rangeA1: null,
      sheetName: null
    };
  }

  const numRows = range.getNumRows();
  const rangeA1 = range.getA1Notation();
  const sheetName = sheet.getName();

  if (numRows < 1) {
    return {
      hasSelection: true,
      rowCount: 0,
      columnCount: 0,
      headers: [],
      rangeA1: rangeA1,
      sheetName: sheetName
    };
  }

  // Read all values to count non-empty rows/columns accurately
  const values = range.getValues();
  const rawHeaders = values[0].map(h => String(h).trim());

  // Find columns that have at least one data value
  const validColumnIndices = [];
  for (let j = 0; j < rawHeaders.length; j++) {
    for (let i = 1; i < values.length; i++) {
      if (!isEmpty_(values[i][j])) {
        validColumnIndices.push(j);
        break;
      }
    }
  }

  // Build headers, generating placeholders for empty ones
  const headers = validColumnIndices.map(j => {
    if (rawHeaders[j] !== '') {
      return rawHeaders[j];
    }
    return 'Column ' + columnToLetter_(j);
  });

  // Count non-empty data rows
  let dataRowCount = 0;
  for (let i = 1; i < values.length; i++) {
    for (let k = 0; k < validColumnIndices.length; k++) {
      if (!isEmpty_(values[i][validColumnIndices[k]])) {
        dataRowCount++;
        break;
      }
    }
  }

  return {
    hasSelection: true,
    rowCount: dataRowCount,
    columnCount: headers.length,
    headers: headers,
    rangeA1: rangeA1,
    sheetName: sheetName
  };
}
