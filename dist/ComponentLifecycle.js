'use strict';
		

const _private = new WeakMap();

module.exports =  class ComponentLifecycle {
	constructor(inSignal) {
		_private.set(this, {signal : inSignal, renderCount : 0});
	}

	rendered(inHandler) {
		_private.get(this).signal.add((inType) => {
			if(inType === 'rendered') {
				inHandler(++_private.get(this).renderCount);
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
