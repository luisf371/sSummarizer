// background.js - Chrome Extension Service Worker
// Handles URL content extraction and API communication for summarization
console.log('[Background] Service worker loaded');

// Maps unique request IDs to tab IDs for tracking multiple concurrent requests
let tabIdMap = new Map();
// Maps unique request IDs to AbortControllers for stopping API requests
let abortControllers = new Map();
// Set of cancelled request IDs to prevent late execution
let cancelledRequests = new Set();

// Configuration constants
const CONFIG = {
  MAX_TEXT_LENGTH: 50000, // Maximum text length to send to API
  REQUEST_TIMEOUT: 30000, // 30 seconds timeout for API requests
  RETRY_ATTEMPTS: 3,
  YOUTUBE_TRANSCRIPT_TIMEOUT: 10000
};

// Add message listener for stopping API requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request);
  if (request.action === 'stopApiRequest') {
    stopApiRequest(request.uniqueId);
    sendResponse({ success: true });
  }
});

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

    // Use the new content script that mimics the Python implementation
    console.log('[Background] Injecting YouTube transcript extractor (Python-style)');
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['scripts/content-scraper.js']
    }, () => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => extractYouTubeCaptions() // This function uses the Python approach
      }, (results) => {
        console.log('[Background] YouTube transcript extraction completed');
        if (chrome.runtime.lastError) {
          console.error('[Background] Script injection error:', chrome.runtime.lastError.message);
          handleApiError(uniqueId, `Failed to extract content: ${chrome.runtime.lastError.message}`);
          return;
        }

        if (results && results[0] && results[0].result) {
          const transcriptText = results[0].result;
          
          // Enhanced logging for debugging
          console.log('[Background] ===== TRANSCRIPT EXTRACTION DEBUG =====');
          console.log('[Background] Result type:', typeof transcriptText);
          console.log('[Background] Result length:', transcriptText?.length || 0);
          
          if (transcriptText && transcriptText.length > 0) {
            console.log('[Background] First 200 chars:', transcriptText.substring(0, 200));
            console.log('[Background] Last 200 chars:', transcriptText.substring(Math.max(0, transcriptText.length - 200)));
            
            // Log full content without chunking
            console.log('[Background] ===== FULL TRANSCRIPT CONTENT =====');
            console.log('[Background] Full transcript:', transcriptText);
            console.log('[Background] ===== END TRANSCRIPT CONTENT =====');
          }
          console.log('[Background] ===== END TRANSCRIPT DEBUG =====');
          
          if (transcriptText && transcriptText.trim().length > 0) {
            console.log('[Background] Successfully extracted transcript, length:', transcriptText.length);
            makeApiCall(transcriptText, uniqueId);
          } else {
            handleApiError(uniqueId, 'The transcript extractor returned empty results. No captions found.');
          }
        } else {
          handleApiError(uniqueId, 'Could not extract any content from this YouTube video. The transcript extractor might have failed.');
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

// Note: YouTube transcript fetching is now handled entirely by the content script
// using the same approach as the Python youtube-transcript-api implementation

async function makeApiCall(text, uniqueId) {
  console.log('[API] makeApiCall text length=', text.length);
  
  // Check if the request was explicitly cancelled
  if (cancelledRequests.has(uniqueId)) {
    console.log(`[API] Request ${uniqueId} was cancelled, skipping API call`);
    return;
  }
  
  // Check if the window/request was already closed/cancelled
  const tabId = tabIdMap.get(uniqueId);
  if (!tabId) {
    console.log(`[API] Request ${uniqueId} was already closed/cancelled, skipping API call`);
    return;
  }
  
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
  
  // Store the abort controller for potential cancellation
  abortControllers.set(uniqueId, { controller, timeoutId, reader: null });

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
    
    // Log the user content (transcript) without chunking
    const userContent = requestBody.messages[1].content;
    console.log('[API] ===== FULL USER CONTENT (TRANSCRIPT) =====');
    console.log('[API] Full user content:', userContent);
    console.log('[API] ===== END USER CONTENT =====');
    
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
      abortControllers.delete(uniqueId);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('[API] response.status=', response.status);

    const tab = tabIdMap.get(uniqueId);
    if (!tab) {
      console.error('[API] No tab found for uniqueId:', uniqueId);
      abortControllers.delete(uniqueId);
      return;
    }
    
    if (enableStreaming && response.body) {
      console.log('[API] Processing stream...');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      // Store the reader so we can cancel it if needed
      const abortInfo = abortControllers.get(uniqueId);
      if (abortInfo) {
        abortInfo.reader = reader;
      }

      // Send the initial part of the summary message
      await sendMessageSafely(tab, {
        action: 'appendToFloatingWindow',
        content: ``,
        uniqueId
      });

      try {
        while (true) {
          // Check if request was aborted before reading next chunk
          const currentAbortInfo = abortControllers.get(uniqueId);
          if (!currentAbortInfo) {
            console.log('[API] Request was aborted, stopping stream processing');
            try {
              reader.cancel();
            } catch (e) {
              console.log('[API] Reader already cancelled or closed');
            }
            break;
          }

          const { done, value } = await reader.read();
          if (done) {
            console.log('[API] Stream finished');
            if (buffer.length > 0) {
              processBuffer(buffer, uniqueId);
            }
            await sendMessageSafely(tab, { action: 'hideLoading', uniqueId });
            abortControllers.delete(uniqueId);
            cancelledRequests.delete(uniqueId);
            tabIdMap.delete(uniqueId);
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          buffer = processBuffer(buffer, uniqueId);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('[API] Stream reading aborted by user');
        } else {
          console.error('[API] Stream reading error:', error);
        }
        abortControllers.delete(uniqueId);
        cancelledRequests.delete(uniqueId);
        tabIdMap.delete(uniqueId);
      }
    } else {
      // Handle non-streaming response - can clean up immediately
      abortControllers.delete(uniqueId);
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
        cancelledRequests.delete(uniqueId);
        tabIdMap.delete(uniqueId);
      } else {
        console.error('[API] No content in response:', responseData);
        throw new Error('No content received from API');
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    abortControllers.delete(uniqueId);
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
 * Stop an ongoing API request
 */
function stopApiRequest(uniqueId) {
  console.log(`[API] Stopping API request for uniqueId: ${uniqueId}`);
  
  // Mark request as cancelled to prevent future execution
  cancelledRequests.add(uniqueId);
  
  const abortInfo = abortControllers.get(uniqueId);
  if (abortInfo) {
    const { controller, timeoutId, reader } = abortInfo;
    
    // Abort the fetch request
    controller.abort();
    clearTimeout(timeoutId);
    
    // Cancel the stream reader if it exists
    if (reader) {
      try {
        reader.cancel();
        console.log(`[API] Stream reader cancelled for ${uniqueId}`);
      } catch (e) {
        console.log(`[API] Reader already cancelled or closed for ${uniqueId}`);
      }
    }
    
    abortControllers.delete(uniqueId);
    console.log(`[API] Successfully aborted request ${uniqueId}`);
    
    // Send notification to UI that request was stopped
    const tab = tabIdMap.get(uniqueId);
    if (tab) {
      sendMessageSafely(tab, { action: 'hideLoading', uniqueId });
      sendMessageSafely(tab, {
        action: 'appendToFloatingWindow',
        content: '[Info] Request stopped by user.',
        uniqueId
      });
    }
    
    tabIdMap.delete(uniqueId);
  } else {
    console.log(`[API] Request ${uniqueId} marked as cancelled (may not have started yet)`);
    
    // Still try to clean up tab mapping
    tabIdMap.delete(uniqueId);
  }
}

/**
 * Handle API errors consistently
 */
async function handleApiError(uniqueId, message) {
  // Clean up abort controller if it exists
  const abortInfo = abortControllers.get(uniqueId);
  if (abortInfo) {
    clearTimeout(abortInfo.timeoutId);
    abortControllers.delete(uniqueId);
  }
  
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
  cancelledRequests.delete(uniqueId);
  tabIdMap.delete(uniqueId);
}

function processBuffer(buffer, uniqueId) {
    // Check if request was aborted before processing buffer
    const abortInfo = abortControllers.get(uniqueId);
    if (!abortInfo) {
        console.log('[API] Request was aborted, skipping buffer processing for:', uniqueId);
        return '';
    }

    // Process multiple data chunks in a single buffer
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep the last, possibly incomplete, line

    for (const line of lines) {
        // Check again in case abort happened during processing
        if (!abortControllers.get(uniqueId)) {
            console.log('[API] Request was aborted during buffer processing for:', uniqueId);
            return '';
        }

        if (line.trim().startsWith('data: ')) {
            const jsonLine = line.trim().substring(5).trim();
            if (jsonLine === '[DONE]') {
                console.log('[API] Stream DONE signal received.');
                const tab = tabIdMap.get(uniqueId);
                if (tab) {
                    chrome.tabs.sendMessage(tab, { action: 'hideLoading', uniqueId });
                    abortControllers.delete(uniqueId);
                    cancelledRequests.delete(uniqueId);
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
    
    // Check if request was aborted before processing
    const abortInfo = abortControllers.get(uniqueId);
    if (!abortInfo) {
      console.log('[API] Request was aborted, skipping JSON line processing for:', uniqueId);
      return;
    }
    
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
      abortControllers.delete(uniqueId);
      cancelledRequests.delete(uniqueId);
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
      abortControllers.delete(uniqueId);
      cancelledRequests.delete(uniqueId);
      tabIdMap.delete(uniqueId);
    }
    
  } catch (e) {
    console.warn('[API] Failed to parse JSON line:', e.message, 'Line:', jsonLine.substring(0, 100));
  }
}
