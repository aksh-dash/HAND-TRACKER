import cv2
import mediapipe as mp
from mediapipe.solutions import hands as mp_hands
from mediapipe.solutions import drawing_utils as mp_draw
import numpy as np
import time
import math
import random
import pygame
import colorsys

# --- CONFIG & GLOBALS ---
WIDTH, HEIGHT = 1280, 720
FPS_CAP = 60
FINGER_TIPS = [4, 8, 12, 16, 20]

# Theme Colors (HSL to BGR)
def get_theme_color(theme, t, index, total):
    if theme == 'Rainbow':
        h = (t * 0.1 + index / total) % 1.0
        rgb = colorsys.hls_to_rgb(h, 0.6, 1.0)
    elif theme == 'Cyberpunk':
        rgb = (1.0, 0, 0.23) if index % 2 == 0 else (0, 0.94, 1.0)
    elif theme == 'Lava':
        h = (0.02 + (index * 0.02)) % 0.11
        rgb = colorsys.hls_to_rgb(h, 0.5 + math.sin(t) * 0.1, 1.0)
    elif theme == 'Ocean':
        h = (0.5 + (index * 0.05)) % 1.0
        rgb = colorsys.hls_to_rgb(h, 0.6, 1.0)
    elif theme == 'Galaxy':
        h = (0.72 + math.sin(t * 2 + index) * 0.1) % 1.0
        rgb = colorsys.hls_to_rgb(h, 0.65, 1.0)
    else:
        rgb = (1, 1, 1)
        
    # Return BGR for OpenCV
    return (int(rgb[2] * 255), int(rgb[1] * 255), int(rgb[0] * 255))

# --- CLASSES ---

class Particle:
    def __init__(self, x, y, color):
        self.x = x
        self.y = y
        self.vx = (random.random() - 0.5) * 15
        self.vy = (random.random() - 0.5) * 15
        self.life = 1.0
        self.color = color
        self.size = random.randint(2, 5)

    def update(self):
        self.x += self.vx
        self.y += self.vy
        self.vy += 0.5  # Gravity
        self.life -= 0.03
        return self.life > 0

    def draw(self, img):
        alpha = int(self.life * 255)
        cv2.circle(img, (int(self.x), int(self.y)), self.size, self.color, -1)

class Ripple:
    def __init__(self, x, y, color):
        self.x = x
        self.y = y
        self.radius = 0
        self.max_radius = random.randint(100, 200)
        self.life = 1.0
        self.color = color

    def update(self):
        self.radius += (self.max_radius - self.radius) * 0.2
        self.life -= 0.04
        return self.life > 0

    def draw(self, img):
        thickness = max(1, int(4 * self.life))
        cv2.circle(img, (int(self.x), int(self.y)), int(self.radius), self.color, thickness)

class MatrixBackground:
    def __init__(self, width, height, font_size=16):
        self.width = width
        self.height = height
        self.font_size = font_size
        self.columns = width // font_size
        self.drops = [random.randint(-100, 0) for _ in range(self.columns)]
        self.chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%\"'#&_(),.;:?!"

    def update(self, speed_mult=1.0):
        for i in range(len(self.drops)):
            self.drops[i] += speed_mult * random.uniform(0.5, 1.5)
            if self.drops[i] * self.font_size > self.height and random.random() > 0.95:
                self.drops[i] = 0

    def draw(self, img, color):
        for i, drop in enumerate(self.drops):
            if random.random() > 0.9:
                char = random.choice(self.chars)
                x = i * self.font_size
                y = int(drop * self.font_size)
                if 0 <= y < self.height:
                    cv2.putText(img, char, (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

# --- AUDIO ENGINE ---

class AudioEngine:
    def __init__(self):
        try:
            pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=512)
            self.hum_channel = None
            self.hum_sound = self._generate_sine_wave(100, 1.0)
            self.zap_sound = self._generate_zap()
            self.enabled = True
        except Exception as e:
            print(f"Audio init failed: {e}")
            self.enabled = False
        
    def _generate_sine_wave(self, freq, duration, volume=0.1):
        sample_rate = 44100
        n_samples = int(sample_rate * duration)
        buf = np.zeros((n_samples, 2), dtype=np.int16)
        max_sample = 2**(15) - 1
        for i in range(n_samples):
            t = float(i) / sample_rate
            val = int(volume * max_sample * math.sin(2.0 * math.pi * freq * t))
            buf[i][0] = val  # Left
            buf[i][1] = val  # Right
        return pygame.sndarray.make_sound(buf)

    def _generate_zap(self):
        sample_rate = 44100
        duration = 0.15
        n_samples = int(sample_rate * duration)
        buf = np.zeros((n_samples, 2), dtype=np.int16)
        max_sample = 2**(15) - 1
        for i in range(n_samples):
            t = float(i) / sample_rate
            freq = 800 * (1 - t/duration) + 40
            vol = 0.5 * math.exp(-t * 20)
            val = int(vol * max_sample * math.sin(2.0 * math.pi * freq * t))
            buf[i][0] = val
            buf[i][1] = val
        return pygame.sndarray.make_sound(buf)

    def play_hum(self, volume, pitch_mult):
        if not self.enabled: return
        if not self.hum_channel:
            self.hum_channel = self.hum_sound.play(loops=-1)
        self.hum_channel.set_volume(volume)

    def stop_hum(self):
        if not self.enabled: return
        if self.hum_channel:
            self.hum_channel.stop()
            self.hum_channel = None

    def trigger_zap(self):
        if not self.enabled: return
        self.zap_sound.play()

# --- MAIN APP ---

class HandTrackerApp:
    def __init__(self):
        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)
        
        self.mp_hands = mp_hands
        self.hands = self.mp_hands.Hands(
            max_num_hands=2,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.7
        )
        self.mp_draw = mp_draw
        
        self.audio = AudioEngine()
        self.matrix = MatrixBackground(WIDTH, HEIGHT)
        
        self.particles = []
        self.ripples = []
        self.current_theme = 'Rainbow'
        self.themes_list = ['Rainbow', 'Cyberpunk', 'Lava', 'Ocean', 'Galaxy']
        self.theme_idx = 0
        
        self.last_pinch = [False, False]
        self.hand_vel = 0
        self.prev_landmarks = None
        
        self.start_time = time.time()
        self.fps = 0
        self.frame_count = 0
        self.last_fps_update = time.time()

    def get_dist(self, p1, p2):
        return math.hypot(p1.x - p2.x, p1.y - p2.y)

    def run(self):
        while self.cap.isOpened():
            success, frame = self.cap.read()
            if not success: break
            
            frame = cv2.flip(frame, 1)
            h, w, c = frame.shape
            
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.hands.process(rgb_frame)
            
            bg_layer = np.zeros_like(frame)
            curr_time = time.time() - self.start_time
            theme_color = get_theme_color(self.current_theme, curr_time, 0, 1)
            self.matrix.update(speed_mult=1.0 + self.hand_vel * 50)
            self.matrix.draw(bg_layer, theme_color)
            
            frame = cv2.addWeighted(frame, 0.4, bg_layer, 0.6, 0)
            bloom_layer = np.zeros_like(frame)
            
            hands_data = []
            if results.multi_hand_landmarks:
                total_fingers_up = 0
                is_any_pinching = False
                
                for idx, hand_lms in enumerate(results.multi_hand_landmarks):
                    lms = hand_lms.landmark
                    fingers_up = 0
                    
                    # Thumb
                    if self.get_dist(lms[4], lms[17]) > self.get_dist(lms[3], lms[17]):
                        fingers_up += 1
                    # Index to Pinky
                    tips = [8, 12, 16, 20]
                    pips = [6, 10, 14, 18]
                    for tip, pip in zip(tips, pips):
                        if self.get_dist(lms[tip], lms[0]) > self.get_dist(lms[pip], lms[0]):
                            fingers_up += 1
                    
                    total_fingers_up += fingers_up
                    hands_data.append(lms)
                    
                    if self.prev_landmarks and idx < len(self.prev_landmarks):
                        d = self.get_dist(lms[8], self.prev_landmarks[idx][8])
                        self.hand_vel = d
                    
                    h_color = get_theme_color(self.current_theme, curr_time, idx, 2)
                    
                    self.mp_draw.draw_landmarks(
                        bloom_layer, hand_lms, self.mp_hands.HAND_CONNECTIONS,
                        self.mp_draw.DrawingSpec(color=h_color, thickness=2, circle_radius=2),
                        self.mp_draw.DrawingSpec(color=h_color, thickness=2)
                    )
                    
                    for f_idx, tip in enumerate(FINGER_TIPS):
                        pt = lms[tip]
                        px, py = int(pt.x * w), int(pt.y * h)
                        tip_color = get_theme_color(self.current_theme, curr_time, f_idx, 5)
                        
                        cv2.circle(bloom_layer, (px, py), 6, (255, 255, 255), -1)
                        if random.random() > 0.6:
                            self.particles.append(Particle(px, py, tip_color))

                    thumb = lms[4]
                    index = lms[8]
                    dist = self.get_dist(thumb, index)
                    is_pinching = dist < 0.05
                    
                    if is_pinching:
                        is_any_pinching = True
                        if not self.last_pinch[idx]:
                            mx, my = int((thumb.x + index.x)/2 * w), int((thumb.y + index.y)/2 * h)
                            self.ripples.append(Ripple(mx, my, h_color))
                            self.audio.trigger_zap()
                    self.last_pinch[idx] = is_pinching
                
                num_hands = len(results.multi_hand_landmarks)
                spread_pct = int((total_fingers_up / (num_hands * 5)) * 100)
                
                if is_any_pinching:
                    gesture = "Pinch"
                elif total_fingers_up == 0:
                    gesture = "Fist"
                elif total_fingers_up == num_hands * 5:
                    gesture = "Open Hand"
                else:
                    gesture = f"{total_fingers_up} Fingers"
                
                self.prev_landmarks = [h.landmark for h in results.multi_hand_landmarks]
                
                if len(results.multi_hand_landmarks) == 2:
                    h1 = results.multi_hand_landmarks[0].landmark
                    h2 = results.multi_hand_landmarks[1].landmark
                    p1 = h1[8]
                    p2 = h2[8]
                    d = self.get_dist(p1, p2)
                    vol = max(0.01, 0.2 * (1 - min(d, 1.0)))
                    self.audio.play_hum(vol, 1.0)
                    
                    if d < 0.2:
                        p1x, p1y = int(p1.x*w), int(p1.y*h)
                        p2x, p2y = int(p2.x*w), int(p2.y*h)
                        mid_x = (p1x + p2x)//2 + random.randint(-30, 30)
                        mid_y = (p1y + p2y)//2 + random.randint(-30, 30)
                        cv2.line(bloom_layer, (p1x, p1y), (mid_x, mid_y), (255, 255, 255), 2)
                        cv2.line(bloom_layer, (mid_x, mid_y), (p2x, p2y), (255, 255, 255), 2)
                    
                    # Mandala drawing
                    all_tips = []
                    for h_lms in [h1, h2]:
                        for t in FINGER_TIPS:
                            all_tips.append((int(h_lms[t].x * w), int(h_lms[t].y * h)))
                    
                    if len(all_tips) == 10:
                        cx = sum(p[0] for p in all_tips) // 10
                        cy = sum(p[1] for p in all_tips) // 10
                        for i in range(10):
                            p1_m = all_tips[i]
                            p2_m = all_tips[(i + 3) % 10]
                            cv2.line(bloom_layer, p1_m, p2_m, (255, 255, 255, 50), 1)
                else:
                    self.audio.stop_hum()
            else:
                self.audio.stop_hum()
                self.hand_vel = 0
                spread_pct = 0
                gesture = "None"

            self.particles = [p for p in self.particles if p.update()]
            for p in self.particles: p.draw(bloom_layer)
            
            self.ripples = [r for r in self.ripples if r.update()]
            for r in self.ripples: r.draw(bloom_layer)

            bloom_blur = cv2.GaussianBlur(bloom_layer, (15, 15), 0)
            frame = cv2.addWeighted(frame, 1.0, bloom_blur, 0.8, 0)
            frame = cv2.addWeighted(frame, 1.0, bloom_layer, 1.0, 0)
            
            self.frame_count += 1
            if time.time() - self.last_fps_update > 1.0:
                self.fps = self.frame_count
                self.frame_count = 0
                self.last_fps_update = time.time()
            
            cv2.putText(frame, f"FPS: {self.fps}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 204), 2)
            cv2.putText(frame, f"Hands: {len(hands_data)}", (20, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 204), 2)
            cv2.putText(frame, f"Gesture: {gesture}", (20, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 204), 2)
            cv2.putText(frame, f"Spread: {spread_pct}%", (20, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 204), 2)
            cv2.putText(frame, f"Theme: {self.current_theme}", (20, 160), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 204), 2)
            cv2.putText(frame, "Press 'n' for Theme, 'q' to Quit", (20, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

            cv2.imshow('Neon Aura AR', frame)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('n'):
                self.theme_idx = (self.theme_idx + 1) % len(self.themes_list)
                self.current_theme = self.themes_list[self.theme_idx]

        self.cap.release()
        cv2.destroyAllWindows()
        pygame.quit()

if __name__ == "__main__":
    app = HandTrackerApp()
    app.run()
