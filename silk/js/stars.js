
export class Starfield {
    constructor(container) {
        this.container = container;
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'stars-layer';
        this.ctx = this.canvas.getContext('2d');

        // Insert behind everything
        this.container.insertBefore(this.canvas, this.container.firstChild);

        this.stars = [];
        this.count = 200; // Hint of stars
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.init();
    }

    init() {
        this.resize();
        for (let i = 0; i < this.count; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 1.5 + 0.5,
                alpha: Math.random(),
                speed: Math.random() * 0.05 + 0.01 // Very slow moving
            });
        }
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    update() {
        // Clear with slight trail or just clear?
        // "Dark night black theme" -> Clear to black (or transparent if body is black)
        this.ctx.clearRect(0, 0, this.width, this.height);

        this.ctx.fillStyle = "#FFF";

        this.stars.forEach(star => {
            star.y -= star.speed;
            if (star.y < 0) star.y = this.height;

            // Twinkle
            star.alpha += (Math.random() - 0.5) * 0.02;
            if (star.alpha < 0.1) star.alpha = 0.1;
            if (star.alpha > 0.8) star.alpha = 0.8;

            this.ctx.globalAlpha = star.alpha;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
}
