export default class Emitter extends EventTarget {
	listeners = new Map();

	constructor() {
		super();
	}

	on(events, callback) {
		const wrappedCallback = (event) => {
			callback(...event.detail);
		};

		for (const event of events.split(/\s+/)) {
			if (!this.listeners.has(event)) {
				this.listeners.set(event, new Map());
			}

			const callbackMap = this.listeners.get(event);
			if (callbackMap.has(callback)) {
				return;
			}

			callbackMap.set(callback, wrappedCallback);
			this.addEventListener(event, wrappedCallback);
		}
	}

	off(events, callback) {
		if (events === '*') {
			events = Array.from(this.listeners.keys()).join(' ');
		}

		for (const event of events.split(/\s+/)) {
			const callbackMap = this.listeners.get(event);

			if (callbackMap) {
				if (callback) {
					if (callbackMap.has(callback)) {
						this.removeEventListener(event, callbackMap.get(callback));
						callbackMap.delete(callback);
					}
				} else {
					for (const [, wrappedCallback] of callbackMap) {
						this.removeEventListener(event, wrappedCallback);
					}

					this.listeners.delete(event);
				}
			}
		}
	}

	once(events, callback) {
		const wrappedCallback = (...args) => {
			callback(...args);
			this.off(events, wrappedCallback);
		};

		this.on(events, wrappedCallback);
	}

	trigger(event, ...args) {
		this.dispatchEvent(new CustomEvent(event, { detail: args }));
	}
}
