# everyrow Sheets

Google Sheets add-on for running everyrow operations (rank, dedupe, screen) directly from your spreadsheets.

## Features

- **Rank**: Score and sort rows based on natural language criteria
- **Screen**: Filter rows that match specific conditions
- **Dedupe**: Remove duplicate rows based on semantic similarity

## Architecture

```
Google Sheets → Apps Script → Cohort Engine API → Results
```

The add-on calls the Cohort Engine API at `engine.futuresearch.ai` to process your data. Operations run asynchronously and may take several minutes depending on data size.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run interactive setup (authenticates with Google, creates project, pushes code)
pnpm clasp:init
```

That's it! The setup script will:
1. Log you into Google (opens browser)
2. Create an Apps Script project
3. Push the code

Then open any Google Sheet and you'll see the **everyrow** menu.

## Prerequisites

Before running setup:

1. **Enable the Apps Script API** at https://script.google.com/home/usersettings
2. Have a Google account

## Development Commands

```bash
pnpm clasp:init   # Interactive setup (first time)
pnpm push         # Push code changes to Apps Script
pnpm push:watch   # Watch and auto-push on file changes
pnpm open         # Open Apps Script editor in browser
pnpm logs         # View execution logs
pnpm logs:watch   # Stream logs in real-time
pnpm pull         # Pull remote changes (if edited in browser)
```

## User Setup

### 1. Get API Key

1. Go to [cohort.futuresearch.ai/settings/api-keys](https://cohort.futuresearch.ai/settings/api-keys)
2. Create a new API key
3. Copy the key (starts with `sk-cho-`)

### 2. Configure Add-on

1. Open a Google Sheet
2. Click **everyrow → Settings** in the menu bar
3. Paste your API key and save

## Usage

### Quick Actions (via Menu)

1. Select your data (including header row)
2. Click **everyrow** menu
3. Choose **Quick Rank**, **Quick Screen**, or **Quick Dedupe**
4. Enter your criteria
5. Results appear in a new sheet

### Sidebar (for More Options)

1. Click **everyrow → Open Sidebar**
2. Configure operation parameters
3. Click the operation button
4. Monitor status in the sidebar

### Example Operations

**Rank:**
> "Rank companies by growth potential based on revenue and employee count"

**Screen:**
> "B2B SaaS companies with more than 50 employees"

**Dedupe:**
> "Same company, possibly with different name variations or abbreviations"

## File Structure

```
everyrow-sheets/
├── src/
│   ├── Code.gs           # Menu, entry points
│   ├── ApiClient.gs      # HTTP client for Engine API
│   ├── Operations.gs     # Rank, dedupe, screen logic
│   ├── DataHandling.gs   # Sheet ↔ JSON conversion
│   ├── Settings.gs       # API key storage
│   ├── Sidebar.html      # Main UI
│   ├── Styles.html       # CSS
│   └── appsscript.json   # Manifest (scopes)
├── scripts/
│   └── setup.js          # Interactive setup script
├── package.json
└── README.md
```

## Timeout Handling

Operations may take several minutes. If the Apps Script execution times out:

1. The task ID is saved automatically
2. Use **everyrow → Check Previous Task** to check status
3. Once complete, results can be retrieved to a new sheet

## Troubleshooting

### "API key not configured"

Open **everyrow → Settings** and enter your API key.

### "Invalid API key"

Ensure your key starts with `sk-cho-` and is active at [cohort.futuresearch.ai/settings/api-keys](https://cohort.futuresearch.ai/settings/api-keys).

### "Selection must have at least 2 rows"

Select your data including the header row. The first row is used as column names.

### Operation timed out

Use **Check Previous Task** from the menu. The operation continues running on the server.

### Setup fails with "Apps Script API not enabled"

Visit https://script.google.com/home/usersettings and enable the API.

## API Reference

The add-on uses these Cohort Engine API endpoints:

- `POST /sessions/create` - Create a session for grouping tasks
- `POST /artifacts` - Create input artifact from sheet data
- `POST /tasks` - Submit rank/screen/dedupe task
- `GET /tasks/{id}/status` - Poll task status
- `GET /artifacts/{id}` - Retrieve results

## License

Proprietary - Cohort/Futuresearch
