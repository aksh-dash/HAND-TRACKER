export class Bridge {
    constructor() {
        this.ws = new WebSocket("ws://localhost:8765");
        this.connected = false;
        this.ws.onopen = () => { 
            this.connected = true; 
            const el = document.getElementById('ui-bridge');
            if(el) { el.innerText = 'Connected'; el.style.color = '#00ffcc'; }
        };
        this.ws.onclose = () => { 
            this.connected = false; 
            const el = document.getElementById('ui-bridge');
            if(el) { el.innerText = 'Disconnected'; el.style.color = 'red'; }
        };
        this.ws.onerror = () => { this.connected = false; };
    }
    send(data) {
        if (this.connected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
}
export const bridge = new Bridge();
