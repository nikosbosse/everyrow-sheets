#!/usr/bin/env node
/**
 * Deployment automation for everyrow-sheets
 *
 * Usage:
 *   node scripts/deploy.js push              # Push code only
 *   node scripts/deploy.js version "1.2.0"   # Create new version
 *   node scripts/deploy.js status            # Check deployment status
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CLASP_JSON = path.join(__dirname, '..', '.clasp.json');

function exec(cmd, options = {}) {
    console.log(`$ ${cmd}`);
    try {
        return execSync(cmd, {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..'),
            ...options
        });
    } catch (error) {
        console.error(`Command failed: ${cmd}`);
        process.exit(1);
    }
}

function execCapture(cmd) {
    try {
        return execSync(cmd, {
            cwd: path.join(__dirname, '..'),
            encoding: 'utf8'
        });
    } catch (error) {
        return null;
    }
}

function getClaspConfig() {
    if (!fs.existsSync(CLASP_JSON)) {
        console.error('Error: .clasp.json not found. Run "pnpm clasp:init" first.');
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(CLASP_JSON, 'utf8'));
}

function checkClaspAuth() {
    const clasprc = path.join(require('os').homedir(), '.clasprc.json');
    if (!fs.existsSync(clasprc)) {
        console.error('Error: Not logged into clasp. Run "npx clasp login" first.');
        process.exit(1);
    }
}

function push() {
    console.log('\n📦 Pushing code to Apps Script...\n');
    exec('npx clasp push --force');
    console.log('\n✅ Push complete!\n');
}

function listVersions() {
    console.log('\n📋 Versions:\n');
    exec('npx clasp versions');
}

function listDeployments() {
    console.log('\n🚀 Deployments:\n');
    exec('npx clasp deployments');
}

function createVersion(description) {
    console.log(`\n📝 Creating new version: ${description}\n`);
    exec(`npx clasp version "${description}"`);
    console.log('\n✅ Version created!\n');
}

function deploy(versionNumber, deploymentId) {
    if (deploymentId) {
        console.log(`\n🚀 Updating deployment ${deploymentId} to version ${versionNumber}...\n`);
        exec(`npx clasp deploy --versionNumber ${versionNumber} --deploymentId ${deploymentId}`);
    } else {
        console.log(`\n🚀 Creating new deployment for version ${versionNumber}...\n`);
        exec(`npx clasp deploy --versionNumber ${versionNumber}`);
    }
    console.log('\n✅ Deployment complete!\n');
}

function status() {
    checkClaspAuth();
    const config = getClaspConfig();

    console.log('\n📊 everyrow-sheets Deployment Status\n');
    console.log('━'.repeat(50));
    console.log(`Script ID: ${config.scriptId}`);
    console.log(`Root Dir:  ${config.rootDir}`);
    if (config.parentId) {
        console.log(`Parent:    ${config.parentId}`);
    }
    console.log('━'.repeat(50));

    listVersions();
    listDeployments();

    console.log('\n📝 Next steps for Marketplace update:');
    console.log('1. Create new version if needed: node scripts/deploy.js version "description"');
    console.log('2. Update Marketplace SDK version number in GCP Console');
    console.log('3. Marketplace: https://console.cloud.google.com/apis/api/appsmarket-component.googleapis.com/googleApps_sdk\n');
}

function open() {
    console.log('\n🌐 Opening Apps Script editor...\n');
    exec('npx clasp open');
}

function logs(watch = false) {
    console.log('\n📜 Fetching logs...\n');
    exec(`npx clasp logs${watch ? ' --watch' : ''}`);
}

function printHelp() {
    console.log(`
everyrow-sheets Deployment Tool
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commands:
  push                        Push code to Apps Script
  version <description>       Push code and create new version
  versions                    List all versions
  deployments                 List all deployments
  deploy <version> [id]       Deploy version (optionally update existing)
  status                      Show current deployment status
  open                        Open Apps Script editor in browser
  logs                        View execution logs
  logs:watch                  Stream logs in real-time

Examples:
  node scripts/deploy.js push
  node scripts/deploy.js version "v1.2.0 - Added batch processing"
  node scripts/deploy.js deploy 5
  node scripts/deploy.js deploy 5 AKfycbw...   # Update specific deployment
  node scripts/deploy.js status

Workflow for Updates:
  1. Make code changes in src/
  2. Run: node scripts/deploy.js push
  3. Run: node scripts/deploy.js version "v1.x.x - Changes"
  4. Update Marketplace SDK version in GCP Console (for published add-ons)

For setup and usage, see README.md
`);
}

// Main
const [,, command, ...args] = process.argv;

checkClaspAuth();

switch (command) {
    case 'push':
        push();
        break;

    case 'version':
        if (!args[0]) {
            console.error('Error: Version description required');
            console.log('Usage: node scripts/deploy.js version "description"');
            process.exit(1);
        }
        push();
        createVersion(args[0]);
        listVersions();
        break;

    case 'versions':
        listVersions();
        break;

    case 'deployments':
        listDeployments();
        break;

    case 'deploy':
        if (!args[0]) {
            console.error('Error: Version number required');
            console.log('Usage: node scripts/deploy.js deploy <version> [deploymentId]');
            process.exit(1);
        }
        deploy(args[0], args[1]);
        listDeployments();
        break;

    case 'status':
        status();
        break;

    case 'open':
        open();
        break;

    case 'logs':
        logs(false);
        break;

    case 'logs:watch':
        logs(true);
        break;

    case 'help':
    case '--help':
    case '-h':
        printHelp();
        break;

    default:
        if (command) {
            console.error(`Unknown command: ${command}\n`);
        }
        printHelp();
        process.exit(command ? 1 : 0);
}
