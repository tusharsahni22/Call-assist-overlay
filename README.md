# Stealth Floating Interactive Script Reader & Call Assist Overlay

A sleek, modern Electron-based desktop overlay designed specifically for client calls, presentations, and interviews.

## ✨ Key Features

1. **Anti-Screen Share Shield (Stealth Mode)**
   - Utilizes Electron's native `setContentProtection(true)` which binds to the Windows OS API `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`.
   - **Invisible to screen-sharing and capture tools**: Zoom, Google Meet, Microsoft Teams, Discord, OBS Studio, and screenshot tools cannot capture this overlay. It remains completely visible and interactable only on your physical screen.

2. **Floating Frameless Glassmorphism UI**
   - Translucent dark glass styling with backdrop blur.
   - Draggable anywhere across your screen using the top bar.
   - Pinned (`Always-On-Top`) so your scripts never hide behind active browser tabs or meeting windows.

3. **Useful Interactive Controls**
   - **Auto-Scroll Teleprompter**: Play/pause auto-scroll with speed controls (`+`, `-`) and quick shortcut (`Space` key).
   - **Opacity Slider**: Adjust background opacity on the fly (from 20% ghost mode to 100% solid).
   - **Font Scaling Slider**: Instantly adjust font size for comfortable reading distance.
   - **Click-Through Mode**: Pass mouse clicks directly through to underlying applications when needed.
   - **Tabbed Interface**:
     - 📜 **Script Reader**: Sectioned talk-tracks with highlighted tags and placeholders.
     - 💡 **Cheat Sheet**: Quick reference cards for metrics and value propositions.
     - ⚡ **Quick Responses**: Single-click copyable answer snippets for objection handling.
     - 📝 **Live Notes**: Real-time scratchpad with automatic `localStorage` persistence.

## 🚀 How to Run

```bash
# Start the app
npm start
```

