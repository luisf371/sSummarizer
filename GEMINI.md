# sSummarizer - Chrome Extension Context

## Project Overview
**sSummarizer** is a Chrome Extension (Manifest V3) designed to intelligently summarize web content using AI. It features a modern floating window interface and supports both regular web pages and YouTube video transcripts. It is designed to be model-agnostic, allowing users to configure their own OpenAI-compatible API endpoints.

## Architecture
The project is built using **Vanilla JavaScript, HTML, and CSS**, requiring no complex build chain. It adheres to the Chrome Extension Manifest V3 specification.

### Core Components
*   **Service Worker (`background.js`):** The central orchestrator. It handles extension icon clicks, manages API communication (including streaming responses), and coordinates between the content scripts and the AI service.
*   **Content Script (`content.js`):** Injected into web pages. It is responsible for rendering the floating UI window, handling user interactions (dragging, resizing), and displaying the streaming summary.
*   **Scraper Module (`scripts/content-scraper.js`):** A specialized script injected dynamically to handle the logic of extracting clean text from web pages and YouTube transcripts.
*   **Options Page (`options.html`, `options.js`):** Provides a user interface for configuring API endpoints, keys, models, and system prompts. Settings are persisted in `chrome.storage`.

## Key Files & Directories

*   **`manifest.json`**: The entry point defining permissions, scripts, and resources.
*   **`background.js`**: Service worker logic.
*   **`content.js`**: UI and interaction logic injected into the page.
*   **`scripts/content-scraper.js`**: Modularized content extraction logic.
*   **`options.html` / `options.js`**: Settings UI.
*   **`styles.css`**: Shared styles for the extension UI.
*   **`logo.png`**: Extension icon.

## Development Workflow

### 1. Installation (Load Unpacked)
Since this project uses vanilla JavaScript, there is no build step required before testing changes.
1.  Open Chrome and navigate to `chrome://extensions/`.
2.  Enable **Developer mode** (toggle in top-right).
3.  Click **Load unpacked**.
4.  Select the root directory of this project (`D:\Chrome Extensions\sSummarizer`).

### 2. Making Changes
*   **UI/Logic:** Edit `content.js`, `background.js`, or `styles.css` directly.
*   **Reloading:** After making changes to `background.js` or `manifest.json`, you must click the **Reload** icon on the extension card in `chrome://extensions/`. Changes to `content.js` usually require refreshing the web page you are testing on.

### 3. API Configuration
To test the extension, you must configure a valid API provider in the Options page:
1.  Right-click the extension icon -> **Options**.
2.  Enter an API Endpoint (e.g., OpenAI, Anthropic, or a local LLM serving an OpenAI-compatible endpoint).
3.  Enter the API Key and Model Name.

## Conventions
*   **Modularization:** Logic for scraping is kept separate in `scripts/` to maintain a clean separation of concerns.
*   **Styling:** CSS should be scoped or specific enough to avoid conflicting with host page styles (though Shadow DOM is the ideal long-term solution, current implementation uses a floating div).
*   **Async/Await:** Extensive use of modern async patterns for API calls and messaging.
*   **Error Handling:** Robust error handling for API failures and network issues is prioritized (as seen in `background.js`).

## Supported Content Types

The extension provides specialized extraction logic for different content types to ensure optimal summarization:

*   **Regular web pages (extracts visible text):** Uses a generic `document.body.innerText` approach, suitable for most articles and simple web pages.
*   **YouTube videos (extracts transcripts):** Employs a multi-stage approach to get high-fidelity transcripts, prioritizing YouTube's internal API, falling back to UI scraping, and finally to video title/description if no transcripts are available. Configurable options include:
    *   **Include Timestamps:** To include timestamps in the transcript.
    *   **Subtitle Type:** Prioritize Automatic (ASR) or Manual (human-provided) subtitles.
    *   **Preferred Language:** Specify the language for subtitles.
*   **Reddit Threads (custom extraction for posts and comments):** Designed to clean noise and provide structured content. Configurable options include:
    *   **Max Comments:** Specifies the maximum number of top-level comments to extract.
    *   **Include Reply Depth:** Defines how many levels of replies to include for each extracted comment (0 for top-level only).
    *   **Sort Comments By:** Allows selecting the comment sort order (Current, Best, Top, New). If not "Current", the extension fetches the sorted page content in the background.
    *   **Debug Mode:** Currently, for Reddit URLs, the extracted content is displayed directly in the floating window for validation, bypassing the AI model. This allows review of the cleaned output before it's sent for summarization.
