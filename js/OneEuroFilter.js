export class OneEuroFilter {
    constructor(minCutoff = 1.0, beta = 0.0) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = 1.0;
        this.xPrev = null;
        this.dxPrev = null;
        this.tPrev = null;
    }
    
    alpha(cutoff, dt) {
        const tau = 1.0 / (2.0 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / dt);
    }
    
    // Filters an array of values (e.g. flattened coordinates)
    filter(x, t) {
        if (this.xPrev === null) {
            this.xPrev = [...x];
            this.dxPrev = new Array(x.length).fill(0);
            this.tPrev = t;
            return x;
        }
        
        const dt = t - this.tPrev;
        if (dt <= 0) return x;
        
        const dx = [];
        for (let i = 0; i < x.length; i++) {
            dx.push((x[i] - this.xPrev[i]) / dt);
        }
        
        const edx = [];
        const alphaD = this.alpha(this.dCutoff, dt);
        for (let i = 0; i < x.length; i++) {
            edx.push(this.dxPrev[i] + alphaD * (dx[i] - this.dxPrev[i]));
        }
        
        const cutoff = [];
        for (let i = 0; i < x.length; i++) {
            cutoff.push(this.minCutoff + this.beta * Math.abs(edx[i]));
        }
        
        const xFiltered = [];
        for (let i = 0; i < x.length; i++) {
            const a = this.alpha(cutoff[i], dt);
            xFiltered.push(this.xPrev[i] + a * (x[i] - this.xPrev[i]));
        }
        
        this.xPrev = xFiltered;
        this.dxPrev = edx;
        this.tPrev = t;
        
        return xFiltered;
    }
}
