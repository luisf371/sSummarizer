// scripts/content-scraper.js

/**
 * Function to be injected into YouTube pages to extract captions
 * This runs in the context of the YouTube page
 */
function extractYouTubeCaptions() {
  console.log('[YT Extractor] Starting caption extraction');
  
  try {
    // Method 1: Try to find any existing caption text in the DOM first
    const captionElements = document.querySelectorAll(
      '.ytp-caption-segment, .captions-text, .caption-window, [class*="caption"], [class*="subtitle"]'
    );
    
    if (captionElements.length > 0) {
      console.log('[YT Extractor] Found caption elements in DOM:', captionElements.length);
      const text = Array.from(captionElements)
        .map(el => el.textContent?.trim())
        .filter(text => text && text.length > 0)
        .join(' ');
      
      if (text.length > 50) { // Only return if we have substantial text
        console.log('[YT Extractor] Extracted caption text, length:', text.length);
        return text;
      }
    }
    
    // Method 2: Try to find transcript segments that might already be loaded
    const transcriptItems = document.querySelectorAll(
      '[data-testid="transcript-segment"], .ytd-transcript-segment-renderer, .ytd-transcript-body-renderer [role="button"]'
    );
    
    if (transcriptItems.length > 0) {
      console.log('[YT Extractor] Found transcript segments:', transcriptItems.length);
      const text = Array.from(transcriptItems)
        .map(item => item.textContent?.trim())
        .filter(text => text && text.length > 0)
        .join(' ');
      
      if (text.length > 50) {
        console.log('[YT Extractor] Extracted transcript text, length:', text.length);
        return text;
      }
    }
    
    // Method 3: Try to extract from ytInitialPlayerResponse in the page
    if (window.ytInitialPlayerResponse) {
      console.log('[YT Extractor] Found ytInitialPlayerResponse');
      const captions = window.ytInitialPlayerResponse.captions;
      if (captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        const tracks = captions.playerCaptionsTracklistRenderer.captionTracks;
        console.log('[YT Extractor] Found caption tracks:', tracks.length);
        
        // Find English auto-generated track
        let track = tracks.find(t => t.languageCode === 'en' && t.kind === 'asr');
        if (!track) track = tracks.find(t => t.languageCode === 'en');
        if (!track && tracks.length > 0) track = tracks[0];
        
        if (track?.baseUrl) {
          console.log('[YT Extractor] Found caption track URL, but cannot fetch due to CORS');
          // Signal that captions exist but we need to use fallback
        }
      }
    }
    
    // Method 4: Try to extract video title and description as fallback
    const title = document.querySelector('h1.ytd-video-primary-info-renderer, #title h1, .title')?.textContent?.trim();
    const description = document.querySelector('#description, .description, #meta-contents')?.textContent?.trim();
    
    if (title) {
      console.log('[YT Extractor] Using title and description as fallback');
      let fallbackText = `Video Title: ${title}`;
      if (description && description.length > 0) {
        // Limit description to first 1000 characters
        const shortDesc = description.length > 1000 ? description.substring(0, 1000) + '...' : description;
        fallbackText += `\n\nDescription: ${shortDesc}`;
      }
      return fallbackText;
    }
    
    console.log('[YT Extractor] No captions or content found');
    return null;
    
  } catch (error) {
    console.error('[YT Extractor] Error:', error);
    return null;
  }
}

function getPageContent() {
  return document.body.innerText;
}