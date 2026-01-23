#!/usr/bin/env node

/**
 * Test script to verify the Cohort Engine API integration works.
 * Run with: node scripts/test-api.js <api-key>
 */

const API_BASE_URL = 'https://engine.futuresearch.ai';

async function makeApiRequest(method, path, body, apiKey) {
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

  const response = await fetch(url, options);
  const responseText = await response.text();

  if (!response.ok) {
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
    throw new Error(errorMessage);
  }

  return JSON.parse(responseText);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract data from artifact response.
 * Handles both group artifacts (with nested artifacts array) and standalone artifacts.
 */
function extractArtifactData(artifacts) {
  if (!artifacts || artifacts.length === 0) return [];

  const artifact = artifacts[0];

  // If it's a group with nested artifacts, extract data from each child
  if (artifact.type === 'group' && artifact.artifacts && artifact.artifacts.length > 0) {
    return artifact.artifacts.map(child => child.data).filter(Boolean);
  }

  // If it has direct data array, return it
  if (Array.isArray(artifact.data)) {
    return artifact.data;
  }

  // Single artifact with data object
  if (artifact.data) {
    return [artifact.data];
  }

  return [];
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
  console.log('\n🧪 Testing Cohort Engine API Integration\n');

  // Test 1: Create Session
  console.log('1. Creating session...');
  const sessionResult = await makeApiRequest('POST', '/sessions/create', {
    name: 'API Test - ' + new Date().toISOString()
  }, apiKey);
  const sessionId = sessionResult.session_id;
  console.log(`   ✓ Session created: ${sessionId}\n`);

  // Test 2: Create Group (input data)
  console.log('2. Creating input data via CREATE_GROUP task...');
  const testData = [
    { name: 'Apple', industry: 'Technology', employees: 150000 },
    { name: 'Google', industry: 'Technology', employees: 180000 },
    { name: 'Acme Corp', industry: 'Manufacturing', employees: 500 }
  ];

  const createGroupPayload = {
    task_type: 'create_group',
    processing_mode: 'transform',
    query: {
      data_to_create: testData
    },
    input_artifacts: []
  };

  const createTask = await makeApiRequest('POST', '/tasks', {
    payload: createGroupPayload,
    session_id: sessionId
  }, apiKey);
  console.log(`   Task submitted: ${createTask.task_id}`);

  const createStatus = await pollTaskStatus(createTask.task_id, apiKey);
  const inputArtifactId = createStatus.artifact_id;
  console.log(`   ✓ Input artifact created: ${inputArtifactId}\n`);

  // Test 3: Run Deep Rank
  console.log('3. Running DEEP_RANK task...');
  const rankPayload = {
    task_type: 'deep_rank',
    processing_mode: 'map',
    query: {
      task: 'Rank companies by size (number of employees)',
      response_schema: {
        score: { type: 'int', description: 'Score based on company size' }
      },
      field_to_sort_by: 'score',
      ascending_order: false
    },
    input_artifacts: [inputArtifactId],
    context_artifacts: [],
    join_with_input: true
  };

  const rankTask = await makeApiRequest('POST', '/tasks', {
    payload: rankPayload,
    session_id: sessionId
  }, apiKey);
  console.log(`   Task submitted: ${rankTask.task_id}`);

  const rankStatus = await pollTaskStatus(rankTask.task_id, apiKey);
  console.log(`   ✓ Rank completed, artifact: ${rankStatus.artifact_id}\n`);

  // Test 4: Fetch Results
  console.log('4. Fetching results...');
  const artifacts = await makeApiRequest(
    'GET',
    `/artifacts?artifact_ids=${rankStatus.artifact_id}`,
    null,
    apiKey
  );

  // Extract data from artifact - handles both group and standalone artifacts
  let resultData = extractArtifactData(artifacts);

  if (resultData && resultData.length > 0) {
    console.log(`   ✓ Got ${resultData.length} results:\n`);
    resultData.slice(0, 5).forEach((row, i) => {
      console.log(`   ${i + 1}. ${JSON.stringify(row)}`);
    });
  } else {
    console.log('   ⚠ No data found');
  }

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
