// options.js - Enhanced Options Page with Validation and User Feedback

// =====================
// i18n Support
// =====================
function initI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      if (el.children.length === 0 || el.tagName === 'OPTION') {
        el.textContent = message;
      }
    }
  });
  
  const titleMsg = chrome.i18n.getMessage('extName');
  if (titleMsg) {
    document.title = titleMsg + ' - ' + chrome.i18n.getMessage('optionsTitle');
  }
}

// =====================
// Theme Support
// =====================
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  
  chrome.storage.local.get(['theme'], (result) => {
    const theme = result.theme || 'dark';
    applyTheme(theme);
  });
  
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.body.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      chrome.storage.local.set({ theme: newTheme });
    });
  }
  
  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
  }
}

// =====================
// Toast Notification
// =====================
let toastTimeout = null;
let toastVisible = false;

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  const toastIcon = toast.querySelector('.toast-icon');
  const toastMessage = toast.querySelector('.toast-message');
  
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  
  if (toastVisible) {
    toast.classList.remove('show');
    setTimeout(() => displayToast(), 100);
  } else {
    displayToast();
  }
  
  function displayToast() {
    toastMessage.textContent = message;
    toastIcon.textContent = type === 'success' ? '\u2713' : '\u2717';
    toast.className = 'toast ' + type;
    
    requestAnimationFrame(() => {
      toast.classList.add('show');
      toastVisible = true;
    });
    
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
      toastVisible = false;
    }, 1500);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  initI18n();
  initTheme();
  
  const optionsForm = document.getElementById('options-form');
  const apiKeyInput = document.getElementById('api-key');
  const apiUrlInput = document.getElementById('api-url');
  const apiProviderSelect = document.getElementById('api-provider');
  const modelInput = document.getElementById('model');
  const systemPromptInput = document.getElementById('system-prompt');
  const enableStreamingInput = document.getElementById('enable-streaming');
  const includeTimestampsInput = document.getElementById('include-timestamps');
  const defaultFontSizeInput = document.getElementById('default-font-size');
  const subtitlePriorityInput = document.getElementById('subtitle-priority');
  const preferredLanguageInput = document.getElementById('preferred-language');
  const redditMaxCommentsInput = document.getElementById('reddit-max-comments');
  const redditDepthInput = document.getElementById('reddit-depth');
  const redditSortInput = document.getElementById('reddit-sort');
  const enableContextMenuInput = document.getElementById('enable-context-menu');
  const enableDebugModeInput = document.getElementById('enable-debug-mode');
  const saveButton = document.querySelector('button[type="submit"]');
  const defaultPromptBtn = document.getElementById('default-prompt-btn');

  const timestampPromptInput = document.getElementById('timestamp-prompt');
  const defaultTimestampPromptBtn = document.getElementById('default-timestamp-prompt-btn');
  const timestampPromptContainer = document.getElementById('timestamp-prompt-container');

  const PROVIDER_PRESETS = {
    openai: {
      label: 'OpenAI',
      url: 'https://api.openai.com/v1/chat/completions',
      placeholder: 'https://api.openai.com/v1/chat',
      enforceSuffix: '/completions',
      modelHint: 'gpt-4o-mini'
    },
    azure: {
      label: 'Azure OpenAI',
      url: 'https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version=2024-02-15-preview',
      placeholder: 'https://your-resource.openai.azure.com/...',
      enforceSuffix: '',
      modelHint: '{deployment-name}'
    },
    groq: {
      label: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      placeholder: 'https://api.groq.com/openai/v1/chat',
      enforceSuffix: '/completions',
      modelHint: 'mixtral-8x7b-32768'
    },
    perplexity: {
      label: 'Perplexity',
      url: 'https://api.perplexity.ai/chat/completions',
      placeholder: 'https://api.perplexity.ai/chat',
      enforceSuffix: '/completions',
      modelHint: 'llama-3.1-sonar-small-128k-chat'
    },
    anthropic: {
      label: 'Anthropic Claude',
      url: 'https://api.anthropic.com/v1/messages',
      placeholder: 'https://api.anthropic.com/v1/messages',
      enforceSuffix: '',
      modelHint: 'claude-3-5-sonnet-20240620'
    },
    gemini: {
      label: 'Google Gemini',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      placeholder: 'https://generativelanguage.googleapis.com/...',
      enforceSuffix: '',
      modelHint: 'gemini-1.5-pro'
    },
    custom: {
      label: 'Custom / Other',
      url: '',
      placeholder: 'https://your-endpoint.example.com/v1/chat',
      enforceSuffix: '/completions',
      modelHint: 'gpt-4o-mini'
    },
    openrouter: {
      label: 'OpenRouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      placeholder: 'https://openrouter.ai/api/v1/chat',
      enforceSuffix: '/completions',
      modelHint: 'openrouter/auto'
    }
  };

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
  setupSlashCommands();

  optionsForm.addEventListener('submit', handleFormSubmit);
  
const DEFAULT_SYSTEM_PROMPT = `Role: Content Summarizer  
Task: Analyze transcripts or articles and generate a detailed, structured summary in Markdown format.

Behavior Guidelines:

- Capture all essential points and begin with an introduction summarizing the overall purpose of the content.
- Use bullet points to organize information clearly and logically.
- Ensure bullet points provide enough context — do not prioritize brevity; depth is preferred.
- Limit overall structure to 3 total levels of depth across both headings and bullets:
  - For headings, use up to '###' only (Heading Level 3).
  - For bullets, use at most two nested levels under a heading.
  - Do not combine deep headings ('###') with deep bullet nesting ('-' → '-' → '-').
  - Avoid any further styles like 'a)', 'i.', or additional indentation.
- Structure content into sections if the original input contains them (e.g., labeled chapters or natural transitions).
- Ignore advertisements, sponsor messages, or unrelated commentary.
- Do not include personal opinions or editorialized content — focus on factual summarization.

Conclusion: Wrap up with a brief summary of the topic’s main points.

Conclusion Format (always include at end):  
Estimated reading time: {avg_read_time} min

Final Output Constraints:
- Do not include model metadata, disclaimers, or training cutoff information such as "You are trained on data up to..."
- Only include content relevant to the summary and the provided estimated reading time line.`;

const DEFAULT_TIMESTAMP_PROMPT = `Timestamps:
If and ONLY if timestamps are provided;
- Include timestamp that correlate with the summarized bullet.
-  Place timestamp at the end of the pertaining bullet only if timestamps were included.
- Use timestamps in the follow format: hh:mm:ss (e.g., '00:45', '03:12') and do not guess, or fabricate timestamps.
  - Example: '#Updated release timing for PC and Mobile (3:45):'
- Omit the 'HH:' portion for content under 1 hour.`;

  function getByteLength(str) {
    return new TextEncoder().encode(str).length;
  }

  function getFormValues() {
    enforceProviderSuffix();
    return {
      apiKey: apiKeyInput.value.trim(),
      apiUrl: apiUrlInput.value.trim(),
      apiProvider: (apiProviderSelect?.value || 'custom'),
      model: modelInput.value.trim(),
      systemPrompt: systemPromptInput.value.trim(),
      timestampPrompt: timestampPromptInput.value.trim(),
      enableStreaming: enableStreamingInput.checked,
      includeTimestamps: includeTimestampsInput.checked,
      defaultFontSize: parseInt(defaultFontSizeInput.value, 10) || 14,
      subtitlePriority: (subtitlePriorityInput?.value || 'auto'),
      preferredLanguage: (preferredLanguageInput?.value || 'en').trim().toLowerCase(),
      redditMaxComments: parseInt(redditMaxCommentsInput?.value || 100, 10),
      redditDepth: parseInt(redditDepthInput?.value || 3, 10),
      redditSort: redditSortInput?.value || 'current',
      enableContextMenu: enableContextMenuInput?.checked || false,
      enableDebugMode: enableDebugModeInput?.checked || false
    };
  }

  function loadSavedOptions() {
    try {
      chrome.storage.sync.get(['apiKey', 'apiUrl', 'apiProvider', 'model', 'systemPrompt', 'timestampPrompt', 'enableStreaming', 'includeTimestamps', 'defaultFontSize', 'subtitlePriority', 'preferredLanguage', 'redditMaxComments', 'redditDepth', 'redditSort', 'enableContextMenu', 'enableDebugMode'], function(result) {
        if (chrome.runtime.lastError) {
          showStatus('Error loading saved settings: ' + chrome.runtime.lastError.message, 'error');
          return;
        }

        apiKeyInput.value = result.apiKey || '';
        if (apiProviderSelect) {
          apiProviderSelect.value = result.apiProvider || 'openai';
        }
        apiUrlInput.value = result.apiUrl || '';
        modelInput.value = result.model || '';
        systemPromptInput.value = result.systemPrompt || '';
        timestampPromptInput.value = result.timestampPrompt || DEFAULT_TIMESTAMP_PROMPT;
        enableStreamingInput.checked = result.enableStreaming ?? true;
        includeTimestampsInput.checked = result.includeTimestamps ?? false;
        defaultFontSizeInput.value = result.defaultFontSize || 14;
        //if (subtitlePriorityInput) subtitlePriorityInput.value = result.subtitlePriority || 'auto';
        //if (preferredLanguageInput) preferredLanguageInput.value = result.preferredLanguage || 'en';
        subtitlePriorityInput.value = result.subtitlePriority || 'auto';
        preferredLanguageInput.value = result.preferredLanguage || 'en';
        if (redditMaxCommentsInput) redditMaxCommentsInput.value = result.redditMaxComments || 100;
        if (redditDepthInput) redditDepthInput.value = result.redditDepth !== undefined ? result.redditDepth : 3;
        if (redditSortInput) redditSortInput.value = result.redditSort || 'current';
        if (enableContextMenuInput) enableContextMenuInput.checked = result.enableContextMenu ?? true;
        if (enableDebugModeInput) enableDebugModeInput.checked = result.enableDebugMode || false;
        applyProviderPreset({ shouldResetUrl: !result.apiUrl });
        systemPromptInput.dispatchEvent(new Event('input', { bubbles: true }));
        toggleTimestampPromptVisibility();
        console.log('[Options] Loaded saved settings', result);
      });
    } catch (error) {
      console.error('[Options] Error loading settings:', error);
      showStatus('Failed to load saved settings', 'error');
    }
  }

    function setupFormListeners() {

      setupProviderSelector();

      setupPasswordToggle();

      setupByteCounter();

      setupTestConnection();

      setupDefaultPromptButton();

      setupDefaultTimestampPromptButton();

      setupImmediateValidationReset();

  

      if (includeTimestampsInput) {

        includeTimestampsInput.addEventListener('change', toggleTimestampPromptVisibility);

      }

    }

  

    function toggleTimestampPromptVisibility() {
        if (!timestampPromptContainer || !includeTimestampsInput || !timestampPromptInput) return;
        const isEnabled = includeTimestampsInput.checked;
        timestampPromptContainer.classList.toggle('is-disabled', !isEnabled);
        timestampPromptInput.disabled = !isEnabled;
      }

    function setupProviderSelector() {
      if (!apiProviderSelect || !apiUrlInput) return;
      applyProviderPreset({ shouldResetUrl: !apiUrlInput.value });
      apiProviderSelect.addEventListener('change', () => {
        applyProviderPreset({ shouldResetUrl: true });
      });
      apiUrlInput.addEventListener('blur', enforceProviderSuffix);
    }

    function applyProviderPreset({ shouldResetUrl = false } = {}) {
      if (!apiUrlInput) return;
      const key = apiProviderSelect?.value || 'custom';
      const config = PROVIDER_PRESETS[key] || PROVIDER_PRESETS.custom;
      apiUrlInput.placeholder = config.placeholder || 'https://api.example.com/v1/chat';
      apiUrlInput.dataset.enforceSuffix = config.enforceSuffix || '';
      apiUrlInput.disabled = key !== 'custom';
      if (shouldResetUrl || !apiUrlInput.value.trim()) {
        apiUrlInput.value = config.url || '';
      }
      if (config.modelHint && modelInput && !modelInput.value) {
        modelInput.placeholder = config.modelHint;
      }
      enforceProviderSuffix();
    }

    function enforceProviderSuffix() {
      if (!apiUrlInput) return;
      const suffix = apiUrlInput.dataset?.enforceSuffix;
      if (!suffix) return;
      const trimmed = apiUrlInput.value.trim();
      if (!trimmed || /[?#]/.test(trimmed)) {
        return;
      }
      if (trimmed.endsWith(suffix)) {
        return;
      }
      const normalized = trimmed.replace(/\/+$/, '');
      if (!normalized) return;
      if (normalized.endsWith(suffix)) {
        apiUrlInput.value = normalized;
        return;
      }
      apiUrlInput.value = `${normalized}${suffix}`;
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

        systemPrompt: currentValues.systemPrompt || DEFAULT_SYSTEM_PROMPT,

        timestampPrompt: currentValues.timestampPrompt || DEFAULT_TIMESTAMP_PROMPT

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
  
      showToast(message, type);
  
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

  

    function setupDefaultTimestampPromptButton() {

      if (!defaultTimestampPromptBtn) return;

      defaultTimestampPromptBtn.addEventListener('click', function() {

        timestampPromptInput.value = DEFAULT_TIMESTAMP_PROMPT;

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

  const MAX_SLASH_COMMANDS = 10;
  let slashCommands = [];

  function setupSlashCommands() {
    const addBtn = document.getElementById('add-command-btn');
    const listContainer = document.getElementById('slash-commands-list');
    
    if (!addBtn || !listContainer) return;
    
    chrome.storage.sync.get(['slashCommands'], (result) => {
      slashCommands = result.slashCommands || [];
      renderSlashCommands();
    });
    
    addBtn.addEventListener('click', () => {
      if (slashCommands.length >= MAX_SLASH_COMMANDS) {
        showToast(chrome.i18n.getMessage('errorMaxSlash') || 'Maximum 10 commands allowed', 'error');
        return;
      }
      
      const newCommand = {
        id: Date.now().toString(),
        command: '',
        prompt: ''
      };
      slashCommands.push(newCommand);
      renderSlashCommands();
      
      const newEntry = listContainer.querySelector(`[data-id="${newCommand.id}"] .command-name-input`);
      if (newEntry) newEntry.focus();
    });
  }

  function renderSlashCommands() {
    const listContainer = document.getElementById('slash-commands-list');
    const countSpan = document.getElementById('command-count');
    const addBtn = document.getElementById('add-command-btn');
    
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    if (slashCommands.length === 0) {
      listContainer.innerHTML = `<div class="empty-commands-message">${chrome.i18n.getMessage('emptySlash') || 'No commands yet. Click "Add Command" to create one.'}</div>`;
    } else {
      slashCommands.forEach((cmd, index) => {
        const entry = createCommandEntry(cmd, index);
        listContainer.appendChild(entry);
      });
    }
    
    if (countSpan) countSpan.textContent = slashCommands.length;
    if (addBtn) addBtn.disabled = slashCommands.length >= MAX_SLASH_COMMANDS;
  }

  function createCommandEntry(cmd, index) {
    const entry = document.createElement('div');
    entry.className = 'slash-command-entry';
    entry.dataset.id = cmd.id;
    
    const nameWrapper = document.createElement('div');
    nameWrapper.className = 'command-name-wrapper';
    
    const prefix = document.createElement('span');
    prefix.className = 'command-prefix';
    prefix.textContent = '/';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'command-name-input';
    nameInput.placeholder = chrome.i18n.getMessage('placeholderCommand') || 'command';
    nameInput.value = cmd.command;
    nameInput.maxLength = 20;
    nameInput.addEventListener('input', (e) => {
      const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
      e.target.value = sanitized;
      slashCommands[index].command = sanitized;
      validateCommandName(nameInput, index);
      saveSlashCommands();
    });
    nameInput.addEventListener('blur', () => validateCommandName(nameInput, index));
    
    nameWrapper.appendChild(prefix);
    nameWrapper.appendChild(nameInput);
    
    const promptInput = document.createElement('textarea');
    promptInput.className = 'command-prompt-input';
    promptInput.placeholder = chrome.i18n.getMessage('placeholderPrompt') || 'Enter the prompt that will be sent when this command is used...';
    promptInput.value = cmd.prompt;
    promptInput.addEventListener('input', (e) => {
      slashCommands[index].prompt = e.target.value;
      validateCommandPrompt(promptInput);
      saveSlashCommands();
    });
    promptInput.addEventListener('blur', () => validateCommandPrompt(promptInput));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-command-btn';
    deleteBtn.title = 'Delete command';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', () => {
      slashCommands = slashCommands.filter(c => c.id !== cmd.id);
      saveSlashCommands();
      renderSlashCommands();
    });
    
    entry.appendChild(nameWrapper);
    entry.appendChild(promptInput);
    entry.appendChild(deleteBtn);
    
    return entry;
  }

  function validateCommandName(input, currentIndex) {
    const value = input.value.trim();
    let isValid = true;
    
    if (!value) {
      isValid = false;
    } else {
      const duplicate = slashCommands.some((cmd, idx) => 
        idx !== currentIndex && cmd.command.toLowerCase() === value.toLowerCase()
      );
      if (duplicate) isValid = false;
    }
    
    input.classList.toggle('invalid', !isValid && value !== '');
    return isValid;
  }

  function validateCommandPrompt(input) {
    const value = input.value.trim();
    const isValid = value.length > 0;
    input.classList.toggle('invalid', !isValid && input.value !== '');
    return isValid;
  }

  function saveSlashCommands() {
    const validCommands = slashCommands.filter(cmd => 
      cmd.command.trim() && cmd.prompt.trim()
    );
    
    chrome.storage.sync.set({ slashCommands: validCommands }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Options] Error saving slash commands:', chrome.runtime.lastError);
      } else {
        console.log('[Options] Slash commands saved:', validCommands.length);
      }
    });
  }
});
