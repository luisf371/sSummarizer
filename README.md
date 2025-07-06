# AI Summarizer Pro - Chrome Extension

A powerful Chrome extension that intelligently summarizes web content using AI. Supports regular web pages and YouTube videos with an enhanced floating window interface.

## 🚀 Features

### Core Functionality
- **Smart Content Extraction**: Automatically extracts text from web pages or YouTube video transcripts
- **AI-Powered Summarization**: Uses configurable AI models to generate concise summaries
- **Floating Window Interface**: Modern, draggable, and resizable summary display
- **Real-time Streaming**: Shows AI responses as they're generated
- **Multi-window Support**: Handle multiple summaries simultaneously

### Enhanced User Experience
- **Modern UI Design**: Professional gradient styling with smooth animations
- **Responsive Design**: Works on all screen sizes
- **Font Size Controls**: Adjustable text size for better readability
- **Minimize/Maximize**: Collapsible windows to save screen space
- **Auto-positioning**: Smart window placement to avoid overlaps

### Advanced Configuration
- **API Flexibility**: Works with OpenAI, Anthropic, or any compatible API
- **Custom System Prompts**: Tailor AI behavior for specific use cases
- **Model Selection**: Choose from different AI models
- **Connection Testing**: Verify API settings before use
- **Input Validation**: Real-time form validation with helpful feedback

## 📋 Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension icon will appear in your toolbar

## ⚙️ Configuration

1. Click the extension icon and select "Options" or right-click → "Options"
2. Configure your API settings:
   - **API Endpoint URL**: Your AI service endpoint (e.g., `https://api.openai.com/v1/chat/completions`)
   - **API Key**: Your authentication key
   - **Model Name**: AI model to use (e.g., `gpt-3.5-turbo`, `gpt-4`)
   - **System Prompt**: Custom instructions for the AI (optional)
3. Click "Test Connection" to verify your settings
4. Save your configuration

## 🎯 Usage

### For Web Pages
1. Navigate to any webpage
2. Click the extension icon in your toolbar
3. Wait for the AI to analyze and summarize the content
4. View the summary in the floating window

### For YouTube Videos
1. Navigate to a YouTube video page
2. Click the extension icon
3. The extension will extract the auto-generated transcript
4. View the AI-generated summary of the video content

### Window Controls
- **Drag**: Click and drag the title bar to move the window
- **Resize**: Drag the bottom-right corner to resize
- **Font Size**: Use A⁺/A⁻ buttons to adjust text size
- **Minimize**: Click the − button to collapse the window
- **Close**: Click the × button to close the window

## 🔧 Technical Improvements

### Version 2.0 Enhancements

#### Error Handling & Validation
- Comprehensive input validation for all configuration fields
- Robust error handling with user-friendly messages
- Network timeout protection with configurable limits
- Graceful fallback for failed API requests

#### Performance Optimizations
- Text truncation to prevent oversized API requests (50,000 character limit)
- Efficient memory management for multiple windows
- Optimized DOM manipulation and event handling
- Smart content sanitization to prevent XSS attacks

#### Security Improvements
- Content Security Policy compliance
- Input sanitization for all user-provided content
- Secure API key storage using Chrome's sync storage
- Protection against malicious content injection

#### User Experience Enhancements
- Modern, responsive design with CSS Grid and Flexbox
- Smooth animations and transitions
- Accessibility improvements with proper ARIA labels
- Mobile-friendly responsive layout

#### Code Quality
- Comprehensive JSDoc documentation
- Modular function architecture
- Consistent error logging and debugging
- Clean separation of concerns

## 🛠️ Development

### File Structure
```
├── manifest.json          # Extension configuration
├── background.js          # Service worker (main logic)
├── content.js            # Content script (UI management)
├── options.html          # Settings page HTML
├── options.js            # Settings page logic
├── styles.css            # Modern CSS styling
├── logo.png              # Extension icon
└── README.md             # Documentation
```

### Key Components

#### Background Script (`background.js`)
- Handles extension icon clicks
- Manages API communication with streaming support
- Extracts content from web pages and YouTube videos
- Processes and forwards AI responses to content script

#### Content Script (`content.js`)
- Creates and manages floating windows
- Handles user interactions (drag, resize, font controls)
- Displays streaming AI responses
- Manages multiple concurrent windows

#### Options Page (`options.html` + `options.js`)
- Modern configuration interface
- Real-time validation and feedback
- API connection testing
- Secure settings storage

## 🔒 Privacy & Security

- **Local Storage**: All settings are stored locally in your browser
- **No Data Collection**: The extension doesn't collect or transmit personal data
- **API Security**: API keys are stored securely using Chrome's encrypted storage
- **Content Sanitization**: All displayed content is sanitized to prevent XSS attacks

## 🐛 Troubleshooting

### Common Issues

**Extension not working on certain pages**
- Some pages (chrome://, extension pages) are restricted by browser security
- Try the extension on regular websites

**API connection fails**
- Verify your API URL and key in the options page
- Use the "Test Connection" button to diagnose issues
- Check your internet connection and API service status

**Floating window not appearing**
- Check browser console for error messages
- Ensure content scripts are allowed on the current page
- Try refreshing the page and clicking the extension icon again

**YouTube transcripts not found**
- The video must have auto-generated English captions
- Some videos may not have transcripts available
- Try with different YouTube videos

## 📝 Changelog

### Version 2.0
- Complete UI/UX overhaul with modern design
- Enhanced error handling and validation
- Performance optimizations and security improvements
- Added connection testing and real-time validation
- Improved accessibility and responsive design
- Comprehensive code documentation and refactoring

### Version 1.1
- Initial release with basic functionality
- Simple floating window interface
- YouTube transcript support
- Basic API integration

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## 📄 License

This project is open source and available under the MIT License.
