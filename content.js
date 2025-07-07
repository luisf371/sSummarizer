// content.js - Content Script for Floating Window UI
// Handles the creation and management of floating summarization windows
console.log('[Content] Content script loaded');

// State management for multiple floating windows
let floatingWindows = new Map();
let isMinimized = new Map();
let textSizes = new Map();
let windowPositions = new Map();
let windowSizes = new Map();
let contentBuffers = new Map();
let userScrolledUp = new Map();

 // Configuration constants
 const UI_CONFIG = {
  DEFAULT_FONT_SIZE: 14,
  MIN_FONT_SIZE: 8,
  MAX_FONT_SIZE: 24,
  DEFAULT_WIDTH: 350,
  DEFAULT_HEIGHT: 450,
  MIN_WIDTH: 250,
  MIN_HEIGHT: 200,
  POSITION_OFFSET: 20 // Offset for multiple windows
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  switch (request.action) {
    case 'createFloatingWindow':
      createFloatingWindow(request.uniqueId);
      sendResponse({ success: true });
      break;
    case 'appendToFloatingWindow':
      handleMessage(request.content, request.uniqueId);
      sendResponse({ success: true });
      break;
    case 'showLoading':
      showLoading(request.uniqueId);
      sendResponse({ success: true });
      break;
    case 'hideLoading':
      hideLoading(request.uniqueId);
      sendResponse({ success: true });
      break;
  }
});

// ———— Floating‐window and utility functions below ————

/**
 * Create a floating window with improved positioning and error handling
 */
async function createFloatingWindow(uniqueId) {
  try {
    if (floatingWindows.has(uniqueId)) {
      const existingWindow = floatingWindows.get(uniqueId);
      if (existingWindow && existingWindow.parentNode) {
        existingWindow.remove();
      }
      cleanupWindowState(uniqueId);
    }

    const { defaultFontSize } = await chrome.storage.sync.get('defaultFontSize');
    const initialFontSize = defaultFontSize || UI_CONFIG.DEFAULT_FONT_SIZE;

    const savedState = await chrome.storage.local.get(['windowState']);
    const state = savedState.windowState || {};
    const position = { top: state.top || 20, left: state.left || null };
    const size = { width: state.width || UI_CONFIG.DEFAULT_WIDTH, height: state.height || UI_CONFIG.DEFAULT_HEIGHT };

    // If right is not saved, calculate it based on width
    if (position.left === null) {
        position.right = 20;
    }

    const floatingWindow = document.createElement('div');
    const positionStyle = position.left !== null ? `top: ${position.top}px; left: ${position.left}px;` : `top: ${position.top}px; right: ${position.right}px;`;

    floatingWindow.innerHTML = `
      <div id="floating-window-${uniqueId}" style="position: fixed; ${positionStyle} z-index: 9999; background-color: #1e1e1e; color: #cfcfcf; border: 1px solid #333; border-radius: 8px; width: ${size.width}px; height: ${size.height}px; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; backdrop-filter: blur(10px);">
        <div id="title-bar-${uniqueId}" style="padding: 12px 16px; background: linear-gradient(135deg, #2e2e2e, #3a3a3a); cursor: move; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; border-radius: 8px 8px 0 0; user-select: none;">
          <span style="font-weight: 600; color: #f0f0f0; font-size: 14px;">AI Summarizer</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 4px; margin-right: 8px;">
              <button id="decrease-font-${uniqueId}" style="background: none; border: none; color: #f0f0f0; cursor: pointer; padding: 4px 6px; border-radius: 4px; font-size: 12px; transition: background-color 0.2s;" title="Decrease font size">A⁻</button>
              <button id="increase-font-${uniqueId}" style="background: none; border: none; color: #f0f0f0; cursor: pointer; padding: 4px 6px; border-radius: 4px; font-size: 14px; transition: background-color 0.2s;" title="Increase font size">A⁺</button>
            </div>
            <button id="minimize-btn-${uniqueId}" style="background: none; border: none; color: #f0f0f0; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background-color 0.2s;" title="Minimize">−</button>
            <button id="close-btn-${uniqueId}" style="background: none; border: none; color: #f0f0f0; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background-color 0.2s;" title="Close">×</button>
          </div>
        </div>
        <div id="content-${uniqueId}" style="flex-grow: 1; overflow-y: auto; padding: 16px; font-size: ${initialFontSize}px; background-color: #1e1e1e; color: #cfcfcf; position: relative; line-height: 1.5; word-wrap: break-word;">
          <div id="loading-overlay-${uniqueId}" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); display: flex; justify-content: center; align-items: center; border-radius: 0 0 8px 8px;">
            <div class="spinner" style="border: 3px solid rgba(255,255,255,0.1); border-left-color: #4a9eff; border-radius: 50%; width: 32px; height: 32px; animation: spin 1s linear infinite;"></div>
          </div>
        </div>
        <div id="resize-handle-${uniqueId}" style="width: 12px; height: 12px; background: linear-gradient(135deg, #555, #777); position: absolute; right: 0; bottom: 0; cursor: se-resize; border-radius: 0 0 8px 0;"></div>
      </div>
      <style>
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        #floating-window-${uniqueId} button:hover { background-color: rgba(255, 255, 255, 0.1) !important; }
        #floating-window-${uniqueId} #content-${uniqueId}::-webkit-scrollbar { width: 8px; }
        #floating-window-${uniqueId} #content-${uniqueId}::-webkit-scrollbar-track { background: #2a2a2a; border-radius: 4px; }
        #floating-window-${uniqueId} #content-${uniqueId}::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
        #floating-window-${uniqueId} #content-${uniqueId}::-webkit-scrollbar-thumb:hover { background: #666; }
        
        /* Markdown styling for dark theme */
        #floating-window-${uniqueId} h1 { color: #4a9eff; font-size: 1.5em; margin: 16px 0 8px 0; font-weight: 600; }
        #floating-window-${uniqueId} h2 { color: #4a9eff; font-size: 1.3em; margin: 14px 0 6px 0; font-weight: 600; }
        #floating-window-${uniqueId} h3 { color: #4a9eff; font-size: 1.1em; margin: 12px 0 4px 0; font-weight: 600; }
        #floating-window-${uniqueId} strong { color: #f0f0f0; font-weight: 600; }
        #floating-window-${uniqueId} em { color: #e0e0e0; font-style: italic; }
        #floating-window-${uniqueId} code { 
          background: #2a2a2a; 
          color: #4a9eff; 
          padding: 2px 6px; 
          border-radius: 4px; 
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace; 
          font-size: 0.9em; 
        }
        #floating-window-${uniqueId} pre { 
          background: #2a2a2a; 
          border: 1px solid #444; 
          border-radius: 6px; 
          padding: 12px; 
          margin: 8px 0; 
          overflow-x: auto; 
        }
        #floating-window-${uniqueId} pre code { 
          background: none; 
          padding: 0; 
          color: #cfcfcf; 
        }
        #floating-window-${uniqueId} blockquote { 
          border-left: 4px solid #4a9eff; 
          margin: 8px 0; 
          padding: 8px 16px; 
          background: rgba(74, 158, 255, 0.1); 
          border-radius: 0 4px 4px 0; 
        }
        #floating-window-${uniqueId} ul, #floating-window-${uniqueId} ol { 
          margin: 8px 0; 
          padding-left: 20px; 
        }
        #floating-window-${uniqueId} li { 
          margin: 4px 0; 
          color: #cfcfcf; 
        }
        #floating-window-${uniqueId} p { 
          margin: 8px 0; 
          line-height: 1.6; 
        }
      </style>
    `;
    
    document.body.appendChild(floatingWindow);
    
    // Initialize state
    floatingWindows.set(uniqueId, floatingWindow);
    isMinimized.set(uniqueId, false);
    textSizes.set(uniqueId, initialFontSize);
    windowPositions.set(uniqueId, position);
    userScrolledUp.set(uniqueId, false);

    const win = floatingWindow.querySelector(`#floating-window-${uniqueId}`);
    const contentEl = win.querySelector(`#content-${uniqueId}`);

    // Add scroll event listener to track user scrolling
    if (contentEl) {
      contentEl.addEventListener('scroll', () => {
        // A threshold of 1px is used to account for potential floating point inaccuracies.
        const isScrolledToBottom = contentEl.scrollHeight - contentEl.clientHeight <= contentEl.scrollTop + 1;
        userScrolledUp.set(uniqueId, !isScrolledToBottom);
      });
    }
    
    // Add event listeners with error handling
    setupWindowEventListeners(uniqueId, win);
    
    // Make window interactive
    makeDraggable(win, win.querySelector(`#title-bar-${uniqueId}`));
    makeResizable(win, win.querySelector(`#resize-handle-${uniqueId}`));
    
    console.log(`[Content] Created floating window ${uniqueId} at position`, position);
    
  } catch (error) {
    console.error('[Content] Error creating floating window:', error);
    // Clean up on error
    cleanupWindowState(uniqueId);
  }
}

/**
 * Calculate optimal position for new window to avoid overlaps
 */
function calculateWindowPosition() {
  const existingWindows = Array.from(floatingWindows.values());
  const basePosition = { top: 20, right: 20 };
  
  if (existingWindows.length === 0) {
    return basePosition;
  }
  
  // Offset new windows to avoid complete overlap
  const offset = existingWindows.length * UI_CONFIG.POSITION_OFFSET;
  return {
    top: basePosition.top + offset,
    right: basePosition.right + offset
  };
}

/**
 * Setup event listeners for window controls
 */
function setupWindowEventListeners(uniqueId, win) {
  try {
    const closeBtn = win.querySelector(`#close-btn-${uniqueId}`);
    const minimizeBtn = win.querySelector(`#minimize-btn-${uniqueId}`);
    const increaseFontBtn = win.querySelector(`#increase-font-${uniqueId}`);
    const decreaseFontBtn = win.querySelector(`#decrease-font-${uniqueId}`);
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeWindow(uniqueId));
    }
    
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => toggleMinimize(uniqueId));
    }
    
    if (increaseFontBtn) {
      increaseFontBtn.addEventListener('click', () => changeFontSize(uniqueId, 1));
    }
    
    if (decreaseFontBtn) {
      decreaseFontBtn.addEventListener('click', () => changeFontSize(uniqueId, -1));
    }
    
  } catch (error) {
    console.error('[Content] Error setting up event listeners:', error);
  }
}

/**
 * Close window and clean up resources
 */
function closeWindow(uniqueId) {
  try {
    // Send stop request to background script to abort any ongoing API request
    chrome.runtime.sendMessage({
      action: 'stopApiRequest',
      uniqueId: uniqueId
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Content] Error sending stop request:', chrome.runtime.lastError.message);
      } else {
        console.log(`[Content] Stop request sent for ${uniqueId}`);
      }
    });
    
    const win = floatingWindows.get(uniqueId);
    if (win && win.parentNode) {
      win.remove();
    }
    cleanupWindowState(uniqueId);
    console.log(`[Content] Closed window ${uniqueId}`);
  } catch (error) {
    console.error('[Content] Error closing window:', error);
  }
}

/**
 * Clean up window state from all maps
 */
function cleanupWindowState(uniqueId) {
  floatingWindows.delete(uniqueId);
  isMinimized.delete(uniqueId);
  textSizes.delete(uniqueId);
  windowPositions.delete(uniqueId);
  windowSizes.delete(uniqueId);
  contentBuffers.delete(uniqueId);
  userScrolledUp.delete(uniqueId);
}

/**
 * Change font size with validation and bounds checking
 */
function changeFontSize(uniqueId, delta) {
  try {
    const win = floatingWindows.get(uniqueId);
    if (!win) {
      console.log(`[Content] Window ${uniqueId} already closed, skipping font size change`);
      return;
    }
    
    const content = win.querySelector(`#content-${uniqueId}`);
    if (!content) {
      console.log(`[Content] Content element not found for window ${uniqueId} (window closed)`);
      return;
    }
    
    const currentSize = textSizes.get(uniqueId) || UI_CONFIG.DEFAULT_FONT_SIZE;
    let newSize = currentSize + delta;
    
    // Enforce bounds
    newSize = Math.max(UI_CONFIG.MIN_FONT_SIZE, Math.min(UI_CONFIG.MAX_FONT_SIZE, newSize));
    
    if (newSize !== currentSize) {
      textSizes.set(uniqueId, newSize);
      content.style.fontSize = `${newSize}px`;
      chrome.storage.sync.set({ defaultFontSize: newSize });
      console.log(`[Content] Font size changed and saved: ${newSize}px`);
    }
  } catch (error) {
    console.error('[Content] Error changing font size:', error);
  }
}

/**
 * Toggle window minimize state with improved state management
 */
function toggleMinimize(uniqueId) {
  try {
    const wrapper = floatingWindows.get(uniqueId);
    if (!wrapper) {
      console.log(`[Content] Window ${uniqueId} already closed, skipping minimize toggle`);
      return;
    }
    const win = wrapper.querySelector(`#floating-window-${uniqueId}`);
    const content = win.querySelector(`#content-${uniqueId}`);
    const handle = win.querySelector(`#resize-handle-${uniqueId}`);
    const minimizeBtn = win.querySelector(`#minimize-btn-${uniqueId}`);
    
    if (!content || !handle || !win) {
      console.log(`[Content] Required elements not found for window ${uniqueId} (window closed)`);
      return;
    }
    
    const isCurrentlyMinimized = isMinimized.get(uniqueId) || false;

    if (isCurrentlyMinimized) {
      // Restore window
      const lastSize = windowSizes.get(uniqueId);
      content.style.display = ''; // Restore to default display
      handle.style.display = 'block';
      if(lastSize) {
        win.style.height = `${lastSize.height}px`;
      }
      if (minimizeBtn) minimizeBtn.textContent = '−';
      if (minimizeBtn) minimizeBtn.title = 'Minimize';
      isMinimized.set(uniqueId, false);
      console.log(`[Content] Restored window ${uniqueId}`);
    } else {
      // Minimize window
      windowSizes.set(uniqueId, { width: win.offsetWidth, height: win.offsetHeight });
      content.style.display = 'none';
      handle.style.display = 'none';
      win.style.height = 'auto'; // Let the title bar define the height
      if (minimizeBtn) minimizeBtn.textContent = '□';
      if (minimizeBtn) minimizeBtn.title = 'Restore';
      isMinimized.set(uniqueId, true);
      console.log(`[Content] Minimized window ${uniqueId}`);
    }
  } catch (error) {
    console.error('[Content] Error toggling minimize:', error);
  }
}

/**
 * Handle incoming messages with improved content sanitization
 */
function handleMessage(content, uniqueId) {
  try {
    const win = floatingWindows.get(uniqueId);
    if (!win) {
      // This is expected when window is already closed - no need to warn
      console.log(`[Content] Window ${uniqueId} already closed, skipping message`);
      return;
    }
    
    const contentElement = win.querySelector(`#content-${uniqueId}`);
    if (!contentElement) {
      console.log(`[Content] Content element not found for window ${uniqueId} (window closed)`);
      return;
    }

    let currentBuffer = contentBuffers.get(uniqueId) || '';
    currentBuffer += content;
    contentBuffers.set(uniqueId, currentBuffer);
    
    // Sanitize and render the entire buffer
    contentElement.innerHTML = sanitizeContent(currentBuffer);
    
    // Auto-scroll to bottom
    // Auto-scroll to bottom only if user hasn't scrolled up
    if (!userScrolledUp.get(uniqueId)) {
      contentElement.scrollTop = contentElement.scrollHeight;
    }
    
    // Apply current font size
    const currentFontSize = textSizes.get(uniqueId) || UI_CONFIG.DEFAULT_FONT_SIZE;
    contentElement.style.fontSize = `${currentFontSize}px`;
    
    // Auto-restore if minimized
    if (isMinimized.get(uniqueId)) {
      console.log(`[Content] Auto-restoring minimized window ${uniqueId}`);
      toggleMinimize(uniqueId);
    }
    
  } catch (error) {
    console.error('[Content] Error handling message:', error);
  }
}

/**
 * Convert markdown to HTML and sanitize content
 */
function sanitizeContent(content) {
  if (typeof content !== 'string') {
    return String(content || '');
  }
  
  // Convert markdown to HTML
  let html = convertMarkdownToHtml(content);
  
  // Allow basic formatting tags but escape potentially dangerous content
  const allowedTags = ['b', 'i', 'em', 'strong', 'br', 'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'hr'];
  const tagRegex = /<(\/?)([\w]+)([^>]*)>/gi;
  
  return html.replace(tagRegex, (match, slash, tagName, attributes) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      // Remove any attributes for security, except for basic styling
      return `<${slash}${tagName}>`;
    }
    // Escape disallowed tags
    return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });
}

function getIndent(line) {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
}

function convertMarkdownToHtml(markdown) {
    const processInline = (text) => {
        return text.trim()
            .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
    };

    const lines = markdown.trim().split('\n');
    let html = '';
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Headers
        if (line.match(/^#{1,6}\s/)) {
            const level = line.match(/^#+/)[0].length;
            html += `<h${level}>${processInline(line.replace(/^#+\s*/, ''))}</h${level}>\n`;
            i++;
            continue;
        }

        // Horizontal Rule
        if (line.match(/^-{3,}$/)) {
            html += '<hr>\n';
            i++;
            continue;
        }

        // Code blocks
        if (line.startsWith('```')) {
            let codeBlockContent = '';
            i++;
            while (i < lines.length && !lines[i].startsWith('```')) {
                codeBlockContent += lines[i] + '\n';
                i++;
            }
            html += `<pre><code>${escapeHtml(codeBlockContent.trim())}</code></pre>\n`;
            i++; // Skip closing ```
            continue;
        }
        
        // Lists
        if (line.match(/^(\s*)([-*]|\d+\.)\s/)) {
            let listHtml = '';
            const listStack = [];
            
            while (i < lines.length && lines[i].match(/^(\s*)([-*]|\d+\.)\s|^\s+.*$/)) {
                 const itemMatch = lines[i].match(/^(\s*)([-*]|\d+\.)\s(.*)/);
                if (itemMatch) {
                    const indent = itemMatch[1].length;
                    const type = itemMatch[2].match(/\d/) ? 'ol' : 'ul';
                    let content = itemMatch[3];

                    // Look ahead for multi-line list items
                    let nextIndex = i + 1;
                    while (nextIndex < lines.length && lines[nextIndex].match(/^\s{2,}/) && !lines[nextIndex].match(/^(\s*)([-*]|\d+\.)\s/)) {
                        content += ' ' + lines[nextIndex].trim();
                        nextIndex++;
                    }

                    while (listStack.length > 0 && indent < listStack[listStack.length - 1].indent) {
                        listHtml += `</${listStack.pop().type}>\n`;
                    }
                    if (listStack.length === 0 || indent > listStack[listStack.length - 1].indent || type !== listStack[listStack.length - 1].type) {
                       if(listStack.length > 0 && listStack[listStack.length-1].type !== type) {
                           listHtml += `</${listStack.pop().type}>\n`;
                       }
                       listHtml += `<${type}>\n`;
                       listStack.push({ type, indent });
                    }
                    listHtml += `<li>${processInline(content)}</li>\n`;
                    i = nextIndex;
                } else {
                    // This case handles empty lines between list items, which we'll ignore for now
                    i++;
                }
            }
            while (listStack.length > 0) {
                 listHtml += `</${listStack.pop().type}>\n`;
            }
            html += listHtml;
            continue;
        }
        
        // Paragraphs
        if (line.trim()) {
            let paragraphContent = line;
            while (i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].match(/^-{3,}$/) && !lines[i+1].match(/^#{1,6}\s/) && !lines[i+1].match(/^(\s*)([-*]|\d+\.)\s/)) {
                paragraphContent += '<br>' + lines[i + 1];
                i++;
            }
            html += `<p>${processInline(paragraphContent)}</p>\n`;
        }
        i++;
    }

    return html.trim();
}

/**
 * Escape HTML characters
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show loading indicator with error handling
 */
function showLoading(uniqueId) {
  try {
    const win = floatingWindows.get(uniqueId);
    if (!win) {
      console.log(`[Content] Window ${uniqueId} already closed, skipping loading display`);
      return;
    }
    
    const loadingOverlay = win.querySelector(`#loading-overlay-${uniqueId}`);
    if (loadingOverlay) {
      loadingOverlay.style.display = 'flex';
    }
  } catch (error) {
    console.error('[Content] Error showing loading:', error);
  }
}

/**
 * Hide loading indicator with error handling
 */
function hideLoading(uniqueId) {
  try {
    const win = floatingWindows.get(uniqueId);
    if (!win) {
      // This is expected when window is already closed - no need to warn
      console.log(`[Content] Window ${uniqueId} already closed, skipping loading hide`);
      return;
    }
    
    const loadingOverlay = win.querySelector(`#loading-overlay-${uniqueId}`);
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }
  } catch (error) {
    console.error('[Content] Error hiding loading:', error);
  }
}

function makeDraggable(el, handle) {
    let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    handle.onmousedown = e => {
        e.preventDefault();
        x1 = e.clientX; y1 = e.clientY;
        document.onmousemove = drag;
        document.onmouseup = () => {
            document.onmousemove = null;
            document.onmouseup = null;
            chrome.storage.local.set({ windowState: { top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight } });
        };
    };
    function drag(e) {
        e.preventDefault();
        x0 = x1 - e.clientX; y0 = y1 - e.clientY;
        x1 = e.clientX; y1 = e.clientY;
        el.style.top = (el.offsetTop - y0) + 'px';
        el.style.left = (el.offsetLeft - x0) + 'px';
    }
}

function makeResizable(el, handle) {
    handle.onmousedown = () => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', () => {
            window.removeEventListener('mousemove', resize);
            chrome.storage.local.set({ windowState: { top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight } });
        }, { once: true });
    };
    function resize(e) {
        const newWidth = Math.max(UI_CONFIG.MIN_WIDTH, e.clientX - el.offsetLeft);
        const newHeight = Math.max(UI_CONFIG.MIN_HEIGHT, e.clientY - el.offsetTop);
        el.style.width = newWidth + 'px';
        el.style.height = newHeight + 'px';
    }
}
