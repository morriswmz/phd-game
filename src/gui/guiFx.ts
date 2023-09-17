import { GuiBase } from './guiBase';

/**
 * Simple particle wrapper.
 * TODO: implement a particle pool.
 */
class Particle {

    private _el: HTMLDivElement;

    x: number = 0;
    y: number = 0;
    vx: number = 0;
    vy: number = 0;
    ax: number = 0;
    ay: number = 0;
    active: boolean = true;

    constructor(className: string) {
        this._el = document.createElement('div');
        this._el.className = className;
    }

    get element(): HTMLDivElement {
        return this._el;
    }

    addToScene(scene: HTMLElement): void {
        scene.appendChild(this._el);
    }

    removeFromScene(scene: HTMLElement): void {
        scene.removeChild(this._el);
    }

    updatePosition(stepSize: number): void {
        if (!this.active) return;
        this.vx += this.ax * stepSize;
        this.vy += this.ay * stepSize;
        this.x += (this.vx + 0.5 * this.ax * stepSize) * stepSize;
        this.y += (this.vy + 0.5 * this.ay * stepSize) * stepSize;
        this._el.style.top = this.y + 'px';
        this._el.style.left = this.x + 'px';
    }

}

export class GuiFX extends GuiBase<HTMLDivElement> {
    
    confetti(): void {
        // Generate random sized divs
        const colors = ['#f00', '#0f0', '#00f', '#ff0', '#0ff', '#f0f', '#000', '#fff'];
        let particles: Particle[] = [];
        let viewPortWidth = this._container.offsetWidth;
        let viewPortHeight = document.body.offsetHeight;
        let nActive = Math.max(30, Math.ceil(viewPortWidth / 20));
        let lastTimestamp: number | null = null;
        for (let i = 0;i < nActive;i++) {
            let p = new Particle('particle_confetti');
            p.x = Math.random() * viewPortWidth;
            p.y = - 10 - Math.random() * 300;
            p.vy = Math.random() * 2;
            p.ay = 8 / 60;
            p.element.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            p.element.style.width = Math.floor(Math.random() * 6 + 4) + 'px';
            p.element.style.height = p.element.style.width;
            p.addToScene(this._container);
            particles.push(p);
        }
        const animate: FrameRequestCallback = (timestamp) => {
            if (!lastTimestamp) {
                lastTimestamp = timestamp;
            }
            // 60 UPS
            let stepSize = (timestamp - lastTimestamp) / (1000 / 60);
            lastTimestamp = timestamp;
            for (let p of particles) {
                p.updatePosition(stepSize);
                if (p.active && p.y > viewPortHeight * 1.5) {
                    p.active = false;
                    p.removeFromScene(this._container);
                    nActive--;
                }
            }
            if (nActive > 0) {
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }

}