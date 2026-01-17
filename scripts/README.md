Analysis of Content Extraction Logic

  The extension employs two distinct extraction strategies: a sophisticated multi-stage process for YouTube videos and a simple, broad-stroke approach for all other web pages.

  1. YouTube Extraction Logic
  The extraction logic is contained in scripts/content-scraper.js within the extractYouTubeCaptions() function. It attempts three methods in strict priority order:

   * Priority 1: Internal API (Mimicking Python's `youtube-transcript-api`)
       * Logic:
           1. Fetches the video's watch page HTML in the background.
           2. Extracts the secret INNERTUBE_API_KEY directly from the page source.
           3. Calls YouTube's internal youtubei/v1/player endpoint to retrieve the captionTracks list.
           4. Intelligent Selection: Selects the best track based on user settings (Language preference + Auto-generated vs. Manual priority).
           5. Fetches the raw XML transcript file and parses it into clean text.
       * Features: Supports timestamp extraction ([MM:SS]) if enabled in options.

   * Priority 2: UI Scraping (Transcript Panel)
       * Trigger: Runs only if Priority 1 fails.
       * Logic:
           1. Programmatically searches for and clicks the "Show transcript" button in the YouTube UI.
           2. Waits for the panel to open.
           3. Scrapes the visible text content from the DOM using selectors like ytd-transcript-segment-renderer.

   * Priority 3: Metadata Fallback
       * Trigger: Runs if both transcript methods fail (e.g., video has no captions).
       * Logic: Scrapes the Video Title and Description (truncated to 1000 chars) to provide some context for the AI to summarize.

  2. General Web Page Extraction Logic
  For all non-YouTube URLs, the extension uses a single, straightforward method:

   * Method: `getPageContent()`
       * Logic: Simply returns document.body.innerText.
       * Behavior: This captures all visible text on the page, including navigation menus, footers, and sidebars. It relies on the AI model to sift through the noise and identify the main content.
