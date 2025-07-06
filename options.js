// options.js - Enhanced Options Page with Validation and User Feedback
document.addEventListener('DOMContentLoaded', function() {
  const optionsForm = document.getElementById('options-form');
  const apiKeyInput = document.getElementById('api-key');
  const apiUrlInput = document.getElementById('api-url');
  const modelInput = document.getElementById('model');
  const systemPromptInput = document.getElementById('system-prompt');
  const enableStreamingInput = document.getElementById('enable-streaming');
  const defaultFontSizeInput = document.getElementById('default-font-size');
  const saveButton = document.querySelector('button[type="submit"]');
  
  // Create status message element
  const statusDiv = document.createElement('div');
  statusDiv.id = 'status-message';
  statusDiv.style.cssText = `
    margin-top: 15px;
    padding: 10px;
    border-radius: 4px;
    display: none;
    font-weight: 500;
  `;
  optionsForm.appendChild(statusDiv);

  // Load saved options with error handling
  loadSavedOptions();

  // Add real-time validation
  setupValidation();

  // Save options with validation
  optionsForm.addEventListener('submit', handleFormSubmit);

  // Setup additional UI features
  setupPasswordToggle();
  setupByteCounter();
  setupTestConnection();
 
  /**
   * Calculates the UTF-8 byte length of a string.
   * @param {string} str The string to measure.
   * @returns {number} The number of bytes.
   */
  function getByteLength(str) {
    return new TextEncoder().encode(str).length;
  }

  /**
   * Load saved options from storage
   */
  function loadSavedOptions() {
    try {
      chrome.storage.sync.get(['apiKey', 'apiUrl', 'model', 'systemPrompt', 'enableStreaming', 'defaultFontSize'], function(result) {
        if (chrome.runtime.lastError) {
          showStatus('Error loading saved settings: ' + chrome.runtime.lastError.message, 'error');
          return;
        }

        // Populate form fields with saved values
        if (result.apiKey) apiKeyInput.value = result.apiKey;
        if (result.apiUrl) apiUrlInput.value = result.apiUrl;
        if (result.model) modelInput.value = result.model;
        if (result.systemPrompt) {
          systemPromptInput.value = result.systemPrompt;
          // Manually trigger the input event to update the counter upon loading
          systemPromptInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (result.enableStreaming) enableStreamingInput.checked = result.enableStreaming;
        if (result.defaultFontSize) defaultFontSizeInput.value = result.defaultFontSize;


        console.log('[Options] Loaded saved settings');
      });
    } catch (error) {
      console.error('[Options] Error loading settings:', error);
      showStatus('Failed to load saved settings', 'error');
    }
  }

  /**
   * Setup real-time validation for form fields
   */
  function setupValidation() {
    // API URL validation
    apiUrlInput.addEventListener('blur', function() {
      validateApiUrl(this.value.trim());
    });

    // API Key validation
    apiKeyInput.addEventListener('input', function() {
      validateApiKey(this.value.trim());
    });

    // Model validation
    modelInput.addEventListener('blur', function() {
      validateModel(this.value.trim());
    });

    // System prompt validation
    systemPromptInput.addEventListener('input', function() {
      validateSystemPrompt(this.value);
    });
  }
 
  /**
   * Validate API URL format
   */
  function validateApiUrl(url) {
    const urlInput = apiUrlInput;
    
    if (!url) {
      setFieldError(urlInput, 'API URL is required');
      return false;
    }

    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        setFieldError(urlInput, 'URL must use HTTP or HTTPS protocol');
        return false;
      }
      setFieldSuccess(urlInput);
      return true;
    } catch (e) {
      setFieldError(urlInput, 'Please enter a valid URL');
      return false;
    }
  }

  /**
   * Validate API Key
   */
  function validateApiKey(key) {
    const keyInput = apiKeyInput;
    
    if (!key) {
      setFieldError(keyInput, 'API Key is required');
      return false;
    }

    if (key.length < 10) {
      setFieldError(keyInput, 'API Key seems too short');
      return false;
    }

    setFieldSuccess(keyInput);
    return true;
  }

  /**
   * Validate Model name
   */
  function validateModel(model) {
    const modelInput = document.getElementById('model');
    
    if (model && model.length > 100) {
      setFieldError(modelInput, 'Model name is too long');
      return false;
    }

    setFieldSuccess(modelInput);
    return true;
  }

  /**
   * Validate System Prompt
   */
  function validateSystemPrompt(prompt) {
    const promptInput = systemPromptInput;
    const maxBytes = 8000; // Leave a small buffer
    const currentBytes = getByteLength(prompt);

    if (currentBytes > maxBytes) {
      setFieldError(promptInput, `System prompt is too large (max ${maxBytes} bytes)`);
      return false;
    }

    setFieldSuccess(promptInput);
    return true;
  }

  /**
   * Set field error state
   */
  function setFieldError(field, message) {
    field.style.borderColor = '#e74c3c';
    field.style.backgroundColor = '#fdf2f2';
    field.title = message;
  }

  /**
   * Set field success state
   */
  function setFieldSuccess(field) {
    field.style.borderColor = '#27ae60';
    field.style.backgroundColor = '#f8fff8';
    field.title = '';
  }

  /**
   * Reset field state
   */
  function resetFieldState(field) {
    field.style.borderColor = '';
    field.style.backgroundColor = '';
    field.title = '';
  }

  /**
   * Handle form submission with validation
   */
  function handleFormSubmit(event) {
    event.preventDefault();
    
    const apiKey = apiKeyInput.value.trim();
    const apiUrl = apiUrlInput.value.trim();
    const model = modelInput.value.trim();
    const systemPrompt = systemPromptInput.value.trim();
    const enableStreaming = enableStreamingInput.checked;
    const defaultFontSize = parseInt(defaultFontSizeInput.value, 10);

    // Validate all fields
    const isApiUrlValid = validateApiUrl(apiUrl);
    const isApiKeyValid = validateApiKey(apiKey);
    const isModelValid = validateModel(model);
    const isSystemPromptValid = validateSystemPrompt(systemPrompt);

    if (!isApiUrlValid || !isApiKeyValid || !isModelValid || !isSystemPromptValid || (defaultFontSize && (defaultFontSize < 8 || defaultFontSize > 24))) {
      showStatus('Please fix the validation errors above', 'error');
      return;
    }

    // Show saving state
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    showStatus('Saving settings...', 'info');

    // Save to storage
    chrome.storage.sync.set({ 
      apiKey, 
      apiUrl,
      model: model || 'gpt-3.5-turbo',
      systemPrompt: systemPrompt || 'You are a helpful assistant that summarizes content clearly and concisely.',
      enableStreaming,
      defaultFontSize: defaultFontSize || 14
    }, function() {
      // Reset button state
      saveButton.disabled = false;
      saveButton.textContent = 'Save';

      if (chrome.runtime.lastError) {
        console.error('[Options] Save error:', chrome.runtime.lastError);
        showStatus('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
      } else {
        console.log('[Options] Settings saved successfully');
        showStatus('Settings saved successfully!', 'success');
        
        // Reset field states after successful save
        [apiKeyInput, apiUrlInput, modelInput, systemPromptInput].forEach(resetFieldState);
      }
    });
  }

  /**
   * Show status message to user
   */
  function showStatus(message, type) {
    const colors = {
      success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724' },
      error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24' },
      info: { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460' }
    };

    const color = colors[type] || colors.info;
    
    statusDiv.style.backgroundColor = color.bg;
    statusDiv.style.borderColor = color.border;
    statusDiv.style.color = color.text;
    statusDiv.style.border = `1px solid ${color.border}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';

    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    }
  }

  /**
   * Setup password toggle functionality
   */
  function setupPasswordToggle() {
    const toggleButton = document.getElementById('toggle-password');
    if (!toggleButton) return;

    toggleButton.addEventListener('click', function() {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      toggleButton.textContent = isPassword ? '🙈' : '👁️';
      toggleButton.title = isPassword ? 'Hide API Key' : 'Show API Key';
    });
  }

  /**
   * Setup byte counter for system prompt
   */
  function setupByteCounter() {
    const counter = document.getElementById('prompt-counter');
    if (!counter) return;

    const maxBytes = 8000;

    function updateCounter() {
      const currentBytes = getByteLength(systemPromptInput.value);
      counter.textContent = currentBytes;
      
      // Change color based on byte usage
      if (currentBytes > maxBytes) {
        counter.style.color = '#e74c3c'; // Error
      } else if (currentBytes > maxBytes * 0.9) {
        counter.style.color = '#f39c12'; // Warning
      } else {
        counter.style.color = '#3498db';
      }
    }

    systemPromptInput.addEventListener('input', updateCounter);
    // Initialize counter
    updateCounter();
  }

  /**
   * Setup test connection functionality
   */
  function setupTestConnection() {
    const testButton = document.getElementById('test-connection');
    if (!testButton) return;

    testButton.addEventListener('click', async function() {
      const apiUrl = apiUrlInput.value.trim();
      const apiKey = apiKeyInput.value.trim();
      const model = modelInput.value.trim() || 'gpt-3.5-turbo';

      if (!apiUrl || !apiKey) {
        showStatus('Please enter API URL and API Key before testing', 'error');
        return;
      }

      // Validate URL format
      if (!validateApiUrl(apiUrl) || !validateApiKey(apiKey)) {
        showStatus('Please fix validation errors before testing', 'error');
        return;
      }

      // Show testing state
      testButton.disabled = true;
      testButton.textContent = 'Testing...';
      showStatus('Testing API connection...', 'info');

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: 'You are a helpful assistant.' },
              { role: 'user', content: 'Say "Connection test successful" if you can read this.' }
            ],
            max_tokens: 20,
            stream: false
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.choices && data.choices.length > 0) {
            showStatus('✅ API connection successful! Your settings are working correctly.', 'success');
          } else {
            showStatus('⚠️ API responded but with unexpected format. Please check your model name.', 'error');
          }
        } else {
          const errorText = await response.text();
          let errorMessage = `❌ API Error (${response.status}): `;
          
          try {
            const errorData = JSON.parse(errorText);
            errorMessage += errorData.error?.message || errorData.message || 'Unknown error';
          } catch (e) {
            errorMessage += response.statusText || 'Unknown error';
          }
          
          showStatus(errorMessage, 'error');
        }
      } catch (error) {
        let errorMessage = '❌ Connection failed: ';
        
        if (error.name === 'AbortError') {
          errorMessage += 'Request timed out. Please check your API URL.';
        } else if (error.message.includes('fetch')) {
          errorMessage += 'Network error. Please check your internet connection and API URL.';
        } else {
          errorMessage += error.message;
        }
        
        showStatus(errorMessage, 'error');
      } finally {
        // Reset button state
        testButton.disabled = false;
        testButton.textContent = 'Test Connection';
      }
    });
  }
});
