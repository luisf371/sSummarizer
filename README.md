![Project Banner](path/to/image.png)
<!-- Replace with actual banner if available -->

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Language: JavaScript](https://img.shields.io/badge/Language-JavaScript-F7DF1E.svg)
![Version: 1.0.0](https://img.shields.io/badge/Version-1.0.0-green.svg)

🌍 **Supported Languages:** English, Spanish, French, Japanese, Portuguese (Brazil), Chinese (Simplified)

sSummarizer uses powerful AI to help you read less and learn more by summarizing any webpage in seconds. It works perfectly with standard articles, YouTube videos (using transcripts), and even deep Reddit threads.

## Key Features

*   **Multi-Platform Support**: Summarize news articles, YouTube videos with timestamps, and Reddit comment threads.
*   **AI Provider Choice**: Connect to your favorite AI like OpenAI, Claude, Gemini, Groq, or Perplexity.
*   **Slash Commands**: Create quick shortcuts like `/bullet` or `/short` to change how the AI responds.
*   **Real-time Streaming**: Watch the AI write your summary live instead of waiting for a full response.
*   **Context Menu**: Highlight any text on a page and right-click to summarize just that specific part.

## Quick Start

### Install from Chrome Web Store
1. Visit the [Chrome Web Store](https://chrome.google.com/webstore) (Coming Soon).
2. Click **Add to Chrome**.

### Manual Installation
1. Download this repository as a ZIP and extract it.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** and click **Load unpacked**.
4. Open the extension **Options** and add your AI API key to get started.

## Overview

sSummarizer is a sophisticated tool built on Manifest V3 that securely communicates with various AI endpoints. It features a custom content extractor that identifies the main text, video transcripts, or comment structures to give the AI exactly what it needs for a perfect summary.

## FAQ

**Q: What does the 's' in the name mean?**
A: It stands for simple and lightweight application with no bloat, tracking, or ads.

**Q: Do I need my own API key?**
A: Yes, you will need to provide your own key from a provider like OpenAI or Anthropic to use the summarization features.

**Q: Does it work on YouTube?**
A: Yes, it pulls the transcript from the video and summarizes the key points, including timestamps.

**Q: Can I change the summary style?**
A: Yes, you can set a "System Prompt" in the settings or use custom Slash Commands to tell the AI exactly how to write.

**Q: Is my browsing data private?**
A: Absolutely. The extension only looks at the page you specifically ask it to summarize and sends that text only to your chosen AI provider.

## License

MIT License
