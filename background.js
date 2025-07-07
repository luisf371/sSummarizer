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
        console.log('[Background] YouTube caption extraction results:', results);
        if (chrome.runtime.lastError) {
          console.error('[Background] Script injection error:', chrome.runtime.lastError.message);
          handleApiError(uniqueId, `Failed to extract content: ${chrome.runtime.lastError.message}`);
          return;
        }

        if (results && results[0] && results[0].result) {
          const captionText = results[0].result;
          if (captionText && captionText.trim().length > 0) {
            console.log('[Background] Successfully extracted captions, length:', captionText.length);
            makeApiCall(captionText, uniqueId);
          } else {
            handleApiError(uniqueId, 'No captions found on this YouTube video. Try a video with auto-generated captions.');
          }
        } else {
          handleApiError(uniqueId, 'Could not extract captions from this YouTube video.');
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
  console.log('[getYT] Fetching watch page for', videoId);
  
  try {
    const watchResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    console.log('[getYT] watch page status:', watchResp.status);
    if (!watchResp.ok) throw new Error(`Watch-page HTTP ${watchResp.status}`);
    const html = await watchResp.text();
    console.log('[getYT] HTML length:', html.length);

    console.log('[getYT] Extracting player response');
    const match = html.match(/var ytInitialPlayerResponse = ({.*?});/s);
    if (!match?.[1]) {
      console.error('[getYT] No ytInitialPlayerResponse found in HTML');
      // Try alternative pattern
      const altMatch = html.match(/"ytInitialPlayerResponse":({.*?}),"ytInitialData"/s);
      if (!altMatch?.[1]) {
        throw new Error('Could not find ytInitialPlayerResponse in any format');
      }
      console.log('[getYT] Found alternative ytInitialPlayerResponse pattern');
    }
    
    const playerResp = JSON.parse(match?.[1] || altMatch[1]);
    console.log('[getYT] Player response keys:', Object.keys(playerResp));

    // Check if captions exist
    if (!playerResp.captions) {
      console.warn('[getYT] No captions object in player response');
      return null;
    }

    const tracks = playerResp.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    console.log(`[getYT] Found ${tracks.length} captionTracks`);
    
    if (tracks.length > 0) {
      console.log('[getYT] Available tracks:', tracks.map(t => ({ 
        lang: t.languageCode, 
        kind: t.kind, 
        name: t.name?.simpleText 
      })));
    }

    // Try to find English auto-generated captions
    let autoEn = tracks.find(t => t.languageCode === 'en' && t.kind === 'asr');
    
    // If no auto-generated English, try any English captions
    if (!autoEn) {
      autoEn = tracks.find(t => t.languageCode === 'en');
    }
    
    // If still no English, try the first available track
    if (!autoEn && tracks.length > 0) {
      autoEn = tracks[0];
      console.log('[getYT] Using first available track:', autoEn.languageCode);
    }
    
    if (!autoEn) {
      console.warn('[getYT] No suitable caption track found');
      return null;
    }

    console.log('[getYT] Using caption track:', {
      lang: autoEn.languageCode,
      kind: autoEn.kind,
      baseUrl: autoEn.baseUrl?.substring(0, 100) + '...'
    });

    console.log('[getYT] Fetching captions XML from', autoEn.baseUrl);
    const xmlResp = await fetch(autoEn.baseUrl, { 
      credentials: 'include',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    console.log('[getYT] captions XML status:', xmlResp.status);
    if (!xmlResp.ok) {
      throw new Error(`Captions HTTP ${xmlResp.status}: ${xmlResp.statusText}`);
    }
    
    const xmlText = await xmlResp.text();
    console.log('[getYT] captions XML length:', xmlText.length);
    console.log('[getYT] captions XML head:', xmlText.slice(0, 300).replace(/\n/g, ' '));

    if (!xmlText || xmlText.trim().length === 0) {
      throw new Error('Empty XML response from captions endpoint');
    }

    // Parse XML directly in background script
    console.log('[getYT] Parsing XML directly');
    const snippets = parseTranscriptXML(xmlText, false);
    console.log('[getYT] parseTranscript result:', snippets?.length);
    
    if (!Array.isArray(snippets) || snippets.length === 0) {
      console.error('[getYT] Failed to parse XML or no content found');
      console.log('[getYT] Raw XML sample:', xmlText.slice(0, 500));
      throw new Error('Empty or unparsable captions XML');
    }
    
    return snippets;
    
  } catch (error) {
    console.error('[getYT] Error in getYouTubeSubtitles:', error);
    throw error;
  }
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

    console.log('[API] Full request payload:', JSON.stringify(requestBody, null, 2));

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

    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    
    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.error('[parseTranscript] XML parsing error:', parserError.textContent);
      return null;
    }
    
    const textEls = doc.getElementsByTagName('text');
    console.log(`[parseTranscript] found ${textEls.length} <text> nodes`);

    if (textEls.length === 0) {
      console.warn('[parseTranscript] no <text> elements found');
      return null;
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
      const raw = el.textContent || '';
      const clean = raw
        .replace(tagRegex, '')
        .replace(/&/g,'&')
        .replace(/</g,'<')
        .replace(/>/g,'>')
        .replace(/"/g,'"')
        .replace(/&#39;/g,"'")
        .replace(/\s+/g, ' ')
        .trim();
      
      if (clean) {
        snippets.push({
          start: parseFloat(el.getAttribute('start') || '0'),
          dur: parseFloat(el.getAttribute('dur') || '0'),
          text: clean
        });
      }
    }

    console.log(`[parseTranscript] parsed ${snippets.length} snippets`);
    return snippets;
  } catch (error) {
    console.error('[parseTranscript] error:', error);
    return null;
  }
}

