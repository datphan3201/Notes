export class LatestRequest {
    constructor({ controllerFactory = () => new AbortController() } = {}) {
        this.controllerFactory = controllerFactory;
        this.sequence = 0;
        this.controller = null;
    }

    begin() {
        this.controller?.abort();
        this.controller = this.controllerFactory();

        return {
            sequence: ++this.sequence,
            signal: this.controller.signal,
        };
    }

    isCurrent(ticket) {
        return ticket.sequence === this.sequence;
    }

    shouldIgnore(ticket, error) {
        // An obsolete response is never allowed to replace a newer query.
        // Aborted fetches are represented by the shared HTTP layer as status 0.
        return (
            !this.isCurrent(ticket) ||
            (ticket.signal.aborted && error?.code === 'NETWORK_ERROR' && error?.status === 0)
        );
    }
}

export class DebouncedAction {
    constructor({ delay, setTimeout, clearTimeout }) {
        this.delay = delay;
        // Firefox requires Window timer methods to keep their receiver. The
        // wrappers also leave deterministic clock injection available to tests.
        this.setTimeout = setTimeout || ((callback, wait) => globalThis.setTimeout(callback, wait));
        this.clearTimeout = clearTimeout || ((timer) => globalThis.clearTimeout(timer));
        this.timer = null;
    }

    schedule(callback) {
        this.cancel();
        this.timer = this.setTimeout(() => {
            this.timer = null;
            callback();
        }, this.delay);
    }

    cancel() {
        if (this.timer !== null) this.clearTimeout(this.timer);
        this.timer = null;
    }
}
