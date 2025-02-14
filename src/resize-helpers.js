const ResizeHelper = {
    isResizing: false,
    lastDownX: 0,
    minWidth: 0,

    init(panelId, handleSelector) {
        this.panel = document.getElementById(panelId);
        this.handle = document.querySelector(handleSelector);
        this.minWidth = parseFloat(getComputedStyle(this.panel).minWidth);

        this.handle.addEventListener('mousedown', (e) => this.startResize(e));
    },

    startResize(e) {
        this.isResizing = true;
        this.lastDownX = e.clientX;

        document.addEventListener('mousemove', (e) => this.resizePanel(e));
        document.addEventListener('mouseup', () => this.stopResize());
    },

    resizePanel(e) {
        if (!this.isResizing) return;

        const deltaX = e.clientX - this.lastDownX;
        const newWidth = this.panel.offsetWidth - deltaX;

        if (newWidth >= this.minWidth) {
            this.panel.style.width = `${newWidth}px`;
        }

        this.lastDownX = e.clientX;
    },

    stopResize() {
        this.isResizing = false;
        document.removeEventListener('mousemove', (e) => this.resizePanel(e));
        document.removeEventListener('mouseup', () => this.stopResize());
    }
};

export default ResizeHelper;
