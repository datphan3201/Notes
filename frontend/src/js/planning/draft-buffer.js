export class DraftBuffer {
    constructor() {
        this.version = null;
        this.saved = {};
        this.values = {};
    }

    get dirty() {
        return JSON.stringify(this.values) !== JSON.stringify(this.saved);
    }

    receive(values, version, { keepDraft = false } = {}) {
        if (this.version !== null && (version === null || version < this.version)) return false;
        if (this.dirty && !keepDraft) return false;
        this.version = version;
        this.saved = { ...values };
        if (!keepDraft) this.values = { ...values };
        return true;
    }

    freeze() {
        return { base_version: this.version, ...this.values };
    }

    acknowledge(values, version, submitted) {
        const unchanged = JSON.stringify(this.values) === JSON.stringify(submitted);
        this.version = version;
        this.saved = { ...values };
        if (unchanged) this.values = { ...values };
    }
}
