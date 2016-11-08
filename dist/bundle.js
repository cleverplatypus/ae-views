'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var has = _interopDefault(require('lodash.has'));
var find = _interopDefault(require('lodash.find'));
var each = _interopDefault(require('lodash.foreach'));
var isPlainObject = _interopDefault(require('lodash.isPlainObject'));
var keys = _interopDefault(require('lodash.keys'));
var isString = _interopDefault(require('lodash.isString'));
var get = _interopDefault(require('lodash.get'));
var isArray = _interopDefault(require('lodash.isArray'));
var map = _interopDefault(require('lodash.map'));
var signals = require('signals');
var isFunction = _interopDefault(require('lodash.isFunction'));
var $ = _interopDefault(require('jquery'));
var transform = _interopDefault(require('lodash.transform'));
var includes = _interopDefault(require('lodash.includes'));
var uuid = _interopDefault(require('node-uuid'));
var keycode = _interopDefault(require('keycode'));
var LiteUrl = _interopDefault(require('lite-url'));
var dust = _interopDefault(require('ae-dustjs'));
var lodash_result = require('lodash.result');
var isFunction$1 = _interopDefault(require('lodash.isfunction'));
var lodash_merge = require('lodash.merge');
var mergeWith = _interopDefault(require('lodash.mergeWith'));

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
        this.signals[inName] = new signals.Signal();
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

        const lifecycleSignal = new signals.Signal();
        const lifecycle = new ComponentLifecycle(lifecycleSignal);
        this.microtask = microtask;
        _private$5.set(this, {
            stateWatchers: new Set(),
            lifecycleSignal: lifecycleSignal,
            stateInfo: new ObservableObject(),
            resolvers : inConfig.resolvers
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

            this.unbindPath = function unbindPath() {
                //CRITICAL: to be implemented
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

function render(inPage) {
    const _private = (() => {
        const map = new WeakMap();
        return (inThis) => {
            if (!map.get(inThis)) {
                map.set(inThis, {});
            }
            return map.get(inThis);
        };
    })();

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
            let template = $(this).find('>template');
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

    };

    document.registerElement('ae-rendered', {
        prototype: proto,
        extends : 'div'
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

function each$1(inPage) {
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
//                console.log('about to call .rendered on ' + currentState.getPath());
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
        if(!_p.source) {
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
            source : $(this).attr('path') || null
        });
    };
    
    proto.attachedCallback = function() {
        const that = this;
        const _p = _private.get(this);
        _p.target = _page.resolveNodeComponent(this);
        let defaultSwitch;
        $(this).children().each(function() {
            if($(this).data('ae-switch-value') === $(that).attr('default-value')) {
                defaultSwitch = $(this);
            }
            $(this).off('click', selectHandler).on('click', () => {
                selectHandler.call(that, this);
            });
            if(defaultSwitch) {
                selectHandler.call(that, defaultSwitch);
            }
       });
    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-switch', { prototype: proto, extends : 'ul' });
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

const $$1 = require('jquery');

const capitalize = require('lodash.capitalize');
const each$2 = require('lodash.foreach');
const concat = require('lodash.concat');

const attachAction$1 = require('../delegate/action-trigger-delegate');
//const Binding = require('../Binding');
const ElementHTMLWiring$1 = require('../wiring/ElementHTMLWiring');
const TemplateWiring = require('../wiring/TemplateWiring');
const SignalWiring = require('../wiring/SignalWiring');
const AttributeWiring = require('../wiring/AttributeWiring');

function aeElementDefinition(inApp, inElementName) {

    const _app = inApp;


    var proto = Object.create(document.createElement(inElementName).constructor.prototype);

    proto.createdCallback = function() {
        let wirings = [];
        $$1(this).prop('ae', {
            wirings: wirings
        });

        if ($$1(this).attr('from')) {
            if ($$1(this).find('>template')) {
                wirings.push(wirings, new TemplateWiring(this));
            } else {
                wirings.push(wirings, new ElementHTMLWiring$1(this));
            }
        }
        if ($$1(this).attr('signal')) {
            wirings.push(new SignalWiring(this));
        }
        if ($$1(this).attr('bind-html')) {
            wirings.push(new ElementHTMLWiring$1(this));
        }

        wirings.push.apply(wirings, AttributeWiring.wire(this, ['class', 'id', 'name', 'param', 'data']));

    };

    proto.attachedCallback = function() {
        const ae = $$1(this).prop('ae');
        each$2(ae.wirings, (wiring) => {
            wiring.attach(_app);
        });

    };

    proto.detachedCallback = function() {
        const ae = $$1(this).prop('ae');
        each$2(ae.wirings, (wiring) => {
            wiring.detach();
        });
    };


    document.registerElement('ae-' + inElementName, {
        prototype: proto,
        extends: inElementName
    });
};

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
    each$1(inPage);
    state(inPage);
    action$1(inPage);
    bind(inPage);
    render$1(inPage);
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
        $(this.mountPoint).prop('ae',this);
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
            _private$4.get(component)
                .lifecycleSignal.dispatch('element-created');
        };

        proto.attachedCallback = function() {
            const component = _registry.get(this);
            if ($(this).attr('from')) {
                const from = $(this).attr('from');
                const model = that.resolveNodeModel($(this).parent());
                component.model.prop('data', model.prop('data' + ( from === '.' ? '' : '.' + from)));
            }
            _private$4.get(component)
                .lifecycleSignal.dispatch('element-attached');
            if (component.config.autoRender !== false) {
                component.render.call(component);
            }
        };

        proto.detachedCallback = function() {
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

const _setupModel = function _setupModel(inModelInitObj) {

    const _p = _private.get(this);

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

const _findState = function _findState(inStateName) {

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


const _watchState = function _watchState() {
    const _p = _private.get(this);

    _p.stateInfo.watch('nextState', (inPath, inChanges) => {
        let nextState = _findState.bind(this)(inChanges.newValue);
        if (!nextState) {
            console.warn('Changing to unknown state: ' +
                inChanges.newValue);
            return;
        }
        const rollback = (inReason) => {
            inReason && console.debug('Could not change state because: ' + inReason); //jshint ignore:line
            _p.stateInfo.prop('nextState', inChanges.oldValue, true);
            currentState.didntLeave();
            for (let watcher of _private.get(this).stateWatchers) {
                watcher(inChanges.newValue, inChanges.oldValue, inReason);
            }
        };
        let currentState = _private.get(this).stateInfo.prop('currentStateObject');
        if (currentState) {
            currentState.leaving(inChanges.newValue).then(() => {
                nextState.entering(inChanges.oldValue).then(() => {

                    _private.get(this).stateInfo.prop('currentStateObject', nextState);
                    _private.get(this).stateInfo.prop('state', _p.stateInfo.prop('nextState'));
                    currentState.left(inChanges.newValue);
                    nextState.entered(inChanges.oldValue);

                    for (let watcher of _private.get(this).stateWatchers) {
                        watcher(inChanges.newValue, inChanges.oldValue);
                    }

                }).catch(rollback);
            }).catch(rollback);
        }
    });
};



class Component {

    constructor(inConfig, inParam2, inParam3, inParam4) {
        let inInitObj, inConstructor, inPage;
        if (isFunction(inParam2)) {
            [inConstructor, inPage] = [inParam2, inParam3];
        } else {
            [inInitObj, inConstructor, inPage] = [inParam2, inParam3, inParam4];
        }

        const lifecycleSignal = new signals.Signal();
        const lifecycle = new ComponentLifecycle(lifecycleSignal);
        this.microtask = microtask;
        _private.set(this, {
            stateWatchers: new Set(),
            lifecycleSignal: lifecycleSignal,
            stateInfo: new ObservableObject(),
            resolvers : inConfig.resolvers
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

        _setupModel.call(this, inInitObj);

        for (let templateName in templates) {
            let actualTemplateName = templateName === '_default' ?
                '_default.' + this.name :
                templateName;
            pageFactory.getTemplatingDelegate()
                .register(actualTemplateName, templates[templateName]);
        }
        _private.get(this).hasDefaultTemplate = !!templates._default;
        _watchState.bind(this)();
        this.states = this.states || new State();
        _private.get(this).stateInfo.prop('currentStateObject', this.states);
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
        return get(_private.get(this), 'resolvers.' + inName);
    }

    initState() {

    }

    getCurrentState() {
        return _private.get(this).stateInfo.prop('currentStateObject');
    }

    tryState(inStateName) {
        if (inStateName === (_private.get(this).stateInfo.prop('state') || '')) {
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
            _private.get(this).stateInfo.prop('nextState', inStateName);
        });

    }

    unwatchState(inWatcherFunction) {
        _private.get(this).stateWatchers.delete(inWatcherFunction);
    }

    watchState(inWatcherFunction) {
        _private.get(this).stateWatchers.add(inWatcherFunction);
    }

    invalidate() {
        if (!_private.get(this).willRender) {
            _private.get(this).willRender = true;
            microtask(this.render.bind(this));
        }
    }

    render(inModel) {
        return new Promise((resolve, reject) => {
            _private.get(this).willRender = false;
            if (_private.get(this).hasDefaultTemplate) {
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
                        _private.get(this)
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

let _config$1;
let _model;
let _constructorFn;
class MasterPage {

    constructor(inConfig, inModel, inConstructorFn) {
        _config$1 = inConfig;
        _model = inModel;
        _constructorFn = inConstructorFn;
    }

    create(inConfig, inModel, inConstructorFn) {
        //TODO: merge params with template params. wrap constructor

        function customizer(objValue, srcValue) {
            if (isArray(objValue)) {
                return objValue.concat(srcValue);
            }
        }

        const config = {};
        mergeWith(config, _config$1, inConfig, customizer);

        // const model = {};
        // merge(model, _model, inModel);

        const constructorFn = function() {
            _constructorFn.call(this, config);
            inConstructorFn.call(this);
        };

        return pageFactory.page(config, inModel, constructorFn);
    }
}

exports.ComponentModel = ComponentModel;
exports.Component = Component;
exports.Page = Page;
exports.State = State;
exports.pagefactory = pageFactory;
exports.TemplatingDelegate = TemplatingDelegate;
exports.MasterPage = MasterPage;
exports.ObservableObject = ObservableObject;
exports.UNRESOLVED = UNRESOLVED;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L1Byb2plY3RzL2FlLXZpZXdzL3NyYy9taWNyb3Rhc2suanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9Qcm9qZWN0cy9hZS12aWV3cy9zcmMvT2JzZXJ2ZXIuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9Qcm9qZWN0cy9hZS12aWV3cy9zcmMvT2JzZXJ2YWJsZU9iamVjdC5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L1Byb2plY3RzL2FlLXZpZXdzL3NyYy9Db21wb25lbnRNb2RlbC5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L1Byb2plY3RzL2FlLXZpZXdzL3NyYy9TdGF0ZS5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L1Byb2plY3RzL2FlLXZpZXdzL3NyYy9CdXMuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9Qcm9qZWN0cy9hZS12aWV3cy9zcmMvQ29tcG9uZW50TGlmZWN5Y2xlLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvUHJvamVjdHMvYWUtdmlld3Mvc3JjL3V0aWwvcHJpdmF0ZS5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L1Byb2plY3RzL2FlLXZpZXdzL3NyYy9jb21wb25lbnQuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9Qcm9qZWN0cy9hZS12aWV3cy9zcmMvZGF0YXNvdXJjZS9tb2RlbC1kYXRhc291cmNlLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvUHJvamVjdHMvYWUtdmlld3Mvc3JjL2xhbmcvYWUtbWFuYWdlZC5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L1Byb2plY3RzL2FlLXZpZXdzL3NyYy9sYW5nL2FlLXJlbmRlcmVkLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvUHJvamVjdHMvYWUtdmlld3Mvc3JjL3N5bWJvbC91bnJlc29sdmVkLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvUHJvamVjdHMvYWUtdmlld3Mvc3JjL3V0aWwvdHlwaWZ5LXBhcmFtZXRlcnMuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9Qcm9qZWN0cy9hZS12aWV3cy9zcmMvZGVsZWdhdGUvYWN0aW9uLXRyaWdnZXItZGVsZWdhdGUuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9Qcm9qZWN0cy9hZS12aWV3cy9zcmMvbGFuZy9hZS1idXR0b24uanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9Qcm9qZWN0cy9hZS12aWV3cy9zcmMvbGFuZy9hZS1lYWNoLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvUHJvamVjdHMvYWUtdmlld3Mvc3JjL2xhbmcvYWUtc3RhdGUuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9Qcm9qZWN0cy9hZS12aWV3cy9zcmMvbGFuZy9hZS1hY3Rpb24uanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9Qcm9qZWN0cy9hZS12aWV3cy9zcmMvZGVsZWdhdGUvdmFsdWUtY2hhbmdlLWRlbGVnYXRlLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvUHJvamVjdHMvYWUtdmlld3Mvc3JjL2xhbmcvYWUtYmluZC5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L1Byb2plY3RzL2FlLXZpZXdzL3NyYy9sYW5nL2FlLXJlbmRlci5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L1Byb2plY3RzL2FlLXZpZXdzL3NyYy9sYW5nL2FlLXN3aXRjaC5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L1Byb2plY3RzL2FlLXZpZXdzL3NyYy9sYW5nL2FlLWlucHV0LmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvUHJvamVjdHMvYWUtdmlld3Mvc3JjL2xhbmcvYWUtaW5wdXQyLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvUHJvamVjdHMvYWUtdmlld3Mvc3JjL2xhbmcvYWUtbGluay5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L1Byb2plY3RzL2FlLXZpZXdzL3NyYy9sYW5nL2FlLWVsZW1lbnQuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9Qcm9qZWN0cy9hZS12aWV3cy9zcmMvbGFuZy9hZS1sYW5nLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvUHJvamVjdHMvYWUtdmlld3Mvc3JjL1BhZ2UuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9Qcm9qZWN0cy9hZS12aWV3cy9zcmMvZGVsZWdhdGUvVGVtcGxhdGluZ0RlbGVnYXRlLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvUHJvamVjdHMvYWUtdmlld3Mvc3JjL2RlbGVnYXRlL2R1c3QtaGVscGVycy5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L1Byb2plY3RzL2FlLXZpZXdzL3NyYy9kZWxlZ2F0ZS9kdXN0LXRlbXBsYXRpbmctZGVsZWdhdGUuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9Qcm9qZWN0cy9hZS12aWV3cy9zcmMvcGFnZS1mYWN0b3J5LmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvUHJvamVjdHMvYWUtdmlld3Mvc3JjL0NvbXBvbmVudC5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L1Byb2plY3RzL2FlLXZpZXdzL3NyYy9NYXN0ZXJQYWdlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIHJvb3QgPSB3aW5kb3c7XG5cbnZhciBkZWZlciwgT2JzZXJ2ZXI7XG5cbmlmIChyb290LnByb2Nlc3MgJiYgdHlwZW9mIHJvb3QucHJvY2Vzcy5uZXh0VGljayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIC8qIGF2b2lkIGJ1Z2d5IG5vZGVqcyBzZXRJbW1lZGlhdGUgKi9cbiAgICBpZiAocm9vdC5zZXRJbW1lZGlhdGUgJiYgcm9vdC5wcm9jZXNzLnZlcnNpb25zLm5vZGUuc3BsaXQoJy4nKVsxXSA+ICcxMCcpIHtcbiAgICAgICAgZGVmZXIgPSByb290LnNldEltbWVkaWF0ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBkZWZlciA9IHJvb3QucHJvY2Vzcy5uZXh0VGljaztcbiAgICB9XG59IGVsc2UgaWYgKHJvb3QudmVydHggJiYgdHlwZW9mIHJvb3QudmVydHgucnVuT25Mb29wID09PSAnZnVuY3Rpb24nKSB7XG4gICAgZGVmZXIgPSByb290LnZlcnR4LlJ1bk9uTG9vcDtcbn0gZWxzZSBpZiAocm9vdC52ZXJ0eCAmJiB0eXBlb2Ygcm9vdC52ZXJ0eC5ydW5PbkNvbnRleHQgPT09ICdmdW5jdGlvbicpIHtcbiAgICBkZWZlciA9IHJvb3QudmVydHgucnVuT25Db250ZXh0O1xufSBlbHNlIGlmICgoT2JzZXJ2ZXIgPSByb290Lk11dGF0aW9uT2JzZXJ2ZXIgfHwgcm9vdC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyKSkge1xuICAgIGRlZmVyID0gKGZ1bmN0aW9uKGRvY3VtZW50LCBPYnNlcnZlciwgZHJhaW4pIHtcbiAgICAgICAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIG5ldyBPYnNlcnZlcihkcmFpbikub2JzZXJ2ZShlbCwge1xuICAgICAgICAgICAgYXR0cmlidXRlczogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgZWwuc2V0QXR0cmlidXRlKCd4JywgJ3knKTtcbiAgICAgICAgfTtcbiAgICB9KGRvY3VtZW50LCBPYnNlcnZlciwgZHJhaW4pKTtcbn0gZWxzZSBpZiAodHlwZW9mIHJvb3Quc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJyAmJiAocm9vdC5BY3RpdmVYT2JqZWN0IHx8ICFyb290LnBvc3RNZXNzYWdlKSkge1xuICAgIC8qIHVzZSBzZXRUaW1lb3V0IHRvIGF2b2lkIGJ1Z2d5IElFIE1lc3NhZ2VDaGFubmVsICovXG4gICAgZGVmZXIgPSBmdW5jdGlvbihmKSB7XG4gICAgICAgIHJvb3Quc2V0VGltZW91dChmLCAwKTtcbiAgICB9O1xufSBlbHNlIGlmIChyb290Lk1lc3NhZ2VDaGFubmVsICYmIHR5cGVvZiByb290Lk1lc3NhZ2VDaGFubmVsID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdmFyIGZpZm8gPSBbXSxcbiAgICAgICAgY2hhbm5lbCA9IG5ldyByb290Lk1lc3NhZ2VDaGFubmVsKCk7XG4gICAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgKGZpZm8uc2hpZnQoKSkoKTtcbiAgICB9O1xuICAgIGRlZmVyID0gZnVuY3Rpb24oZikge1xuICAgICAgICBmaWZvW2ZpZm8ubGVuZ3RoXSA9IGY7XG4gICAgICAgIGNoYW5uZWwucG9ydDIucG9zdE1lc3NhZ2UoMCk7XG4gICAgfTtcbn0gZWxzZSBpZiAodHlwZW9mIHJvb3Quc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGRlZmVyID0gZnVuY3Rpb24oZikge1xuICAgICAgICByb290LnNldFRpbWVvdXQoZiwgMCk7XG4gICAgfTtcbn0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdubyBjYW5kaWRhdGUgZm9yIGRlZmVyJyk7XG59XG5cbmxldCBxdWV1ZSA9IFtdLFxuICAgIGxlbmd0aCA9IDA7IC8vanNoaW50IGlnbm9yZTpsaW5lXG5cbmZ1bmN0aW9uIG1pY3JvdGFzayhmdW5jLCBhcmdzLCBjdHgsIGVycikge1xuICAgIGlmICghbGVuZ3RoKSB7XG4gICAgICAgIGRlZmVyKGRyYWluKTtcbiAgICB9XG5cbiAgICBxdWV1ZVtsZW5ndGgrK10gPSBbZnVuYywgYXJncywgY3R4LCBlcnJdO1xufVxuXG5mdW5jdGlvbiBkcmFpbigpIHtcbiAgICB2YXIgcSA9IHF1ZXVlLFxuICAgICAgICBsID0gbGVuZ3RoO1xuXG4gICAgcXVldWUgPSBbXTtcbiAgICBsZW5ndGggPSAwO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHFbaV1bMF0uYXBwbHkocVtpXVsyXSwgcVtpXVsxXSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBxW2ldWzNdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgcVtpXVszXShlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuZXhwb3J0IGRlZmF1bHQgbWljcm90YXNrO1xuIiwiJ3VzZSBzdHJpY3QnO1xuaW1wb3J0IG1pY3JvdGFzayBmcm9tICcuL21pY3JvdGFzayc7XG5cbmNvbnN0IF9xdWV1ZSA9IG5ldyBNYXAoKTtcbmltcG9ydCBoYXMgZnJvbSAnbG9kYXNoLmhhcyc7XG5pbXBvcnQgZmluZCBmcm9tICdsb2Rhc2guZmluZCc7XG5pbXBvcnQgZWFjaCBmcm9tICdsb2Rhc2guZm9yZWFjaCc7XG5sZXQgX3dpbGxOb3RpZnkgPSBmYWxzZTtcblxuY29uc3QgX3ByaXZhdGUgPSBuZXcgV2Vha01hcCgpO1xuXG5jb25zdCBfZW1pdCA9IGZ1bmN0aW9uKCkge1xuICAgIGZvciAobGV0IGYgb2YgX3F1ZXVlLmtleXMoKSkge1xuICAgICAgICBsZXQgaW5mbyA9IF9xdWV1ZS5nZXQoZik7XG4gICAgICAgIGZvciAobGV0IGkgb2YgaW5mbykge1xuICAgICAgICAgICAgZihpLnBhdGgsIGkuY2hhbmdlcyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgX3F1ZXVlLmNsZWFyKCk7XG4gICAgX3dpbGxOb3RpZnkgPSBmYWxzZTtcbn07XG5cbmNsYXNzIE9ic2VydmVyIHtcbiAgICBjb25zdHJ1Y3RvcihpblBhcmVudCkge1xuICAgICAgICBfcHJpdmF0ZS5zZXQodGhpcywge1xuICAgICAgICAgICAgcGFyZW50OiBpblBhcmVudCxcbiAgICAgICAgICAgIGxpc3RlbmVyczogbmV3IFNldCgpLFxuICAgICAgICAgICAgY2hpbGRyZW5MaXN0ZW5lcnM6IG5ldyBTZXQoKSxcbiAgICAgICAgICAgIGRlc2NlbmRhbnRMaXN0ZW5lcnM6IG5ldyBTZXQoKSxcbiAgICAgICAgICAgIGNoaWxkcmVuOiB7fVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuICAgIHVubGlzdGVuKGluTGlzdGVuZXJGbiwgaW5QYXRoKSB7XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgICAgICBmb3IobGV0IGxpc3RlbmVyIG9mIF9wLmxpc3RlbmVycykge1xuICAgICAgICAgICAgaWYobGlzdGVuZXIuaGFuZGxlciA9PT0gaW5MaXN0ZW5lckZuKSB7XG4gICAgICAgICAgICAgICAgX3AubGlzdGVuZXJzLmRlbGV0ZShsaXN0ZW5lcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yKGxldCBsaXN0ZW5lciBvZiBfcC5jaGlsZHJlbkxpc3RlbmVycykge1xuICAgICAgICAgICAgaWYobGlzdGVuZXIuaGFuZGxlciA9PT0gaW5MaXN0ZW5lckZuKSB7XG4gICAgICAgICAgICAgICAgX3AuY2hpbGRyZW5MaXN0ZW5lcnMuZGVsZXRlKGxpc3RlbmVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IobGV0IGxpc3RlbmVyIG9mIF9wLmRlc2NlbmRhbnRMaXN0ZW5lcnMpIHtcbiAgICAgICAgICAgIGlmKGxpc3RlbmVyLmhhbmRsZXIgPT09IGluTGlzdGVuZXJGbikge1xuICAgICAgICAgICAgICAgIF9wLmRlc2NlbmRhbnRMaXN0ZW5lcnMuZGVsZXRlKGxpc3RlbmVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlYWNoKF9wLmNoaWxkcmVuLCAoaW5DaGlsZE9ic2VydmVyKSA9PiB7XG4gICAgICAgICAgICBpbkNoaWxkT2JzZXJ2ZXIudW5saXN0ZW4oaW5MaXN0ZW5lckZuLCBpblBhdGgpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBoYXNMaXN0ZW5lcnMoKSB7XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgICAgICByZXR1cm4gX3AubGlzdGVuZXJzLnNpemUgPiAwIHx8IF9wLmNoaWxkcmVuTGlzdGVuZXJzLnNpemUgPiAwIHx8IF9wLmRlc2NlbmRhbnRMaXN0ZW5lcnMuc2l6ZSA+IDA7XG4gICAgfVxuXG4gICAgbGlzdGVuKGluUGF0aCwgaW5MaXN0ZW5lcikge1xuICAgICAgICBpZiAoIWluUGF0aCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgICAgICBjb25zdCBzZWdzID0gaW5QYXRoID8gaW5QYXRoLnNwbGl0KCcuJykgOiBbXTtcbiAgICAgICAgY29uc3QgcHJvcE5hbWUgPSBzZWdzLnNoaWZ0KCk7XG4gICAgICAgIGlmICgvXlxcdyskLy50ZXN0KHByb3BOYW1lKSkge1xuICAgICAgICAgICAgX3AuY2hpbGRyZW5bcHJvcE5hbWVdID0gX3AuY2hpbGRyZW5bcHJvcE5hbWVdIHx8IG5ldyBPYnNlcnZlcih0aGlzKTtcbiAgICAgICAgICAgIGlmIChzZWdzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIF9wLmNoaWxkcmVuW3Byb3BOYW1lXS5saXN0ZW4oc2Vncy5qb2luKCcuJyksIGluTGlzdGVuZXIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfcC5saXN0ZW5lcnMuYWRkKHsgaGFuZGxlciA6IGZ1bmN0aW9uKGluTm90aWZpZWRQYXRoLCBpbkNoYW5nZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluTm90aWZpZWRQYXRoID09PSBpblBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluTGlzdGVuZXIoaW5Ob3RpZmllZFBhdGgsIGluQ2hhbmdlcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9fSk7XG4gICAgICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KF9wLmNoaWxkcmVuW3Byb3BOYW1lXSkubGlzdGVuZXJzLmFkZCh7IGhhbmRsZXIgOiBpbkxpc3RlbmVyfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAocHJvcE5hbWUgPT09ICcqJykge1xuICAgICAgICAgICAgLy9fcC5jaGlsZHJlbkxpc3RlbmVycy5hZGQoaW5MaXN0ZW5lcik7XG4gICAgICAgICAgICBfcC5saXN0ZW5lcnMuYWRkKHtoYW5kbGVyIDogaW5MaXN0ZW5lcn0pO1xuXG4gICAgICAgIH0gZWxzZSBpZiAocHJvcE5hbWUgPT09ICcqKicpIHtcbiAgICAgICAgICAgIF9wLmRlc2NlbmRhbnRMaXN0ZW5lcnMuYWRkKHtoYW5kbGVyIDogaW5MaXN0ZW5lcn0pO1xuICAgICAgICAgICAgLy8gX3AubGlzdGVuZXJzLmFkZChpbkxpc3RlbmVyKTtcbiAgICAgICAgfSBlbHNlIGlmKCAvXFxbXFx3K1xcXS8udGVzdChwcm9wTmFtZSkpIHtcbiAgICAgICAgICAgIF9wLmxpc3RlbmVycy5hZGQoe2hhbmRsZXIgOiAoaW5QYXRoLCBpbkNoYW5nZXMpID0+IHtcbiAgICAgICAgICAgICAgICBpZihpblBhdGggPT09IHByb3BOYW1lLnJlcGxhY2UoL1xcVy9nLCAnJykpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5MaXN0ZW5lcihpblBhdGgsIGluQ2hhbmdlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfX0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbm90aWZ5KGluUGF0aCwgaW5DaGFuZ2VzKSB7XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgICAgICBjb25zdCBzZWdzID0gaW5QYXRoID8gaW5QYXRoLnNwbGl0KCcuJykgOiBbXTtcbiAgICAgICAgY29uc3QgcHJvcE5hbWUgPSBzZWdzLnNoaWZ0KCk7XG4gICAgICAgIGxldCBzaG91bGRUcmlnZ2VyID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IHB1c2hRdWV1ZSA9IGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICBpZiAoIV9xdWV1ZS5oYXMoZm4pKSB7XG4gICAgICAgICAgICAgICAgX3F1ZXVlLnNldChmbiwgW10pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoZmluZChfcXVldWUuZ2V0KGZuKSwgeyBwYXRoIDogaW5QYXRofSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBfcXVldWUuZ2V0KGZuKS5wdXNoKHsgcGF0aDogaW5QYXRoLCBjaGFuZ2VzOiBpbkNoYW5nZXMgfSk7XG4gICAgICAgIH07XG4gICAgICAgIGlmIChwcm9wTmFtZSkge1xuICAgICAgICAgICAgaWYgKGhhcyhfcC5jaGlsZHJlbiwgcHJvcE5hbWUpICYmIHNlZ3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgX3AuY2hpbGRyZW5bcHJvcE5hbWVdLm5vdGlmeShzZWdzLmpvaW4oJy4nKSwgaW5DaGFuZ2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghc2Vncy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzaG91bGRUcmlnZ2VyID0gc2hvdWxkVHJpZ2dlciB8fCBfcC5saXN0ZW5lcnMuc2l6ZTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBsIG9mIF9wLmxpc3RlbmVycykge1xuICAgICAgICAgICAgICAgICAgICBwdXNoUXVldWUobC5oYW5kbGVyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzaG91bGRUcmlnZ2VyID0gc2hvdWxkVHJpZ2dlciB8fCBfcC5jaGlsZHJlbkxpc3RlbmVycy5zaXplO1xuICAgICAgICAgICAgZm9yIChsZXQgbCBvZiBfcC5jaGlsZHJlbkxpc3RlbmVycykge1xuICAgICAgICAgICAgICAgIHB1c2hRdWV1ZShsLmhhbmRsZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2hvdWxkVHJpZ2dlciA9IHNob3VsZFRyaWdnZXIgfHwgX3AuZGVzY2VuZGFudExpc3RlbmVycy5zaXplO1xuICAgICAgICAgICAgZm9yIChsZXQgbCBvZiBfcC5kZXNjZW5kYW50TGlzdGVuZXJzKSB7XG4gICAgICAgICAgICAgICAgcHVzaFF1ZXVlKGwuaGFuZGxlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzaG91bGRUcmlnZ2VyID0gc2hvdWxkVHJpZ2dlciB8fCBfcC5saXN0ZW5lcnMuc2l6ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGwgb2YgX3AubGlzdGVuZXJzKSB7XG4gICAgICAgICAgICAgICAgcHVzaFF1ZXVlKGwuaGFuZGxlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIV93aWxsTm90aWZ5ICYmIHNob3VsZFRyaWdnZXIpIHtcbiAgICAgICAgICAgIG1pY3JvdGFzayhfZW1pdCwgW2luUGF0aCwgaW5DaGFuZ2VzXSk7XG4gICAgICAgICAgICBfd2lsbE5vdGlmeSA9IHRydWU7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGJ1YmJsZShwYXRoLCBjaGFuZ2VzKSB7XG5cbiAgICB9XG5cbiAgICBzdGF0aWMgdGFyZ2V0KGJhc2UsIHBhdGgsIGNoYW5nZXMpIHtcblxuICAgIH1cbn1cbmV4cG9ydCBkZWZhdWx0IE9ic2VydmVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuaW1wb3J0IE9ic2VydmVyIGZyb20gJy4vT2JzZXJ2ZXInO1xuaW1wb3J0IGlzUGxhaW5PYmplY3QgZnJvbSAnbG9kYXNoLmlzUGxhaW5PYmplY3QnO1xuaW1wb3J0IGtleXMgZnJvbSAnbG9kYXNoLmtleXMnO1xuaW1wb3J0IGVhY2ggZnJvbSAnbG9kYXNoLmZvcmVhY2gnO1xuaW1wb3J0IGlzU3RyaW5nIGZyb20gJ2xvZGFzaC5pc1N0cmluZyc7XG5pbXBvcnQgZ2V0IGZyb20gJ2xvZGFzaC5nZXQnO1xuaW1wb3J0IGlzQXJyYXkgZnJvbSAnbG9kYXNoLmlzQXJyYXknO1xuXG5cbmNvbnN0IF9wcml2YXRlID0gbmV3IFdlYWtNYXAoKTtcblxuXG5jbGFzcyBEdW1teSB7XG4gICAgY29uc3RydWN0b3IoaW5Jc0NvbGxlY3Rpb24pIHtcbiAgICAgICAgdGhpcy5fb2JqID0gaW5Jc0NvbGxlY3Rpb24gPyBbXSA6IHt9O1xuICAgICAgICBfcHJpdmF0ZS5zZXQodGhpcywge1xuXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBwcm9wKGluTmFtZSwgaW5WYWx1ZSkge1xuICAgICAgICBpZiAoaW5WYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl9vYmpbaW5OYW1lXSA9IGluVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fb2JqW2luTmFtZV07XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNsYXNzIE9ic2VydmFibGVPYmplY3Qge1xuXG4gICAgY29uc3RydWN0b3IoaW5Db25maWcpIHtcbiAgICAgICAgY29uc3QgaXNDb2xsZWN0aW9uID0gKGdldChpbkNvbmZpZywgJ2lzQ29sbGVjdGlvbicpID09PSB0cnVlKTtcbiAgICAgICAgX3ByaXZhdGUuc2V0KHRoaXMsIHtcbiAgICAgICAgICAgIGlzU2lsZW50OiBmYWxzZSxcbiAgICAgICAgICAgIGlzQ29sbGVjdGlvbjogaXNDb2xsZWN0aW9uLFxuICAgICAgICAgICAgY2hhbmdlc1F1ZXVlOiBbXSxcbiAgICAgICAgICAgIG9ic2VydmVyOiBuZXcgT2JzZXJ2ZXIoKSxcbiAgICAgICAgICAgIHByb3BzOiBuZXcgRHVtbXkoaXNDb2xsZWN0aW9uKSxcbiAgICAgICAgICAgIHNldFByb3A6IGZ1bmN0aW9uKGluUGF0aCwgaW5WYWx1ZSwgaW5CYWNrUGF0aCwgaW5BbHJlYWR5Rm91bmRDaGFuZ2UpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHBhdGggPSAhaXNOYU4oaW5QYXRoKSA/IFtpblBhdGhdIDogaW5QYXRoLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICAgICAgdmFyIGxvY2FsUHJvcCA9IHBhdGguc2hpZnQoKTtcblxuICAgICAgICAgICAgICAgIGluQmFja1BhdGggPSBpbkJhY2tQYXRoIHx8IFtdO1xuICAgICAgICAgICAgICAgIGluQmFja1BhdGgucHVzaChsb2NhbFByb3ApO1xuICAgICAgICAgICAgICAgIGxldCBvdXQ7XG5cbiAgICAgICAgICAgICAgICBsZXQgdmFsID0gX3AucHJvcHMucHJvcChsb2NhbFByb3ApO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFwYXRoLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBfcC5wcm9wcy5wcm9wKGxvY2FsUHJvcCwgT2JzZXJ2YWJsZU9iamVjdC5mcm9tT2JqZWN0KGluVmFsdWUpKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKF9wLm9ic2VydmVyLmhhc0xpc3RlbmVycygpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIF9wLmNoYW5nZXNRdWV1ZS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiBsb2NhbFByb3AsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IHZhbCA9PT0gdW5kZWZpbmVkID8gJ2FkZCcgOiAncmVwbGFjZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiB2YWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbHVlOiBfcC5wcm9wcy5wcm9wKGxvY2FsUHJvcClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgT2JzZXJ2YWJsZU9iamVjdC5ub3RpZnlXYXRjaGVycyhfcCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGluQWxyZWFkeUZvdW5kQ2hhbmdlID8gbnVsbCA6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IGluQmFja1BhdGguam9pbignLicpLFxuICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogdmFsID09PSB1bmRlZmluZWQgPyAnYWRkJyA6ICdyZXBsYWNlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogdmFsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbHVlOiBfcC5wcm9wcy5wcm9wKGxvY2FsUHJvcClcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsZXQgYWxyZWFkeUZvdW5kID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWwgPT09IHVuZGVmaW5lZCB8fCB2YWwgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbCA9IG5ldyBPYnNlcnZhYmxlT2JqZWN0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBfcC5wcm9wcy5wcm9wKGxvY2FsUHJvcCwgdmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9wLmNoYW5nZXNRdWV1ZS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiBwYXRoLmpvaW4oJy4nKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FkZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbHVlOiBfcC5wcm9wcy5wcm9wKGxvY2FsUHJvcClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgT2JzZXJ2YWJsZU9iamVjdC5ub3RpZnlXYXRjaGVycyhfcCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdXQgPSBpbkFscmVhZHlGb3VuZENoYW5nZSA/IG51bGwgOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogaW5CYWNrUGF0aC5qb2luKCcuJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhZGQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdWYWx1ZTogX3AucHJvcHMucHJvcChsb2NhbFByb3ApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFscmVhZHlGb3VuZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbGV0IHJlc3VsdCA9IF9wcml2YXRlLmdldCh2YWwpLnNldFByb3AocGF0aC5qb2luKCcuJyksIGluVmFsdWUsIGluQmFja1BhdGgsIGFscmVhZHlGb3VuZCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAocmVzdWx0ID8gcmVzdWx0IDogb3V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcylcbiAgICAgICAgfSk7XG5cbiAgICB9XG5cbiAgICAqIFtTeW1ib2wuaXRlcmF0b3JdKCkge1xuICAgICAgICBjb25zdCBzcmMgPSBfcHJpdmF0ZS5nZXQodGhpcykucHJvcHMuX29iajtcbiAgICAgICAgaWYgKHRoaXMuaXNDb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpdGVtIG9mIHNyYykge1xuICAgICAgICAgICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKGxldCBrZXkgaW4gc3JjKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3V0ID0ge307XG4gICAgICAgICAgICAgICAgb3V0W2tleV0gPSBzcmNba2V5XTtcbiAgICAgICAgICAgICAgICB5aWVsZCBvdXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIGZpbGwoaW5EYXRhLCBpblBhdGgsIGluU2lsZW50KSB7XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgICAgICBpZiAoIWluUGF0aCkge1xuICAgICAgICAgICAgX3AucHJvcHMuX29iaiA9IHRoaXMuaXNDb2xsZWN0aW9uID8gW10gOiB7fTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnByb3AoaW5QYXRoKSBpbnN0YW5jZW9mIE9ic2VydmFibGVPYmplY3QpIHtcbiAgICAgICAgICAgIHRoaXMucHJvcChpblBhdGgpLmVtcHR5KCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoa2V5cyhpbkRhdGEpLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5tZXJnZShpbkRhdGEsIGluUGF0aCwgaW5TaWxlbnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKCFpblNpbGVudCkge1xuICAgICAgICAgICAgICAgIF9wLmNoYW5nZXNRdWV1ZS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogJycsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2VtcHRpZWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsdWU6IF9wLnByb3BzLl9vYmpcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIE9ic2VydmFibGVPYmplY3Qubm90aWZ5V2F0Y2hlcnMoX3ApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgIH1cblxuICAgIG1lcmdlKGluRGF0YSwgaW5QYXRoLCBpblNpbGVudCkge1xuXG4gICAgICAgIGlmICghaXNQbGFpbk9iamVjdChpbkRhdGEpICYmICFpc0FycmF5KGluRGF0YSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignT2JzZXJ2YWJsZU9iamVjdC5maWxsKCkgbXVzdCBiZSBwYXNzZWQgYSBwbGFpbiBvYmplY3QnKTtcbiAgICAgICAgfVxuICAgICAgICBlYWNoKGluRGF0YSwgKGluVmFsdWUsIGluS2V5KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXRoID0gKGluUGF0aCA/IGluUGF0aCArICcuJyA6ICcnKSArIGluS2V5O1xuICAgICAgICAgICAgdGhpcy5wcm9wKHBhdGgsIE9ic2VydmFibGVPYmplY3QuZnJvbU9iamVjdChpblZhbHVlKSwgaW5TaWxlbnQpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZnJvbU9iamVjdChpbkRhdGEpIHtcbiAgICAgICAgaWYgKGlzQXJyYXkoaW5EYXRhKSkge1xuICAgICAgICAgICAgbGV0IGEgPSBuZXcgT2JzZXJ2YWJsZU9iamVjdCh7XG4gICAgICAgICAgICAgICAgaXNDb2xsZWN0aW9uOiB0cnVlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGVhY2goaW5EYXRhLCBmdW5jdGlvbihpblZhbCwgaW5LZXkpIHtcbiAgICAgICAgICAgICAgICBhLnByb3AoaW5LZXksIE9ic2VydmFibGVPYmplY3QuZnJvbU9iamVjdChpblZhbCkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gYTtcbiAgICAgICAgfSBlbHNlIGlmIChpc1BsYWluT2JqZWN0KGluRGF0YSkpIHtcbiAgICAgICAgICAgIGxldCBvID0gbmV3IE9ic2VydmFibGVPYmplY3QoKTtcbiAgICAgICAgICAgIGVhY2goaW5EYXRhLCBmdW5jdGlvbihpblZhbCwgaW5LZXkpIHtcbiAgICAgICAgICAgICAgICBvLnByb3AoaW5LZXksIE9ic2VydmFibGVPYmplY3QuZnJvbU9iamVjdChpblZhbCkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gbztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBpbkRhdGE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgcHJvcChpbkJhc2UsIGluUGF0aCkge1xuICAgICAgICBpZiAoIWluQmFzZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICghKGluQmFzZSBpbnN0YW5jZW9mIE9ic2VydmFibGVPYmplY3QpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGluQmFzZS5wcm9wKGluUGF0aCk7XG4gICAgfVxuXG4gICAgZHVtbXkoKSB7XG4gICAgICAgIHJldHVybiBfcHJpdmF0ZS5nZXQodGhpcyk7XG4gICAgfVxuXG4gICAgZ2V0IGlzQ29sbGVjdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIF9wcml2YXRlLmdldCh0aGlzKS5pc0NvbGxlY3Rpb247XG4gICAgfVxuXG4gICAgZ2V0IGxlbmd0aCgpIHtcbiAgICAgICAgY29uc3QgX3AgPSBfcHJpdmF0ZS5nZXQodGhpcyk7XG4gICAgICAgIGlmIChfcC5pc0NvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgIHJldHVybiBrZXlzKF9wLnByb3BzLl9vYmopLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHByb3AoaW5QYXRoLCBpblZhbHVlLCBpblNpbGVudCkgeyAvL2pzaGludCBpZ25vcmU6bGluZVxuICAgICAgICBpZiAoaW5QYXRoICE9PSAwICYmICFpblBhdGgpIHsgLy9wYXRoIGNhbiBiZSBhbiBpbmRleC4gIWluUGF0aCB3b3VsZCBpZ25vcmUgemVybyBhcyBhIHByb3BlcnR5XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcbiAgICAgICAgY29uc3QgbXlQcm9wcyA9IF9wLnByb3BzO1xuICAgICAgICBjb25zdCBwYXRoID0gIWlzTmFOKGluUGF0aCkgPyBbaW5QYXRoXSA6IGluUGF0aC5zcGxpdCgnLicpO1xuICAgICAgICB2YXIgcHJvcE5hbWUgPSBwYXRoLnNoaWZ0KCk7XG4gICAgICAgIGlmIChfcC5pc0NvbGxlY3Rpb24gJiYgaXNOYU4ocHJvcE5hbWUpICYmIHByb3BOYW1lICE9PSAnbGVuZ3RoJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb2xsZWN0aW9uIE9ic2VydmFibGVPYmplY3QgY2FuIG9ubHkgaGF2ZSBudW1iZXJzIGFzIGtleXMnKTtcbiAgICAgICAgfSBlbHNlIGlmIChfcC5pc0NvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgIHByb3BOYW1lID0gIWlzTmFOKHByb3BOYW1lKSA/IHBhcnNlSW50KHByb3BOYW1lKSA6IHByb3BOYW1lO1xuICAgICAgICAgICAgaWYgKGlzTmFOKHByb3BOYW1lKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmxlbmd0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5WYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAobXlQcm9wcy5wcm9wKHByb3BOYW1lKSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHBhdGgubGVuZ3RoICYmICEobXlQcm9wcy5wcm9wKHByb3BOYW1lKSBpbnN0YW5jZW9mIE9ic2VydmFibGVPYmplY3QpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybigndHJ5aW5nIHRvIGFjY2VzcyBwYXRoIHRocm91Z2ggYSBub24gdHJhdmVyc2FibGUgcHJvcGVydHknKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHBhdGgubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBteVByb3BzLnByb3AocHJvcE5hbWUpLnByb3AocGF0aC5qb2luKCcuJykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbXlQcm9wcy5wcm9wKHByb3BOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGJyYW5jaCA9IFtdO1xuICAgICAgICAgICAgdmFyIGNoYW5nZSA9IF9wLnNldFByb3AoaW5QYXRoLCBpblZhbHVlLCBicmFuY2gpO1xuICAgICAgICAgICAgaWYgKCFpblNpbGVudCkge1xuICAgICAgICAgICAgICAgIF9wLmNoYW5nZXNRdWV1ZS5wdXNoKGNoYW5nZSk7XG4gICAgICAgICAgICAgICAgT2JzZXJ2YWJsZU9iamVjdC5ub3RpZnlXYXRjaGVycyhfcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gaW5WYWx1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLy9UT0RPOiBpbXBsZW1lbnQgZXZlbnQtc3BlY2lmaWMgd2F0Y2hcbiAgICB3YXRjaChpblBhdGgsIGluSGFuZGxlciwgaW5FdmVudCkge1xuICAgICAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcbiAgICAgICAgX3Aub2JzZXJ2ZXIubGlzdGVuKGluUGF0aCwgaW5IYW5kbGVyLCBpbkV2ZW50KTtcbiAgICB9XG5cbiAgICB1bndhdGNoKGluSGFuZGxlciwgaW5QYXRoKSB7XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgICAgICBfcC5vYnNlcnZlci51bmxpc3RlbihpbkhhbmRsZXIsIGluUGF0aCk7XG4gICAgfVxuXG4gICAgdG9OYXRpdmUoaW5EZWVwKSB7XG4gICAgICAgIHZhciBvdXQgPSBfcHJpdmF0ZS5nZXQodGhpcykuaXNDb2xsZWN0aW9uID8gW10gOiB7fTtcbiAgICAgICAgZWFjaChfcHJpdmF0ZS5nZXQodGhpcykucHJvcHMuX29iaiwgKGluVmFsLCBpbktleSkgPT4ge1xuICAgICAgICAgICAgbGV0IGlzT2JzZXJ2YWJsZSA9IGluVmFsIGluc3RhbmNlb2YgT2JzZXJ2YWJsZU9iamVjdDtcbiAgICAgICAgICAgIG91dFtpbktleV0gPSBpc09ic2VydmFibGUgJiYgaW5EZWVwID09PSB0cnVlID8gaW5WYWwudG9OYXRpdmUodHJ1ZSkgOiBpblZhbDtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBvdXQ7XG4gICAgfVxuXG4gICAgc29ydChpbkNvbXBhcmF0b3IpIHtcbiAgICAgICAgaWYgKF9wcml2YXRlLmdldCh0aGlzKS5pc0NvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS5wcm9wcy5fb2JqLnNvcnQoaW5Db21wYXJhdG9yKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBzdGF0aWMgbm90aWZ5V2F0Y2hlcnMoaW5JbnN0YW5jZSkge1xuICAgICAgICBpZiAoaW5JbnN0YW5jZS5pc1NpbGVudCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGMgb2YgaW5JbnN0YW5jZS5jaGFuZ2VzUXVldWUpIHtcbiAgICAgICAgICAgIGluSW5zdGFuY2Uub2JzZXJ2ZXIubm90aWZ5KGMucGF0aCwgYy5jaGFuZ2UpO1xuICAgICAgICB9XG4gICAgICAgIGluSW5zdGFuY2UuY2hhbmdlc1F1ZXVlID0gW107XG5cbiAgICB9XG5cbiAgICBzdGF0aWMgZmlsbChpblRhcmdldCwgaW5QYXRoLCBpbkNvbnRlbnQsIGluU2lsZW50KSB7XG4gICAgICAgIGlmICghaW5UYXJnZXQgfHwgIShpblRhcmdldCBpbnN0YW5jZW9mIE9ic2VydmFibGVPYmplY3QpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ZpbGwoKSBjYW4gb25seSBiZSBpbnZva2VkIG9uIGFuIE9ic2VydmFibGVPYmplY3QnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWluVGFyZ2V0IHx8ICEoaW5UYXJnZXQgaW5zdGFuY2VvZiBPYnNlcnZhYmxlT2JqZWN0KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgcmVzb2x2ZSBPYnNlcnZhYmxlT2JqZWN0IHRvIGZpbGwnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGluVGFyZ2V0LmZpbGwoaW5Db250ZW50LCBpblBhdGgsIGluU2lsZW50KTtcbiAgICAgICAgY29uc3QgX3AgPSBfcHJpdmF0ZS5nZXQoaW5UYXJnZXQpO1xuICAgICAgICBpZiAoIWluU2lsZW50KSB7XG4gICAgICAgICAgICBfcC5jaGFuZ2VzUXVldWUucHVzaCh7XG4gICAgICAgICAgICAgICAgcGF0aDogaW5QYXRoLFxuICAgICAgICAgICAgICAgIGNoYW5nZToge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnZmlsbGVkJyxcbiAgICAgICAgICAgICAgICAgICAgbmV3VmFsdWU6IGluQ29udGVudFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgT2JzZXJ2YWJsZU9iamVjdC5ub3RpZnlXYXRjaGVycyhfcCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgbWVyZ2UoaW5UYXJnZXQsIGluUGF0aCwgaW5Db250ZW50LCBpblNpbGVudCkge1xuICAgICAgICBpZiAoIWluVGFyZ2V0IHx8ICEoaW5UYXJnZXQgaW5zdGFuY2VvZiBPYnNlcnZhYmxlT2JqZWN0KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtZXJnZSAoKSBjYW4gb25seSBiZSBpbnZva2VkIG9uIGFuIE9ic2VydmFibGVPYmplY3QnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaW5UYXJnZXQgfHwgIShpblRhcmdldCBpbnN0YW5jZW9mIE9ic2VydmFibGVPYmplY3QpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCByZXNvbHZlIE9ic2VydmFibGVPYmplY3QgdG8gbWVyZ2UnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGluVGFyZ2V0Lm1lcmdlKGluQ29udGVudCwgaW5QYXRoKTtcbiAgICAgICAgY29uc3QgX3AgPSBfcHJpdmF0ZS5nZXQoaW5UYXJnZXQpO1xuICAgICAgICBpZiAoIWluU2lsZW50KSB7XG4gICAgICAgICAgICBfcC5jaGFuZ2VzUXVldWUucHVzaCh7XG4gICAgICAgICAgICAgICAgcGF0aDogaW5QYXRoLFxuICAgICAgICAgICAgICAgIGNoYW5nZToge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnbWVyZ2VkJyxcbiAgICAgICAgICAgICAgICAgICAgbmV3VmFsdWU6IGluQ29udGVudFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgT2JzZXJ2YWJsZU9iamVjdC5ub3RpZnlXYXRjaGVycyhfcCk7XG4gICAgICAgIH1cblxuICAgIH1cblxuXG4gICAgZW1wdHkoaW5TaWxlbnQpIHtcbiAgICAgICAgdGhpcy5maWxsKG51bGwsIGluU2lsZW50KTtcbiAgICB9XG59XG53aW5kb3cuT2JzZXJ2YWJsZU9iamVjdCA9IE9ic2VydmFibGVPYmplY3Q7XG5leHBvcnQgZGVmYXVsdCBPYnNlcnZhYmxlT2JqZWN0O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgT2JzZXJ2YWJsZU9iamVjdCBmcm9tICcuL09ic2VydmFibGVPYmplY3QnO1xuaW1wb3J0IGhhcyBmcm9tICdsb2Rhc2guaGFzJztcblxuY2xhc3MgQ29tcG9uZW50TW9kZWwgZXh0ZW5kcyBPYnNlcnZhYmxlT2JqZWN0IHtcblx0Y29uc3RydWN0b3IoaW5Jbml0T2JqKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGlmKGhhcyhpbkluaXRPYmosICdkYXRhJykpIHtcblx0XHRcdHRoaXMuZmlsbChpbkluaXRPYmopO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmZpbGwoeyBkYXRhIDogaW5Jbml0T2JqfSk7XG5cdFx0fVxuXHR9XG5cblx0ZGF0YShpblBhdGgsIGluRGF0YSkge1xuXHRcdGNvbnN0IHBhdGggPSAnZGF0YScgKyAoaW5QYXRoID8gJy4nICsgaW5QYXRoIDogJycpO1xuXHRcdHJldHVybiB0aGlzLnByb3AocGF0aCwgaW5EYXRhKTtcblx0fVxufVxuXG5leHBvcnQgZGVmYXVsdCBDb21wb25lbnRNb2RlbDsiLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCBmaW5kIGZyb20gJ2xvZGFzaC5maW5kJztcbmltcG9ydCBtYXAgZnJvbSAnbG9kYXNoLm1hcCc7XG5pbXBvcnQgaXNTdHJpbmcgZnJvbSAnbG9kYXNoLmlzU3RyaW5nJztcbmltcG9ydCBpc0FycmF5IGZyb20gJ2xvZGFzaC5pc0FycmF5JztcblxuY29uc3QgX3ByaXZhdGUgPSBuZXcgV2Vha01hcCgpO1xuXG5jbGFzcyBTdGF0ZSB7XG5cdGNvbnN0cnVjdG9yKC4uLnJlc3QpIHtcdFxuXHRcdGxldCBuYW1lID0gZmluZChyZXN0LCAocGFyYW0pID0+IGlzU3RyaW5nKHBhcmFtKSkgfHwgJyc7XG5cdFx0bGV0IGNoaWxkcmVuID0gZmluZChyZXN0LCAocGFyYW0pID0+IGlzQXJyYXkocGFyYW0pKTtcblx0XHRsZXQgcGFyZW50ID0gZmluZChyZXN0LCAocGFyYW0pID0+IHBhcmFtIGluc3RhbmNlb2YgU3RhdGUpO1xuXG5cdFx0Y2hpbGRyZW4gPSBtYXAoY2hpbGRyZW4sIChpblZhbHVlKSA9PiB7XG5cdFx0XHRjb25zdCBzdGF0ZSA9IChpblZhbHVlIGluc3RhbmNlb2YgU3RhdGUgPyBpblZhbHVlIDogbmV3IFN0YXRlKGluVmFsdWUpKTtcblx0XHRcdF9wcml2YXRlLmdldChzdGF0ZSkucGFyZW50ID0gdGhpcztcblx0XHRcdHJldHVybiBzdGF0ZTtcblx0XHR9KTtcblxuXHRcdF9wcml2YXRlLnNldCh0aGlzLCB7XG5cdFx0XHRuYW1lIDogbmFtZSxcblx0XHRcdGNoaWxkcmVuIDogY2hpbGRyZW4sXG5cdFx0XHRwYXJlbnQgOiBwYXJlbnRcblx0XHR9KTtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMuY2hpbGRyZW4gPSBjaGlsZHJlbjtcblx0fVxuXG5cdGdldFBhdGgoKSB7XG5cdFx0Y29uc3QgcGFyZW50ID0gIF9wcml2YXRlLmdldCh0aGlzKS5wYXJlbnQ7XG5cdFx0cmV0dXJuIChwYXJlbnQgJiYgcGFyZW50LmdldE5hbWUoKSA/IHBhcmVudC5nZXRQYXRoKCkgKyAnLicgOiAnJykgKyBfcHJpdmF0ZS5nZXQodGhpcykubmFtZTtcblx0fVxuXG5cblx0Z2V0TmFtZSgpIHtcblx0XHRyZXR1cm4gX3ByaXZhdGUuZ2V0KHRoaXMpLm5hbWU7XG5cdH1cblxuXHRjaGlsZChpbk5hbWUpIHtcblx0XHRyZXR1cm4gZmluZChfcHJpdmF0ZS5nZXQodGhpcykuY2hpbGRyZW4sIChpbkNoaWxkKSA9PiBpbkNoaWxkLmdldE5hbWUoKSA9PT0gaW5OYW1lKTtcblx0fVxuXG5cdHJlc29sdmUoaW5QYXRoKSB7XG5cdFx0aWYoIWluUGF0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBzZWdzID0gaW5QYXRoLnNwbGl0KCcuJyk7XG5cdFx0Y29uc3QgY2hpbGQgPSB0aGlzLmNoaWxkKHNlZ3Muc2hpZnQoKSk7XG5cdFx0aWYoIWNoaWxkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fSBlbHNlIGlmKHNlZ3MubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gY2hpbGQucmVzb2x2ZShzZWdzLmpvaW4oJy4nKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBjaGlsZDtcblx0XHR9XG5cdH1cblxuXHRleHBvc2VkKCkge1xuXHRcdHRoaXMuZXhwb3NlZCA9IHRydWU7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRvbkxlYXZpbmcoaW5Gbikge1xuXHRcdHRoaXMubGVhdmluZyA9IGluRm47XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRsZWF2aW5nKCkge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0fVxuXG5cdG9uTGVmdChpbkZuKSB7XG5cdFx0dGhpcy5sZWZ0ID0gaW5Gbjtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdGxlZnQoKSB7XG5cblx0fVxuXG5cdG9uUmVuZGVyZWQoaW5Gbikge1xuXHRcdHRoaXMucmVuZGVyZWQgPSBpbkZuO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0b25FbnRlcmluZyhpbkZuKSB7XG5cdFx0dGhpcy5lbnRlcmluZyA9IGluRm47XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRlbnRlcmluZygpIHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxuXHRvbkVudGVyZWQoaW5Gbikge1xuXHRcdHRoaXMuZW50ZXJlZCA9IGluRm47XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRyZW5kZXJlZCgpIHtcblxuXHR9XG5cdFxuXG5cdGVudGVyZWQoKSB7XG5cblx0fVxuXG5cdGRpZG50TGVhdmUoKSB7XG5cblx0fVxuXG5cdG1hdGNoZXMoaW5QYXR0ZXJuKSB7XG5cdFx0cmV0dXJuICghaW5QYXR0ZXJuICYmICFfcHJpdmF0ZS5nZXQodGhpcykubmFtZSkgfHxcblx0XHRcdChuZXcgUmVnRXhwKGluUGF0dGVybikpLnRlc3QoX3ByaXZhdGUuZ2V0KHRoaXMpLm5hbWUpO1xuXHR9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFN0YXRlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge1xuICAgIFNpZ25hbFxufSBmcm9tICdzaWduYWxzJztcbmltcG9ydCBnZXQgZnJvbSAnbG9kYXNoLmdldCc7XG5cbmNsYXNzIEJ1cyB7XG5cbiAgICBjb25zdHJ1Y3RvcihpbkNvbXBvbmVudCkge1xuICAgICAgICB0aGlzLmNvbXBvbmVudCA9ICgpID0+IGluQ29tcG9uZW50O1xuICAgICAgICB0aGlzLnNpZ25hbHMgPSB7fTtcbiAgICB9XG5cbiAgICBwdWJsaXNoQWN0aW9uKGluTmFtZSwgaW5IYW5kbGVyKSB7XG4gICAgICAgIHRoaXMuY29tcG9uZW50KCkucGFnZS5idXMuYWRkQWN0aW9uKGluTmFtZSwgaW5IYW5kbGVyKTtcbiAgICB9XG5cbiAgICBidWJibGVBY3Rpb24oaW5OYW1lLCAuLi5yZXN0KSB7XG4gICAgICAgIGNvbnN0IHBhcmVudEJ1cyA9IGdldCh0aGlzLmNvbXBvbmVudCgpLnBhcmVudCgpLCAnYnVzJyk7XG4gICAgICAgIGlmICghcGFyZW50QnVzKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYENhbm5vdCBidWJibGUgYWN0aW9uIFwiJHtpbk5hbWV9XCIgZnJvbSBwYWdlYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcGFyZW50QnVzLnRyaWdnZXJBY3Rpb24uYXBwbHkocGFyZW50QnVzLCBbaW5OYW1lXS5jb25jYXQocmVzdCkpO1xuICAgIH1cblxuICAgIGJ1YmJsZSgpIHtcbiAgICAgICAgdGhpcy5zaG91bGRCdWJibGVDdXJyZW50ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB0cmlnZ2VyQWN0aW9uKGluTmFtZSwgaW5QYXJhbXMsIC4uLnJlc3QpIHtcbiAgICAgICAgaW5QYXJhbXMgPSBpblBhcmFtcyB8fCB7fTtcbiAgICAgICAgaWYgKHRoaXMuc2lnbmFsc1tpbk5hbWVdKSB7XG4gICAgICAgICAgICB0aGlzLnNpZ25hbHNbaW5OYW1lXS5kaXNwYXRjaC5hcHBseShudWxsLCBbaW5QYXJhbXNdLmNvbmNhdChyZXN0KSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuc2lnbmFsc1tpbk5hbWVdIHx8IHRoaXMuc2hvdWxkQnViYmxlQ3VycmVudCkge1xuICAgICAgICAgICAgcmVzdC51bnNoaWZ0KGluUGFyYW1zKTtcbiAgICAgICAgICAgIHJlc3QudW5zaGlmdChpbk5hbWUpO1xuICAgICAgICAgICAgdGhpcy5zaG91bGRCdWJibGVDdXJyZW50ID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmJ1YmJsZUFjdGlvbi5hcHBseSh0aGlzLCByZXN0KTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgYWRkQWN0aW9uKGluTmFtZSwgaW5IYW5kbGVyLCBpbk9uY2UpIHtcbiAgICAgICAgaWYgKHRoaXMuc2lnbmFsc1tpbk5hbWVdKSB7XG4gICAgICAgICAgICB0aGlzLnNpZ25hbHNbaW5OYW1lXS5kaXNwb3NlKCk7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ2FjdGlvbiAnICsgaW5OYW1lICsgJyB3YXMgb3ZlcnJpZGRlbicpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2lnbmFsc1tpbk5hbWVdID0gbmV3IFNpZ25hbCgpO1xuICAgICAgICBpZiAoaW5IYW5kbGVyKSB7XG4gICAgICAgICAgICB0aGlzLnNpZ25hbHNbaW5OYW1lXVsnYWRkJyArIChpbk9uY2UgPyAnT25jZScgOiAnJyldKGluSGFuZGxlcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbmNlQWN0aW9uKGluTmFtZSwgaW5IYW5kbGVyKSB7XG4gICAgICAgIC8vVE9ETzogdG8gYmUgaW1wbGVtZW50ZWRcbiAgICB9XG5cbiAgICBvbkFjdGlvbihpbk5hbWUsIGluSGFuZGxlciwgaW5PbmNlKSB7XG4gICAgICAgIGlmICghdGhpcy5zaWduYWxzW2luTmFtZV0pIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudEJ1cyA9IGdldCh0aGlzLmNvbXBvbmVudCgpLnBhcmVudCgpLCAnYnVzJyk7XG4gICAgICAgICAgICBpZiAocGFyZW50QnVzKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50QnVzLm9uQWN0aW9uKGluTmFtZSwgaW5IYW5kbGVyLCBpbk9uY2UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZEFjdGlvbihpbk5hbWUsIGluSGFuZGxlciwgaW5PbmNlKTtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLndhcm4oJ1Bvc3NpYmx5IHJlZ2lzdGVyaW5nIGxpc3RlbmVyIHRvIG5vbiBleGlzdGluZyBhY3Rpb246ICcgKyBpbk5hbWUpO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUud2FybignWW91IG1pZ2h0IHdhbnQgdG8gdXNlIGFkZEFjdGlvbiBvciBwdWJsaXNoQWN0aW9uJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNpZ25hbHNbaW5OYW1lXVsnYWRkJyArIChpbk9uY2UgPyAnT25jZScgOiAnJyldKGluSGFuZGxlcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvZmZBY3Rpb24oaW5OYW1lLCBpbkhhbmRsZXIpIHtcbiAgICAgICAgLy9UT0RPOiB0byBiZSBpbXBsZW1lbnRlZFxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQnVzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXHRcdFxuXG5jb25zdCBfcHJpdmF0ZSA9IG5ldyBXZWFrTWFwKCk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENvbXBvbmVudExpZmVjeWNsZSB7XG5cdGNvbnN0cnVjdG9yKGluU2lnbmFsKSB7XG5cdFx0X3ByaXZhdGUuc2V0KHRoaXMsIHtzaWduYWwgOiBpblNpZ25hbH0pO1xuXHR9XG5cblx0cmVuZGVyZWQoaW5IYW5kbGVyKSB7XG5cdFx0X3ByaXZhdGUuZ2V0KHRoaXMpLnNpZ25hbC5hZGQoKGluVHlwZSkgPT4ge1xuXHRcdFx0aWYoaW5UeXBlID09PSAncmVuZGVyZWQnKSB7XG5cdFx0XHRcdGluSGFuZGxlcigpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0ZWxlbWVudENyZWF0ZWQoaW5IYW5kbGVyKSB7XG5cdFx0X3ByaXZhdGUuZ2V0KHRoaXMpLnNpZ25hbC5hZGQoKGluVHlwZSkgPT4ge1xuXHRcdFx0aWYoaW5UeXBlID09PSAnZWxlbWVudC1jcmVhdGVkJykge1xuXHRcdFx0XHRpbkhhbmRsZXIoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHR9XG5cblx0ZWxlbWVudEF0dGFjaGVkKGluSGFuZGxlcikge1xuXHRcdF9wcml2YXRlLmdldCh0aGlzKS5zaWduYWwuYWRkKChpblR5cGUpID0+IHtcblx0XHRcdGlmKGluVHlwZSA9PT0gJ2VsZW1lbnQtYXR0YWNoZWQnKSB7XG5cdFx0XHRcdGluSGFuZGxlcigpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdH1cblxuXHRlbGVtZW50RGV0YWNoZWQoaW5IYW5kbGVyKSB7XG5cdFx0X3ByaXZhdGUuZ2V0KHRoaXMpLnNpZ25hbC5hZGQoKGluVHlwZSkgPT4ge1xuXHRcdFx0aWYoaW5UeXBlID09PSAnZWxlbWVudC1kZXRhY2hlZCcpIHtcblx0XHRcdFx0aW5IYW5kbGVyKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0fVxuXG5cdGVtaXQoaW5UeXBlKSB7XG5cdFx0X3ByaXZhdGUuZ2V0KHRoaXMpLnNpZ25hbC5kaXNwYXRjaChpblR5cGUpO1xuXHR9XG59XG4iLCJjb25zdCByZWdpc3RyeSA9IG5ldyBNYXAoKTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24oaW5DbGFzcykge1xuICAgICd1c2Ugc3RyaWN0JztcbiAgICBpZiAoIXJlZ2lzdHJ5LmhhcyhpbkNsYXNzKSkge1xuICAgICAgICBjb25zdCBtYXAgPSBuZXcgV2Vha01hcCgpO1xuICAgICAgICByZWdpc3RyeS5zZXQoaW5DbGFzcywgbWFwKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlZ2lzdHJ5LmdldChpbkNsYXNzKTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcbmltcG9ydCBtaWNyb3Rhc2sgZnJvbSAnLi9taWNyb3Rhc2snO1xuaW1wb3J0IE9ic2VydmFibGVPYmplY3QgZnJvbSAnLi9PYnNlcnZhYmxlT2JqZWN0JztcbmltcG9ydCBDb21wb25lbnRNb2RlbCBmcm9tICcuL0NvbXBvbmVudE1vZGVsJztcbmltcG9ydCBTdGF0ZSBmcm9tICcuL1N0YXRlJztcbmltcG9ydCBCdXMgZnJvbSAnLi9CdXMnO1xuaW1wb3J0IGlzU3RyaW5nIGZyb20gJ2xvZGFzaC5pc1N0cmluZyc7XG5pbXBvcnQgaXNGdW5jdGlvbiBmcm9tICdsb2Rhc2guaXNGdW5jdGlvbic7XG5pbXBvcnQgaXNQbGFpbk9iamVjdCBmcm9tICdsb2Rhc2guaXNQbGFpbk9iamVjdCc7XG5pbXBvcnQgZWFjaCBmcm9tICdsb2Rhc2guZm9yZWFjaCc7XG5pbXBvcnQgZ2V0IGZyb20gJ2xvZGFzaC5nZXQnO1xuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcbmltcG9ydCBmYWN0b3J5IGZyb20gJy4vcGFnZS1mYWN0b3J5JztcbmltcG9ydCBDb21wb25lbnRMaWZlY3ljbGUgZnJvbSAnLi9Db21wb25lbnRMaWZlY3ljbGUnO1xuaW1wb3J0IHtcbiAgICBTaWduYWxcbn0gZnJvbSAnc2lnbmFscyc7XG5pbXBvcnQgcHJpdmF0ZUhhc2ggZnJvbSAnLi91dGlsL3ByaXZhdGUnO1xuXG5jb25zdCBfcHJpdmF0ZSA9IHByaXZhdGVIYXNoKCdjb21wb25lbnQnKTtcblxuY29uc3QgX3NldHVwTW9kZWwgPSBmdW5jdGlvbiBfc2V0dXBNb2RlbChpbk1vZGVsSW5pdE9iaikge1xuXG4gICAgY29uc3QgX3AgPSBfcHJpdmF0ZS5nZXQodGhpcyk7XG5cbiAgICBsZXQgZ2V0dGVyO1xuICAgIGlmICghaW5Nb2RlbEluaXRPYmopIHtcbiAgICAgICAgZ2V0dGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFnZS5yZXNvbHZlTm9kZU1vZGVsKHRoaXMubm9kZSk7XG4gICAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGlzUGxhaW5PYmplY3QoaW5Nb2RlbEluaXRPYmopKSB7XG4gICAgICAgICAgICBfcC5tb2RlbCA9IG5ldyBDb21wb25lbnRNb2RlbChpbk1vZGVsSW5pdE9iaik7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5Nb2RlbEluaXRPYmogaW5zdGFuY2VvZiBDb21wb25lbnRNb2RlbCkge1xuICAgICAgICAgICAgX3AubW9kZWwgPSBpbk1vZGVsSW5pdE9iajtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgX3AubW9kZWwgPSBPYnNlcnZhYmxlT2JqZWN0LmZyb21PYmplY3QoaW5Nb2RlbEluaXRPYmopO1xuICAgICAgICB9XG4gICAgICAgIGdldHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBfcC5tb2RlbDtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ21vZGVsJywge1xuICAgICAgICBnZXQ6IGdldHRlclxuICAgIH0pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnaGFzTW9kZWwnLCB7XG4gICAgICAgIGdldDogKCkgPT4gISFpbk1vZGVsSW5pdE9ialxuICAgIH0pO1xufTtcblxuY29uc3QgX2ZpbmRTdGF0ZSA9IGZ1bmN0aW9uIF9maW5kU3RhdGUoaW5TdGF0ZU5hbWUpIHtcblxuICAgIGlmICghaW5TdGF0ZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhdGVzO1xuICAgIH1cbiAgICBsZXQgcGF0aCA9IGluU3RhdGVOYW1lLnNwbGl0KCcuJyk7XG4gICAgbGV0IGN1cnJlbnRTdGF0ZSA9IHRoaXMuc3RhdGVzO1xuICAgIHdoaWxlIChwYXRoLmxlbmd0aCAmJiBjdXJyZW50U3RhdGUpIHtcbiAgICAgICAgbGV0IHNlZyA9IHBhdGguc2hpZnQoKTtcbiAgICAgICAgY3VycmVudFN0YXRlID0gY3VycmVudFN0YXRlLmNoaWxkKHNlZyk7XG4gICAgfVxuICAgIHJldHVybiBjdXJyZW50U3RhdGU7XG59O1xuXG5cbmNvbnN0IF93YXRjaFN0YXRlID0gZnVuY3Rpb24gX3dhdGNoU3RhdGUoKSB7XG4gICAgY29uc3QgX3AgPSBfcHJpdmF0ZS5nZXQodGhpcyk7XG5cbiAgICBfcC5zdGF0ZUluZm8ud2F0Y2goJ25leHRTdGF0ZScsIChpblBhdGgsIGluQ2hhbmdlcykgPT4ge1xuICAgICAgICBsZXQgbmV4dFN0YXRlID0gX2ZpbmRTdGF0ZS5iaW5kKHRoaXMpKGluQ2hhbmdlcy5uZXdWYWx1ZSk7XG4gICAgICAgIGlmICghbmV4dFN0YXRlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ0NoYW5naW5nIHRvIHVua25vd24gc3RhdGU6ICcgK1xuICAgICAgICAgICAgICAgIGluQ2hhbmdlcy5uZXdWYWx1ZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgcm9sbGJhY2sgPSAoaW5SZWFzb24pID0+IHtcbiAgICAgICAgICAgIGluUmVhc29uICYmIGNvbnNvbGUuZGVidWcoJ0NvdWxkIG5vdCBjaGFuZ2Ugc3RhdGUgYmVjYXVzZTogJyArIGluUmVhc29uKTsgLy9qc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgICAgICAgIF9wLnN0YXRlSW5mby5wcm9wKCduZXh0U3RhdGUnLCBpbkNoYW5nZXMub2xkVmFsdWUsIHRydWUpO1xuICAgICAgICAgICAgY3VycmVudFN0YXRlLmRpZG50TGVhdmUoKTtcbiAgICAgICAgICAgIGZvciAobGV0IHdhdGNoZXIgb2YgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlV2F0Y2hlcnMpIHtcbiAgICAgICAgICAgICAgICB3YXRjaGVyKGluQ2hhbmdlcy5uZXdWYWx1ZSwgaW5DaGFuZ2VzLm9sZFZhbHVlLCBpblJlYXNvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGxldCBjdXJyZW50U3RhdGUgPSBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVJbmZvLnByb3AoJ2N1cnJlbnRTdGF0ZU9iamVjdCcpO1xuICAgICAgICBpZiAoY3VycmVudFN0YXRlKSB7XG4gICAgICAgICAgICBjdXJyZW50U3RhdGUubGVhdmluZyhpbkNoYW5nZXMubmV3VmFsdWUpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIG5leHRTdGF0ZS5lbnRlcmluZyhpbkNoYW5nZXMub2xkVmFsdWUpLnRoZW4oKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZUluZm8ucHJvcCgnY3VycmVudFN0YXRlT2JqZWN0JywgbmV4dFN0YXRlKTtcbiAgICAgICAgICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5wcm9wKCdzdGF0ZScsIF9wLnN0YXRlSW5mby5wcm9wKCduZXh0U3RhdGUnKSk7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRTdGF0ZS5sZWZ0KGluQ2hhbmdlcy5uZXdWYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIG5leHRTdGF0ZS5lbnRlcmVkKGluQ2hhbmdlcy5vbGRWYWx1ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgd2F0Y2hlciBvZiBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVXYXRjaGVycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgd2F0Y2hlcihpbkNoYW5nZXMubmV3VmFsdWUsIGluQ2hhbmdlcy5vbGRWYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKHJvbGxiYWNrKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKHJvbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuXG5cbmNsYXNzIENvbXBvbmVudCB7XG5cbiAgICBjb25zdHJ1Y3RvcihpbkNvbmZpZywgaW5QYXJhbTIsIGluUGFyYW0zLCBpblBhcmFtNCkge1xuICAgICAgICBsZXQgaW5Jbml0T2JqLCBpbkNvbnN0cnVjdG9yLCBpblBhZ2U7XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKGluUGFyYW0yKSkge1xuICAgICAgICAgICAgW2luQ29uc3RydWN0b3IsIGluUGFnZV0gPSBbaW5QYXJhbTIsIGluUGFyYW0zXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIFtpbkluaXRPYmosIGluQ29uc3RydWN0b3IsIGluUGFnZV0gPSBbaW5QYXJhbTIsIGluUGFyYW0zLCBpblBhcmFtNF07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBsaWZlY3ljbGVTaWduYWwgPSBuZXcgU2lnbmFsKCk7XG4gICAgICAgIGNvbnN0IGxpZmVjeWNsZSA9IG5ldyBDb21wb25lbnRMaWZlY3ljbGUobGlmZWN5Y2xlU2lnbmFsKTtcbiAgICAgICAgdGhpcy5taWNyb3Rhc2sgPSBtaWNyb3Rhc2s7XG4gICAgICAgIF9wcml2YXRlLnNldCh0aGlzLCB7XG4gICAgICAgICAgICBzdGF0ZVdhdGNoZXJzOiBuZXcgU2V0KCksXG4gICAgICAgICAgICBsaWZlY3ljbGVTaWduYWw6IGxpZmVjeWNsZVNpZ25hbCxcbiAgICAgICAgICAgIHN0YXRlSW5mbzogbmV3IE9ic2VydmFibGVPYmplY3QoKSxcbiAgICAgICAgICAgIHJlc29sdmVycyA6IGluQ29uZmlnLnJlc29sdmVyc1xuICAgICAgICB9KTtcblxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2xpZmVjeWNsZScsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxpZmVjeWNsZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cblxuICAgICAgICBpZiAoZmFjdG9yeS5jb21wb25lbnRDb25maWdQcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgICAgIGZhY3RvcnkuY29tcG9uZW50Q29uZmlnUHJlcHJvY2Vzc29yKGluQ29uZmlnKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNvbmZpZyA9IGluQ29uZmlnO1xuICAgICAgICB0aGlzLnBhZ2UgPSBpblBhZ2UgfHwgdGhpcztcbiAgICAgICAgdGhpcy5idXMgPSBuZXcgQnVzKHRoaXMpOyAvL2pzaGludCBpZ25vcmU6bGluZVxuICAgICAgICB0aGlzLm5hbWUgPSBpbkNvbmZpZy5uYW1lO1xuICAgICAgICBlYWNoKGluQ29uZmlnLmFjdGlvbnMsIChpbkFjdGlvbikgPT4ge1xuICAgICAgICAgICAgaWYgKCFpbkFjdGlvbikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Bhc3NlZCBhIG51bGwgYWN0aW9uIHRvIGNvbXBvbmVudCBjb25maWcnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBhY3Rpb25OYW1lID0gaXNTdHJpbmcoaW5BY3Rpb24pID8gaW5BY3Rpb24gOiBpbkFjdGlvbi5uYW1lO1xuICAgICAgICAgICAgaWYgKCFhY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignUGFzc2VkIGFuIG9iamVjdCB3aXRoIG5vIGFjdGlvbiBuYW1lIGFzIGFjdGlvbiBpbiBjb21wb25lbnQgY29uZmlnJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IGlzUGxhaW5PYmplY3QoaW5BY3Rpb24pID8gaW5BY3Rpb24uaGFuZGxlciA6IHVuZGVmaW5lZDtcblxuICAgICAgICAgICAgaWYgKGhhbmRsZXIgJiYgIWlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdQYXNzZWQgYSBub24tZnVuY3Rpb24gYWN0aW9uIGhhbmRsZXIgaW4gY29tcG9uZW50IGNvbmZpZycpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpc1BsYWluT2JqZWN0KGluQWN0aW9uKSAmJiBpbkFjdGlvbi5wdWJsaXNoID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5idXMucHVibGlzaEFjdGlvbihhY3Rpb25OYW1lLCBoYW5kbGVyID8gaGFuZGxlci5iaW5kKHRoaXMpIDogbnVsbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYnVzLmFkZEFjdGlvbihhY3Rpb25OYW1lLCBoYW5kbGVyID8gaGFuZGxlci5iaW5kKHRoaXMpIDogbnVsbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSk7XG4gICAgICAgIGxldCB0ZW1wbGF0ZXMgPSBpbkNvbmZpZy50ZW1wbGF0ZXMgfHwge307XG5cbiAgICAgICAgX3NldHVwTW9kZWwuY2FsbCh0aGlzLCBpbkluaXRPYmopO1xuXG4gICAgICAgIGZvciAobGV0IHRlbXBsYXRlTmFtZSBpbiB0ZW1wbGF0ZXMpIHtcbiAgICAgICAgICAgIGxldCBhY3R1YWxUZW1wbGF0ZU5hbWUgPSB0ZW1wbGF0ZU5hbWUgPT09ICdfZGVmYXVsdCcgP1xuICAgICAgICAgICAgICAgICdfZGVmYXVsdC4nICsgdGhpcy5uYW1lIDpcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZU5hbWU7XG4gICAgICAgICAgICBmYWN0b3J5LmdldFRlbXBsYXRpbmdEZWxlZ2F0ZSgpXG4gICAgICAgICAgICAgICAgLnJlZ2lzdGVyKGFjdHVhbFRlbXBsYXRlTmFtZSwgdGVtcGxhdGVzW3RlbXBsYXRlTmFtZV0pO1xuICAgICAgICB9XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS5oYXNEZWZhdWx0VGVtcGxhdGUgPSAhIXRlbXBsYXRlcy5fZGVmYXVsdDtcbiAgICAgICAgX3dhdGNoU3RhdGUuYmluZCh0aGlzKSgpO1xuICAgICAgICB0aGlzLnN0YXRlcyA9IHRoaXMuc3RhdGVzIHx8IG5ldyBTdGF0ZSgpO1xuICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVJbmZvLnByb3AoJ2N1cnJlbnRTdGF0ZU9iamVjdCcsIHRoaXMuc3RhdGVzKTtcbiAgICAgICAgaW5Db25zdHJ1Y3RvciAmJiBpbkNvbnN0cnVjdG9yLmJpbmQodGhpcykoKTsgLy9qc2hpbnQgaWdub3JlOmxpbmVcblxuICAgICAgICBtaWNyb3Rhc2sodGhpcy5pbml0U3RhdGUuYmluZCh0aGlzKSk7XG4gICAgfVxuXG4gICAgZGF0YShpblBhdGgsIGluVmFsdWUsIGluU2lsZW50KSB7XG4gICAgICAgIGNvbnN0IHBhdGggPSAnZGF0YScgKyAoaW5QYXRoID8gJy4nICsgaW5QYXRoIDogJycpO1xuICAgICAgICByZXR1cm4gdGhpcy5wYWdlLnJlc29sdmVOb2RlTW9kZWwodGhpcy5ub2RlLCBwYXRoKS5wcm9wKHBhdGgsIGluVmFsdWUsIGluU2lsZW50KTtcbiAgICB9XG5cbiAgICBwYXJlbnQoKSB7XG4gICAgICAgIGlmICh0aGlzLnBhZ2UgPT09IHRoaXMpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5wYWdlLnJlc29sdmVOb2RlQ29tcG9uZW50KCQodGhpcy5ub2RlKS5wYXJlbnQoKSk7XG4gICAgfVxuXG4gICAgZ2V0UmVzb2x2ZXIoaW5OYW1lKSB7XG4gICAgICAgIHJldHVybiBnZXQoX3ByaXZhdGUuZ2V0KHRoaXMpLCAncmVzb2x2ZXJzLicgKyBpbk5hbWUpO1xuICAgIH1cblxuICAgIGluaXRTdGF0ZSgpIHtcblxuICAgIH1cblxuICAgIGdldEN1cnJlbnRTdGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZUluZm8ucHJvcCgnY3VycmVudFN0YXRlT2JqZWN0Jyk7XG4gICAgfVxuXG4gICAgdHJ5U3RhdGUoaW5TdGF0ZU5hbWUpIHtcbiAgICAgICAgaWYgKGluU3RhdGVOYW1lID09PSAoX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5wcm9wKCdzdGF0ZScpIHx8ICcnKSkge1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHdhdGNoZXIgPSAoaW5OZXdTdGF0ZSwgaW5PbGRTdGF0ZSwgaW5FcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChpbkVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChpbkVycm9yKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGluTmV3U3RhdGUsIGluT2xkU3RhdGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLnVud2F0Y2hTdGF0ZSh3YXRjaGVyKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLndhdGNoU3RhdGUod2F0Y2hlcik7XG4gICAgICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVJbmZvLnByb3AoJ25leHRTdGF0ZScsIGluU3RhdGVOYW1lKTtcbiAgICAgICAgfSk7XG5cbiAgICB9XG5cbiAgICB1bndhdGNoU3RhdGUoaW5XYXRjaGVyRnVuY3Rpb24pIHtcbiAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlV2F0Y2hlcnMuZGVsZXRlKGluV2F0Y2hlckZ1bmN0aW9uKTtcbiAgICB9XG5cbiAgICB3YXRjaFN0YXRlKGluV2F0Y2hlckZ1bmN0aW9uKSB7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZVdhdGNoZXJzLmFkZChpbldhdGNoZXJGdW5jdGlvbik7XG4gICAgfVxuXG4gICAgaW52YWxpZGF0ZSgpIHtcbiAgICAgICAgaWYgKCFfcHJpdmF0ZS5nZXQodGhpcykud2lsbFJlbmRlcikge1xuICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLndpbGxSZW5kZXIgPSB0cnVlO1xuICAgICAgICAgICAgbWljcm90YXNrKHRoaXMucmVuZGVyLmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyKGluTW9kZWwpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS53aWxsUmVuZGVyID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAoX3ByaXZhdGUuZ2V0KHRoaXMpLmhhc0RlZmF1bHRUZW1wbGF0ZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlbGVnYXRlID0gZmFjdG9yeS5nZXRUZW1wbGF0aW5nRGVsZWdhdGUoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBtb2RlbCA9IGluTW9kZWwgP1xuICAgICAgICAgICAgICAgICAgICBPYnNlcnZhYmxlT2JqZWN0LmZyb21PYmplY3QoaW5Nb2RlbCkgOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGEoKTtcbiAgICAgICAgICAgICAgICBkZWxlZ2F0ZS5yZW5kZXIoXG4gICAgICAgICAgICAgICAgICAgICdfZGVmYXVsdC4nICsgdGhpcy5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBtb2RlbCkudGhlbigoaW5IdG1sKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICQodGhpcy5ub2RlKS5odG1sKGluSHRtbCk7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZnRlclJlbmRlciAmJiB0aGlzLmFmdGVyUmVuZGVyKCk7IC8vanNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAgICAgICAgICAgICAgIC8vY29uc3QgbXV0YXRpb25PYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5taWNyb3Rhc2soKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmxpZmVjeWNsZVNpZ25hbC5kaXNwYXRjaCgncmVuZGVyZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgIG11dGF0aW9uT2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAvL30pO1xuICAgICAgICAgICAgICAgICAgICAvL211dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZSgkKHRoaXMubm9kZSkuZ2V0KDApLCB7Y2hpbGRMaXN0IDogdHJ1ZX0pO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKChpbkVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoaW5FcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChpbkVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcblxuICAgIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBDb21wb25lbnQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbmxldCBfcGFnZSA9IG51bGw7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmdW5jdGlvbihpblBhZ2UpIHtcbiAgICAgICAgY29uc3QgTW9kZWxEYXRhU291cmNlID0gZnVuY3Rpb24oaW5QYWdlKSB7XG4gICAgICAgICAgICB0aGlzLnBhZ2UgPSBfcGFnZSA9IGluUGFnZTtcblxuICAgICAgICAgICAgdGhpcy5yZXNvbHZlID0gZnVuY3Rpb24gcmVzb2x2ZShpbk5vZGUsIGluUGF0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZVByb21pc2UsIHJlamVjdFByb21pc2UpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIS9eXy8udGVzdChpblBhdGgpICYmIGluUGF0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGluUGF0aCA9PT0gJy4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5QYXRoID0gJ2RhdGEnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpblBhdGggPSAnZGF0YScgKyAoaW5QYXRoID8gJy4nICsgaW5QYXRoIDogJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1vZGVsID0gX3BhZ2UucmVzb2x2ZU5vZGVNb2RlbChpbk5vZGUsIGluUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmVQcm9taXNlKGluUGF0aCA/IG1vZGVsLnByb3AoaW5QYXRoKSA6IG1vZGVsKTtcblxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdGhpcy51bmJpbmRQYXRoID0gZnVuY3Rpb24gdW5iaW5kUGF0aCgpIHtcbiAgICAgICAgICAgICAgICAvL0NSSVRJQ0FMOiB0byBiZSBpbXBsZW1lbnRlZFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdGhpcy5iaW5kUGF0aCA9IGZ1bmN0aW9uIGJpbmRQYXRoKGluTm9kZSwgaW5QYXRoLCBpbkhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIS9eXy8udGVzdChpblBhdGgpICYmIGluUGF0aCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5QYXRoID09PSAnLicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluUGF0aCA9ICdkYXRhJztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluUGF0aCA9ICdkYXRhJyArIChpblBhdGggPyAnLicgKyBpblBhdGggOiAnJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgbW9kZWwgPSBfcGFnZS5yZXNvbHZlTm9kZU1vZGVsKGluTm9kZSwgaW5QYXRoKTtcblxuICAgICAgICAgICAgICAgIG1vZGVsLndhdGNoKGluUGF0aCwgZnVuY3Rpb24oaW5QYXRoLCBpbkNoYW5nZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IGluSGFuZGxlcihpbkNoYW5nZXMubmV3VmFsdWUsIGluQ2hhbmdlcy5vbGRWYWx1ZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB0aGlzLnNldFBhdGggPSBmdW5jdGlvbiBzZXRQYXRoKGluTm9kZSwgaW5QYXRoLCBpblZhbHVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCEvXl8vLnRlc3QoaW5QYXRoKSkge1xuICAgICAgICAgICAgICAgICAgICBpblBhdGggPSAnZGF0YS4nICsgaW5QYXRoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBtb2RlbCA9IF9wYWdlLnJlc29sdmVOb2RlTW9kZWwoaW5Ob2RlLCBpblBhdGgpO1xuICAgICAgICAgICAgICAgIG1vZGVsLnByb3AoaW5QYXRoLCBpblZhbHVlKTtcbiAgICAgICAgICAgIH07XG5cblxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gbmV3IE1vZGVsRGF0YVNvdXJjZShpblBhZ2UpO1xuICAgIH07XG5cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcblxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhY3Rpb24oaW5QYWdlKSB7XG4gICAgY29uc3QgX3BhZ2UgPSBpblBhZ2U7XG5cbiAgICB2YXIgcHJvdG8gPSBPYmplY3QuY3JlYXRlKEhUTUxFbGVtZW50LnByb3RvdHlwZSk7XG5cbiAgICBwcm90by5jcmVhdGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuICAgIH07XG5cbiAgICBwcm90by5hdHRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICB9O1xuXG4gICAgcHJvdG8uZGV0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgfTtcblxuICAgIGRvY3VtZW50LnJlZ2lzdGVyRWxlbWVudCgnYWUtbWFuYWdlZCcsIHsgcHJvdG90eXBlOiBwcm90byB9KTtcbn1cbiIsImltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5pbXBvcnQgbWljcm90YXNrIGZyb20gJy4uL21pY3JvdGFzayc7XG5cbmltcG9ydCBmYWN0b3J5IGZyb20gJy4uL3BhZ2UtZmFjdG9yeSc7XG5pbXBvcnQgT2JzZXJ2YWJsZU9iamVjdCBmcm9tICcuLi9PYnNlcnZhYmxlT2JqZWN0JztcbmltcG9ydCB0cmFuc2Zvcm0gZnJvbSAnbG9kYXNoLnRyYW5zZm9ybSc7XG5pbXBvcnQgZWFjaCBmcm9tICdsb2Rhc2guZm9yZWFjaCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHJlbmRlcihpblBhZ2UpIHtcbiAgICBjb25zdCBfcHJpdmF0ZSA9ICgoKSA9PiB7XG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBXZWFrTWFwKCk7XG4gICAgICAgIHJldHVybiAoaW5UaGlzKSA9PiB7XG4gICAgICAgICAgICBpZiAoIW1hcC5nZXQoaW5UaGlzKSkge1xuICAgICAgICAgICAgICAgIG1hcC5zZXQoaW5UaGlzLCB7fSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbWFwLmdldChpblRoaXMpO1xuICAgICAgICB9O1xuICAgIH0pKCk7XG5cbiAgICBjb25zdCBfcGFnZSA9IGluUGFnZTtcbiAgICB2YXIgcHJvdG8gPSBPYmplY3QuY3JlYXRlKEhUTUxEaXZFbGVtZW50LnByb3RvdHlwZSk7XG5cbiAgICBjb25zdCBpbnZhbGlkYXRlID0gZnVuY3Rpb24gaW52YWxpZGF0ZSgpIHtcbiAgICAgICAgaWYgKCFfcHJpdmF0ZS5nZXQodGhpcykud2lsbFJlbmRlcikge1xuICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLndpbGxSZW5kZXIgPSB0cnVlO1xuICAgICAgICAgICAgbWljcm90YXNrKHJlbmRlci5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB2YXIgcmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyKCkge1xuICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykud2lsbFJlbmRlciA9IGZhbHNlO1xuICAgICAgICAvLyBpZiAoJCh0aGlzKS5hdHRyKCdkZWJ1Zy1uYW1lJykpIHtcbiAgICAgICAgLy8gICAgIGNvbnNvbGUuaW5mbygkKHRoaXMpLmF0dHIoJ2RlYnVnLW5hbWUnKSArICcgd2lsbCByZW5kZXInKTtcbiAgICAgICAgLy8gfVxuXG4gICAgICAgIGxldCB0ZW1wbGF0ZU5hbWUgPSAkKHRoaXMpLmF0dHIoJ3RlbXBsYXRlJyk7XG5cbiAgICAgICAgY29uc3QgcGF0aCA9ICQodGhpcykuYXR0cignZnJvbScpIHx8ICcuJztcbiAgICAgICAgX3BhZ2UuZ2V0RGF0YVNvdXJjZSgpLnJlc29sdmUodGhpcywgcGF0aCkudGhlbigoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYXR0cnMgPSB0cmFuc2Zvcm0odGhpcy5hdHRyaWJ1dGVzLCBmdW5jdGlvbihyZXN1bHQsIGl0ZW0pIHtcbiAgICAgICAgICAgICAgICBpdGVtLnNwZWNpZmllZCAmJiAvXnBhcmFtLS8udGVzdChpdGVtLm5hbWUpICYmIChyZXN1bHRbaXRlbS5uYW1lLnJlcGxhY2UoJ3BhcmFtLScsICcnKV0gPSBpdGVtLnZhbHVlKTsgLy9qc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgICAgICAgIH0sIHt9KTtcblxuICAgICAgICAgICAgZmFjdG9yeS5nZXRUZW1wbGF0aW5nRGVsZWdhdGUoKVxuICAgICAgICAgICAgICAgIC5yZW5kZXIodGVtcGxhdGVOYW1lLCBpblZhbHVlIHx8IHt9LCBfcHJpdmF0ZS5nZXQodGhpcykucGFyYW1zKVxuICAgICAgICAgICAgICAgIC50aGVuKChpbkh0bWwpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgJCh0aGlzKS5odG1sKGluSHRtbCk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2F0Y2goKGluRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihpbkVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfSkuY2F0Y2goKGluRXJyb3IpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoaW5FcnJvcik7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIF9wcml2YXRlLnNldCh0aGlzLCB7XG4gICAgICAgICAgICB3aWxsUmVuZGVyOiBmYWxzZSxcbiAgICAgICAgICAgIHBhcmFtczogKCgpID0+IHtcbiAgICAgICAgICAgICAgICB2YXIgb3V0ID0ge307XG4gICAgICAgICAgICAgICAgZWFjaCh0aGlzLmF0dHJpYnV0ZXMsIChpbkF0dHJpYnV0ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoL15wYXJhbS0vLnRlc3QoaW5BdHRyaWJ1dGUubmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dFtpbkF0dHJpYnV0ZS5uYW1lLnJlcGxhY2UoJ3BhcmFtLScsICcnKV0gPSBpbkF0dHJpYnV0ZS52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBvdXQ7XG4gICAgICAgICAgICB9KSgpXG4gICAgICAgIH0pO1xuICAgICAgICBsZXQgdGVtcGxhdGVOYW1lID0gJCh0aGlzKS5hdHRyKCd0ZW1wbGF0ZScpO1xuICAgICAgICBpZiAoIXRlbXBsYXRlTmFtZSkge1xuICAgICAgICAgICAgbGV0IHRlbXBsYXRlID0gJCh0aGlzKS5maW5kKCc+dGVtcGxhdGUnKTtcbiAgICAgICAgICAgIGlmICghdGVtcGxhdGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJCh0aGlzKS5nZXRQYXRoKCkgKyAnIG11c3QgaGF2ZSBhIHRlbXBsYXRlIGF0dHJpYnV0ZSBvciBhIHRlbXBsYXRlIGVsZW1lbnQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRlbXBsYXRlTmFtZSA9IGZhY3RvcnkuZ2V0VGVtcGxhdGluZ0RlbGVnYXRlKClcbiAgICAgICAgICAgICAgICAucmVnaXN0ZXJUZW1wbGF0ZSh0ZW1wbGF0ZS5odG1sKCkpO1xuICAgICAgICAgICAgJCh0aGlzKS5hdHRyKCd0ZW1wbGF0ZScsIHRlbXBsYXRlTmFtZSk7XG4gICAgICAgICAgICAkKHRoaXMpLmVtcHR5KCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIGludmFsaWRhdGUuY2FsbCh0aGlzKTtcbiAgICAgICAgdmFyIG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4ge1xuICAgICAgICAgICAgbXV0YXRpb25zLmZvckVhY2goKG11dGF0aW9uKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKC9ecGFyYW0tLy50ZXN0KG11dGF0aW9uLmF0dHJpYnV0ZU5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGludmFsaWRhdGUuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gY29uZmlndXJhdGlvbiBvZiB0aGUgb2JzZXJ2ZXI6XG4gICAgICAgIHZhciBjb25maWcgPSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiB0cnVlXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gcGFzcyBpbiB0aGUgdGFyZ2V0IG5vZGUsIGFzIHdlbGwgYXMgdGhlIG9ic2VydmVyIG9wdGlvbnNcbiAgICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLCBjb25maWcpO1xuXG4gICAgICAgIGNvbnN0IHBhdGggPSAkKHRoaXMpLmF0dHIoJ2Zyb20nKTtcbiAgICAgICAgX3BhZ2UuZ2V0RGF0YVNvdXJjZSgpLmJpbmRQYXRoKHRoaXMsIHBhdGgsIChpbkJhc2VNb2RlbCkgPT4ge1xuXG4gICAgICAgICAgICBpZiAoaW5CYXNlTW9kZWwgaW5zdGFuY2VvZiBPYnNlcnZhYmxlT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgaW5CYXNlTW9kZWwud2F0Y2gocGF0aCwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpbnZhbGlkYXRlLmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGludmFsaWRhdGUuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGludmFsaWRhdGUuY2FsbCh0aGlzKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICgkKHRoaXMpLmF0dHIoJ3dhdGNoJykpIHtcbiAgICAgICAgICAgIF9wYWdlLmdldERhdGFTb3VyY2UoKS5iaW5kUGF0aCh0aGlzLCAkKHRoaXMpLmF0dHIoJ3dhdGNoJyksIChpbkJhc2VNb2RlbCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaW52YWxpZGF0ZS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBwcm90by5kZXRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICB9O1xuXG4gICAgZG9jdW1lbnQucmVnaXN0ZXJFbGVtZW50KCdhZS1yZW5kZXJlZCcsIHtcbiAgICAgICAgcHJvdG90eXBlOiBwcm90byxcbiAgICAgICAgZXh0ZW5kcyA6ICdkaXYnXG4gICAgfSk7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydCBkZWZhdWx0IFN5bWJvbCgndW5yZXNvbHZlZCcpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuaW1wb3J0IFVOUkVTT0xWRUQgZnJvbSAnLi4vc3ltYm9sL3VucmVzb2x2ZWQnO1xuaW1wb3J0IGVhY2ggZnJvbSAnbG9kYXNoLmZvcmVhY2gnO1xuaW1wb3J0IGlzU3RyaW5nIGZyb20gJ2xvZGFzaC5pc1N0cmluZyc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHR5cGlmeVBhcmFtcyhpblBhZ2UsIGluUGFyYW1zKSB7XG4gICAgY29uc3Qgb3V0ID0ge307XG4gICAgZWFjaChpblBhcmFtcywgZnVuY3Rpb24oaW5QYXJhbVZhbHVlLCBpblBhcmFtS2V5KSB7XG4gICAgICAgIGlmICghaW5QYXJhbVZhbHVlKSB7XG4gICAgICAgICAgICBvdXRbaW5QYXJhbUtleV0gPSBudWxsO1xuICAgICAgICB9IGVsc2UgaWYgKGlzU3RyaW5nKGluUGFyYW1WYWx1ZSkgJiYgL15+Ly50ZXN0KGluUGFyYW1WYWx1ZSkpIHtcbiAgICAgICAgICAgIGxldCByZXNvbHZlZFZhbHVlID0gVU5SRVNPTFZFRDtcbiAgICAgICAgICAgIGluUGFnZS5nZXREYXRhU291cmNlKClcbiAgICAgICAgICAgICAgICAucmVzb2x2ZSh0aGlzLCBpblBhcmFtVmFsdWUucmVwbGFjZSgnficsICcnKSkudGhlbigoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlZFZhbHVlID0gaW5WYWx1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChyZXNvbHZlZFZhbHVlID09PSBVTlJFU09MVkVEKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBY3Rpb24gcGFyYW1ldGVycyBtdXN0IGJlIHJlc29sdmVkIHN5bmNocm9ub3VzbHknKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG91dFtpblBhcmFtS2V5XSA9IHJlc29sdmVkVmFsdWU7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNTdHJpbmcoaW5QYXJhbVZhbHVlKSAmJiAvXmAuKmAkLy50ZXN0KGluUGFyYW1WYWx1ZSkpIHtcbiAgICAgICAgICAgIG91dFtpblBhcmFtS2V5XSA9IGluUGFyYW1WYWx1ZS5yZXBsYWNlKC9eYC8sICcnKS5yZXBsYWNlKC9gJC8sICcnKTtcbiAgICAgICAgfSBlbHNlIGlmICghaXNOYU4oaW5QYXJhbVZhbHVlKSkge1xuICAgICAgICAgICAgb3V0W2luUGFyYW1LZXldID0gTnVtYmVyKGluUGFyYW1WYWx1ZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoL14odHJ1ZXxmYWxzZSkkLy50ZXN0KGluUGFyYW1WYWx1ZSkpIHtcbiAgICAgICAgICAgIG91dFtpblBhcmFtS2V5XSA9IChpblBhcmFtVmFsdWUgPT09ICd0cnVlJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ3VzaW5nIGRlcHJlY2F0ZWQgc2lnbmFsIHN0cmluZyBwYXJhbSBmb3JtYXQnKTtcbiAgICAgICAgICAgIG91dFtpblBhcmFtS2V5XSA9IGluUGFyYW1WYWx1ZTsgLy9pcyBhIHN0cmluZ1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG91dDtcblxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IGdldCBmcm9tICdsb2Rhc2guZ2V0JztcbmltcG9ydCBlYWNoIGZyb20gJ2xvZGFzaC5mb3JlYWNoJztcbmltcG9ydCBpc1N0cmluZyBmcm9tICdsb2Rhc2guaXNTdHJpbmcnO1xuXG5pbXBvcnQgVU5SRVNPTFZFRCBmcm9tICcuLi9zeW1ib2wvdW5yZXNvbHZlZCc7XG5pbXBvcnQgdHlwaWZ5UGFyYW1zIGZyb20gJy4uL3V0aWwvdHlwaWZ5LXBhcmFtZXRlcnMnO1xuXG5cbmNvbnN0IHJlc29sdmVUYXJnZXRzID0gZnVuY3Rpb24gcmVzb2x2ZVRhcmdldHMoaW5QYWdlLCBpbkNvbmZpZykge1xuICAgIGxldCB0YXJnZXQgPSB7fTtcbiAgICAgICAgY29uc3QgdGFyZ2V0QXR0ciA9IGluQ29uZmlnLnRhcmdldDtcbiAgICBpZiAoJCh0aGlzKS5jaGlsZHJlbigpLmxlbmd0aCAmJiB0YXJnZXRBdHRyICE9PSAnc2VsZicpIHtcbiAgICAgICAgdGFyZ2V0Lm5vZGUgPSAkKHRoaXMpLmNoaWxkcmVuKCkuZ2V0KDApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICghdGFyZ2V0QXR0cikge1xuICAgICAgICAgICAgdGFyZ2V0Lm5vZGUgPSAkKHRoaXMpLnBhcmVudCgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhcmdldEF0dHIgPT09ICduZXh0Jykge1xuICAgICAgICAgICAgdGFyZ2V0Lm5vZGUgPSAkKHRoaXMpLm5leHQoKTtcbiAgICAgICAgfSBlbHNlIGlmICgvXmNsb3Nlc3QvLnRlc3QodGFyZ2V0QXR0cikpIHtcbiAgICAgICAgICAgIGNvbnN0IHNlZ3MgPSB0YXJnZXRBdHRyLnNwbGl0KC9cXHMrLyk7XG4gICAgICAgICAgICB0YXJnZXQubm9kZSA9ICQodGhpcykuY2xvc2VzdChzZWdzWzFdKTtcbiAgICAgICAgfSBlbHNlIGlmICgvXihcXC58XFwjKS8udGVzdCh0YXJnZXRBdHRyKSkge1xuICAgICAgICAgICAgdGFyZ2V0Lm5vZGUgPSAkKHRoaXMpLnBhcmVudCgpLmZpbmQodGFyZ2V0QXR0cik7XG4gICAgICAgIH0gZWxzZSBpZiAoL15zZWxmJC8udGVzdCh0YXJnZXRBdHRyKSkge1xuICAgICAgICAgICAgdGFyZ2V0Lm5vZGUgPSAkKHRoaXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCdVbmtub3duIGFlLWJpbmQgdGFyZ2V0OiAnICsgdGFyZ2V0QXR0cik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRhcmdldC5ub2RlICYmIHRhcmdldC5ub2RlLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0Lm5vZGUgJiYgIXRhcmdldC5ub2RlLmxlbmd0aCkge1xuICAgICAgICB0YXJnZXQucGVuZGluZyA9IHRydWU7XG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuICAgIHJldHVybjtcbn07XG5cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYXR0YWNoQWN0aW9uKGluUGFnZSwgaW5Db25maWcpIHtcbiAgICBsZXQgdGFyZ2V0ID0gcmVzb2x2ZVRhcmdldHMuY2FsbCh0aGlzLCBpblBhZ2UsIGluQ29uZmlnKTtcbiAgICBpZiAoZ2V0KHRoaXMsICdwZW5kaW5nJykgPT09IHRydWUpIHtcbiAgICAgICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zKSA9PiB7XG4gICAgICAgICAgICBhdHRhY2hBY3Rpb24uY2FsbCh0aGlzKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IG9ic2VydmVyQ29uZmlnID0ge1xuICAgICAgICAgICAgc3VidHJlZTogdHJ1ZSxcbiAgICAgICAgICAgIGNoaWxkTGlzdDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgICBvYnNlcnZlci5vYnNlcnZlKHRoaXMucGFyZW50Tm9kZSwgb2JzZXJ2ZXJDb25maWcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGFjdGlvbk5hbWUgPSBpbkNvbmZpZy5uYW1lO1xuICAgICAgICBlYWNoKHRhcmdldC5ub2RlLCAoaW5UYXJnZXROb2RlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBpblBhZ2UucmVzb2x2ZU5vZGVDb21wb25lbnQoaW5UYXJnZXROb2RlKTtcbiAgICAgICAgICAgIGxldCBldmVudDtcblxuICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IChpbkV2ZW50LCBpblRyaWdnZXIpID0+IHtcbiAgICAgICAgICAgICAgICBpZigkKGluRXZlbnQudGFyZ2V0KS5wcm9wKCd0YWdOYW1lJykgPT09ICdMQUJFTCcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoaW5UcmlnZ2VyID09PSAnZW50ZXInICYmIGluRXZlbnQua2V5Q29kZSAhPT0gMTMpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoaW5UcmlnZ2VyID09PSAnZXNjJyAmJiBpbkV2ZW50LmtleUNvZGUgIT09IDI3KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LmJ1cy50cmlnZ2VyQWN0aW9uKFxuICAgICAgICAgICAgICAgICAgICBhY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICB0eXBpZnlQYXJhbXMoaW5QYWdlLCBpbkNvbmZpZy5wYXJhbXMpLFxuICAgICAgICAgICAgICAgICAgICBpbkV2ZW50KTtcbiAgICAgICAgICAgICAgICBpZihpblRyaWdnZXIgPT09ICdjbGljaycpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5FdmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG5cbiAgICAgICAgICAgIGZvciAobGV0IHRyaWdnZXIgb2YoaW5Db25maWcudHJpZ2dlciB8fCAnY2xpY2snKS5zcGxpdCgnLCcpKSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoICh0cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2VudGVyJzpcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnZXNjJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50ID0gJ2tleXVwJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKC9eXFx3KzovLnRlc3QodHJpZ2dlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudCA9IHRyaWdnZXIubWF0Y2goL14oXFx3KykvKVswXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSB0cmlnZ2VyO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGNhbGxlciA9IChpbkV2ZW50KSA9PiB7IC8vanNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZXIoaW5FdmVudCwgdHJpZ2dlcik7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICQoaW5UYXJnZXROb2RlKS5vZmYoZXZlbnQsIGNhbGxlcikub24oZXZlbnQsIGNhbGxlcik7XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICB9KTtcbiAgICB9XG5cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcblxuaW1wb3J0IGF0dGFjaEFjdGlvbiBmcm9tICcuLi9kZWxlZ2F0ZS9hY3Rpb24tdHJpZ2dlci1kZWxlZ2F0ZSc7XG5jb25zdCBFbGVtZW50SFRNTFdpcmluZyA9IHJlcXVpcmUoJy4uL3dpcmluZy9FbGVtZW50SFRNTFdpcmluZycpO1xuaW1wb3J0IGVhY2ggZnJvbSAnbG9kYXNoLmZvcmVhY2gnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhZUJ1dHRvbihpblBhZ2UpIHtcbiAgICBjb25zdCBfcGFnZSA9IGluUGFnZTtcblxuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoSFRNTEJ1dHRvbkVsZW1lbnQucHJvdG90eXBlKTtcbiAgICBwcm90by5jcmVhdGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgbGV0IHdpcmluZ3MgPSBbXTtcbiAgICAgICAgJCh0aGlzKS5wcm9wKCdhZScsIHtcbiAgICAgICAgICAgIHdpcmluZ3M6IHdpcmluZ3NcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKCQodGhpcykuYXR0cignYmluZC1odG1sJykpIHtcbiAgICAgICAgICAgIHdpcmluZ3MucHVzaChuZXcgRWxlbWVudEhUTUxXaXJpbmcodGhpcykpO1xuICAgICAgICB9XG5cbiAgICAgICAgd2lyaW5ncy5wdXNoLmFwcGx5KHdpcmluZ3MpO1xuXG4gICAgICAgICQodGhpcykucHJvcCgndHlwZScsICdidXR0b24nKTtcblxuXG4gICAgICAgIGlmICgkKHRoaXMpLmF0dHIoJ2JpbmQtZW5hYmxlZCcpKSB7XG4gICAgICAgICAgICBsZXQgcGF0aCA9ICQodGhpcykuYXR0cignYmluZC1lbmFibGVkJyk7XG4gICAgICAgICAgICBsZXQgc3RyaWN0Qm9vbGVhbiA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKC8hJC8udGVzdChwYXRoKSkge1xuICAgICAgICAgICAgICAgIHBhdGggPSBwYXRoLnJlcGxhY2UoLyEkLywgJycpO1xuICAgICAgICAgICAgICAgIHN0cmljdEJvb2xlYW4gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc291cmNlID0gJCh0aGlzKS5hdHRyKCdzb3VyY2UnKTtcbiAgICAgICAgICAgIGNvbnN0IHNldFZhbHVlID0gKGluVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAkKHRoaXMpLnByb3AoJ2Rpc2FibGVkJywgc3RyaWN0Qm9vbGVhbiA/IGluVmFsdWUgIT09IHRydWUgOiAhaW5WYWx1ZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBfcGFnZVxuICAgICAgICAgICAgICAgIC5nZXREYXRhU291cmNlKHNvdXJjZSlcbiAgICAgICAgICAgICAgICAuYmluZFBhdGgodGhpcywgcGF0aCwgKGluTmV3VmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc2V0VmFsdWUoaW5OZXdWYWx1ZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBfcGFnZVxuICAgICAgICAgICAgICAgIC5nZXREYXRhU291cmNlKHNvdXJjZSlcbiAgICAgICAgICAgICAgICAucmVzb2x2ZSh0aGlzLCBwYXRoKVxuICAgICAgICAgICAgICAgIC50aGVuKChpblZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHNldFZhbHVlKGluVmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCQodGhpcykuYXR0cignYWN0aW9uJykpIHtcbiAgICAgICAgICAgIGF0dGFjaEFjdGlvbi5jYWxsKHRoaXMsIF9wYWdlLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJCh0aGlzKS5hdHRyKCdhY3Rpb24nKSxcbiAgICAgICAgICAgICAgICB0cmlnZ2VyOiAnY2xpY2snLFxuICAgICAgICAgICAgICAgIHRhcmdldDogJ3NlbGYnLFxuICAgICAgICAgICAgICAgIHBhcmFtczogKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyYW1zID0ge307XG4gICAgICAgICAgICAgICAgICAgICQoJCh0aGlzKS5nZXQoMCkuYXR0cmlidXRlcykuZWFjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgvXnBhcmFtLS8udGVzdCh0aGlzLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1zW3RoaXMubmFtZS5yZXBsYWNlKCdwYXJhbS0nLCAnJyldID0gdGhpcy52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICAgICAgICAgICAgfSkoKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuXG5cbiAgICB9O1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBjb25zdCBhZSA9ICQodGhpcykucHJvcCgnYWUnKTtcbiAgICAgICAgZWFjaChhZS53aXJpbmdzLCAod2lyaW5nKSA9PiB7XG4gICAgICAgICAgICB3aXJpbmcuYXR0YWNoKF9wYWdlKTtcbiAgICAgICAgfSk7XG5cbiAgICB9O1xuXG4gICAgcHJvdG8uZGV0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBjb25zdCBhZSA9ICQodGhpcykucHJvcCgnYWUnKTtcbiAgICAgICAgZWFjaChhZS53aXJpbmdzLCAod2lyaW5nKSA9PiB7XG4gICAgICAgICAgICB3aXJpbmcuZGV0YWNoKCk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLWJ1dHRvbicsIHtcbiAgICAgICAgcHJvdG90eXBlOiBwcm90byxcbiAgICAgICAgZXh0ZW5kczogJ2J1dHRvbidcbiAgICB9KTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IGZhY3RvcnkgZnJvbSAnLi4vcGFnZS1mYWN0b3J5JztcbmltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5cbmltcG9ydCBPYnNlcnZhYmxlT2JqZWN0IGZyb20gJy4uL09ic2VydmFibGVPYmplY3QnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBlYWNoKGluUGFnZSkge1xuICAgIGNvbnN0IF9wYWdlID0gaW5QYWdlO1xuICAgIGNvbnN0IF9wcml2YXRlID0gbmV3IFdlYWtNYXAoKTtcbiAgICBjb25zdCBfdGVtcGxhdGluZ0RlbGVnYXRlID0gZmFjdG9yeS5nZXRUZW1wbGF0aW5nRGVsZWdhdGUoKTtcblxuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoSFRNTEVsZW1lbnQucHJvdG90eXBlKTtcblxuICAgIHByb3RvLmNyZWF0ZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgICQodGhpcykuY2hpbGRyZW4oKS5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKCEoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0aGlzLnRhZ05hbWUpIGluc3RhbmNlb2YgRWxlbWVudCkgJiYgdGhpcy5ub2RlTmFtZS50b1VwcGVyQ2FzZSgpICE9PSAnVEVNUExBVEUnKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhZS1lYWNoIGNoaWxkcmVuIG11c3QgYmUgZWl0aGVyIDxhZS0uLi4+IG9yIGEgPHRlbXBsYXRlPiBlbGVtZW50LicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgbGV0IHRlbXBsYXRlTmFtZSA9ICQodGhpcykuYXR0cigndGVtcGxhdGUnKTtcbiAgICAgICAgaWYgKCF0ZW1wbGF0ZU5hbWUpIHtcbiAgICAgICAgICAgIGxldCB0ZW1wbGF0ZSA9ICQodGhpcykuZmluZCgnPnRlbXBsYXRlJyk7XG5cbiAgICAgICAgICAgIF9wcml2YXRlLnNldCh0aGlzLCB7XG4gICAgICAgICAgICAgICAgdGVtcGxhdGVOYW1lOiBfdGVtcGxhdGluZ0RlbGVnYXRlLnJlZ2lzdGVyVGVtcGxhdGUodGVtcGxhdGUuaHRtbCgpKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfcHJpdmF0ZS5zZXQodGhpcywge1xuICAgICAgICAgICAgICAgIHRlbXBsYXRlTmFtZTogdGVtcGxhdGVOYW1lXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoISQodGhpcykuZmluZCgnPmFlLW1hbmFnZWQnKS5sZW5ndGgpIHtcbiAgICAgICAgICAgICQodGhpcykuYXBwZW5kKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2FlLW1hbmFnZWQnKSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBsZXQgZGF0YVNvdXJjZU5hbWUgPSAkKHRoaXMpLmF0dHIoJ3NvdXJjZScpO1xuICAgICAgICBjb25zdCBwYXRoID0gJCh0aGlzKS5hdHRyKCdwYXRoJyk7XG4gICAgICAgIGxldCBkYXRhU291cmNlID0gX3BhZ2UuZ2V0RGF0YVNvdXJjZShkYXRhU291cmNlTmFtZSk7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlTmFtZSA9IF9wcml2YXRlLmdldCh0aGlzKS50ZW1wbGF0ZU5hbWU7XG5cbiAgICAgICAgY29uc3QgYXBwZW5kRm4gPSAoaW5IdG1sKSA9PiB7XG4gICAgICAgICAgICAkKHRoaXMpLmZpbmQoJz5hZS1tYW5hZ2VkJykuYXBwZW5kKGluSHRtbCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgZXJyb3JGbiA9IChpbkVycm9yKSA9PiB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoaW5FcnJvcik7XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgcmVuZGVyRm4gPSAoaW5EYXRhKSA9PiB7XG4gICAgICAgICAgICAkKHRoaXMpLmZpbmQoJz5hZS1tYW5hZ2VkJykuZW1wdHkoKTtcbiAgICAgICAgICAgIGlmIChpbkRhdGEgaW5zdGFuY2VvZiBPYnNlcnZhYmxlT2JqZWN0ICkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGluc3RhbmNlIG9mIGluRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBfdGVtcGxhdGluZ0RlbGVnYXRlLnJlbmRlcih0ZW1wbGF0ZU5hbWUsIGluc3RhbmNlKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRoZW4oYXBwZW5kRm4pXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZXJyb3JGbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfdGVtcGxhdGluZ0RlbGVnYXRlLnJlbmRlcih0ZW1wbGF0ZU5hbWUsIGluRGF0YSlcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oYXBwZW5kRm4pXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaChlcnJvckZuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBkYXRhU291cmNlLmJpbmRQYXRoKHRoaXMsIHBhdGgsIChpbk5ld1ZhbHVlKSA9PiB7XG4gICAgICAgICAgICByZW5kZXJGbihpbk5ld1ZhbHVlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRhdGFTb3VyY2UucmVzb2x2ZSh0aGlzLCBwYXRoKS50aGVuKChpbkRhdGEpID0+IHtcbiAgICAgICAgICAgIHJlbmRlckZuKGluRGF0YSk7ICAgIFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLWVhY2gnLCB7IHByb3RvdHlwZTogcHJvdG8gfSk7XG59XG4iLCJpbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IG1pY3JvdGFzayBmcm9tICcuLi9taWNyb3Rhc2snO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzdGF0ZShpblBhZ2UpIHtcbiAgICAndXNlIHN0cmljdCc7XG4gICAgY29uc3QgX3BhZ2UgPSBpblBhZ2U7XG4gICAgdmFyIHByb3RvID0gT2JqZWN0LmNyZWF0ZShIVE1MRWxlbWVudC5wcm90b3R5cGUpO1xuXG4gICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IF9wYWdlLnJlc29sdmVOb2RlQ29tcG9uZW50KHRoaXMpO1xuICAgICAgICBjb25zdCBtZXRob2QgPSAkKHRoaXMpLmF0dHIoJ21ldGhvZCcpIHx8ICdyZW1vdmFsJztcbiAgICAgICAgY29uc3Qgc3RhdGVQYXR0ZXJuID0gbmV3IFJlZ0V4cCgkKHRoaXMpLmF0dHIoJ3BhdHRlcm4nKSB8fCAnXiQnKTtcbiAgICAgICAgY29uc3Qgc3RhdGVQYXRoTWF0Y2ggPSAkKHRoaXMpLmF0dHIoJ3BhdGgnKTtcbiAgICAgICAgY29uc3Qgc3RhdGVOYW1lTWF0Y2ggPSAkKHRoaXMpLmF0dHIoJ25hbWUnKTtcbiAgICAgICAgY29uc3Qgd2F0Y2hlciA9ICgpID0+IHtcbiAgICAgICAgICAgICQodGhpcykucHJvcCgnd2lsbFJlbmRlcicsIGZhbHNlKTtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRTdGF0ZSA9IGNvbXBvbmVudC5nZXRDdXJyZW50U3RhdGUoKTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPVxuICAgICAgICAgICAgICAgIHN0YXRlUGF0aE1hdGNoID09PSBjdXJyZW50U3RhdGUuZ2V0UGF0aCgpIHx8XG4gICAgICAgICAgICAgICAgc3RhdGVOYW1lTWF0Y2ggPT09IGN1cnJlbnRTdGF0ZS5nZXROYW1lKCkgfHxcbiAgICAgICAgICAgICAgICBzdGF0ZVBhdHRlcm4udGVzdChjdXJyZW50U3RhdGUuZ2V0UGF0aCgpKTtcblxuICAgICAgICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAobWV0aG9kID09PSAndmlzaWJpbGl0eScpIHtcbiAgICAgICAgICAgICAgICAgICAgJCh0aGlzKS5jaGlsZHJlbigpLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAkKHRoaXMpLnJlbW92ZUNsYXNzKCdpcy1oaWRkZW4nKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEkKHRoaXMpLnByb3AoJ3dhc1JlbmRlcmVkJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICQodGhpcykuaHRtbCh0aGlzLmNvbnRlbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgJCh0aGlzKS5wcm9wKCd3YXNSZW5kZXJlZCcsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuLy8gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2Fib3V0IHRvIGNhbGwgLnJlbmRlcmVkIG9uICcgKyBjdXJyZW50U3RhdGUuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgICAgICBjdXJyZW50U3RhdGUucmVuZGVyZWQoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3Zpc2liaWxpdHknKSB7XG4gICAgICAgICAgICAgICAgICAgICQodGhpcykuY2hpbGRyZW4oKS5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgJCh0aGlzKS5hZGRDbGFzcygnaXMtaGlkZGVuJyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICQodGhpcykuZW1wdHkoKTtcbiAgICAgICAgICAgICAgICAgICAgJCh0aGlzKS5wcm9wKCd3YXNSZW5kZXJlZCcsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgY29tcG9uZW50LndhdGNoU3RhdGUoKCkgPT4ge1xuICAgICAgICAgICAgaWYoISQodGhpcykucHJvcCgnd2lsbFJlbmRlcicpKSB7XG4gICAgICAgICAgICAgICAgJCh0aGlzKS5wcm9wKCd3aWxsUmVuZGVyJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgbWljcm90YXNrKHdhdGNoZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5jb250ZW50ID0gJCh0aGlzKS5odG1sKCk7XG4gICAgICAgIHdhdGNoZXIoKTtcblxuICAgIH07XG5cbiAgICBwcm90by5hdHRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cblxuICAgIH07XG5cbiAgICBwcm90by5kZXRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICB9O1xuXG4gICAgZG9jdW1lbnQucmVnaXN0ZXJFbGVtZW50KCdhZS1zdGF0ZScsIHsgcHJvdG90eXBlOiBwcm90byB9KTtcbn1cbiIsIid1c2Ugc3RyaWN0Jztcbi8qKlxuICogQmluZHMgYSBCdXMgYWN0aW9uIHRvIHRoZSBwYXJlbnQgbm9kZS5cbiAqXG4gKiBQYXJhbXMgY2FuIGJlIHBhc3NlZCB0aHJvdWdoIHRoaXMgZWxlbWVudCdzIHBhcmFtLXh4eCBhdHRyaWJ1dGVzXG4gKiBUaGUgcGFyYW0gdHlwZXMgYXJlIGluZmVycmVkOiBudW1iZXJzLCBib29sZWFucywgbnVsbC5cbiAqIEl0IGlzIHBvc3NpYmxlIHRvIHBhc3MgYXMgYSBwYXJhbSBhIHJlZmVyZW5jZSB0byAgdGhlIGN1cnJlbnQgbW9kZWwncyBwcm9wZXJ0eVxuICogYnkgdXNpbmcgbGVhZGluZyB0aWxkZSBmb2xsb3dlZCBieSB0aGUgbW9kZWwncyBwYXRoLiBFLmcuIHBhcmFtLXVzZXJfbmFtZT1cIn51c2VyX3Byb2ZpbGUubmFtZVwiLlxuICogVXNpbmcganVzdCBhIHRpbGRlIHdpbGwgcGFzcyB0aGUgd2hvbGUgbW9kZWwgb2JqZWN0LlxuICogVG8gZm9yY2UgdmFsdWVzIHRvIGJlIGV2YWx1YXRlZCBhcyBzdHJpbmdzLCB3cmFwIHBhcmFtIHZhbHVlIGluIGJhY2t0aWNrcy4gXG4gKiBFLmcuIHBhcmFtLXN0cmluZ192YWx1ZT1cImAxMjNgXCJcbiAqL1xuXG4vKlxuICogSU1QUk9WRU1FTlRTOiBhdCB0aGUgbW9tZW50IG9ubHkgdGhlIGxvY2FsIGRhdGEgbW9kZWwgaXMgYWx3YXlzIHVzZWQgZm9yIG1vZGVsIHBhdGggcmVzb2x1dGlvblxuICogSSBzaG91bGQgZXZhbHVhdGUgdGhlIG9wdGlvbiBvZiBwYXNzaW5nIHRoZSBhY3Rpb24gaGFuZGxlciBhIFByb21pc2UsIGluIHRoZSBjYXNlIHdoZXJlXG4gKiB0aGUgcGF0aCByZXNvbHV0aW9uIHJlcXVpcmVzIGFuIGFzeW5jIG9wZXJhdGlvbi5cbiAqIFRoZSBhcHBsaWNhdGlvbiBzaG91bGQgYmUgaW5mb3JtZWQgb2YgYSBwZW5kaW5nIG9wZXJhdGlvbiBzbyBpdCBjb3VsZFxuICogc2hvdyBhIHByb2dyZXNzIHBhbmVsLCB3aGVyZSBhcHByb3ByaWF0ZVxuICogVGhpcyBpbnZvbHZlcywgYXNpZGUgZnJvbSBwYXNzaW5nIGEgUHJvbWlzZSB0byB0aGUgYWN0aW9uIGhhbmRsZXIsIFxuICogdGhlIHJlc29sdXRpb24gb2YgYWxsIHBhcmFtZXRlcnMgdGhhdCBjb3VsZCBwcm90ZW50aWFsbHkgbWFrZVxuICogc2VwYXJhdGUgYXN5bmMgb3BlcmF0aW9uc1xuICovXG5cblxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcblxuaW1wb3J0IGF0dGFjaEFjdGlvbiBmcm9tICcuLi9kZWxlZ2F0ZS9hY3Rpb24tdHJpZ2dlci1kZWxlZ2F0ZSc7XG5cbmxldCBfcGFnZTtcblxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhY3Rpb24oaW5QYWdlKSB7XG5cbiAgICBfcGFnZSA9IGluUGFnZTtcblxuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoSFRNTEVsZW1lbnQucHJvdG90eXBlKTtcblxuICAgIHByb3RvLmNyZWF0ZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgfTtcblxuICAgIHByb3RvLmF0dGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgYXR0YWNoQWN0aW9uLmNhbGwodGhpcywgX3BhZ2UsIHtcbiAgICAgICAgICAgIG5hbWU6ICQodGhpcykuYXR0cignbmFtZScpLFxuICAgICAgICAgICAgdHJpZ2dlcjogJCh0aGlzKS5hdHRyKCd0cmlnZ2VyJyksXG4gICAgICAgICAgICB0YXJnZXQ6ICQodGhpcykuYXR0cigndGFyZ2V0JyksXG4gICAgICAgICAgICBwYXJhbXM6ICgoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFyYW1zID0ge307XG4gICAgICAgICAgICAgICAgJCgkKHRoaXMpLmdldCgwKS5hdHRyaWJ1dGVzKS5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoL15wYXJhbS0vLnRlc3QodGhpcy5uYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1zW3RoaXMubmFtZS5yZXBsYWNlKCdwYXJhbS0nLCAnJyldID0gdGhpcy52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICAgICAgICB9KSgpXG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBwcm90by5kZXRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICB9O1xuXG4gICAgZG9jdW1lbnQucmVnaXN0ZXJFbGVtZW50KCdhZS1hY3Rpb24nLCB7IHByb3RvdHlwZTogcHJvdG8gfSk7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5pbXBvcnQgZWFjaCBmcm9tICdsb2Rhc2guZm9yZWFjaCc7XG5pbXBvcnQgaW5jbHVkZXMgZnJvbSAnbG9kYXNoLmluY2x1ZGVzJztcbmltcG9ydCBPYnNlcnZhYmxlT2JqZWN0IGZyb20gJy4uL09ic2VydmFibGVPYmplY3QnO1xuXG5jbGFzcyBJbnB1dFZhbHVlQ2hhbmdlRGVsZWdhdGUge1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG5cbiAgICB9XG5cbiAgICBjYW5PdXRwdXRWYWx1ZShpbkVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuICgoISFpbkVsZW1lbnQpICYmIChcbiAgICAgICAgICAgICQoaW5FbGVtZW50KS5nZXQoMCkgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50IHx8XG4gICAgICAgICAgICAkKGluRWxlbWVudCkuZ2V0KDApIGluc3RhbmNlb2YgSFRNTFRleHRBcmVhRWxlbWVudCB8fFxuICAgICAgICAgICAgJChpbkVsZW1lbnQpLmdldCgwKSBpbnN0YW5jZW9mIEhUTUxTZWxlY3RFbGVtZW50KSk7XG4gICAgfVxuXG4gICAgb25WYWx1ZUNoYW5nZShpbkVsZW1lbnQsIGluQ29uZmlnLCBpbkhhbmRsZXIpIHtcbiAgICAgICAgY29uc3QgZGVsYXkgPSAhaXNOYU4oaW5Db25maWcuZGVsYXkpID8gTnVtYmVyKGluQ29uZmlnLmRlbGF5KSA6IG51bGw7XG4gICAgICAgIGNvbnN0IGNvbW1pdE9ubHkgPSBpbkNvbmZpZy5jb21taXRPbmx5ID09PSB0cnVlO1xuICAgICAgICBsZXQgZXZlbnRzID0gaW5Db25maWcuZXZlbnQ7XG4gICAgICAgIGlmICghZXZlbnRzKSB7XG5cbiAgICAgICAgICAgIHN3aXRjaCAoJChpbkVsZW1lbnQpLmdldCgwKS5ub2RlTmFtZS50b1VwcGVyQ2FzZSgpKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnSU5QVVQnOlxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gKCQoaW5FbGVtZW50KS5hdHRyKCd0eXBlJykgfHwgJ1RFWFQnKS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVzKFsnVEVYVCcsICdFTUFJTCcsICdURUwnLCAnUEFTU1dPUkQnXSwgdHlwZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudHMgPSAnY2hhbmdlLGtleXVwJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZXMoWydDSEVDS0JPWCcsICdSQURJTyddLCB0eXBlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50cyA9ICdjbGljayc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnU0VMRUNUJzpcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzID0gJ2NoYW5nZSc7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50cyA9ICdrZXlkb3duJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBsZXQgZGVsYXllZFRpbWVvdXQ7XG5cbiAgICAgICAgY29uc3QgZGVmYXVsdEhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICBpbkhhbmRsZXIoe1xuICAgICAgICAgICAgICAgIHZhbHVlOiB0aGlzLmdldFZhbHVlKGluRWxlbWVudCksXG4gICAgICAgICAgICAgICAga2V5OiAkKGluRWxlbWVudCkuYXR0cignbmFtZScpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCB0aW1lb3V0SGFuZGxlciA9ICgpID0+IHtcbiAgICAgICAgICAgIGRlZmF1bHRIYW5kbGVyKCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgZGVsYXllZEhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoZGVsYXllZFRpbWVvdXQgPT09IHVuZGVmaW5lZCB8fCAhIWRlbGF5ZWRUaW1lb3V0KSB7XG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KGRlbGF5ZWRUaW1lb3V0KTtcbiAgICAgICAgICAgICAgICBkZWxheWVkVGltZW91dCA9IHNldFRpbWVvdXQodGltZW91dEhhbmRsZXIsIGRlbGF5KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGVsYXllZFRpbWVvdXQgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRpbWVvdXRIYW5kbGVyKCk7XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICB9O1xuXG5cblxuICAgICAgICBjb25zdCBoYW5kbGVyID0gKCFpc05hTihkZWxheSkgPyBkZWxheWVkSGFuZGxlciA6IGRlZmF1bHRIYW5kbGVyKTtcblxuICAgICAgICBlYWNoKGV2ZW50cy5zcGxpdCgnLCcpLCAoZXZlbnROYW1lKSA9PiB7XG4gICAgICAgICAgICAkKGluRWxlbWVudCkub2ZmKGV2ZW50TmFtZSwgaGFuZGxlcikub24oZXZlbnROYW1lLCBoYW5kbGVyKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2V0VmFsdWUoaW5FbGVtZW50LCBpblZhbHVlLCBpblByb3BOYW1lKSB7XG4gICAgICAgIGluRWxlbWVudCA9ICQoaW5FbGVtZW50KTtcbiAgICAgICAgaWYgKCEkKGluRWxlbWVudCkuZ2V0KDApKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbmFtZSA9IGluRWxlbWVudC5hdHRyKCduYW1lJyk7XG4gICAgICAgIGlmICgkKGluRWxlbWVudCkuZ2V0KDApLm5vZGVOYW1lLnRvVXBwZXJDYXNlKCkgPT09ICdJTlBVVCcpIHtcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSAoJChpbkVsZW1lbnQpLmF0dHIoJ3R5cGUnKSB8fCAnVEVYVCcpLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdURVhUJzpcbiAgICAgICAgICAgICAgICBjYXNlICdFTUFJTCc6XG4gICAgICAgICAgICAgICAgY2FzZSAnVEVMJzpcbiAgICAgICAgICAgICAgICBjYXNlICdQQVNTV09SRCc6XG4gICAgICAgICAgICAgICAgICAgIGlmICgkKGluRWxlbWVudCkudmFsKCkgIT09IGluVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICQoaW5FbGVtZW50KS52YWwoaW5WYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnQ0hFQ0tCT1gnOlxuICAgICAgICAgICAgICAgICAgICAkKGluRWxlbWVudCkucHJvcCgnY2hlY2tlZCcsIGluVmFsdWUgPT09IHRydWUgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICghIWluVmFsdWUgJiYgaW5WYWx1ZSA9PT0gaW5FbGVtZW50LmF0dHIoJ3ZhbHVlJykpKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnUkFESU8nOlxuICAgICAgICAgICAgICAgICAgICAkKGluRWxlbWVudCkucHJvcCgnY2hlY2tlZCcsIGluVmFsdWUgPT09IGluRWxlbWVudC5hdHRyKCd2YWx1ZScpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKCQoaW5FbGVtZW50KS5nZXQoMCkubm9kZU5hbWUudG9VcHBlckNhc2UoKSA9PT0gJ1NFTEVDVCcpIHtcbiAgICAgICAgICAgICQoaW5FbGVtZW50KS5maW5kKCdvcHRpb25bdmFsdWU9JyArIGluVmFsdWUgKyAnXScpLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgJCh0aGlzKS5wcm9wKCdjaGVja2VkJywgaW5WYWx1ZSA9PT0gaW5FbGVtZW50LmF0dHIoJ3ZhbHVlJykpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGdldFZhbHVlKGluRWxlbWVudCkge1xuICAgICAgICBpZiAoISQoaW5FbGVtZW50KS5nZXQoMCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0YXJnZXRWYWx1ZSA9ICQoaW5FbGVtZW50KS5hdHRyKCd2YWx1ZScpO1xuICAgICAgICBpZiAoJChpbkVsZW1lbnQpLmdldCgwKS5ub2RlTmFtZS50b1VwcGVyQ2FzZSgpID09PSAnSU5QVVQnKSB7XG4gICAgICAgICAgICBjb25zdCB0eXBlID0gKCQoaW5FbGVtZW50KS5hdHRyKCd0eXBlJykgfHwgJ1RFWFQnKS50b1VwcGVyQ2FzZSgpO1xuXG4gICAgICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdURVhUJzpcbiAgICAgICAgICAgICAgICBjYXNlICdFTUFJTCc6XG4gICAgICAgICAgICAgICAgY2FzZSAnVEVMJzpcbiAgICAgICAgICAgICAgICBjYXNlICdQQVNTV09SRCc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAkKGluRWxlbWVudCkudmFsKCk7XG4gICAgICAgICAgICAgICAgY2FzZSAnQ0hFQ0tCT1gnOlxuICAgICAgICAgICAgICAgICAgICBpZiAoJChpbkVsZW1lbnQpLnByb3AoJ2NoZWNrZWQnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICEhdGFyZ2V0VmFsdWUgPyB0YXJnZXRWYWx1ZSA6ICQoaW5FbGVtZW50KS5wcm9wKCdjaGVja2VkJykgPT09IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICEhdGFyZ2V0VmFsdWUgPyBudWxsIDogZmFsc2U7XG4gICAgICAgICAgICAgICAgY2FzZSAnUkFESU8nOiAvL2pzaGludCBpZ25vcmU6bGluZVxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3JtID0gJChpbkVsZW1lbnQpLmNsb3Nlc3QoJ2Zvcm0nKS5nZXQoMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWZvcm0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lucHV0IGVsZW1lbnRzIG11c3QgYmUgZW5jbG9zZWQgaW4gYSBmb3JtJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc2VsZWN0ZWQgPSAkKGZvcm0pLmZpbmQoYHJhZGlvW25hbWU9JHskKGluRWxlbWVudCkuYXR0cignbmFtZScpfV06Y2hlY2tlZGApLmdldCgwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc2VsZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAkKHNlbGVjdGVkKS52YWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKCQoaW5FbGVtZW50KS5nZXQoMCkubm9kZU5hbWUudG9VcHBlckNhc2UoKSA9PT0gJ1RFWFRBUkVBJykge1xuICAgICAgICAgICAgcmV0dXJuICQoaW5FbGVtZW50KS52YWwoKTtcbiAgICAgICAgfSBlbHNlIGlmICgkKGluRWxlbWVudCkuZ2V0KDApLm5vZGVOYW1lLnRvVXBwZXJDYXNlKCkgPT09ICdTRUxFQ1QnKSB7XG4gICAgICAgICAgICBsZXQgb3V0ID0gW107XG4gICAgICAgICAgICAkKGluRWxlbWVudCkuZmluZCgnb3B0aW9uOnNlbGVjdGVkJykuZWFjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBvdXQucHVzaCgkKHRoaXMpLnZhbCgpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKCEkKGluRWxlbWVudCkucHJvcCgnbXVsdGlwbGUnKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvdXRbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb3V0O1xuICAgICAgICB9XG4gICAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBJbnB1dFZhbHVlQ2hhbmdlRGVsZWdhdGUoKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcblxuaW1wb3J0IGlzU3RyaW5nIGZyb20gJ2xvZGFzaC5pc1N0cmluZyc7XG5pbXBvcnQgZWFjaCBmcm9tICdsb2Rhc2guZm9yZWFjaCc7XG5pbXBvcnQgdmFsdWVDaGFuZ2VEZWxlZ2F0ZSBmcm9tICcuLi9kZWxlZ2F0ZS92YWx1ZS1jaGFuZ2UtZGVsZWdhdGUnO1xuXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGJpbmQoaW5QYWdlKSB7XG4gICAgY29uc3QgX3BhZ2UgPSBpblBhZ2U7XG4gICAgY29uc3QgX3ByaXZhdGUgPSBuZXcgV2Vha1NldCgpO1xuXG4gICAgdmFyIHByb3RvID0gT2JqZWN0LmNyZWF0ZShIVE1MRWxlbWVudC5wcm90b3R5cGUpO1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoJCh0aGlzKS5hdHRyKCdwYXRoJykgJiYgKCQodGhpcykuYXR0cignZnJvbScpICYmICQodGhpcykuYXR0cigndG8nKSkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignYWUtYmluZCBhdHRyaWJ1dGUgXCJwYXRoXCIgaXMgaWdub3JlZCB3aGVuIGVpdGhlciBcImZyb21cIiBvciBcInRvXCIgYXJlIHNwZWNpZmllZDogXFxuTm9kZTonKTtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybih0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB0YXJnZXQ7XG4gICAgICAgIGlmICgkKHRoaXMpLmNoaWxkcmVuKCkubGVuZ3RoKSB7XG4gICAgICAgICAgICB0YXJnZXQgPSAkKHRoaXMpLmNoaWxkcmVuKCkuZ2V0KDApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0QXR0ciA9ICQodGhpcykuYXR0cigndGFyZ2V0Jyk7XG4gICAgICAgICAgICBpZiAoIXRhcmdldEF0dHIpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSAkKHRoaXMpLnBhcmVudCgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0YXJnZXRBdHRyID09PSAnbmV4dCcpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSAkKHRoaXMpLm5leHQoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoL15jbG9zZXN0Ly50ZXN0KHRhcmdldEF0dHIpKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2VncyA9IHRhcmdldEF0dHIuc3BsaXQoL1xccysvKTtcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSAkKHRoaXMpLmNsb3Nlc3Qoc2Vnc1sxXSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKC9eKFxcLnxcXCMpLy50ZXN0KHRhcmdldEF0dHIpKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gJCh0aGlzKS5wYXJlbnQoKS5maW5kKHRhcmdldEF0dHIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1Vua25vd24gYWUtYmluZCB0YXJnZXQ6ICcgKyB0YXJnZXRBdHRyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBkYXRhU291cmNlTmFtZSA9ICQodGhpcykuYXR0cignc291cmNlJyk7XG4gICAgICAgIGNvbnN0IHBhdGggPSAkKHRoaXMpLmF0dHIoJ3BhdGgnKTtcbiAgICAgICAgbGV0IGRhdGFTb3VyY2UgPSBfcGFnZS5nZXREYXRhU291cmNlKGRhdGFTb3VyY2VOYW1lKTtcbiAgICAgICAgaWYgKCFkYXRhU291cmNlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBiaW5kIHRvIGRhdGEtc291cmNlOiAnICsgZGF0YVNvdXJjZU5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHVzZVBhdGggPSBwYXRoICYmICEkKHRoaXMpLmF0dHIoJ2Zyb20nKSAmJiAhJCh0aGlzKS5hdHRyKCd0bycpO1xuICAgICAgICBjb25zdCB0b0F0dHIgPSB1c2VQYXRoID8gcGF0aCA6ICQodGhpcykuYXR0cigndG8nKTtcbiAgICAgICAgY29uc3QgZnJvbUF0dHIgPSB1c2VQYXRoID8gcGF0aCA6ICQodGhpcykuYXR0cignZnJvbScpO1xuICAgICAgICBsZXQgaW5BdHRyID0gJCh0aGlzKS5hdHRyKCdpbicpIHx8ICcnO1xuICAgICAgICBjb25zdCBpc0Zvcm1FbGVtZW50ID0gdmFsdWVDaGFuZ2VEZWxlZ2F0ZS5jYW5PdXRwdXRWYWx1ZSh0YXJnZXQpO1xuXG4gICAgICAgIGlmICghaW5BdHRyICYmIGlzRm9ybUVsZW1lbnQpIHtcbiAgICAgICAgICAgIGluQXR0ciA9ICdmb3JtLWVsZW1lbnQtdmFsdWUnO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmcm9tQXR0cikge1xuICAgICAgICAgICAgbGV0IG5vZGVBdHRyID0gaW5BdHRyLnNwbGl0KCc6Jyk7XG4gICAgICAgICAgICBub2RlQXR0clswXSA9IG5vZGVBdHRyWzBdIHx8ICdodG1sJztcblxuICAgICAgICAgICAgaWYgKG5vZGVBdHRyWzBdID09PSAnaHRtbCcpIHtcbiAgICAgICAgICAgICAgICAkKHRhcmdldCkuYXR0cignZGF0YS1hZS1iaW5kLWh0bWwnLCBmcm9tQXR0cik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHZhbHVlUmVzb2x2ZXIgPSAoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBjb25kaXRpb24gPSAkKHRoaXMpLmF0dHIoJ2lmJyk7XG4gICAgICAgICAgICAgICAgbGV0IGNvbmRpdGlvbk1ldCA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKGNvbmRpdGlvbikge1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCBuZWdhdGUgPVxuICAgICAgICAgICAgICAgICAgICAgICAgKCEhY29uZGl0aW9uICYmIC9eIS8udGVzdChjb25kaXRpb24pKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb24gPSBjb25kaXRpb24ucmVwbGFjZSgvXiEvLCAnJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmRpdGlvbiAmJiAvXlxcLy4qXFwvJC8udGVzdChjb25kaXRpb24pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25kaXRpb24gPSBuZXcgUmVnRXhwKGNvbmRpdGlvbi5yZXBsYWNlKC9eXFwvLywgJycpLnJlcGxhY2UoL1xcLyQvLCAnJykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9uTWV0ID0gY29uZGl0aW9uLnRlc3QoaW5WYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNTdHJpbmcoY29uZGl0aW9uKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoL14odHJ1ZXxmYWxzZSkkLy50ZXN0KGNvbmRpdGlvbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25kaXRpb24gPSBCb29sZWFuKGNvbmRpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25NZXQgPSAoY29uZGl0aW9uID09PSBpblZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25NZXQgPSBjb25kaXRpb25NZXQgPT09ICghbmVnYXRlKTsvL2pzaGludCBpZ25vcmU6bGluZVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHN3aXRjaCAobm9kZUF0dHJbMF0pIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnaHRtbCc6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29uZGl0aW9uTWV0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCh0YXJnZXQpLmh0bWwoaW5WYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnYXR0cic6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29uZGl0aW9uTWV0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCh0YXJnZXQpLmF0dHIobm9kZUF0dHJbMV0sIGluVmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2NsYXNzJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb25kaXRpb25NZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkKHRhcmdldCkuYWRkQ2xhc3Mobm9kZUF0dHJbMV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkKHRhcmdldCkucmVtb3ZlQ2xhc3Mobm9kZUF0dHJbMV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2Zvcm0tZWxlbWVudC12YWx1ZSc6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29uZGl0aW9uTWV0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVDaGFuZ2VEZWxlZ2F0ZS5zZXRWYWx1ZSh0YXJnZXQsIGluVmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0kgZG9uXFwndCBrbm93IGhvdyB0byBiaW5kIHZhbHVlIHRvIGVsZW1lbnQnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGRhdGFTb3VyY2UuYmluZFBhdGgodGhpcywgZnJvbUF0dHIsIGZ1bmN0aW9uKGluTmV3VmFsdWUsIGluT2xkVmFsdWUpIHtcbiAgICAgICAgICAgICAgICBpZihpbk5ld1ZhbHVlICE9PSBpbk9sZFZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlUmVzb2x2ZXIoaW5OZXdWYWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGRhdGFTb3VyY2UucmVzb2x2ZSh0aGlzLCBmcm9tQXR0cikudGhlbigoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHZhbHVlUmVzb2x2ZXIoaW5WYWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRvQXR0cikge1xuICAgICAgICAgICAgaWYgKCFpc0Zvcm1FbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFbGVtZW50ICcgKyAkKHRhcmdldCkuZ2V0KDApLm5vZGVOYW1lICsgJyBjYW5ub3QgYmUgdXNlZCBhcyBhIHNvdXJjZSBvZiBiaW5kaW5nIG91dHB1dCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgb3V0T3B0aW9ucyA9IHt9O1xuICAgICAgICAgICAgZWFjaCh0aGlzLmF0dHJpYnV0ZXMsIChpbkF0dHJpYnV0ZSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICgvXm91dC0vLnRlc3QoaW5BdHRyaWJ1dGUubmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgb3V0T3B0aW9uc1tpbkF0dHJpYnV0ZS5uYW1lLnJlcGxhY2UoL15vdXQtLywgJycpXSA9IGluQXR0cmlidXRlLnZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdmFsdWVDaGFuZ2VEZWxlZ2F0ZS5vblZhbHVlQ2hhbmdlKHRhcmdldCwgb3V0T3B0aW9ucywgKGluVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICBkYXRhU291cmNlLnNldFBhdGgodGhpcywgdG9BdHRyLCBpblZhbHVlLnZhbHVlID09IG51bGwgPyBudWxsIDogaW5WYWx1ZS52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG5cbiAgICB9O1xuXG4gICAgcHJvdG8uZGV0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgfTtcblxuICAgIGRvY3VtZW50LnJlZ2lzdGVyRWxlbWVudCgnYWUtYmluZCcsIHsgcHJvdG90eXBlOiBwcm90byB9KTtcbn1cbiIsImltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5pbXBvcnQgbWljcm90YXNrIGZyb20gJy4uL21pY3JvdGFzayc7XG5cbmltcG9ydCBmYWN0b3J5IGZyb20gJy4uL3BhZ2UtZmFjdG9yeSc7XG5pbXBvcnQgT2JzZXJ2YWJsZU9iamVjdCBmcm9tICcuLi9PYnNlcnZhYmxlT2JqZWN0JztcbmltcG9ydCB0cmFuc2Zvcm0gZnJvbSAnbG9kYXNoLnRyYW5zZm9ybSc7XG5pbXBvcnQgZWFjaCBmcm9tICdsb2Rhc2guZm9yZWFjaCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHJlbmRlcihpblBhZ2UpIHtcbiAgICAndXNlIHN0cmljdCc7XG4gICAgY29uc3QgX3ByaXZhdGUgPSBuZXcgV2Vha01hcCgpO1xuICAgIGNvbnN0IF9wYWdlID0gaW5QYWdlO1xuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoSFRNTEVsZW1lbnQucHJvdG90eXBlKTtcblxuICAgIGNvbnN0IGludmFsaWRhdGUgPSBmdW5jdGlvbiBpbnZhbGlkYXRlKCkge1xuICAgICAgICBpZiAoIV9wcml2YXRlLmdldCh0aGlzKS53aWxsUmVuZGVyKSB7XG4gICAgICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykud2lsbFJlbmRlciA9IHRydWU7XG4gICAgICAgICAgICBtaWNyb3Rhc2socmVuZGVyLmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHZhciByZW5kZXIgPSBmdW5jdGlvbiByZW5kZXIoKSB7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS53aWxsUmVuZGVyID0gZmFsc2U7XG4gICAgICAgIC8vIGlmICgkKHRoaXMpLmF0dHIoJ2RlYnVnLW5hbWUnKSkge1xuICAgICAgICAvLyAgICAgY29uc29sZS5pbmZvKCQodGhpcykuYXR0cignZGVidWctbmFtZScpICsgJyB3aWxsIHJlbmRlcicpO1xuICAgICAgICAvLyB9XG5cbiAgICAgICAgbGV0IHRlbXBsYXRlTmFtZSA9ICQodGhpcykuYXR0cigndGVtcGxhdGUnKTtcblxuICAgICAgICBjb25zdCBwYXRoID0gJCh0aGlzKS5hdHRyKCdmcm9tJykgfHwgJy4nO1xuICAgICAgICBfcGFnZS5nZXREYXRhU291cmNlKCkucmVzb2x2ZSh0aGlzLCBwYXRoKS50aGVuKChpblZhbHVlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBhdHRycyA9IHRyYW5zZm9ybSh0aGlzLmF0dHJpYnV0ZXMsIGZ1bmN0aW9uKHJlc3VsdCwgaXRlbSkge1xuICAgICAgICAgICAgICAgIGl0ZW0uc3BlY2lmaWVkICYmIC9ecGFyYW0tLy50ZXN0KGl0ZW0ubmFtZSkgJiYgKHJlc3VsdFtpdGVtLm5hbWUucmVwbGFjZSgncGFyYW0tJywgJycpXSA9IGl0ZW0udmFsdWUpOyAvL2pzaGludCBpZ25vcmU6bGluZVxuICAgICAgICAgICAgfSwge30pO1xuXG4gICAgICAgICAgICBmYWN0b3J5LmdldFRlbXBsYXRpbmdEZWxlZ2F0ZSgpXG4gICAgICAgICAgICAgICAgLnJlbmRlcih0ZW1wbGF0ZU5hbWUsIGluVmFsdWUgfHwge30sIF9wcml2YXRlLmdldCh0aGlzKS5wYXJhbXMpXG4gICAgICAgICAgICAgICAgLnRoZW4oKGluSHRtbCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAkKHRoaXMpLmZpbmQoJz5hZS1tYW5hZ2VkJykuaHRtbChpbkh0bWwpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKChpbkVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoaW5FcnJvcik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pLmNhdGNoKChpbkVycm9yKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGluRXJyb3IpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIHByb3RvLmNyZWF0ZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBfcHJpdmF0ZS5zZXQodGhpcywgeyBcbiAgICAgICAgICAgIHdpbGxSZW5kZXI6IGZhbHNlLFxuICAgICAgICAgICAgcGFyYW1zIDogKCgpID0+IHtcbiAgICAgICAgICAgICAgICB2YXIgb3V0ID0ge307XG4gICAgICAgICAgICAgICAgZWFjaCh0aGlzLmF0dHJpYnV0ZXMsIChpbkF0dHJpYnV0ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZigvXnBhcmFtLS8udGVzdChpbkF0dHJpYnV0ZS5uYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3V0W2luQXR0cmlidXRlLm5hbWUucmVwbGFjZSgncGFyYW0tJywgJycpXSA9IGluQXR0cmlidXRlLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG91dDtcbiAgICAgICAgICAgIH0pKCkgfSk7XG4gICAgICAgIGxldCB0ZW1wbGF0ZU5hbWUgPSAkKHRoaXMpLmF0dHIoJ3RlbXBsYXRlJyk7XG4gICAgICAgIGlmICghdGVtcGxhdGVOYW1lKSB7XG4gICAgICAgICAgICBsZXQgdGVtcGxhdGUgPSAkKHRoaXMpLmZpbmQoJz50ZW1wbGF0ZScpO1xuICAgICAgICAgICAgaWYgKCF0ZW1wbGF0ZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigkKHRoaXMpLmdldFBhdGgoKSArICcgbXVzdCBoYXZlIGEgdGVtcGxhdGUgYXR0cmlidXRlIG9yIGEgdGVtcGxhdGUgZWxlbWVudCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGVtcGxhdGVOYW1lID0gZmFjdG9yeS5nZXRUZW1wbGF0aW5nRGVsZWdhdGUoKVxuICAgICAgICAgICAgICAgIC5yZWdpc3RlclRlbXBsYXRlKHRlbXBsYXRlLmh0bWwoKSk7XG4gICAgICAgICAgICAkKHRoaXMpLmF0dHIoJ3RlbXBsYXRlJywgdGVtcGxhdGVOYW1lKTtcbiAgICAgICAgICAgICQodGhpcykuZW1wdHkoKTtcbiAgICAgICAgfVxuICAgICAgICAkKHRoaXMpLmFwcGVuZCgnPGFlLW1hbmFnZWQ+PC9hZS1tYW5hZ2VkPicpO1xuICAgIH07XG5cbiAgICBwcm90by5hdHRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgaW52YWxpZGF0ZS5jYWxsKHRoaXMpO1xuICAgICAgICB2YXIgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zKSA9PiB7XG4gICAgICAgICAgICBtdXRhdGlvbnMuZm9yRWFjaCgobXV0YXRpb24pID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoL15wYXJhbS0vLnRlc3QobXV0YXRpb24uYXR0cmlidXRlTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW52YWxpZGF0ZS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBjb25maWd1cmF0aW9uIG9mIHRoZSBvYnNlcnZlcjpcbiAgICAgICAgdmFyIGNvbmZpZyA9IHsgYXR0cmlidXRlczogdHJ1ZSB9O1xuXG4gICAgICAgIC8vIHBhc3MgaW4gdGhlIHRhcmdldCBub2RlLCBhcyB3ZWxsIGFzIHRoZSBvYnNlcnZlciBvcHRpb25zXG4gICAgICAgIG9ic2VydmVyLm9ic2VydmUodGhpcywgY29uZmlnKTtcblxuICAgICAgICBjb25zdCBwYXRoID0gJCh0aGlzKS5hdHRyKCdmcm9tJyk7XG4gICAgICAgIF9wYWdlLmdldERhdGFTb3VyY2UoKS5iaW5kUGF0aCh0aGlzLCBwYXRoLCAoaW5CYXNlTW9kZWwpID0+IHtcblxuICAgICAgICAgICAgaWYgKGluQmFzZU1vZGVsIGluc3RhbmNlb2YgT2JzZXJ2YWJsZU9iamVjdCkge1xuICAgICAgICAgICAgICAgIGluQmFzZU1vZGVsLndhdGNoKHBhdGgsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaW52YWxpZGF0ZS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpbnZhbGlkYXRlLmNhbGwodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpbnZhbGlkYXRlLmNhbGwodGhpcyk7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoJCh0aGlzKS5hdHRyKCd3YXRjaCcpKSB7XG4gICAgICAgICAgICBfcGFnZS5nZXREYXRhU291cmNlKCkuYmluZFBhdGgodGhpcywgJCh0aGlzKS5hdHRyKCd3YXRjaCcpLCAoaW5CYXNlTW9kZWwpID0+IHtcblxuICAgICAgICAgICAgICAgIGludmFsaWRhdGUuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgcHJvdG8uZGV0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgfTtcblxuICAgIGRvY3VtZW50LnJlZ2lzdGVyRWxlbWVudCgnYWUtcmVuZGVyJywgeyBwcm90b3R5cGU6IHByb3RvIH0pO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuXG5cbi8qKlxuKiAgIEEgY29udGFpbmVyIGZvciBlbGVtZW50IHRoYXQgY2hhbmdlIHRoZSB2YWx1ZSBvZiBhIHByb3BlcnR5IGJhc2VkIG9uIFxuKiAgIHNlbGVjdGlvbiBvZiBpdHMgY2hpbGRyZW4uIEl0IGJlaGF2ZXMgbGlrZSBhIHJhZGlvIGdyb3VwLlxuKiAgIGlmIG5vIHBhdGggYXR0cmlidXRlIGlzIGZvdW5kLCB0aGUgc3dpdGNoIHRhcmdldHMgdGhlIGNvbXBvbmVudCdzIHN0YXRlXG4qL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYWVTd2l0Y2goaW5QYWdlKSB7XG4gICAgY29uc3QgX3BhZ2UgPSBpblBhZ2U7XG4gICAgY29uc3QgX3ByaXZhdGUgPSBuZXcgV2Vha01hcCgpO1xuXG4gICAgY29uc3Qgc2VsZWN0SGFuZGxlciA9IGZ1bmN0aW9uIHNlbGVjdEhhbmRsZXIoaW5TZWxlY3RlZEVsZW1lbnQpIHtcbiAgICAgICAgY29uc3QgX3AgPSBfcHJpdmF0ZS5nZXQodGhpcyk7XG4gICAgICAgIGNvbnN0IHZhbCA9ICQoaW5TZWxlY3RlZEVsZW1lbnQpLmRhdGEoJ2FlLXN3aXRjaC12YWx1ZScpO1xuICAgICAgICAkKHRoaXMpLmNoaWxkcmVuKCkucmVtb3ZlQ2xhc3MoX3Auc2VsZWN0ZWRDbGFzcyk7XG4gICAgICAgICQoaW5TZWxlY3RlZEVsZW1lbnQpLmFkZENsYXNzKF9wLnNlbGVjdGVkQ2xhc3MpO1xuICAgICAgICBpZighX3Auc291cmNlKSB7XG4gICAgICAgICAgICBfcC50YXJnZXQudHJ5U3RhdGUodmFsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF9wYWdlLnJlc29sdmVOb2RlQ29tcG9uZW50KHRoaXMpO1xuICAgICAgICAgICAgX3BhZ2UuZ2V0RGF0YVNvdXJjZSgpLnNldFBhdGgodGhpcywgX3Auc291cmNlLCB2YWwpO1xuXG4gICAgICAgIH1cbiAgICAgICAgLy9jb25zb2xlLmxvZygnc3dpdGNoIGVsZW1lbnQgY2xpY2tlZDogJyArICQoaW5TZWxlY3RlZEVsZW1lbnQpLmRhdGEoJ2FlLXN3aXRjaC12YWx1ZScpKTtcbiAgICB9O1xuICAgIFxuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoSFRNTFVMaXN0RWxlbWVudC5wcm90b3R5cGUpO1xuICAgIHByb3RvLmNyZWF0ZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBfcHJpdmF0ZS5zZXQodGhpcywge1xuICAgICAgICAgICAgc2VsZWN0ZWRDbGFzczogJCh0aGlzKS5hdHRyKCdzZWxlY3RlZC1jbGFzcycpIHx8ICdzZWxlY3RlZCcsXG4gICAgICAgICAgICBzb3VyY2UgOiAkKHRoaXMpLmF0dHIoJ3BhdGgnKSB8fCBudWxsXG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBjb25zdCB0aGF0ID0gdGhpcztcbiAgICAgICAgY29uc3QgX3AgPSBfcHJpdmF0ZS5nZXQodGhpcyk7XG4gICAgICAgIF9wLnRhcmdldCA9IF9wYWdlLnJlc29sdmVOb2RlQ29tcG9uZW50KHRoaXMpO1xuICAgICAgICBsZXQgZGVmYXVsdFN3aXRjaDtcbiAgICAgICAgJCh0aGlzKS5jaGlsZHJlbigpLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZigkKHRoaXMpLmRhdGEoJ2FlLXN3aXRjaC12YWx1ZScpID09PSAkKHRoYXQpLmF0dHIoJ2RlZmF1bHQtdmFsdWUnKSkge1xuICAgICAgICAgICAgICAgIGRlZmF1bHRTd2l0Y2ggPSAkKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgJCh0aGlzKS5vZmYoJ2NsaWNrJywgc2VsZWN0SGFuZGxlcikub24oJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNlbGVjdEhhbmRsZXIuY2FsbCh0aGF0LCB0aGlzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYoZGVmYXVsdFN3aXRjaCkge1xuICAgICAgICAgICAgICAgIHNlbGVjdEhhbmRsZXIuY2FsbCh0aGF0LCBkZWZhdWx0U3dpdGNoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgcHJvdG8uZGV0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgfTtcblxuICAgIGRvY3VtZW50LnJlZ2lzdGVyRWxlbWVudCgnYWUtc3dpdGNoJywgeyBwcm90b3R5cGU6IHByb3RvLCBleHRlbmRzIDogJ3VsJyB9KTtcbn1cbiIsImltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5cbmltcG9ydCBlYWNoIGZyb20gJ2xvZGFzaC5mb3JlYWNoJztcbmltcG9ydCB1dWlkIGZyb20gJ25vZGUtdXVpZCc7XG5pbXBvcnQgYXR0YWNoQWN0aW9uIGZyb20gJy4uL2RlbGVnYXRlL2FjdGlvbi10cmlnZ2VyLWRlbGVnYXRlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYWVUZXh0SW5wdXQoaW5QYWdlKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuICAgIGNvbnN0IF9wYWdlID0gaW5QYWdlO1xuICAgIGxldCBvYnNlcnZlcjtcbiAgICBkb2N1bWVudC5zdHlsZVNoZWV0c1swXS5pbnNlcnRSdWxlKCdhZS1pbnB1dCcgKyAneyBkaXNwbGF5OiBibG9jazt9JywgMSk7XG4gICAgdmFyIHByb3RvID0gT2JqZWN0LmNyZWF0ZShIVE1MRWxlbWVudC5wcm90b3R5cGUpO1xuICAgIHByb3RvLmNyZWF0ZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoZnVuY3Rpb24obXV0YXRpb25zKSB7XG4gICAgICAgICAgICBtdXRhdGlvbnMuZm9yRWFjaChmdW5jdGlvbihtdXRhdGlvbikge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAobXV0YXRpb24uYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdsYWJlbCc6XG4gICAgICAgICAgICAgICAgICAgICAgICAkKG11dGF0aW9uLnRhcmdldCkuZmluZCgnbGFiZWw+c3BhbicpLnRleHQoJChtdXRhdGlvbi50YXJnZXQpLmF0dHIoJ2xhYmVsJykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3ZhbHVlJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICQobXV0YXRpb24udGFyZ2V0KS5maW5kKCdpbnB1dCcpLmF0dHIoJ3ZhbHVlJywgJChtdXRhdGlvbi50YXJnZXQpLmF0dHIoJ3ZhbHVlJykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2xhYmVsLWNsYXNzJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICQobXV0YXRpb24udGFyZ2V0KS5maW5kKCdsYWJlbCcpLmF0dHIoJ2NsYXNzJywgJChtdXRhdGlvbi50YXJnZXQpLmF0dHIoJ2xhYmVsLWNsYXNzJykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2lucHV0LWNsYXNzJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICQobXV0YXRpb24udGFyZ2V0KS5maW5kKCdpbnB1dCcpLmF0dHIoJ2NsYXNzJywgJChtdXRhdGlvbi50YXJnZXQpLmF0dHIoJ2lucHV0LWNsYXNzJykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmICgkKHRoaXMpLmF0dHIoJ2JpbmQtZW5hYmxlZCcpKSB7XG4gICAgICAgICAgICBjb25zdCBwYXRoID0gJCh0aGlzKS5hdHRyKCdiaW5kLWVuYWJsZWQnKS5yZXBsYWNlKCchJywgJycpO1xuICAgICAgICAgICAgY29uc3QgbmVnYXRlID0gL14hLy50ZXN0KCQodGhpcykuYXR0cignYmluZC1lbmFibGVkJykpO1xuICAgICAgICAgICAgY29uc3Qgc291cmNlID0gJCh0aGlzKS5hdHRyKCdzb3VyY2UnKTtcbiAgICAgICAgICAgIGNvbnN0IHNldFZhbHVlID0gKGluVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAkKHRoaXMpLmZpbmQoJ2lucHV0JykucHJvcCgnZGlzYWJsZWQnLFxuICAgICAgICAgICAgICAgICAgICAoKGluVmFsdWUgPT09IGZhbHNlKSAmJiAhbmVnYXRlKSB8fFxuICAgICAgICAgICAgICAgICAgICAoKGluVmFsdWUgIT09IGZhbHNlKSAmJiBuZWdhdGUpKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIF9wYWdlXG4gICAgICAgICAgICAgICAgLmdldERhdGFTb3VyY2Uoc291cmNlKVxuICAgICAgICAgICAgICAgIC5iaW5kUGF0aCh0aGlzLCBwYXRoLCAoaW5OZXdWYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBzZXRWYWx1ZShpbk5ld1ZhbHVlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIF9wYWdlXG4gICAgICAgICAgICAgICAgLmdldERhdGFTb3VyY2Uoc291cmNlKVxuICAgICAgICAgICAgICAgIC5yZXNvbHZlKHRoaXMsIHBhdGgpXG4gICAgICAgICAgICAgICAgLnRoZW4oKGluVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc2V0VmFsdWUoaW5WYWx1ZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIC8vIGNvbmZpZ3VyYXRpb24gb2YgdGhlIG9ic2VydmVyOlxuICAgICAgICBjb25zdCBjb25maWcgPSB7IGF0dHJpYnV0ZXM6IHRydWUgfTtcbiAgICAgICAgLy8gcGFzcyBpbiB0aGUgdGFyZ2V0IG5vZGUsIGFzIHdlbGwgYXMgdGhlIG9ic2VydmVyIG9wdGlvbnNcbiAgICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLCBjb25maWcpO1xuICAgICAgICBjb25zdCBpbnB1dFR5cGUgPSAkKHRoaXMpLmF0dHIoJ3R5cGUnKSB8fCAndGV4dCc7XG4gICAgICAgIGlmICgvXihjaGVja2JveHxyYWRpbykkLy50ZXN0KGlucHV0VHlwZS50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgICAgICAgY29uc3QgYWN0aW9uTmFtZSA9ICQodGhpcykuYXR0cignYWN0aW9uJyk7XG4gICAgICAgICAgICBpZiAoYWN0aW9uTmFtZSkge1xuICAgICAgICAgICAgICAgIGF0dGFjaEFjdGlvbi5jYWxsKHRoaXMsIF9wYWdlLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGFjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHRyaWdnZXI6ICdjbGljaycsXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldDogJ3NlbGYnXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBsZXQgYmluZGluZ0F0dHJOYW1lO1xuICAgICAgICBlYWNoKCQodGhpcy5hdHRyaWJ1dGVzKSwgKGluQXR0cmlidXRlKSA9PiB7XG4gICAgICAgICAgICBpZiAoWydmcm9tJywgJ3RvJywgJ3BhdGgnXS5pbmRleE9mKGluQXR0cmlidXRlLm5hbWUpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIGJpbmRpbmdBdHRyTmFtZSA9IGluQXR0cmlidXRlLm5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBsZXQgYmluZGluZ05vZGUgPSAnJztcbiAgICAgICAgaWYgKGJpbmRpbmdBdHRyTmFtZSkge1xuICAgICAgICAgICAgY29uc3QgZGVsYXlBdHRyID0gJCh0aGlzKS5hdHRyKCdvdXQtZGVsYXknKSA/IGBvdXQtZGVsYXk9XCIkeyQodGhpcykuYXR0cignb3V0LWRlbGF5Jyl9XCJgIDogJyc7XG4gICAgICAgICAgICBiaW5kaW5nTm9kZSA9IGJpbmRpbmdBdHRyTmFtZSA/IGA8YWUtYmluZCAke2RlbGF5QXR0cn0gdGFyZ2V0PVwibmV4dFwiICR7YmluZGluZ0F0dHJOYW1lfT1cIiR7JCh0aGlzKS5hdHRyKGJpbmRpbmdBdHRyTmFtZSl9XCI+PC9hZS1iaW5kPmAgOiAnJztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBsYWJlbFBsYWNlbWVudCA9ICQodGhpcykuYXR0cignbGFiZWwtcGxhY2VtZW50JykgfHwgJ2xlZnQnO1xuICAgICAgICBjb25zdCBsYWJlbFRleHQgPSAkKHRoaXMpLmF0dHIoJ2xhYmVsJyk7XG4gICAgICAgIGNvbnN0IGF1dG9jb21wbGV0ZSA9ICQodGhpcykuYXR0cignYXV0b2NvbXBsZXRlJykgP1xuICAgICAgICAgICAgJyBhdXRvY29tcGxldGU9XCInICsgJCh0aGlzKS5hdHRyKCdhdXRvY29tcGxldGUnKSArICdcIicgOlxuICAgICAgICAgICAgJyc7XG4gICAgICAgIGNvbnN0IHBsYWNlaG9sZGVyID0gJCh0aGlzKS5hdHRyKCdwbGFjZWhvbGRlcicpIHx8ICcnO1xuICAgICAgICBjb25zdCBpbnB1dENsYXNzID0gJCh0aGlzKS5hdHRyKCdpbnB1dC1jbGFzcycpIHx8ICcnO1xuICAgICAgICBjb25zdCBkaXNhYmxlZCA9ICEoJCh0aGlzKS5hdHRyKCdlbmFibGVkJykgIT09ICdmYWxzZScgJiYgdHJ1ZSkgPyAnZGlzYWJsZWQnIDogJyc7XG4gICAgICAgIGNvbnN0IGlucHV0TmFtZSA9ICQodGhpcykuYXR0cignbmFtZScpIHx8ICdhZS0nICsgdXVpZC52NCgpO1xuICAgICAgICBjb25zdCB2YWx1ZUF0dHIgPSAkKHRoaXMpLmF0dHIoJ3ZhbHVlJykgPyBgdmFsdWU9XCIkeyQodGhpcykuYXR0cigndmFsdWUnKX1gIDogJyc7XG4gICAgICAgIGNvbnN0IGlucHV0ID0gYDxpbnB1dCBuYW1lPVwiJHtpbnB1dE5hbWV9XCIgJHtkaXNhYmxlZH0gdHlwZT1cIiR7aW5wdXRUeXBlfVwiICR7YXV0b2NvbXBsZXRlfSBjbGFzcz1cIiR7aW5wdXRDbGFzc31cIiBwbGFjZWhvbGRlcj1cIiR7cGxhY2Vob2xkZXJ9XCIgJHt2YWx1ZUF0dHJ9PmA7XG4gICAgICAgIGNvbnN0IGxhYmVsID0gbGFiZWxUZXh0ID8gYDxsYWJlbCBmb3I9XCIke2lucHV0TmFtZX1cIiBjbGFzcz1cIiR7JCh0aGlzKS5hdHRyKCdsYWJlbC1jbGFzcycpIHx8ICcnfVwiPiR7bGFiZWxUZXh0fTwvbGFiZWw+YCA6ICcnO1xuXG4gICAgICAgICQodGhpcykuYXBwZW5kKGAke2xhYmVsUGxhY2VtZW50ID09PSAnbGVmdCc/IGxhYmVsIDogJyd9JHtiaW5kaW5nTm9kZX0ke2lucHV0fSR7bGFiZWxQbGFjZW1lbnQgPT09ICdyaWdodCc/IGxhYmVsIDogJyd9YCk7XG4gICAgfTtcblxuICAgIHByb3RvLmF0dGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuICAgIH07XG5cbiAgICBwcm90by5kZXRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICB9O1xuXG4gICAgZG9jdW1lbnQucmVnaXN0ZXJFbGVtZW50KCdhZS1pbnB1dCcsIHsgcHJvdG90eXBlOiBwcm90byB9KTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcblxuaW1wb3J0IGtleWNvZGUgZnJvbSAna2V5Y29kZSc7XG5pbXBvcnQgYXR0YWNoQWN0aW9uIGZyb20gJy4uL2RlbGVnYXRlL2FjdGlvbi10cmlnZ2VyLWRlbGVnYXRlJztcbmltcG9ydCB2YWx1ZUNoYW5nZURlbGVnYXRlIGZyb20gJy4uL2RlbGVnYXRlL3ZhbHVlLWNoYW5nZS1kZWxlZ2F0ZSc7XG5pbXBvcnQgZWFjaCBmcm9tICdsb2Rhc2guZm9yZWFjaCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGFlQnV0dG9uKGluUGFnZSkge1xuICAgIGNvbnN0IF9wYWdlID0gaW5QYWdlO1xuICAgIGxldCBvYnNlcnZlcjtcblxuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoSFRNTElucHV0RWxlbWVudC5wcm90b3R5cGUpO1xuXG4gICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgY29uc3Qgc291cmNlID0gJCh0aGlzKS5hdHRyKCdzb3VyY2UnKTtcblxuICAgICAgICBsZXQgcmVzdHJpY3Q7XG4gICAgICAgIGlmICgocmVzdHJpY3QgPSAkKHRoaXMpLmF0dHIoJ3Jlc3RyaWN0JykpKSB7XG4gICAgICAgICAgICBpZiAoL15cXFsvLnRlc3QocmVzdHJpY3QpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmUgPSBuZXcgUmVnRXhwKHJlc3RyaWN0KTtcbiAgICAgICAgICAgICAgICAkKHRoaXMpLmtleWRvd24oKGluRXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChpbkV2ZW50LmtleUNvZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2Uga2V5Y29kZSgnZW50ZXInKTpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2Uga2V5Y29kZSgnbGVmdCcpOlxuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBrZXljb2RlKCd1cCcpOlxuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBrZXljb2RlKCdyaWdodCcpOlxuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBrZXljb2RlKCdkb3duJyk6XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIGtleWNvZGUoJ2RlbCcpOlxuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBrZXljb2RlKCdpbnMnKTpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2Uga2V5Y29kZSgndGFiJyk6XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIGtleWNvZGUoJ2JhY2tzcGFjZScpOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGFyID0ga2V5Y29kZShpbkV2ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXJlLnRlc3QoY2hhcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5FdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG4gICAgICAgIGxldCB0YXJnZXQgPSB0aGlzO1xuXG4gICAgICAgIGxldCBkYXRhU291cmNlTmFtZSA9ICQodGhpcykuYXR0cignc291cmNlJyk7XG4gICAgICAgIGNvbnN0IHBhdGggPSAkKHRoaXMpLmF0dHIoJ3BhdGgnKTtcbiAgICAgICAgbGV0IGRhdGFTb3VyY2UgPSBfcGFnZS5nZXREYXRhU291cmNlKGRhdGFTb3VyY2VOYW1lKTtcbiAgICAgICAgaWYgKCFkYXRhU291cmNlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBiaW5kIHRvIGRhdGEtc291cmNlOiAnICsgZGF0YVNvdXJjZU5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHVzZVBhdGggPSBwYXRoICYmICEkKHRoaXMpLmF0dHIoJ2Zyb20nKSAmJiAhJCh0aGlzKS5hdHRyKCd0bycpO1xuICAgICAgICBjb25zdCB0b0F0dHIgPSB1c2VQYXRoID8gcGF0aCA6ICQodGhpcykuYXR0cigndG8nKTtcbiAgICAgICAgY29uc3QgZnJvbUF0dHIgPSB1c2VQYXRoID8gcGF0aCA6ICQodGhpcykuYXR0cignZnJvbScpO1xuICAgICAgICBsZXQgaW5BdHRyID0gJCh0aGlzKS5hdHRyKCdpbicpIHx8ICcnO1xuXG4gICAgICAgIGlmICgkKHRoaXMpLmF0dHIoJ2JpbmQtZW5hYmxlZCcpKSB7XG4gICAgICAgICAgICBjb25zdCBwYXRoID0gJCh0aGlzKS5hdHRyKCdiaW5kLWVuYWJsZWQnKS5yZXBsYWNlKCchJywgJycpO1xuICAgICAgICAgICAgY29uc3QgbmVnYXRlID0gL14hLy50ZXN0KCQodGhpcykuYXR0cignYmluZC1lbmFibGVkJykpO1xuICAgICAgICAgICAgY29uc3Qgc291cmNlID0gJCh0aGlzKS5hdHRyKCdzb3VyY2UnKTtcbiAgICAgICAgICAgIGNvbnN0IHNldFZhbHVlID0gKGluVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAkKHRoaXMpLnByb3AoJ2Rpc2FibGVkJyxcbiAgICAgICAgICAgICAgICAgICAgKChpblZhbHVlID09PSBmYWxzZSkgJiYgIW5lZ2F0ZSkgfHxcbiAgICAgICAgICAgICAgICAgICAgKChpblZhbHVlICE9PSBmYWxzZSkgJiYgbmVnYXRlKSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBfcGFnZVxuICAgICAgICAgICAgICAgIC5nZXREYXRhU291cmNlKHNvdXJjZSlcbiAgICAgICAgICAgICAgICAuYmluZFBhdGgodGhpcywgcGF0aCwgKGluTmV3VmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc2V0VmFsdWUoaW5OZXdWYWx1ZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBfcGFnZVxuICAgICAgICAgICAgICAgIC5nZXREYXRhU291cmNlKHNvdXJjZSlcbiAgICAgICAgICAgICAgICAucmVzb2x2ZSh0aGlzLCBwYXRoKVxuICAgICAgICAgICAgICAgIC50aGVuKChpblZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHNldFZhbHVlKGluVmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cblxuXG4gICAgICAgIGlmIChmcm9tQXR0cikge1xuXG4gICAgICAgICAgICBjb25zdCB2YWx1ZVJlc29sdmVyID0gKGluVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICB2YWx1ZUNoYW5nZURlbGVnYXRlLnNldFZhbHVlKHRhcmdldCwgaW5WYWx1ZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBkYXRhU291cmNlLmJpbmRQYXRoKHRoaXMsIGZyb21BdHRyLCBmdW5jdGlvbihpbk5ld1ZhbHVlLCBpbk9sZFZhbHVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGluTmV3VmFsdWUgIT09IGluT2xkVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVSZXNvbHZlcihpbk5ld1ZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZGF0YVNvdXJjZS5yZXNvbHZlKHRoaXMsIGZyb21BdHRyKS50aGVuKChpblZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgdmFsdWVSZXNvbHZlcihpblZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRvQXR0cikge1xuICAgICAgICAgICAgY29uc3Qgb3V0T3B0aW9ucyA9IHt9O1xuICAgICAgICAgICAgZWFjaCh0aGlzLmF0dHJpYnV0ZXMsIChpbkF0dHJpYnV0ZSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICgvXm91dC0vLnRlc3QoaW5BdHRyaWJ1dGUubmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgb3V0T3B0aW9uc1tpbkF0dHJpYnV0ZS5uYW1lLnJlcGxhY2UoL15vdXQtLywgJycpXSA9IGluQXR0cmlidXRlLnZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdmFsdWVDaGFuZ2VEZWxlZ2F0ZS5vblZhbHVlQ2hhbmdlKHRhcmdldCwgb3V0T3B0aW9ucywgKGluVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICBkYXRhU291cmNlLnNldFBhdGgodGhpcywgdG9BdHRyLCBpblZhbHVlLnZhbHVlID09IG51bGwgPyBudWxsIDogaW5WYWx1ZS52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgkKHRoaXMpLmF0dHIoJ2FjdGlvbicpKSB7XG4gICAgICAgICAgICBhdHRhY2hBY3Rpb24uY2FsbCh0aGlzLCBfcGFnZSwge1xuICAgICAgICAgICAgICAgIG5hbWU6ICQodGhpcykuYXR0cignYWN0aW9uJylcblxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBwcm90by5hdHRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cblxuICAgIH07XG5cbiAgICBwcm90by5kZXRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICB9O1xuXG4gICAgZG9jdW1lbnQucmVnaXN0ZXJFbGVtZW50KCdhZS1pbnB1dDInLCB7XG4gICAgICAgIHByb3RvdHlwZTogcHJvdG8sXG4gICAgICAgIGV4dGVuZHM6ICdpbnB1dCdcbiAgICB9KTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuXG5pbXBvcnQgYXR0YWNoQWN0aW9uIGZyb20gJy4uL2RlbGVnYXRlL2FjdGlvbi10cmlnZ2VyLWRlbGVnYXRlJztcbmltcG9ydCBnZXQgZnJvbSAnbG9kYXNoLmdldCc7XG5cbmxldCBfcGFnZTtcblxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBsaW5rKGluUGFnZSkge1xuXG4gICAgX3BhZ2UgPSBpblBhZ2U7XG5cbiAgICB2YXIgcHJvdG8gPSBPYmplY3QuY3JlYXRlKEhUTUxBbmNob3JFbGVtZW50LnByb3RvdHlwZSk7XG5cbiAgICBwcm90by5jcmVhdGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgJCh0aGlzKS5wcm9wKCdvbmNsaWNrJywgKCkgPT57fSk7XG4gICAgICAgICQodGhpcykuY2xpY2soKGUpID0+IHtcbiAgICAgICAgICAgIGlmICghL2dvb2dsZWJvdC8udGVzdCgoZ2V0KHdpbmRvdywgJ25hdmlnYXRvci51c2VyQWdlbnQnKSB8fCAnJykudG9Mb3dlckNhc2UoKSkpIHtcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBwcm90by5hdHRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGF0dGFjaEFjdGlvbi5jYWxsKHRoaXMsIF9wYWdlLCB7XG4gICAgICAgICAgICBuYW1lOiAkKHRoaXMpLmF0dHIoJ2FjdGlvbicpLFxuICAgICAgICAgICAgdHJpZ2dlcjogJCh0aGlzKS5hdHRyKCd0cmlnZ2VyJyksXG4gICAgICAgICAgICB0YXJnZXQ6ICdzZWxmJyxcbiAgICAgICAgICAgIHBhcmFtczogKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJhbXMgPSB7fTtcbiAgICAgICAgICAgICAgICAkKCQodGhpcykuZ2V0KDApLmF0dHJpYnV0ZXMpLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICgvXnBhcmFtLS8udGVzdCh0aGlzLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZigvXnBhcmFtLS4qLWpzb24kLy50ZXN0KHRoaXMubmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXNbdGhpcy5uYW1lLnJlcGxhY2UoJ3BhcmFtLScsICcnKS5yZXBsYWNlKC8tanNvbiQvLCAnJyldID0gSlNPTi5wYXJzZSh0aGlzLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1zW3RoaXMubmFtZS5yZXBsYWNlKCdwYXJhbS0nLCAnJyldID0gdGhpcy52YWx1ZTsgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICAgICAgICB9KSgpXG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBwcm90by5kZXRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICB9O1xuXG4gICAgZG9jdW1lbnQucmVnaXN0ZXJFbGVtZW50KCdhZS1saW5rJywgeyBwcm90b3R5cGU6IHByb3RvLCBleHRlbmRzOiAnYScgfSk7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0ICQgPSByZXF1aXJlKCdqcXVlcnknKTtcblxuY29uc3QgY2FwaXRhbGl6ZSA9IHJlcXVpcmUoJ2xvZGFzaC5jYXBpdGFsaXplJyk7XG5jb25zdCBlYWNoID0gcmVxdWlyZSgnbG9kYXNoLmZvcmVhY2gnKTtcbmNvbnN0IGNvbmNhdCA9IHJlcXVpcmUoJ2xvZGFzaC5jb25jYXQnKTtcblxuY29uc3QgYXR0YWNoQWN0aW9uID0gcmVxdWlyZSgnLi4vZGVsZWdhdGUvYWN0aW9uLXRyaWdnZXItZGVsZWdhdGUnKTtcbi8vY29uc3QgQmluZGluZyA9IHJlcXVpcmUoJy4uL0JpbmRpbmcnKTtcbmNvbnN0IEVsZW1lbnRIVE1MV2lyaW5nID0gcmVxdWlyZSgnLi4vd2lyaW5nL0VsZW1lbnRIVE1MV2lyaW5nJyk7XG5jb25zdCBUZW1wbGF0ZVdpcmluZyA9IHJlcXVpcmUoJy4uL3dpcmluZy9UZW1wbGF0ZVdpcmluZycpO1xuY29uc3QgU2lnbmFsV2lyaW5nID0gcmVxdWlyZSgnLi4vd2lyaW5nL1NpZ25hbFdpcmluZycpO1xuY29uc3QgQXR0cmlidXRlV2lyaW5nID0gcmVxdWlyZSgnLi4vd2lyaW5nL0F0dHJpYnV0ZVdpcmluZycpO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhZUVsZW1lbnREZWZpbml0aW9uKGluQXBwLCBpbkVsZW1lbnROYW1lKSB7XG5cbiAgICBjb25zdCBfYXBwID0gaW5BcHA7XG5cblxuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoZG9jdW1lbnQuY3JlYXRlRWxlbWVudChpbkVsZW1lbnROYW1lKS5jb25zdHJ1Y3Rvci5wcm90b3R5cGUpO1xuXG4gICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGxldCB3aXJpbmdzID0gW107XG4gICAgICAgICQodGhpcykucHJvcCgnYWUnLCB7XG4gICAgICAgICAgICB3aXJpbmdzOiB3aXJpbmdzXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmICgkKHRoaXMpLmF0dHIoJ2Zyb20nKSkge1xuICAgICAgICAgICAgaWYgKCQodGhpcykuZmluZCgnPnRlbXBsYXRlJykpIHtcbiAgICAgICAgICAgICAgICB3aXJpbmdzLnB1c2god2lyaW5ncywgbmV3IFRlbXBsYXRlV2lyaW5nKHRoaXMpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgd2lyaW5ncy5wdXNoKHdpcmluZ3MsIG5ldyBFbGVtZW50SFRNTFdpcmluZyh0aGlzKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCQodGhpcykuYXR0cignc2lnbmFsJykpIHtcbiAgICAgICAgICAgIHdpcmluZ3MucHVzaChuZXcgU2lnbmFsV2lyaW5nKHRoaXMpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoJCh0aGlzKS5hdHRyKCdiaW5kLWh0bWwnKSkge1xuICAgICAgICAgICAgd2lyaW5ncy5wdXNoKG5ldyBFbGVtZW50SFRNTFdpcmluZyh0aGlzKSk7XG4gICAgICAgIH1cblxuICAgICAgICB3aXJpbmdzLnB1c2guYXBwbHkod2lyaW5ncywgQXR0cmlidXRlV2lyaW5nLndpcmUodGhpcywgWydjbGFzcycsICdpZCcsICduYW1lJywgJ3BhcmFtJywgJ2RhdGEnXSkpO1xuXG4gICAgfTtcblxuICAgIHByb3RvLmF0dGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc3QgYWUgPSAkKHRoaXMpLnByb3AoJ2FlJyk7XG4gICAgICAgIGVhY2goYWUud2lyaW5ncywgKHdpcmluZykgPT4ge1xuICAgICAgICAgICAgd2lyaW5nLmF0dGFjaChfYXBwKTtcbiAgICAgICAgfSk7XG5cbiAgICB9O1xuXG4gICAgcHJvdG8uZGV0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBjb25zdCBhZSA9ICQodGhpcykucHJvcCgnYWUnKTtcbiAgICAgICAgZWFjaChhZS53aXJpbmdzLCAod2lyaW5nKSA9PiB7XG4gICAgICAgICAgICB3aXJpbmcuZGV0YWNoKCk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cblxuICAgIGRvY3VtZW50LnJlZ2lzdGVyRWxlbWVudCgnYWUtJyArIGluRWxlbWVudE5hbWUsIHtcbiAgICAgICAgcHJvdG90eXBlOiBwcm90byxcbiAgICAgICAgZXh0ZW5kczogaW5FbGVtZW50TmFtZVxuICAgIH0pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcbmltcG9ydCBlYWNoIGZyb20gJ2xvZGFzaC5mb3JlYWNoJztcblxuJC5mbi5leHRlbmQoe1xuICAgIGdldFBhdGg6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHBhdGgsIG5vZGUgPSB0aGlzO1xuICAgICAgICB3aGlsZSAobm9kZS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciByZWFsTm9kZSA9IG5vZGVbMF0sIG5hbWUgPSByZWFsTm9kZS5sb2NhbE5hbWU7XG4gICAgICAgICAgICBpZiAoIW5hbWUpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5hbWUgPSBuYW1lLnRvTG93ZXJDYXNlKCk7XG5cbiAgICAgICAgICAgIHZhciBwYXJlbnQgPSBub2RlLnBhcmVudCgpO1xuXG4gICAgICAgICAgICB2YXIgc2FtZVRhZ1NpYmxpbmdzID0gcGFyZW50LmNoaWxkcmVuKG5hbWUpO1xuICAgICAgICAgICAgaWYgKHNhbWVUYWdTaWJsaW5ncy5sZW5ndGggPiAxKSB7IFxuICAgICAgICAgICAgICAgIGxldCBhbGxTaWJsaW5ncyA9IHBhcmVudC5jaGlsZHJlbigpO1xuICAgICAgICAgICAgICAgIGxldCBpbmRleCA9IGFsbFNpYmxpbmdzLmluZGV4KHJlYWxOb2RlKSArIDE7XG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ID4gMSkge1xuICAgICAgICAgICAgICAgICAgICBuYW1lICs9ICc6bnRoLWNoaWxkKCcgKyBpbmRleCArICcpJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHBhdGggPSBuYW1lICsgKHBhdGggPyAnPicgKyBwYXRoIDogJycpO1xuICAgICAgICAgICAgbm9kZSA9IHBhcmVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwYXRoO1xuICAgIH1cbn0pO1xuXG5pbXBvcnQgYWVNYW5hZ2VkIGZyb20gJy4vYWUtbWFuYWdlZCc7XG5pbXBvcnQgYWVSZW5kZXJlZCBmcm9tICcuL2FlLXJlbmRlcmVkJztcbmltcG9ydCBhZUJ1dHRvbiBmcm9tICcuL2FlLWJ1dHRvbic7XG5pbXBvcnQgYWVFYWNoIGZyb20gJy4vYWUtZWFjaCc7XG5pbXBvcnQgYWVTdGF0ZSBmcm9tICcuL2FlLXN0YXRlJztcbmltcG9ydCBhZUFjdGlvbiBmcm9tICcuL2FlLWFjdGlvbic7XG5pbXBvcnQgYWVCaW5kIGZyb20gJy4vYWUtYmluZCc7XG5pbXBvcnQgYWVSZW5kZXIgZnJvbSAnLi9hZS1yZW5kZXInO1xuaW1wb3J0IGFlU3dpdGNoIGZyb20gJy4vYWUtc3dpdGNoJztcbmltcG9ydCBhZVRleHRJbnB1dCBmcm9tICcuL2FlLWlucHV0JztcbmltcG9ydCBhZUlucHV0IGZyb20gJy4vYWUtaW5wdXQyJztcbmltcG9ydCBhZUxpbmsgZnJvbSAnLi9hZS1saW5rJztcbmltcG9ydCByZWdpc3RlckFlRWxlbWVudCBmcm9tICcuL2FlLWVsZW1lbnQnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihpblBhZ2UpIHtcbiAgICBcbiAgICBlYWNoKFsnZGl2JywgJ3VsJywgJ2xpJywgJ2EnLCAnbmF2JywgJ3NwYW4nLCAnbWFpbicsICdzZWN0aW9uJ10sIChpbkVsZW1lbnROYW1lKSA9PiB7XG4gICAgICAgIHJlZ2lzdGVyQWVFbGVtZW50KGluUGFnZSwgaW5FbGVtZW50TmFtZSk7XG4gICAgfSk7XG5cbiAgICBhZUJ1dHRvbihpblBhZ2UpO1xuICAgIGFlTWFuYWdlZChpblBhZ2UpO1xuICAgIGFlRWFjaChpblBhZ2UpO1xuICAgIGFlU3RhdGUoaW5QYWdlKTtcbiAgICBhZUFjdGlvbihpblBhZ2UpO1xuICAgIGFlQmluZChpblBhZ2UpO1xuICAgIGFlUmVuZGVyKGluUGFnZSk7XG4gICAgYWVSZW5kZXJlZChpblBhZ2UpO1xuICAgIGFlU3dpdGNoKGluUGFnZSk7XG4gICAgYWVUZXh0SW5wdXQoaW5QYWdlKTtcbiAgICBhZUlucHV0KGluUGFnZSk7XG4gICAgYWVMaW5rKGluUGFnZSk7XG59XG5cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IENvbXBvbmVudCBmcm9tICcuL2NvbXBvbmVudCc7XG5pbXBvcnQgZ2V0IGZyb20gJ2xvZGFzaC5nZXQnO1xuaW1wb3J0IGlzRnVuY3Rpb24gZnJvbSAnbG9kYXNoLmlzRnVuY3Rpb24nO1xuaW1wb3J0IGlzUGxhaW5PYmplY3QgZnJvbSAnbG9kYXNoLmlzUGxhaW5PYmplY3QnO1xuXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuXG5pbXBvcnQgbW9kZWxEYXRhU291cmNlIGZyb20gJy4vZGF0YXNvdXJjZS9tb2RlbC1kYXRhc291cmNlJztcbmNvbnN0IF9kYXRhU291cmNlcyA9IG5ldyBNYXAoKTtcbmltcG9ydCBsYW5nIGZyb20gJy4vbGFuZy9hZS1sYW5nJztcbmltcG9ydCBmYWN0b3J5IGZyb20gJy4vcGFnZS1mYWN0b3J5JztcbmltcG9ydCBDb21wb25lbnRMaWZlY3ljbGUgZnJvbSAnLi9Db21wb25lbnRMaWZlY3ljbGUnO1xuaW1wb3J0IHByaXZhdGVIYXNoIGZyb20gJy4vdXRpbC9wcml2YXRlJztcbmltcG9ydCBMaXRlVXJsIGZyb20gJ2xpdGUtdXJsJztcblxuY29uc3QgX3ByaXZhdGUgPSBwcml2YXRlSGFzaCgnY29tcG9uZW50Jyk7XG5cbmxldCBfcmVnaXN0cnkgPSBuZXcgV2Vha01hcCgpO1xubGV0IF90ZW1wbGF0aW5nRGVsZWdhdGU7XG5cbmNvbnN0IF9pbml0aWFsaXplcnMgPSBbXTtcbmNvbnN0IF9jb21wb25lbnRJbmplY3RvcnMgPSBbXTtcblxubGV0IF9jb25maWc7XG5cbmNvbnN0IHBhcnNlVXJsID0gZnVuY3Rpb24gcGFyc2VVcmwoKSB7XG4gICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXJ0dXBQYXJhbXMgPSBuZXcgTGl0ZVVybCh3aW5kb3cubG9jYXRpb24uaHJlZikucGFyYW1zO1xufTtcblxuY29uc3Qgc3RhcnRQYWdlID0gZnVuY3Rpb24gc3RhcnRQYWdlKCkge1xuICAgICQoKCkgPT4ge1xuICAgICAgICB0aGlzLm5vZGUgPSAkKHRoaXMubW91bnRQb2ludCk7XG4gICAgICAgICQodGhpcy5tb3VudFBvaW50KS5wcm9wKCdhZScsdGhpcyk7XG4gICAgICAgIGxhbmcodGhpcyk7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKVxuICAgICAgICAgICAgLmxpZmVjeWNsZVNpZ25hbC5kaXNwYXRjaCgnZWxlbWVudC1jcmVhdGVkJyk7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKVxuICAgICAgICAgICAgLmxpZmVjeWNsZVNpZ25hbC5kaXNwYXRjaCgnZWxlbWVudC1hdHRhY2hlZCcpO1xuICAgICAgICBpZiAodGhpcy5jb25maWcuYXV0b1JlbmRlciAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgIHRoaXMuaW52YWxpZGF0ZSgpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG5jb25zdCBjYWxsTmV4dEluaXRpYWxpemVyID0gZnVuY3Rpb24oKSB7XG4gICAgbGV0IGluaXRpYWxpemVyID0gX2luaXRpYWxpemVycy5zaGlmdCgpO1xuICAgIGlmICghaW5pdGlhbGl6ZXIpIHtcbiAgICAgICAgc3RhcnRQYWdlLmNhbGwodGhpcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbGV0IHJlc3VsdCA9IGluaXRpYWxpemVyLmNhbGwodGhpcyk7XG4gICAgbGV0IHJlc3VsdEhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICAgIGxldCBmbjtcbiAgICAgICAgd2hpbGUgKGZuID0gX2NvbmZpZy5jb21wb25lbnRzLnNoaWZ0KCkpIHsgLy9qc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgICAgICAgIGZuKHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChfaW5pdGlhbGl6ZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgY2FsbE5leHRJbml0aWFsaXplci5jYWxsKHRoaXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhcnRQYWdlLmNhbGwodGhpcyk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIGlmIChyZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgIHJlc3VsdC50aGVuKHJlc3VsdEhhbmRsZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdEhhbmRsZXIoKTtcbiAgICB9XG5cbn07XG5cbmNsYXNzIFBhZ2UgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIGNvbnN0cnVjdG9yKGluQ29uZmlnLCBpbk1vZGVsUHJvdG90eXBlLCBpbkNvbnN0cnVjdG9yKSB7XG4gICAgICAgIHN1cGVyKGluQ29uZmlnLCBpbk1vZGVsUHJvdG90eXBlKTtcbiAgICAgICAgdGhpcy5wYWdlID0gdGhpcztcbiAgICAgICAgX2NvbmZpZyA9IGluQ29uZmlnO1xuICAgICAgICBwYXJzZVVybC5jYWxsKHRoaXMpO1xuICAgICAgICB0aGlzLm1vdW50UG9pbnQgPSBpbkNvbmZpZy5tb3VudFBvaW50IHx8ICdib2R5JztcbiAgICAgICAgdGhpcy5hZGREYXRhU291cmNlKCdtb2RlbCcsIG1vZGVsRGF0YVNvdXJjZSh0aGlzKSk7XG4gICAgICAgIGluQ29uc3RydWN0b3IuYmluZCh0aGlzKShpbkNvbmZpZyk7XG5cbiAgICAgICAgY2FsbE5leHRJbml0aWFsaXplci5jYWxsKHRoaXMpO1xuICAgIH1cblxuXG4gICAgZ2V0IHN0YXJ0dXBQYXJhbXMoKSB7XG4gICAgICAgIHJldHVybiBfcHJpdmF0ZS5nZXQodGhpcykuc3RhcnR1cFBhcmFtcztcbiAgICB9XG5cbiAgICByZXNvbHZlTm9kZU1vZGVsKGluTm9kZSwgaW5QYXRoKSB7XG4gICAgICAgIGxldCBjb21wb25lbnQgPSB0aGlzLnJlc29sdmVOb2RlQ29tcG9uZW50KGluTm9kZSk7XG4gICAgICAgIGlmICghY29tcG9uZW50Lmhhc01vZGVsKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yZXNvbHZlTm9kZU1vZGVsKCQoY29tcG9uZW50Lm5vZGUpLnBhcmVudCgpLCBpblBhdGgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb21wb25lbnQubW9kZWw7XG4gICAgfVxuXG4gICAgcmVzb2x2ZU5vZGVDb21wb25lbnQoaW5Ob2RlKSB7XG4gICAgICAgIGxldCBub2RlID0gJChpbk5vZGUpLmdldCgwKTtcbiAgICAgICAgd2hpbGUgKCFfcmVnaXN0cnkuZ2V0KG5vZGUpKSB7XG4gICAgICAgICAgICBub2RlID0gJChub2RlKS5wYXJlbnQoKS5nZXQoMCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIV9yZWdpc3RyeS5nZXQobm9kZSkpIHtcbiAgICAgICAgICAgIGlmIChnZXQod2luZG93LCAnbG9nTGV2ZWwnKSA9PT0gJ2RlYnVnJykge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZGVidWcoJ0NvdWxkIG5vdCBmaW5kIGNvbXBvbmVudCBpbiBhbmNlc3RyeS4gRmFsbGluZyBiYWNrIHRvIHBhZ2UgY29tcG9uZW50Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gX3JlZ2lzdHJ5LmdldChub2RlKTtcblxuICAgIH1cblxuICAgIGdldFJlc29sdmVyKGluTmFtZSkge1xuICAgICAgICByZXR1cm4gZ2V0KF9jb25maWcsICdyZXNvbHZlcnMuJyArIGluTmFtZSk7XG4gICAgfVxuXG5cbiAgICBhZGREYXRhU291cmNlKGluTmFtZSwgaW5Jbml0RnVuY3Rpb24pIHtcbiAgICAgICAgX2RhdGFTb3VyY2VzLnNldChpbk5hbWUsIGluSW5pdEZ1bmN0aW9uKHRoaXMpKTtcbiAgICB9XG5cbiAgICBnZXREYXRhU291cmNlKGluTmFtZSkge1xuICAgICAgICBpbk5hbWUgPSBpbk5hbWUgfHwgJ21vZGVsJztcbiAgICAgICAgcmV0dXJuIF9kYXRhU291cmNlcy5nZXQoaW5OYW1lKTtcbiAgICB9XG5cbiAgICByZWdpc3RlckluaXRpYWxpemVyKGluRm4pIHtcbiAgICAgICAgX2luaXRpYWxpemVycy5wdXNoKGluRm4pO1xuICAgIH1cblxuICAgIHJlZ2lzdGVyQ29tcG9uZW50SW5qZWN0b3IoaW5JbmplY3RvckZuKSB7XG4gICAgICAgIF9jb21wb25lbnRJbmplY3RvcnMucHVzaChpbkluamVjdG9yRm4pO1xuICAgIH1cblxuICAgIHJlbmRlcihpbk1vZGVsKSB7XG4gICAgICAgIHN1cGVyLnJlbmRlcihpbk1vZGVsKTtcbiAgICAgICAgJCh0aGlzLm1vdW50UG9pbnQpLmNzcygnZGlzcGxheScsICcnKTtcbiAgICB9XG5cbiAgICByZWdpc3RlckNvbXBvbmVudCguLi5hcmdzKSB7XG5cbiAgICAgICAgY29uc3QgY29uc3RydWN0b3IgPSBhcmdzLnBvcCgpO1xuICAgICAgICBjb25zdCBjb25maWcgPSBhcmdzLnNoaWZ0KCk7XG4gICAgICAgIGNvbnN0IG1vZGVsID0gYXJncy5zaGlmdCgpO1xuICAgICAgICBpZiAoIWlzRnVuY3Rpb24oY29uc3RydWN0b3IpIHx8XG4gICAgICAgICAgICAhaXNQbGFpbk9iamVjdChjb25maWcpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1BhZ2UucmVnaXN0ZXJDb21wb25lbnQoKSB1c2FnZTogKGNvbmZpZyA6IE9iamVjdCwgW21vZGVsIDogT2JqZWN0fE9ic2VydmFibGVPYmplY3RdLCBjb25zdHJ1Y3RvciA6IEZ1bmN0aW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZWdpc3RlckNvbXBvbmVudEVsZW1lbnQoe1xuICAgICAgICAgICAgY29uZmlnOiBjb25maWcsXG4gICAgICAgICAgICBtb2RlbFByb3RvdHlwZTogbW9kZWwsXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcjogY29uc3RydWN0b3JcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgaW5pdFN0YXRlKCkge1xuICAgICAgICBsZXQgaGFzaCA9IHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gZGVjb2RlVVJJKHdpbmRvdy5sb2NhdGlvbi5oYXNoKTtcblxuICAgICAgICBpZiAoL14jPltcXHdcXC1dLy50ZXN0KGhhc2gpKSB7XG4gICAgICAgICAgICBoYXNoID0gaGFzaC5yZXBsYWNlKC9eIz4vLCAnJyk7XG4gICAgICAgICAgICBpZiAodGhpcy5zdGF0ZXMuZ2V0UGF0aChoYXNoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMudHJ5U3RhdGUoaGFzaCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAkKHdpbmRvdykub24oJ2hhc2hjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoL14jYWN0aW9uOi8udGVzdCh3aW5kb3cubG9jYXRpb24uaGFzaCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmYWtlVXJsID0gbmV3IExpdGVVcmwod2luZG93LmxvY2F0aW9uLmhhc2gucmVwbGFjZSgvXiNhY3Rpb246LywgJ2h0dHA6Ly9sb2NhbGhvc3QvJykpO1xuICAgICAgICAgICAgICAgIHRoaXMuYnVzLnRyaWdnZXJBY3Rpb24oZmFrZVVybC5wYXRobmFtZS5yZXBsYWNlKC9cXC8vZywgJycpLCBmYWtlVXJsLnNlYXJjaCk7XG4gICAgICAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLmhhc2ggPSAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkudHJpZ2dlcignaGFzaGNoYW5nZScpO1xuICAgIH1cblxuICAgIHJlZ2lzdGVyQ29tcG9uZW50RWxlbWVudChpbkRlZmluaXRpb24pIHtcbiAgICAgICAgdmFyIHByb3RvID0gT2JqZWN0LmNyZWF0ZShIVE1MRGl2RWxlbWVudC5wcm90b3R5cGUpO1xuICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgICAgIGxldCBjb21wb25lbnQ7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBpbkRlZmluaXRpb24uY29uZmlnLm5hbWU7XG4gICAgICAgIC8vICAgICAgICBjb25zb2xlLmluZm8oJ3JlZ2lzdGVyaW5nIGNvbXBvbmVudDogJyArIG5hbWUpO1xuICAgICAgICBkb2N1bWVudC5zdHlsZVNoZWV0c1swXS5pbnNlcnRSdWxlKG5hbWUgKyAneyBkaXNwbGF5OiBibG9jazt9JywgMSk7XG5cbiAgICAgICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjb21wb25lbnQgPSBuZXcgQ29tcG9uZW50KFxuICAgICAgICAgICAgICAgIGluRGVmaW5pdGlvbi5jb25maWcsXG4gICAgICAgICAgICAgICAgaW5EZWZpbml0aW9uLm1vZGVsUHJvdG90eXBlLFxuICAgICAgICAgICAgICAgIGluRGVmaW5pdGlvbi5jb25zdHJ1Y3RvcixcbiAgICAgICAgICAgICAgICB0aGF0KTtcbiAgICAgICAgICAgIF9yZWdpc3RyeS5zZXQodGhpcywgY29tcG9uZW50KTtcbiAgICAgICAgICAgIGNvbXBvbmVudC5ub2RlID0gdGhpcztcbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnYWUnLCB7XG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGNvbXBvbmVudFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBmb3IgKGxldCBpbmplY3RvciBvZiBfY29tcG9uZW50SW5qZWN0b3JzKSB7XG4gICAgICAgICAgICAgICAgaW5qZWN0b3IuY2FsbCh0aGF0LCBjb21wb25lbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KGNvbXBvbmVudClcbiAgICAgICAgICAgICAgICAubGlmZWN5Y2xlU2lnbmFsLmRpc3BhdGNoKCdlbGVtZW50LWNyZWF0ZWQnKTtcbiAgICAgICAgfTtcblxuICAgICAgICBwcm90by5hdHRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBfcmVnaXN0cnkuZ2V0KHRoaXMpO1xuICAgICAgICAgICAgaWYgKCQodGhpcykuYXR0cignZnJvbScpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZnJvbSA9ICQodGhpcykuYXR0cignZnJvbScpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1vZGVsID0gdGhhdC5yZXNvbHZlTm9kZU1vZGVsKCQodGhpcykucGFyZW50KCkpO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5tb2RlbC5wcm9wKCdkYXRhJywgbW9kZWwucHJvcCgnZGF0YScgKyAoIGZyb20gPT09ICcuJyA/ICcnIDogJy4nICsgZnJvbSkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF9wcml2YXRlLmdldChjb21wb25lbnQpXG4gICAgICAgICAgICAgICAgLmxpZmVjeWNsZVNpZ25hbC5kaXNwYXRjaCgnZWxlbWVudC1hdHRhY2hlZCcpO1xuICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5jb25maWcuYXV0b1JlbmRlciAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQucmVuZGVyLmNhbGwoY29tcG9uZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBwcm90by5kZXRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBfcHJpdmF0ZS5nZXQoY29tcG9uZW50KVxuICAgICAgICAgICAgICAgIC5saWZlY3ljbGVTaWduYWwuZGlzcGF0Y2goJ2VsZW1lbnQtZGV0YWNoZWQnKTtcbiAgICAgICAgICAgIC8vX3ByaXZhdGUuZGVsZXRlKGNvbXBvbmVudCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgZG9jdW1lbnQucmVnaXN0ZXJFbGVtZW50KGluRGVmaW5pdGlvbi5jb25maWcubmFtZSwge1xuICAgICAgICAgICAgcHJvdG90eXBlOiBwcm90b1xuICAgICAgICB9KTtcblxuICAgIH1cblxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IFBhZ2U7XG4iLCIndXNlIHN0cmljdCc7XG5cbmNsYXNzIFRlbXBsYXRpbmdEZWxlZ2F0ZSB7XG5cdHJlZ2lzdGVyVGVtcGxhdGUoaW5Tb3VyY2UsIGluTmFtZSkge1xuXHRcdC8vaWYoIWluTmFtZSkgZ2VuZXJhdGUgbmFtZSBhbmQgcmV0dXJuIGl0XG5cdH1cblxuXHRyZW5kZXIoaW5UZW1wbGF0ZU5hbWUsIGluTW9kZWwpIHtcblx0XHQvL3JldHVybiBwcm9taXNlXG5cdH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVGVtcGxhdGluZ0RlbGVnYXRlO1xuIiwiLyohIGR1c3Rqcy1oZWxwZXJzIC0gdjEuNy4zXG4gKiBodHRwOi8vZHVzdGpzLmNvbS9cbiAqIENvcHlyaWdodCAoYykgMjAxNSBBbGVrc2FuZGVyIFdpbGxpYW1zOyBSZWxlYXNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UgKi9cbmltcG9ydCBPYnNlcnZhYmxlT2JqZWN0IGZyb20gJy4uL09ic2VydmFibGVPYmplY3QnO1xuaW1wb3J0IGlzU3RyaW5nIGZyb20gJ2xvZGFzaC5pc1N0cmluZyc7XG5pbXBvcnQga2V5cyBmcm9tICdsb2Rhc2gua2V5cyc7XG5pbXBvcnQgZ2V0IGZyb20gJ2xvZGFzaC5nZXQnO1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24oZHVzdCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuXG4gICAgZHVzdC5oZWxwZXJzLnJlID0gZnVuY3Rpb24oY2h1bmssIGNvbnRleHQsIGJvZGllcywgcGFyYW1zKSB7XG4gICAgICAgIGNvbnNvbGUud2FybigncGFyYW1zOicpO1xuICAgICAgICBjb25zb2xlLndhcm4ocGFyYW1zKTtcbiAgICAgICAgaWYgKCFwYXJhbXMua2V5IHx8ICFwYXJhbXMubWF0Y2gpIHtcbiAgICAgICAgICAgIGNodW5rLndyaXRlKCcnKTtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybignd3JpdGluZyBlbXB0eSBzdHJpbmcnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybignd3JpdGluZyBib2RpZXMnKTtcbiAgICAgICAgICAgIHZhciByZSA9IG5ldyBSZWdFeHAocGFyYW1zLm1hdGNoKTtcbiAgICAgICAgICAgIGlmIChyZS50ZXN0KHBhcmFtcy5rZXkpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJvZGllcykge1xuICAgICAgICAgICAgICAgICAgICBjaHVuayA9IGNodW5rLnJlbmRlcihib2RpZXMsIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjaHVuaztcbiAgICB9O1xuXG5cblxuICAgIGR1c3QuZmlsdGVycy5odHRwcyA9IGZ1bmN0aW9uKGluVXJsKSB7XG4gICAgICAgIGlmICghaW5VcmwpIHtcbiAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW5VcmwudG9TdHJpbmcoKS5yZXBsYWNlKC9eKGh0dHAoPzpzKT8pOi8sICdodHRwczonKTtcbiAgICB9O1xuXG5cbiAgICBkdXN0LmZpbHRlcnMub2JzY3VyZWRjcmVkaXRjYXJkbnVtYmVyID0gZnVuY3Rpb24oaW5WYWx1ZSkge1xuICAgICAgICBpZiAoIWlzU3RyaW5nKGluVmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHNwbGl0ID0gaW5WYWx1ZS5zcGxpdCgnJykucmV2ZXJzZSgpO1xuICAgICAgICB2YXIgdGFpbCA9IHNwbGl0LnNwbGljZSgwLCA0KTtcbiAgICAgICAgdGFpbC51bnNoaWZ0KCctJyk7XG5cbiAgICAgICAgd2hpbGUgKHNwbGl0Lmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCAlIDQgPT09IDApIHtcbiAgICAgICAgICAgICAgICB0YWlsLnVuc2hpZnQoJy0nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRhaWwudW5zaGlmdCgnKicpO1xuICAgICAgICAgICAgc3BsaXQucG9wKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRhaWwuam9pbignJykucmVwbGFjZSgvLS0vLCAnLScpO1xuICAgIH07XG5cbiAgICBkdXN0LmZpbHRlcnMudG9sb3dlciA9IGZ1bmN0aW9uKGluVmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGlzU3RyaW5nKGluVmFsdWUpID8gaW5WYWx1ZS50b0xvd2VyQ2FzZSgpIDogaW5WYWx1ZTtcbiAgICB9O1xuXG4gICAgZHVzdC5maWx0ZXJzLnRvdXBwZXIgPSBmdW5jdGlvbihpblZhbHVlKSB7XG4gICAgICAgIHJldHVybiBpc1N0cmluZyhpblZhbHVlKSA/IGluVmFsdWUudG9VcHBlckNhc2UoKSA6IGluVmFsdWU7XG4gICAgfTtcbiAgICBkdXN0LmhlbHBlcnMuc29ydCA9IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykge1xuICAgICAgICB2YXIgc29ydCA9IEpTT04ucGFyc2UocGFyYW1zLnNvcnQpO1xuICAgICAgICB2YXIgYm9keSA9IGJvZGllcy5ibG9jaztcbiAgICAgICAgdmFyIHNvcnRrZXk7XG5cbiAgICAgICAgZnVuY3Rpb24gaXNFbXB0eShvKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIG8pIHtcbiAgICAgICAgICAgICAgICBpZiAoby5oYXNPd25Qcm9wZXJ0eShwKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc29ydCkge1xuICAgICAgICAgICAgZGVsZXRlIHBhcmFtcy5zb3J0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICB2YXIgY21wID0gZnVuY3Rpb24gY21wKGEsIGIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gKGFbc29ydGtleV0gPCBiW3NvcnRrZXldKSA/IC0xIDogKChhW3NvcnRrZXldID4gYltzb3J0a2V5XSkgPyAxIDogMCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB3aGlsZSAoc29ydC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzb3J0a2V5ID0gc29ydC5wb3AoKS5rZXk7XG4gICAgICAgICAgICAgICAgY29udGV4dC5zdGFjay5oZWFkLnNvcnQoY21wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjaHVuay5zZWN0aW9uKGNvbnRleHQuZ2V0UGF0aCh0cnVlLCBbXSksIGNvbnRleHQsIGJvZGllcywgaXNFbXB0eShwYXJhbXMpID8gbnVsbCA6IHBhcmFtcyk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZHVzdC5maWx0ZXJzLm1vbmV5ID0gZnVuY3Rpb24oaW5WYWx1ZSkge1xuICAgICAgICB2YXIgc1ZhbHVlID0gTnVtYmVyKGluVmFsdWUpLnRvRml4ZWQoMikucmVwbGFjZSgnLicsICcsJyk7XG5cbiAgICAgICAgdmFyIHNSZWdFeHAgPSBuZXcgUmVnRXhwKCcoLT9bMC05XSspKFswLTldezN9KScpO1xuICAgICAgICB3aGlsZSAoc1JlZ0V4cC50ZXN0KHNWYWx1ZSkpIHtcbiAgICAgICAgICAgIHNWYWx1ZSA9IHNWYWx1ZS5yZXBsYWNlKHNSZWdFeHAsICckMScgKyAnLicgKyAnJDInKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc1ZhbHVlO1xuICAgIH07XG5cbiAgICBkdXN0LmhlbHBlcnMuaXRlcmF0ZSA9IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykge1xuICAgICAgICB2YXIgYm9keSA9IGJvZGllcy5ibG9jayxcbiAgICAgICAgICAgIHNvcnQsXG4gICAgICAgICAgICBhcnIsXG4gICAgICAgICAgICBpLFxuICAgICAgICAgICAgayxcbiAgICAgICAgICAgIG9iaixcbiAgICAgICAgICAgIGNvbXBhcmVGbjtcblxuICAgICAgICBwYXJhbXMgPSBwYXJhbXMgfHwge307XG4gICAgICAgIGlmKHBhcmFtcy5zb3J0S2V5KSB7XG4gICAgICAgICAgICBwYXJhbXMuc29ydCA9IHBhcmFtcy5zb3J0IHx8ICdhc2MnO1xuICAgICAgICB9XG4gICAgICAgIGZ1bmN0aW9uIGRlc2MoYSwgYikge1xuICAgICAgICAgICAgaWYocGFyYW1zLnNvcnRLZXkpIHtcbiAgICAgICAgICAgICAgICBhID0gZ2V0KG9iaiwgYSArICcuJyArIHBhcmFtcy5zb3J0S2V5KTtcbiAgICAgICAgICAgICAgICBiID0gZ2V0KG9iaiwgYiArICcuJyArIHBhcmFtcy5zb3J0S2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhIDwgYikge1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhID4gYikge1xuICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gYXNjKGEsIGIpIHtcblxuICAgICAgICAgICAgaWYocGFyYW1zLnNvcnRLZXkpIHtcbiAgICAgICAgICAgICAgICBhID0gZ2V0KG9iaiwgYSArICcuJyArIHBhcmFtcy5zb3J0S2V5KTtcbiAgICAgICAgICAgICAgICBiID0gZ2V0KG9iaiwgYiArICcuJyArIHBhcmFtcy5zb3J0S2V5KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGEgPiBiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGEgPCBiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBwcm9jZXNzQm9keShrZXksIHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gYm9keShjaHVuaywgY29udGV4dC5wdXNoKHtcbiAgICAgICAgICAgICAgICAka2V5OiBrZXksXG4gICAgICAgICAgICAgICAgJHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgICAgICAkdHlwZTogdHlwZW9mIHZhbHVlXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocGFyYW1zLmtleSkge1xuICAgICAgICAgICAgb2JqID0gY29udGV4dC5yZXNvbHZlKHBhcmFtcy5rZXkpO1xuICAgICAgICAgICAgaWYgKG9iaiBpbnN0YW5jZW9mIE9ic2VydmFibGVPYmplY3QpIHtcbiAgICAgICAgICAgICAgICBvYmogPSBvYmoudG9OYXRpdmUodHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZihwYXJhbXMuc3BsaXQgJiYgaXNTdHJpbmcob2JqKSkge1xuICAgICAgICAgICAgICAgIG9iaiA9IG9iai5zcGxpdChuZXcgUmVnRXhwKHBhcmFtcy5zcGxpdCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgICAgICBpZiAoISFwYXJhbXMuc29ydCkge1xuICAgICAgICAgICAgICAgICAgICBzb3J0ID0gZHVzdC5oZWxwZXJzLnRhcChwYXJhbXMuc29ydCwgY2h1bmssIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgICAgICBhcnIgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChrIGluIG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFyci5wdXNoKGspO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbXBhcmVGbiA9IGNvbnRleHQuZ2xvYmFsW3NvcnRdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbXBhcmVGbiAmJiBzb3J0ID09PSAnZGVzYycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBhcmVGbiA9IGRlc2M7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbXBhcmVGbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJyLnNvcnQoY29tcGFyZUZuKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyci5zb3J0KGFzYyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2h1bmsgPSBwcm9jZXNzQm9keShhcnJbaV0sIG9ialthcnJbaV1dKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoayBpbiBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoaykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaHVuayA9IHByb2Nlc3NCb2R5KGssIG9ialtrXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdNaXNzaW5nIGJvZHkgYmxvY2sgaW4gdGhlIGl0ZXIgaGVscGVyLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ01pc3NpbmcgcGFyYW1ldGVyIFxcJ2tleVxcJyBpbiB0aGUgaXRlciBoZWxwZXIuJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNodW5rO1xuXG4gICAgfTtcblxuXG5cbiAgICBkdXN0LmhlbHBlcnMubGVuZ3RoID0gZnVuY3Rpb24oY2h1bmssIGNvbnRleHQsIGJvZGllcywgcGFyYW1zKSB7XG4gICAgICAgIGlmICghcGFyYW1zLmtleSkge1xuICAgICAgICAgICAgY2h1bmsud3JpdGUoMCk7XG4gICAgICAgIH0gZWxzZSBpZiAocGFyYW1zLmtleS5jb25zdHJ1Y3RvciA9PT0gU3RyaW5nIHx8IHBhcmFtcy5rZXkuY29uc3RydWN0b3IgPT09IEFycmF5KSB7XG4gICAgICAgICAgICBjaHVuay53cml0ZShwYXJhbXMua2V5Lmxlbmd0aCk7XG4gICAgICAgIH0gZWxzZSBpZiAocGFyYW1zLmtleS5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0KSB7XG4gICAgICAgICAgICBjaHVuay53cml0ZShrZXlzKHBhcmFtcy5rZXkuY29uc3RydWN0b3IpLmxlbmd0aCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNodW5rO1xuICAgIH07XG5cbiAgICBkdXN0LmhlbHBlcnMuY2FsYyA9IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykge1xuICAgICAgICB2YXIgcmVzdWx0O1xuICAgICAgICBpZiAoZ2V0KHdpbmRvdywgJ21hdGguZXZhbCcpKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBnZXQod2luZG93LCAnbWF0aCcpLmV2YWwoY29udGV4dC5yZXNvbHZlKGJvZGllcy5ibG9jaykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0ID0gY29udGV4dC5yZXNvbHZlKGJvZGllcy5ibG9jayk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhcmFtcy5mb3JtYXQpIHtcbiAgICAgICAgICAgIHN3aXRjaCAocGFyYW1zLmZvcm1hdCkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ21vbmV5JzpcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LnRvRml4ZWQoMikucmVwbGFjZSgnLicsICcsJyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2ludGVnZXInOlxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBNYXRoLnJvdW5kKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChwYXJhbXMudmFyICYmIHBhcmFtcy52YXIubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb250ZXh0Lmdsb2JhbFtwYXJhbXMudmFyXSA9IHJlc3VsdDtcbiAgICAgICAgICAgIGNodW5rLndyaXRlKCcnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNodW5rLndyaXRlKHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNodW5rO1xuICAgIH07XG5cblxuICAgIGR1c3QuaGVscGVycy5nbG9iID0gZnVuY3Rpb24oY2h1bmssIGNvbnRleHQsIGJvZGllcywgcGFyYW1zKSB7XG4gICAgICAgIHZhciByZXN1bHQ7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gcGFyYW1zLnZhbHVlO1xuICAgICAgICBpZiAoZ2V0KHdpbmRvdywgJ21hdGguZXZhbCcpKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBnZXQod2luZG93LCAnbWF0aCcpLmV2YWwodmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhcmFtcy5mb3JtYXQpIHtcbiAgICAgICAgICAgIHN3aXRjaCAocGFyYW1zLmZvcm1hdCkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ21vbmV5JzpcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LnRvRml4ZWQoMikucmVwbGFjZSgnLicsICcsJyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2ludGVnZXInOlxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBNYXRoLnJvdW5kKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnRleHQuZ2xvYmFsW3BhcmFtcy5uYW1lXSA9IHJlc3VsdDtcbiAgICAgICAgY2h1bmsud3JpdGUoJycpO1xuICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgfTtcblxuXG5cblxuXG5cbiAgICBmdW5jdGlvbiBsb2coaGVscGVyLCBtc2csIGxldmVsKSB7XG4gICAgICAgIGxldmVsID0gbGV2ZWwgfHwgJ0lORk8nO1xuICAgICAgICBoZWxwZXIgPSBoZWxwZXIgPyAne0AnICsgaGVscGVyICsgJ306ICcgOiAnJztcbiAgICAgICAgZHVzdC5sb2coaGVscGVyICsgbXNnLCBsZXZlbCk7XG4gICAgfVxuXG4gICAgdmFyIF9kZXByZWNhdGVkQ2FjaGUgPSB7fTtcblxuICAgIGZ1bmN0aW9uIF9kZXByZWNhdGVkKHRhcmdldCkge1xuICAgICAgICBpZiAoX2RlcHJlY2F0ZWRDYWNoZVt0YXJnZXRdKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgbG9nKHRhcmdldCwgJ0RlcHJlY2F0aW9uIHdhcm5pbmc6ICcgKyB0YXJnZXQgKyAnIGlzIGRlcHJlY2F0ZWQgYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSB2ZXJzaW9uIG9mIGR1c3Rqcy1oZWxwZXJzJywgJ1dBUk4nKTtcbiAgICAgICAgbG9nKG51bGwsICdGb3IgaGVscCBhbmQgYSBkZXByZWNhdGlvbiB0aW1lbGluZSwgc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9saW5rZWRpbi9kdXN0anMtaGVscGVycy93aWtpL0RlcHJlY2F0ZWQtRmVhdHVyZXMjJyArIHRhcmdldC5yZXBsYWNlKC9cXFcrL2csICcnKSwgJ1dBUk4nKTtcbiAgICAgICAgX2RlcHJlY2F0ZWRDYWNoZVt0YXJnZXRdID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc1NlbGVjdChjb250ZXh0KSB7XG4gICAgICAgIHJldHVybiBjb250ZXh0LnN0YWNrICYmIGNvbnRleHQuc3RhY2sudGFpbCAmJlxuICAgICAgICAgICAgY29udGV4dC5zdGFjay50YWlsLmhlYWQgJiZcbiAgICAgICAgICAgIHR5cGVvZiBjb250ZXh0LnN0YWNrLnRhaWwuaGVhZC5fX3NlbGVjdF9fICE9PSAndW5kZWZpbmVkJztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRTZWxlY3RTdGF0ZShjb250ZXh0KSB7XG4gICAgICAgIHJldHVybiBpc1NlbGVjdChjb250ZXh0KSAmJiBjb250ZXh0LmdldCgnX19zZWxlY3RfXycpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBzcGVjaWFsIF9fc2VsZWN0X18ga2V5IGJlaGluZCB0aGUgaGVhZCBvZiB0aGUgY29udGV4dCBzdGFjay4gVXNlZCB0byBtYWludGFpbiB0aGUgc3RhdGVcbiAgICAgKiBvZiB7QHNlbGVjdH0gYmxvY2tzXG4gICAgICogQHBhcmFtIGNvbnRleHQge0NvbnRleHR9IGFkZCBzdGF0ZSB0byB0aGlzIENvbnRleHRcbiAgICAgKiBAcGFyYW0gb3B0cyB7T2JqZWN0fSBhZGQgdGhlc2UgcHJvcGVydGllcyB0byB0aGUgc3RhdGUgKGBrZXlgIGFuZCBgdHlwZWApXG4gICAgICovXG4gICAgZnVuY3Rpb24gYWRkU2VsZWN0U3RhdGUoY29udGV4dCwgb3B0cykge1xuICAgICAgICB2YXIgaGVhZCA9IGNvbnRleHQuc3RhY2suaGVhZCxcbiAgICAgICAgICAgIG5ld0NvbnRleHQgPSBjb250ZXh0LnJlYmFzZSgpLFxuICAgICAgICAgICAga2V5O1xuXG4gICAgICAgIGlmIChjb250ZXh0LnN0YWNrICYmIGNvbnRleHQuc3RhY2sudGFpbCkge1xuICAgICAgICAgICAgbmV3Q29udGV4dC5zdGFjayA9IGNvbnRleHQuc3RhY2sudGFpbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzdGF0ZSA9IHtcbiAgICAgICAgICAgIGlzUGVuZGluZzogZmFsc2UsXG4gICAgICAgICAgICBpc1Jlc29sdmVkOiBmYWxzZSxcbiAgICAgICAgICAgIGlzRGVmZXJyZWRDb21wbGV0ZTogZmFsc2UsXG4gICAgICAgICAgICBkZWZlcnJlZHM6IFtdXG4gICAgICAgIH07XG5cbiAgICAgICAgZm9yIChrZXkgaW4gb3B0cykge1xuICAgICAgICAgICAgc3RhdGVba2V5XSA9IG9wdHNba2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXdDb250ZXh0XG4gICAgICAgICAgICAucHVzaCh7XG4gICAgICAgICAgICAgICAgJ19fc2VsZWN0X18nOiBzdGF0ZVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5wdXNoKGhlYWQsIGNvbnRleHQuc3RhY2suaW5kZXgsIGNvbnRleHQuc3RhY2sub2YpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFmdGVyIGEge0BzZWxlY3R9IG9yIHtAbWF0aH0gYmxvY2sgaXMgY29tcGxldGUsIHRoZXkgaW52b2tlIHRoaXMgZnVuY3Rpb25cbiAgICAgKi9cbiAgICBmdW5jdGlvbiByZXNvbHZlU2VsZWN0RGVmZXJyZWRzKHN0YXRlKSB7XG4gICAgICAgIHZhciB4LCBsZW47XG4gICAgICAgIHN0YXRlLmlzRGVmZXJyZWRQZW5kaW5nID0gdHJ1ZTtcbiAgICAgICAgaWYgKHN0YXRlLmRlZmVycmVkcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHN0YXRlLmlzRGVmZXJyZWRDb21wbGV0ZSA9IHRydWU7XG4gICAgICAgICAgICBmb3IgKHggPSAwLCBsZW4gPSBzdGF0ZS5kZWZlcnJlZHMubGVuZ3RoOyB4IDwgbGVuOyB4KyspIHtcbiAgICAgICAgICAgICAgICBzdGF0ZS5kZWZlcnJlZHNbeF0oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5pc0RlZmVycmVkUGVuZGluZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVzZWQgYnkge0Bjb250ZXh0RHVtcH1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBqc29uRmlsdGVyKGtleSwgdmFsdWUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlLnRvU3RyaW5nKClcbiAgICAgICAgICAgICAgICAucmVwbGFjZSgvKF5cXHMrfFxccyskKS9tZywgJycpXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcbi9tZywgJycpXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoLyxcXHMqL21nLCAnLCAnKVxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXClcXHsvbWcsICcpIHsnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGUgYSB0cnV0aCB0ZXN0IGhlbHBlclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHRydXRoVGVzdChuYW1lLCB0ZXN0KSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihjaHVuaywgY29udGV4dCwgYm9kaWVzLCBwYXJhbXMpIHtcbiAgICAgICAgICAgIHJldHVybiBmaWx0ZXIoY2h1bmssIGNvbnRleHQsIGJvZGllcywgcGFyYW1zLCBuYW1lLCB0ZXN0KTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGlzIGZ1bmN0aW9uIGlzIGludm9rZWQgYnkgdHJ1dGggdGVzdCBoZWxwZXJzXG4gICAgICovXG4gICAgZnVuY3Rpb24gZmlsdGVyKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcywgaGVscGVyTmFtZSwgdGVzdCkgeyAvL2pzaGludCBpZ25vcmU6bGluZVxuICAgICAgICB2YXIgYm9keSA9IGJvZGllcy5ibG9jayxcbiAgICAgICAgICAgIHNraXAgPSBib2RpZXNbJ2Vsc2UnXSxcbiAgICAgICAgICAgIHNlbGVjdFN0YXRlID0gZ2V0U2VsZWN0U3RhdGUoY29udGV4dCkgfHwge30sXG4gICAgICAgICAgICB3aWxsUmVzb2x2ZSwga2V5LCB2YWx1ZSwgdHlwZTtcblxuICAgICAgICAvLyBPbmNlIG9uZSB0cnV0aCB0ZXN0IGluIGEgc2VsZWN0IHBhc3Nlcywgc2hvcnQtY2lyY3VpdCB0aGUgcmVzdCBvZiB0aGUgdGVzdHNcbiAgICAgICAgaWYgKHNlbGVjdFN0YXRlLmlzUmVzb2x2ZWQgJiYgIXNlbGVjdFN0YXRlLmlzRGVmZXJyZWRQZW5kaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaXJzdCBjaGVjayBmb3IgYSBrZXkgb24gdGhlIGhlbHBlciBpdHNlbGYsIHRoZW4gbG9vayBmb3IgYSBrZXkgb24gdGhlIHtAc2VsZWN0fVxuICAgICAgICBpZiAocGFyYW1zLmhhc093blByb3BlcnR5KCdrZXknKSkge1xuICAgICAgICAgICAga2V5ID0gcGFyYW1zLmtleTtcbiAgICAgICAgfSBlbHNlIGlmIChzZWxlY3RTdGF0ZS5oYXNPd25Qcm9wZXJ0eSgna2V5JykpIHtcbiAgICAgICAgICAgIGtleSA9IHNlbGVjdFN0YXRlLmtleTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZyhoZWxwZXJOYW1lLCAnTm8ga2V5IHNwZWNpZmllZCcsICdXQVJOJyk7XG4gICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgIH1cblxuICAgICAgICB0eXBlID0gcGFyYW1zLnR5cGUgfHwgc2VsZWN0U3RhdGUudHlwZTtcblxuICAgICAgICBrZXkgPSBjb2VyY2UoY29udGV4dC5yZXNvbHZlKGtleSksIHR5cGUpO1xuICAgICAgICB2YWx1ZSA9IGNvZXJjZShjb250ZXh0LnJlc29sdmUocGFyYW1zLnZhbHVlKSwgdHlwZSk7XG5cbiAgICAgICAgaWYgKHRlc3Qoa2V5LCB2YWx1ZSkpIHtcbiAgICAgICAgICAgIC8vIE9uY2UgYSB0cnV0aCB0ZXN0IHBhc3NlcywgcHV0IHRoZSBzZWxlY3QgaW50byAncGVuZGluZycgc3RhdGUuIE5vdyB3ZSBjYW4gcmVuZGVyIHRoZSBib2R5IG9mXG4gICAgICAgICAgICAvLyB0aGUgdHJ1dGggdGVzdCAod2hpY2ggbWF5IGNvbnRhaW4gdHJ1dGggdGVzdHMpIHdpdGhvdXQgYWx0ZXJpbmcgdGhlIHN0YXRlIG9mIHRoZSBzZWxlY3QuXG4gICAgICAgICAgICBpZiAoIXNlbGVjdFN0YXRlLmlzUGVuZGluZykge1xuICAgICAgICAgICAgICAgIHdpbGxSZXNvbHZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBzZWxlY3RTdGF0ZS5pc1BlbmRpbmcgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgICAgICBjaHVuayA9IGNodW5rLnJlbmRlcihib2R5LCBjb250ZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh3aWxsUmVzb2x2ZSkge1xuICAgICAgICAgICAgICAgIHNlbGVjdFN0YXRlLmlzUmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHNraXApIHtcbiAgICAgICAgICAgIGNodW5rID0gY2h1bmsucmVuZGVyKHNraXAsIGNvbnRleHQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjaHVuaztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjb2VyY2UodmFsdWUsIHR5cGUpIHtcbiAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgIHR5cGUgPSB0eXBlLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgICAgICAgIHJldHVybiArdmFsdWU7XG4gICAgICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcodmFsdWUpO1xuICAgICAgICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgICAgICAgICAgdmFsdWUgPSAodmFsdWUgPT09ICdmYWxzZScgPyBmYWxzZSA6IHZhbHVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gQm9vbGVhbih2YWx1ZSk7XG4gICAgICAgICAgICBjYXNlICdkYXRlJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IERhdGUodmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIHZhciBoZWxwZXJzID0ge1xuXG4gICAgICAgIC8vIFV0aWxpdHkgaGVscGluZyB0byByZXNvbHZlIGR1c3QgcmVmZXJlbmNlcyBpbiB0aGUgZ2l2ZW4gY2h1bmtcbiAgICAgICAgLy8gdXNlcyBuYXRpdmUgRHVzdCBDb250ZXh0I3Jlc29sdmUgKGF2YWlsYWJsZSBzaW5jZSBEdXN0IDIuNi4yKVxuICAgICAgICAndGFwJzogZnVuY3Rpb24oaW5wdXQsIGNodW5rLCBjb250ZXh0KSB7XG4gICAgICAgICAgICAvLyBkZXByZWNhdGVkIGZvciByZW1vdmFsIGluIDEuOFxuICAgICAgICAgICAgX2RlcHJlY2F0ZWQoJ3RhcCcpO1xuICAgICAgICAgICAgcmV0dXJuIGNvbnRleHQucmVzb2x2ZShpbnB1dCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgJ3NlcCc6IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMpIHtcbiAgICAgICAgICAgIHZhciBib2R5ID0gYm9kaWVzLmJsb2NrO1xuICAgICAgICAgICAgaWYgKGNvbnRleHQuc3RhY2suaW5kZXggPT09IGNvbnRleHQuc3RhY2sub2YgLSAxKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNodW5rO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYm9keShjaHVuaywgY29udGV4dCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBjaHVuaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICAnZmlyc3QnOiBmdW5jdGlvbihjaHVuaywgY29udGV4dCwgYm9kaWVzKSB7XG4gICAgICAgICAgICBpZiAoY29udGV4dC5zdGFjay5pbmRleCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBib2RpZXMuYmxvY2soY2h1bmssIGNvbnRleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNodW5rO1xuICAgICAgICB9LFxuXG4gICAgICAgICdsYXN0JzogZnVuY3Rpb24oY2h1bmssIGNvbnRleHQsIGJvZGllcykge1xuICAgICAgICAgICAgaWYgKGNvbnRleHQuc3RhY2suaW5kZXggPT09IGNvbnRleHQuc3RhY2sub2YgLSAxKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJvZGllcy5ibG9jayhjaHVuaywgY29udGV4dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHtAY29udGV4dER1bXB9XG4gICAgICAgICAqIEBwYXJhbSBrZXkge1N0cmluZ30gc2V0IHRvICdmdWxsJyB0byB0aGUgZnVsbCBjb250ZXh0IHN0YWNrLCBvdGhlcndpc2UgdGhlIGN1cnJlbnQgY29udGV4dCBpcyBkdW1wZWRcbiAgICAgICAgICogQHBhcmFtIHRvIHtTdHJpbmd9IHNldCB0byAnY29uc29sZScgdG8gbG9nIHRvIGNvbnNvbGUsIG90aGVyd2lzZSBvdXRwdXRzIHRvIHRoZSBjaHVua1xuICAgICAgICAgKi9cbiAgICAgICAgJ2NvbnRleHREdW1wJzogZnVuY3Rpb24oY2h1bmssIGNvbnRleHQsIGJvZGllcywgcGFyYW1zKSB7XG4gICAgICAgICAgICB2YXIgdG8gPSBjb250ZXh0LnJlc29sdmUocGFyYW1zLnRvKSxcbiAgICAgICAgICAgICAgICBrZXkgPSBjb250ZXh0LnJlc29sdmUocGFyYW1zLmtleSksXG4gICAgICAgICAgICAgICAgdGFyZ2V0LCBvdXRwdXQ7XG4gICAgICAgICAgICBzd2l0Y2ggKGtleSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2Z1bGwnOlxuICAgICAgICAgICAgICAgICAgICB0YXJnZXQgPSBjb250ZXh0LnN0YWNrO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICB0YXJnZXQgPSBjb250ZXh0LnN0YWNrLmhlYWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBvdXRwdXQgPSBKU09OLnN0cmluZ2lmeSh0YXJnZXQsIGpzb25GaWx0ZXIsIDIpO1xuICAgICAgICAgICAgc3dpdGNoICh0bykge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2NvbnNvbGUnOlxuICAgICAgICAgICAgICAgICAgICBsb2coJ2NvbnRleHREdW1wJywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0LnJlcGxhY2UoLzwvZywgJ1xcXFx1MDAzYycpO1xuICAgICAgICAgICAgICAgICAgICBjaHVuayA9IGNodW5rLndyaXRlKG91dHB1dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHtAbWF0aH1cbiAgICAgICAgICogQHBhcmFtIGtleSBmaXJzdCB2YWx1ZVxuICAgICAgICAgKiBAcGFyYW0gbWV0aG9kIHtTdHJpbmd9IG9wZXJhdGlvbiB0byBwZXJmb3JtXG4gICAgICAgICAqIEBwYXJhbSBvcGVyYW5kIHNlY29uZCB2YWx1ZSAobm90IHJlcXVpcmVkIGZvciBvcGVyYXRpb25zIGxpa2UgYGFic2ApXG4gICAgICAgICAqIEBwYXJhbSByb3VuZCBpZiB0cnV0aHksIHJvdW5kKCkgdGhlIHJlc3VsdFxuICAgICAgICAgKi9cbiAgICAgICAgJ21hdGgnOiBmdW5jdGlvbihjaHVuaywgY29udGV4dCwgYm9kaWVzLCBwYXJhbXMpIHsgLy9qc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgICAgICAgIHZhciBrZXkgPSBwYXJhbXMua2V5LFxuICAgICAgICAgICAgICAgIG1ldGhvZCA9IHBhcmFtcy5tZXRob2QsXG4gICAgICAgICAgICAgICAgb3BlcmFuZCA9IHBhcmFtcy5vcGVyYW5kLFxuICAgICAgICAgICAgICAgIHJvdW5kID0gcGFyYW1zLnJvdW5kLFxuICAgICAgICAgICAgICAgIG91dHB1dCwgc3RhdGUsIHgsIGxlbjtcblxuICAgICAgICAgICAgaWYgKCFwYXJhbXMuaGFzT3duUHJvcGVydHkoJ2tleScpIHx8ICFwYXJhbXMubWV0aG9kKSB7XG4gICAgICAgICAgICAgICAgbG9nKCdtYXRoJywgJ2BrZXlgIG9yIGBtZXRob2RgIHdhcyBub3QgcHJvdmlkZWQnLCAnRVJST1InKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGtleSA9IHBhcnNlRmxvYXQoY29udGV4dC5yZXNvbHZlKGtleSkpO1xuICAgICAgICAgICAgb3BlcmFuZCA9IHBhcnNlRmxvYXQoY29udGV4dC5yZXNvbHZlKG9wZXJhbmQpKTtcblxuICAgICAgICAgICAgc3dpdGNoIChtZXRob2QpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdtb2QnOlxuICAgICAgICAgICAgICAgICAgICBpZiAob3BlcmFuZCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nKCdtYXRoJywgJ0RpdmlzaW9uIGJ5IDAnLCAnRVJST1InKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQgPSBrZXkgJSBvcGVyYW5kO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdhZGQnOlxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQgPSBrZXkgKyBvcGVyYW5kO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdzdWJ0cmFjdCc6XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dCA9IGtleSAtIG9wZXJhbmQ7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ211bHRpcGx5JzpcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0ID0ga2V5ICogb3BlcmFuZDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnZGl2aWRlJzpcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wZXJhbmQgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZygnbWF0aCcsICdEaXZpc2lvbiBieSAwJywgJ0VSUk9SJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0ID0ga2V5IC8gb3BlcmFuZDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnY2VpbCc6XG4gICAgICAgICAgICAgICAgY2FzZSAnZmxvb3InOlxuICAgICAgICAgICAgICAgIGNhc2UgJ3JvdW5kJzpcbiAgICAgICAgICAgICAgICBjYXNlICdhYnMnOlxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQgPSBNYXRoW21ldGhvZF0oa2V5KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAndG9pbnQnOlxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQgPSBwYXJzZUludChrZXksIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdtYXRoJywgJ01ldGhvZCBgJyArIG1ldGhvZCArICdgIGlzIG5vdCBzdXBwb3J0ZWQnLCAnRVJST1InKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBvdXRwdXQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJvdW5kKSB7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dCA9IE1hdGgucm91bmQob3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGJvZGllcyAmJiBib2RpZXMuYmxvY2spIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dCA9IGFkZFNlbGVjdFN0YXRlKGNvbnRleHQsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleTogb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBjaHVuayA9IGNodW5rLnJlbmRlcihib2RpZXMuYmxvY2ssIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlU2VsZWN0RGVmZXJyZWRzKGdldFNlbGVjdFN0YXRlKGNvbnRleHQpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjaHVuayA9IGNodW5rLndyaXRlKG91dHB1dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHtAc2VsZWN0fVxuICAgICAgICAgKiBHcm91cHMgYSBzZXQgb2YgdHJ1dGggdGVzdHMgYW5kIG91dHB1dHMgdGhlIGZpcnN0IG9uZSB0aGF0IHBhc3Nlcy5cbiAgICAgICAgICogQWxzbyBjb250YWlucyB7QGFueX0gYW5kIHtAbm9uZX0gYmxvY2tzLlxuICAgICAgICAgKiBAcGFyYW0ga2V5IGEgdmFsdWUgb3IgcmVmZXJlbmNlIHRvIHVzZSBhcyB0aGUgbGVmdC1oYW5kIHNpZGUgb2YgY29tcGFyaXNvbnNcbiAgICAgICAgICogQHBhcmFtIHR5cGUgY29lcmNlIGFsbCB0cnV0aCB0ZXN0IGtleXMgd2l0aG91dCBhbiBleHBsaWNpdCB0eXBlIHRvIHRoaXMgdHlwZVxuICAgICAgICAgKi9cbiAgICAgICAgJ3NlbGVjdCc6IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIGJvZHkgPSBib2RpZXMuYmxvY2ssXG4gICAgICAgICAgICAgICAgc3RhdGUgPSB7fTtcblxuICAgICAgICAgICAgaWYgKHBhcmFtcy5oYXNPd25Qcm9wZXJ0eSgna2V5JykpIHtcbiAgICAgICAgICAgICAgICBzdGF0ZS5rZXkgPSBjb250ZXh0LnJlc29sdmUocGFyYW1zLmtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocGFyYW1zLmhhc093blByb3BlcnR5KCd0eXBlJykpIHtcbiAgICAgICAgICAgICAgICBzdGF0ZS50eXBlID0gcGFyYW1zLnR5cGU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICAgICAgY29udGV4dCA9IGFkZFNlbGVjdFN0YXRlKGNvbnRleHQsIHN0YXRlKTtcbiAgICAgICAgICAgICAgICBjaHVuayA9IGNodW5rLnJlbmRlcihib2R5LCBjb250ZXh0KTtcbiAgICAgICAgICAgICAgICByZXNvbHZlU2VsZWN0RGVmZXJyZWRzKGdldFNlbGVjdFN0YXRlKGNvbnRleHQpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nKCdzZWxlY3QnLCAnTWlzc2luZyBib2R5IGJsb2NrJywgJ1dBUk4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjaHVuaztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHJ1dGggdGVzdCBoZWxwZXJzXG4gICAgICAgICAqIEBwYXJhbSBrZXkgYSB2YWx1ZSBvciByZWZlcmVuY2UgdG8gdXNlIGFzIHRoZSBsZWZ0LWhhbmQgc2lkZSBvZiBjb21wYXJpc29uc1xuICAgICAgICAgKiBAcGFyYW0gdmFsdWUgYSB2YWx1ZSBvciByZWZlcmVuY2UgdG8gdXNlIGFzIHRoZSByaWdodC1oYW5kIHNpZGUgb2YgY29tcGFyaXNvbnNcbiAgICAgICAgICogQHBhcmFtIHR5cGUgaWYgc3BlY2lmaWVkLCBga2V5YCBhbmQgYHZhbHVlYCB3aWxsIGJlIGZvcmNpYmx5IGNhc3QgdG8gdGhpcyB0eXBlXG4gICAgICAgICAqL1xuICAgICAgICAnZXEnOiB0cnV0aFRlc3QoJ2VxJywgZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICAgICAgICAgIHJldHVybiBsZWZ0ID09PSByaWdodDtcbiAgICAgICAgfSksXG4gICAgICAgICduZSc6IHRydXRoVGVzdCgnbmUnLCBmdW5jdGlvbihsZWZ0LCByaWdodCkge1xuICAgICAgICAgICAgcmV0dXJuIGxlZnQgIT09IHJpZ2h0O1xuICAgICAgICB9KSxcbiAgICAgICAgJ2x0JzogdHJ1dGhUZXN0KCdsdCcsIGZ1bmN0aW9uKGxlZnQsIHJpZ2h0KSB7XG4gICAgICAgICAgICByZXR1cm4gbGVmdCA8IHJpZ2h0O1xuICAgICAgICB9KSxcbiAgICAgICAgJ2x0ZSc6IHRydXRoVGVzdCgnbHRlJywgZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICAgICAgICAgIHJldHVybiBsZWZ0IDw9IHJpZ2h0O1xuICAgICAgICB9KSxcbiAgICAgICAgJ2d0JzogdHJ1dGhUZXN0KCdndCcsIGZ1bmN0aW9uKGxlZnQsIHJpZ2h0KSB7XG4gICAgICAgICAgICByZXR1cm4gbGVmdCA+IHJpZ2h0O1xuICAgICAgICB9KSxcbiAgICAgICAgJ2d0ZSc6IHRydXRoVGVzdCgnZ3RlJywgZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICAgICAgICAgIHJldHVybiBsZWZ0ID49IHJpZ2h0O1xuICAgICAgICB9KSxcblxuICAgICAgICAvKipcbiAgICAgICAgICoge0Bhbnl9XG4gICAgICAgICAqIE91dHB1dHMgYXMgbG9uZyBhcyBhdCBsZWFzdCBvbmUgdHJ1dGggdGVzdCBpbnNpZGUgYSB7QHNlbGVjdH0gaGFzIHBhc3NlZC5cbiAgICAgICAgICogTXVzdCBiZSBjb250YWluZWQgaW5zaWRlIGEge0BzZWxlY3R9IGJsb2NrLlxuICAgICAgICAgKiBUaGUgcGFzc2luZyB0cnV0aCB0ZXN0IGNhbiBiZSBiZWZvcmUgb3IgYWZ0ZXIgdGhlIHtAYW55fSBibG9jay5cbiAgICAgICAgICovXG4gICAgICAgICdhbnknOiBmdW5jdGlvbihjaHVuaywgY29udGV4dCwgYm9kaWVzLCBwYXJhbXMpIHtcbiAgICAgICAgICAgIHZhciBzZWxlY3RTdGF0ZSA9IGdldFNlbGVjdFN0YXRlKGNvbnRleHQpO1xuXG4gICAgICAgICAgICBpZiAoIXNlbGVjdFN0YXRlKSB7XG4gICAgICAgICAgICAgICAgbG9nKCdhbnknLCAnTXVzdCBiZSB1c2VkIGluc2lkZSBhIHtAc2VsZWN0fSBibG9jaycsICdFUlJPUicpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZWN0U3RhdGUuaXNEZWZlcnJlZENvbXBsZXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZygnYW55JywgJ011c3Qgbm90IGJlIG5lc3RlZCBpbnNpZGUge0Bhbnl9IG9yIHtAbm9uZX0gYmxvY2snLCAnRVJST1InKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjaHVuayA9IGNodW5rLm1hcChmdW5jdGlvbihjaHVuaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZWN0U3RhdGUuZGVmZXJyZWRzLnB1c2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGVjdFN0YXRlLmlzUmVzb2x2ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2h1bmsgPSBjaHVuay5yZW5kZXIoYm9kaWVzLmJsb2NrLCBjb250ZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2h1bmsuZW5kKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNodW5rO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB7QG5vbmV9XG4gICAgICAgICAqIE91dHB1dHMgaWYgbm8gdHJ1dGggdGVzdHMgaW5zaWRlIGEge0BzZWxlY3R9IHBhc3MuXG4gICAgICAgICAqIE11c3QgYmUgY29udGFpbmVkIGluc2lkZSBhIHtAc2VsZWN0fSBibG9jay5cbiAgICAgICAgICogVGhlIHBvc2l0aW9uIG9mIHRoZSBoZWxwZXIgZG9lcyBub3QgbWF0dGVyLlxuICAgICAgICAgKi9cbiAgICAgICAgJ25vbmUnOiBmdW5jdGlvbihjaHVuaywgY29udGV4dCwgYm9kaWVzLCBwYXJhbXMpIHtcbiAgICAgICAgICAgIHZhciBzZWxlY3RTdGF0ZSA9IGdldFNlbGVjdFN0YXRlKGNvbnRleHQpO1xuXG4gICAgICAgICAgICBpZiAoIXNlbGVjdFN0YXRlKSB7XG4gICAgICAgICAgICAgICAgbG9nKCdub25lJywgJ011c3QgYmUgdXNlZCBpbnNpZGUgYSB7QHNlbGVjdH0gYmxvY2snLCAnRVJST1InKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHNlbGVjdFN0YXRlLmlzRGVmZXJyZWRDb21wbGV0ZSkge1xuICAgICAgICAgICAgICAgICAgICBsb2coJ25vbmUnLCAnTXVzdCBub3QgYmUgbmVzdGVkIGluc2lkZSB7QGFueX0gb3Ige0Bub25lfSBibG9jaycsICdFUlJPUicpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rID0gY2h1bmsubWFwKGZ1bmN0aW9uKGNodW5rKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxlY3RTdGF0ZS5kZWZlcnJlZHMucHVzaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNlbGVjdFN0YXRlLmlzUmVzb2x2ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2h1bmsgPSBjaHVuay5yZW5kZXIoYm9kaWVzLmJsb2NrLCBjb250ZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2h1bmsuZW5kKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNodW5rO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB7QHNpemV9XG4gICAgICAgICAqIFdyaXRlIHRoZSBzaXplIG9mIHRoZSB0YXJnZXQgdG8gdGhlIGNodW5rXG4gICAgICAgICAqIEZhbHN5IHZhbHVlcyBhbmQgdHJ1ZSBoYXZlIHNpemUgMFxuICAgICAgICAgKiBOdW1iZXJzIGFyZSByZXR1cm5lZCBhcy1pc1xuICAgICAgICAgKiBBcnJheXMgYW5kIFN0cmluZ3MgaGF2ZSBzaXplIGVxdWFsIHRvIHRoZWlyIGxlbmd0aFxuICAgICAgICAgKiBPYmplY3RzIGhhdmUgc2l6ZSBlcXVhbCB0byB0aGUgbnVtYmVyIG9mIGtleXMgdGhleSBjb250YWluXG4gICAgICAgICAqIER1c3QgYm9kaWVzIGFyZSBldmFsdWF0ZWQgYW5kIHRoZSBsZW5ndGggb2YgdGhlIHN0cmluZyBpcyByZXR1cm5lZFxuICAgICAgICAgKiBGdW5jdGlvbnMgYXJlIGV2YWx1YXRlZCBhbmQgdGhlIGxlbmd0aCBvZiB0aGVpciByZXR1cm4gdmFsdWUgaXMgZXZhbHVhdGVkXG4gICAgICAgICAqIEBwYXJhbSBrZXkgZmluZCB0aGUgc2l6ZSBvZiB0aGlzIHZhbHVlIG9yIHJlZmVyZW5jZVxuICAgICAgICAgKi9cbiAgICAgICAgJ3NpemUnOiBmdW5jdGlvbihjaHVuaywgY29udGV4dCwgYm9kaWVzLCBwYXJhbXMpIHtcbiAgICAgICAgICAgIHZhciBrZXkgPSBwYXJhbXMua2V5LFxuICAgICAgICAgICAgICAgIHZhbHVlLCBrO1xuXG4gICAgICAgICAgICBrZXkgPSBjb250ZXh0LnJlc29sdmUocGFyYW1zLmtleSk7XG4gICAgICAgICAgICBpZiAoIWtleSB8fCBrZXkgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IDA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGR1c3QuaXNBcnJheShrZXkpKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBrZXkubGVuZ3RoO1xuICAgICAgICAgICAgfSBlbHNlIGlmICghaXNOYU4ocGFyc2VGbG9hdChrZXkpKSAmJiBpc0Zpbml0ZShrZXkpKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBrZXk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBrZXkgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSAwO1xuICAgICAgICAgICAgICAgIGZvciAoayBpbiBrZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGtleS5oYXNPd25Qcm9wZXJ0eShrKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSAoa2V5ICsgJycpLmxlbmd0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjaHVuay53cml0ZSh2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBmb3IgKHZhciBrZXkgaW4gaGVscGVycykge1xuICAgICAgICBkdXN0LmhlbHBlcnNba2V5XSA9IGhlbHBlcnNba2V5XTtcbiAgICB9XG5cbiAgICByZXR1cm4gZHVzdDtcblxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgVGVtcGxhdGluZ0RlbGVnYXRlIGZyb20gJy4vVGVtcGxhdGluZ0RlbGVnYXRlJztcbmltcG9ydCBkdXN0IGZyb20gJ2FlLWR1c3Rqcyc7XG5pbXBvcnQgdXVpZCBmcm9tICdub2RlLXV1aWQnO1xuaW1wb3J0IE9ic2VydmFibGVPYmplY3QgZnJvbSAnLi4vT2JzZXJ2YWJsZU9iamVjdCc7XG5pbXBvcnQgZ2V0IGZyb20gJ2xvZGFzaC5nZXQnO1xuaW1wb3J0IGVhY2ggZnJvbSAnbG9kYXNoLmZvcmVhY2gnO1xuaW1wb3J0IHJlc3VsdCBmcm9tICdsb2Rhc2gucmVzdWx0JztcbmltcG9ydCBpc0Z1bmN0aW9uIGZyb20gJ2xvZGFzaC5pc2Z1bmN0aW9uJztcblxuaW1wb3J0IGR1c3RIZWxwZXJzIGZyb20gJy4vZHVzdC1oZWxwZXJzJztcbmR1c3RIZWxwZXJzKGR1c3QpO1xuY29uc3QgX3RlbXBsYXRlcyA9IG5ldyBNYXAoKTtcbmxldCBldmlsRm47XG5sZXQgZ2xvYmFsQ29udGV4dDtcblxuY2xhc3MgRHVzdFRlbXBsYXRpbmdEZWxlZ2F0ZSBleHRlbmRzIFRlbXBsYXRpbmdEZWxlZ2F0ZSB7XG4gICAgY29uc3RydWN0b3IoaW5FdmlsRm4pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdmFyIG4gPSAnRVYnICsgJ2EnICsgJ0wnO1xuICAgICAgICBldmlsRm4gPSBpbkV2aWxGbiB8fCB3aW5kb3dbbi50b0xvd2VyQ2FzZSgpXTtcblxuICAgICAgICBkdXN0LmNvbGxlY3Rpb25SZXNvbHZlciA9IGZ1bmN0aW9uKGluQ29sbGVjdGlvbikge1xuICAgICAgICAgICAgaWYgKGluQ29sbGVjdGlvbiBpbnN0YW5jZW9mIE9ic2VydmFibGVPYmplY3QgJiYgaW5Db2xsZWN0aW9uLmlzQ29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiBpbkNvbGxlY3Rpb24udG9OYXRpdmUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGluQ29sbGVjdGlvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBkdXN0LnByb3BlcnR5UmVzb2x2ZXIgPSBmdW5jdGlvbihpbkJhc2UsIGluUGF0aCkge1xuICAgICAgICAgICAgaWYgKGluQmFzZSBpbnN0YW5jZW9mIE9ic2VydmFibGVPYmplY3QpIHtcbiAgICAgICAgICAgICAgICBpZiAoaW5CYXNlLmlzQ29sbGVjdGlvbiAmJiBpblBhdGggPT09ICdsZW5ndGgnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpbkJhc2UubGVuZ3RoO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpbkJhc2UucHJvcChpblBhdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldChpbkJhc2UsIGluUGF0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cblxuICAgIH1cblxuICAgIHJlZ2lzdGVyRXh0ZW5zaW9ucyhpbkV4dGVuc2lvbnMpIHtcbiAgICAgICAgZ2xvYmFsQ29udGV4dCA9IGdldChpbkV4dGVuc2lvbnMsICdnbG9iYWxDb250ZXh0Jyk7XG5cbiAgICAgICAgZWFjaChnZXQoaW5FeHRlbnNpb25zLCAnZmlsdGVycycpLCAoaW5GaWx0ZXIsIGluTmFtZSkgPT4ge1xuICAgICAgICAgICAgZHVzdC5maWx0ZXJzW2luTmFtZV0gPSBpbkZpbHRlcjtcbiAgICAgICAgfSk7XG4gICAgICAgIGVhY2goZ2V0KGluRXh0ZW5zaW9ucywgJ2hlbHBlcnMnKSwgKGluSGVscGVyLCBpbk5hbWUpID0+IHtcbiAgICAgICAgICAgIGR1c3QuaGVscGVyc1tpbk5hbWVdID0gaW5IZWxwZXI7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldENvbGxlY3Rpb25SZXNvbHZlcihpblJlc29sdmVyKSB7XG4gICAgICAgIGR1c3QuY29sbGVjdGlvblJlc29sdmVyID0gaW5SZXNvbHZlcjtcbiAgICB9XG5cbiAgICBzZXRQcm9wZXJ0eVJlc29sdmVyKGluUmVzb2x2ZXIpIHtcbiAgICAgICAgZHVzdC5wcm9wZXJ0eVJlc29sdmVyID0gaW5SZXNvbHZlcjtcbiAgICB9XG5cbiAgICByZWdpc3Rlcihpbk5hbWUsIGluVGVtcGxhdGUpIHtcbiAgICAgICAgX3RlbXBsYXRlcy5zZXQoaW5OYW1lLCBpblRlbXBsYXRlKTtcbiAgICAgICAgZHVzdC5yZWdpc3Rlcihpbk5hbWUsIGluVGVtcGxhdGUpO1xuICAgIH1cblxuXG4gICAgcmVnaXN0ZXJUZW1wbGF0ZShpblNvdXJjZSwgaW5OYW1lKSB7XG4gICAgICAgIGluTmFtZSA9IGluTmFtZSB8fCAoJ3RlbXBsYXRlXycgKyB1dWlkLnY0KCkpO1xuICAgICAgICBjb25zdCBjb21waWxlZFNyYyA9IGR1c3QuY29tcGlsZShpblNvdXJjZSkucmVwbGFjZSgvXFxiZHVzdFxcYi9nLCAnJyk7XG5cbiAgICAgICAgY29uc3QgY29tcGlsZWRGbiA9IGV2aWxGbihjb21waWxlZFNyYyk7XG4gICAgICAgIGlmIChjb21waWxlZEZuIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgY29tcGlsZWRGbi50aGVuKChpbkZuKSA9PiB7XG4gICAgICAgICAgICAgICAgX3RlbXBsYXRlcy5zZXQoaW5OYW1lLCBpbkZuKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgX3RlbXBsYXRlcy5zZXQoaW5OYW1lLCBjb21waWxlZEZuKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW5OYW1lO1xuICAgIH1cblxuICAgIHJlbmRlcihpblRlbXBsYXRlTmFtZSwgaW5Nb2RlbCwgaW5QYXJhbXMpIHtcbiAgICAgICAgY29uc3QgdGVtcGxhdGUgPSBfdGVtcGxhdGVzLmdldChpblRlbXBsYXRlTmFtZSk7XG4gICAgICAgIGlmICghdGVtcGxhdGUpIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChgRHVzdFRlbXBsYXRpbmdEZWxlZ2F0ZTogVGVtcGxhdGUgd2l0aCBuYW1lICR7aW5UZW1wbGF0ZU5hbWV9IG5vdCBmb3VuZGApO1xuICAgICAgICB9XG4gICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgaWYgKGluTW9kZWwgaW5zdGFuY2VvZiBPYnNlcnZhYmxlT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgaW5Nb2RlbCA9IGluTW9kZWwudG9OYXRpdmUodHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gZnVuY3Rpb24oaW5FcnJvciwgaW5IdG1sKSB7XG4gICAgICAgICAgICAgICAgaWYgKGluRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGluRXJyb3IpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoaW5IdG1sKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCBnbG9iID0gaXNGdW5jdGlvbihnbG9iYWxDb250ZXh0KSA/IGdsb2JhbENvbnRleHQoKSA6ICggZ2xvYmFsQ29udGV4dCB8fCB7fSk7XG4gICAgICAgICAgICBsZXQgY29udGV4dCA9IGR1c3QubWFrZUJhc2UoZ2xvYik7XG4gICAgICAgICAgICBpZihpblBhcmFtcykge1xuICAgICAgICAgICAgICAgIGNvbnRleHQgPSBjb250ZXh0LnB1c2goaW5QYXJhbXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29udGV4dCA9IGNvbnRleHQucHVzaChpbk1vZGVsKTtcbiAgICAgICAgICAgIGR1c3QucmVuZGVyKHRlbXBsYXRlLCBjb250ZXh0LCBoYW5kbGVyKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cbn1cbmxldCBpbnN0YW5jZTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24oaW5FdmlsRm4pIHtcbiAgICByZXR1cm4gKGluc3RhbmNlID8gaW5zdGFuY2UgOiAoaW5zdGFuY2UgPSBuZXcgRHVzdFRlbXBsYXRpbmdEZWxlZ2F0ZShpbkV2aWxGbikpKTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcbmltcG9ydCBCdXMgZnJvbSAnLi9CdXMnO1xuaW1wb3J0IENvbXBvbmVudCBmcm9tICcuL0NvbXBvbmVudCc7XG5pbXBvcnQgUGFnZSBmcm9tICcuL1BhZ2UnO1xuaW1wb3J0IE9ic2VydmFibGVPYmplY3QgZnJvbSAnLi9PYnNlcnZhYmxlT2JqZWN0JztcbmltcG9ydCBkdXN0VGVtcGxhdGluZ0RlbGVnYXRlIGZyb20gJy4vZGVsZWdhdGUvZHVzdC10ZW1wbGF0aW5nLWRlbGVnYXRlJztcblxuXG5sZXQgX3RlbXBsYXRpbmdEZWxlZ2F0ZTtcbmxldCBfY29tcG9uZW50Q29uZmlnUHJlcHJvY2Vzc29yO1xuXG5jbGFzcyBQYWdlRmFjdG9yeSB7XG4gICAgXG4gICAgZ2V0VGVtcGxhdGluZ0RlbGVnYXRlKCkge1xuICAgICAgICByZXR1cm4gX3RlbXBsYXRpbmdEZWxlZ2F0ZTtcbiAgICB9XG5cbiAgICBzZXRDb21wb25lbnRDb25maWdQcmVQcm9jZXNzb3IoaW5Gbikge1xuICAgIFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdjb21wb25lbnRDb25maWdQcmVwcm9jZXNzb3InLCB7IFxuICAgICAgICAgICAgZ2V0IDogZnVuY3Rpb24oKSB7IFxuICAgICAgICAgICAgICAgIHJldHVybiBpbkZuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwYWdlKGluQ29uZmlnLCBpbk1vZGVsLCBpblNldHVwRnVuY3Rpb24pIHtcbiAgICBcdCBfdGVtcGxhdGluZ0RlbGVnYXRlID0gaW5Db25maWcudGVtcGxhdGluZ0RlbGVnYXRlIHx8IGR1c3RUZW1wbGF0aW5nRGVsZWdhdGUoaW5Db25maWcuZXZpbEZ1bmN0aW9uKTtcbiAgICAgICAgbGV0IHBhZ2UgPSBuZXcgUGFnZShpbkNvbmZpZywgaW5Nb2RlbCwgaW5TZXR1cEZ1bmN0aW9uKTtcbiAgICAgICAgcmV0dXJuIHBhZ2U7XG4gICAgfVxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBQYWdlRmFjdG9yeSgpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuaW1wb3J0IG1pY3JvdGFzayBmcm9tICcuL21pY3JvdGFzayc7XG5pbXBvcnQgT2JzZXJ2YWJsZU9iamVjdCBmcm9tICcuL09ic2VydmFibGVPYmplY3QnO1xuaW1wb3J0IENvbXBvbmVudE1vZGVsIGZyb20gJy4vQ29tcG9uZW50TW9kZWwnO1xuaW1wb3J0IFN0YXRlIGZyb20gJy4vU3RhdGUnO1xuaW1wb3J0IEJ1cyBmcm9tICcuL0J1cyc7XG5pbXBvcnQgaXNTdHJpbmcgZnJvbSAnbG9kYXNoLmlzU3RyaW5nJztcbmltcG9ydCBpc0Z1bmN0aW9uIGZyb20gJ2xvZGFzaC5pc0Z1bmN0aW9uJztcbmltcG9ydCBpc1BsYWluT2JqZWN0IGZyb20gJ2xvZGFzaC5pc1BsYWluT2JqZWN0JztcbmltcG9ydCBlYWNoIGZyb20gJ2xvZGFzaC5mb3JlYWNoJztcbmltcG9ydCBnZXQgZnJvbSAnbG9kYXNoLmdldCc7XG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IGZhY3RvcnkgZnJvbSAnLi9wYWdlLWZhY3RvcnknO1xuaW1wb3J0IENvbXBvbmVudExpZmVjeWNsZSBmcm9tICcuL0NvbXBvbmVudExpZmVjeWNsZSc7XG5pbXBvcnQge1xuICAgIFNpZ25hbFxufSBmcm9tICdzaWduYWxzJztcbmltcG9ydCBwcml2YXRlSGFzaCBmcm9tICcuL3V0aWwvcHJpdmF0ZSc7XG5cbmNvbnN0IF9wcml2YXRlID0gcHJpdmF0ZUhhc2goJ2NvbXBvbmVudCcpO1xuXG5jb25zdCBfc2V0dXBNb2RlbCA9IGZ1bmN0aW9uIF9zZXR1cE1vZGVsKGluTW9kZWxJbml0T2JqKSB7XG5cbiAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcblxuICAgIGxldCBnZXR0ZXI7XG4gICAgaWYgKCFpbk1vZGVsSW5pdE9iaikge1xuICAgICAgICBnZXR0ZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYWdlLnJlc29sdmVOb2RlTW9kZWwodGhpcy5ub2RlKTtcbiAgICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoaXNQbGFpbk9iamVjdChpbk1vZGVsSW5pdE9iaikpIHtcbiAgICAgICAgICAgIF9wLm1vZGVsID0gbmV3IENvbXBvbmVudE1vZGVsKGluTW9kZWxJbml0T2JqKTtcbiAgICAgICAgfSBlbHNlIGlmIChpbk1vZGVsSW5pdE9iaiBpbnN0YW5jZW9mIENvbXBvbmVudE1vZGVsKSB7XG4gICAgICAgICAgICBfcC5tb2RlbCA9IGluTW9kZWxJbml0T2JqO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfcC5tb2RlbCA9IE9ic2VydmFibGVPYmplY3QuZnJvbU9iamVjdChpbk1vZGVsSW5pdE9iaik7XG4gICAgICAgIH1cbiAgICAgICAgZ2V0dGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIF9wLm1vZGVsO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbW9kZWwnLCB7XG4gICAgICAgIGdldDogZ2V0dGVyXG4gICAgfSk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdoYXNNb2RlbCcsIHtcbiAgICAgICAgZ2V0OiAoKSA9PiAhIWluTW9kZWxJbml0T2JqXG4gICAgfSk7XG59O1xuXG5jb25zdCBfZmluZFN0YXRlID0gZnVuY3Rpb24gX2ZpbmRTdGF0ZShpblN0YXRlTmFtZSkge1xuXG4gICAgaWYgKCFpblN0YXRlTmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5zdGF0ZXM7XG4gICAgfVxuICAgIGxldCBwYXRoID0gaW5TdGF0ZU5hbWUuc3BsaXQoJy4nKTtcbiAgICBsZXQgY3VycmVudFN0YXRlID0gdGhpcy5zdGF0ZXM7XG4gICAgd2hpbGUgKHBhdGgubGVuZ3RoICYmIGN1cnJlbnRTdGF0ZSkge1xuICAgICAgICBsZXQgc2VnID0gcGF0aC5zaGlmdCgpO1xuICAgICAgICBjdXJyZW50U3RhdGUgPSBjdXJyZW50U3RhdGUuY2hpbGQoc2VnKTtcbiAgICB9XG4gICAgcmV0dXJuIGN1cnJlbnRTdGF0ZTtcbn07XG5cblxuY29uc3QgX3dhdGNoU3RhdGUgPSBmdW5jdGlvbiBfd2F0Y2hTdGF0ZSgpIHtcbiAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcblxuICAgIF9wLnN0YXRlSW5mby53YXRjaCgnbmV4dFN0YXRlJywgKGluUGF0aCwgaW5DaGFuZ2VzKSA9PiB7XG4gICAgICAgIGxldCBuZXh0U3RhdGUgPSBfZmluZFN0YXRlLmJpbmQodGhpcykoaW5DaGFuZ2VzLm5ld1ZhbHVlKTtcbiAgICAgICAgaWYgKCFuZXh0U3RhdGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignQ2hhbmdpbmcgdG8gdW5rbm93biBzdGF0ZTogJyArXG4gICAgICAgICAgICAgICAgaW5DaGFuZ2VzLm5ld1ZhbHVlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByb2xsYmFjayA9IChpblJlYXNvbikgPT4ge1xuICAgICAgICAgICAgaW5SZWFzb24gJiYgY29uc29sZS5kZWJ1ZygnQ291bGQgbm90IGNoYW5nZSBzdGF0ZSBiZWNhdXNlOiAnICsgaW5SZWFzb24pOyAvL2pzaGludCBpZ25vcmU6bGluZVxuICAgICAgICAgICAgX3Auc3RhdGVJbmZvLnByb3AoJ25leHRTdGF0ZScsIGluQ2hhbmdlcy5vbGRWYWx1ZSwgdHJ1ZSk7XG4gICAgICAgICAgICBjdXJyZW50U3RhdGUuZGlkbnRMZWF2ZSgpO1xuICAgICAgICAgICAgZm9yIChsZXQgd2F0Y2hlciBvZiBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVXYXRjaGVycykge1xuICAgICAgICAgICAgICAgIHdhdGNoZXIoaW5DaGFuZ2VzLm5ld1ZhbHVlLCBpbkNoYW5nZXMub2xkVmFsdWUsIGluUmVhc29uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgbGV0IGN1cnJlbnRTdGF0ZSA9IF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZUluZm8ucHJvcCgnY3VycmVudFN0YXRlT2JqZWN0Jyk7XG4gICAgICAgIGlmIChjdXJyZW50U3RhdGUpIHtcbiAgICAgICAgICAgIGN1cnJlbnRTdGF0ZS5sZWF2aW5nKGluQ2hhbmdlcy5uZXdWYWx1ZSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgbmV4dFN0YXRlLmVudGVyaW5nKGluQ2hhbmdlcy5vbGRWYWx1ZSkudGhlbigoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5wcm9wKCdjdXJyZW50U3RhdGVPYmplY3QnLCBuZXh0U3RhdGUpO1xuICAgICAgICAgICAgICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVJbmZvLnByb3AoJ3N0YXRlJywgX3Auc3RhdGVJbmZvLnByb3AoJ25leHRTdGF0ZScpKTtcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFN0YXRlLmxlZnQoaW5DaGFuZ2VzLm5ld1ZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgbmV4dFN0YXRlLmVudGVyZWQoaW5DaGFuZ2VzLm9sZFZhbHVlKTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCB3YXRjaGVyIG9mIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZVdhdGNoZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3YXRjaGVyKGluQ2hhbmdlcy5uZXdWYWx1ZSwgaW5DaGFuZ2VzLm9sZFZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfSkuY2F0Y2gocm9sbGJhY2spO1xuICAgICAgICAgICAgfSkuY2F0Y2gocm9sbGJhY2spO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG5cblxuY2xhc3MgQ29tcG9uZW50IHtcblxuICAgIGNvbnN0cnVjdG9yKGluQ29uZmlnLCBpblBhcmFtMiwgaW5QYXJhbTMsIGluUGFyYW00KSB7XG4gICAgICAgIGxldCBpbkluaXRPYmosIGluQ29uc3RydWN0b3IsIGluUGFnZTtcbiAgICAgICAgaWYgKGlzRnVuY3Rpb24oaW5QYXJhbTIpKSB7XG4gICAgICAgICAgICBbaW5Db25zdHJ1Y3RvciwgaW5QYWdlXSA9IFtpblBhcmFtMiwgaW5QYXJhbTNdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgW2luSW5pdE9iaiwgaW5Db25zdHJ1Y3RvciwgaW5QYWdlXSA9IFtpblBhcmFtMiwgaW5QYXJhbTMsIGluUGFyYW00XTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGxpZmVjeWNsZVNpZ25hbCA9IG5ldyBTaWduYWwoKTtcbiAgICAgICAgY29uc3QgbGlmZWN5Y2xlID0gbmV3IENvbXBvbmVudExpZmVjeWNsZShsaWZlY3ljbGVTaWduYWwpO1xuICAgICAgICB0aGlzLm1pY3JvdGFzayA9IG1pY3JvdGFzaztcbiAgICAgICAgX3ByaXZhdGUuc2V0KHRoaXMsIHtcbiAgICAgICAgICAgIHN0YXRlV2F0Y2hlcnM6IG5ldyBTZXQoKSxcbiAgICAgICAgICAgIGxpZmVjeWNsZVNpZ25hbDogbGlmZWN5Y2xlU2lnbmFsLFxuICAgICAgICAgICAgc3RhdGVJbmZvOiBuZXcgT2JzZXJ2YWJsZU9iamVjdCgpLFxuICAgICAgICAgICAgcmVzb2x2ZXJzIDogaW5Db25maWcucmVzb2x2ZXJzXG4gICAgICAgIH0pO1xuXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbGlmZWN5Y2xlJywge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbGlmZWN5Y2xlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuXG4gICAgICAgIGlmIChmYWN0b3J5LmNvbXBvbmVudENvbmZpZ1ByZXByb2Nlc3Nvcikge1xuICAgICAgICAgICAgZmFjdG9yeS5jb21wb25lbnRDb25maWdQcmVwcm9jZXNzb3IoaW5Db25maWcpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY29uZmlnID0gaW5Db25maWc7XG4gICAgICAgIHRoaXMucGFnZSA9IGluUGFnZSB8fCB0aGlzO1xuICAgICAgICB0aGlzLmJ1cyA9IG5ldyBCdXModGhpcyk7IC8vanNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAgIHRoaXMubmFtZSA9IGluQ29uZmlnLm5hbWU7XG4gICAgICAgIGVhY2goaW5Db25maWcuYWN0aW9ucywgKGluQWN0aW9uKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWluQWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignUGFzc2VkIGEgbnVsbCBhY3Rpb24gdG8gY29tcG9uZW50IGNvbmZpZycpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGFjdGlvbk5hbWUgPSBpc1N0cmluZyhpbkFjdGlvbikgPyBpbkFjdGlvbiA6IGluQWN0aW9uLm5hbWU7XG4gICAgICAgICAgICBpZiAoIWFjdGlvbk5hbWUpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdQYXNzZWQgYW4gb2JqZWN0IHdpdGggbm8gYWN0aW9uIG5hbWUgYXMgYWN0aW9uIGluIGNvbXBvbmVudCBjb25maWcnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gaXNQbGFpbk9iamVjdChpbkFjdGlvbikgPyBpbkFjdGlvbi5oYW5kbGVyIDogdW5kZWZpbmVkO1xuXG4gICAgICAgICAgICBpZiAoaGFuZGxlciAmJiAhaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Bhc3NlZCBhIG5vbi1mdW5jdGlvbiBhY3Rpb24gaGFuZGxlciBpbiBjb21wb25lbnQgY29uZmlnJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzUGxhaW5PYmplY3QoaW5BY3Rpb24pICYmIGluQWN0aW9uLnB1Ymxpc2ggPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1cy5wdWJsaXNoQWN0aW9uKGFjdGlvbk5hbWUsIGhhbmRsZXIgPyBoYW5kbGVyLmJpbmQodGhpcykgOiBudWxsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5idXMuYWRkQWN0aW9uKGFjdGlvbk5hbWUsIGhhbmRsZXIgPyBoYW5kbGVyLmJpbmQodGhpcykgOiBudWxsKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcbiAgICAgICAgbGV0IHRlbXBsYXRlcyA9IGluQ29uZmlnLnRlbXBsYXRlcyB8fCB7fTtcblxuICAgICAgICBfc2V0dXBNb2RlbC5jYWxsKHRoaXMsIGluSW5pdE9iaik7XG5cbiAgICAgICAgZm9yIChsZXQgdGVtcGxhdGVOYW1lIGluIHRlbXBsYXRlcykge1xuICAgICAgICAgICAgbGV0IGFjdHVhbFRlbXBsYXRlTmFtZSA9IHRlbXBsYXRlTmFtZSA9PT0gJ19kZWZhdWx0JyA/XG4gICAgICAgICAgICAgICAgJ19kZWZhdWx0LicgKyB0aGlzLm5hbWUgOlxuICAgICAgICAgICAgICAgIHRlbXBsYXRlTmFtZTtcbiAgICAgICAgICAgIGZhY3RvcnkuZ2V0VGVtcGxhdGluZ0RlbGVnYXRlKClcbiAgICAgICAgICAgICAgICAucmVnaXN0ZXIoYWN0dWFsVGVtcGxhdGVOYW1lLCB0ZW1wbGF0ZXNbdGVtcGxhdGVOYW1lXSk7XG4gICAgICAgIH1cbiAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLmhhc0RlZmF1bHRUZW1wbGF0ZSA9ICEhdGVtcGxhdGVzLl9kZWZhdWx0O1xuICAgICAgICBfd2F0Y2hTdGF0ZS5iaW5kKHRoaXMpKCk7XG4gICAgICAgIHRoaXMuc3RhdGVzID0gdGhpcy5zdGF0ZXMgfHwgbmV3IFN0YXRlKCk7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZUluZm8ucHJvcCgnY3VycmVudFN0YXRlT2JqZWN0JywgdGhpcy5zdGF0ZXMpO1xuICAgICAgICBpbkNvbnN0cnVjdG9yICYmIGluQ29uc3RydWN0b3IuYmluZCh0aGlzKSgpOyAvL2pzaGludCBpZ25vcmU6bGluZVxuXG4gICAgICAgIG1pY3JvdGFzayh0aGlzLmluaXRTdGF0ZS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICBkYXRhKGluUGF0aCwgaW5WYWx1ZSwgaW5TaWxlbnQpIHtcbiAgICAgICAgY29uc3QgcGF0aCA9ICdkYXRhJyArIChpblBhdGggPyAnLicgKyBpblBhdGggOiAnJyk7XG4gICAgICAgIHJldHVybiB0aGlzLnBhZ2UucmVzb2x2ZU5vZGVNb2RlbCh0aGlzLm5vZGUsIHBhdGgpLnByb3AocGF0aCwgaW5WYWx1ZSwgaW5TaWxlbnQpO1xuICAgIH1cblxuICAgIHBhcmVudCgpIHtcbiAgICAgICAgaWYgKHRoaXMucGFnZSA9PT0gdGhpcykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnBhZ2UucmVzb2x2ZU5vZGVDb21wb25lbnQoJCh0aGlzLm5vZGUpLnBhcmVudCgpKTtcbiAgICB9XG5cbiAgICBnZXRSZXNvbHZlcihpbk5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGdldChfcHJpdmF0ZS5nZXQodGhpcyksICdyZXNvbHZlcnMuJyArIGluTmFtZSk7XG4gICAgfVxuXG4gICAgaW5pdFN0YXRlKCkge1xuXG4gICAgfVxuXG4gICAgZ2V0Q3VycmVudFN0YXRlKCkge1xuICAgICAgICByZXR1cm4gX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5wcm9wKCdjdXJyZW50U3RhdGVPYmplY3QnKTtcbiAgICB9XG5cbiAgICB0cnlTdGF0ZShpblN0YXRlTmFtZSkge1xuICAgICAgICBpZiAoaW5TdGF0ZU5hbWUgPT09IChfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVJbmZvLnByb3AoJ3N0YXRlJykgfHwgJycpKSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgd2F0Y2hlciA9IChpbk5ld1N0YXRlLCBpbk9sZFN0YXRlLCBpbkVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGluRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGluRXJyb3IpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoaW5OZXdTdGF0ZSwgaW5PbGRTdGF0ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMudW53YXRjaFN0YXRlKHdhdGNoZXIpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRoaXMud2F0Y2hTdGF0ZSh3YXRjaGVyKTtcbiAgICAgICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZUluZm8ucHJvcCgnbmV4dFN0YXRlJywgaW5TdGF0ZU5hbWUpO1xuICAgICAgICB9KTtcblxuICAgIH1cblxuICAgIHVud2F0Y2hTdGF0ZShpbldhdGNoZXJGdW5jdGlvbikge1xuICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVXYXRjaGVycy5kZWxldGUoaW5XYXRjaGVyRnVuY3Rpb24pO1xuICAgIH1cblxuICAgIHdhdGNoU3RhdGUoaW5XYXRjaGVyRnVuY3Rpb24pIHtcbiAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlV2F0Y2hlcnMuYWRkKGluV2F0Y2hlckZ1bmN0aW9uKTtcbiAgICB9XG5cbiAgICBpbnZhbGlkYXRlKCkge1xuICAgICAgICBpZiAoIV9wcml2YXRlLmdldCh0aGlzKS53aWxsUmVuZGVyKSB7XG4gICAgICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykud2lsbFJlbmRlciA9IHRydWU7XG4gICAgICAgICAgICBtaWNyb3Rhc2sodGhpcy5yZW5kZXIuYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW5kZXIoaW5Nb2RlbCkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLndpbGxSZW5kZXIgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmIChfcHJpdmF0ZS5nZXQodGhpcykuaGFzRGVmYXVsdFRlbXBsYXRlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGVsZWdhdGUgPSBmYWN0b3J5LmdldFRlbXBsYXRpbmdEZWxlZ2F0ZSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1vZGVsID0gaW5Nb2RlbCA/XG4gICAgICAgICAgICAgICAgICAgIE9ic2VydmFibGVPYmplY3QuZnJvbU9iamVjdChpbk1vZGVsKSA6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGF0YSgpO1xuICAgICAgICAgICAgICAgIGRlbGVnYXRlLnJlbmRlcihcbiAgICAgICAgICAgICAgICAgICAgJ19kZWZhdWx0LicgKyB0aGlzLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIG1vZGVsKS50aGVuKChpbkh0bWwpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgJCh0aGlzLm5vZGUpLmh0bWwoaW5IdG1sKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFmdGVyUmVuZGVyICYmIHRoaXMuYWZ0ZXJSZW5kZXIoKTsgLy9qc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgICAgICAgICAgICAgICAgLy9jb25zdCBtdXRhdGlvbk9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1pY3JvdGFzaygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAubGlmZWN5Y2xlU2lnbmFsLmRpc3BhdGNoKCdyZW5kZXJlZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgbXV0YXRpb25PYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vfSk7XG4gICAgICAgICAgICAgICAgICAgIC8vbXV0YXRpb25PYnNlcnZlci5vYnNlcnZlKCQodGhpcy5ub2RlKS5nZXQoMCksIHtjaGlsZExpc3QgOiB0cnVlfSk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKGluRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihpbkVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGluRXJyb3IpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pO1xuXG4gICAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IENvbXBvbmVudDtcbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IGlzQXJyYXkgZnJvbSAnbG9kYXNoLmlzQXJyYXknO1xuaW1wb3J0IG1lcmdlIGZyb20gJ2xvZGFzaC5tZXJnZSc7XG5pbXBvcnQgbWVyZ2VXaXRoIGZyb20gJ2xvZGFzaC5tZXJnZVdpdGgnO1xuaW1wb3J0IHBhZ2VGYWN0b3J5IGZyb20gJy4vcGFnZS1mYWN0b3J5JztcbmxldCBfY29uZmlnLCBfbW9kZWwsIF9jb25zdHJ1Y3RvckZuO1xuXG5jbGFzcyBNYXN0ZXJQYWdlIHtcblxuICAgIGNvbnN0cnVjdG9yKGluQ29uZmlnLCBpbk1vZGVsLCBpbkNvbnN0cnVjdG9yRm4pIHtcbiAgICAgICAgX2NvbmZpZyA9IGluQ29uZmlnO1xuICAgICAgICBfbW9kZWwgPSBpbk1vZGVsO1xuICAgICAgICBfY29uc3RydWN0b3JGbiA9IGluQ29uc3RydWN0b3JGbjtcbiAgICB9XG5cbiAgICBjcmVhdGUoaW5Db25maWcsIGluTW9kZWwsIGluQ29uc3RydWN0b3JGbikge1xuICAgICAgICAvL1RPRE86IG1lcmdlIHBhcmFtcyB3aXRoIHRlbXBsYXRlIHBhcmFtcy4gd3JhcCBjb25zdHJ1Y3RvclxuXG4gICAgICAgIGZ1bmN0aW9uIGN1c3RvbWl6ZXIob2JqVmFsdWUsIHNyY1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAoaXNBcnJheShvYmpWYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqVmFsdWUuY29uY2F0KHNyY1ZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IHt9O1xuICAgICAgICBtZXJnZVdpdGgoY29uZmlnLCBfY29uZmlnLCBpbkNvbmZpZywgY3VzdG9taXplcik7XG5cbiAgICAgICAgLy8gY29uc3QgbW9kZWwgPSB7fTtcbiAgICAgICAgLy8gbWVyZ2UobW9kZWwsIF9tb2RlbCwgaW5Nb2RlbCk7XG5cbiAgICAgICAgY29uc3QgY29uc3RydWN0b3JGbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgX2NvbnN0cnVjdG9yRm4uY2FsbCh0aGlzLCBjb25maWcpO1xuICAgICAgICAgICAgaW5Db25zdHJ1Y3RvckZuLmNhbGwodGhpcyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHBhZ2VGYWN0b3J5LnBhZ2UoY29uZmlnLCBpbk1vZGVsLCBjb25zdHJ1Y3RvckZuKTtcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1hc3RlclBhZ2U7XG4iXSwibmFtZXMiOlsiX3ByaXZhdGUiLCJPYnNlcnZlciIsIlNpZ25hbCIsIl9zZXR1cE1vZGVsIiwiX2ZpbmRTdGF0ZSIsIl93YXRjaFN0YXRlIiwiZmFjdG9yeSIsIkNvbXBvbmVudCIsImVhY2giLCJfcGFnZSIsImFjdGlvbiIsInJlbmRlciIsImFlQnV0dG9uIiwiJCIsImF0dGFjaEFjdGlvbiIsIkVsZW1lbnRIVE1MV2lyaW5nIiwiYWVMaW5rIiwiYWVJbnB1dCIsImFlUmVuZGVyZWQiLCJhZVJlbmRlciIsImFlQmluZCIsImFlQWN0aW9uIiwiYWVTdGF0ZSIsImFlRWFjaCIsImFlTWFuYWdlZCIsInJlZ2lzdGVyQWVFbGVtZW50IiwiaXNGdW5jdGlvbiIsIl9jb25maWciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUEsSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDOztBQUVsQixJQUFJLEtBQUs7SUFBRSxRQUFRO0FBRW5CLElBQUksSUFBSSxDQUFDLE9BQU8sSUFBSSxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLFVBQVUsRUFBRTs7SUFFN0QsSUFBSSxJQUFJLENBQUMsWUFBWSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFO1FBQ3RFLEtBQUssR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO0tBQzdCLE1BQU07UUFDSCxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUM7S0FDakM7Q0FDSixNQUFNLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxLQUFLLFVBQVUsRUFBRTtJQUNqRSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUM7Q0FDaEMsTUFBTSxJQUFJLElBQUksQ0FBQyxLQUFLLElBQUksT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksS0FBSyxVQUFVLEVBQUU7SUFDcEUsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxD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