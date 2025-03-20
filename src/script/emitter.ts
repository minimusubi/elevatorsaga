export type EventCallback<TEvents extends Record<string, unknown[]>, TEventName extends string> = (
	eventName: TEventName,
	...args: TEvents[TEventName]
) => void | Promise<void>;

interface NativeEventListener {
	(evt: CustomEvent): void;
}

export default class Emitter<TEvents extends Record<string, unknown[]> = Record<string, never>> {
	#eventTarget = new EventTarget();
	// Use a mapped type so each event key gets its own Map with the right callback type
	#listeners: { [K in Extract<keyof TEvents, string>]?: Map<EventCallback<TEvents, K>, NativeEventListener> } = {};

	#attachListener<TEventName extends Extract<keyof TEvents, string>>(
		eventName: TEventName,
		originalCallback: EventCallback<TEvents, TEventName>,
		wrappedCallback: NativeEventListener,
	) {
		if (!this.#listeners[eventName]) {
			this.#listeners[eventName] = new Map<EventCallback<TEvents, TEventName>, NativeEventListener>();
		}

		const callbackMap = this.#listeners[eventName]!;
		if (callbackMap.has(originalCallback)) {
			return;
		}

		callbackMap.set(originalCallback, wrappedCallback);
		this.#eventTarget.addEventListener(eventName, wrappedCallback as EventListener);
	}

	#on<TEventName extends Extract<keyof TEvents, string>>(
		eventName: TEventName,
		originalCallback: EventCallback<TEvents, TEventName>,
		preWrappedCallback: EventCallback<TEvents, TEventName> | null = null,
	) {
		const callable = preWrappedCallback ?? originalCallback;
		const wrappedCallback = (event: CustomEvent<TEvents[TEventName]>) => {
			void callable(event.type as TEventName, ...event.detail);
		};

		this.#attachListener(eventName, originalCallback, wrappedCallback);
	}

	on<TEventName extends Extract<keyof TEvents, string>>(
		eventName: TEventName,
		callback: EventCallback<TEvents, TEventName>,
	) {
		this.#on(eventName, callback);
	}

	#detachListener<TEventName extends Extract<keyof TEvents, string>>(
		eventNames: TEventName[],
		callback?: EventCallback<TEvents, TEventName>,
	) {
		for (const event of eventNames) {
			const callbackMap = this.#listeners[event];

			if (callbackMap) {
				if (callback) {
					if (callbackMap.has(callback)) {
						this.#eventTarget.removeEventListener(event, callbackMap.get(callback)! as EventListener);
						callbackMap.delete(callback);
					}
				} else {
					for (const [, wrappedCallback] of callbackMap) {
						this.#eventTarget.removeEventListener(event, wrappedCallback as EventListener);
					}

					this.#listeners[event] = undefined;
				}
			}
		}
	}

	off<TEventName extends Extract<keyof TEvents, string>>(
		eventName: TEventName | '*',
		callback?: EventCallback<TEvents, TEventName>,
	) {
		let events;

		if (eventName === '*') {
			events = Object.keys(this.#listeners) as TEventName[];
		} else {
			events = [eventName];
		}

		this.#detachListener(events, callback);
	}

	once<TEventName extends Extract<keyof TEvents, string>>(
		eventName: TEventName,
		callback: EventCallback<TEvents, TEventName>,
	) {
		const wrappedCallback: EventCallback<TEvents, TEventName> = (...args) => {
			void callback(...args);
			this.off(eventName, callback);
		};

		this.#on(eventName, callback, wrappedCallback);
	}

	trigger<TEventName extends Extract<keyof TEvents, string>>(eventName: TEventName, ...args: TEvents[TEventName]) {
		this.#eventTarget.dispatchEvent(new CustomEvent(eventName, { detail: args }));
	}
}
