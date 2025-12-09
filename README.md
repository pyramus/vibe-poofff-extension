# Poofff - Element Hider

A Chrome extension that lets you interactively hide elements on any webpage, inspired by Arc Browser's "Zap" feature.

## Features

- 🎯 **Interactive Element Selection** - Click to hide any element on a webpage
- 💾 **Persistent Storage** - Hidden elements stay hidden across page reloads (stored per domain)
- ↩️ **Undo Support** - Quick undo toast notification after hiding elements
- 🗑️ **Selective Management** - Remove individual hidden elements or reset all at once
- 🎨 **Visual Feedback** - Hover highlights and smooth animations
- ⌨️ **Keyboard Shortcuts** - Press ESC to exit Poofff mode

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the `vibe-poofff-extension` folder

## Usage

### Hiding Elements

1. Click the Poofff extension icon in your browser toolbar
2. Click "Start Poofff…" to activate selection mode
3. Hover over elements on the page - they'll highlight in red
4. Click any element to hide it
5. Use the "Undo" button in the toast notification to restore the last hidden element
6. Press ESC or click "Stop Poofff" to exit selection mode

### Managing Hidden Elements

1. Click the extension icon
2. Click "And it's gone!" to view all hidden elements for the current domain
3. Click the "✕" button next to any selector to unhide that specific element
4. Click "Reset All Hidden" to unhide all elements on the current domain

## How It Works

Poofff generates unique CSS selectors for each element you click and injects styles to hide them. The selectors are:

- **Precise** - Uses classes, data attributes, and `:nth-child()` for specificity
- **Unique** - Validates that each selector matches only the intended element
- **Persistent** - Stored in Chrome's local storage, organized by domain

## Technical Details

- **Manifest Version**: 3
- **Permissions**: `storage`, `activeTab`, `scripting`
- **Files**:
  - `content.js` - Main logic for element selection and hiding
  - `popup.html/js` - Extension popup interface
  - `styles.css` - Content script styles
  - `manifest.json` - Extension configuration

## Troubleshooting

**Extension not working?**
- Refresh the page after installing or updating the extension
- The extension cannot run on Chrome system pages (chrome://, edge://, about:)

**Elements not staying hidden?**
- Check if the page is a Single Page Application (SPA) - the extension re-applies styles on page load
- Some websites may have aggressive CSS that overrides the hiding styles

## License

MIT License - Feel free to use and modify as needed.
