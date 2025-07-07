# Changelog

## v1.3 - Minor
  - Free scroll movement on popup during incoming stream - allows users to read while streaming.

## v1.2 - Minor Option Enhancement
  - Modified System Prompt box to calculate based on chrome.storage.sync limitation of 8Kb of data.

## v1.1 - Major Refactor and UI/UX Overhaul
- **Code Refactoring**:
  - Modularized content scraping functions into a separate `scripts/content-scraper.js` file.
- **UI/UX Enhancements**:
  - Implemented and fixed streaming mode for API responses, with a toggle in the options.
  - Removed the hardcoded "AI Summary:" prefix from the summarization output.
  - The floating window now remembers its size and position between sessions.
  - Implemented a persistent font size for the summary window, which can be configured in the options.
  - Changed font size controls to adjust in 1px increments.
- **Bug Fixes**:
  - Corrected the minimize button functionality to properly collapse and restore the window.
  - Fixed issues with streaming text, including dropped content and incorrect newlines, by implementing a content buffering strategy.

## v1.0: Initial working version