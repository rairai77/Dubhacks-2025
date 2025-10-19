# TabTrap

> A smart Chrome extension for finding and organizing your tabs with AI

Built for **DubHacks 2025** 🎉

## Features

### 🔍 Fuzzy Tab Search

-   Search across all open tabs by **title, URL, and page content**
-   Access via omnibox with the `tt` keyword
-   Intelligent fuzzy matching powered by Fuse.js
-   Search results ranked by relevance

### 📚 History Integration

-   Search not just open tabs, but also your **browser history**
-   History items clearly marked with `[History]` prefix
-   Open tabs always ranked higher than history items
-   Smart caching for fast searches as you type

### ✨ AI-Powered Tab Grouping

-   Automatically group tabs by topic using **Gemini AI**
-   Analyzes tab titles, URLs, and content to create logical groups
-   Assigns colors and names to tab groups
-   One-click organization via popup interface

### ⚡ Smart Navigation

-   Switch to tabs across different windows instantly
-   Automatically closes "New Tab" pages when navigating
-   Keyboard-first workflow for maximum efficiency

## Installation

1. Clone this repository

    ```bash
    git clone <repository-url>
    cd Dubhacks-2025
    ```

2. Set up your Gemini API key (for AI grouping feature)

    ```bash
    cp src/config.example.js src/config.js
    ```

    Edit `src/config.js` and add your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

3. Load the extension in Chrome
    - Go to `chrome://extensions/`
    - Enable "Developer mode"
    - Click "Load unpacked"
    - Select the project folder

## Usage

### Searching Tabs

1. Type `tt` in the Chrome address bar (omnibox)
2. Press tab to activate the extension mode
3. Type your search query
4. Press **Enter** to go to the top match, or use **arrow keys** to select a specific result
5. Results show both open tabs and browser history

### AI Tab Grouping

1. Click the TabTrap extension icon
2. Click **"✨ AI Group Tabs"**
3. Wait for AI to analyze and group your tabs
4. Your tabs will be automatically organized into colored groups!

## Technology Stack

-   **Chrome Extensions API** (Manifest V3)
-   **Fuse.js** - Fuzzy search library
-   **Google Gemini AI** - Intelligent tab grouping
-   **ES Modules** - Modern JavaScript

## Project Structure

```
dh2025/
├── manifest.json           # Extension configuration
├── src/
│   ├── background/
│   │   └── service-worker.js   # Omnibox search logic
│   ├── scripts/
│   │   ├── fuzzySearch.js      # Fuse.js search implementation
│   │   ├── tabs.js             # Tab content scraping
│   │   └── history.js          # Browser history integration
│   ├── popup.html              # Extension popup UI
│   ├── popup.js                # AI grouping logic
│   └── config.js               # API keys (gitignored)
├── lib/
│   └── fuse.mjs               # Fuse.js library
└── icon16.png                 # Extension icon
```

## Development

### Prerequisites

-   Chrome/Chromium browser
-   Gemini API key (for AI features)

### Configuration Files

-   `src/config.js` - Contains your Gemini API key (not committed to git)
-   `.vscode/settings.json` - Excludes config from VS Code Live Share

### Permissions

The extension requires:

-   `tabs` - Access tab information
-   `scripting` - Read page content for searching
-   `history` - Search browser history
-   `storage` - Cache search data
-   `tabGroups` - Create AI-powered tab groups

## How It Works

### Search

1. When you type in the omnibox, the extension scrapes content from all open tabs
2. Tab data is combined with browser history results
3. Fuse.js performs fuzzy matching across titles, URLs, and content
4. Results are cached for the duration of your search session
5. History items receive a score penalty to rank below open tabs

### AI Grouping

1. Extension collects titles, URLs, and first 100 characters of content from each tab
2. Data is sent to Gemini AI with instructions to create logical groups
3. AI returns groups with names, tab IDs, and suggested colors
4. Extension uses Chrome's Tab Groups API to organize tabs

## License

Built with ❤️ for DubHacks 2025
