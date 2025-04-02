export class EmitterEvent<TTarget, TType> {
	// @ts-expect-error This is defined using Object.defineProperties
	readonly target;
	// @ts-expect-error This is defined using Object.defineProperties
	readonly type;

	constructor(target: TTarget, type: TType) {
		Object.defineProperties(this, {
			target: { configurable: false, enumerable: true, value: target, writable: false },
			type: { configurable: false, enumerable: true, value: type, writable: false },
		});
	}
}

export type EventCallback<TEmitter, TEvents extends Record<string, unknown[]>, TEventName extends string> = (
	event: EmitterEvent<TEmitter, TEventName>,
	...args: TEvents[TEventName]
) => void | Promise<void>;

interface NativeEventListener {
	(evt: CustomEvent): void;
}

interface EventDetail<
	TEmitter,
	TEvents extends Record<string, unknown[]>,
	TEventName extends Extract<keyof TEvents, string>,
> {
	event: EmitterEvent<TEmitter, TEventName>;
	args: TEvents[TEventName];
	errorHandler?: (error: unknown) => void | Promise<void>;
}

export default class Emitter<TEvents extends Record<string, unknown[]> = Record<string, never>> {
	#eventTarget = new EventTarget();
	// Use a mapped type so each event key gets its own Map with the right callback type
	#listeners: { [K in Extract<keyof TEvents, string>]?: Map<EventCallback<this, TEvents, K>, NativeEventListener> } =
		{};

	#attachListener<TEventName extends Extract<keyof TEvents, string>>(
		eventName: TEventName,
		originalCallback: EventCallback<this, TEvents, TEventName>,
		wrappedCallback: NativeEventListener,
	) {
		if (!this.#listeners[eventName]) {
			this.#listeners[eventName] = new Map<EventCallback<this, TEvents, TEventName>, NativeEventListener>();
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
		originalCallback: EventCallback<this, TEvents, TEventName>,
		preWrappedCallback: EventCallback<this, TEvents, TEventName> | null = null,
	) {
		const callable = preWrappedCallback ?? originalCallback;
		const wrappedCallback = (event: CustomEvent<EventDetail<this, TEvents, TEventName>>) => {
			if (event.detail.errorHandler) {
				try {
					void callable(event.detail.event, ...event.detail.args);
				} catch (error) {
					void event.detail.errorHandler(error);
				}
			} else {
				void callable(event.detail.event, ...event.detail.args);
			}
		};

		this.#attachListener(eventName, originalCallback, wrappedCallback);
	}

	on<TEventName extends Extract<keyof TEvents, string>>(
		eventName: TEventName,
		callback: EventCallback<this, TEvents, TEventName>,
	) {
		this.#on(eventName, callback);
	}

	#detachListener<TEventName extends Extract<keyof TEvents, string>>(
		eventNames: TEventName[],
		callback?: EventCallback<this, TEvents, TEventName>,
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
		callback?: EventCallback<this, TEvents, TEventName>,
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
		callback: EventCallback<this, TEvents, TEventName>,
	) {
		const wrappedCallback: EventCallback<this, TEvents, TEventName> = (...args) => {
			void callback(...args);
			this.off(eventName, callback);
		};

		this.#on(eventName, callback, wrappedCallback);
	}

	#dispatchEvent<TEventName extends Extract<keyof TEvents, string>>(
		eventName: TEventName,
		args: TEvents[TEventName],
		details: Partial<Omit<EventDetail<never, never, never>, 'event' | 'args'>> = {},
	) {
		this.#eventTarget.dispatchEvent(
			new CustomEvent(eventName, { detail: { event: new EmitterEvent(this, eventName), args, ...details } }),
		);
	}

	trigger<TEventName extends Extract<keyof TEvents, string>>(eventName: TEventName, ...args: TEvents[TEventName]) {
		this.#dispatchEvent(eventName, args);
	}

	triggerSafe<TEventName extends Extract<keyof TEvents, string>>(
		eventName: TEventName,
		errorHandler: (error: unknown) => void | Promise<void>,
		...args: TEvents[TEventName]
	) {
		this.#dispatchEvent(eventName, args, { errorHandler });
	}
}
