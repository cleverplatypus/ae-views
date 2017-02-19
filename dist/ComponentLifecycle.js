'use strict';
		

const _private = new WeakMap();

export default class ComponentLifecycle {
	constructor(inSignal) {
		_private.set(this, {signal : inSignal});
	}

	rendered(inHandler) {
		_private.get(this).signal.add((inType) => {
			if(inType === 'rendered') {
				inHandler();
			}
		});
	}

	elementCreated(inHandler) {
		_private.get(this).signal.add((inType) => {
			if(inType === 'element-created') {
				inHandler();
			}
		});

	}

	elementAttached(inHandler) {
		_private.get(this).signal.add((inType) => {
			if(inType === 'element-attached') {
				inHandler();
			}
		});

	}

	elementDetached(inHandler) {
		_private.get(this).signal.add((inType) => {
			if(inType === 'element-detached') {
				inHandler();
			}
		});

	}

	emit(inType) {
		_private.get(this).signal.dispatch(inType);
	}
}
