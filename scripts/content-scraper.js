// scripts/content-scraper.js

/**
 * Function to be injected into YouTube pages to extract captions
 * This runs in the context of the YouTube page
 */
async function extractYouTubeCaptions() {
  console.log('[YT Extractor] Starting caption extraction');
  
  try {
    // Method 1: Try to find active caption text in the current player
    console.log('[YT Extractor] Attempting Method 1: Active caption elements');
    await waitForElement('.ytp-caption-window-container', 2000);
    
    // Updated selectors for current YouTube structure
    const captionSelectors = [
      '.ytp-caption-segment',
      '.caption-window .captions-text',
      '.ytp-caption-window-container .caption-visual-line',
      '.html5-video-container .ytp-caption-segment'
    ];
    
    for (const selector of captionSelectors) {
      const captionElements = document.querySelectorAll(selector);
      if (captionElements.length > 0) {
        console.log('[YT Extractor] Method 1: Found caption elements:', captionElements.length, 'with selector:', selector);
        const text = Array.from(captionElements).map(el => el.textContent?.trim()).filter(Boolean).join(' ');
        
        if (text.length > 50) {
          console.log('[YT Extractor] Method 1: Success! Extracted caption text, length:', text.length);
          return text;
        }
      }
    }
    console.log('[YT Extractor] Method 1: No active captions found');
    
    // Method 2: Try to extract from transcript panel if available
    console.log('[YT Extractor] Attempting Method 2: Transcript panel');
    const transcriptSelectors = [
      'ytd-transcript-segment-renderer .segment-text',
      '[data-testid="transcript-segment"]',
      '.ytd-transcript-segment-renderer',
      'ytd-transcript-body-renderer .segment-text',
      '.transcript-item .cue-group'
    ];
    
    for (const selector of transcriptSelectors) {
      const transcriptItems = document.querySelectorAll(selector);
      if (transcriptItems.length > 0) {
        console.log('[YT Extractor] Method 2: Found transcript segments:', transcriptItems.length, 'with selector:', selector);
        const text = Array.from(transcriptItems).map(item => item.textContent?.trim()).filter(Boolean).join(' ');
        
        if (text.length > 100) {
          console.log('[YT Extractor] Method 2: Success! Extracted transcript text, length:', text.length);
          return text;
        }
      }
    }
    console.log('[YT Extractor] Method 2: No transcript panel found');
    
    // Method 3: Try to get captions data from page context
    console.log('[YT Extractor] Attempting Method 3: Direct caption data extraction');
    const captionData = await extractCaptionDataFromPage();
    if (captionData && captionData.length > 100) {
      console.log('[YT Extractor] Method 3: Success! Extracted direct caption data, length:', captionData.length);
      return captionData;
    }
    
    // Method 4: Wait for and extract from ytInitialPlayerResponse
    console.log('[YT Extractor] Attempting Method 4: ytInitialPlayerResponse');
    await waitForPlayerResponse();
    
    if (window.ytInitialPlayerResponse) {
      console.log('[YT Extractor] Method 4: Found ytInitialPlayerResponse object');
      const captions = window.ytInitialPlayerResponse.captions;
      if (captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        const tracks = captions.playerCaptionsTracklistRenderer.captionTracks;
        console.log('[YT Extractor] Method 4: Found caption tracks:', tracks.length);
        
        // Try to fetch and parse captions directly in content script context
        const captionText = await fetchCaptionsInContext(tracks);
        if (captionText && captionText.length > 100) {
          console.log('[YT Extractor] Method 4: Success! Fetched captions directly, length:', captionText.length);
          return captionText;
        }
        
        // Fallback to background processing
        let track = tracks.find(t => t.languageCode === 'en' && t.kind === 'asr');
        if (!track) track = tracks.find(t => t.languageCode === 'en');
        if (!track && tracks.length > 0) track = tracks[0];
        
        if (track?.baseUrl) {
          console.log('[YT Extractor] Method 4: Found caption track URL, signaling background fetch');
          return "[YT Extractor] Caption track URL found. Proceeding with background fetch.";
        }
      }
    }
    
    // Method 5: Fallback to title and description
    console.log('[YT Extractor] Attempting Method 5: Title and description fallback');
    const title = await extractVideoTitle();
    const description = await extractVideoDescription();
    
    if (title) {
      console.log('[YT Extractor] Method 5: Using title and description as fallback');
      const shortDesc = description ? (description.length > 1000 ? description.substring(0, 1000) + '...' : description) : "";
      return `Video Title: ${title}\n\nDescription: ${shortDesc}`;
    }
    
    console.log('[YT Extractor] All methods failed - no content found');
    return null;
    
  } catch (error) {
    console.error('[YT Extractor] Error:', error);
    return null;
  }
}

// Helper function to wait for elements
async function waitForElement(selector, timeout = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return null;
}

// Helper function to wait for player response
async function waitForPlayerResponse() {
  for (let i = 0; i < 50; i++) { // Wait up to 5 seconds
    if (window.ytInitialPlayerResponse) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Extract captions directly from YouTube's player data
async function extractCaptionDataFromPage() {
  try {
    // Try to access YouTube's internal player data
    const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    if (!player) return null;
    
    // Check if captions are currently being displayed
    const captionContainer = player.querySelector('.ytp-caption-window-container');
    if (captionContainer) {
      const captionText = captionContainer.textContent?.trim();
      if (captionText && captionText.length > 50) {
        return captionText;
      }
    }
    
    return null;
  } catch (error) {
    console.log('[YT Extractor] Error extracting caption data from page:', error);
    return null;
  }
}

// Fetch captions directly in content script context
async function fetchCaptionsInContext(tracks) {
  try {
    let track = tracks.find(t => t.languageCode === 'en' && t.kind === 'asr');
    if (!track) track = tracks.find(t => t.languageCode === 'en');
    if (!track && tracks.length > 0) track = tracks[0];
    
    if (!track?.baseUrl) return null;
    
    console.log('[YT Extractor] Attempting to fetch captions directly:', track.baseUrl);
    
    // Try to fetch the captions XML
    const response = await fetch(track.baseUrl);
    if (!response.ok) {
      console.log('[YT Extractor] Failed to fetch captions, status:', response.status);
      return null;
    }
    
    const xml = await response.text();
    console.log('[YT Extractor] Fetched captions XML, length:', xml.length);
    
    // Parse the XML to extract text
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const textElements = doc.querySelectorAll('text');
    
    if (textElements.length === 0) {
      console.log('[YT Extractor] No text elements found in captions XML');
      return null;
    }
    
    const captions = Array.from(textElements).map(el => {
      const text = el.textContent || '';
      return text.replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .trim();
    }).filter(text => text.length > 0);
    
    const fullText = captions.join(' ');
    console.log('[YT Extractor] Parsed captions, total length:', fullText.length);
    
    return fullText.length > 100 ? fullText : null;
    
  } catch (error) {
    console.log('[YT Extractor] Error fetching captions in context:', error);
    return null;
  }
}

// Extract video title with multiple selectors
async function extractVideoTitle() {
  const titleSelectors = [
    'h1.ytd-video-primary-info-renderer',
    'h1.ytd-videoPrimaryInfoRenderer',
    '#title h1',
    '.ytd-video-primary-info-renderer h1',
    'h1[class*="title"]',
    '.title.style-scope.ytd-video-primary-info-renderer'
  ];
  
  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element?.textContent?.trim()) {
      return element.textContent.trim();
    }
  }
  
  return null;
}

// Extract video description with multiple selectors
async function extractVideoDescription() {
  const descSelectors = [
    '#description-text',
    '.ytd-video-secondary-info-renderer #description',
    '.ytd-expandable-video-description-body-renderer',
    '#meta-contents #description',
    '.description .content',
    'ytd-video-secondary-info-renderer #description'
  ];
  
  for (const selector of descSelectors) {
    const element = document.querySelector(selector);
    if (element?.textContent?.trim()) {
      return element.textContent.trim();
    }
  }
  
  return null;
}

function getPageContent() {
  return document.body.innerText;
}