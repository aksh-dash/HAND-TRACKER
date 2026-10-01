import asyncio
import websockets
import json
import pyautogui

has_audio = False
has_brightness = False
try:
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
    from comtypes import CLSCTX_ALL
    has_audio = True
except ImportError:
    pass

try:
    import screen_brightness_control as sbc
    has_brightness = True
except ImportError:
    pass

async def handler(websocket):
    print("Client connected")
    async for message in websocket:
        try:
            data = json.loads(message)
            action = data.get('action')
            
            if action == 'volume' and has_audio:
                val = max(0.0, min(1.0, data.get('value', 0.5)))
                devices = AudioUtilities.GetSpeakers()
                interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
                volume = interface.QueryInterface(IAudioEndpointVolume)
                volume.SetMasterVolumeLevelScalar(val, None)
                
            elif action == 'brightness' and has_brightness:
                val = max(0, min(100, int(data.get('value', 50))))
                sbc.set_brightness(val)
                
            elif action == 'media':
                cmd = data.get('command')
                if cmd in ['nexttrack', 'prevtrack', 'playpause']:
                    pyautogui.press(cmd)
                    
            elif action == 'mouse_move':
                x, y = data.get('x'), data.get('y')
                sw, sh = pyautogui.size()
                pyautogui.moveTo(x * sw, y * sh, _pause=False)
                
            elif action == 'mouse_click':
                pyautogui.click()
                
            elif action == 'mouse_scroll':
                dy = data.get('dy', 0)
                pyautogui.scroll(int(dy))
                
            elif action == 'key':
                key = data.get('key')
                if key: pyautogui.press(key)

        except Exception as e:
            print(f"Error: {e}")

async def main():
    async with websockets.serve(handler, "localhost", 8765):
        print("WebSocket bridge running on ws://localhost:8765")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
