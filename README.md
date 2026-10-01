# HAND TRACKER

Advanced Hand Tracking AR experience that runs both natively in Python and directly in the web browser using MediaPipe. It tracks hands, calculates gestures, spread percentage, pinches, and dynamically reacts with audio and visual feedback.

## Features
- **Accurate Finger Counting**: Detects whether fingers are folded or extended, calculating precise hand spread percentage.
- **Gesture Detection**: Reliably identifies gestures such as "Fist", "Pinch", "Open Hand", or simply outputs the count of fingers held up.
- **Audio Feedback**: Generates real-time sine wave hums and zaps based on hand proximity and pinching.
- **Dynamic VFX**: Features a Matrix-style digital rain background, particle effects on fingertips, shockwaves on pinch, and glow/bloom processing.
- **Dual Platforms**:
  - `hand_tracker.py` for a desktop Python OpenCV application (with Pygame audio).
  - `index.html` for a client-side Web application leveraging MediaPipe JS.

## Getting Started (Python)
### Prerequisites
- Python 3.x
- OpenCV (`cv2`)
- MediaPipe (`mediapipe`)
- Pygame (`pygame`)
- Numpy (`numpy`)

### Installation & Execution
```bash
pip install opencv-python mediapipe pygame numpy
python hand_tracker.py
```
**Controls**: 
- Press `n` to change visual themes.
- Press `q` to quit the application.

## Getting Started (Web)
Simply open `index.html` in any modern web browser. Make sure to allow camera and microphone/audio permissions. Click "Enter Experience" to start the AR environment.
