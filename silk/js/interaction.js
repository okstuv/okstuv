export class Interaction {
    constructor(domElement) {
        this.dom = domElement;

        this.mouse = { x: 0, y: 0 }; // Screen Pixels
        this.ndc = { x: 0, y: 0 };   // Normalized Device Coords (-1 to 1)
        this.velocity = { x: 0, y: 0 };
        this.active = false;
        this.speed = 0;

        this.init();
    }

    init() {
        const onMove = (x, y) => {
            // Guard: Invalid Input
            if (isNaN(x) || isNaN(y)) return;

            // Update Velocity
            const now = performance.now();
            // Calculate speed (simple diff)
            const dx = x - this.mouse.x;
            const dy = y - this.mouse.y;

            this.velocity.x = dx;
            this.velocity.y = dy;

            const dist = Math.sqrt(dx * dx + dy * dy);
            this.speed = isNaN(dist) ? 0 : dist;

            this.mouse.x = x;
            this.mouse.y = y;

            // Update NDC
            const aspect = window.innerWidth / window.innerHeight;
            let ndcX = (x / window.innerWidth) * 2 - 1;
            let ndcY = -(y / window.innerHeight) * 2 + 1;

            if (isNaN(ndcX)) ndcX = 0;
            if (isNaN(ndcY)) ndcY = 0;

            this.ndc.x = ndcX;
            this.ndc.y = ndcY;

            this.lastMove = now;
        };

        // Helper to check if we clicked a UI element
        const isUI = (e) => {
            return e.target.closest('.controls-panel') || e.target.closest('.header');
        };

        window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));

        window.addEventListener('mousedown', (e) => {
            if (isUI(e)) return; // Ignore UI clicks
            this.active = true;
        });

        window.addEventListener('mouseup', () => {
            this.active = false;
        });

        // Touch
        window.addEventListener('touchstart', (e) => {
            if (isUI(e)) return; // Ignore UI touches
            this.active = true;
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        window.addEventListener('touchmove', (e) => {
            // e.preventDefault(); // Prevent scrolling?
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true }); // passive true for scroll perf, but maybe false if we want to block scroll
        window.addEventListener('touchend', () => this.active = false);

        // Idle detection removal - "Active" is now purely explicit (click)
        // Auto-drift will happen when !active
    }

    resize(w, h) {
        // Recalculate NDC if needed (usually handled in onMove)
    }

    update() {
        return {
            ndc: this.ndc,
            velocity: this.velocity,
            speed: this.speed, // Scaled down reasonable val
            active: this.active
        };
    }
}
