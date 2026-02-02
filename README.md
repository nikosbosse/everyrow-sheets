# everyrow Sheets

Google Sheets add-on for running everyrow operations directly from your spreadsheets.

## Features

- **Rank**: Score and sort rows based on natural language criteria
- **Screen**: Filter rows that match specific conditions
- **Dedupe**: Remove duplicate rows based on semantic similarity
- **Merge**: Combine two tables using AI-powered matching
- **Agent**: Run AI research on each row (find LinkedIn pages, company info, etc.)

## Architecture

```
Google Sheets → Apps Script → everyrow API → Results
```

The add-on calls the everyrow API at `engine.futuresearch.ai` to process your data. Operations run asynchronously and may take several minutes depending on data size.

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
pnpm test:api     # Test API integration (requires API key argument)
```

## User Setup

### 1. Get API Key

1. Go to [everyrow.io/api-key](https://everyrow.io/api-key)
2. Create a new API key
3. Copy the key (starts with `sk-cho-`)

### 2. Configure Add-on

1. Open a Google Sheet
2. Click **everyrow → Open** in the menu bar
3. Paste your API key in the sidebar and save

## Usage

1. Click **everyrow → Open** to open the sidebar
2. Choose an operation (Rank, Screen, Dedupe, Merge, or Agent)
3. Select an input sheet from the dropdown (defaults to current sheet)
4. Enter your criteria/instructions
5. Optionally configure additional options (score column name, output columns, etc.)
6. Click the run button
7. Results appear in a new sheet tab

### Example Operations

**Rank:**
> "Rank companies by growth potential based on revenue and employee count"

**Screen:**
> "B2B SaaS companies with more than 50 employees"

**Dedupe:**
> "Same company, possibly with different name variations or abbreviations"

**Merge:**
> "Match companies from both tables by name, even if spellings differ slightly"

**Agent:**
> "Research this company and find their LinkedIn page, headquarters location, and founding year"

## File Structure

```
everyrow-sheets/
├── src/
│   ├── Code.gs           # Menu, entry points
│   ├── ApiClient.gs      # HTTP client for everyrow API
│   ├── Operations.gs     # Rank, dedupe, screen, agent, merge logic
│   ├── DataHandling.gs   # Sheet ↔ JSON conversion
│   ├── Settings.gs       # API key storage
│   ├── Sidebar.html      # Main UI
│   ├── Styles.html       # CSS
│   └── appsscript.json   # Manifest (scopes)
├── scripts/
│   ├── setup.js          # Interactive setup script
│   └── test-api.js       # API integration test
├── package.json
└── README.md
```

## Troubleshooting

### "API key not configured"

Open **everyrow → Open** and enter your API key in the sidebar.

### "Invalid API key"

Ensure your key starts with `sk-cho-` and is active at [everyrow.io/api-key](https://everyrow.io/api-key).

### "No data rows found"

Ensure the selected sheet has at least a header row and one data row.

### Operation timed out

The operation continues running on the server. The task ID is saved, but currently you'll need to wait and retry.

### Setup fails with "Apps Script API not enabled"

Visit https://script.google.com/home/usersettings and enable the API.

## API Reference

The add-on uses these everyrow API endpoints:

- `POST /operations/rank` - Score and sort rows
- `POST /operations/screen` - Filter rows by criteria
- `POST /operations/dedupe` - Find and group duplicates
- `POST /operations/merge` - Combine two tables
- `POST /operations/agent-map` - Run AI research per row
- `GET /tasks/{id}/status` - Poll task status
- `GET /tasks/{id}/result` - Retrieve results

## License

Proprietary - everyrow
