// background.js - Chrome Extension Service Worker
// Handles URL content extraction and API communication for summarization
console.log('[Background] Service worker loaded');

// Maps unique request IDs to tab IDs for tracking multiple concurrent requests
let tabIdMap = new Map();

// Configuration constants
const CONFIG = {
  MAX_TEXT_LENGTH: 50000, // Maximum text length to send to API
  REQUEST_TIMEOUT: 30000, // 30 seconds timeout for API requests
  RETRY_ATTEMPTS: 3,
  YOUTUBE_TRANSCRIPT_TIMEOUT: 10000
};

// Wrap click logic in its own async function so we can catch errors
chrome.action.onClicked.addListener((tab) => {
  console.log('[Background] icon clicked:', tab);
  handleIconClick(tab).catch(err => {
    console.error('[Background] handleIconClick error:', err);
  });
});

async function handleIconClick(tab) {
  console.log('[Background] handleIconClick start – tab.id=', tab.id, 'url=', tab.url);

  // Validate tab and URL
  if (!tab || !tab.id || !tab.url) {
    console.error('[Background] Invalid tab object:', tab);
    return;
  }

  // Check if URL is processable
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
    console.warn('[Background] Cannot process browser internal pages');
    return;
  }

  const uniqueId = Date.now() + Math.floor(Math.random() * 1000); // More unique ID (integer only)
  tabIdMap.set(uniqueId, tab.id);

  try {
    // Kick off the UI with error handling
    await sendMessageSafely(tab.id, { action: 'createFloatingWindow', uniqueId });
    await sendMessageSafely(tab.id, { action: 'showLoading', uniqueId });
  } catch (error) {
    console.error('[Background] Failed to initialize UI:', error);
    tabIdMap.delete(uniqueId);
    return;
  }

  if (tab.url.includes('youtube.com/watch')) {
    console.log('[Background] Detected YouTube watch page');
    const match = tab.url.match(/[?&]v=([^&]+)/);
    const videoId = match?.[1];
    console.log('[Background] Parsed videoId:', videoId);
    if (!videoId) {
      chrome.tabs.sendMessage(tab.id, { action: 'hideLoading', uniqueId });
      chrome.tabs.sendMessage(tab.id, {
        action: 'appendToFloatingWindow',
        content: '[Error] Could not extract video ID from the URL.',
        uniqueId
      });
      return;
    }

    // Try to extract captions using content script injection
    console.log('[Background] Injecting YouTube caption extractor');
    // Inject the scraper script, then execute the function
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['scripts/content-scraper.js']
    }, () => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => extractYouTubeCaptions() // This function is from the injected script
      }, (results) => {
        console.log('[Background] YouTube caption extraction completed');
        if (chrome.runtime.lastError) {
          console.error('[Background] Script injection error:', chrome.runtime.lastError.message);
          handleApiError(uniqueId, `Failed to extract content: ${chrome.runtime.lastError.message}`);
          return;
        }

        if (results && results[0] && results[0].result) {
          const captionText = results[0].result;
          
          // Enhanced logging for debugging
          console.log('[Background] ===== CAPTION EXTRACTION DEBUG =====');
          console.log('[Background] Result type:', typeof captionText);
          console.log('[Background] Result length:', captionText?.length || 0);
          
          if (captionText && captionText.length > 0) {
            console.log('[Background] First 200 chars:', captionText.substring(0, 200));
            console.log('[Background] Last 200 chars:', captionText.substring(Math.max(0, captionText.length - 200)));
            
            // Log full content in chunks for better readability
            if (captionText.length > 500) {
              console.log('[Background] ===== FULL TRANSCRIPT CONTENT =====');
              const chunkSize = 2000;
              for (let i = 0; i < captionText.length; i += chunkSize) {
                const chunk = captionText.substring(i, i + chunkSize);
                console.log(`[Background] Chunk ${Math.floor(i/chunkSize) + 1}:`, chunk);
              }
              console.log('[Background] ===== END TRANSCRIPT CONTENT =====');
            } else {
              console.log('[Background] Full transcript:', captionText);
            }
          }
          console.log('[Background] ===== END DEBUG =====');
          
          if (captionText && captionText.includes('[YT Extractor] Caption track URL found')) {
            console.log('[Background] Content script indicated background fetch is needed. Calling getYouTubeSubtitles for videoId:', videoId);
            getYouTubeSubtitles(videoId, tab.id)
              .then(snippets => {
                if (snippets && snippets.length > 0) {
                  const fullText = snippets.map(s => s.text).join(' ');
                  
                  // Enhanced logging for background subtitle fetch
                  console.log('[Background] ===== BACKGROUND SUBTITLE FETCH DEBUG =====');
                  console.log('[Background] Total snippets:', snippets.length);
                  console.log('[Background] Full text length:', fullText.length);
                  console.log('[Background] First 200 chars:', fullText.substring(0, 200));
                  console.log('[Background] Last 200 chars:', fullText.substring(Math.max(0, fullText.length - 200)));
                  
                  // Log full content in chunks for better readability
                  if (fullText.length > 500) {
                    console.log('[Background] ===== FULL BACKGROUND SUBTITLE CONTENT =====');
                    const chunkSize = 2000;
                    for (let i = 0; i < fullText.length; i += chunkSize) {
                      const chunk = fullText.substring(i, i + chunkSize);
                      console.log(`[Background] BG Chunk ${Math.floor(i/chunkSize) + 1}:`, chunk);
                    }
                    console.log('[Background] ===== END BACKGROUND SUBTITLE CONTENT =====');
                  } else {
                    console.log('[Background] Full background subtitle text:', fullText);
                  }
                  
                  // Also log snippet details for debugging
                  console.log('[Background] Sample snippets (first 3):');
                  snippets.slice(0, 3).forEach((snippet, index) => {
                    console.log(`[Background] Snippet ${index + 1}:`, {
                      start: snippet.start,
                      dur: snippet.dur,
                      text: snippet.text
                    });
                  });
                  console.log('[Background] ===== END BACKGROUND SUBTITLE DEBUG =====');
                  
                  makeApiCall(fullText, uniqueId);
                } else {
                  console.error('[Background] getYouTubeSubtitles returned empty or invalid snippets.');
                  handleApiError(uniqueId, 'Failed to fetch YouTube subtitles from the background. The video may not have captions.');
                }
              })
              .catch(err => {
                console.error('[Background] getYouTubeSubtitles failed:', err);
                handleApiError(uniqueId, 'Error fetching YouTube subtitles. Please check the background console for details.');
              });
          } else if (captionText && captionText.trim().length > 0) {
            console.log('[Background] Successfully extracted content directly from content script, length:', captionText.length);
            makeApiCall(captionText, uniqueId);
          } else {
            handleApiError(uniqueId, 'The content script returned empty results. No captions found.');
          }
        } else {
          handleApiError(uniqueId, 'Could not extract any content from this YouTube video. The content script might have failed.');
        }
      });
    });
  } else {
    console.log('[Background] Non-YouTube page – injecting getPageContent');
    // Inject the scraper script, then execute the function
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['scripts/content-scraper.js']
    }, () => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => getPageContent() // This function is from the injected script
      }, (results) => {
        console.log('[Background] getPageContent results:', results);
        if (chrome.runtime.lastError) {
          console.error('[Background] Script injection error:', chrome.runtime.lastError.message);
          handleApiError(uniqueId, `Failed to get page content: ${chrome.runtime.lastError.message}`);
          return;
        }

        if (results && results[0] && results[0].result) {
          makeApiCall(results[0].result, uniqueId);
        } else {
          handleApiError(uniqueId, 'Could not get content from this page.');
        }
      });
    });
  }
}

/**
 * Helper function to safely send messages to content script
 */
async function sendMessageSafely(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        // Only reject if it's a real error, not just "no response"
        if (chrome.runtime.lastError.message.includes('port closed') || 
            chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.warn('[Background] Message warning:', chrome.runtime.lastError.message);
          resolve(null);
        }
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Format seconds to MM:SS format
 */
function formatTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Truncate text to maximum length while preserving word boundaries
 */
function truncateText(text, maxLength = CONFIG.MAX_TEXT_LENGTH) {
  if (!text || text.length <= maxLength) return text;
  
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  // If we can find a word boundary, use it
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

async function getYouTubeSubtitles(videoId, tabId) {
  console.log('[getYT] Fetching subtitles for videoId:', videoId);
  
  try {
    // First, try to get captions data from the active tab's content script
    console.log('[getYT] Attempting to get captions from content script context');
    const contentScriptResult = await getYouTubeCaptionsFromContentScript(tabId, videoId);
    
    if (contentScriptResult && contentScriptResult.length > 100) {
      console.log('[getYT] Successfully got captions from content script, length:', contentScriptResult.length);
      return parseTextToSnippets(contentScriptResult);
    }
    
    // Fallback: Try to fetch via YouTube's API-like endpoints
    console.log('[getYT] Content script failed, trying API endpoints');
    const apiResult = await getYouTubeCaptionsViaAPI(videoId);
    
    if (apiResult && apiResult.length > 0) {
      console.log('[getYT] Successfully got captions via API, length:', apiResult.length);
      return apiResult;
    }
    
    // Final fallback: Try direct fetch with different approaches
    console.log('[getYT] API failed, trying direct fetch approaches');
    return await getYouTubeCaptionsDirectFetch(videoId);
    
  } catch (error) {
    console.error('[getYT] Error in getYouTubeSubtitles:', error);
    throw error;
  }
}

// Get captions by executing script in the YouTube tab context
async function getYouTubeCaptionsFromContentScript(tabId, videoId) {
  try {
    console.log('[getYT] Injecting enhanced caption extractor');
    
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      function: async (videoId) => {
        // This function runs in the YouTube page context
        console.log('[YT Content] Enhanced caption extraction for:', videoId);
        
        // Try to get captions from the current player state
        const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
        if (!player) {
          console.log('[YT Content] No video player found');
          return null;
        }
        
        // Method 1: Try to extract from transcript panel
        const transcriptButton = document.querySelector('button[aria-label*="transcript" i], button[aria-label*="Show transcript" i]');
        if (transcriptButton && !transcriptButton.getAttribute('aria-pressed')) {
          console.log('[YT Content] Clicking transcript button');
          transcriptButton.click();
          
          // Wait for transcript to load
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const transcriptItems = document.querySelectorAll('ytd-transcript-segment-renderer .segment-text, [data-testid="transcript-segment"]');
          if (transcriptItems.length > 0) {
            const text = Array.from(transcriptItems).map(item => item.textContent?.trim()).filter(Boolean).join(' ');
            if (text.length > 100) {
              console.log('[YT Content] Successfully extracted from transcript panel, length:', text.length);
              return text;
            }
          }
        }
        
        // Method 2: Try to access YouTube's internal caption data
        if (window.ytInitialPlayerResponse) {
          const captions = window.ytInitialPlayerResponse.captions;
          if (captions?.playerCaptionsTracklistRenderer?.captionTracks) {
            const tracks = captions.playerCaptionsTracklistRenderer.captionTracks;
            console.log('[YT Content] Found caption tracks:', tracks.length);
            
            let track = tracks.find(t => t.languageCode === 'en' && t.kind === 'asr');
            if (!track) track = tracks.find(t => t.languageCode === 'en');
            if (!track && tracks.length > 0) track = tracks[0];
            
            if (track?.baseUrl) {
              console.log('[YT Content] Attempting to fetch caption XML directly');
              try {
                const response = await fetch(track.baseUrl);
                if (response.ok) {
                  const xml = await response.text();
                  
                  // Parse XML in content script context
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(xml, 'application/xml');
                  const textElements = doc.querySelectorAll('text');
                  
                  if (textElements.length > 0) {
                    const captions = Array.from(textElements).map(el => {
                      const text = el.textContent || '';
                      return text.replace(/<[^>]*>/g, '')
                                .replace(/&amp;/g, '&')
                                .replace(/&lt;/g, '<')
                                .replace(/&gt;/g, '>')
                                .replace(/&quot;/g, '"')
                                .replace(/&#39;/g, "'")
                                .trim();
                    }).filter(text => text.length > 0);
                    
                    const fullText = captions.join(' ');
                    if (fullText.length > 100) {
                      console.log('[YT Content] Successfully parsed captions XML, length:', fullText.length);
                      return fullText;
                    }
                  }
                }
              } catch (fetchError) {
                console.log('[YT Content] Failed to fetch captions directly:', fetchError);
              }
            }
          }
        }
        
        // Method 3: Monitor for live captions
        const captionContainer = document.querySelector('.ytp-caption-window-container');
        if (captionContainer) {
          console.log('[YT Content] Found caption container, monitoring for text');
          
          // Enable captions if not already enabled
          const captionButton = document.querySelector('.ytp-subtitles-button');
          if (captionButton && captionButton.getAttribute('aria-pressed') !== 'true') {
            captionButton.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Collect captions over time
          let collectedCaptions = '';
          const startTime = Date.now();
          
          while (Date.now() - startTime < 5000) { // Collect for 5 seconds
            const captionElements = captionContainer.querySelectorAll('.ytp-caption-segment, .caption-visual-line');
            const currentText = Array.from(captionElements).map(el => el.textContent?.trim()).filter(Boolean).join(' ');
            
            if (currentText && !collectedCaptions.includes(currentText)) {
              collectedCaptions += ' ' + currentText;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          if (collectedCaptions.trim().length > 50) {
            console.log('[YT Content] Collected live captions, length:', collectedCaptions.length);
            return collectedCaptions.trim();
          }
        }
        
        console.log('[YT Content] All methods failed');
        return null;
      },
      args: [videoId]
    });
    
    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
    
    return null;
    
  } catch (error) {
    console.error('[getYT] Error getting captions from content script:', error);
    return null;
  }
}

// Try YouTube's internal API endpoints
async function getYouTubeCaptionsViaAPI(videoId) {
  try {
    console.log('[getYT] Trying YouTube API approach for:', videoId);
    
    // Try the timedtext API directly
    const timedtextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&tlang=en&fmt=srv3`;
    
    const response = await fetch(timedtextUrl, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (response.ok) {
      const xmlText = await response.text();
      console.log('[getYT] Got response from timedtext API, length:', xmlText.length);
      
      if (xmlText && xmlText.trim().length > 0) {
        const snippets = parseTranscriptXML(xmlText, false);
        if (snippets && snippets.length > 0) {
          console.log('[getYT] Successfully parsed timedtext response:', snippets.length, 'snippets');
          return snippets;
        }
      }
    } else {
      console.log('[getYT] Timedtext API failed with status:', response.status);
    }
    
    return null;
    
  } catch (error) {
    console.error('[getYT] Error with API approach:', error);
    return null;
  }
}

// Direct fetch approach with improved parsing
async function getYouTubeCaptionsDirectFetch(videoId) {
  console.log('[getYT] Direct fetch approach for:', videoId);
  
  try {
    // Try different video info endpoints
    const endpoints = [
      `https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8`,
      `https://www.youtube.com/get_video_info?video_id=${videoId}`,
    ];
    
    for (const endpoint of endpoints) {
      try {
        let response;
        
        if (endpoint.includes('youtubei')) {
          // Use the internal YouTube API
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
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
        } else {
          response = await fetch(endpoint);
        }
        
        if (response.ok) {
          const data = await response.text();
          console.log('[getYT] Got response from', endpoint, 'length:', data.length);
          
          // Try to extract caption URLs from response
          const captionUrls = extractCaptionUrlsFromResponse(data);
          
          if (captionUrls.length > 0) {
            console.log('[getYT] Found caption URLs:', captionUrls.length);
            
            for (const url of captionUrls) {
              try {
                const captionResponse = await fetch(url);
                if (captionResponse.ok) {
                  const xmlText = await captionResponse.text();
                  const snippets = parseTranscriptXML(xmlText, false);
                  
                  if (snippets && snippets.length > 0) {
                    console.log('[getYT] Successfully got captions from URL, snippets:', snippets.length);
                    return snippets;
                  }
                }
              } catch (urlError) {
                console.log('[getYT] Failed to fetch from caption URL:', urlError);
                continue;
              }
            }
          }
        }
      } catch (endpointError) {
        console.log('[getYT] Endpoint failed:', endpoint, endpointError);
        continue;
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('[getYT] Error in direct fetch approach:', error);
    return null;
  }
}

// Extract caption URLs from various response formats
function extractCaptionUrlsFromResponse(responseText) {
  const urls = [];
  
  try {
    // Try different patterns to find caption URLs
    const patterns = [
      /https:\/\/[^"'\s]+api\/timedtext[^"'\s]*/g,
      /baseUrl['"]\s*:\s*['"]([^'"]*timedtext[^'"]*)['"]/g,
      /"captionTracks":\s*\[[^\]]*"baseUrl":\s*"([^"]*timedtext[^"]*)"/g
    ];
    
    for (const pattern of patterns) {
      const matches = responseText.matchAll(pattern);
      for (const match of matches) {
        const url = match[1] || match[0];
        if (url && url.includes('timedtext') && !urls.includes(url)) {
          urls.push(url.replace(/\\u0026/g, '&').replace(/\\/g, ''));
        }
      }
    }
    
    console.log('[getYT] Extracted caption URLs:', urls.length);
    return urls;
    
  } catch (error) {
    console.error('[getYT] Error extracting caption URLs:', error);
    return [];
  }
}

// Convert plain text to snippets format for consistency
function parseTextToSnippets(text) {
  if (!text || typeof text !== 'string') return [];
  
  // Split text into reasonable chunks (sentences)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  return sentences.map((sentence, index) => ({
    start: index * 3, // Rough estimate of 3 seconds per sentence
    dur: 3,
    text: sentence.trim()
  }));
}

async function makeApiCall(text, uniqueId) {
  console.log('[API] makeApiCall text length=', text.length);
  
  // Validate and truncate text if necessary
  if (!text || typeof text !== 'string') {
    console.error('[API] Invalid text input');
    await handleApiError(uniqueId, 'Invalid text content');
    return;
  }

  const processedText = truncateText(text.trim());
  if (processedText !== text) {
    console.warn('[API] Text was truncated from', text.length, 'to', processedText.length, 'characters');
    const tab = tabIdMap.get(uniqueId);
    if (tab) {
      await sendMessageSafely(tab, {
        action: 'appendToFloatingWindow',
        content: `[Warning] Text was truncated to ${CONFIG.MAX_TEXT_LENGTH} characters for processing.\n\n`,
        uniqueId
      });
    }
  }

  const { apiUrl, model, systemPrompt, apiKey, enableStreaming } = await chrome.storage.sync.get(
    ['apiUrl', 'model', 'systemPrompt', 'apiKey', 'enableStreaming']
  );
  
  console.log('[API] retrieved settings:', { apiUrl, model, systemPrompt, apiKey: !!apiKey, enableStreaming });
  
  // Validate configuration
  if (!apiUrl || !apiKey) {
    console.error('[API] API URL or API Key not set');
    await handleApiError(uniqueId, 'API URL or API Key not set. Please configure in extension options by right-clicking the extension icon.');
    return;
  }

  // Validate URL format
  try {
    new URL(apiUrl);
  } catch (e) {
    console.error('[API] Invalid API URL format:', apiUrl);
    await handleApiError(uniqueId, 'Invalid API URL format. Please check your configuration.');
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

  try {
    const requestBody = {
      model: model?.trim() || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt?.trim() || 'You are a helpful assistant that summarizes content concisely.' },
        { role: 'user', content: processedText }
      ],
      stream: enableStreaming || false
    };

    // Enhanced logging for API request debugging
    console.log('[API] ===== API REQUEST DEBUG =====');
    console.log('[API] Model:', requestBody.model);
    console.log('[API] System prompt length:', requestBody.messages[0].content.length);
    console.log('[API] User content length:', requestBody.messages[1].content.length);
    console.log('[API] Streaming enabled:', requestBody.stream);
    
    // Log the user content (transcript) in chunks for readability
    const userContent = requestBody.messages[1].content;
    if (userContent.length > 500) {
      console.log('[API] ===== FULL USER CONTENT (TRANSCRIPT) =====');
      const chunkSize = 2000;
      for (let i = 0; i < userContent.length; i += chunkSize) {
        const chunk = userContent.substring(i, i + chunkSize);
        console.log(`[API] Content Chunk ${Math.floor(i/chunkSize) + 1}:`, chunk);
      }
      console.log('[API] ===== END USER CONTENT =====');
    } else {
      console.log('[API] Full user content:', userContent);
    }
    
    // Log system prompt
    console.log('[API] System prompt:', requestBody.messages[0].content);
    console.log('[API] ===== END API REQUEST DEBUG =====');

    console.log('[API] Making request with streaming =', enableStreaming);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Error response:', errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('[API] response.status=', response.status);

    const tab = tabIdMap.get(uniqueId);
    if (!tab) {
      console.error('[API] No tab found for uniqueId:', uniqueId);
      return;
    }
    
    if (enableStreaming && response.body) {
      console.log('[API] Processing stream...');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      // Send the initial part of the summary message
      await sendMessageSafely(tab, {
        action: 'appendToFloatingWindow',
        content: ``,
        uniqueId
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[API] Stream finished');
          if (buffer.length > 0) {
            processBuffer(buffer, uniqueId);
          }
          await sendMessageSafely(tab, { action: 'hideLoading', uniqueId });
          tabIdMap.delete(uniqueId);
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        buffer = processBuffer(buffer, uniqueId);
      }
    } else {
      // Handle non-streaming response
      const responseData = await response.json();
      console.log('[API] Full response:', responseData);

      if (responseData.choices?.[0]?.message?.content) {
        const content = responseData.choices[0].message.content;
        console.log('[API] Sending complete response, length:', content.length);
        
        await sendMessageSafely(tab, {
          action: 'appendToFloatingWindow',
          content: content,
          uniqueId
        });
        
        await sendMessageSafely(tab, { action: 'hideLoading', uniqueId });
        tabIdMap.delete(uniqueId);
      } else {
        console.error('[API] No content in response:', responseData);
        throw new Error('No content received from API');
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[API] call error:', err);
    
    let errorMessage = 'API request failed';
    if (err.name === 'AbortError') {
      errorMessage = 'Request timed out. Please try again.';
    } else if (err.message.includes('HTTP')) {
      errorMessage = `API error: ${err.message}`;
    } else if (err.message.includes('fetch')) {
      errorMessage = 'Network error. Please check your connection.';
    }
    
    await handleApiError(uniqueId, errorMessage);
  }
}

/**
 * Handle API errors consistently
 */
async function handleApiError(uniqueId, message) {
  const tab = tabIdMap.get(uniqueId);
  if (tab) {
    try {
      await sendMessageSafely(tab, { action: 'hideLoading', uniqueId });
      await sendMessageSafely(tab, {
        action: 'appendToFloatingWindow',
        content: `[Error] ${message}`,
        uniqueId
      });
    } catch (e) {
      console.error('[API] Failed to send error message to tab:', e);
    }
  }
  tabIdMap.delete(uniqueId);
}

function processBuffer(buffer, uniqueId) {
    // Process multiple data chunks in a single buffer
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep the last, possibly incomplete, line

    for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
            const jsonLine = line.trim().substring(5).trim();
            if (jsonLine === '[DONE]') {
                console.log('[API] Stream DONE signal received.');
                const tab = tabIdMap.get(uniqueId);
                if (tab) {
                    chrome.tabs.sendMessage(tab, { action: 'hideLoading', uniqueId });
                    tabIdMap.delete(uniqueId);
                }
                continue;
            }
            handleJsonLine(jsonLine, uniqueId);
        }
    }
    return buffer;
}

function handleJsonLine(jsonLine, uniqueId) {
  try {
    if (!jsonLine) return;
    console.log('[API] Processing JSON line:', jsonLine.substring(0, 200));
    const data = JSON.parse(jsonLine);
    const tab = tabIdMap.get(uniqueId);
    
    if (!tab) {
      console.warn('[API] No tab found for uniqueId:', uniqueId);
      return;
    }
    
    // Handle streaming content
    if (data.choices?.[0]?.delta?.content) {
      console.log('[API] Sending content chunk:', data.choices[0].delta.content.substring(0, 50));
      chrome.tabs.sendMessage(tab, {
        action: 'appendToFloatingWindow',
        content: data.choices[0].delta.content,
        uniqueId
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[API] Error sending content to tab:', chrome.runtime.lastError.message);
        }
      });
    }
    
    // Handle completion
    if (data.choices?.[0]?.finish_reason === 'stop') {
      console.log('[API] Stream finished');
      chrome.tabs.sendMessage(tab, { action: 'hideLoading', uniqueId });
      tabIdMap.delete(uniqueId);
    }
    
    // Handle non-streaming responses (some APIs return complete content at once)
    if (data.choices?.[0]?.message?.content && !data.choices?.[0]?.delta) {
      console.log('[API] Sending complete content:', data.choices[0].message.content.substring(0, 50));
      chrome.tabs.sendMessage(tab, {
        action: 'appendToFloatingWindow',
        content: data.choices[0].message.content,
        uniqueId
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[API] Error sending complete content to tab:', chrome.runtime.lastError.message);
        }
      });
      chrome.tabs.sendMessage(tab, { action: 'hideLoading', uniqueId });
      tabIdMap.delete(uniqueId);
    }
    
  } catch (e) {
    console.warn('[API] Failed to parse JSON line:', e.message, 'Line:', jsonLine.substring(0, 100));
  }
}

/**
 * Parse YouTube transcript XML in background script
 */
function parseTranscriptXML(xml, preserveFormatting = false) {
  try {
    console.log(`[parseTranscript] parsing XML length=${xml.length}`);
    if (!xml || !xml.trim()) {
      console.error('[parseTranscript] empty XML');
      return null;
    }

    // Clean up common XML issues
    let cleanXml = xml.trim()
      .replace(/&(?!amp;|lt;|gt;|quot;|#39;|#x[0-9a-fA-F]+;|#[0-9]+;)/g, '&amp;') // Fix unescaped ampersands
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/^\uFEFF/, ''); // Remove BOM if present

    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanXml, 'application/xml');
    
    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.error('[parseTranscript] XML parsing error:', parserError.textContent);
      
      // Try alternative parsing approaches
      const alternativeResult = tryAlternativeParsing(xml);
      if (alternativeResult) {
        console.log('[parseTranscript] Alternative parsing succeeded');
        return alternativeResult;
      }
      
      return null;
    }
    
    // Try different element selectors
    let textEls = doc.getElementsByTagName('text');
    
    // Fallback for different XML structures
    if (textEls.length === 0) {
      textEls = doc.querySelectorAll('p, span[begin], div[begin]') || [];
      console.log(`[parseTranscript] Using alternative elements: ${textEls.length}`);
    }
    
    console.log(`[parseTranscript] found ${textEls.length} text nodes`);

    if (textEls.length === 0) {
      console.warn('[parseTranscript] no text elements found, trying regex fallback');
      return tryRegexParsing(xml);
    }

    let tagRegex;
    if (preserveFormatting) {
      const allowed = ['b','i','em','strong','sub','sup','small','mark','ins','del'];
      tagRegex = new RegExp(`<\\/?(?!(${allowed.join('|')})\\b)[^>]*>`, 'gi');
    } else {
      tagRegex = /<[^>]*>/g;
    }

    const snippets = [];
    for (let i = 0; i < textEls.length; i++) {
      const el = textEls[i];
      const raw = el.textContent || el.innerText || '';
      
      if (!raw.trim()) continue;
      
      const clean = raw
        .replace(tagRegex, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      
      if (clean && clean.length > 0) {
        // Extract timing attributes with multiple fallbacks
        const start = parseFloat(
          el.getAttribute('start') ||
          el.getAttribute('begin') ||
          el.getAttribute('t') ||
          '0'
        );
        
        const dur = parseFloat(
          el.getAttribute('dur') ||
          el.getAttribute('duration') ||
          el.getAttribute('d') ||
          '0'
        );

        snippets.push({
          start: start,
          dur: dur,
          text: clean
        });
      }
    }

    console.log(`[parseTranscript] parsed ${snippets.length} snippets`);
    
    // Sort by start time to ensure proper order
    snippets.sort((a, b) => a.start - b.start);
    
    return snippets.length > 0 ? snippets : null;
    
  } catch (error) {
    console.error('[parseTranscript] error:', error);
    
    // Final fallback: try regex parsing
    const regexResult = tryRegexParsing(xml);
    if (regexResult) {
      console.log('[parseTranscript] Regex fallback succeeded');
      return regexResult;
    }
    
    return null;
  }
}

// Alternative parsing for malformed XML
function tryAlternativeParsing(xml) {
  try {
    console.log('[parseTranscript] Trying alternative parsing approaches');
    
    // Try to fix common XML issues and re-parse
    let fixedXml = xml
      .replace(/&(?![a-zA-Z0-9#]+;)/g, '&amp;') // Fix unescaped ampersands
      .replace(/<text([^>]*?)>([^<]*?)(?=<text|$)/g, '<text$1>$2</text>') // Add missing closing tags
      .replace(/^\s*<\?xml[^>]*\?>\s*/, '') // Remove XML declaration if present
      .replace(/<!DOCTYPE[^>]*>/i, ''); // Remove DOCTYPE if present
    
    // Wrap in root element if not present
    if (!fixedXml.includes('<transcript') && !fixedXml.includes('<timedtext')) {
      fixedXml = `<transcript>${fixedXml}</transcript>`;
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(fixedXml, 'application/xml');
    
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.log('[parseTranscript] Alternative parsing still failed');
      return null;
    }
    
    const textEls = doc.getElementsByTagName('text');
    if (textEls.length === 0) return null;
    
    const snippets = [];
    for (let i = 0; i < textEls.length; i++) {
      const el = textEls[i];
      const text = (el.textContent || '').replace(/<[^>]*>/g, '').trim();
      
      if (text) {
        snippets.push({
          start: parseFloat(el.getAttribute('start') || '0'),
          dur: parseFloat(el.getAttribute('dur') || '0'),
          text: text
        });
      }
    }
    
    return snippets.length > 0 ? snippets : null;
    
  } catch (error) {
    console.log('[parseTranscript] Alternative parsing failed:', error);
    return null;
  }
}

// Regex-based parsing as final fallback
function tryRegexParsing(xml) {
  try {
    console.log('[parseTranscript] Trying regex-based parsing');
    
    // Pattern to match text elements with attributes
    const textPattern = /<text[^>]*start=["']([^"']*)["'][^>]*(?:dur=["']([^"']*)["'][^>]*)?[^>]*>([^<]*)/gi;
    const snippets = [];
    let match;
    
    while ((match = textPattern.exec(xml)) !== null) {
      const start = parseFloat(match[1] || '0');
      const dur = parseFloat(match[2] || '0');
      const text = match[3]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
      
      if (text) {
        snippets.push({ start, dur, text });
      }
    }
    
    // If no matches with start attribute, try simpler pattern
    if (snippets.length === 0) {
      const simplePattern = /<text[^>]*>([^<]+)/gi;
      let index = 0;
      
      while ((match = simplePattern.exec(xml)) !== null) {
        const text = match[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();
        
        if (text) {
          snippets.push({
            start: index * 2, // Approximate timing
            dur: 2,
            text: text
          });
          index++;
        }
      }
    }
    
    console.log(`[parseTranscript] Regex parsing found ${snippets.length} snippets`);
    return snippets.length > 0 ? snippets : null;
    
  } catch (error) {
    console.log('[parseTranscript] Regex parsing failed:', error);
    return null;
  }
}

