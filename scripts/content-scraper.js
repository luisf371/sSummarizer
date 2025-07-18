// scripts/content-scraper.js

/**
 * Function to be injected into YouTube pages to extract captions
 * This runs in the context of the YouTube page
 * Based on the Python youtube-transcript-api implementation
 */
async function extractYouTubeCaptions() {
    console.log('[YT Extractor] Starting YouTube transcript extraction');

    try {
        // Method 1: Use YouTube Internal API
        console.log('[YT Extractor] Attempting Method: YouTube Internal API');
        const videoId = extractVideoIdFromUrl(window.location.href);
        if (videoId) {
            const transcriptData = await getTranscriptViaInternalAPI(videoId);
            if (transcriptData && transcriptData.length > 100) {
                console.log('[YT Extractor] Success! Extracted transcript via internal API, length:', transcriptData.length);
                return transcriptData;
            }
        } else {
            console.error('[YT Extractor] Could not extract video ID from URL.');
        }

        // Method 2: Try to access transcript panel
        console.log('[YT Extractor] Attempting Method: Transcript panel extraction');
        const transcriptPanelData = await extractFromTranscriptPanel();
        if (transcriptPanelData && transcriptPanelData.length > 100) {
            console.log('[YT Extractor] Success! Extracted from transcript panel, length:', transcriptPanelData.length);
            return transcriptPanelData;
        }

        // Method 3: Fallback to title and description
        console.log('[YT Extractor] All transcript methods failed, falling back to title and description');
        return await fallbackToTitleDescription();

    } catch (error) {
        console.error('[YT Extractor] Error in extractYouTubeCaptions:', error);
        return await fallbackToTitleDescription();
    }
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoIdFromUrl(url) {
  const patterns = [
    /// orig working
    // /[?&]v=([^&]+)/,
    // /\/embed\/([^?&]+)/,
    // /\/watch\/([^?&]+)/,
    // /youtu\.be\/([^?&]+)/
    // gpt improved
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
    /\/watch\/([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Get transcript using YouTube's internal API (mimicking Python implementation)
 */
async function getTranscriptViaInternalAPI(videoId) {
  try {
    console.log('[YT Extractor] Fetching watch page HTML for video:', videoId);
    
    // Step 1: Fetch the YouTube watch page HTML
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.log('[YT Extractor] Failed to fetch watch page, status:', response.status);
      return null;
    }
    
    const html = await response.text();
    console.log('[YT Extractor] Fetched HTML, length:', html.length);
    
    // Step 2: Extract INNERTUBE_API_KEY from HTML
    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([a-zA-Z0-9_-]+)"/);
    if (!apiKeyMatch) {
      console.log('[YT Extractor] Could not find INNERTUBE_API_KEY in HTML');
      return null;
    }
    
    const apiKey = apiKeyMatch[1];
    console.log('[YT Extractor] Extracted INNERTUBE_API_KEY:', apiKey);
    
    // Step 3: Make request to YouTube InnerTube API
    const innertubeUrl = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`;
    const innertubeResponse = await fetch(innertubeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20231201.00.00'
          }
        },
        videoId: videoId
      })
    });
    
    if (!innertubeResponse.ok) {
      console.log('[YT Extractor] InnerTube API request failed, status:', innertubeResponse.status);
      return null;
    }
    
    const innertubeData = await innertubeResponse.json();
    console.log('[YT Extractor] InnerTube API response received');
    
    // Step 4: Extract captions from response
    const captions = innertubeData?.captions?.playerCaptionsTracklistRenderer;
    if (!captions || !captions.captionTracks) {
      console.log('[YT Extractor] No caption tracks found in InnerTube response');
      return null;
    }
    
    console.log('[YT Extractor] Found caption tracks:', captions.captionTracks.length);
    
    // Step 5: Find the best caption track (prioritize English, then auto-generated)
    const tracks = captions.captionTracks;
    let selectedTrack = tracks.find(t => t.languageCode === 'en' && t.kind !== 'asr'); // Manual English
    if (!selectedTrack) selectedTrack = tracks.find(t => t.languageCode === 'en' && t.kind === 'asr'); // Auto English
    if (!selectedTrack) selectedTrack = tracks.find(t => t.kind !== 'asr'); // Any manual
    if (!selectedTrack) selectedTrack = tracks.find(t => t.kind === 'asr'); // Any auto
    if (!selectedTrack && tracks.length > 0) selectedTrack = tracks[0]; // First available
    
    if (!selectedTrack?.baseUrl) {
      console.log('[YT Extractor] No suitable caption track found');
      return null;
    }
    
    console.log('[YT Extractor] Selected caption track:', {
      language: selectedTrack.name?.runs?.[0]?.text || selectedTrack.languageCode,
      isGenerated: selectedTrack.kind === 'asr'
    });
    
    // Step 6: Fetch and parse caption XML
    let captionUrl = selectedTrack.baseUrl;
    // Clean the URL (remove fmt=srv3 as per Python implementation)
    captionUrl = captionUrl.replace('&fmt=srv3', '');
    
    console.log('[YT Extractor] Fetching captions from URL:', captionUrl);
    
    const captionResponse = await fetch(captionUrl);
    if (!captionResponse.ok) {
      console.log('[YT Extractor] Failed to fetch captions, status:', captionResponse.status);
      return null;
    }
    
    const xmlText = await captionResponse.text();
    console.log('[YT Extractor] Fetched caption XML, length:', xmlText.length);
    
    // Step 7: Parse XML and extract text
    return await parseYouTubeCaptionXML(xmlText);
    
  } catch (error) {
    console.error('[YT Extractor] Error in getTranscriptViaInternalAPI:', error);
    return null;
  }
}
/**
 * Formats seconds into [HH:MM:SS] format.
 * @param {number} totalSeconds - The total seconds to format.
 * @returns {string} The formatted timestamp string.
 */
function formatTimestamp(totalSeconds) {
    const floorSeconds = Math.floor(totalSeconds);
    const hours = Math.floor(floorSeconds / 3600);
    const minutes = Math.floor((floorSeconds % 3600) / 60);
    const seconds = floorSeconds % 60;

    // Pad with leading zeros if necessary
    const pad = (num) => String(num).padStart(2, '0');

    return `[${pad(hours)}:${pad(minutes)}:${pad(seconds)}]`;
}


/**
 * Parse YouTube caption XML (mimicking Python ElementTree parsing)
 */
async function parseYouTubeCaptionXML(xmlText) {
  try {
    console.log('[YT Extractor] Parsing caption XML');
    
    if (!xmlText || !xmlText.trim()) {
      console.log('[YT Extractor] Empty XML text');
      return null;
    }
    
    // Parse XML using DOMParser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    
    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      console.error('[YT Extractor] XML parsing error:', parserError.textContent);
      return null;
    }
    
    // Extract text elements (equivalent to Python's ElementTree.fromstring(raw_data))
    const textElements = xmlDoc.querySelectorAll('text');
    console.log('[YT Extractor] Found text elements:', textElements.length);
    
    if (textElements.length === 0) {
      console.log('[YT Extractor] No text elements found in XML');
      return null;
    }
    
    // Convert to transcript snippets (mimicking Python's list comprehension)
    const snippets = [];
    for (const element of textElements) {
      const textContent = element.textContent;
      if (textContent) {
        // Clean HTML tags and decode entities (mimicking Python's re.sub and unescape)
        const cleanText = textContent
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ')
          .trim();
        
        if (cleanText) {
          snippets.push({
            text: cleanText,
            start: parseFloat(element.getAttribute('start') || '0'),
            duration: parseFloat(element.getAttribute('dur') || '0')
          });
        }
      }
    }
    
    console.log('[YT Extractor] Parsed snippets:', snippets.length);
    
    if (snippets.length === 0) {
      return null;
    }
    
    // Get timestamp setting
    const { includeTimestamps } = await new Promise(resolve => 
        chrome.storage.sync.get({ includeTimestamps: false }, resolve)
    );

    // Sort by start time and join text
    snippets.sort((a, b) => a.start - b.start);

            let fullTranscript;
    if (includeTimestamps) {
        fullTranscript = snippets.map(s => `${formatTimestamp(s.start)} ${s.text}`).join(' ');
    } else {
        fullTranscript = snippets.map(s => s.text).join(' ');
    }

    // Append timestamp info
    const subtitleInfo = `

- - - - - - - - - - - - - -
Input contains timestamps: ${includeTimestamps}`;
    fullTranscript += subtitleInfo;

    console.log('[YT Extractor] Full transcript length:', fullTranscript.length);
    return fullTranscript;
    
  } catch (error) {
    console.error('[YT Extractor] Error parsing caption XML:', error);
    return null;
  }
}

/**
 * Extract from transcript panel (if available)
 */
async function extractFromTranscriptPanel() {
  try {
    // Try to find and click transcript button
    const transcriptButton = document.querySelector('button[aria-label*="transcript" i], button[aria-label*="Show transcript" i]');
    if (transcriptButton && !transcriptButton.getAttribute('aria-pressed')) {
      console.log('[YT Extractor] Clicking transcript button');
      transcriptButton.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    const transcriptSelectors = [
      'ytd-transcript-segment-renderer .segment-text',
      '[data-testid="transcript-segment"]',
      '.ytd-transcript-segment-renderer',
      'ytd-transcript-body-renderer .segment-text'
    ];
    
    for (const selector of transcriptSelectors) {
      const transcriptItems = document.querySelectorAll(selector);
      if (transcriptItems.length > 0) {
        console.log('[YT Extractor] Found transcript segments:', transcriptItems.length, 'with selector:', selector);
        const text = Array.from(transcriptItems).map(item => item.textContent?.trim()).filter(Boolean).join(' ');
        
        if (text.length > 100) {
          return text;
        }
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('[YT Extractor] Error in extractFromTranscriptPanel:', error);
    return null;
  }
}

/**
 * Fallback to title and description
 */
async function fallbackToTitleDescription() {
  try {
    console.log('[YT Extractor] Using title and description fallback');
    const title = await extractVideoTitle();
    const description = await extractVideoDescription();
    
    if (title) {
      const shortDesc = description ? (description.length > 1000 ? description.substring(0, 1000) + '...' : description) : "";
      return `Video Title: ${title}\n\nDescription: ${shortDesc}`;
    }
    
    return null;
    
  } catch (error) {
    console.error('[YT Extractor] Error in fallbackToTitleDescription:', error);
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