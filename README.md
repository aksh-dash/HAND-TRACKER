# HAND TRACKER: MULTI-MODE AR ENGINE

An advanced Hand Tracking AR experience that runs directly in the web browser using MediaPipe, and bridges to your local OS for gesture-based control.

## 🚀 Features & Modes
- **Detect**: Pure hand tracking visualization with One-Euro smoothing and gesture recognition (Pinch, Grab, Open Palm, Fist, "O", Pointing).
- **Board**: Pinch to draw, flat palm to erase, customizable colors/brush size, export to PNG.
- **Media**: Pinch and move up/down for volume. Swipe left/right for next/prev tracks.
- **Zoom**: Spread two fingers to digitally zoom the canvas up to 5x.
- **Record**: Hold the "O" gesture for 3 seconds to record your session and download it as WebM.
- **Mouse**: Control your OS cursor with your index finger; pinch to click.
- **Present**: Use the pointing gesture as a laser pointer, swipe to switch slides.
- **Custom**: Few-shot train your own gestures to map to custom commands!

## ⚙️ Setup Instructions

### 1. Web Application
The frontend runs purely in JavaScript using MediaPipe and requires no backend to detect hands. 
To run it, host a local server in this directory:
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000` in your browser.

### 2. OS Bridge (Python Server)
To use modes like **Media**, **Mouse**, or **Present**, you must start the local WebSocket bridge. This allows the browser to send OS-level commands (volume, brightness, mouse movement).

**Prerequisites**:
```bash
pip install websockets pyautogui pycaw screen-brightness-control
```

**Run the Server**:
```bash
python server.py
```
*The HUD will update to say `Bridge: Connected` once running.*

## 🎥 Demo Checklist (GIFs to make)
- [ ] Record a GIF of switching between all 8 modes seamlessly.
- [ ] Record a GIF of drawing in Board Mode (Pinch to draw, Palm to erase).
- [ ] Record a GIF of Media Mode controlling the volume slider.
- [ ] Record a GIF of the "O" gesture triggering the 3-2-1 Recording countdown.
- [ ] Record a GIF showing the OS Mouse moving in sync with the index finger.

## 🎛️ Advanced Configuration
The HUD now supports highly precise tuning for latency and hysteresis:
- **Pinch Thresholds**: Adjust the `Pinch Enter` and `Pinch Exit` ratios dynamically in Board Mode to tune hysteresis.
- **Latency Compensation**: Use the 0-40ms slider to extrapolate ink velocity and completely eliminate cursor drag.
- **Debug Crosshair**: Toggle the crosshair to visually confirm 1:1 fingertip mapping via the new unified aspect-ratio coordinate mapper.
