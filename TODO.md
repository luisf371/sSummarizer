~~Modular Design by placing scraping functions on seperate file~~
~~Streaming Mode fix / Toggle on Option~~
Futher improvements to Options
    ~~a) display OpenAI compatible only~~
    ~~b) provide example url (https://url/chats/completions)~~
    ~~c) Default System Prompt Button (removes user prompt and replaces with standarized version)~~
    4) use less vertical space
    ~~5) floating save button (floats top right despite scrolling)~~
    ~~6) display warning on test api > conducts an actual api call (charges may occur)~~
    ~~7) no emoji's~~
Seperate System Prompts for Websites vs Youtube?
~~Remove "AI Summary" on popup (background.js@374)~~
~~Remember Popup Text Size and/or set a default size in "options"~~


~~Options Page v2~~
~~- Dropdown selection for known API endpoints~~
~~- Re-add /chat/completions in the backend code?~~
~~- Modify System Prompt default text~~
- ~~Ensure Stream mode is Enabled by default~~


# Follow on question
implementation > bug hunt

# Reddit module
~~Currently there's 2 module,~~
~~1. Youtube extractor with 2 methods of extraction.~~
~~2. Everything else Raw content extractor~~
~~Intent: provide reddit specific extraction logic that cleans the input~~
Implemented > bug hunt

# Timestamps
Additional prompt text box when timestamps are enabled - text box grayed out if disabled. when enabled, that prompt is appeneded to the system prompt.

# API Endpoints
Modify to dropdown with known API endpoints
Model remains an open text box for easy updates to newer models
Include a custom to allow custom API endpoints
Re-add /chat/completions in the backend code?

# Limits
Validate truncation - is it necessary with modern llm?
