#!/usr/bin/env node

/**
 * Test script to verify the everyrow API integration works.
 * Run with: node scripts/test-api.js <api-key>
 */

const API_BASE_URL = 'https://engine.futuresearch.ai/api/v0';

async function makeApiRequest(method, path, body, apiKey, retries = 3) {
  const url = API_BASE_URL + path;

  const options = {
    method,
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    }
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, options);
    const responseText = await response.text();

    if (response.ok) {
      return JSON.parse(responseText);
    }

    // Parse error
    let errorMessage = `API error ${response.status}`;
    try {
      const errorBody = JSON.parse(responseText);
      if (errorBody.detail) {
        errorMessage = typeof errorBody.detail === 'string'
          ? errorBody.detail
          : JSON.stringify(errorBody.detail);
      }
    } catch (e) {
      errorMessage += ': ' + responseText.substring(0, 200);
    }

    lastError = new Error(errorMessage);

    // Retry on 401 (intermittent auth issues) or 5xx (server errors)
    if ((response.status === 401 || response.status >= 500) && attempt < retries) {
      const delay = Math.pow(2, attempt) * 500; // 1s, 2s, 4s
      console.log(`  ⚠ Got ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${retries})...`);
      await sleep(delay);
      continue;
    }

    throw lastError;
  }

  throw lastError;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract data from task result response.
 * The public API v0 returns data directly in the result.
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
 */
function extractScreenResults(taskResult) {
  const records = extractResultData(taskResult);

  return records.map(record => {
    const result = {};

    // Copy all fields except 'research'
    for (const key in record) {
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
 */
function extractDedupeResults(taskResult) {
  const records = extractResultData(taskResult);

  // Filter to only selected rows
  const dedupedRecords = records.filter(record => record.selected === true);

  // Remove deduplication metadata columns
  return dedupedRecords.map(record => {
    const result = {};
    for (const key in record) {
      if (key !== 'selected' && key !== 'equivalence_class_id' && key !== 'equivalence_class_name') {
        result[key] = record[key];
      }
    }
    return result;
  });
}

async function pollTaskStatus(taskId, apiKey, maxWaitMs = 120000) {
  const startTime = Date.now();
  let pollInterval = 2000;

  while (Date.now() - startTime < maxWaitMs) {
    await sleep(pollInterval);

    const status = await makeApiRequest('GET', `/tasks/${taskId}/status`, null, apiKey);
    console.log(`  Task status: ${status.status}`);

    if (status.status === 'completed') {
      return status;
    }

    if (status.status === 'failed') {
      throw new Error('Task failed: ' + (status.error || 'Unknown error'));
    }

    pollInterval = Math.min(pollInterval * 1.5, 10000);
  }

  throw new Error('Task polling timeout');
}

async function runTests(apiKey) {
  console.log('\n🧪 Testing everyrow API Integration\n');

  const testData = [
    { name: 'Apple', industry: 'Technology', employees: 150000 },
    { name: 'Google', industry: 'Technology', employees: 180000 },
    { name: 'Acme Corp', industry: 'Manufacturing', employees: 500 }
  ];

  // Test 1: Run Rank Operation (with inline data - no need to create session/artifact separately)
  console.log('1. Running /operations/rank with inline data...');

  const rankResponse = await makeApiRequest('POST', '/operations/rank', {
    input: testData,
    task: 'Rank companies by size (number of employees)',
    sort_by: 'score',
    ascending: false,
    response_schema: {
      type: 'object',
      properties: {
        score: { type: 'number', description: 'Score based on company size' }
      },
      required: ['score']
    }
  }, apiKey);

  const taskId = rankResponse.task_id;
  const sessionId = rankResponse.session_id;
  console.log(`   Task submitted: ${taskId}`);
  console.log(`   Session (auto-created): ${sessionId}`);

  // Test 2: Poll for completion
  console.log('\n2. Polling for completion...');
  const rankStatus = await pollTaskStatus(taskId, apiKey);
  console.log(`   ✓ Rank completed, artifact: ${rankStatus.artifact_id}\n`);

  // Test 3: Fetch Results using /tasks/{id}/result
  console.log('3. Fetching results via /tasks/{id}/result...');
  const taskResult = await makeApiRequest('GET', `/tasks/${taskId}/result`, null, apiKey);

  const resultData = extractResultData(taskResult);

  if (resultData && resultData.length > 0) {
    console.log(`   ✓ Got ${resultData.length} results:\n`);
    resultData.slice(0, 5).forEach((row, i) => {
      console.log(`   ${i + 1}. ${JSON.stringify(row)}`);
    });
  } else {
    console.log('   ⚠ No data found');
  }

  // Test 4: Run Screen Operation
  console.log('\n4. Running /operations/screen...');
  const screenResponse = await makeApiRequest('POST', '/operations/screen', {
    input: testData,
    task: 'Filter to only technology companies',
    // Screen requires a response_schema with at least one boolean field
    response_schema: {
      type: 'object',
      properties: {
        passes_screen: { type: 'boolean', description: 'Whether the row passes the screen' }
      },
      required: ['passes_screen']
    }
  }, apiKey);

  console.log(`   Task submitted: ${screenResponse.task_id}`);
  const screenStatus = await pollTaskStatus(screenResponse.task_id, apiKey);
  console.log(`   ✓ Screen completed\n`);

  const screenResult = await makeApiRequest('GET', `/tasks/${screenResponse.task_id}/result`, null, apiKey);
  const screenData = extractScreenResults(screenResult);
  console.log(`   Results: ${screenData.length} rows (filtered from ${testData.length})`);
  screenData.forEach((row, i) => {
    console.log(`   ${i + 1}. ${row.name}: passes_screen=${row.passes_screen}, reason="${row.reason}"`);
  });

  // Test 5: Run Dedupe Operation
  console.log('\n5. Running /operations/dedupe...');
  const dedupeData = [
    { name: 'Apple Inc', industry: 'Technology' },
    { name: 'Apple', industry: 'Tech' },
    { name: 'Google', industry: 'Technology' },
    { name: 'Alphabet (Google)', industry: 'Tech' }
  ];

  const dedupeResponse = await makeApiRequest('POST', '/operations/dedupe', {
    input: dedupeData,
    equivalence_relation: 'Same company (different names or spellings)'
  }, apiKey);

  console.log(`   Task submitted: ${dedupeResponse.task_id}`);
  const dedupeStatus = await pollTaskStatus(dedupeResponse.task_id, apiKey);
  console.log(`   ✓ Dedupe completed\n`);

  const dedupeResult = await makeApiRequest('GET', `/tasks/${dedupeResponse.task_id}/result`, null, apiKey);
  const dedupeResultData = extractResultData(dedupeResult);
  const selectedCount = dedupeResultData.filter(r => r.selected).length;
  console.log(`   Results: ${dedupeResultData.length} rows with ${selectedCount} unique (selected=true)`);
  dedupeResultData.forEach((row, i) => {
    console.log(`   ${i + 1}. selected=${row.selected}, class="${row.equivalence_class_name}", ${row.name}`);
  });

  console.log('\n✅ All tests passed!\n');
}

// Main
const apiKey = process.argv[2];

if (!apiKey) {
  console.error('Usage: node scripts/test-api.js <api-key>');
  console.error('  Get your API key at: https://everyrow.io/api-key');
  process.exit(1);
}

if (!apiKey.startsWith('sk-cho-')) {
  console.error('Error: API key should start with "sk-cho-"');
  process.exit(1);
}

runTests(apiKey).catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
