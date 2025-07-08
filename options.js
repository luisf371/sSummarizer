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
  const defaultPromptBtn = document.getElementById('default-prompt-btn');

  const statusDiv = document.createElement('div');
  statusDiv.id = 'status-message';
  const apiSection = apiUrlInput.closest('.form-section');
  if (apiSection) {
    apiSection.appendChild(statusDiv);
  } else {
    optionsForm.appendChild(statusDiv);
  }

  loadSavedOptions();
  setupFormListeners();

  optionsForm.addEventListener('submit', handleFormSubmit);
  
  const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant that summarizes content clearly and concisely. Focus on the main points and key takeaways.';

  function getByteLength(str) {
    return new TextEncoder().encode(str).length;
  }

  function getFormValues() {
    return {
      apiKey: apiKeyInput.value.trim(),
      apiUrl: apiUrlInput.value.trim(),
      model: modelInput.value.trim(),
      systemPrompt: systemPromptInput.value.trim(),
      enableStreaming: enableStreamingInput.checked,
      defaultFontSize: parseInt(defaultFontSizeInput.value, 10) || 14
    };
  }

  function loadSavedOptions() {
    try {
      chrome.storage.sync.get(['apiKey', 'apiUrl', 'model', 'systemPrompt', 'enableStreaming', 'defaultFontSize'], function(result) {
        if (chrome.runtime.lastError) {
          showStatus('Error loading saved settings: ' + chrome.runtime.lastError.message, 'error');
          return;
        }

        apiKeyInput.value = result.apiKey || '';
        apiUrlInput.value = result.apiUrl || '';
        modelInput.value = result.model || '';
        systemPromptInput.value = result.systemPrompt || '';
        enableStreamingInput.checked = result.enableStreaming ?? true;
        defaultFontSizeInput.value = result.defaultFontSize || 14;
        
        systemPromptInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('[Options] Loaded saved settings', result);
      });
    } catch (error) {
      console.error('[Options] Error loading settings:', error);
      showStatus('Failed to load saved settings', 'error');
    }
  }

  function setupFormListeners() {
    setupPasswordToggle();
    setupByteCounter();
    setupTestConnection();
    setupDefaultPromptButton();
    setupImmediateValidationReset();
  }
 
  function validateApiUrl(url) {
    const urlInput = apiUrlInput;
    if (!url) { setFieldError(urlInput, 'API URL is required'); return false; }
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

  function validateApiKey(key) {
    const keyInput = apiKeyInput;
    if (!key) { setFieldError(keyInput, 'API Key is required'); return false; }
    if (key.length < 10) { setFieldError(keyInput, 'API Key seems too short'); return false; }
    setFieldSuccess(keyInput);
    return true;
  }

  function validateModel(model) {
    const modelInput = document.getElementById('model');
    if (!model) { setFieldError(modelInput, 'Model Name is required'); return false; }
    if (model.length > 100) { setFieldError(modelInput, 'Model name is too long'); return false; }
    setFieldSuccess(modelInput);
    return true;
  }

  function validateSystemPrompt(prompt) {
    const promptInput = systemPromptInput;
    const maxBytes = 8000;
    const currentBytes = getByteLength(prompt);
    if (currentBytes > maxBytes) {
      setFieldError(promptInput, `System prompt is too large (max ${maxBytes} bytes)`);
      return false;
    }
    setFieldSuccess(promptInput);
    return true;
  }

  function setFieldError(field, message) {
    field.style.borderColor = 'var(--error-color)';
    field.style.backgroundColor = 'rgba(247, 118, 142, 0.1)';
    field.title = message;
  }

  function setFieldSuccess(field) {
    field.style.borderColor = 'var(--success-color)';
    field.style.backgroundColor = 'rgba(158, 206, 106, 0.1)';
    field.title = '';
  }

  function resetFieldState(field) {
    field.style.borderColor = '';
    field.style.backgroundColor = '';
    field.title = '';
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    
    const currentValues = getFormValues();

    const isApiUrlValid = validateApiUrl(currentValues.apiUrl);
    const isApiKeyValid = validateApiKey(currentValues.apiKey);
    const isModelValid = validateModel(currentValues.model);
    const isSystemPromptValid = validateSystemPrompt(currentValues.systemPrompt);

    if (!isApiUrlValid || !isApiKeyValid || !isModelValid || !isSystemPromptValid) {
      showStatus('Please fix the validation errors above', 'error');
      return;
    }

    const buttonText = saveButton.querySelector('.button-text');
    saveButton.disabled = true;
    if (buttonText) buttonText.textContent = 'Saving...';
    showStatus('Saving settings...', 'info');

    chrome.storage.sync.set({
      ...currentValues,
      systemPrompt: currentValues.systemPrompt || DEFAULT_SYSTEM_PROMPT
    }, function() {
      saveButton.disabled = false;
      if (buttonText) buttonText.textContent = 'Save Settings';
      
      if (chrome.runtime.lastError) {
        showStatus('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
      } else {
        showStatus('Settings saved successfully!', 'success');
        [apiKeyInput, apiUrlInput, modelInput, systemPromptInput].forEach(resetFieldState);
      }
    });
  }

  function showStatus(message, type) {
    statusDiv.dataset.type = type;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';

    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    }
  }

  function setupPasswordToggle() {
    const toggleButton = document.getElementById('toggle-password');
    if (!toggleButton) return;
    toggleButton.addEventListener('click', function() {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      toggleButton.textContent = isPassword ? 'Hide' : 'Show';
      toggleButton.title = isPassword ? 'Hide API Key' : 'Show API Key';
    });
  }

  function setupByteCounter() {
    const counter = document.getElementById('prompt-counter');
    if (!counter) return;
    const maxBytes = 8000;
    systemPromptInput.addEventListener('input', function() {
      const currentBytes = getByteLength(this.value);
      counter.textContent = currentBytes;
      if (currentBytes > maxBytes) { counter.style.color = 'var(--error-color)'; } 
      else if (currentBytes > maxBytes * 0.9) { counter.style.color = '#f39c12'; } 
      else { counter.style.color = 'var(--accent-color-secondary)'; }
    });
  }
  
  function setupDefaultPromptButton() {
    if (!defaultPromptBtn) return;
    defaultPromptBtn.addEventListener('click', function() {
      systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
      systemPromptInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  function setupImmediateValidationReset() {
    const fieldsToValidate = [apiKeyInput, apiUrlInput, modelInput, systemPromptInput];
    
    fieldsToValidate.forEach(field => {
      // When the user starts typing, immediately remove any old error/success styles.
      field.addEventListener('input', () => {
        resetFieldState(field);
      });
    });
  }

  function setupTestConnection() {
    const testButton = document.getElementById('test-connection');
    if (!testButton) return;
    testButton.addEventListener('click', async function() {
      if (!window.confirm('This will send a real API request to the endpoint, which may incur costs. Do you want to proceed?')) {
        return;
      }
      
      const { apiUrl, apiKey, model } = getFormValues();

      if (!apiUrl || !apiKey || !model) {
        showStatus('API URL, API Key, and Model Name are required before testing', 'error');
        return;
      }
      if (!validateApiUrl(apiUrl) || !validateApiKey(apiKey) || !validateModel(model)) {
        showStatus('Please fix validation errors before testing', 'error');
        return;
      }

      testButton.disabled = true;
      testButton.textContent = 'Testing...';
      showStatus('Testing API connection...', 'info');

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(apiUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model, max_tokens: 20, stream: false, messages: [
            { role: 'user', content: 'Reply with 1' }]
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          showStatus('API connection successful! Your settings are working correctly.', 'success');
        } else {
          const errorText = await response.text();
          let errorMessage = `API Error (${response.status}): `;
          try {
            errorMessage += JSON.parse(errorText).error?.message || 'Unknown error';
          } catch (e) {
            errorMessage += response.statusText || 'Unknown error';
          }
          showStatus(errorMessage, 'error');
        }
      } catch (error) {
        let errorMessage = 'Connection failed: ';
        if (error.name === 'AbortError') errorMessage += 'Request timed out.';
        else errorMessage += error.message;
        showStatus(errorMessage, 'error');
      } finally {
        testButton.disabled = false;
        testButton.textContent = 'Test Connection';
      }
    });
  }
});
