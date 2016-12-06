import has from 'lodash.has';
import find from 'lodash.find';
import each from 'lodash.foreach';
import isPlainObject from 'lodash.isPlainObject';
import keys from 'lodash.keys';
import isString from 'lodash.isString';
import get from 'lodash.get';
import isArray from 'lodash.isArray';
import map from 'lodash.map';
import { Signal } from 'signals';
import isFunction from 'lodash.isFunction';
import $ from 'jquery';
import transform from 'lodash.transform';
import includes from 'lodash.includes';
import uuid from 'node-uuid';
import keycode from 'keycode';
import LiteUrl from 'lite-url';
import dust from 'ae-dustjs';
import 'lodash.result';
import isFunction$1 from 'lodash.isfunction';
import 'lodash.merge';
import mergeWith from 'lodash.mergeWith';

var root = window;

var defer;
var Observer;
if (root.process && typeof root.process.nextTick === 'function') {
    /* avoid buggy nodejs setImmediate */
    if (root.setImmediate && root.process.versions.node.split('.')[1] > '10') {
        defer = root.setImmediate;
    } else {
        defer = root.process.nextTick;
    }
} else if (root.vertx && typeof root.vertx.runOnLoop === 'function') {
    defer = root.vertx.RunOnLoop;
} else if (root.vertx && typeof root.vertx.runOnContext === 'function') {
    defer = root.vertx.runOnContext;
} else if ((Observer = root.MutationObserver || root.WebKitMutationObserver)) {
    defer = (function(document, Observer, drain) {
        var el = document.createElement('div');
        new Observer(drain).observe(el, {
            attributes: true
        });
        return function() {
            el.setAttribute('x', 'y');
        };
    }(document, Observer, drain));
} else if (typeof root.setTimeout === 'function' && (root.ActiveXObject || !root.postMessage)) {
    /* use setTimeout to avoid buggy IE MessageChannel */
    defer = function(f) {
        root.setTimeout(f, 0);
    };
} else if (root.MessageChannel && typeof root.MessageChannel === 'function') {
    var fifo = [],
        channel = new root.MessageChannel();
    channel.port1.onmessage = function() {
        (fifo.shift())();
    };
    defer = function(f) {
        fifo[fifo.length] = f;
        channel.port2.postMessage(0);
    };
} else if (typeof root.setTimeout === 'function') {
    defer = function(f) {
        root.setTimeout(f, 0);
    };
} else {
    throw new Error('no candidate for defer');
}

let queue = [];
let length = 0;
//jshint ignore:line

function microtask(func, args, ctx, err) {
    if (!length) {
        defer(drain);
    }

    queue[length++] = [func, args, ctx, err];
}

function drain() {
    var q = queue,
        l = length;

    queue = [];
    length = 0;

    for (var i = 0; i < l; i++) {
        try {
            q[i][0].apply(q[i][2], q[i][1]);
        } catch (err) {
            if (typeof q[i][3] === 'function') {
                q[i][3](err);
            } else {
                throw err;
            }
        }
    }
}

const _queue = new Map();
let _willNotify = false;

const _private$2 = new WeakMap();

const _emit = function() {
    for (let f of _queue.keys()) {
        let info = _queue.get(f);
        for (let i of info) {
            f(i.path, i.changes);
        }
    }
    _queue.clear();
    _willNotify = false;
};

class Observer$1 {
    constructor(inParent) {
        _private$2.set(this, {
            parent: inParent,
            listeners: new Set(),
            childrenListeners: new Set(),
            descendantListeners: new Set(),
            children: {}
        });
    }


    unlisten(inListenerFn, inPath) {
        const _p = _private$2.get(this);
        for(let listener of _p.listeners) {
            if(listener.handler === inListenerFn) {
                _p.listeners.delete(listener);
            }
        }
        for(let listener of _p.childrenListeners) {
            if(listener.handler === inListenerFn) {
                _p.childrenListeners.delete(listener);
            }
        }
        for(let listener of _p.descendantListeners) {
            if(listener.handler === inListenerFn) {
                _p.descendantListeners.delete(listener);
            }
        }
        each(_p.children, (inChildObserver) => {
            inChildObserver.unlisten(inListenerFn, inPath);
        });
    }

    hasListeners() {
        const _p = _private$2.get(this);
        return _p.listeners.size > 0 || _p.childrenListeners.size > 0 || _p.descendantListeners.size > 0;
    }

    listen(inPath, inListener) {
        if (!inPath) {
            return;
        }
        const _p = _private$2.get(this);
        const segs = inPath ? inPath.split('.') : [];
        const propName = segs.shift();
        if (/^\w+$/.test(propName)) {
            _p.children[propName] = _p.children[propName] || new Observer$1(this);
            if (segs.length) {
                _p.children[propName].listen(segs.join('.'), inListener);
            } else {
                _p.listeners.add({ handler : function(inNotifiedPath, inChanges) {
                    if (inNotifiedPath === inPath) {
                        inListener(inNotifiedPath, inChanges);
                    }
                }});
                _private$2.get(_p.children[propName]).listeners.add({ handler : inListener});
            }
        } else if (propName === '*') {
            //_p.childrenListeners.add(inListener);
            _p.listeners.add({handler : inListener});

        } else if (propName === '**') {
            _p.descendantListeners.add({handler : inListener});
            // _p.listeners.add(inListener);
        } else if( /\[\w+\]/.test(propName)) {
            _p.listeners.add({handler : (inPath, inChanges) => {
                if(inPath === propName.replace(/\W/g, '')) {
                    inListener(inPath, inChanges);
                }
            }});
        }
    }

    notify(inPath, inChanges) {
        const _p = _private$2.get(this);
        const segs = inPath ? inPath.split('.') : [];
        const propName = segs.shift();
        let shouldTrigger = false;
        const pushQueue = function(fn) {
            if (!_queue.has(fn)) {
                _queue.set(fn, []);
            }
            if(find(_queue.get(fn), { path : inPath})) {
                return;
            }
            _queue.get(fn).push({ path: inPath, changes: inChanges });
        };
        if (propName) {
            if (has(_p.children, propName) && segs.length) {
                _p.children[propName].notify(segs.join('.'), inChanges);
            }
            if (!segs.length) {
                shouldTrigger = shouldTrigger || _p.listeners.size;
                for (let l of _p.listeners) {
                    pushQueue(l.handler);
                }
            }
            shouldTrigger = shouldTrigger || _p.childrenListeners.size;
            for (let l of _p.childrenListeners) {
                pushQueue(l.handler);
            }
            shouldTrigger = shouldTrigger || _p.descendantListeners.size;
            for (let l of _p.descendantListeners) {
                pushQueue(l.handler);
            }
        } else {
            shouldTrigger = shouldTrigger || _p.listeners.size;
            for (let l of _p.listeners) {
                pushQueue(l.handler);
            }
        }

        if (!_willNotify && shouldTrigger) {
            microtask(_emit, [inPath, inChanges]);
            _willNotify = true;
        }

    }

    bubble(path, changes) {

    }

    static target(base, path, changes) {

    }
}

const _private$1 = new WeakMap();


class Dummy {
    constructor(inIsCollection) {
        this._obj = inIsCollection ? [] : {};
        _private$1.set(this, {

        });
    }
    prop(inName, inValue) {
        if (inValue !== undefined) {
            this._obj[inName] = inValue;
        } else {
            return this._obj[inName];
        }
    }
}

class ObservableObject {

    constructor(inConfig) {
        const isCollection = (get(inConfig, 'isCollection') === true);
        _private$1.set(this, {
            isSilent: false,
            isCollection: isCollection,
            changesQueue: [],
            observer: new Observer$1(),
            props: new Dummy(isCollection),
            setProp: function(inPath, inValue, inBackPath, inAlreadyFoundChange) {
                const _p = _private$1.get(this);

                const path = !isNaN(inPath) ? [inPath] : inPath.split('.');
                var localProp = path.shift();

                inBackPath = inBackPath || [];
                inBackPath.push(localProp);
                let out;

                let val = _p.props.prop(localProp);

                if (!path.length) {
                    if(_p.props.prop(localProp) === inValue) {
                        return;
                    }
                    _p.props.prop(localProp, ObservableObject.fromObject(inValue));
                    if (_p.observer.hasListeners()) {

                        _p.changesQueue.push({
                            path: localProp,
                            change: {
                                type: val === undefined ? 'add' : 'replace',
                                oldValue: val,
                                newValue: _p.props.prop(localProp)
                            }

                        });
                        ObservableObject.notifyWatchers(_p);
                    }
                    return inAlreadyFoundChange ? null : {
                        path: inBackPath.join('.'),
                        change: {
                            type: val === undefined ? 'add' : 'replace',
                            oldValue: val,
                            newValue: _p.props.prop(localProp)
                        }
                    };
                } else {
                    let alreadyFound = false;
                    if (val === undefined || val === null) {
                        val = new ObservableObject();
                        _p.props.prop(localProp, val);
                        _p.changesQueue.push({
                            path: path.join('.'),
                            change: {
                                type: 'add',
                                oldValue: undefined,
                                newValue: _p.props.prop(localProp)
                            }

                        });
                        ObservableObject.notifyWatchers(_p);
                        out = inAlreadyFoundChange ? null : {
                            path: inBackPath.join('.'),
                            change: {
                                type: 'add',
                                oldValue: undefined,
                                newValue: _p.props.prop(localProp)
                            }
                        };
                        alreadyFound = true;
                    }
                    let result = _private$1.get(val).setProp(path.join('.'), inValue, inBackPath, alreadyFound);
                    return (result ? result : out);
                }
            }.bind(this)
        });

    }

    * [Symbol.iterator]() {
        const src = _private$1.get(this).props._obj;
        if (this.isCollection) {
            for (var item of src) {
                yield item;
            }
        } else {
            for (let key in src) {
                const out = {};
                out[key] = src[key];
                yield out;
            }
        }
    }


    fill(inData, inPath, inSilent) {
        const _p = _private$1.get(this);
        if (!inPath) {
            _p.props._obj = this.isCollection ? [] : {};
        } else if (this.prop(inPath) instanceof ObservableObject) {
            this.prop(inPath).empty();
        }

        if (keys(inData).length) {
            this.merge(inData, inPath, inSilent);
        } else {
            if (!inSilent) {
                _p.changesQueue.push({
                    path: '',
                    change: {
                        type: 'emptied',
                        newValue: _p.props._obj
                    }
                });
                ObservableObject.notifyWatchers(_p);
            }
        }


    }

    merge(inData, inPath, inSilent) {

        if (!isPlainObject(inData) && !isArray(inData)) {
            throw new Error('ObservableObject.fill() must be passed a plain object');
        }
        each(inData, (inValue, inKey) => {
            const path = (inPath ? inPath + '.' : '') + inKey;
            this.prop(path, ObservableObject.fromObject(inValue), inSilent);
        });
    }

    static fromObject(inData) {
        if (isArray(inData)) {
            let a = new ObservableObject({
                isCollection: true
            });
            each(inData, function(inVal, inKey) {
                a.prop(inKey, ObservableObject.fromObject(inVal));
            });
            return a;
        } else if (isPlainObject(inData)) {
            let o = new ObservableObject();
            each(inData, function(inVal, inKey) {
                o.prop(inKey, ObservableObject.fromObject(inVal));
            });
            return o;
        } else {
            return inData;
        }
    }

    static prop(inBase, inPath) {
        if (!inBase) {
            return;
        }
        if (!(inBase instanceof ObservableObject)) {
            return;
        }
        return inBase.prop(inPath);
    }

    dummy() {
        return _private$1.get(this);
    }

    get isCollection() {
        return _private$1.get(this).isCollection;
    }

    get length() {
        const _p = _private$1.get(this);
        if (_p.isCollection) {
            return keys(_p.props._obj).length;
        }
        return undefined;
    }

    prop(inPath, inValue, inSilent) { //jshint ignore:line
        if (inPath !== 0 && !inPath) { //path can be an index. !inPath would ignore zero as a property
            return this;
        }
        const _p = _private$1.get(this);
        const myProps = _p.props;
        const path = !isNaN(inPath) ? [inPath] : inPath.split('.');
        var propName = path.shift();
        if (_p.isCollection && isNaN(propName) && propName !== 'length') {
            throw new Error('Collection ObservableObject can only have numbers as keys');
        } else if (_p.isCollection) {
            propName = !isNaN(propName) ? parseInt(propName) : propName;
            if (isNaN(propName)) {
                return this.length;
            }
        }
        if (inValue === undefined) {
            if (myProps.prop(propName) === undefined) {
                return undefined;
            } else {
                if (path.length && !(myProps.prop(propName) instanceof ObservableObject)) {
                    console.warn('trying to access path through a non traversable property');
                    return undefined;
                } else if (path.length) {
                    return myProps.prop(propName).prop(path.join('.'));
                }
                return myProps.prop(propName);
            }
        } else {
            const branch = [];
            var change = _p.setProp(inPath, inValue, branch);
            if(!change) {
                return inValue;
            }
            if (!inSilent) {
                _p.changesQueue.push(change);
                ObservableObject.notifyWatchers(_p);
            }
            return inValue;
        }
    }


    //TODO: implement event-specific watch
    watch(inPath, inHandler, inEvent) {
        const _p = _private$1.get(this);
        _p.observer.listen(inPath, inHandler, inEvent);
    }

    unwatch(inHandler, inPath) {
        const _p = _private$1.get(this);
        _p.observer.unlisten(inHandler, inPath);
    }

    toNative(inDeep) {
        var out = _private$1.get(this).isCollection ? [] : {};
        each(_private$1.get(this).props._obj, (inVal, inKey) => {
            let isObservable = inVal instanceof ObservableObject;
            out[inKey] = isObservable && inDeep === true ? inVal.toNative(true) : inVal;
        });
        return out;
    }

    sort(inComparator) {
        if (_private$1.get(this).isCollection) {
            _private$1.get(this).props._obj.sort(inComparator);
        }
        return this;
    }

    static notifyWatchers(inInstance) {
        if (inInstance.isSilent) {
            return;
        }
        for (let c of inInstance.changesQueue) {
            inInstance.observer.notify(c.path, c.change);
        }
        inInstance.changesQueue = [];

    }

    static fill(inTarget, inPath, inContent, inSilent) {
        if (!inTarget || !(inTarget instanceof ObservableObject)) {
            throw new Error('fill() can only be invoked on an ObservableObject');
        }
        if (!inTarget || !(inTarget instanceof ObservableObject)) {
            throw new Error('Cannot resolve ObservableObject to fill');
        }

        inTarget.fill(inContent, inPath, inSilent);
        const _p = _private$1.get(inTarget);
        if (!inSilent) {
            _p.changesQueue.push({
                path: inPath,
                change: {
                    type: 'filled',
                    newValue: inContent
                }
            });
            ObservableObject.notifyWatchers(_p);
        }
    }

    static merge(inTarget, inPath, inContent, inSilent) {
        if (!inTarget || !(inTarget instanceof ObservableObject)) {
            throw new Error('merge () can only be invoked on an ObservableObject');
        }

        if (!inTarget || !(inTarget instanceof ObservableObject)) {
            throw new Error('Cannot resolve ObservableObject to merge');
        }

        inTarget.merge(inContent, inPath);
        const _p = _private$1.get(inTarget);
        if (!inSilent) {
            _p.changesQueue.push({
                path: inPath,
                change: {
                    type: 'merged',
                    newValue: inContent
                }
            });
            ObservableObject.notifyWatchers(_p);
        }

    }


    empty(inSilent) {
        this.fill(null, inSilent);
    }
}
window.ObservableObject = ObservableObject;

class ComponentModel extends ObservableObject {
	constructor(inInitObj) {
		super();

		if(has(inInitObj, 'data')) {
			this.fill(inInitObj);
		} else {
			this.fill({ data : inInitObj});
		}
	}

	data(inPath, inData) {
		const path = 'data' + (inPath ? '.' + inPath : '');
		return this.prop(path, inData);
	}
}

const _private$3 = new WeakMap();

class State {
	constructor(...rest) {	
		let name = find(rest, (param) => isString(param)) || '';
		let children = find(rest, (param) => isArray(param));
		let parent = find(rest, (param) => param instanceof State);

		children = map(children, (inValue) => {
			const state = (inValue instanceof State ? inValue : new State(inValue));
			_private$3.get(state).parent = this;
			return state;
		});

		_private$3.set(this, {
			name : name,
			children : children,
			parent : parent
		});
		this.name = name;
		this.children = children;
	}

	getPath() {
		const parent =  _private$3.get(this).parent;
		return (parent && parent.getName() ? parent.getPath() + '.' : '') + _private$3.get(this).name;
	}


	getName() {
		return _private$3.get(this).name;
	}

	child(inName) {
		return find(_private$3.get(this).children, (inChild) => inChild.getName() === inName);
	}

	resolve(inPath) {
		if(!inPath) {
			return;
		}
		const segs = inPath.split('.');
		const child = this.child(segs.shift());
		if(!child) {
			return;
		} else if(segs.length) {
			return child.resolve(segs.join('.'));
		} else {
			return child;
		}
	}

	exposed() {
		this.exposed = true;
		return this;
	}

	onLeaving(inFn) {
		this.leaving = inFn;
		return this;
	}

	leaving() {
		return Promise.resolve();
	}

	onLeft(inFn) {
		this.left = inFn;
		return this;
	}

	left() {

	}

	onRendered(inFn) {
		this.rendered = inFn;
		return this;
	}

	onEntering(inFn) {
		this.entering = inFn;
		return this;
	}

	entering() {
		return Promise.resolve();
	}

	onEntered(inFn) {
		this.entered = inFn;
		return this;
	}

	rendered() {

	}
	

	entered() {

	}

	didntLeave() {

	}

	matches(inPattern) {
		return (!inPattern && !_private$3.get(this).name) ||
			(new RegExp(inPattern)).test(_private$3.get(this).name);
	}
}

class Bus {

    constructor(inComponent) {
        this.component = () => inComponent;
        this.signals = {};
    }

    publishAction(inName, inHandler) {
        this.component().page.bus.addAction(inName, inHandler);
    }

    bubbleAction(inName, ...rest) {
        const parentBus = get(this.component().parent(), 'bus');
        if (!parentBus) {
            console.warn(`Cannot bubble action "${inName}" from page`);
            return;
        }
        parentBus.triggerAction.apply(parentBus, [inName].concat(rest));
    }

    bubble() {
        this.shouldBubbleCurrent = true;
    }

    triggerAction(inName, inParams, ...rest) {
        inParams = inParams || {};
        if (this.signals[inName]) {
            this.signals[inName].dispatch.apply(null, [inParams].concat(rest));
        }

        if (!this.signals[inName] || this.shouldBubbleCurrent) {
            rest.unshift(inParams);
            rest.unshift(inName);
            this.shouldBubbleCurrent = false;
            this.bubbleAction.apply(this, rest);
        }

    }

    addAction(inName, inHandler, inOnce) {
        if (this.signals[inName]) {
            this.signals[inName].dispose();
            console.warn('action ' + inName + ' was overridden');
        }
        this.signals[inName] = new Signal();
        if (inHandler) {
            this.signals[inName]['add' + (inOnce ? 'Once' : '')](inHandler);
        }
    }

    onceAction(inName, inHandler) {
        //TODO: to be implemented
    }

    onAction(inName, inHandler, inOnce) {
        if (!this.signals[inName]) {
            const parentBus = get(this.component().parent(), 'bus');
            if (parentBus) {
                parentBus.onAction(inName, inHandler, inOnce);
            } else {
                this.addAction(inName, inHandler, inOnce);
                // console.warn('Possibly registering listener to non existing action: ' + inName);
                // console.warn('You might want to use addAction or publishAction');
            }
        } else {
            this.signals[inName]['add' + (inOnce ? 'Once' : '')](inHandler);
        }
    }

    offAction(inName, inHandler) {
        //TODO: to be implemented
    }
}

const _private$6 = new WeakMap();

class ComponentLifecycle {
	constructor(inSignal) {
		_private$6.set(this, {signal : inSignal});
	}

	rendered(inHandler) {
		_private$6.get(this).signal.add((inType) => {
			if(inType === 'rendered') {
				inHandler();
			}
		});
	}

	elementCreated(inHandler) {
		_private$6.get(this).signal.add((inType) => {
			if(inType === 'element-created') {
				inHandler();
			}
		});

	}

	elementAttached(inHandler) {
		_private$6.get(this).signal.add((inType) => {
			if(inType === 'element-attached') {
				inHandler();
			}
		});

	}

	elementDetached(inHandler) {
		_private$6.get(this).signal.add((inType) => {
			if(inType === 'element-detached') {
				inHandler();
			}
		});

	}

	emit(inType) {
		_private$6.get(this).signal.dispatch(inType);
	}
}

const registry = new Map();

function privateHash(inClass) {
    'use strict';
    if (!registry.has(inClass)) {
        const map = new WeakMap();
        registry.set(inClass, map);
    }
    return registry.get(inClass);
}

const _private$5 = privateHash('component');

const _setupModel$1 = function _setupModel(inModelInitObj) {

    const _p = _private$5.get(this);

    let getter;
    if (!inModelInitObj) {
        getter = () => {
            return this.page.resolveNodeModel(this.node);
        };
    } else {
        if (isPlainObject(inModelInitObj)) {
            _p.model = new ComponentModel(inModelInitObj);
        } else if (inModelInitObj instanceof ComponentModel) {
            _p.model = inModelInitObj;

        } else {
            _p.model = ObservableObject.fromObject(inModelInitObj);
        }
        getter = () => {
            return _p.model;
        };
    }

    Object.defineProperty(this, 'model', {
        get: getter
    });
    Object.defineProperty(this, 'hasModel', {
        get: () => !!inModelInitObj
    });
};

const _findState$1 = function _findState(inStateName) {

    if (!inStateName) {
        return this.states;
    }
    let path = inStateName.split('.');
    let currentState = this.states;
    while (path.length && currentState) {
        let seg = path.shift();
        currentState = currentState.child(seg);
    }
    return currentState;
};


const _watchState$1 = function _watchState() {
    const _p = _private$5.get(this);

    _p.stateInfo.watch('nextState', (inPath, inChanges) => {
        let nextState = _findState$1.bind(this)(inChanges.newValue);
        if (!nextState) {
            console.warn('Changing to unknown state: ' +
                inChanges.newValue);
            return;
        }
        const rollback = (inReason) => {
            inReason && console.debug('Could not change state because: ' + inReason); //jshint ignore:line
            _p.stateInfo.prop('nextState', inChanges.oldValue, true);
            currentState.didntLeave();
            for (let watcher of _private$5.get(this).stateWatchers) {
                watcher(inChanges.newValue, inChanges.oldValue, inReason);
            }
        };
        let currentState = _private$5.get(this).stateInfo.prop('currentStateObject');
        if (currentState) {
            currentState.leaving(inChanges.newValue).then(() => {
                nextState.entering(inChanges.oldValue).then(() => {

                    _private$5.get(this).stateInfo.prop('currentStateObject', nextState);
                    _private$5.get(this).stateInfo.prop('state', _p.stateInfo.prop('nextState'));
                    currentState.left(inChanges.newValue);
                    nextState.entered(inChanges.oldValue);

                    for (let watcher of _private$5.get(this).stateWatchers) {
                        watcher(inChanges.newValue, inChanges.oldValue);
                    }

                }).catch(rollback);
            }).catch(rollback);
        }
    });
};



class Component$1 {

    constructor(inConfig, inParam2, inParam3, inParam4) {
        let inInitObj, inConstructor, inPage;
        if (isFunction(inParam2)) {
            [inConstructor, inPage] = [inParam2, inParam3];
        } else {
            [inInitObj, inConstructor, inPage] = [inParam2, inParam3, inParam4];
        }
        this.getModel = (inName) => {
            let model = get(inConfig, 'models.' + inName);
            if (!model && this === this.page) {
                LOG.warn('Model ' + inName + ' is not registered with the page');
            } else if(!model) {
                return this.page.getModel(inName);
            }
            return model;
        };

        this.getController = (inName) => {
            let controller = get(inConfig, 'controllers.' + inName);
            if (!controller && this === this.page) {
                LOG.warn('Controller ' + inName + ' is not registered with the page');
            } else if(!controller) {
                return this.page.getController(inName);
            }
            return controller;
        };

        const lifecycleSignal = new Signal();
        const lifecycle = new ComponentLifecycle(lifecycleSignal);
        this.microtask = microtask;
        _private$5.set(this, {
            stateWatchers: new Set(),
            lifecycleSignal: lifecycleSignal,
            stateInfo: new ObservableObject(),
            resolvers: inConfig.resolvers
        });

        Object.defineProperty(this, 'lifecycle', {
            get: function() {
                return lifecycle;
            }
        });


        if (pageFactory.componentConfigPreprocessor) {
            pageFactory.componentConfigPreprocessor(inConfig);
        }
        this.config = inConfig;
        this.page = inPage || this;
        this.bus = new Bus(this); //jshint ignore:line
        this.name = inConfig.name;
        each(inConfig.actions, (inAction) => {
            if (!inAction) {
                console.error('Passed a null action to component config');
                return;
            }
            const actionName = isString(inAction) ? inAction : inAction.name;
            if (!actionName) {
                console.error('Passed an object with no action name as action in component config');
                return;
            }
            const handler = isPlainObject(inAction) ? inAction.handler : undefined;

            if (handler && !isFunction(handler)) {
                console.error('Passed a non-function action handler in component config');
                return;
            }
            if (isPlainObject(inAction) && inAction.publish === true) {
                this.bus.publishAction(actionName, handler ? handler.bind(this) : null);
            } else {
                this.bus.addAction(actionName, handler ? handler.bind(this) : null);
            }

        });
        let templates = inConfig.templates || {};

        _setupModel$1.call(this, inInitObj);

        for (let templateName in templates) {
            let actualTemplateName = templateName === '_default' ?
                '_default.' + this.name :
                templateName;
            pageFactory.getTemplatingDelegate()
                .register(actualTemplateName, templates[templateName]);
        }
        _private$5.get(this).hasDefaultTemplate = !!templates._default;
        _watchState$1.bind(this)();
        this.states = this.states || new State();
        _private$5.get(this).stateInfo.prop('currentStateObject', this.states);
        inConstructor && inConstructor.bind(this)(); //jshint ignore:line

        microtask(this.initState.bind(this));
    }

    data(inPath, inValue, inSilent) {
        const path = 'data' + (inPath ? '.' + inPath : '');
        return this.page.resolveNodeModel(this.node, path).prop(path, inValue, inSilent);
    }

    parent() {
        if (this.page === this) {
            return;
        }
        return this.page.resolveNodeComponent($(this.node).parent());
    }

    getResolver(inName) {
        return get(_private$5.get(this), 'resolvers.' + inName);
    }

    initState() {

    }

    getCurrentState() {
        return _private$5.get(this).stateInfo.prop('currentStateObject');
    }

    tryState(inStateName) {
        if (inStateName === (_private$5.get(this).stateInfo.prop('state') || '')) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const watcher = (inNewState, inOldState, inError) => {
                if (inError) {
                    reject(inError);
                } else {
                    resolve(inNewState, inOldState);
                }
                this.unwatchState(watcher);
            };
            this.watchState(watcher);
            _private$5.get(this).stateInfo.prop('nextState', inStateName);
        });

    }

    unwatchState(inWatcherFunction) {
        _private$5.get(this).stateWatchers.delete(inWatcherFunction);
    }

    watchState(inWatcherFunction) {
        _private$5.get(this).stateWatchers.add(inWatcherFunction);
    }

    invalidate() {
        if (!_private$5.get(this).willRender) {
            _private$5.get(this).willRender = true;
            microtask(this.render.bind(this));
        }
    }

    render(inModel) {
        return new Promise((resolve, reject) => {
            _private$5.get(this).willRender = false;
            if (_private$5.get(this).hasDefaultTemplate) {
                const delegate = pageFactory.getTemplatingDelegate();
                const model = inModel ?
                    ObservableObject.fromObject(inModel) :
                    this.data();
                delegate.render(
                    '_default.' + this.name,
                    model).then((inHtml) => {
                    $(this.node).html(inHtml);

                    this.afterRender && this.afterRender(); //jshint ignore:line
                    //const mutationObserver = new MutationObserver(() => {
                    this.microtask(() => {
                        _private$5.get(this)
                            .lifecycleSignal.dispatch('rendered');
                        resolve();
                        //      mutationObserver.disconnect();
                    });

                    //});
                    //mutationObserver.observe($(this.node).get(0), {childList : true});
                }).catch((inError) => {
                    console.error(inError);
                    reject(inError);
                });
            }

        });

    }

}

let _page = null;

function modelDataSource() {
    return function(inPage) {
        const ModelDataSource = function(inPage) {
            this.page = _page = inPage;

            this.resolve = function resolve(inNode, inPath) {
                return new Promise((resolvePromise, rejectPromise) => {

                    if (!/^_/.test(inPath) && inPath) {
                        if (inPath === '.') {
                            inPath = 'data';
                        } else {
                            inPath = 'data' + (inPath ? '.' + inPath : '');
                        }
                    }
                    const model = _page.resolveNodeModel(inNode, inPath);
                    resolvePromise(inPath ? model.prop(inPath) : model);

                });
            };

            this.unbindPath = function unbindPath(inNode, inObserver, inPath) {
                const model = _page.resolveNodeModel(inNode, inPath);
                model.unwatch(inObserver, inPath);
            };

            this.bindPath = function bindPath(inNode, inPath, inHandler) {
                if (!/^_/.test(inPath) && inPath) {
                    if (inPath === '.') {
                        inPath = 'data';
                    } else {
                        inPath = 'data' + (inPath ? '.' + inPath : '');
                    }
                }
                const model = _page.resolveNodeModel(inNode, inPath);

                model.watch(inPath, function(inPath, inChanges) {
                    var result = inHandler(inChanges.newValue, inChanges.oldValue);
                });
            };

            this.setPath = function setPath(inNode, inPath, inValue) {
                if (!/^_/.test(inPath)) {
                    inPath = 'data.' + inPath;
                }
                const model = _page.resolveNodeModel(inNode, inPath);
                model.prop(inPath, inValue);
            };


        };
        return new ModelDataSource(inPage);
    };

}

function action(inPage) {
    const _page = inPage;

    var proto = Object.create(HTMLElement.prototype);

    proto.createdCallback = function() {

    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-managed', { prototype: proto });
}

const Wiring = require('./Wiring');
const $$1 = require('jquery');
const Binding = require('../Binding');

const get$1 = require('lodash.get');
const each$1 = require('lodash.foreach');
const includes$1 = require('lodash.includes');


const _observeClassAttrMutation = function _observeClassAttrMutation(inHandler) {
    //Using mutation observer on class attribute to fire handler
    var classMutationObserver = new MutationObserver(function(mutations) {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                each$1(this.bindings, (inBinding, inIndex) => {
                    if (inBinding instanceof Binding) {
                        inBinding.getValue().then((inValue) => {
                            inHandler.call(this, inValue);
                        });
                        return false;
                    }
                });
            }
        });
    });

    var config = {
        attributes: true
    };

    classMutationObserver.observe(this.element, config);

};

const _compositeAttrHandler = function _compositeAttrHandler(inAttrName, inValue) {
    const val = [];
    const promises = [];
    $$1(this.element).attr(inAttrName, '');
    each$1(this.bindings, (inBinding, inIndex) => {
        if (inBinding instanceof Binding) {
            const promise = inBinding.getValue();
            promise.then((inNewValue) => {
                val[inIndex] = inNewValue;
            });
            promises.push(promise);

        }
        val.push(inBinding);
    });
    Promise.all(promises).then(() => {
        $$1(this.element).attr(inAttrName, val.join(''));
    });

};

const _handleClassAttr = function _handleClassAttr(inValue) {
    const val = [];
    const promises = [];
    $$1(this.element).attr('class', '');
    each$1(this.bindings, (inBinding, inIndex) => {
        if (inBinding instanceof Binding) {
            const promise = inBinding.getValue();
            promise.then((inNewValue) => {
                val[inIndex] = inNewValue;
            });
            promises.push(promise);

        }
        val.push(inBinding);
    });
    Promise.all(promises).then(() => {
        $$1(this.element).addClass(val.join(' '));
    });

};

const _handleClassDashAttr = function _handleClassDashAttr(inValue) {

    const className = this.attrName.replace('class-', '');
    if (!!inValue) {
        $$1(this.element).addClass(className);
    } else {
        $$1(this.element).removeClass(className);
    }

};

class AttributeWiring extends Wiring {

    constructor(inElement, inAttrName, inBindings) {
        super(inElement);
        this.element = inElement;
        this.attrName = inAttrName;
        this.bindings = inBindings;

        if (/^class-/.test(this.attrName)) {
            if (this.bindings.length > 1) {
                throw new Error(this.attrName + ' binding expect a single truty/falsy binding.');
            }
        }
    }

    attach(inApp) {
        if (inApp) {
            this.app = inApp;
        } else if (!this.app) {
            throw new Error('AttributeWiring: cannot attach to undefined app');
        }

        const handler = (inValue) => {
            if (this.attrName === 'class') {
                _handleClassAttr.call(this, inValue);
            } else if (/^class-/.test(this.attrName)) {
                _handleClassDashAttr.call(this, inValue);
            } else {
                _compositeAttrHandler.call(this, this.attrName, inValue);
            }
        };

        if (/^class-/.test(this.attrName) && this.hasClassBinding) {
            _observeClassAttrMutation.call(this, handler);
        }

        each$1(this.bindings, (inBinding) => {
            if (inBinding instanceof Binding) {
                inBinding.attach(inApp, handler);
            }
        });
    }

    detach() {
        each$1(this.bindings, (inBinding) => {
            if (inBinding instanceof Binding) {
                inBinding.detach();
            }
        });
    }

    static wire(inElement, inAllowedAttributes) {
        const wirings = [];
        let hasClassBinding = false;
        const attrToRemove = [];
        $$1.each(inElement.attributes, function(i, attrib) {
            if (!includes$1(inAllowedAttributes, get$1(attrib.name.match(/^(\w+)/), 1))) {
                return;
            }
            const val = Binding.parse(attrib.value, inElement);
            if (val !== attrib.value) {
                if (attrib.name === 'class') {
                    hasClassBinding = true;
                }
                wirings.push(new AttributeWiring(inElement, attrib.name, val));
                attrToRemove.push(attrib.name);
            }

        });
        each$1(wirings, (inWiring) => {
            inWiring.hasClassBinding = hasClassBinding;
        });
        each$1(attrToRemove, (inName) => {
            $$1(inElement).removeAttr(inName);
        });
        return wirings;

    }
}

function render(inPage) {
    const _private = new WeakMap();
    const _page = inPage;
    var proto = Object.create(HTMLDivElement.prototype);

    const invalidate = function invalidate() {
        if (!_private.get(this).willRender) {
            _private.get(this).willRender = true;
            microtask(render.bind(this));
        }
    };

    var render = function render() {
        _private.get(this).willRender = false;
        // if ($(this).attr('debug-name')) {
        //     console.info($(this).attr('debug-name') + ' will render');
        // }

        let templateName = $(this).attr('template');

        const path = $(this).attr('from') || '.';
        _page.getDataSource().resolve(this, path).then((inValue) => {
            const attrs = transform(this.attributes, function(result, item) {
                item.specified && /^param-/.test(item.name) && (result[item.name.replace('param-', '')] = item.value); //jshint ignore:line
            }, {});

            pageFactory.getTemplatingDelegate()
                .render(templateName, inValue || {}, _private.get(this).params)
                .then((inHtml) => {
                    $(this).html(inHtml);
                })
                .catch((inError) => {
                    console.error(inError);
                });
        }).catch((inError) => {
            console.error(inError);
        });
    };
    proto.createdCallback = function() {
        $(this).prop('ae', {
            wirings: AttributeWiring.wire(this, ['class', 'id', 'name', 'param', 'data', 'style'])
        });
        _private.set(this, {
            willRender: false,
            params: (() => {
                var out = {};
                each(this.attributes, (inAttribute) => {
                    if (/^param-/.test(inAttribute.name)) {
                        out[inAttribute.name.replace('param-', '')] = inAttribute.value;
                    }
                });
                return out;
            })()
        });
        let templateName = $(this).attr('template');
        if (!templateName) {
            let template = $(this).find('>ae-template');
            if (!template) {
                throw new Error($(this).getPath() + ' must have a template attribute or a template element');
            }
            templateName = pageFactory.getTemplatingDelegate()
                .registerTemplate(template.html());
            $(this).attr('template', templateName);
            $(this).empty();
        }
    };

    proto.attachedCallback = function() {
        const ae = $(this).prop('ae');
        each(ae.wirings, (wiring) => {
            wiring.attach(_page);
        });
        invalidate.call(this);
        var observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (/^param-/.test(mutation.attributeName)) {
                    invalidate.call(this);
                }
            });
        });

        // configuration of the observer:
        var config = {
            attributes: true
        };

        // pass in the target node, as well as the observer options
        observer.observe(this, config);

        const path = $(this).attr('from');
        _page.getDataSource().bindPath(this, path, (inBaseModel) => {

            if (inBaseModel instanceof ObservableObject) {
                inBaseModel.watch(path, () => {
                    invalidate.call(this);
                });
            } else {
                invalidate.call(this);
            }
            invalidate.call(this);
        });
        if ($(this).attr('watch')) {
            _page.getDataSource().bindPath(this, $(this).attr('watch'), (inBaseModel) => {

                invalidate.call(this);
            });
        }

    };

    proto.detachedCallback = function() {
        const ae = $(this).prop('ae');
        each(ae.wirings, (wiring) => {
            wiring.detach();
        });
    };

    document.registerElement('ae-rendered', {
        prototype: proto,
        extends: 'div'
    });
}

var UNRESOLVED = Symbol('unresolved');

function typifyParams(inPage, inParams) {
    const out = {};
    each(inParams, function(inParamValue, inParamKey) {
        if (!inParamValue) {
            out[inParamKey] = null;
        } else if (isString(inParamValue) && /^~/.test(inParamValue)) {
            let resolvedValue = UNRESOLVED;
            inPage.getDataSource()
                .resolve(this, inParamValue.replace('~', '')).then((inValue) => {
                    resolvedValue = inValue;
                });
            if (resolvedValue === UNRESOLVED) {
                throw new Error('Action parameters must be resolved synchronously');
            }
            out[inParamKey] = resolvedValue;
        } else if (isString(inParamValue) && /^`.*`$/.test(inParamValue)) {
            out[inParamKey] = inParamValue.replace(/^`/, '').replace(/`$/, '');
        } else if (!isNaN(inParamValue)) {
            out[inParamKey] = Number(inParamValue);
        } else if (/^(true|false)$/.test(inParamValue)) {
            out[inParamKey] = (inParamValue === 'true');
        } else {
            console.warn('using deprecated signal string param format');
            out[inParamKey] = inParamValue; //is a string
        }
    });
    return out;

}

const resolveTargets = function resolveTargets(inPage, inConfig) {
    let target = {};
        const targetAttr = inConfig.target;
    if ($(this).children().length && targetAttr !== 'self') {
        target.node = $(this).children().get(0);
    } else {
        if (!targetAttr) {
            target.node = $(this).parent();
        } else if (targetAttr === 'next') {
            target.node = $(this).next();
        } else if (/^closest/.test(targetAttr)) {
            const segs = targetAttr.split(/\s+/);
            target.node = $(this).closest(segs[1]);
        } else if (/^(\.|\#)/.test(targetAttr)) {
            target.node = $(this).parent().find(targetAttr);
        } else if (/^self$/.test(targetAttr)) {
            target.node = $(this);
        } else {
            console.warn('Unknown ae-bind target: ' + targetAttr);
        }
    }
    if (target.node && target.node.length) {
        return target;
    } else if (target.node && !target.node.length) {
        target.pending = true;
        return target;
    }
    return;
};


function attachAction(inPage, inConfig) {
    let target = resolveTargets.call(this, inPage, inConfig);
    if (get(this, 'pending') === true) {
        const observer = new MutationObserver((mutations) => {
            attachAction.call(this);
        });
        const observerConfig = {
            subtree: true,
            childList: true
        };
        observer.observe(this.parentNode, observerConfig);
    } else {
        const actionName = inConfig.name;
        each(target.node, (inTargetNode) => {
            const component = inPage.resolveNodeComponent(inTargetNode);
            let event;

            const handler = (inEvent, inTrigger) => {
                if($(inEvent.target).prop('tagName') === 'LABEL') {
                    return;
                }
                if (inTrigger === 'enter' && inEvent.keyCode !== 13) {
                    return;
                }
                if (inTrigger === 'esc' && inEvent.keyCode !== 27) {
                    return;
                }
                component.bus.triggerAction(
                    actionName,
                    typifyParams(inPage, inConfig.params),
                    inEvent);
                if(inTrigger === 'click') {
                    inEvent.stopPropagation();
                }
            };


            for (let trigger of(inConfig.trigger || 'click').split(',')) {
                switch (trigger) {
                    case 'enter':
                    case 'esc':
                        event = 'keyup';
                        break;
                    default:
                        if (/^\w+:/.test(trigger)) {
                            event = trigger.match(/^(\w+)/)[0];
                        } else {
                            event = trigger;
                        }
                }

                const caller = (inEvent) => { //jshint ignore:line
                    handler(inEvent, trigger);
                };

                $(inTargetNode).off(event, caller).on(event, caller);
            }


        });
    }

}

const ElementHTMLWiring = require('../wiring/ElementHTMLWiring');
function aeButton(inPage) {
    const _page = inPage;

    var proto = Object.create(HTMLButtonElement.prototype);
    proto.createdCallback = function() {
        let wirings = [];
        $(this).prop('ae', {
            wirings: wirings
        });

        if ($(this).attr('bind-html')) {
            wirings.push(new ElementHTMLWiring(this));
        }

        wirings.push.apply(wirings);

        $(this).prop('type', 'button');


        if ($(this).attr('bind-enabled')) {
            let path = $(this).attr('bind-enabled');
            let strictBoolean = false;
            if (/!$/.test(path)) {
                path = path.replace(/!$/, '');
                strictBoolean = true;
            }
            const source = $(this).attr('source');
            const setValue = (inValue) => {
                $(this).prop('disabled', strictBoolean ? inValue !== true : !inValue);
            };

            _page
                .getDataSource(source)
                .bindPath(this, path, (inNewValue) => {
                    setValue(inNewValue);
                });
            _page
                .getDataSource(source)
                .resolve(this, path)
                .then((inValue) => {
                    setValue(inValue);
                });
        }

        if ($(this).attr('action')) {
            attachAction.call(this, _page, {
                name: $(this).attr('action'),
                trigger: 'click',
                target: 'self',
                params: (() => {
                    const params = {};
                    $($(this).get(0).attributes).each(function() {
                        if (/^param-/.test(this.name)) {
                            params[this.name.replace('param-', '')] = this.value;
                        }
                    });
                    return params;
                })()
            });
        }



    };

    proto.attachedCallback = function() {
        const ae = $(this).prop('ae');
        each(ae.wirings, (wiring) => {
            wiring.attach(_page);
        });

    };

    proto.detachedCallback = function() {
        const ae = $(this).prop('ae');
        each(ae.wirings, (wiring) => {
            wiring.detach();
        });
    };

    document.registerElement('ae-button', {
        prototype: proto,
        extends: 'button'
    });
}

function each$2(inPage) {
    const _page = inPage;
    const _private = new WeakMap();
    const _templatingDelegate = pageFactory.getTemplatingDelegate();

    var proto = Object.create(HTMLElement.prototype);

    proto.createdCallback = function() {

        $(this).children().each(function() {
            if (!(document.createElement(this.tagName) instanceof Element) && this.nodeName.toUpperCase() !== 'TEMPLATE') {
                throw new Error('ae-each children must be either <ae-...> or a <template> element.');
            }
        });
        let templateName = $(this).attr('template');
        if (!templateName) {
            let template = $(this).find('>template');

            _private.set(this, {
                templateName: _templatingDelegate.registerTemplate(template.html())
            });
        } else {
            _private.set(this, {
                templateName: templateName
            });
        }
        if (!$(this).find('>ae-managed').length) {
            $(this).append(document.createElement('ae-managed'));
        }
    };

    proto.attachedCallback = function() {
        let dataSourceName = $(this).attr('source');
        const path = $(this).attr('path');
        let dataSource = _page.getDataSource(dataSourceName);
        const templateName = _private.get(this).templateName;

        const appendFn = (inHtml) => {
            $(this).find('>ae-managed').append(inHtml);
        };

        const errorFn = (inError) => {
            throw new Error(inError);
        };

        const renderFn = (inData) => {
            $(this).find('>ae-managed').empty();
            if (inData instanceof ObservableObject ) {
                for (let instance of inData) {
                    _templatingDelegate.render(templateName, instance)
                        .then(appendFn)
                        .catch(errorFn);
                }
            } else {
                _templatingDelegate.render(templateName, inData)
                    .then(appendFn)
                    .catch(errorFn);
            }
        };

        dataSource.bindPath(this, path, (inNewValue) => {
            renderFn(inNewValue);
        });
        dataSource.resolve(this, path).then((inData) => {
            renderFn(inData);    
        });
        
    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-each', { prototype: proto });
}

function state(inPage) {
    'use strict';
    const _page = inPage;
    var proto = Object.create(HTMLElement.prototype);

    proto.createdCallback = function() {
        const component = _page.resolveNodeComponent(this);
        const method = $(this).attr('method') || 'removal';
        const statePattern = new RegExp($(this).attr('pattern') || '^$');
        const statePathMatch = $(this).attr('path');
        const stateNameMatch = $(this).attr('name');
        const watcher = () => {
            $(this).prop('willRender', false);
            const currentState = component.getCurrentState();
            const matches =
                statePathMatch === currentState.getPath() ||
                stateNameMatch === currentState.getName() ||
                statePattern.test(currentState.getPath());

            if (matches) {
                if (method === 'visibility') {
                    $(this).children().each(function() {
                        $(this).removeClass('is-hidden');
                    });
                } else {
                    if (!$(this).prop('wasRendered')) {
                        $(this).html(this.content);
                        $(this).prop('wasRendered', true);
                    }
                }
                currentState.rendered();
            } else {
                if (method === 'visibility') {
                    $(this).children().each(function() {
                        $(this).addClass('is-hidden');
                    });
                } else {
                    $(this).empty();
                    $(this).prop('wasRendered', false);
                }
            }
        };

        component.watchState(() => {
            if(!$(this).prop('willRender')) {
                $(this).prop('willRender', true);
                microtask(watcher);
            }
        });
        this.content = $(this).html();
        watcher();

    };

    proto.attachedCallback = function() {


    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-state', { prototype: proto });
}

let _page$1;


function action$1(inPage) {

    _page$1 = inPage;

    var proto = Object.create(HTMLElement.prototype);

    proto.createdCallback = function() {

    };

    proto.attachedCallback = function() {
        attachAction.call(this, _page$1, {
            name: $(this).attr('name'),
            trigger: $(this).attr('trigger'),
            target: $(this).attr('target'),
            params: (() => {
                const params = {};
                $($(this).get(0).attributes).each(function() {
                    if (/^param-/.test(this.name)) {
                        params[this.name.replace('param-', '')] = this.value;
                    }
                });
                return params;
            })()
        });
    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-action', { prototype: proto });
}

class InputValueChangeDelegate {

    constructor() {

    }

    canOutputValue(inElement) {
        return ((!!inElement) && (
            $(inElement).get(0) instanceof HTMLInputElement ||
            $(inElement).get(0) instanceof HTMLTextAreaElement ||
            $(inElement).get(0) instanceof HTMLSelectElement));
    }

    onValueChange(inElement, inConfig, inHandler) {
        const delay = !isNaN(inConfig.delay) ? Number(inConfig.delay) : null;
        const commitOnly = inConfig.commitOnly === true;
        let events = inConfig.event;
        if (!events) {

            switch ($(inElement).get(0).nodeName.toUpperCase()) {
                case 'INPUT':
                    {
                        const type = ($(inElement).attr('type') || 'TEXT').toUpperCase();
                        if (includes(['TEXT', 'EMAIL', 'TEL', 'PASSWORD'], type)) {
                            events = 'change,keyup';
                        } else if (includes(['CHECKBOX', 'RADIO'], type)) {
                            events = 'click';
                        }
                    }
                    break;
                case 'SELECT':
                    events = 'change';
                    break;
                default:
                    events = 'keydown';
            }
        }
        let delayedTimeout;

        const defaultHandler = () => {
            inHandler({
                value: this.getValue(inElement),
                key: $(inElement).attr('name')
            });
        };

        const timeoutHandler = () => {
            defaultHandler();
        };

        const delayedHandler = () => {
            if (delayedTimeout === undefined || !!delayedTimeout) {
                clearTimeout(delayedTimeout);
                delayedTimeout = setTimeout(timeoutHandler, delay);
            } else {
                delayedTimeout = null;
                timeoutHandler();
            }


        };



        const handler = (!isNaN(delay) ? delayedHandler : defaultHandler);

        each(events.split(','), (eventName) => {
            $(inElement).off(eventName, handler).on(eventName, handler);
        });
    }

    setValue(inElement, inValue, inPropName) {
        inElement = $(inElement);
        if (!$(inElement).get(0)) {
            return;
        }
        const name = inElement.attr('name');
        if ($(inElement).get(0).nodeName.toUpperCase() === 'INPUT') {
            const type = ($(inElement).attr('type') || 'TEXT').toUpperCase();
            switch (type) {
                case 'TEXT':
                case 'EMAIL':
                case 'TEL':
                case 'PASSWORD':
                    if ($(inElement).val() !== inValue) {
                        $(inElement).val(inValue);
                    }
                    break;
                case 'CHECKBOX':
                    $(inElement).prop('checked', inValue === true ||
                        (!!inValue && inValue === inElement.attr('value')));
                    break;
                case 'RADIO':
                    $(inElement).prop('checked', inValue === inElement.attr('value'));
            }

        } else if ($(inElement).get(0).nodeName.toUpperCase() === 'SELECT') {
            $(inElement).find('option[value=' + inValue + ']').each(function() {
                $(this).prop('checked', inValue === inElement.attr('value'));
            });
        }

    }

    getValue(inElement) {
        if (!$(inElement).get(0)) {
            return;
        }
        const targetValue = $(inElement).attr('value');
        if ($(inElement).get(0).nodeName.toUpperCase() === 'INPUT') {
            const type = ($(inElement).attr('type') || 'TEXT').toUpperCase();

            switch (type) {
                case 'TEXT':
                case 'EMAIL':
                case 'TEL':
                case 'PASSWORD':
                    return $(inElement).val();
                case 'CHECKBOX':
                    if ($(inElement).prop('checked')) {
                        return !!targetValue ? targetValue : $(inElement).prop('checked') === true;
                    }
                    return !!targetValue ? null : false;
                case 'RADIO': //jshint ignore:line
                    {
                        const form = $(inElement).closest('form').get(0);
                        if (!form) {
                            throw new Error('Input elements must be enclosed in a form');
                        }
                        var selected = $(form).find(`radio[name=${$(inElement).attr('name')}]:checked`).get(0);
                        if (!selected) {
                            return;
                        } else {
                            return $(selected).val();
                        }

                    }
                    break;
            }
        } else if ($(inElement).get(0).nodeName.toUpperCase() === 'TEXTAREA') {
            return $(inElement).val();
        } else if ($(inElement).get(0).nodeName.toUpperCase() === 'SELECT') {
            let out = [];
            $(inElement).find('option:selected').each(function() {
                out.push($(this).val());
            });
            if (!$(inElement).prop('multiple')) {
                return out[0];
            }
            return out;
        }
    }

}

var valueChangeDelegate = new InputValueChangeDelegate();

function bind(inPage) {
    const _page = inPage;
    const _private = new WeakSet();

    var proto = Object.create(HTMLElement.prototype);

    proto.attachedCallback = function() {
        if ($(this).attr('path') && ($(this).attr('from') && $(this).attr('to'))) {
            console.warn('ae-bind attribute "path" is ignored when either "from" or "to" are specified: \nNode:');
            console.warn(this);
        }

        let target;
        if ($(this).children().length) {
            target = $(this).children().get(0);
        } else {
            const targetAttr = $(this).attr('target');
            if (!targetAttr) {
                target = $(this).parent();
            } else if (targetAttr === 'next') {
                target = $(this).next();
            } else if (/^closest/.test(targetAttr)) {
                const segs = targetAttr.split(/\s+/);
                target = $(this).closest(segs[1]);
            } else if (/^(\.|\#)/.test(targetAttr)) {
                target = $(this).parent().find(targetAttr);
            } else {
                console.warn('Unknown ae-bind target: ' + targetAttr);
            }
        }

        let dataSourceName = $(this).attr('source');
        const path = $(this).attr('path');
        let dataSource = _page.getDataSource(dataSourceName);
        if (!dataSource) {
            throw new Error('Cannot bind to data-source: ' + dataSourceName);
        }
        const usePath = path && !$(this).attr('from') && !$(this).attr('to');
        const toAttr = usePath ? path : $(this).attr('to');
        const fromAttr = usePath ? path : $(this).attr('from');
        let inAttr = $(this).attr('in') || '';
        const isFormElement = valueChangeDelegate.canOutputValue(target);

        if (!inAttr && isFormElement) {
            inAttr = 'form-element-value';
        }
        if (fromAttr) {
            let nodeAttr = inAttr.split(':');
            nodeAttr[0] = nodeAttr[0] || 'html';

            if (nodeAttr[0] === 'html') {
                $(target).attr('data-ae-bind-html', fromAttr);
            }

            const valueResolver = (inValue) => {
                let condition = $(this).attr('if');
                let conditionMet = true;
                if (condition) {

                    let negate =
                        (!!condition && /^!/.test(condition));

                    condition = condition.replace(/^!/, '');

                    if (condition && /^\/.*\/$/.test(condition)) {
                        condition = new RegExp(condition.replace(/^\//, '').replace(/\/$/, ''));
                        conditionMet = condition.test(inValue);
                    } else if (isString(condition)) {
                        if(/^(true|false)$/.test(condition)) {
                            condition = Boolean(condition);
                        }
                        conditionMet = (condition === inValue);
                    }
                    conditionMet = conditionMet === (!negate);//jshint ignore:line
                }

                switch (nodeAttr[0]) {
                    case 'html':
                        if (conditionMet) {
                            $(target).html(inValue);
                        }
                        break;
                    case 'attr':
                        if (conditionMet) {
                            $(target).attr(nodeAttr[1], inValue);
                        }
                        break;
                    case 'class':
                        if (conditionMet) {
                            $(target).addClass(nodeAttr[1]);
                        } else {
                            $(target).removeClass(nodeAttr[1]);
                        }
                        break;
                    case 'form-element-value':
                        if (conditionMet) {
                            valueChangeDelegate.setValue(target, inValue);
                        }
                        break;
                    default:
                        console.warn('I don\'t know how to bind value to element');
                }

            };

            dataSource.bindPath(this, fromAttr, function(inNewValue, inOldValue) {
                if(inNewValue !== inOldValue) {
                    valueResolver(inNewValue);
                }
            });

            dataSource.resolve(this, fromAttr).then((inValue) => {
                valueResolver(inValue);
            });

        }

        if (toAttr) {
            if (!isFormElement) {
                throw new Error('Element ' + $(target).get(0).nodeName + ' cannot be used as a source of binding output');
            }
            const outOptions = {};
            each(this.attributes, (inAttribute) => {
                if (/^out-/.test(inAttribute.name)) {
                    outOptions[inAttribute.name.replace(/^out-/, '')] = inAttribute.value;
                }
            });
            valueChangeDelegate.onValueChange(target, outOptions, (inValue) => {
                dataSource.setPath(this, toAttr, inValue.value == null ? null : inValue.value);
            });
        }


    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-bind', { prototype: proto });
}

function render$1(inPage) {
    'use strict';
    const _private = new WeakMap();
    const _page = inPage;
    var proto = Object.create(HTMLElement.prototype);

    const invalidate = function invalidate() {
        if (!_private.get(this).willRender) {
            _private.get(this).willRender = true;
            microtask(render.bind(this));
        }
    };

    var render = function render() {
        _private.get(this).willRender = false;
        // if ($(this).attr('debug-name')) {
        //     console.info($(this).attr('debug-name') + ' will render');
        // }

        let templateName = $(this).attr('template');

        const path = $(this).attr('from') || '.';
        _page.getDataSource().resolve(this, path).then((inValue) => {
            const attrs = transform(this.attributes, function(result, item) {
                item.specified && /^param-/.test(item.name) && (result[item.name.replace('param-', '')] = item.value); //jshint ignore:line
            }, {});

            pageFactory.getTemplatingDelegate()
                .render(templateName, inValue || {}, _private.get(this).params)
                .then((inHtml) => {
                    $(this).find('>ae-managed').html(inHtml);
                })
                .catch((inError) => {
                    console.error(inError);
                });
        }).catch((inError) => {
            console.error(inError);
        });
    };
    proto.createdCallback = function() {
        _private.set(this, { 
            willRender: false,
            params : (() => {
                var out = {};
                each(this.attributes, (inAttribute) => {
                    if(/^param-/.test(inAttribute.name)) {
                        out[inAttribute.name.replace('param-', '')] = inAttribute.value;
                    }
                });
                return out;
            })() });
        let templateName = $(this).attr('template');
        if (!templateName) {
            let template = $(this).find('>template');
            if (!template) {
                throw new Error($(this).getPath() + ' must have a template attribute or a template element');
            }
            templateName = pageFactory.getTemplatingDelegate()
                .registerTemplate(template.html());
            $(this).attr('template', templateName);
            $(this).empty();
        }
        $(this).append('<ae-managed></ae-managed>');
    };

    proto.attachedCallback = function() {

        invalidate.call(this);
        var observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (/^param-/.test(mutation.attributeName)) {
                    invalidate.call(this);
                }
            });
        });

        // configuration of the observer:
        var config = { attributes: true };

        // pass in the target node, as well as the observer options
        observer.observe(this, config);

        const path = $(this).attr('from');
        _page.getDataSource().bindPath(this, path, (inBaseModel) => {

            if (inBaseModel instanceof ObservableObject) {
                inBaseModel.watch(path, () => {
                    invalidate.call(this);
                });
            } else {
                invalidate.call(this);
            }
            invalidate.call(this);
        });
        if ($(this).attr('watch')) {
            _page.getDataSource().bindPath(this, $(this).attr('watch'), (inBaseModel) => {

                invalidate.call(this);
            });
        }

    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-render', { prototype: proto });
}

/**
 *   A container for element that change the value of a property based on 
 *   selection of its children. It behaves like a radio group.
 *   if no path attribute is found, the switch targets the component's state
 */
function aeSwitch(inPage) {
    const _page = inPage;
    const _private = new WeakMap();

    const selectHandler = function selectHandler(inSelectedElement) {
        const _p = _private.get(this);
        const val = $(inSelectedElement).data('ae-switch-value');
        $(this).children().removeClass(_p.selectedClass);
        $(inSelectedElement).addClass(_p.selectedClass);
        if (!_p.source) {
            _p.target.tryState(val);
        } else {
            _page.resolveNodeComponent(this);
            _page.getDataSource().setPath(this, _p.source, val);

        }
        //console.log('switch element clicked: ' + $(inSelectedElement).data('ae-switch-value'));
    };

    var proto = Object.create(HTMLUListElement.prototype);
    proto.createdCallback = function() {
        _private.set(this, {
            selectedClass: $(this).attr('selected-class') || 'selected',
            source: $(this).attr('path') || null
        });
    };

    proto.attachedCallback = function() {
        const that = this;
        const _p = _private.get(this);
        _p.target = _page.resolveNodeComponent(this);
        let defaultSwitch;
        $(this).children().each(function() {
            if ($(this).data('ae-switch-value') === $(that).attr('default-value')) {
                defaultSwitch = $(this);
            }
            $(this).off('click', selectHandler).on('click', () => {
                selectHandler.call(that, this);
            });
            if (defaultSwitch) {
                selectHandler.call(that, defaultSwitch);
            }
        });
        if(!defaultSwitch) {
            selectHandler.call(this, $(this).children().first());
        }
    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-switch', {
        prototype: proto,
        extends: 'ul'
    });
}

function aeTextInput(inPage) {
    'use strict';
    const _page = inPage;
    let observer;
    document.styleSheets[0].insertRule('ae-input' + '{ display: block;}', 1);
    var proto = Object.create(HTMLElement.prototype);
    proto.createdCallback = function() {

        observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                switch (mutation.attributeName) {
                    case 'label':
                        $(mutation.target).find('label>span').text($(mutation.target).attr('label'));
                        break;
                    case 'value':
                        $(mutation.target).find('input').attr('value', $(mutation.target).attr('value'));
                        break;
                    case 'label-class':
                        $(mutation.target).find('label').attr('class', $(mutation.target).attr('label-class'));
                        break;
                    case 'input-class':
                        $(mutation.target).find('input').attr('class', $(mutation.target).attr('input-class'));
                        break;
                }
            });
        });

        if ($(this).attr('bind-enabled')) {
            const path = $(this).attr('bind-enabled').replace('!', '');
            const negate = /^!/.test($(this).attr('bind-enabled'));
            const source = $(this).attr('source');
            const setValue = (inValue) => {
                $(this).find('input').prop('disabled',
                    ((inValue === false) && !negate) ||
                    ((inValue !== false) && negate));
            };

            _page
                .getDataSource(source)
                .bindPath(this, path, (inNewValue) => {
                    setValue(inNewValue);
                });
            _page
                .getDataSource(source)
                .resolve(this, path)
                .then((inValue) => {
                    setValue(inValue);
                });
        }


        // configuration of the observer:
        const config = { attributes: true };
        // pass in the target node, as well as the observer options
        observer.observe(this, config);
        const inputType = $(this).attr('type') || 'text';
        if (/^(checkbox|radio)$/.test(inputType.toLowerCase())) {
            const actionName = $(this).attr('action');
            if (actionName) {
                attachAction.call(this, _page, {
                    name: actionName,
                    trigger: 'click',
                    target: 'self'
                });

            }
        }
        let bindingAttrName;
        each($(this.attributes), (inAttribute) => {
            if (['from', 'to', 'path'].indexOf(inAttribute.name) !== -1) {
                bindingAttrName = inAttribute.name;
            }
        });
        let bindingNode = '';
        if (bindingAttrName) {
            const delayAttr = $(this).attr('out-delay') ? `out-delay="${$(this).attr('out-delay')}"` : '';
            bindingNode = bindingAttrName ? `<ae-bind ${delayAttr} target="next" ${bindingAttrName}="${$(this).attr(bindingAttrName)}"></ae-bind>` : '';
        }
        const labelPlacement = $(this).attr('label-placement') || 'left';
        const labelText = $(this).attr('label');
        const autocomplete = $(this).attr('autocomplete') ?
            ' autocomplete="' + $(this).attr('autocomplete') + '"' :
            '';
        const placeholder = $(this).attr('placeholder') || '';
        const inputClass = $(this).attr('input-class') || '';
        const disabled = !($(this).attr('enabled') !== 'false' && true) ? 'disabled' : '';
        const inputName = $(this).attr('name') || 'ae-' + uuid.v4();
        const valueAttr = $(this).attr('value') ? `value="${$(this).attr('value')}` : '';
        const input = `<input name="${inputName}" ${disabled} type="${inputType}" ${autocomplete} class="${inputClass}" placeholder="${placeholder}" ${valueAttr}>`;
        const label = labelText ? `<label for="${inputName}" class="${$(this).attr('label-class') || ''}">${labelText}</label>` : '';

        $(this).append(`${labelPlacement === 'left'? label : ''}${bindingNode}${input}${labelPlacement === 'right'? label : ''}`);
    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {
        observer.disconnect();
    };

    document.registerElement('ae-input', { prototype: proto });
}

function action$2(inPage) {
    const _page = inPage;

    var proto = Object.create(HTMLElement.prototype);

    proto.createdCallback = function() {
    	$(this).prop('content', $(this).text());
    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-template', { prototype: proto});
}

function aeButton$1(inPage) {
    const _page = inPage;
    let observer;

    var proto = Object.create(HTMLInputElement.prototype);

    proto.createdCallback = function() {

        const source = $(this).attr('source');

        let restrict;
        if ((restrict = $(this).attr('restrict'))) {
            if (/^\[/.test(restrict)) {
                const re = new RegExp(restrict);
                $(this).keydown((inEvent) => {
                    switch (inEvent.keyCode) {
                        case keycode('enter'):
                        case keycode('left'):
                        case keycode('up'):
                        case keycode('right'):
                        case keycode('down'):
                        case keycode('del'):
                        case keycode('ins'):
                        case keycode('tab'):
                        case keycode('backspace'):
                            return;

                        default:
                            const char = keycode(inEvent);
                            if (!re.test(char)) {
                                inEvent.preventDefault();
                            }
                    }

                });
            }
        }


        let target = this;

        let dataSourceName = $(this).attr('source');
        const path = $(this).attr('path');
        let dataSource = _page.getDataSource(dataSourceName);
        if (!dataSource) {
            throw new Error('Cannot bind to data-source: ' + dataSourceName);
        }
        const usePath = path && !$(this).attr('from') && !$(this).attr('to');
        const toAttr = usePath ? path : $(this).attr('to');
        const fromAttr = usePath ? path : $(this).attr('from');
        let inAttr = $(this).attr('in') || '';

        if ($(this).attr('bind-enabled')) {
            const path = $(this).attr('bind-enabled').replace('!', '');
            const negate = /^!/.test($(this).attr('bind-enabled'));
            const source = $(this).attr('source');
            const setValue = (inValue) => {
                $(this).prop('disabled',
                    ((inValue === false) && !negate) ||
                    ((inValue !== false) && negate));
            };

            _page
                .getDataSource(source)
                .bindPath(this, path, (inNewValue) => {
                    setValue(inNewValue);
                });
            _page
                .getDataSource(source)
                .resolve(this, path)
                .then((inValue) => {
                    setValue(inValue);
                });
        }



        if (fromAttr) {

            const valueResolver = (inValue) => {
                valueChangeDelegate.setValue(target, inValue);
            };

            dataSource.bindPath(this, fromAttr, function(inNewValue, inOldValue) {
                if (inNewValue !== inOldValue) {
                    valueResolver(inNewValue);
                }
            });

            dataSource.resolve(this, fromAttr).then((inValue) => {
                valueResolver(inValue);
            });
        }

        if (toAttr) {
            const outOptions = {};
            each(this.attributes, (inAttribute) => {
                if (/^out-/.test(inAttribute.name)) {
                    outOptions[inAttribute.name.replace(/^out-/, '')] = inAttribute.value;
                }
            });
            valueChangeDelegate.onValueChange(target, outOptions, (inValue) => {
                dataSource.setPath(this, toAttr, inValue.value == null ? null : inValue.value);
            });
        }

        if ($(this).attr('action')) {
            attachAction.call(this, _page, {
                name: $(this).attr('action')

            });
        }

    };

    proto.attachedCallback = function() {


    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-input2', {
        prototype: proto,
        extends: 'input'
    });
}

let _page$2;


function link(inPage) {

    _page$2 = inPage;

    var proto = Object.create(HTMLAnchorElement.prototype);

    proto.createdCallback = function() {
        $(this).prop('onclick', () =>{});
        $(this).click((e) => {
            if (!/googlebot/.test((get(window, 'navigator.userAgent') || '').toLowerCase())) {
                e.preventDefault();
            }
        });
    };

    proto.attachedCallback = function() {
        attachAction.call(this, _page$2, {
            name: $(this).attr('action'),
            trigger: $(this).attr('trigger'),
            target: 'self',
            params: (() => {
                const params = {};
                $($(this).get(0).attributes).each(function() {
                    if (/^param-/.test(this.name)) {
                        if(/^param-.*-json$/.test(this.name)) {
                            params[this.name.replace('param-', '').replace(/-json$/, '')] = JSON.parse(this.value);
                        } else {
                            params[this.name.replace('param-', '')] = this.value;    
                        }
                        
                    }
                });
                return params;
            })()
        });
    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-link', { prototype: proto, extends: 'a' });
}

const $$2 = require('jquery');

const capitalize = require('lodash.capitalize');
const each$3 = require('lodash.foreach');
const concat = require('lodash.concat');

const attachAction$1 = require('../delegate/action-trigger-delegate');
//const Binding = require('../Binding');
const ElementHTMLWiring$1 = require('../wiring/ElementHTMLWiring');
const TemplateWiring = require('../wiring/TemplateWiring');
const SignalWiring = require('../wiring/SignalWiring');
const StateWiring = require('../wiring/StateWiring');
const AttributeWiring$1 = require('../wiring/AttributeWiring');

function aeElementDefinition(inApp, inElementName) {

    const _app = inApp;


    var proto = Object.create(document.createElement(inElementName).constructor.prototype);

    proto.createdCallback = function() {
        let wirings = [];
        $$2(this).prop('ae', {
            wirings: wirings
        });

        if ($$2(this).attr('state-match')) {
            wirings.push(new StateWiring(this));
        }

        if ($$2(this).attr('from')) {
            if ($$2(this).find('>template')) {
                wirings.push(wirings, new TemplateWiring(this));
            } else {
                wirings.push(wirings, new ElementHTMLWiring$1(this));
            }
        }
        if ($$2(this).attr('bind-html')) {
            wirings.push(new ElementHTMLWiring$1(this));
        }

        $$2.each(this.attributes, (i, attrib) => {
            if (/^signal/.test(attrib.name)) {
                wirings.push(new SignalWiring(this, attrib.name));
            }
        });
        wirings.push.apply(wirings, AttributeWiring$1.wire(this, ['class', 'id', 'name', 'param', 'data', 'style']));

    };

    proto.attachedCallback = function() {
        const ae = $$2(this).prop('ae');
        each$3(ae.wirings, (wiring) => {
            wiring.attach(_app);
        });

    };

    proto.detachedCallback = function() {
        const ae = $$2(this).prop('ae');
        each$3(ae.wirings, (wiring) => {
            wiring.detach();
        });
    };


    document.registerElement('ae-' + inElementName, {
        prototype: proto,
        extends: inElementName
    });
}

$.fn.extend({
    getPath: function () {
        var path, node = this;
        while (node.length) {
            var realNode = node[0], name = realNode.localName;
            if (!name) {
                break;
            }
            name = name.toLowerCase();

            var parent = node.parent();

            var sameTagSiblings = parent.children(name);
            if (sameTagSiblings.length > 1) { 
                let allSiblings = parent.children();
                let index = allSiblings.index(realNode) + 1;
                if (index > 1) {
                    name += ':nth-child(' + index + ')';
                }
            }

            path = name + (path ? '>' + path : '');
            node = parent;
        }

        return path;
    }
});

function lang(inPage) {
    
    each(['div', 'ul', 'li', 'a', 'nav', 'span', 'main', 'section'], (inElementName) => {
        aeElementDefinition(inPage, inElementName);
    });

    aeButton(inPage);
    action(inPage);
    each$2(inPage);
    state(inPage);
    action$1(inPage);
    bind(inPage);
    render$1(inPage);
    action$2(inPage);
    render(inPage);
    aeSwitch(inPage);
    aeTextInput(inPage);
    aeButton$1(inPage);
    link(inPage);
}

const _dataSources = new Map();
const _private$4 = privateHash('component');

let _registry = new WeakMap();
const _initializers = [];
const _componentInjectors = [];

let _config;

const parseUrl = function parseUrl() {
    _private$4.get(this).startupParams = new LiteUrl(window.location.href).params;
};

const startPage = function startPage() {
    $(() => {
        this.node = $(this.mountPoint);
        $(this.mountPoint).prop('ae', this);
        lang(this);
        _private$4.get(this)
            .lifecycleSignal.dispatch('element-created');
        _private$4.get(this)
            .lifecycleSignal.dispatch('element-attached');
        if (this.config.autoRender !== false) {
            this.invalidate();
        }
    });
};

const callNextInitializer = function() {
    let initializer = _initializers.shift();
    if (!initializer) {
        startPage.call(this);
        return;
    }
    let result = initializer.call(this);
    let resultHandler = () => {
        let fn;
        while (fn = _config.components.shift()) { //jshint ignore:line
            fn(this);
        }
        if (_initializers.length) {
            callNextInitializer.call(this);
        } else {
            startPage.call(this);
        }
    };
    if (result instanceof Promise) {
        result.then(resultHandler);
    } else {
        resultHandler();
    }

};

class Page extends Component$1 {
    constructor(inConfig, inModelPrototype, inConstructor) {
        super(inConfig, inModelPrototype);
        this.page = this;
        _config = inConfig;
        parseUrl.call(this);
        this.mountPoint = inConfig.mountPoint || 'body';
        this.addDataSource('model', modelDataSource(this));
        
        inConstructor.bind(this)(inConfig);

        callNextInitializer.call(this);
    }


    get startupParams() {
        return _private$4.get(this).startupParams;
    }

    resolveNodeModel(inNode, inPath) {
        let component = this.resolveNodeComponent(inNode);
        if (!component.hasModel) {
            return this.resolveNodeModel($(component.node).parent(), inPath);
        }
        return component.model;
    }

    resolveNodeComponent(inNode) {
        let node = $(inNode).get(0);
        while (!_registry.get(node)) {
            node = $(node).parent().get(0);
            if (!node) {
                break;
            }
        }
        if (!_registry.get(node)) {
            if (get(window, 'logLevel') === 'debug') {
                console.debug('Could not find component in ancestry. Falling back to page component');
            }
            return this;
        }
        return _registry.get(node);

    }

    getResolver(inName) {
        return get(_config, 'resolvers.' + inName);
    }


    addDataSource(inName, inInitFunction) {
        _dataSources.set(inName, inInitFunction(this));
    }

    getDataSource(inName) {
        inName = inName || 'model';
        return _dataSources.get(inName);
    }

    registerInitializer(inFn) {
        _initializers.push(inFn);
    }

    registerComponentInjector(inInjectorFn) {
        _componentInjectors.push(inInjectorFn);
    }

    render(inModel) {
        super.render(inModel);
        $(this.mountPoint).css('display', '');
    }

    registerComponent(...args) {

        const constructor = args.pop();
        const config = args.shift();
        const model = args.shift();
        if (!isFunction(constructor) ||
            !isPlainObject(config)) {
            throw new Error('Page.registerComponent() usage: (config : Object, [model : Object|ObservableObject], constructor : Function');
        }
        this.registerComponentElement({
            config: config,
            modelPrototype: model,
            constructor: constructor
        });
    }

    initState() {
        let hash = window.location.hash = decodeURI(window.location.hash);

        if (/^#>[\w\-]/.test(hash)) {
            hash = hash.replace(/^#>/, '');
            if (this.states.getPath(hash)) {
                this.tryState(hash);
            }
        }

        $(window).on('hashchange', () => {
            if (/^#action:/.test(window.location.hash)) {
                const fakeUrl = new LiteUrl(window.location.hash.replace(/^#action:/, 'http://localhost/'));
                this.bus.triggerAction(fakeUrl.pathname.replace(/\//g, ''), fakeUrl.search);
                window.location.hash = '';
            }
        }).trigger('hashchange');
    }

    registerComponentElement(inDefinition) {
        var proto = Object.create(HTMLDivElement.prototype);
        var that = this;
        let component;
        const name = inDefinition.config.name;
        //        console.info('registering component: ' + name);
        document.styleSheets[0].insertRule(name + '{ display: block;}', 1);

        proto.createdCallback = function() {
            component = new Component$1(
                inDefinition.config,
                inDefinition.modelPrototype,
                inDefinition.constructor,
                that);
            _registry.set(this, component);
            component.node = this;
            Object.defineProperty(this, 'ae', {
                enumerable: false,
                configurable: false,
                writable: false,
                value: component
            });
            for (let injector of _componentInjectors) {
                injector.call(that, component);

            }
            _private$4.get(component).wirings =
                AttributeWiring.wire(this, ['class', 'id', 'name', 'param', 'data']);
            _private$4.get(component)
                .lifecycleSignal.dispatch('element-created');
        };

        proto.attachedCallback = function() {
            const component = _registry.get(this);
            each(_private$4.get(component).wirings, (wiring) => {
                wiring.attach(component.page);
            });
            if ($(this).attr('from')) {
                const from = $(this).attr('from');
                const model = that.resolveNodeModel($(this).parent());
                component.model.prop('data', model.prop('data' + (from === '.' ? '' : '.' + from)));
            }
            _private$4.get(component)
                .lifecycleSignal.dispatch('element-attached');
            if (component.config.autoRender !== false) {
                component.render.call(component);
            }
        };

        proto.detachedCallback = function() {
            each(_private$4.get(component).wirings, (wiring) => {
                wiring.detach();
            });
            _private$4.get(component)
                .lifecycleSignal.dispatch('element-detached');
            //_private.delete(component);
        };

        document.registerElement(inDefinition.config.name, {
            prototype: proto
        });

    }

}

class TemplatingDelegate {
	registerTemplate(inSource, inName) {
		//if(!inName) generate name and return it
	}

	render(inTemplateName, inModel) {
		//return promise
	}
}

function dustHelpers(dust) {
    'use strict';


    dust.helpers.re = function(chunk, context, bodies, params) {
        console.warn('params:');
        console.warn(params);
        if (!params.key || !params.match) {
            chunk.write('');
            console.warn('writing empty string');
        } else {
            console.warn('writing bodies');
            var re = new RegExp(params.match);
            if (re.test(params.key)) {
                if (bodies) {
                    chunk = chunk.render(bodies, context);
                }
            }

        }
        return chunk;
    };



    dust.filters.https = function(inUrl) {
        if (!inUrl) {
            return '';
        }
        return inUrl.toString().replace(/^(http(?:s)?):/, 'https:');
    };


    dust.filters.obscuredcreditcardnumber = function(inValue) {
        if (!isString(inValue)) {
            return;
        }
        var split = inValue.split('').reverse();
        var tail = split.splice(0, 4);
        tail.unshift('-');

        while (split.length) {
            if (split.length % 4 === 0) {
                tail.unshift('-');
            }
            tail.unshift('*');
            split.pop();
        }
        return tail.join('').replace(/--/, '-');
    };

    dust.filters.tolower = function(inValue) {
        return isString(inValue) ? inValue.toLowerCase() : inValue;
    };

    dust.filters.toupper = function(inValue) {
        return isString(inValue) ? inValue.toUpperCase() : inValue;
    };
    dust.helpers.sort = function(chunk, context, bodies, params) {
        var sort = JSON.parse(params.sort);
        var body = bodies.block;
        var sortkey;

        function isEmpty(o) {
            for (var p in o) {
                if (o.hasOwnProperty(p)) {
                    return false;
                }
            }
            return true;
        }

        if (sort) {
            delete params.sort;
        }
        if (body) {
            var cmp = function cmp(a, b) {
                return (a[sortkey] < b[sortkey]) ? -1 : ((a[sortkey] > b[sortkey]) ? 1 : 0);
            };
            
            while (sort.length) {
                sortkey = sort.pop().key;
                context.stack.head.sort(cmp);
            }
            return chunk.section(context.getPath(true, []), context, bodies, isEmpty(params) ? null : params);
        }
    };

    dust.filters.money = function(inValue) {
        var sValue = Number(inValue).toFixed(2).replace('.', ',');

        var sRegExp = new RegExp('(-?[0-9]+)([0-9]{3})');
        while (sRegExp.test(sValue)) {
            sValue = sValue.replace(sRegExp, '$1' + '.' + '$2');
        }
        return sValue;
    };

    dust.helpers.iterate = function(chunk, context, bodies, params) {
        var body = bodies.block,
            sort,
            arr,
            i,
            k,
            obj,
            compareFn;

        params = params || {};
        if(params.sortKey) {
            params.sort = params.sort || 'asc';
        }
        function desc(a, b) {
            if(params.sortKey) {
                a = get(obj, a + '.' + params.sortKey);
                b = get(obj, b + '.' + params.sortKey);
            }
            if (a < b) {
                return 1;
            } else if (a > b) {
                return -1;
            }
            return 0;
        }

        function asc(a, b) {

            if(params.sortKey) {
                a = get(obj, a + '.' + params.sortKey);
                b = get(obj, b + '.' + params.sortKey);
            }

            if (a > b) {
                return 1;
            } else if (a < b) {
                return -1;
            }
            return 0;
        }

        function processBody(key, value) {
            return body(chunk, context.push({
                $key: key,
                $value: value,
                $type: typeof value
            }));
        }

        if (params.key) {
            obj = context.resolve(params.key);
            if (obj instanceof ObservableObject) {
                obj = obj.toNative(true);
            }
            if(params.split && isString(obj)) {
                obj = obj.split(new RegExp(params.split));
            }
            if (body) {
                if (!!params.sort) {
                    sort = dust.helpers.tap(params.sort, chunk, context);
                    arr = [];
                    for (k in obj) {
                        if (obj.hasOwnProperty(k)) {
                            arr.push(k);
                        }
                    }
                    compareFn = context.global[sort];
                    if (!compareFn && sort === 'desc') {
                        compareFn = desc;
                    }
                    if (compareFn) {
                        arr.sort(compareFn);
                    } else {
                        arr.sort(asc);
                    }
                    for (i = 0; i < arr.length; i++) {
                        chunk = processBody(arr[i], obj[arr[i]]);
                    }
                } else {
                    for (k in obj) {
                        if (obj.hasOwnProperty(k)) {
                            chunk = processBody(k, obj[k]);
                        }
                    }
                }
            } else {
                console.log('Missing body block in the iter helper.');
            }
        } else {
            console.log('Missing parameter \'key\' in the iter helper.');
        }
        return chunk;

    };



    dust.helpers.length = function(chunk, context, bodies, params) {
        if (!params.key) {
            chunk.write(0);
        } else if (params.key.constructor === String || params.key.constructor === Array) {
            chunk.write(params.key.length);
        } else if (params.key.constructor === Object) {
            chunk.write(keys(params.key.constructor).length);
        }
        return chunk;
    };

    dust.helpers.calc = function(chunk, context, bodies, params) {
        var result;
        if (get(window, 'math.eval')) {
            result = get(window, 'math').eval(context.resolve(bodies.block));
        } else {
            result = context.resolve(bodies.block);
        }
        if (params.format) {
            switch (params.format) {
                case 'money':
                    result = result.toFixed(2).replace('.', ',');
                    break;
                case 'integer':
                    result = Math.round(result);
                    break;
            }
        }
        if (params.var && params.var.length) {
            context.global[params.var] = result;
            chunk.write('');
        } else {
            chunk.write(result);
        }
        return chunk;
    };


    dust.helpers.glob = function(chunk, context, bodies, params) {
        var result;
        const value = params.value;
        if (get(window, 'math.eval')) {
            result = get(window, 'math').eval(value);
        } else {
            result = value;
        }
        if (params.format) {
            switch (params.format) {
                case 'money':
                    result = result.toFixed(2).replace('.', ',');
                    break;
                case 'integer':
                    result = Math.round(result);
                    break;
            }
        }
        context.global[params.name] = result;
        chunk.write('');
        return chunk;
    };






    function log(helper, msg, level) {
        level = level || 'INFO';
        helper = helper ? '{@' + helper + '}: ' : '';
        dust.log(helper + msg, level);
    }

    var _deprecatedCache = {};

    function _deprecated(target) {
        if (_deprecatedCache[target]) {
            return;
        }
        log(target, 'Deprecation warning: ' + target + ' is deprecated and will be removed in a future version of dustjs-helpers', 'WARN');
        log(null, 'For help and a deprecation timeline, see https://github.com/linkedin/dustjs-helpers/wiki/Deprecated-Features#' + target.replace(/\W+/g, ''), 'WARN');
        _deprecatedCache[target] = true;
    }

    function isSelect(context) {
        return context.stack && context.stack.tail &&
            context.stack.tail.head &&
            typeof context.stack.tail.head.__select__ !== 'undefined';
    }

    function getSelectState(context) {
        return isSelect(context) && context.get('__select__');
    }

    /**
     * Adds a special __select__ key behind the head of the context stack. Used to maintain the state
     * of {@select} blocks
     * @param context {Context} add state to this Context
     * @param opts {Object} add these properties to the state (`key` and `type`)
     */
    function addSelectState(context, opts) {
        var head = context.stack.head,
            newContext = context.rebase(),
            key;

        if (context.stack && context.stack.tail) {
            newContext.stack = context.stack.tail;
        }

        var state = {
            isPending: false,
            isResolved: false,
            isDeferredComplete: false,
            deferreds: []
        };

        for (key in opts) {
            state[key] = opts[key];
        }

        return newContext
            .push({
                '__select__': state
            })
            .push(head, context.stack.index, context.stack.of);
    }

    /**
     * After a {@select} or {@math} block is complete, they invoke this function
     */
    function resolveSelectDeferreds(state) {
        var x, len;
        state.isDeferredPending = true;
        if (state.deferreds.length) {
            state.isDeferredComplete = true;
            for (x = 0, len = state.deferreds.length; x < len; x++) {
                state.deferreds[x]();
            }
        }
        state.isDeferredPending = false;
    }

    /**
     * Used by {@contextDump}
     */
    function jsonFilter(key, value) {
        if (typeof value === 'function') {
            return value.toString()
                .replace(/(^\s+|\s+$)/mg, '')
                .replace(/\n/mg, '')
                .replace(/,\s*/mg, ', ')
                .replace(/\)\{/mg, ') {');
        }
        return value;
    }

    /**
     * Generate a truth test helper
     */
    function truthTest(name, test) {
        return function(chunk, context, bodies, params) {
            return filter(chunk, context, bodies, params, name, test);
        };
    }

    /**
     * This function is invoked by truth test helpers
     */
    function filter(chunk, context, bodies, params, helperName, test) { //jshint ignore:line
        var body = bodies.block,
            skip = bodies['else'],
            selectState = getSelectState(context) || {},
            willResolve, key, value, type;

        // Once one truth test in a select passes, short-circuit the rest of the tests
        if (selectState.isResolved && !selectState.isDeferredPending) {
            return chunk;
        }

        // First check for a key on the helper itself, then look for a key on the {@select}
        if (params.hasOwnProperty('key')) {
            key = params.key;
        } else if (selectState.hasOwnProperty('key')) {
            key = selectState.key;
        } else {
            log(helperName, 'No key specified', 'WARN');
            return chunk;
        }

        type = params.type || selectState.type;

        key = coerce(context.resolve(key), type);
        value = coerce(context.resolve(params.value), type);

        if (test(key, value)) {
            // Once a truth test passes, put the select into 'pending' state. Now we can render the body of
            // the truth test (which may contain truth tests) without altering the state of the select.
            if (!selectState.isPending) {
                willResolve = true;
                selectState.isPending = true;
            }
            if (body) {
                chunk = chunk.render(body, context);
            }
            if (willResolve) {
                selectState.isResolved = true;
            }
        } else if (skip) {
            chunk = chunk.render(skip, context);
        }
        return chunk;
    }

    function coerce(value, type) {
        if (type) {
            type = type.toLowerCase();
        }
        switch (type) {
            case 'number':
                return +value;
            case 'string':
                return String(value);
            case 'boolean':
                value = (value === 'false' ? false : value);
                return Boolean(value);
            case 'date':
                return new Date(value);
        }

        return value;
    }

    var helpers = {

        // Utility helping to resolve dust references in the given chunk
        // uses native Dust Context#resolve (available since Dust 2.6.2)
        'tap': function(input, chunk, context) {
            // deprecated for removal in 1.8
            _deprecated('tap');
            return context.resolve(input);
        },

        'sep': function(chunk, context, bodies) {
            var body = bodies.block;
            if (context.stack.index === context.stack.of - 1) {
                return chunk;
            }
            if (body) {
                return body(chunk, context);
            } else {
                return chunk;
            }
        },

        'first': function(chunk, context, bodies) {
            if (context.stack.index === 0) {
                return bodies.block(chunk, context);
            }
            return chunk;
        },

        'last': function(chunk, context, bodies) {
            if (context.stack.index === context.stack.of - 1) {
                return bodies.block(chunk, context);
            }
            return chunk;
        },

        /**
         * {@contextDump}
         * @param key {String} set to 'full' to the full context stack, otherwise the current context is dumped
         * @param to {String} set to 'console' to log to console, otherwise outputs to the chunk
         */
        'contextDump': function(chunk, context, bodies, params) {
            var to = context.resolve(params.to),
                key = context.resolve(params.key),
                target, output;
            switch (key) {
                case 'full':
                    target = context.stack;
                    break;
                default:
                    target = context.stack.head;
            }
            output = JSON.stringify(target, jsonFilter, 2);
            switch (to) {
                case 'console':
                    log('contextDump', output);
                    break;
                default:
                    output = output.replace(/</g, '\\u003c');
                    chunk = chunk.write(output);
            }
            return chunk;
        },

        /**
         * {@math}
         * @param key first value
         * @param method {String} operation to perform
         * @param operand second value (not required for operations like `abs`)
         * @param round if truthy, round() the result
         */
        'math': function(chunk, context, bodies, params) { //jshint ignore:line
            var key = params.key,
                method = params.method,
                operand = params.operand,
                round = params.round,
                output, state, x, len;

            if (!params.hasOwnProperty('key') || !params.method) {
                log('math', '`key` or `method` was not provided', 'ERROR');
                return chunk;
            }

            key = parseFloat(context.resolve(key));
            operand = parseFloat(context.resolve(operand));

            switch (method) {
                case 'mod':
                    if (operand === 0) {
                        log('math', 'Division by 0', 'ERROR');
                    }
                    output = key % operand;
                    break;
                case 'add':
                    output = key + operand;
                    break;
                case 'subtract':
                    output = key - operand;
                    break;
                case 'multiply':
                    output = key * operand;
                    break;
                case 'divide':
                    if (operand === 0) {
                        log('math', 'Division by 0', 'ERROR');
                    }
                    output = key / operand;
                    break;
                case 'ceil':
                case 'floor':
                case 'round':
                case 'abs':
                    output = Math[method](key);
                    break;
                case 'toint':
                    output = parseInt(key, 10);
                    break;
                default:
                    log('math', 'Method `' + method + '` is not supported', 'ERROR');
            }

            if (typeof output !== 'undefined') {
                if (round) {
                    output = Math.round(output);
                }
                if (bodies && bodies.block) {
                    context = addSelectState(context, {
                        key: output
                    });
                    chunk = chunk.render(bodies.block, context);
                    resolveSelectDeferreds(getSelectState(context));
                } else {
                    chunk = chunk.write(output);
                }
            }

            return chunk;
        },

        /**
         * {@select}
         * Groups a set of truth tests and outputs the first one that passes.
         * Also contains {@any} and {@none} blocks.
         * @param key a value or reference to use as the left-hand side of comparisons
         * @param type coerce all truth test keys without an explicit type to this type
         */
        'select': function(chunk, context, bodies, params) {
            var body = bodies.block,
                state = {};

            if (params.hasOwnProperty('key')) {
                state.key = context.resolve(params.key);
            }
            if (params.hasOwnProperty('type')) {
                state.type = params.type;
            }

            if (body) {
                context = addSelectState(context, state);
                chunk = chunk.render(body, context);
                resolveSelectDeferreds(getSelectState(context));
            } else {
                log('select', 'Missing body block', 'WARN');
            }
            return chunk;
        },

        /**
         * Truth test helpers
         * @param key a value or reference to use as the left-hand side of comparisons
         * @param value a value or reference to use as the right-hand side of comparisons
         * @param type if specified, `key` and `value` will be forcibly cast to this type
         */
        'eq': truthTest('eq', function(left, right) {
            return left === right;
        }),
        'ne': truthTest('ne', function(left, right) {
            return left !== right;
        }),
        'lt': truthTest('lt', function(left, right) {
            return left < right;
        }),
        'lte': truthTest('lte', function(left, right) {
            return left <= right;
        }),
        'gt': truthTest('gt', function(left, right) {
            return left > right;
        }),
        'gte': truthTest('gte', function(left, right) {
            return left >= right;
        }),

        /**
         * {@any}
         * Outputs as long as at least one truth test inside a {@select} has passed.
         * Must be contained inside a {@select} block.
         * The passing truth test can be before or after the {@any} block.
         */
        'any': function(chunk, context, bodies, params) {
            var selectState = getSelectState(context);

            if (!selectState) {
                log('any', 'Must be used inside a {@select} block', 'ERROR');
            } else {
                if (selectState.isDeferredComplete) {
                    log('any', 'Must not be nested inside {@any} or {@none} block', 'ERROR');
                } else {
                    chunk = chunk.map(function(chunk) {
                        selectState.deferreds.push(function() {
                            if (selectState.isResolved) {
                                chunk = chunk.render(bodies.block, context);
                            }
                            chunk.end();
                        });
                    });
                }
            }
            return chunk;
        },

        /**
         * {@none}
         * Outputs if no truth tests inside a {@select} pass.
         * Must be contained inside a {@select} block.
         * The position of the helper does not matter.
         */
        'none': function(chunk, context, bodies, params) {
            var selectState = getSelectState(context);

            if (!selectState) {
                log('none', 'Must be used inside a {@select} block', 'ERROR');
            } else {
                if (selectState.isDeferredComplete) {
                    log('none', 'Must not be nested inside {@any} or {@none} block', 'ERROR');
                } else {
                    chunk = chunk.map(function(chunk) {
                        selectState.deferreds.push(function() {
                            if (!selectState.isResolved) {
                                chunk = chunk.render(bodies.block, context);
                            }
                            chunk.end();
                        });
                    });
                }
            }
            return chunk;
        },

        /**
         * {@size}
         * Write the size of the target to the chunk
         * Falsy values and true have size 0
         * Numbers are returned as-is
         * Arrays and Strings have size equal to their length
         * Objects have size equal to the number of keys they contain
         * Dust bodies are evaluated and the length of the string is returned
         * Functions are evaluated and the length of their return value is evaluated
         * @param key find the size of this value or reference
         */
        'size': function(chunk, context, bodies, params) {
            var key = params.key,
                value, k;

            key = context.resolve(params.key);
            if (!key || key === true) {
                value = 0;
            } else if (dust.isArray(key)) {
                value = key.length;
            } else if (!isNaN(parseFloat(key)) && isFinite(key)) {
                value = key;
            } else if (typeof key === 'object') {
                value = 0;
                for (k in key) {
                    if (key.hasOwnProperty(k)) {
                        value++;
                    }
                }
            } else {
                value = (key + '').length;
            }
            return chunk.write(value);
        }

    };

    for (var key in helpers) {
        dust.helpers[key] = helpers[key];
    }

    return dust;

}

dustHelpers(dust);
const _templates = new Map();
let evilFn;
let globalContext;

class DustTemplatingDelegate extends TemplatingDelegate {
    constructor(inEvilFn) {
        super();
        var n = 'EV' + 'a' + 'L';
        evilFn = inEvilFn || window[n.toLowerCase()];

        dust.collectionResolver = function(inCollection) {
            if (inCollection instanceof ObservableObject && inCollection.isCollection) {
                return inCollection.toNative();
            } else {
                return inCollection;
            }
        };

        dust.propertyResolver = function(inBase, inPath) {
            if (inBase instanceof ObservableObject) {
                if (inBase.isCollection && inPath === 'length') {
                    return inBase.length;
                } else {
                    return inBase.prop(inPath);
                }
            } else {
                return get(inBase, inPath);
            }
        };


    }

    registerExtensions(inExtensions) {
        globalContext = get(inExtensions, 'globalContext');

        each(get(inExtensions, 'filters'), (inFilter, inName) => {
            dust.filters[inName] = inFilter;
        });
        each(get(inExtensions, 'helpers'), (inHelper, inName) => {
            dust.helpers[inName] = inHelper;
        });
    }

    setCollectionResolver(inResolver) {
        dust.collectionResolver = inResolver;
    }

    setPropertyResolver(inResolver) {
        dust.propertyResolver = inResolver;
    }

    register(inName, inTemplate) {
        _templates.set(inName, inTemplate);
        dust.register(inName, inTemplate);
    }


    registerTemplate(inSource, inName) {
        inName = inName || ('template_' + uuid.v4());
        const compiledSrc = dust.compile(inSource).replace(/\bdust\b/g, '');

        const compiledFn = evilFn(compiledSrc);
        if (compiledFn instanceof Promise) {
            compiledFn.then((inFn) => {
                _templates.set(inName, inFn);
            });
        } else {
            _templates.set(inName, compiledFn);
        }
        return inName;
    }

    render(inTemplateName, inModel, inParams) {
        const template = _templates.get(inTemplateName);
        if (!template) {
            return Promise.reject(`DustTemplatingDelegate: Template with name ${inTemplateName} not found`);
        }
        var promise = new Promise((resolve, reject) => {
            if (inModel instanceof ObservableObject) {
                inModel = inModel.toNative(true);
            }
            const handler = function(inError, inHtml) {
                if (inError) {
                    reject(inError);
                } else {
                    resolve(inHtml);
                }
            };

            const glob = isFunction$1(globalContext) ? globalContext() : ( globalContext || {});
            let context = dust.makeBase(glob);
            if(inParams) {
                context = context.push(inParams);
            }
            context = context.push(inModel);
            dust.render(template, context, handler);
        });
        return promise;
    }
}
let instance;

function dustTemplatingDelegate(inEvilFn) {
    return (instance ? instance : (instance = new DustTemplatingDelegate(inEvilFn)));
}

let _templatingDelegate;
class PageFactory {
    
    getTemplatingDelegate() {
        return _templatingDelegate;
    }

    setComponentConfigPreProcessor(inFn) {
    	Object.defineProperty(this, 'componentConfigPreprocessor', { 
            get : function() { 
                return inFn;
            }
        });
    }

    page(inConfig, inModel, inSetupFunction) {
    	 _templatingDelegate = inConfig.templatingDelegate || dustTemplatingDelegate(inConfig.evilFunction);
        let page = new Page(inConfig, inModel, inSetupFunction);
        return page;
    }
}


var pageFactory = new PageFactory();

const _private = privateHash('component');

var bu = new ObservableObject();

bu.prop('geppo.il.folle', 'adriano');

console.log(JSON.stringify(bu.toNative(true)));