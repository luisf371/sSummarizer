// content.js - Content Script for Floating Window UI
// Handles the creation and management of floating summarization windows
console.log('[Content] Content script loaded');

// State management for multiple floating windows
let floatingWindows = new Map();
let isMinimized = new Map();
let textSizes = new Map();
let windowPositions = new Map();

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
function createFloatingWindow(uniqueId) {
  try {
    // Clean up existing window if it exists
    if (floatingWindows.has(uniqueId)) {
      const existingWindow = floatingWindows.get(uniqueId);
      if (existingWindow && existingWindow.parentNode) {
        existingWindow.remove();
      }
      cleanupWindowState(uniqueId);
    }

    // Calculate position for new window (avoid overlapping)
    const position = calculateWindowPosition();
    
    const floatingWindow = document.createElement('div');
    floatingWindow.innerHTML = `
      <div id="floating-window-${uniqueId}" style="position: fixed; top: ${position.top}px; right: ${position.right}px; z-index: 9999; background-color: #1e1e1e; color: #cfcfcf; border: 1px solid #333; border-radius: 8px; width: ${UI_CONFIG.DEFAULT_WIDTH}px; height: ${UI_CONFIG.DEFAULT_HEIGHT}px; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; backdrop-filter: blur(10px);">
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
        <div id="content-${uniqueId}" style="flex-grow: 1; overflow-y: auto; padding: 16px; font-size: ${UI_CONFIG.DEFAULT_FONT_SIZE}px; background-color: #1e1e1e; color: #cfcfcf; position: relative; line-height: 1.5; word-wrap: break-word;">
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
    textSizes.set(uniqueId, UI_CONFIG.DEFAULT_FONT_SIZE);
    windowPositions.set(uniqueId, position);

    const win = floatingWindow.querySelector(`#floating-window-${uniqueId}`);
    
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
      increaseFontBtn.addEventListener('click', () => changeFontSize(uniqueId, 2));
    }
    
    if (decreaseFontBtn) {
      decreaseFontBtn.addEventListener('click', () => changeFontSize(uniqueId, -2));
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
}

/**
 * Change font size with validation and bounds checking
 */
function changeFontSize(uniqueId, delta) {
  try {
    const win = floatingWindows.get(uniqueId);
    if (!win) {
      console.warn(`[Content] Window ${uniqueId} not found for font size change`);
      return;
    }
    
    const content = win.querySelector(`#content-${uniqueId}`);
    if (!content) {
      console.warn(`[Content] Content element not found for window ${uniqueId}`);
      return;
    }
    
    const currentSize = textSizes.get(uniqueId) || UI_CONFIG.DEFAULT_FONT_SIZE;
    let newSize = currentSize + delta;
    
    // Enforce bounds
    newSize = Math.max(UI_CONFIG.MIN_FONT_SIZE, Math.min(UI_CONFIG.MAX_FONT_SIZE, newSize));
    
    if (newSize !== currentSize) {
      textSizes.set(uniqueId, newSize);
      content.style.fontSize = `${newSize}px`;
      console.log(`[Content] Font size changed to ${newSize}px for window ${uniqueId}`);
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
    const win = floatingWindows.get(uniqueId);
    if (!win) {
      console.warn(`[Content] Window ${uniqueId} not found for minimize toggle`);
      return;
    }
    
    const content = win.querySelector(`#content-${uniqueId}`);
    const handle = win.querySelector(`#resize-handle-${uniqueId}`);
    const minimizeBtn = win.querySelector(`#minimize-btn-${uniqueId}`);
    
    if (!content || !handle) {
      console.warn(`[Content] Required elements not found for window ${uniqueId}`);
      return;
    }
    
    const isCurrentlyMinimized = isMinimized.get(uniqueId) || false;
    
    if (isCurrentlyMinimized) {
      // Restore window
      content.style.display = 'block';
      handle.style.display = 'block';
      win.style.height = `${UI_CONFIG.DEFAULT_HEIGHT}px`;
      if (minimizeBtn) minimizeBtn.textContent = '−';
      if (minimizeBtn) minimizeBtn.title = 'Minimize';
      isMinimized.set(uniqueId, false);
      console.log(`[Content] Restored window ${uniqueId}`);
    } else {
      // Minimize window
      content.style.display = 'none';
      handle.style.display = 'none';
      win.style.height = 'auto';
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
    console.log(`[Content] handleMessage called with content length: ${content?.length}, uniqueId: ${uniqueId}`);
    
    const win = floatingWindows.get(uniqueId);
    if (!win) {
      console.warn(`[Content] Window ${uniqueId} not found for message handling`);
      return;
    }
    
    const contentElement = win.querySelector(`#content-${uniqueId}`);
    if (!contentElement) {
      console.warn(`[Content] Content element not found for window ${uniqueId}`);
      return;
    }
    
    // Sanitize content to prevent XSS while preserving basic formatting
    const sanitizedContent = sanitizeContent(content);
    console.log(`[Content] Sanitized content: ${sanitizedContent.substring(0, 100)}...`);
    
    // Append content
    contentElement.innerHTML += sanitizedContent;
    console.log(`[Content] Content appended to window ${uniqueId}`);
    
    // Auto-scroll to bottom
    contentElement.scrollTop = contentElement.scrollHeight;
    
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
  const allowedTags = ['b', 'i', 'em', 'strong', 'br', 'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote'];
  const tagRegex = /<(\/?)([\w]+)([^>]*)>/gi;
  
  return html.replace(tagRegex, (match, slash, tagName, attributes) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      // Remove any attributes for security, except for basic styling
      return `<${slash}${tagName}>`;
    }
    // Escape disallowed tags
    return match.replace(/</g, '<').replace(/>/g, '>');
  });
}

/**
 * Convert basic markdown to HTML
 */
function convertMarkdownToHtml(markdown) {
  let html = markdown;
  
  // Headers (must be done first)
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Code blocks (must be done before inline code)
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.slice(3, -3).trim();
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  });
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Lists
  html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // Wrap consecutive list items in ul/ol tags
  html = html.replace(/(<li>.*<\/li>)/gs, (match) => {
    // Check if it's a numbered list by looking at the original markdown
    const isNumbered = markdown.includes('1. ') || markdown.includes('2. ');
    const tag = isNumbered ? 'ol' : 'ul';
    return `<${tag}>${match}</${tag}>`;
  });
  
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  
  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  
  // Wrap in paragraphs if not already wrapped
  if (!html.includes('<p>') && !html.includes('<h') && !html.includes('<ul>') && !html.includes('<ol>')) {
    html = `<p>${html}</p>`;
  }
  
  return html;
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
      console.warn(`[Content] Window ${uniqueId} not found for loading display`);
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
      console.warn(`[Content] Window ${uniqueId} not found for loading hide`);
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
  let x0=0,y0=0,x1=0,y1=0;
  handle.onmousedown = e => {
    e.preventDefault();
    x1 = e.clientX; y1 = e.clientY;
    document.onmousemove = drag;
    document.onmouseup   = () => { document.onmousemove = null; document.onmouseup = null; };
  };
  function drag(e) {
    e.preventDefault();
    x0 = x1 - e.clientX; y0 = y1 - e.clientY;
    x1 = e.clientX;     y1 = e.clientY;
    el.style.top  = (el.offsetTop  - y0) + 'px';
    el.style.left = (el.offsetLeft - x0) + 'px';
  }
}

function makeResizable(el, handle) {
  handle.onmousedown = () => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', () => window.removeEventListener('mousemove', resize), { once: true });
  };
  function resize(e) {
    el.style.width  = (e.clientX - el.offsetLeft) + 'px';
    el.style.height = (e.clientY - el.offsetTop)  + 'px';
  }
}
