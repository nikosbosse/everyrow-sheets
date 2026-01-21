#!/usr/bin/env node

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CLASP_JSON_PATH = path.join(__dirname, '..', '.clasp.json');
const SRC_DIR = path.join(__dirname, '..', 'src');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function run(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: options.silent ? 'pipe' : 'inherit', ...options });
  } catch (e) {
    if (options.ignoreError) return null;
    throw e;
  }
}

function checkClaspAuth() {
  const result = spawnSync('clasp', ['login', '--status'], { encoding: 'utf8' });
  return result.stdout && result.stdout.includes('You are logged in');
}

async function main() {
  console.log('\n🔧 everyrow Sheets Add-on Setup\n');

  // Check if .clasp.json already exists
  if (fs.existsSync(CLASP_JSON_PATH)) {
    const claspConfig = JSON.parse(fs.readFileSync(CLASP_JSON_PATH, 'utf8'));
    console.log(`✓ Already configured with script ID: ${claspConfig.scriptId}\n`);

    const answer = await question('Push code to this project? (Y/n): ');
    if (answer.toLowerCase() !== 'n') {
      console.log('\nPushing code...');
      run('clasp push');
      console.log('\n✓ Code pushed! Run `pnpm open` to open in browser.\n');
    }
    rl.close();
    return;
  }

  // Step 1: Check clasp authentication
  console.log('Step 1: Checking Google authentication...\n');

  if (!checkClaspAuth()) {
    console.log('You need to log in to Google first.\n');
    console.log('Opening browser for authentication...\n');
    run('clasp login');
  } else {
    console.log('✓ Already logged in to Google\n');
  }

  // Step 2: Create Apps Script project
  console.log('Step 2: Creating Apps Script project...\n');

  const projectName = await question('Project name (default: everyrow Sheets Add-on): ');
  const name = projectName.trim() || 'everyrow Sheets Add-on';

  console.log(`\nCreating project "${name}"...`);

  try {
    run(`clasp create --type sheets --title "${name}" --rootDir src`);
    console.log('\n✓ Project created!\n');
  } catch (e) {
    console.error('\n✗ Failed to create project. You may need to enable the Apps Script API:');
    console.error('  https://script.google.com/home/usersettings\n');
    rl.close();
    process.exit(1);
  }

  // Step 3: Push code
  console.log('Step 3: Pushing code to Apps Script...\n');
  run('clasp push');
  console.log('\n✓ Code pushed!\n');

  // Done
  console.log('━'.repeat(50));
  console.log('\n✓ Setup complete!\n');
  console.log('Next steps:');
  console.log('  1. Run `pnpm open` to open the Apps Script editor');
  console.log('  2. Click Run on the `onOpen` function');
  console.log('  3. Grant permissions when prompted');
  console.log('  4. Open any Google Sheet - you\'ll see the everyrow menu\n');
  console.log('Development commands:');
  console.log('  pnpm push        - Push code changes');
  console.log('  pnpm push:watch  - Watch and auto-push on changes');
  console.log('  pnpm logs        - View execution logs');
  console.log('  pnpm open        - Open Apps Script editor\n');

  rl.close();
}

main().catch((e) => {
  console.error('Error:', e.message);
  rl.close();
  process.exit(1);
});
