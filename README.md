![sSummarizer Icon](logo.png)

# sSummarizer

![License](https://img.shields.io/badge/license-Proprietary-red)
![Language](https://img.shields.io/badge/language-JavaScript-yellow)
![Version](https://img.shields.io/badge/version-1.12-blue)

🌍 **Supported Languages:** English, Spanish, French, Japanese, Portuguese (Brazilian), Chinese (Simplified)

sSummarizer is an intelligent Chrome extension that leverages advanced AI models to provide concise, context-aware summaries of web content. Whether you are browsing complex articles, watching lengthy YouTube videos, or navigating deep Reddit threads, this tool extracts the essential information in seconds.

## Key Features

*   **Multi-Provider AI Support**: Connect to OpenAI, Azure, Groq, Anthropic, Gemini, and more.
*   **YouTube Intelligence**: Automatic transcript extraction with timestamp support and subtitle preferences.
*   **Reddit Optimization**: Summarize entire threads with customizable comment depth and sorting logic.
*   **Context Menu Integration**: Highlight any text on a page and summarize it instantly via the right-click menu.
*   **Streaming Output**: Watch summaries generate in real-time with a smooth, responsive interface.
*   **Debug Mode**: Inspect extracted content to understand exactly what data is being sent to the AI.

## Quick Start

### Installation

1.  Clone this repository or download the source code.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked** and select the `sSummarizer` directory.

### Configuration

1.  Right-click the sSummarizer icon and select **Options**, or click the gear icon in the extension popup.
2.  Select your preferred **AI Provider** (e.g., OpenAI, Anthropic).
3.  Enter your **API Key** and configure the model settings.
4.  (Optional) Customize the **System Prompt** to change the summary style or language.

## Usage

### Web Pages
Click the sSummarizer icon in your toolbar while on any article or blog post. A floating window will appear and begin generating a summary of the page content.

### YouTube Videos
When on a YouTube video page, sSummarizer automatically detects the transcript. The summary will include key points and can be configured to respect specific timestamps.

### Reddit Threads
On Reddit, the extension scrapes comments based on your configured depth. It provides a synthesized view of the discussion, capturing the community sentiment and top arguments.

## Overview

sSummarizer is built using a modular architecture that separates content extraction from AI processing. The `content.js` script handles site-specific scraping (Web, YouTube, Reddit), while `background.js` manages API communication and streaming responses. 

### Permissions Explanation

*   **activeTab**: Required to access the content of the current tab when the user invokes the extension.
*   **scripting**: Used to inject the extraction logic and the floating UI into the web page.
*   **storage**: Necessary for saving user configurations, API keys, and custom prompts securely.
*   **contextMenus**: Enables the "Summarize selection" feature in the browser's right-click menu.

## FAQ

**1. Is an API key required to use the extension?**
Yes, sSummarizer acts as a client for various AI providers. You must provide your own API key for OpenAI, Anthropic, Gemini, or other supported services.

**2. Is my data sent to any third-party servers?**
No. Your API keys are stored locally in your browser's storage, and requests are sent directly from your machine to the AI provider's official API endpoints.

**3. Why is the YouTube transcript not appearing?**
Ensure the video has captions available. sSummarizer attempts to pull official or auto-generated captions; if none exist, it may not be able to generate a video summary.

**4. Can I change the summary language?**
Yes. You can modify the "System Prompt" in the Options page to instruct the AI to respond in your preferred language (e.g., "Summarize the following text in French").

**5. What is Debug Mode?**
Debug Mode allows you to see the raw text extracted from the page before it is sent to the AI. This is useful for troubleshooting extraction issues on specific websites.

## Credits

**Author:** [tekky.cc](https://tekky.cc)

This project was developed as an independent tool for intelligent web content consumption.

## License

This extension is **Proprietary Software**. See `fork.md` for more details.

