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
var includes = _interopDefault(require('lodash.includes'));
var transform = _interopDefault(require('lodash.transform'));
var uuid = _interopDefault(require('node-uuid'));
var keycode = _interopDefault(require('keycode'));
var LiteUrl = _interopDefault(require('lite-url'));
var dust = _interopDefault(require('ae-dustjs'));
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
        if (!this.signals[inName]) {
            this.signals[inName] = new signals.Signal();
        }
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
        if(isPlainObject(inModelInitObj)) {
            _p.model = new ComponentModel(inModelInitObj);
        } else if(inModelInitObj instanceof ComponentModel) {
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

    constructor(inConfig, inInitObj, inConstructor, inPage) {
        const lifecycleSignal = new signals.Signal();
        const lifecycle = new ComponentLifecycle(lifecycleSignal);
        this.microtask = microtask;
        _private$5.set(this, {
            stateWatchers: new Set(),
            lifecycleSignal: lifecycleSignal,
            stateInfo: new ObservableObject()
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
        this.page = inPage;
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
        if(this.page === this) {
            return;
        }
        return this.page.resolveNodeComponent($(this.node).parent());
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
                const mutationObserver = new MutationObserver(() => {
                    _private$5.get(this)
                        .lifecycleSignal.dispatch('rendered');
                        mutationObserver.disconnect();
                });
                mutationObserver.observe($(this.node).get(0), {childList : true});
            }).catch((inError) => {
                console.error(inError);
            });
        }
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
                    inHandler(inChanges.newValue, inChanges.oldValue);
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

var Element = (function() {
    var proto = Object.create(window.HTMLElement.prototype);
    return document.registerElement('ae-element', { prototype: proto });
})();

function action(inPage) {
    const _page = inPage;

    var proto = Object.create(Element.prototype);

    proto.createdCallback = function() {

    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-managed', { prototype: proto });
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

function aeButton(inPage) {
    const _page = inPage;
    let observer;

    var proto = Object.create(HTMLButtonElement.prototype);
    proto.createdCallback = function() {
        $(this).prop('type', 'button');
        observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                switch (mutation.attributeName) {
                    case 'label':
                        $(mutation.target).text($(mutation.target).attr('label'));
                        break;
                }
            });
        });
        // configuration of the observer:
        var config = { attributes: true };

        // pass in the target node, as well as the observer options
        observer.observe(this, config);


        if ($(this).attr('bind-label')) {
            const path = $(this).attr('bind-label');
            const source = $(this).attr('source');

            _page
                .getDataSource(source)
                .bindPath(this, path, (inNewValue) => {
                    $(this).text(inNewValue);
                });
            _page
                .getDataSource(source)
                .resolve(this, path)
                .then((inValue) => {
                    $(this).text(inValue);
                });
        }

        if ($(this).attr('bind-enabled')) {
            let path = $(this).attr('bind-enabled');
            let strictBoolean = false;
            if(/!$/.test(path)) {
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
        if ($(this).attr('label')) {
            $(this).html($(this).attr('label'));
        }

    };

    proto.detachedCallback = function() {
        observer.disconnect();
    };

    document.registerElement('ae-button', { prototype: proto, extends : 'button'});
}

function each$1(inPage) {
    const _page = inPage;
    const _private = new WeakMap();
    const _templatingDelegate = pageFactory.getTemplatingDelegate();

    var proto = Object.create(Element.prototype);

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
    var proto = Object.create(Element.prototype);

    proto.createdCallback = function() {
        const component = _page.resolveNodeComponent(this);
        const method = $(this).attr('method') || 'removal';
        const statePattern = new RegExp($(this).attr('pattern') || '^$');
        const watcher = () => {
            $(this).prop('willRender', false);
            const currentState = component.getCurrentState();
            if (statePattern.test(currentState.getPath())) {
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

    var proto = Object.create(Element.prototype);

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

    var proto = Object.create(Element.prototype);

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
                    conditionMet = conditionMet && !negate;
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

function render(inPage) {
    'use strict';
    const _private = new WeakMap();
    const _page = inPage;
    var proto = Object.create(Element.prototype);

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
                .render(templateName, inValue || {})
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
        _private.set(this, { willRender: false });
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
    var proto = Object.create(Element.prototype);
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

    aeButton(inPage);
    action(inPage);
    each$1(inPage);
    state(inPage);
    action$1(inPage);
    bind(inPage);
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
        _config = inConfig;
        parseUrl.call(this);
        this.mountPoint = inConfig.mountPoint || 'body';
        this.addDataSource('model', modelDataSource(this));
        inConstructor.bind(this)();
        this.page = this;
        callNextInitializer.call(this);
    }

    startupParam(inParamName) {
        return _private$4.get(this).startupParams[inParamName];
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
            if(/^#action:/.test(window.location.hash)) {
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

            for (let injector of _componentInjectors) {
                injector.call(that, component);
            }
            _private$4.get(component)
                .lifecycleSignal.dispatch('element-created');
        };

        proto.attachedCallback = function() {
            const component = _registry.get(this);
            if ($(this).attr('from')) {
                var model = that.resolveNodeModel($(this).parent());
                component.model.prop('data', model.prop('data.' + $(this).attr('from')));
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
                if(inBase.isCollection && inPath === 'length') {
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

    render(inTemplateName, inModel) {
        const template = _templates.get(inTemplateName);
        if (!template) {
            return Promise.reject(`DustTemplatingDelegate: Template with name ${inTemplateName} not found`);
        }
        var promise = new Promise((resolve, reject) => {
            dust.render(template, inModel, (inError, inHtml) => {
                if (inError) {
                    reject(inError);
                } else {
                    resolve(inHtml);
                }
            });
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
        if(isPlainObject(inModelInitObj)) {
            _p.model = new ComponentModel(inModelInitObj);
        } else if(inModelInitObj instanceof ComponentModel) {
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

    constructor(inConfig, inInitObj, inConstructor, inPage) {
        const lifecycleSignal = new signals.Signal();
        const lifecycle = new ComponentLifecycle(lifecycleSignal);
        this.microtask = microtask;
        _private.set(this, {
            stateWatchers: new Set(),
            lifecycleSignal: lifecycleSignal,
            stateInfo: new ObservableObject()
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
        this.page = inPage;
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
        if(this.page === this) {
            return;
        }
        return this.page.resolveNodeComponent($(this.node).parent());
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
                const mutationObserver = new MutationObserver(() => {
                    _private.get(this)
                        .lifecycleSignal.dispatch('rendered');
                        mutationObserver.disconnect();
                });
                mutationObserver.observe($(this.node).get(0), {childList : true});
            }).catch((inError) => {
                console.error(inError);
            });
        }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9taWNyb3Rhc2suanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvT2JzZXJ2ZXIuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvT2JzZXJ2YWJsZU9iamVjdC5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9Db21wb25lbnRNb2RlbC5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9TdGF0ZS5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9CdXMuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvQ29tcG9uZW50TGlmZWN5Y2xlLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL3V0aWwvcHJpdmF0ZS5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9jb21wb25lbnQuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvZGF0YXNvdXJjZS9tb2RlbC1kYXRhc291cmNlLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2xhbmcvYWUtZWxlbWVudC5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9sYW5nL2FlLW1hbmFnZWQuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvc3ltYm9sL3VucmVzb2x2ZWQuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvdXRpbC90eXBpZnktcGFyYW1ldGVycy5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9kZWxlZ2F0ZS9hY3Rpb24tdHJpZ2dlci1kZWxlZ2F0ZS5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9sYW5nL2FlLWJ1dHRvbi5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9sYW5nL2FlLWVhY2guanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvbGFuZy9hZS1zdGF0ZS5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9sYW5nL2FlLWFjdGlvbi5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9kZWxlZ2F0ZS92YWx1ZS1jaGFuZ2UtZGVsZWdhdGUuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvbGFuZy9hZS1iaW5kLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2xhbmcvYWUtcmVuZGVyLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2xhbmcvYWUtc3dpdGNoLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2xhbmcvYWUtaW5wdXQuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvbGFuZy9hZS1pbnB1dDIuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvbGFuZy9hZS1saW5rLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2xhbmcvYWUtbGFuZy5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9QYWdlLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2RlbGVnYXRlL1RlbXBsYXRpbmdEZWxlZ2F0ZS5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9kZWxlZ2F0ZS9kdXN0LWhlbHBlcnMuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvZGVsZWdhdGUvZHVzdC10ZW1wbGF0aW5nLWRlbGVnYXRlLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL3BhZ2UtZmFjdG9yeS5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9Db21wb25lbnQuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvTWFzdGVyUGFnZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciByb290ID0gd2luZG93O1xuXG52YXIgZGVmZXIsIE9ic2VydmVyO1xuXG5pZiAocm9vdC5wcm9jZXNzICYmIHR5cGVvZiByb290LnByb2Nlc3MubmV4dFRpY2sgPT09ICdmdW5jdGlvbicpIHtcbiAgICAvKiBhdm9pZCBidWdneSBub2RlanMgc2V0SW1tZWRpYXRlICovXG4gICAgaWYgKHJvb3Quc2V0SW1tZWRpYXRlICYmIHJvb3QucHJvY2Vzcy52ZXJzaW9ucy5ub2RlLnNwbGl0KCcuJylbMV0gPiAnMTAnKSB7XG4gICAgICAgIGRlZmVyID0gcm9vdC5zZXRJbW1lZGlhdGU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZGVmZXIgPSByb290LnByb2Nlc3MubmV4dFRpY2s7XG4gICAgfVxufSBlbHNlIGlmIChyb290LnZlcnR4ICYmIHR5cGVvZiByb290LnZlcnR4LnJ1bk9uTG9vcCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGRlZmVyID0gcm9vdC52ZXJ0eC5SdW5Pbkxvb3A7XG59IGVsc2UgaWYgKHJvb3QudmVydHggJiYgdHlwZW9mIHJvb3QudmVydHgucnVuT25Db250ZXh0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgZGVmZXIgPSByb290LnZlcnR4LnJ1bk9uQ29udGV4dDtcbn0gZWxzZSBpZiAoKE9ic2VydmVyID0gcm9vdC5NdXRhdGlvbk9ic2VydmVyIHx8IHJvb3QuV2ViS2l0TXV0YXRpb25PYnNlcnZlcikpIHtcbiAgICBkZWZlciA9IChmdW5jdGlvbihkb2N1bWVudCwgT2JzZXJ2ZXIsIGRyYWluKSB7XG4gICAgICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBuZXcgT2JzZXJ2ZXIoZHJhaW4pLm9ic2VydmUoZWwsIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGVsLnNldEF0dHJpYnV0ZSgneCcsICd5Jyk7XG4gICAgICAgIH07XG4gICAgfShkb2N1bWVudCwgT2JzZXJ2ZXIsIGRyYWluKSk7XG59IGVsc2UgaWYgKHR5cGVvZiByb290LnNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicgJiYgKHJvb3QuQWN0aXZlWE9iamVjdCB8fCAhcm9vdC5wb3N0TWVzc2FnZSkpIHtcbiAgICAvKiB1c2Ugc2V0VGltZW91dCB0byBhdm9pZCBidWdneSBJRSBNZXNzYWdlQ2hhbm5lbCAqL1xuICAgIGRlZmVyID0gZnVuY3Rpb24oZikge1xuICAgICAgICByb290LnNldFRpbWVvdXQoZiwgMCk7XG4gICAgfTtcbn0gZWxzZSBpZiAocm9vdC5NZXNzYWdlQ2hhbm5lbCAmJiB0eXBlb2Ygcm9vdC5NZXNzYWdlQ2hhbm5lbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHZhciBmaWZvID0gW10sXG4gICAgICAgIGNoYW5uZWwgPSBuZXcgcm9vdC5NZXNzYWdlQ2hhbm5lbCgpO1xuICAgIGNoYW5uZWwucG9ydDEub25tZXNzYWdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIChmaWZvLnNoaWZ0KCkpKCk7XG4gICAgfTtcbiAgICBkZWZlciA9IGZ1bmN0aW9uKGYpIHtcbiAgICAgICAgZmlmb1tmaWZvLmxlbmd0aF0gPSBmO1xuICAgICAgICBjaGFubmVsLnBvcnQyLnBvc3RNZXNzYWdlKDApO1xuICAgIH07XG59IGVsc2UgaWYgKHR5cGVvZiByb290LnNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICBkZWZlciA9IGZ1bmN0aW9uKGYpIHtcbiAgICAgICAgcm9vdC5zZXRUaW1lb3V0KGYsIDApO1xuICAgIH07XG59IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcignbm8gY2FuZGlkYXRlIGZvciBkZWZlcicpO1xufVxuXG5sZXQgcXVldWUgPSBbXSxcbiAgICBsZW5ndGggPSAwOyAvL2pzaGludCBpZ25vcmU6bGluZVxuXG5mdW5jdGlvbiBtaWNyb3Rhc2soZnVuYywgYXJncywgY3R4LCBlcnIpIHtcbiAgICBpZiAoIWxlbmd0aCkge1xuICAgICAgICBkZWZlcihkcmFpbik7XG4gICAgfVxuXG4gICAgcXVldWVbbGVuZ3RoKytdID0gW2Z1bmMsIGFyZ3MsIGN0eCwgZXJyXTtcbn1cblxuZnVuY3Rpb24gZHJhaW4oKSB7XG4gICAgdmFyIHEgPSBxdWV1ZSxcbiAgICAgICAgbCA9IGxlbmd0aDtcblxuICAgIHF1ZXVlID0gW107XG4gICAgbGVuZ3RoID0gMDtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBxW2ldWzBdLmFwcGx5KHFbaV1bMl0sIHFbaV1bMV0pO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcVtpXVszXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHFbaV1bM10oZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IG1pY3JvdGFzaztcbiIsIid1c2Ugc3RyaWN0JztcbmltcG9ydCBtaWNyb3Rhc2sgZnJvbSAnLi9taWNyb3Rhc2snO1xuXG5jb25zdCBfcXVldWUgPSBuZXcgTWFwKCk7XG5pbXBvcnQgaGFzIGZyb20gJ2xvZGFzaC5oYXMnO1xuaW1wb3J0IGZpbmQgZnJvbSAnbG9kYXNoLmZpbmQnO1xuaW1wb3J0IGVhY2ggZnJvbSAnbG9kYXNoLmZvcmVhY2gnO1xubGV0IF93aWxsTm90aWZ5ID0gZmFsc2U7XG5cbmNvbnN0IF9wcml2YXRlID0gbmV3IFdlYWtNYXAoKTtcblxuY29uc3QgX2VtaXQgPSBmdW5jdGlvbigpIHtcbiAgICBmb3IgKGxldCBmIG9mIF9xdWV1ZS5rZXlzKCkpIHtcbiAgICAgICAgbGV0IGluZm8gPSBfcXVldWUuZ2V0KGYpO1xuICAgICAgICBmb3IgKGxldCBpIG9mIGluZm8pIHtcbiAgICAgICAgICAgIGYoaS5wYXRoLCBpLmNoYW5nZXMpO1xuICAgICAgICB9XG4gICAgfVxuICAgIF9xdWV1ZS5jbGVhcigpO1xuICAgIF93aWxsTm90aWZ5ID0gZmFsc2U7XG59O1xuXG5jbGFzcyBPYnNlcnZlciB7XG4gICAgY29uc3RydWN0b3IoaW5QYXJlbnQpIHtcbiAgICAgICAgX3ByaXZhdGUuc2V0KHRoaXMsIHtcbiAgICAgICAgICAgIHBhcmVudDogaW5QYXJlbnQsXG4gICAgICAgICAgICBsaXN0ZW5lcnM6IG5ldyBTZXQoKSxcbiAgICAgICAgICAgIGNoaWxkcmVuTGlzdGVuZXJzOiBuZXcgU2V0KCksXG4gICAgICAgICAgICBkZXNjZW5kYW50TGlzdGVuZXJzOiBuZXcgU2V0KCksXG4gICAgICAgICAgICBjaGlsZHJlbjoge31cbiAgICAgICAgfSk7XG4gICAgfVxuXG5cbiAgICB1bmxpc3Rlbihpbkxpc3RlbmVyRm4sIGluUGF0aCkge1xuICAgICAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcbiAgICAgICAgZm9yKGxldCBsaXN0ZW5lciBvZiBfcC5saXN0ZW5lcnMpIHtcbiAgICAgICAgICAgIGlmKGxpc3RlbmVyLmhhbmRsZXIgPT09IGluTGlzdGVuZXJGbikge1xuICAgICAgICAgICAgICAgIF9wLmxpc3RlbmVycy5kZWxldGUobGlzdGVuZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZvcihsZXQgbGlzdGVuZXIgb2YgX3AuY2hpbGRyZW5MaXN0ZW5lcnMpIHtcbiAgICAgICAgICAgIGlmKGxpc3RlbmVyLmhhbmRsZXIgPT09IGluTGlzdGVuZXJGbikge1xuICAgICAgICAgICAgICAgIF9wLmNoaWxkcmVuTGlzdGVuZXJzLmRlbGV0ZShsaXN0ZW5lcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yKGxldCBsaXN0ZW5lciBvZiBfcC5kZXNjZW5kYW50TGlzdGVuZXJzKSB7XG4gICAgICAgICAgICBpZihsaXN0ZW5lci5oYW5kbGVyID09PSBpbkxpc3RlbmVyRm4pIHtcbiAgICAgICAgICAgICAgICBfcC5kZXNjZW5kYW50TGlzdGVuZXJzLmRlbGV0ZShsaXN0ZW5lcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWFjaChfcC5jaGlsZHJlbiwgKGluQ2hpbGRPYnNlcnZlcikgPT4ge1xuICAgICAgICAgICAgaW5DaGlsZE9ic2VydmVyLnVubGlzdGVuKGluTGlzdGVuZXJGbiwgaW5QYXRoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgaGFzTGlzdGVuZXJzKCkge1xuICAgICAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcbiAgICAgICAgcmV0dXJuIF9wLmxpc3RlbmVycy5zaXplID4gMCB8fCBfcC5jaGlsZHJlbkxpc3RlbmVycy5zaXplID4gMCB8fCBfcC5kZXNjZW5kYW50TGlzdGVuZXJzLnNpemUgPiAwO1xuICAgIH1cblxuICAgIGxpc3RlbihpblBhdGgsIGluTGlzdGVuZXIpIHtcbiAgICAgICAgaWYgKCFpblBhdGgpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcbiAgICAgICAgY29uc3Qgc2VncyA9IGluUGF0aCA/IGluUGF0aC5zcGxpdCgnLicpIDogW107XG4gICAgICAgIGNvbnN0IHByb3BOYW1lID0gc2Vncy5zaGlmdCgpO1xuICAgICAgICBpZiAoL15cXHcrJC8udGVzdChwcm9wTmFtZSkpIHtcbiAgICAgICAgICAgIF9wLmNoaWxkcmVuW3Byb3BOYW1lXSA9IF9wLmNoaWxkcmVuW3Byb3BOYW1lXSB8fCBuZXcgT2JzZXJ2ZXIodGhpcyk7XG4gICAgICAgICAgICBpZiAoc2Vncy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBfcC5jaGlsZHJlbltwcm9wTmFtZV0ubGlzdGVuKHNlZ3Muam9pbignLicpLCBpbkxpc3RlbmVyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgX3AubGlzdGVuZXJzLmFkZCh7IGhhbmRsZXIgOiBmdW5jdGlvbihpbk5vdGlmaWVkUGF0aCwgaW5DaGFuZ2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbk5vdGlmaWVkUGF0aCA9PT0gaW5QYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbkxpc3RlbmVyKGluTm90aWZpZWRQYXRoLCBpbkNoYW5nZXMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfX0pO1xuICAgICAgICAgICAgICAgIF9wcml2YXRlLmdldChfcC5jaGlsZHJlbltwcm9wTmFtZV0pLmxpc3RlbmVycy5hZGQoeyBoYW5kbGVyIDogaW5MaXN0ZW5lcn0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHByb3BOYW1lID09PSAnKicpIHtcbiAgICAgICAgICAgIC8vX3AuY2hpbGRyZW5MaXN0ZW5lcnMuYWRkKGluTGlzdGVuZXIpO1xuICAgICAgICAgICAgX3AubGlzdGVuZXJzLmFkZCh7aGFuZGxlciA6IGluTGlzdGVuZXJ9KTtcblxuICAgICAgICB9IGVsc2UgaWYgKHByb3BOYW1lID09PSAnKionKSB7XG4gICAgICAgICAgICBfcC5kZXNjZW5kYW50TGlzdGVuZXJzLmFkZCh7aGFuZGxlciA6IGluTGlzdGVuZXJ9KTtcbiAgICAgICAgICAgIC8vIF9wLmxpc3RlbmVycy5hZGQoaW5MaXN0ZW5lcik7XG4gICAgICAgIH0gZWxzZSBpZiggL1xcW1xcdytcXF0vLnRlc3QocHJvcE5hbWUpKSB7XG4gICAgICAgICAgICBfcC5saXN0ZW5lcnMuYWRkKHtoYW5kbGVyIDogKGluUGF0aCwgaW5DaGFuZ2VzKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYoaW5QYXRoID09PSBwcm9wTmFtZS5yZXBsYWNlKC9cXFcvZywgJycpKSB7XG4gICAgICAgICAgICAgICAgICAgIGluTGlzdGVuZXIoaW5QYXRoLCBpbkNoYW5nZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH19KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG5vdGlmeShpblBhdGgsIGluQ2hhbmdlcykge1xuICAgICAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcbiAgICAgICAgY29uc3Qgc2VncyA9IGluUGF0aCA/IGluUGF0aC5zcGxpdCgnLicpIDogW107XG4gICAgICAgIGNvbnN0IHByb3BOYW1lID0gc2Vncy5zaGlmdCgpO1xuICAgICAgICBsZXQgc2hvdWxkVHJpZ2dlciA9IGZhbHNlO1xuICAgICAgICBjb25zdCBwdXNoUXVldWUgPSBmdW5jdGlvbihmbikge1xuICAgICAgICAgICAgaWYgKCFfcXVldWUuaGFzKGZuKSkge1xuICAgICAgICAgICAgICAgIF9xdWV1ZS5zZXQoZm4sIFtdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKGZpbmQoX3F1ZXVlLmdldChmbiksIHsgcGF0aCA6IGluUGF0aH0pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX3F1ZXVlLmdldChmbikucHVzaCh7IHBhdGg6IGluUGF0aCwgY2hhbmdlczogaW5DaGFuZ2VzIH0pO1xuICAgICAgICB9O1xuICAgICAgICBpZiAocHJvcE5hbWUpIHtcbiAgICAgICAgICAgIGlmIChoYXMoX3AuY2hpbGRyZW4sIHByb3BOYW1lKSAmJiBzZWdzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIF9wLmNoaWxkcmVuW3Byb3BOYW1lXS5ub3RpZnkoc2Vncy5qb2luKCcuJyksIGluQ2hhbmdlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXNlZ3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgc2hvdWxkVHJpZ2dlciA9IHNob3VsZFRyaWdnZXIgfHwgX3AubGlzdGVuZXJzLnNpemU7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbCBvZiBfcC5saXN0ZW5lcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgcHVzaFF1ZXVlKGwuaGFuZGxlcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2hvdWxkVHJpZ2dlciA9IHNob3VsZFRyaWdnZXIgfHwgX3AuY2hpbGRyZW5MaXN0ZW5lcnMuc2l6ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGwgb2YgX3AuY2hpbGRyZW5MaXN0ZW5lcnMpIHtcbiAgICAgICAgICAgICAgICBwdXNoUXVldWUobC5oYW5kbGVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNob3VsZFRyaWdnZXIgPSBzaG91bGRUcmlnZ2VyIHx8IF9wLmRlc2NlbmRhbnRMaXN0ZW5lcnMuc2l6ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGwgb2YgX3AuZGVzY2VuZGFudExpc3RlbmVycykge1xuICAgICAgICAgICAgICAgIHB1c2hRdWV1ZShsLmhhbmRsZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2hvdWxkVHJpZ2dlciA9IHNob3VsZFRyaWdnZXIgfHwgX3AubGlzdGVuZXJzLnNpemU7XG4gICAgICAgICAgICBmb3IgKGxldCBsIG9mIF9wLmxpc3RlbmVycykge1xuICAgICAgICAgICAgICAgIHB1c2hRdWV1ZShsLmhhbmRsZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFfd2lsbE5vdGlmeSAmJiBzaG91bGRUcmlnZ2VyKSB7XG4gICAgICAgICAgICBtaWNyb3Rhc2soX2VtaXQsIFtpblBhdGgsIGluQ2hhbmdlc10pO1xuICAgICAgICAgICAgX3dpbGxOb3RpZnkgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBidWJibGUocGF0aCwgY2hhbmdlcykge1xuXG4gICAgfVxuXG4gICAgc3RhdGljIHRhcmdldChiYXNlLCBwYXRoLCBjaGFuZ2VzKSB7XG5cbiAgICB9XG59XG5leHBvcnQgZGVmYXVsdCBPYnNlcnZlcjtcbiIsIid1c2Ugc3RyaWN0JztcbmltcG9ydCBPYnNlcnZlciBmcm9tICcuL09ic2VydmVyJztcbmltcG9ydCBpc1BsYWluT2JqZWN0IGZyb20gJ2xvZGFzaC5pc1BsYWluT2JqZWN0JztcbmltcG9ydCBrZXlzIGZyb20gJ2xvZGFzaC5rZXlzJztcbmltcG9ydCBlYWNoIGZyb20gJ2xvZGFzaC5mb3JlYWNoJztcbmltcG9ydCBpc1N0cmluZyBmcm9tICdsb2Rhc2guaXNTdHJpbmcnO1xuaW1wb3J0IGdldCBmcm9tICdsb2Rhc2guZ2V0JztcbmltcG9ydCBpc0FycmF5IGZyb20gJ2xvZGFzaC5pc0FycmF5JztcblxuXG5jb25zdCBfcHJpdmF0ZSA9IG5ldyBXZWFrTWFwKCk7XG5cblxuY2xhc3MgRHVtbXkge1xuICAgIGNvbnN0cnVjdG9yKGluSXNDb2xsZWN0aW9uKSB7XG4gICAgICAgIHRoaXMuX29iaiA9IGluSXNDb2xsZWN0aW9uID8gW10gOiB7fTtcbiAgICAgICAgX3ByaXZhdGUuc2V0KHRoaXMsIHtcblxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcHJvcChpbk5hbWUsIGluVmFsdWUpIHtcbiAgICAgICAgaWYgKGluVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5fb2JqW2luTmFtZV0gPSBpblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX29ialtpbk5hbWVdO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jbGFzcyBPYnNlcnZhYmxlT2JqZWN0IHtcblxuICAgIGNvbnN0cnVjdG9yKGluQ29uZmlnKSB7XG4gICAgICAgIGNvbnN0IGlzQ29sbGVjdGlvbiA9IChnZXQoaW5Db25maWcsICdpc0NvbGxlY3Rpb24nKSA9PT0gdHJ1ZSk7XG4gICAgICAgIF9wcml2YXRlLnNldCh0aGlzLCB7XG4gICAgICAgICAgICBpc1NpbGVudDogZmFsc2UsXG4gICAgICAgICAgICBpc0NvbGxlY3Rpb246IGlzQ29sbGVjdGlvbixcbiAgICAgICAgICAgIGNoYW5nZXNRdWV1ZTogW10sXG4gICAgICAgICAgICBvYnNlcnZlcjogbmV3IE9ic2VydmVyKCksXG4gICAgICAgICAgICBwcm9wczogbmV3IER1bW15KGlzQ29sbGVjdGlvbiksXG4gICAgICAgICAgICBzZXRQcm9wOiBmdW5jdGlvbihpblBhdGgsIGluVmFsdWUsIGluQmFja1BhdGgsIGluQWxyZWFkeUZvdW5kQ2hhbmdlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgX3AgPSBfcHJpdmF0ZS5nZXQodGhpcyk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwYXRoID0gIWlzTmFOKGluUGF0aCkgPyBbaW5QYXRoXSA6IGluUGF0aC5zcGxpdCgnLicpO1xuICAgICAgICAgICAgICAgIHZhciBsb2NhbFByb3AgPSBwYXRoLnNoaWZ0KCk7XG5cbiAgICAgICAgICAgICAgICBpbkJhY2tQYXRoID0gaW5CYWNrUGF0aCB8fCBbXTtcbiAgICAgICAgICAgICAgICBpbkJhY2tQYXRoLnB1c2gobG9jYWxQcm9wKTtcbiAgICAgICAgICAgICAgICBsZXQgb3V0O1xuXG4gICAgICAgICAgICAgICAgbGV0IHZhbCA9IF9wLnByb3BzLnByb3AobG9jYWxQcm9wKTtcblxuICAgICAgICAgICAgICAgIGlmICghcGF0aC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgX3AucHJvcHMucHJvcChsb2NhbFByb3AsIE9ic2VydmFibGVPYmplY3QuZnJvbU9iamVjdChpblZhbHVlKSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChfcC5vYnNlcnZlci5oYXNMaXN0ZW5lcnMoKSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBfcC5jaGFuZ2VzUXVldWUucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogbG9jYWxQcm9wLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiB2YWwgPT09IHVuZGVmaW5lZCA/ICdhZGQnIDogJ3JlcGxhY2UnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogdmFsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdWYWx1ZTogX3AucHJvcHMucHJvcChsb2NhbFByb3ApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIE9ic2VydmFibGVPYmplY3Qubm90aWZ5V2F0Y2hlcnMoX3ApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpbkFscmVhZHlGb3VuZENoYW5nZSA/IG51bGwgOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiBpbkJhY2tQYXRoLmpvaW4oJy4nKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IHZhbCA9PT0gdW5kZWZpbmVkID8gJ2FkZCcgOiAncmVwbGFjZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IHZhbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdWYWx1ZTogX3AucHJvcHMucHJvcChsb2NhbFByb3ApXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGFscmVhZHlGb3VuZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBpZiAodmFsID09PSB1bmRlZmluZWQgfHwgdmFsID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWwgPSBuZXcgT2JzZXJ2YWJsZU9iamVjdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgX3AucHJvcHMucHJvcChsb2NhbFByb3AsIHZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBfcC5jaGFuZ2VzUXVldWUucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogcGF0aC5qb2luKCcuJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhZGQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdWYWx1ZTogX3AucHJvcHMucHJvcChsb2NhbFByb3ApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIE9ic2VydmFibGVPYmplY3Qubm90aWZ5V2F0Y2hlcnMoX3ApO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3V0ID0gaW5BbHJlYWR5Rm91bmRDaGFuZ2UgPyBudWxsIDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IGluQmFja1BhdGguam9pbignLicpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYWRkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsdWU6IF9wLnByb3BzLnByb3AobG9jYWxQcm9wKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICBhbHJlYWR5Rm91bmQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGxldCByZXN1bHQgPSBfcHJpdmF0ZS5nZXQodmFsKS5zZXRQcm9wKHBhdGguam9pbignLicpLCBpblZhbHVlLCBpbkJhY2tQYXRoLCBhbHJlYWR5Rm91bmQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gKHJlc3VsdCA/IHJlc3VsdCA6IG91dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpXG4gICAgICAgIH0pO1xuXG4gICAgfVxuXG4gICAgKiBbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICAgICAgY29uc3Qgc3JjID0gX3ByaXZhdGUuZ2V0KHRoaXMpLnByb3BzLl9vYmo7XG4gICAgICAgIGlmICh0aGlzLmlzQ29sbGVjdGlvbikge1xuICAgICAgICAgICAgZm9yICh2YXIgaXRlbSBvZiBzcmMpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yIChsZXQga2V5IGluIHNyYykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG91dCA9IHt9O1xuICAgICAgICAgICAgICAgIG91dFtrZXldID0gc3JjW2tleV07XG4gICAgICAgICAgICAgICAgeWllbGQgb3V0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICBmaWxsKGluRGF0YSwgaW5QYXRoLCBpblNpbGVudCkge1xuICAgICAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcbiAgICAgICAgaWYgKCFpblBhdGgpIHtcbiAgICAgICAgICAgIF9wLnByb3BzLl9vYmogPSB0aGlzLmlzQ29sbGVjdGlvbiA/IFtdIDoge307XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5wcm9wKGluUGF0aCkgaW5zdGFuY2VvZiBPYnNlcnZhYmxlT2JqZWN0KSB7XG4gICAgICAgICAgICB0aGlzLnByb3AoaW5QYXRoKS5lbXB0eSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGtleXMoaW5EYXRhKS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMubWVyZ2UoaW5EYXRhLCBpblBhdGgsIGluU2lsZW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICghaW5TaWxlbnQpIHtcbiAgICAgICAgICAgICAgICBfcC5jaGFuZ2VzUXVldWUucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIHBhdGg6ICcnLFxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdlbXB0aWVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbHVlOiBfcC5wcm9wcy5fb2JqXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBPYnNlcnZhYmxlT2JqZWN0Lm5vdGlmeVdhdGNoZXJzKF9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICB9XG5cbiAgICBtZXJnZShpbkRhdGEsIGluUGF0aCwgaW5TaWxlbnQpIHtcblxuICAgICAgICBpZiAoIWlzUGxhaW5PYmplY3QoaW5EYXRhKSAmJiAhaXNBcnJheShpbkRhdGEpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ09ic2VydmFibGVPYmplY3QuZmlsbCgpIG11c3QgYmUgcGFzc2VkIGEgcGxhaW4gb2JqZWN0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgZWFjaChpbkRhdGEsIChpblZhbHVlLCBpbktleSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IChpblBhdGggPyBpblBhdGggKyAnLicgOiAnJykgKyBpbktleTtcbiAgICAgICAgICAgIHRoaXMucHJvcChwYXRoLCBPYnNlcnZhYmxlT2JqZWN0LmZyb21PYmplY3QoaW5WYWx1ZSksIGluU2lsZW50KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgc3RhdGljIGZyb21PYmplY3QoaW5EYXRhKSB7XG4gICAgICAgIGlmIChpc0FycmF5KGluRGF0YSkpIHtcbiAgICAgICAgICAgIGxldCBhID0gbmV3IE9ic2VydmFibGVPYmplY3Qoe1xuICAgICAgICAgICAgICAgIGlzQ29sbGVjdGlvbjogdHJ1ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBlYWNoKGluRGF0YSwgZnVuY3Rpb24oaW5WYWwsIGluS2V5KSB7XG4gICAgICAgICAgICAgICAgYS5wcm9wKGluS2V5LCBPYnNlcnZhYmxlT2JqZWN0LmZyb21PYmplY3QoaW5WYWwpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGE7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNQbGFpbk9iamVjdChpbkRhdGEpKSB7XG4gICAgICAgICAgICBsZXQgbyA9IG5ldyBPYnNlcnZhYmxlT2JqZWN0KCk7XG4gICAgICAgICAgICBlYWNoKGluRGF0YSwgZnVuY3Rpb24oaW5WYWwsIGluS2V5KSB7XG4gICAgICAgICAgICAgICAgby5wcm9wKGluS2V5LCBPYnNlcnZhYmxlT2JqZWN0LmZyb21PYmplY3QoaW5WYWwpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIG87XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gaW5EYXRhO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIHByb3AoaW5CYXNlLCBpblBhdGgpIHtcbiAgICAgICAgaWYgKCFpbkJhc2UpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIShpbkJhc2UgaW5zdGFuY2VvZiBPYnNlcnZhYmxlT2JqZWN0KSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpbkJhc2UucHJvcChpblBhdGgpO1xuICAgIH1cblxuICAgIGR1bW15KCkge1xuICAgICAgICByZXR1cm4gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgIH1cblxuICAgIGdldCBpc0NvbGxlY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBfcHJpdmF0ZS5nZXQodGhpcykuaXNDb2xsZWN0aW9uO1xuICAgIH1cblxuICAgIGdldCBsZW5ndGgoKSB7XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgICAgICBpZiAoX3AuaXNDb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4ga2V5cyhfcC5wcm9wcy5fb2JqKS5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBwcm9wKGluUGF0aCwgaW5WYWx1ZSwgaW5TaWxlbnQpIHsgLy9qc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgICAgaWYgKGluUGF0aCAhPT0gMCAmJiAhaW5QYXRoKSB7IC8vcGF0aCBjYW4gYmUgYW4gaW5kZXguICFpblBhdGggd291bGQgaWdub3JlIHplcm8gYXMgYSBwcm9wZXJ0eVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgX3AgPSBfcHJpdmF0ZS5nZXQodGhpcyk7XG4gICAgICAgIGNvbnN0IG15UHJvcHMgPSBfcC5wcm9wcztcbiAgICAgICAgY29uc3QgcGF0aCA9ICFpc05hTihpblBhdGgpID8gW2luUGF0aF0gOiBpblBhdGguc3BsaXQoJy4nKTtcbiAgICAgICAgdmFyIHByb3BOYW1lID0gcGF0aC5zaGlmdCgpO1xuICAgICAgICBpZiAoX3AuaXNDb2xsZWN0aW9uICYmIGlzTmFOKHByb3BOYW1lKSAmJiBwcm9wTmFtZSAhPT0gJ2xlbmd0aCcpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ29sbGVjdGlvbiBPYnNlcnZhYmxlT2JqZWN0IGNhbiBvbmx5IGhhdmUgbnVtYmVycyBhcyBrZXlzJyk7XG4gICAgICAgIH0gZWxzZSBpZiAoX3AuaXNDb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICBwcm9wTmFtZSA9ICFpc05hTihwcm9wTmFtZSkgPyBwYXJzZUludChwcm9wTmFtZSkgOiBwcm9wTmFtZTtcbiAgICAgICAgICAgIGlmIChpc05hTihwcm9wTmFtZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5sZW5ndGg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGluVmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKG15UHJvcHMucHJvcChwcm9wTmFtZSkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChwYXRoLmxlbmd0aCAmJiAhKG15UHJvcHMucHJvcChwcm9wTmFtZSkgaW5zdGFuY2VvZiBPYnNlcnZhYmxlT2JqZWN0KSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ3RyeWluZyB0byBhY2Nlc3MgcGF0aCB0aHJvdWdoIGEgbm9uIHRyYXZlcnNhYmxlIHByb3BlcnR5Jyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwYXRoLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbXlQcm9wcy5wcm9wKHByb3BOYW1lKS5wcm9wKHBhdGguam9pbignLicpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG15UHJvcHMucHJvcChwcm9wTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBicmFuY2ggPSBbXTtcbiAgICAgICAgICAgIHZhciBjaGFuZ2UgPSBfcC5zZXRQcm9wKGluUGF0aCwgaW5WYWx1ZSwgYnJhbmNoKTtcbiAgICAgICAgICAgIGlmICghaW5TaWxlbnQpIHtcbiAgICAgICAgICAgICAgICBfcC5jaGFuZ2VzUXVldWUucHVzaChjaGFuZ2UpO1xuICAgICAgICAgICAgICAgIE9ic2VydmFibGVPYmplY3Qubm90aWZ5V2F0Y2hlcnMoX3ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGluVmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIC8vVE9ETzogaW1wbGVtZW50IGV2ZW50LXNwZWNpZmljIHdhdGNoXG4gICAgd2F0Y2goaW5QYXRoLCBpbkhhbmRsZXIsIGluRXZlbnQpIHtcbiAgICAgICAgY29uc3QgX3AgPSBfcHJpdmF0ZS5nZXQodGhpcyk7XG4gICAgICAgIF9wLm9ic2VydmVyLmxpc3RlbihpblBhdGgsIGluSGFuZGxlciwgaW5FdmVudCk7XG4gICAgfVxuXG4gICAgdW53YXRjaChpbkhhbmRsZXIsIGluUGF0aCkge1xuICAgICAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcbiAgICAgICAgX3Aub2JzZXJ2ZXIudW5saXN0ZW4oaW5IYW5kbGVyLCBpblBhdGgpO1xuICAgIH1cblxuICAgIHRvTmF0aXZlKGluRGVlcCkge1xuICAgICAgICB2YXIgb3V0ID0gX3ByaXZhdGUuZ2V0KHRoaXMpLmlzQ29sbGVjdGlvbiA/IFtdIDoge307XG4gICAgICAgIGVhY2goX3ByaXZhdGUuZ2V0KHRoaXMpLnByb3BzLl9vYmosIChpblZhbCwgaW5LZXkpID0+IHtcbiAgICAgICAgICAgIGxldCBpc09ic2VydmFibGUgPSBpblZhbCBpbnN0YW5jZW9mIE9ic2VydmFibGVPYmplY3Q7XG4gICAgICAgICAgICBvdXRbaW5LZXldID0gaXNPYnNlcnZhYmxlICYmIGluRGVlcCA9PT0gdHJ1ZSA/IGluVmFsLnRvTmF0aXZlKHRydWUpIDogaW5WYWw7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gb3V0O1xuICAgIH1cblxuICAgIHNvcnQoaW5Db21wYXJhdG9yKSB7XG4gICAgICAgIGlmIChfcHJpdmF0ZS5nZXQodGhpcykuaXNDb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykucHJvcHMuX29iai5zb3J0KGluQ29tcGFyYXRvcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgc3RhdGljIG5vdGlmeVdhdGNoZXJzKGluSW5zdGFuY2UpIHtcbiAgICAgICAgaWYgKGluSW5zdGFuY2UuaXNTaWxlbnQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBjIG9mIGluSW5zdGFuY2UuY2hhbmdlc1F1ZXVlKSB7XG4gICAgICAgICAgICBpbkluc3RhbmNlLm9ic2VydmVyLm5vdGlmeShjLnBhdGgsIGMuY2hhbmdlKTtcbiAgICAgICAgfVxuICAgICAgICBpbkluc3RhbmNlLmNoYW5nZXNRdWV1ZSA9IFtdO1xuXG4gICAgfVxuXG4gICAgc3RhdGljIGZpbGwoaW5UYXJnZXQsIGluUGF0aCwgaW5Db250ZW50LCBpblNpbGVudCkge1xuICAgICAgICBpZiAoIWluVGFyZ2V0IHx8ICEoaW5UYXJnZXQgaW5zdGFuY2VvZiBPYnNlcnZhYmxlT2JqZWN0KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdmaWxsKCkgY2FuIG9ubHkgYmUgaW52b2tlZCBvbiBhbiBPYnNlcnZhYmxlT2JqZWN0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpblRhcmdldCB8fCAhKGluVGFyZ2V0IGluc3RhbmNlb2YgT2JzZXJ2YWJsZU9iamVjdCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IHJlc29sdmUgT2JzZXJ2YWJsZU9iamVjdCB0byBmaWxsJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpblRhcmdldC5maWxsKGluQ29udGVudCwgaW5QYXRoLCBpblNpbGVudCk7XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KGluVGFyZ2V0KTtcbiAgICAgICAgaWYgKCFpblNpbGVudCkge1xuICAgICAgICAgICAgX3AuY2hhbmdlc1F1ZXVlLnB1c2goe1xuICAgICAgICAgICAgICAgIHBhdGg6IGluUGF0aCxcbiAgICAgICAgICAgICAgICBjaGFuZ2U6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2ZpbGxlZCcsXG4gICAgICAgICAgICAgICAgICAgIG5ld1ZhbHVlOiBpbkNvbnRlbnRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIE9ic2VydmFibGVPYmplY3Qubm90aWZ5V2F0Y2hlcnMoX3ApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIG1lcmdlKGluVGFyZ2V0LCBpblBhdGgsIGluQ29udGVudCwgaW5TaWxlbnQpIHtcbiAgICAgICAgaWYgKCFpblRhcmdldCB8fCAhKGluVGFyZ2V0IGluc3RhbmNlb2YgT2JzZXJ2YWJsZU9iamVjdCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignbWVyZ2UgKCkgY2FuIG9ubHkgYmUgaW52b2tlZCBvbiBhbiBPYnNlcnZhYmxlT2JqZWN0Jyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWluVGFyZ2V0IHx8ICEoaW5UYXJnZXQgaW5zdGFuY2VvZiBPYnNlcnZhYmxlT2JqZWN0KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgcmVzb2x2ZSBPYnNlcnZhYmxlT2JqZWN0IHRvIG1lcmdlJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpblRhcmdldC5tZXJnZShpbkNvbnRlbnQsIGluUGF0aCk7XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KGluVGFyZ2V0KTtcbiAgICAgICAgaWYgKCFpblNpbGVudCkge1xuICAgICAgICAgICAgX3AuY2hhbmdlc1F1ZXVlLnB1c2goe1xuICAgICAgICAgICAgICAgIHBhdGg6IGluUGF0aCxcbiAgICAgICAgICAgICAgICBjaGFuZ2U6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ21lcmdlZCcsXG4gICAgICAgICAgICAgICAgICAgIG5ld1ZhbHVlOiBpbkNvbnRlbnRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIE9ic2VydmFibGVPYmplY3Qubm90aWZ5V2F0Y2hlcnMoX3ApO1xuICAgICAgICB9XG5cbiAgICB9XG5cblxuICAgIGVtcHR5KGluU2lsZW50KSB7XG4gICAgICAgIHRoaXMuZmlsbChudWxsLCBpblNpbGVudCk7XG4gICAgfVxufVxud2luZG93Lk9ic2VydmFibGVPYmplY3QgPSBPYnNlcnZhYmxlT2JqZWN0O1xuZXhwb3J0IGRlZmF1bHQgT2JzZXJ2YWJsZU9iamVjdDtcbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IE9ic2VydmFibGVPYmplY3QgZnJvbSAnLi9PYnNlcnZhYmxlT2JqZWN0JztcbmltcG9ydCBoYXMgZnJvbSAnbG9kYXNoLmhhcyc7XG5cbmNsYXNzIENvbXBvbmVudE1vZGVsIGV4dGVuZHMgT2JzZXJ2YWJsZU9iamVjdCB7XG5cdGNvbnN0cnVjdG9yKGluSW5pdE9iaikge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRpZihoYXMoaW5Jbml0T2JqLCAnZGF0YScpKSB7XG5cdFx0XHR0aGlzLmZpbGwoaW5Jbml0T2JqKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5maWxsKHsgZGF0YSA6IGluSW5pdE9ian0pO1xuXHRcdH1cblx0fVxuXG5cdGRhdGEoaW5QYXRoLCBpbkRhdGEpIHtcblx0XHRjb25zdCBwYXRoID0gJ2RhdGEnICsgKGluUGF0aCA/ICcuJyArIGluUGF0aCA6ICcnKTtcblx0XHRyZXR1cm4gdGhpcy5wcm9wKHBhdGgsIGluRGF0YSk7XG5cdH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ29tcG9uZW50TW9kZWw7IiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgZmluZCBmcm9tICdsb2Rhc2guZmluZCc7XG5pbXBvcnQgbWFwIGZyb20gJ2xvZGFzaC5tYXAnO1xuaW1wb3J0IGlzU3RyaW5nIGZyb20gJ2xvZGFzaC5pc1N0cmluZyc7XG5pbXBvcnQgaXNBcnJheSBmcm9tICdsb2Rhc2guaXNBcnJheSc7XG5cbmNvbnN0IF9wcml2YXRlID0gbmV3IFdlYWtNYXAoKTtcblxuY2xhc3MgU3RhdGUge1xuXHRjb25zdHJ1Y3RvciguLi5yZXN0KSB7XHRcblx0XHRsZXQgbmFtZSA9IGZpbmQocmVzdCwgKHBhcmFtKSA9PiBpc1N0cmluZyhwYXJhbSkpIHx8ICcnO1xuXHRcdGxldCBjaGlsZHJlbiA9IGZpbmQocmVzdCwgKHBhcmFtKSA9PiBpc0FycmF5KHBhcmFtKSk7XG5cdFx0bGV0IHBhcmVudCA9IGZpbmQocmVzdCwgKHBhcmFtKSA9PiBwYXJhbSBpbnN0YW5jZW9mIFN0YXRlKTtcblxuXHRcdGNoaWxkcmVuID0gbWFwKGNoaWxkcmVuLCAoaW5WYWx1ZSkgPT4ge1xuXHRcdFx0Y29uc3Qgc3RhdGUgPSAoaW5WYWx1ZSBpbnN0YW5jZW9mIFN0YXRlID8gaW5WYWx1ZSA6IG5ldyBTdGF0ZShpblZhbHVlKSk7XG5cdFx0XHRfcHJpdmF0ZS5nZXQoc3RhdGUpLnBhcmVudCA9IHRoaXM7XG5cdFx0XHRyZXR1cm4gc3RhdGU7XG5cdFx0fSk7XG5cblx0XHRfcHJpdmF0ZS5zZXQodGhpcywge1xuXHRcdFx0bmFtZSA6IG5hbWUsXG5cdFx0XHRjaGlsZHJlbiA6IGNoaWxkcmVuLFxuXHRcdFx0cGFyZW50IDogcGFyZW50XG5cdFx0fSk7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHR0aGlzLmNoaWxkcmVuID0gY2hpbGRyZW47XG5cdH1cblxuXHRnZXRQYXRoKCkge1xuXHRcdGNvbnN0IHBhcmVudCA9ICBfcHJpdmF0ZS5nZXQodGhpcykucGFyZW50O1xuXHRcdHJldHVybiAocGFyZW50ICYmIHBhcmVudC5nZXROYW1lKCkgPyBwYXJlbnQuZ2V0UGF0aCgpICsgJy4nIDogJycpICsgX3ByaXZhdGUuZ2V0KHRoaXMpLm5hbWU7XG5cdH1cblxuXG5cdGdldE5hbWUoKSB7XG5cdFx0cmV0dXJuIF9wcml2YXRlLmdldCh0aGlzKS5uYW1lO1xuXHR9XG5cblx0Y2hpbGQoaW5OYW1lKSB7XG5cdFx0cmV0dXJuIGZpbmQoX3ByaXZhdGUuZ2V0KHRoaXMpLmNoaWxkcmVuLCAoaW5DaGlsZCkgPT4gaW5DaGlsZC5nZXROYW1lKCkgPT09IGluTmFtZSk7XG5cdH1cblxuXHRyZXNvbHZlKGluUGF0aCkge1xuXHRcdGlmKCFpblBhdGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgc2VncyA9IGluUGF0aC5zcGxpdCgnLicpO1xuXHRcdGNvbnN0IGNoaWxkID0gdGhpcy5jaGlsZChzZWdzLnNoaWZ0KCkpO1xuXHRcdGlmKCFjaGlsZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH0gZWxzZSBpZihzZWdzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIGNoaWxkLnJlc29sdmUoc2Vncy5qb2luKCcuJykpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gY2hpbGQ7XG5cdFx0fVxuXHR9XG5cblx0ZXhwb3NlZCgpIHtcblx0XHR0aGlzLmV4cG9zZWQgPSB0cnVlO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0b25MZWF2aW5nKGluRm4pIHtcblx0XHR0aGlzLmxlYXZpbmcgPSBpbkZuO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0bGVhdmluZygpIHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxuXHRvbkxlZnQoaW5Gbikge1xuXHRcdHRoaXMubGVmdCA9IGluRm47XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRsZWZ0KCkge1xuXG5cdH1cblxuXHRvblJlbmRlcmVkKGluRm4pIHtcblx0XHR0aGlzLnJlbmRlcmVkID0gaW5Gbjtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdG9uRW50ZXJpbmcoaW5Gbikge1xuXHRcdHRoaXMuZW50ZXJpbmcgPSBpbkZuO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0ZW50ZXJpbmcoKSB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHR9XG5cblx0b25FbnRlcmVkKGluRm4pIHtcblx0XHR0aGlzLmVudGVyZWQgPSBpbkZuO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0cmVuZGVyZWQoKSB7XG5cblx0fVxuXHRcblxuXHRlbnRlcmVkKCkge1xuXG5cdH1cblxuXHRkaWRudExlYXZlKCkge1xuXG5cdH1cblxuXHRtYXRjaGVzKGluUGF0dGVybikge1xuXHRcdHJldHVybiAoIWluUGF0dGVybiAmJiAhX3ByaXZhdGUuZ2V0KHRoaXMpLm5hbWUpIHx8XG5cdFx0XHQobmV3IFJlZ0V4cChpblBhdHRlcm4pKS50ZXN0KF9wcml2YXRlLmdldCh0aGlzKS5uYW1lKTtcblx0fVxufVxuXG5leHBvcnQgZGVmYXVsdCBTdGF0ZTtcbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHtcbiAgICBTaWduYWxcbn0gZnJvbSAnc2lnbmFscyc7XG5pbXBvcnQgZ2V0IGZyb20gJ2xvZGFzaC5nZXQnO1xuXG5jbGFzcyBCdXMge1xuXG4gICAgY29uc3RydWN0b3IoaW5Db21wb25lbnQpIHtcbiAgICAgICAgdGhpcy5jb21wb25lbnQgPSAoKSA9PiBpbkNvbXBvbmVudDtcbiAgICAgICAgdGhpcy5zaWduYWxzID0ge307XG4gICAgfVxuXG4gICAgcHVibGlzaEFjdGlvbihpbk5hbWUsIGluSGFuZGxlcikge1xuICAgICAgICB0aGlzLmNvbXBvbmVudCgpLnBhZ2UuYnVzLmFkZEFjdGlvbihpbk5hbWUsIGluSGFuZGxlcik7XG4gICAgfVxuXG4gICAgYnViYmxlQWN0aW9uKGluTmFtZSwgLi4ucmVzdCkge1xuICAgICAgICBjb25zdCBwYXJlbnRCdXMgPSBnZXQodGhpcy5jb21wb25lbnQoKS5wYXJlbnQoKSwgJ2J1cycpO1xuICAgICAgICBpZiAoIXBhcmVudEJ1cykge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBDYW5ub3QgYnViYmxlIGFjdGlvbiBcIiR7aW5OYW1lfVwiIGZyb20gcGFnZWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHBhcmVudEJ1cy50cmlnZ2VyQWN0aW9uLmFwcGx5KHBhcmVudEJ1cywgW2luTmFtZV0uY29uY2F0KHJlc3QpKTtcbiAgICB9XG5cbiAgICBidWJibGUoKSB7XG4gICAgICAgIHRoaXMuc2hvdWxkQnViYmxlQ3VycmVudCA9IHRydWU7XG4gICAgfVxuXG4gICAgdHJpZ2dlckFjdGlvbihpbk5hbWUsIGluUGFyYW1zLCAuLi5yZXN0KSB7XG4gICAgICAgIGluUGFyYW1zID0gaW5QYXJhbXMgfHwge307XG4gICAgICAgIGlmICh0aGlzLnNpZ25hbHNbaW5OYW1lXSkge1xuICAgICAgICAgICAgdGhpcy5zaWduYWxzW2luTmFtZV0uZGlzcGF0Y2guYXBwbHkobnVsbCwgW2luUGFyYW1zXS5jb25jYXQocmVzdCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLnNpZ25hbHNbaW5OYW1lXSB8fCB0aGlzLnNob3VsZEJ1YmJsZUN1cnJlbnQpIHtcbiAgICAgICAgICAgIHJlc3QudW5zaGlmdChpblBhcmFtcyk7XG4gICAgICAgICAgICByZXN0LnVuc2hpZnQoaW5OYW1lKTtcbiAgICAgICAgICAgIHRoaXMuc2hvdWxkQnViYmxlQ3VycmVudCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5idWJibGVBY3Rpb24uYXBwbHkodGhpcywgcmVzdCk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGFkZEFjdGlvbihpbk5hbWUsIGluSGFuZGxlciwgaW5PbmNlKSB7XG4gICAgICAgIGlmICghdGhpcy5zaWduYWxzW2luTmFtZV0pIHtcbiAgICAgICAgICAgIHRoaXMuc2lnbmFsc1tpbk5hbWVdID0gbmV3IFNpZ25hbCgpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpbkhhbmRsZXIpIHtcbiAgICAgICAgICAgIHRoaXMuc2lnbmFsc1tpbk5hbWVdWydhZGQnICsgKGluT25jZSA/ICdPbmNlJyA6ICcnKV0oaW5IYW5kbGVyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uY2VBY3Rpb24oaW5OYW1lLCBpbkhhbmRsZXIpIHtcbiAgICAgICAgLy9UT0RPOiB0byBiZSBpbXBsZW1lbnRlZFxuICAgIH1cblxuICAgIG9uQWN0aW9uKGluTmFtZSwgaW5IYW5kbGVyLCBpbk9uY2UpIHtcbiAgICAgICAgaWYgKCF0aGlzLnNpZ25hbHNbaW5OYW1lXSkge1xuICAgICAgICAgICAgY29uc3QgcGFyZW50QnVzID0gZ2V0KHRoaXMuY29tcG9uZW50KCkucGFyZW50KCksICdidXMnKTtcbiAgICAgICAgICAgIGlmIChwYXJlbnRCdXMpIHtcbiAgICAgICAgICAgICAgICBwYXJlbnRCdXMub25BY3Rpb24oaW5OYW1lLCBpbkhhbmRsZXIsIGluT25jZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkQWN0aW9uKGluTmFtZSwgaW5IYW5kbGVyLCBpbk9uY2UpO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUud2FybignUG9zc2libHkgcmVnaXN0ZXJpbmcgbGlzdGVuZXIgdG8gbm9uIGV4aXN0aW5nIGFjdGlvbjogJyArIGluTmFtZSk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS53YXJuKCdZb3UgbWlnaHQgd2FudCB0byB1c2UgYWRkQWN0aW9uIG9yIHB1Ymxpc2hBY3Rpb24nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc2lnbmFsc1tpbk5hbWVdWydhZGQnICsgKGluT25jZSA/ICdPbmNlJyA6ICcnKV0oaW5IYW5kbGVyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9mZkFjdGlvbihpbk5hbWUsIGluSGFuZGxlcikge1xuICAgICAgICAvL1RPRE86IHRvIGJlIGltcGxlbWVudGVkXG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBCdXM7XG4iLCIndXNlIHN0cmljdCc7XG5cdFx0XG5cbmNvbnN0IF9wcml2YXRlID0gbmV3IFdlYWtNYXAoKTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ29tcG9uZW50TGlmZWN5Y2xlIHtcblx0Y29uc3RydWN0b3IoaW5TaWduYWwpIHtcblx0XHRfcHJpdmF0ZS5zZXQodGhpcywge3NpZ25hbCA6IGluU2lnbmFsfSk7XG5cdH1cblxuXHRyZW5kZXJlZChpbkhhbmRsZXIpIHtcblx0XHRfcHJpdmF0ZS5nZXQodGhpcykuc2lnbmFsLmFkZCgoaW5UeXBlKSA9PiB7XG5cdFx0XHRpZihpblR5cGUgPT09ICdyZW5kZXJlZCcpIHtcblx0XHRcdFx0aW5IYW5kbGVyKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRlbGVtZW50Q3JlYXRlZChpbkhhbmRsZXIpIHtcblx0XHRfcHJpdmF0ZS5nZXQodGhpcykuc2lnbmFsLmFkZCgoaW5UeXBlKSA9PiB7XG5cdFx0XHRpZihpblR5cGUgPT09ICdlbGVtZW50LWNyZWF0ZWQnKSB7XG5cdFx0XHRcdGluSGFuZGxlcigpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdH1cblxuXHRlbGVtZW50QXR0YWNoZWQoaW5IYW5kbGVyKSB7XG5cdFx0X3ByaXZhdGUuZ2V0KHRoaXMpLnNpZ25hbC5hZGQoKGluVHlwZSkgPT4ge1xuXHRcdFx0aWYoaW5UeXBlID09PSAnZWxlbWVudC1hdHRhY2hlZCcpIHtcblx0XHRcdFx0aW5IYW5kbGVyKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0fVxuXG5cdGVsZW1lbnREZXRhY2hlZChpbkhhbmRsZXIpIHtcblx0XHRfcHJpdmF0ZS5nZXQodGhpcykuc2lnbmFsLmFkZCgoaW5UeXBlKSA9PiB7XG5cdFx0XHRpZihpblR5cGUgPT09ICdlbGVtZW50LWRldGFjaGVkJykge1xuXHRcdFx0XHRpbkhhbmRsZXIoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHR9XG5cblx0ZW1pdChpblR5cGUpIHtcblx0XHRfcHJpdmF0ZS5nZXQodGhpcykuc2lnbmFsLmRpc3BhdGNoKGluVHlwZSk7XG5cdH1cbn1cbiIsImNvbnN0IHJlZ2lzdHJ5ID0gbmV3IE1hcCgpO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihpbkNsYXNzKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuICAgIGlmICghcmVnaXN0cnkuaGFzKGluQ2xhc3MpKSB7XG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBXZWFrTWFwKCk7XG4gICAgICAgIHJlZ2lzdHJ5LnNldChpbkNsYXNzLCBtYXApO1xuICAgIH1cbiAgICByZXR1cm4gcmVnaXN0cnkuZ2V0KGluQ2xhc3MpO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuaW1wb3J0IG1pY3JvdGFzayBmcm9tICcuL21pY3JvdGFzayc7XG5pbXBvcnQgT2JzZXJ2YWJsZU9iamVjdCBmcm9tICcuL09ic2VydmFibGVPYmplY3QnO1xuaW1wb3J0IENvbXBvbmVudE1vZGVsIGZyb20gJy4vQ29tcG9uZW50TW9kZWwnO1xuaW1wb3J0IFN0YXRlIGZyb20gJy4vU3RhdGUnO1xuaW1wb3J0IEJ1cyBmcm9tICcuL0J1cyc7XG5pbXBvcnQgaXNTdHJpbmcgZnJvbSAnbG9kYXNoLmlzU3RyaW5nJztcbmltcG9ydCBpc0Z1bmN0aW9uIGZyb20gJ2xvZGFzaC5pc0Z1bmN0aW9uJztcbmltcG9ydCBpc1BsYWluT2JqZWN0IGZyb20gJ2xvZGFzaC5pc1BsYWluT2JqZWN0JztcbmltcG9ydCBlYWNoIGZyb20gJ2xvZGFzaC5mb3JlYWNoJztcbmltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5pbXBvcnQgZmFjdG9yeSBmcm9tICcuL3BhZ2UtZmFjdG9yeSc7XG5pbXBvcnQgQ29tcG9uZW50TGlmZWN5Y2xlIGZyb20gJy4vQ29tcG9uZW50TGlmZWN5Y2xlJztcbmltcG9ydCAge1NpZ25hbH0gZnJvbSAnc2lnbmFscyc7XG5pbXBvcnQgcHJpdmF0ZUhhc2ggZnJvbSAnLi91dGlsL3ByaXZhdGUnO1xuXG5jb25zdCBfcHJpdmF0ZSA9IHByaXZhdGVIYXNoKCdjb21wb25lbnQnKTtcblxuY29uc3QgX3NldHVwTW9kZWwgPSBmdW5jdGlvbiBfc2V0dXBNb2RlbChpbk1vZGVsSW5pdE9iaikge1xuXG4gICAgY29uc3QgX3AgPSBfcHJpdmF0ZS5nZXQodGhpcyk7XG5cbiAgICBsZXQgZ2V0dGVyO1xuICAgIGlmICghaW5Nb2RlbEluaXRPYmopIHtcbiAgICAgICAgZ2V0dGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFnZS5yZXNvbHZlTm9kZU1vZGVsKHRoaXMubm9kZSk7XG4gICAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYoaXNQbGFpbk9iamVjdChpbk1vZGVsSW5pdE9iaikpIHtcbiAgICAgICAgICAgIF9wLm1vZGVsID0gbmV3IENvbXBvbmVudE1vZGVsKGluTW9kZWxJbml0T2JqKTtcbiAgICAgICAgfSBlbHNlIGlmKGluTW9kZWxJbml0T2JqIGluc3RhbmNlb2YgQ29tcG9uZW50TW9kZWwpIHtcbiAgICAgICAgICAgIF9wLm1vZGVsID0gaW5Nb2RlbEluaXRPYmo7XG4gICAgICAgIFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgX3AubW9kZWwgPSBPYnNlcnZhYmxlT2JqZWN0LmZyb21PYmplY3QoaW5Nb2RlbEluaXRPYmopO1xuICAgICAgICB9XG4gICAgICAgIGdldHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBfcC5tb2RlbDtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ21vZGVsJywge1xuICAgICAgICBnZXQ6IGdldHRlclxuICAgIH0pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnaGFzTW9kZWwnLCB7XG4gICAgICAgIGdldDogKCkgPT4gISFpbk1vZGVsSW5pdE9ialxuICAgIH0pO1xufTtcblxuY29uc3QgX2ZpbmRTdGF0ZSA9IGZ1bmN0aW9uIF9maW5kU3RhdGUoaW5TdGF0ZU5hbWUpIHtcblxuICAgIGlmICghaW5TdGF0ZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhdGVzO1xuICAgIH1cbiAgICBsZXQgcGF0aCA9IGluU3RhdGVOYW1lLnNwbGl0KCcuJyk7XG4gICAgbGV0IGN1cnJlbnRTdGF0ZSA9IHRoaXMuc3RhdGVzO1xuICAgIHdoaWxlIChwYXRoLmxlbmd0aCAmJiBjdXJyZW50U3RhdGUpIHtcbiAgICAgICAgbGV0IHNlZyA9IHBhdGguc2hpZnQoKTtcbiAgICAgICAgY3VycmVudFN0YXRlID0gY3VycmVudFN0YXRlLmNoaWxkKHNlZyk7XG4gICAgfVxuICAgIHJldHVybiBjdXJyZW50U3RhdGU7XG59O1xuXG5cbmNvbnN0IF93YXRjaFN0YXRlID0gZnVuY3Rpb24gX3dhdGNoU3RhdGUoKSB7XG4gICAgY29uc3QgX3AgPSBfcHJpdmF0ZS5nZXQodGhpcyk7XG5cbiAgICBfcC5zdGF0ZUluZm8ud2F0Y2goJ25leHRTdGF0ZScsIChpblBhdGgsIGluQ2hhbmdlcykgPT4ge1xuICAgICAgICBsZXQgbmV4dFN0YXRlID0gX2ZpbmRTdGF0ZS5iaW5kKHRoaXMpKGluQ2hhbmdlcy5uZXdWYWx1ZSk7XG4gICAgICAgIGlmICghbmV4dFN0YXRlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ0NoYW5naW5nIHRvIHVua25vd24gc3RhdGU6ICcgK1xuICAgICAgICAgICAgICAgIGluQ2hhbmdlcy5uZXdWYWx1ZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgcm9sbGJhY2sgPSAoaW5SZWFzb24pID0+IHtcbiAgICAgICAgICAgIGluUmVhc29uICYmIGNvbnNvbGUuZGVidWcoJ0NvdWxkIG5vdCBjaGFuZ2Ugc3RhdGUgYmVjYXVzZTogJyArIGluUmVhc29uKTsgLy9qc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgICAgICAgIF9wLnN0YXRlSW5mby5wcm9wKCduZXh0U3RhdGUnLCBpbkNoYW5nZXMub2xkVmFsdWUsIHRydWUpO1xuICAgICAgICAgICAgY3VycmVudFN0YXRlLmRpZG50TGVhdmUoKTtcbiAgICAgICAgICAgIGZvciAobGV0IHdhdGNoZXIgb2YgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlV2F0Y2hlcnMpIHtcbiAgICAgICAgICAgICAgICB3YXRjaGVyKGluQ2hhbmdlcy5uZXdWYWx1ZSwgaW5DaGFuZ2VzLm9sZFZhbHVlLCBpblJlYXNvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGxldCBjdXJyZW50U3RhdGUgPSBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVJbmZvLnByb3AoJ2N1cnJlbnRTdGF0ZU9iamVjdCcpO1xuICAgICAgICBpZiAoY3VycmVudFN0YXRlKSB7XG4gICAgICAgICAgICBjdXJyZW50U3RhdGUubGVhdmluZyhpbkNoYW5nZXMubmV3VmFsdWUpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIG5leHRTdGF0ZS5lbnRlcmluZyhpbkNoYW5nZXMub2xkVmFsdWUpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5wcm9wKCdjdXJyZW50U3RhdGVPYmplY3QnLCBuZXh0U3RhdGUpO1xuICAgICAgICAgICAgICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVJbmZvLnByb3AoJ3N0YXRlJywgX3Auc3RhdGVJbmZvLnByb3AoJ25leHRTdGF0ZScpKTtcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFN0YXRlLmxlZnQoaW5DaGFuZ2VzLm5ld1ZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgbmV4dFN0YXRlLmVudGVyZWQoaW5DaGFuZ2VzLm9sZFZhbHVlKTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCB3YXRjaGVyIG9mIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZVdhdGNoZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3YXRjaGVyKGluQ2hhbmdlcy5uZXdWYWx1ZSwgaW5DaGFuZ2VzLm9sZFZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfSkuY2F0Y2gocm9sbGJhY2spO1xuICAgICAgICAgICAgfSkuY2F0Y2gocm9sbGJhY2spO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG5cblxuY2xhc3MgQ29tcG9uZW50IHtcblxuICAgIGNvbnN0cnVjdG9yKGluQ29uZmlnLCBpbkluaXRPYmosIGluQ29uc3RydWN0b3IsIGluUGFnZSkge1xuICAgICAgICBjb25zdCBsaWZlY3ljbGVTaWduYWwgPSBuZXcgU2lnbmFsKCk7XG4gICAgICAgIGNvbnN0IGxpZmVjeWNsZSA9IG5ldyBDb21wb25lbnRMaWZlY3ljbGUobGlmZWN5Y2xlU2lnbmFsKTtcbiAgICAgICAgdGhpcy5taWNyb3Rhc2sgPSBtaWNyb3Rhc2s7XG4gICAgICAgIF9wcml2YXRlLnNldCh0aGlzLCB7XG4gICAgICAgICAgICBzdGF0ZVdhdGNoZXJzOiBuZXcgU2V0KCksXG4gICAgICAgICAgICBsaWZlY3ljbGVTaWduYWw6IGxpZmVjeWNsZVNpZ25hbCxcbiAgICAgICAgICAgIHN0YXRlSW5mbzogbmV3IE9ic2VydmFibGVPYmplY3QoKVxuICAgICAgICB9KTtcblxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2xpZmVjeWNsZScsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxpZmVjeWNsZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cblxuICAgICAgICBpZiAoZmFjdG9yeS5jb21wb25lbnRDb25maWdQcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgICAgIGZhY3RvcnkuY29tcG9uZW50Q29uZmlnUHJlcHJvY2Vzc29yKGluQ29uZmlnKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNvbmZpZyA9IGluQ29uZmlnO1xuICAgICAgICB0aGlzLnBhZ2UgPSBpblBhZ2U7XG4gICAgICAgIHRoaXMuYnVzID0gbmV3IEJ1cyh0aGlzKTsgLy9qc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgICAgdGhpcy5uYW1lID0gaW5Db25maWcubmFtZTtcbiAgICAgICAgZWFjaChpbkNvbmZpZy5hY3Rpb25zLCAoaW5BY3Rpb24pID0+IHtcbiAgICAgICAgICAgIGlmICghaW5BY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdQYXNzZWQgYSBudWxsIGFjdGlvbiB0byBjb21wb25lbnQgY29uZmlnJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYWN0aW9uTmFtZSA9IGlzU3RyaW5nKGluQWN0aW9uKSA/IGluQWN0aW9uIDogaW5BY3Rpb24ubmFtZTtcbiAgICAgICAgICAgIGlmICghYWN0aW9uTmFtZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Bhc3NlZCBhbiBvYmplY3Qgd2l0aCBubyBhY3Rpb24gbmFtZSBhcyBhY3Rpb24gaW4gY29tcG9uZW50IGNvbmZpZycpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSBpc1BsYWluT2JqZWN0KGluQWN0aW9uKSA/IGluQWN0aW9uLmhhbmRsZXIgOiB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAgIGlmIChoYW5kbGVyICYmICFpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignUGFzc2VkIGEgbm9uLWZ1bmN0aW9uIGFjdGlvbiBoYW5kbGVyIGluIGNvbXBvbmVudCBjb25maWcnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaXNQbGFpbk9iamVjdChpbkFjdGlvbikgJiYgaW5BY3Rpb24ucHVibGlzaCA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYnVzLnB1Ymxpc2hBY3Rpb24oYWN0aW9uTmFtZSwgaGFuZGxlciA/IGhhbmRsZXIuYmluZCh0aGlzKSA6IG51bGwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1cy5hZGRBY3Rpb24oYWN0aW9uTmFtZSwgaGFuZGxlciA/IGhhbmRsZXIuYmluZCh0aGlzKSA6IG51bGwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pO1xuICAgICAgICBsZXQgdGVtcGxhdGVzID0gaW5Db25maWcudGVtcGxhdGVzIHx8IHt9O1xuXG4gICAgICAgIF9zZXR1cE1vZGVsLmNhbGwodGhpcywgaW5Jbml0T2JqKTtcblxuICAgICAgICBmb3IgKGxldCB0ZW1wbGF0ZU5hbWUgaW4gdGVtcGxhdGVzKSB7XG4gICAgICAgICAgICBsZXQgYWN0dWFsVGVtcGxhdGVOYW1lID0gdGVtcGxhdGVOYW1lID09PSAnX2RlZmF1bHQnID9cbiAgICAgICAgICAgICAgICAnX2RlZmF1bHQuJyArIHRoaXMubmFtZSA6XG4gICAgICAgICAgICAgICAgdGVtcGxhdGVOYW1lO1xuICAgICAgICAgICAgZmFjdG9yeS5nZXRUZW1wbGF0aW5nRGVsZWdhdGUoKVxuICAgICAgICAgICAgICAgIC5yZWdpc3RlcihhY3R1YWxUZW1wbGF0ZU5hbWUsIHRlbXBsYXRlc1t0ZW1wbGF0ZU5hbWVdKTtcbiAgICAgICAgfVxuICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykuaGFzRGVmYXVsdFRlbXBsYXRlID0gISF0ZW1wbGF0ZXMuX2RlZmF1bHQ7XG4gICAgICAgIF93YXRjaFN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgdGhpcy5zdGF0ZXMgPSB0aGlzLnN0YXRlcyB8fCBuZXcgU3RhdGUoKTtcbiAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5wcm9wKCdjdXJyZW50U3RhdGVPYmplY3QnLCB0aGlzLnN0YXRlcyk7XG4gICAgICAgIGluQ29uc3RydWN0b3IgJiYgaW5Db25zdHJ1Y3Rvci5iaW5kKHRoaXMpKCk7IC8vanNoaW50IGlnbm9yZTpsaW5lXG5cbiAgICAgICAgbWljcm90YXNrKHRoaXMuaW5pdFN0YXRlLmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIGRhdGEoaW5QYXRoLCBpblZhbHVlLCBpblNpbGVudCkge1xuICAgICAgICBjb25zdCBwYXRoID0gJ2RhdGEnICsgKGluUGF0aCA/ICcuJyArIGluUGF0aCA6ICcnKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFnZS5yZXNvbHZlTm9kZU1vZGVsKHRoaXMubm9kZSwgcGF0aCkucHJvcChwYXRoLCBpblZhbHVlLCBpblNpbGVudCk7XG4gICAgfVxuXG4gICAgcGFyZW50KCkge1xuICAgICAgICBpZih0aGlzLnBhZ2UgPT09IHRoaXMpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5wYWdlLnJlc29sdmVOb2RlQ29tcG9uZW50KCQodGhpcy5ub2RlKS5wYXJlbnQoKSk7XG4gICAgfVxuXG4gICAgaW5pdFN0YXRlKCkge1xuXG4gICAgfVxuXG4gICAgZ2V0Q3VycmVudFN0YXRlKCkge1xuICAgICAgICByZXR1cm4gX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5wcm9wKCdjdXJyZW50U3RhdGVPYmplY3QnKTtcbiAgICB9XG5cbiAgICB0cnlTdGF0ZShpblN0YXRlTmFtZSkge1xuICAgICAgICBpZiAoaW5TdGF0ZU5hbWUgPT09IChfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVJbmZvLnByb3AoJ3N0YXRlJykgfHwgJycpKSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgd2F0Y2hlciA9IChpbk5ld1N0YXRlLCBpbk9sZFN0YXRlLCBpbkVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGluRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGluRXJyb3IpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoaW5OZXdTdGF0ZSwgaW5PbGRTdGF0ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMudW53YXRjaFN0YXRlKHdhdGNoZXIpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRoaXMud2F0Y2hTdGF0ZSh3YXRjaGVyKTtcbiAgICAgICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZUluZm8ucHJvcCgnbmV4dFN0YXRlJywgaW5TdGF0ZU5hbWUpO1xuICAgICAgICB9KTtcblxuICAgIH1cblxuICAgIHVud2F0Y2hTdGF0ZShpbldhdGNoZXJGdW5jdGlvbikge1xuICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVXYXRjaGVycy5kZWxldGUoaW5XYXRjaGVyRnVuY3Rpb24pO1xuICAgIH1cblxuICAgIHdhdGNoU3RhdGUoaW5XYXRjaGVyRnVuY3Rpb24pIHtcbiAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlV2F0Y2hlcnMuYWRkKGluV2F0Y2hlckZ1bmN0aW9uKTtcbiAgICB9XG5cbiAgICBpbnZhbGlkYXRlKCkge1xuICAgICAgICBpZiAoIV9wcml2YXRlLmdldCh0aGlzKS53aWxsUmVuZGVyKSB7XG4gICAgICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykud2lsbFJlbmRlciA9IHRydWU7XG4gICAgICAgICAgICBtaWNyb3Rhc2sodGhpcy5yZW5kZXIuYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW5kZXIoaW5Nb2RlbCkge1xuICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykud2lsbFJlbmRlciA9IGZhbHNlO1xuICAgICAgICBpZiAoX3ByaXZhdGUuZ2V0KHRoaXMpLmhhc0RlZmF1bHRUZW1wbGF0ZSkge1xuICAgICAgICAgICAgY29uc3QgZGVsZWdhdGUgPSBmYWN0b3J5LmdldFRlbXBsYXRpbmdEZWxlZ2F0ZSgpO1xuICAgICAgICAgICAgY29uc3QgbW9kZWwgPSBpbk1vZGVsID9cbiAgICAgICAgICAgICAgICBPYnNlcnZhYmxlT2JqZWN0LmZyb21PYmplY3QoaW5Nb2RlbCkgOlxuICAgICAgICAgICAgICAgIHRoaXMuZGF0YSgpO1xuICAgICAgICAgICAgZGVsZWdhdGUucmVuZGVyKFxuICAgICAgICAgICAgICAgICdfZGVmYXVsdC4nICsgdGhpcy5uYW1lLFxuICAgICAgICAgICAgICAgIG1vZGVsKS50aGVuKChpbkh0bWwpID0+IHtcbiAgICAgICAgICAgICAgICAkKHRoaXMubm9kZSkuaHRtbChpbkh0bWwpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5hZnRlclJlbmRlciAmJiB0aGlzLmFmdGVyUmVuZGVyKCk7IC8vanNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAgICAgICAgICAgY29uc3QgbXV0YXRpb25PYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAubGlmZWN5Y2xlU2lnbmFsLmRpc3BhdGNoKCdyZW5kZXJlZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbXV0YXRpb25PYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgbXV0YXRpb25PYnNlcnZlci5vYnNlcnZlKCQodGhpcy5ub2RlKS5nZXQoMCksIHtjaGlsZExpc3QgOiB0cnVlfSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoaW5FcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoaW5FcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBDb21wb25lbnQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbmxldCBfcGFnZSA9IG51bGw7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmdW5jdGlvbihpblBhZ2UpIHtcbiAgICAgICAgY29uc3QgTW9kZWxEYXRhU291cmNlID0gZnVuY3Rpb24oaW5QYWdlKSB7XG4gICAgICAgICAgICB0aGlzLnBhZ2UgPSBfcGFnZSA9IGluUGFnZTtcblxuICAgICAgICAgICAgdGhpcy5yZXNvbHZlID0gZnVuY3Rpb24gcmVzb2x2ZShpbk5vZGUsIGluUGF0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZVByb21pc2UsIHJlamVjdFByb21pc2UpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIS9eXy8udGVzdChpblBhdGgpICYmIGluUGF0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGluUGF0aCA9PT0gJy4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5QYXRoID0gJ2RhdGEnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpblBhdGggPSAnZGF0YScgKyAoaW5QYXRoID8gJy4nICsgaW5QYXRoIDogJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1vZGVsID0gX3BhZ2UucmVzb2x2ZU5vZGVNb2RlbChpbk5vZGUsIGluUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmVQcm9taXNlKGluUGF0aCA/IG1vZGVsLnByb3AoaW5QYXRoKSA6IG1vZGVsKTtcblxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdGhpcy5iaW5kUGF0aCA9IGZ1bmN0aW9uIGJpbmRQYXRoKGluTm9kZSwgaW5QYXRoLCBpbkhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIS9eXy8udGVzdChpblBhdGgpICYmIGluUGF0aCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5QYXRoID09PSAnLicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluUGF0aCA9ICdkYXRhJztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluUGF0aCA9ICdkYXRhJyArIChpblBhdGggPyAnLicgKyBpblBhdGggOiAnJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgbW9kZWwgPSBfcGFnZS5yZXNvbHZlTm9kZU1vZGVsKGluTm9kZSwgaW5QYXRoKTtcblxuICAgICAgICAgICAgICAgIG1vZGVsLndhdGNoKGluUGF0aCwgZnVuY3Rpb24oaW5QYXRoLCBpbkNoYW5nZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5IYW5kbGVyKGluQ2hhbmdlcy5uZXdWYWx1ZSwgaW5DaGFuZ2VzLm9sZFZhbHVlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHRoaXMuc2V0UGF0aCA9IGZ1bmN0aW9uIHNldFBhdGgoaW5Ob2RlLCBpblBhdGgsIGluVmFsdWUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIS9eXy8udGVzdChpblBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGluUGF0aCA9ICdkYXRhLicgKyBpblBhdGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IG1vZGVsID0gX3BhZ2UucmVzb2x2ZU5vZGVNb2RlbChpbk5vZGUsIGluUGF0aCk7XG4gICAgICAgICAgICAgICAgbW9kZWwucHJvcChpblBhdGgsIGluVmFsdWUpO1xuICAgICAgICAgICAgfTtcblxuXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBuZXcgTW9kZWxEYXRhU291cmNlKGluUGFnZSk7XG4gICAgfTtcblxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnQgZGVmYXVsdCAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIHByb3RvID0gT2JqZWN0LmNyZWF0ZSh3aW5kb3cuSFRNTEVsZW1lbnQucHJvdG90eXBlKTtcbiAgICByZXR1cm4gZG9jdW1lbnQucmVnaXN0ZXJFbGVtZW50KCdhZS1lbGVtZW50JywgeyBwcm90b3R5cGU6IHByb3RvIH0pO1xufSkoKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcbmltcG9ydCBFbGVtZW50IGZyb20gJy4vYWUtZWxlbWVudCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGFjdGlvbihpblBhZ2UpIHtcbiAgICBjb25zdCBfcGFnZSA9IGluUGFnZTtcblxuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoRWxlbWVudC5wcm90b3R5cGUpO1xuXG4gICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICB9O1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLW1hbmFnZWQnLCB7IHByb3RvdHlwZTogcHJvdG8gfSk7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydCBkZWZhdWx0IFN5bWJvbCgndW5yZXNvbHZlZCcpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuaW1wb3J0IFVOUkVTT0xWRUQgZnJvbSAnLi4vc3ltYm9sL3VucmVzb2x2ZWQnO1xuaW1wb3J0IGVhY2ggZnJvbSAnbG9kYXNoLmZvcmVhY2gnO1xuaW1wb3J0IGlzU3RyaW5nIGZyb20gJ2xvZGFzaC5pc1N0cmluZyc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHR5cGlmeVBhcmFtcyhpblBhZ2UsIGluUGFyYW1zKSB7XG4gICAgY29uc3Qgb3V0ID0ge307XG4gICAgZWFjaChpblBhcmFtcywgZnVuY3Rpb24oaW5QYXJhbVZhbHVlLCBpblBhcmFtS2V5KSB7XG4gICAgICAgIGlmICghaW5QYXJhbVZhbHVlKSB7XG4gICAgICAgICAgICBvdXRbaW5QYXJhbUtleV0gPSBudWxsO1xuICAgICAgICB9IGVsc2UgaWYgKGlzU3RyaW5nKGluUGFyYW1WYWx1ZSkgJiYgL15+Ly50ZXN0KGluUGFyYW1WYWx1ZSkpIHtcbiAgICAgICAgICAgIGxldCByZXNvbHZlZFZhbHVlID0gVU5SRVNPTFZFRDtcbiAgICAgICAgICAgIGluUGFnZS5nZXREYXRhU291cmNlKClcbiAgICAgICAgICAgICAgICAucmVzb2x2ZSh0aGlzLCBpblBhcmFtVmFsdWUucmVwbGFjZSgnficsICcnKSkudGhlbigoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlZFZhbHVlID0gaW5WYWx1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChyZXNvbHZlZFZhbHVlID09PSBVTlJFU09MVkVEKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBY3Rpb24gcGFyYW1ldGVycyBtdXN0IGJlIHJlc29sdmVkIHN5bmNocm9ub3VzbHknKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG91dFtpblBhcmFtS2V5XSA9IHJlc29sdmVkVmFsdWU7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNTdHJpbmcoaW5QYXJhbVZhbHVlKSAmJiAvXmAuKmAkLy50ZXN0KGluUGFyYW1WYWx1ZSkpIHtcbiAgICAgICAgICAgIG91dFtpblBhcmFtS2V5XSA9IGluUGFyYW1WYWx1ZS5yZXBsYWNlKC9eYC8sICcnKS5yZXBsYWNlKC9gJC8sICcnKTtcbiAgICAgICAgfSBlbHNlIGlmICghaXNOYU4oaW5QYXJhbVZhbHVlKSkge1xuICAgICAgICAgICAgb3V0W2luUGFyYW1LZXldID0gTnVtYmVyKGluUGFyYW1WYWx1ZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoL14odHJ1ZXxmYWxzZSkkLy50ZXN0KGluUGFyYW1WYWx1ZSkpIHtcbiAgICAgICAgICAgIG91dFtpblBhcmFtS2V5XSA9IChpblBhcmFtVmFsdWUgPT09ICd0cnVlJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ3VzaW5nIGRlcHJlY2F0ZWQgc2lnbmFsIHN0cmluZyBwYXJhbSBmb3JtYXQnKTtcbiAgICAgICAgICAgIG91dFtpblBhcmFtS2V5XSA9IGluUGFyYW1WYWx1ZTsgLy9pcyBhIHN0cmluZ1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG91dDtcblxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IGdldCBmcm9tICdsb2Rhc2guZ2V0JztcbmltcG9ydCBlYWNoIGZyb20gJ2xvZGFzaC5mb3JlYWNoJztcbmltcG9ydCBpc1N0cmluZyBmcm9tICdsb2Rhc2guaXNTdHJpbmcnO1xuXG5pbXBvcnQgVU5SRVNPTFZFRCBmcm9tICcuLi9zeW1ib2wvdW5yZXNvbHZlZCc7XG5pbXBvcnQgdHlwaWZ5UGFyYW1zIGZyb20gJy4uL3V0aWwvdHlwaWZ5LXBhcmFtZXRlcnMnO1xuXG5cbmNvbnN0IHJlc29sdmVUYXJnZXRzID0gZnVuY3Rpb24gcmVzb2x2ZVRhcmdldHMoaW5QYWdlLCBpbkNvbmZpZykge1xuICAgIGxldCB0YXJnZXQgPSB7fTtcbiAgICAgICAgY29uc3QgdGFyZ2V0QXR0ciA9IGluQ29uZmlnLnRhcmdldDtcbiAgICBpZiAoJCh0aGlzKS5jaGlsZHJlbigpLmxlbmd0aCAmJiB0YXJnZXRBdHRyICE9PSAnc2VsZicpIHtcbiAgICAgICAgdGFyZ2V0Lm5vZGUgPSAkKHRoaXMpLmNoaWxkcmVuKCkuZ2V0KDApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICghdGFyZ2V0QXR0cikge1xuICAgICAgICAgICAgdGFyZ2V0Lm5vZGUgPSAkKHRoaXMpLnBhcmVudCgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhcmdldEF0dHIgPT09ICduZXh0Jykge1xuICAgICAgICAgICAgdGFyZ2V0Lm5vZGUgPSAkKHRoaXMpLm5leHQoKTtcbiAgICAgICAgfSBlbHNlIGlmICgvXmNsb3Nlc3QvLnRlc3QodGFyZ2V0QXR0cikpIHtcbiAgICAgICAgICAgIGNvbnN0IHNlZ3MgPSB0YXJnZXRBdHRyLnNwbGl0KC9cXHMrLyk7XG4gICAgICAgICAgICB0YXJnZXQubm9kZSA9ICQodGhpcykuY2xvc2VzdChzZWdzWzFdKTtcbiAgICAgICAgfSBlbHNlIGlmICgvXihcXC58XFwjKS8udGVzdCh0YXJnZXRBdHRyKSkge1xuICAgICAgICAgICAgdGFyZ2V0Lm5vZGUgPSAkKHRoaXMpLnBhcmVudCgpLmZpbmQodGFyZ2V0QXR0cik7XG4gICAgICAgIH0gZWxzZSBpZiAoL15zZWxmJC8udGVzdCh0YXJnZXRBdHRyKSkge1xuICAgICAgICAgICAgdGFyZ2V0Lm5vZGUgPSAkKHRoaXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCdVbmtub3duIGFlLWJpbmQgdGFyZ2V0OiAnICsgdGFyZ2V0QXR0cik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRhcmdldC5ub2RlICYmIHRhcmdldC5ub2RlLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0Lm5vZGUgJiYgIXRhcmdldC5ub2RlLmxlbmd0aCkge1xuICAgICAgICB0YXJnZXQucGVuZGluZyA9IHRydWU7XG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuICAgIHJldHVybjtcbn07XG5cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYXR0YWNoQWN0aW9uKGluUGFnZSwgaW5Db25maWcpIHtcbiAgICBsZXQgdGFyZ2V0ID0gcmVzb2x2ZVRhcmdldHMuY2FsbCh0aGlzLCBpblBhZ2UsIGluQ29uZmlnKTtcbiAgICBpZiAoZ2V0KHRoaXMsICdwZW5kaW5nJykgPT09IHRydWUpIHtcbiAgICAgICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zKSA9PiB7XG4gICAgICAgICAgICBhdHRhY2hBY3Rpb24uY2FsbCh0aGlzKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IG9ic2VydmVyQ29uZmlnID0ge1xuICAgICAgICAgICAgc3VidHJlZTogdHJ1ZSxcbiAgICAgICAgICAgIGNoaWxkTGlzdDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgICBvYnNlcnZlci5vYnNlcnZlKHRoaXMucGFyZW50Tm9kZSwgb2JzZXJ2ZXJDb25maWcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGFjdGlvbk5hbWUgPSBpbkNvbmZpZy5uYW1lO1xuICAgICAgICBlYWNoKHRhcmdldC5ub2RlLCAoaW5UYXJnZXROb2RlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBpblBhZ2UucmVzb2x2ZU5vZGVDb21wb25lbnQoaW5UYXJnZXROb2RlKTtcbiAgICAgICAgICAgIGxldCBldmVudDtcblxuICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IChpbkV2ZW50LCBpblRyaWdnZXIpID0+IHtcbiAgICAgICAgICAgICAgICBpZigkKGluRXZlbnQudGFyZ2V0KS5wcm9wKCd0YWdOYW1lJykgPT09ICdMQUJFTCcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoaW5UcmlnZ2VyID09PSAnZW50ZXInICYmIGluRXZlbnQua2V5Q29kZSAhPT0gMTMpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoaW5UcmlnZ2VyID09PSAnZXNjJyAmJiBpbkV2ZW50LmtleUNvZGUgIT09IDI3KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LmJ1cy50cmlnZ2VyQWN0aW9uKFxuICAgICAgICAgICAgICAgICAgICBhY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICB0eXBpZnlQYXJhbXMoaW5QYWdlLCBpbkNvbmZpZy5wYXJhbXMpLFxuICAgICAgICAgICAgICAgICAgICBpbkV2ZW50KTtcbiAgICAgICAgICAgICAgICBpZihpblRyaWdnZXIgPT09ICdjbGljaycpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5FdmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG5cbiAgICAgICAgICAgIGZvciAobGV0IHRyaWdnZXIgb2YoaW5Db25maWcudHJpZ2dlciB8fCAnY2xpY2snKS5zcGxpdCgnLCcpKSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoICh0cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2VudGVyJzpcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnZXNjJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50ID0gJ2tleXVwJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKC9eXFx3KzovLnRlc3QodHJpZ2dlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudCA9IHRyaWdnZXIubWF0Y2goL14oXFx3KykvKVswXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSB0cmlnZ2VyO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGNhbGxlciA9IChpbkV2ZW50KSA9PiB7IC8vanNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZXIoaW5FdmVudCwgdHJpZ2dlcik7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICQoaW5UYXJnZXROb2RlKS5vZmYoZXZlbnQsIGNhbGxlcikub24oZXZlbnQsIGNhbGxlcik7XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICB9KTtcbiAgICB9XG5cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcbmltcG9ydCBFbGVtZW50IGZyb20gJy4vYWUtZWxlbWVudCc7XG5pbXBvcnQgYXR0YWNoQWN0aW9uIGZyb20gJy4uL2RlbGVnYXRlL2FjdGlvbi10cmlnZ2VyLWRlbGVnYXRlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYWVCdXR0b24oaW5QYWdlKSB7XG4gICAgY29uc3QgX3BhZ2UgPSBpblBhZ2U7XG4gICAgbGV0IG9ic2VydmVyO1xuXG4gICAgdmFyIHByb3RvID0gT2JqZWN0LmNyZWF0ZShIVE1MQnV0dG9uRWxlbWVudC5wcm90b3R5cGUpO1xuICAgIHByb3RvLmNyZWF0ZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAkKHRoaXMpLnByb3AoJ3R5cGUnLCAnYnV0dG9uJyk7XG4gICAgICAgIG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoZnVuY3Rpb24obXV0YXRpb25zKSB7XG4gICAgICAgICAgICBtdXRhdGlvbnMuZm9yRWFjaChmdW5jdGlvbihtdXRhdGlvbikge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAobXV0YXRpb24uYXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdsYWJlbCc6XG4gICAgICAgICAgICAgICAgICAgICAgICAkKG11dGF0aW9uLnRhcmdldCkudGV4dCgkKG11dGF0aW9uLnRhcmdldCkuYXR0cignbGFiZWwnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIGNvbmZpZ3VyYXRpb24gb2YgdGhlIG9ic2VydmVyOlxuICAgICAgICB2YXIgY29uZmlnID0geyBhdHRyaWJ1dGVzOiB0cnVlIH07XG5cbiAgICAgICAgLy8gcGFzcyBpbiB0aGUgdGFyZ2V0IG5vZGUsIGFzIHdlbGwgYXMgdGhlIG9ic2VydmVyIG9wdGlvbnNcbiAgICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLCBjb25maWcpO1xuXG5cbiAgICAgICAgaWYgKCQodGhpcykuYXR0cignYmluZC1sYWJlbCcpKSB7XG4gICAgICAgICAgICBjb25zdCBwYXRoID0gJCh0aGlzKS5hdHRyKCdiaW5kLWxhYmVsJyk7XG4gICAgICAgICAgICBjb25zdCBzb3VyY2UgPSAkKHRoaXMpLmF0dHIoJ3NvdXJjZScpO1xuXG4gICAgICAgICAgICBfcGFnZVxuICAgICAgICAgICAgICAgIC5nZXREYXRhU291cmNlKHNvdXJjZSlcbiAgICAgICAgICAgICAgICAuYmluZFBhdGgodGhpcywgcGF0aCwgKGluTmV3VmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgJCh0aGlzKS50ZXh0KGluTmV3VmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgX3BhZ2VcbiAgICAgICAgICAgICAgICAuZ2V0RGF0YVNvdXJjZShzb3VyY2UpXG4gICAgICAgICAgICAgICAgLnJlc29sdmUodGhpcywgcGF0aClcbiAgICAgICAgICAgICAgICAudGhlbigoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAkKHRoaXMpLnRleHQoaW5WYWx1ZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoJCh0aGlzKS5hdHRyKCdiaW5kLWVuYWJsZWQnKSkge1xuICAgICAgICAgICAgbGV0IHBhdGggPSAkKHRoaXMpLmF0dHIoJ2JpbmQtZW5hYmxlZCcpO1xuICAgICAgICAgICAgbGV0IHN0cmljdEJvb2xlYW4gPSBmYWxzZTtcbiAgICAgICAgICAgIGlmKC8hJC8udGVzdChwYXRoKSkge1xuICAgICAgICAgICAgICAgIHBhdGggPSBwYXRoLnJlcGxhY2UoLyEkLywgJycpO1xuICAgICAgICAgICAgICAgIHN0cmljdEJvb2xlYW4gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc291cmNlID0gJCh0aGlzKS5hdHRyKCdzb3VyY2UnKTtcbiAgICAgICAgICAgIGNvbnN0IHNldFZhbHVlID0gKGluVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAkKHRoaXMpLnByb3AoJ2Rpc2FibGVkJywgc3RyaWN0Qm9vbGVhbiA/IGluVmFsdWUgIT09IHRydWUgOiAhaW5WYWx1ZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBfcGFnZVxuICAgICAgICAgICAgICAgIC5nZXREYXRhU291cmNlKHNvdXJjZSlcbiAgICAgICAgICAgICAgICAuYmluZFBhdGgodGhpcywgcGF0aCwgKGluTmV3VmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc2V0VmFsdWUoaW5OZXdWYWx1ZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBfcGFnZVxuICAgICAgICAgICAgICAgIC5nZXREYXRhU291cmNlKHNvdXJjZSlcbiAgICAgICAgICAgICAgICAucmVzb2x2ZSh0aGlzLCBwYXRoKVxuICAgICAgICAgICAgICAgIC50aGVuKChpblZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHNldFZhbHVlKGluVmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCQodGhpcykuYXR0cignYWN0aW9uJykpIHtcbiAgICAgICAgICAgIGF0dGFjaEFjdGlvbi5jYWxsKHRoaXMsIF9wYWdlLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJCh0aGlzKS5hdHRyKCdhY3Rpb24nKSxcbiAgICAgICAgICAgICAgICB0cmlnZ2VyOiAnY2xpY2snLFxuICAgICAgICAgICAgICAgIHRhcmdldDogJ3NlbGYnLFxuICAgICAgICAgICAgICAgIHBhcmFtczogKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyYW1zID0ge307XG4gICAgICAgICAgICAgICAgICAgICQoJCh0aGlzKS5nZXQoMCkuYXR0cmlidXRlcykuZWFjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgvXnBhcmFtLS8udGVzdCh0aGlzLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1zW3RoaXMubmFtZS5yZXBsYWNlKCdwYXJhbS0nLCAnJyldID0gdGhpcy52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICAgICAgICAgICAgfSkoKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuXG5cbiAgICB9O1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoJCh0aGlzKS5hdHRyKCdsYWJlbCcpKSB7XG4gICAgICAgICAgICAkKHRoaXMpLmh0bWwoJCh0aGlzKS5hdHRyKCdsYWJlbCcpKTtcbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLWJ1dHRvbicsIHsgcHJvdG90eXBlOiBwcm90bywgZXh0ZW5kcyA6ICdidXR0b24nfSk7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCBmYWN0b3J5IGZyb20gJy4uL3BhZ2UtZmFjdG9yeSc7XG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IEVsZW1lbnQgZnJvbSAnLi9hZS1lbGVtZW50JztcbmltcG9ydCBPYnNlcnZhYmxlT2JqZWN0IGZyb20gJy4uL09ic2VydmFibGVPYmplY3QnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBlYWNoKGluUGFnZSkge1xuICAgIGNvbnN0IF9wYWdlID0gaW5QYWdlO1xuICAgIGNvbnN0IF9wcml2YXRlID0gbmV3IFdlYWtNYXAoKTtcbiAgICBjb25zdCBfdGVtcGxhdGluZ0RlbGVnYXRlID0gZmFjdG9yeS5nZXRUZW1wbGF0aW5nRGVsZWdhdGUoKTtcblxuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoRWxlbWVudC5wcm90b3R5cGUpO1xuXG4gICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgJCh0aGlzKS5jaGlsZHJlbigpLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZiAoIShkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRoaXMudGFnTmFtZSkgaW5zdGFuY2VvZiBFbGVtZW50KSAmJiB0aGlzLm5vZGVOYW1lLnRvVXBwZXJDYXNlKCkgIT09ICdURU1QTEFURScpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2FlLWVhY2ggY2hpbGRyZW4gbXVzdCBiZSBlaXRoZXIgPGFlLS4uLj4gb3IgYSA8dGVtcGxhdGU+IGVsZW1lbnQuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBsZXQgdGVtcGxhdGVOYW1lID0gJCh0aGlzKS5hdHRyKCd0ZW1wbGF0ZScpO1xuICAgICAgICBpZiAoIXRlbXBsYXRlTmFtZSkge1xuICAgICAgICAgICAgbGV0IHRlbXBsYXRlID0gJCh0aGlzKS5maW5kKCc+dGVtcGxhdGUnKTtcblxuICAgICAgICAgICAgX3ByaXZhdGUuc2V0KHRoaXMsIHtcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZU5hbWU6IF90ZW1wbGF0aW5nRGVsZWdhdGUucmVnaXN0ZXJUZW1wbGF0ZSh0ZW1wbGF0ZS5odG1sKCkpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF9wcml2YXRlLnNldCh0aGlzLCB7XG4gICAgICAgICAgICAgICAgdGVtcGxhdGVOYW1lOiB0ZW1wbGF0ZU5hbWVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmICghJCh0aGlzKS5maW5kKCc+YWUtbWFuYWdlZCcpLmxlbmd0aCkge1xuICAgICAgICAgICAgJCh0aGlzKS5hcHBlbmQoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYWUtbWFuYWdlZCcpKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcm90by5hdHRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGxldCBkYXRhU291cmNlTmFtZSA9ICQodGhpcykuYXR0cignc291cmNlJyk7XG4gICAgICAgIGNvbnN0IHBhdGggPSAkKHRoaXMpLmF0dHIoJ3BhdGgnKTtcbiAgICAgICAgbGV0IGRhdGFTb3VyY2UgPSBfcGFnZS5nZXREYXRhU291cmNlKGRhdGFTb3VyY2VOYW1lKTtcbiAgICAgICAgY29uc3QgdGVtcGxhdGVOYW1lID0gX3ByaXZhdGUuZ2V0KHRoaXMpLnRlbXBsYXRlTmFtZTtcblxuICAgICAgICBjb25zdCBhcHBlbmRGbiA9IChpbkh0bWwpID0+IHtcbiAgICAgICAgICAgICQodGhpcykuZmluZCgnPmFlLW1hbmFnZWQnKS5hcHBlbmQoaW5IdG1sKTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBlcnJvckZuID0gKGluRXJyb3IpID0+IHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihpbkVycm9yKTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCByZW5kZXJGbiA9IChpbkRhdGEpID0+IHtcbiAgICAgICAgICAgICQodGhpcykuZmluZCgnPmFlLW1hbmFnZWQnKS5lbXB0eSgpO1xuICAgICAgICAgICAgaWYgKGluRGF0YSBpbnN0YW5jZW9mIE9ic2VydmFibGVPYmplY3QgKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaW5zdGFuY2Ugb2YgaW5EYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIF90ZW1wbGF0aW5nRGVsZWdhdGUucmVuZGVyKHRlbXBsYXRlTmFtZSwgaW5zdGFuY2UpXG4gICAgICAgICAgICAgICAgICAgICAgICAudGhlbihhcHBlbmRGbilcbiAgICAgICAgICAgICAgICAgICAgICAgIC5jYXRjaChlcnJvckZuKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIF90ZW1wbGF0aW5nRGVsZWdhdGUucmVuZGVyKHRlbXBsYXRlTmFtZSwgaW5EYXRhKVxuICAgICAgICAgICAgICAgICAgICAudGhlbihhcHBlbmRGbilcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGVycm9yRm4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGRhdGFTb3VyY2UuYmluZFBhdGgodGhpcywgcGF0aCwgKGluTmV3VmFsdWUpID0+IHtcbiAgICAgICAgICAgIHJlbmRlckZuKGluTmV3VmFsdWUpO1xuICAgICAgICB9KTtcbiAgICAgICAgZGF0YVNvdXJjZS5yZXNvbHZlKHRoaXMsIHBhdGgpLnRoZW4oKGluRGF0YSkgPT4ge1xuICAgICAgICAgICAgcmVuZGVyRm4oaW5EYXRhKTsgICAgXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICB9O1xuXG4gICAgcHJvdG8uZGV0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgfTtcblxuICAgIGRvY3VtZW50LnJlZ2lzdGVyRWxlbWVudCgnYWUtZWFjaCcsIHsgcHJvdG90eXBlOiBwcm90byB9KTtcbn1cbiIsImltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5pbXBvcnQgRWxlbWVudCBmcm9tICcuL2FlLWVsZW1lbnQnO1xuaW1wb3J0IG1pY3JvdGFzayBmcm9tICcuLi9taWNyb3Rhc2snO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzdGF0ZShpblBhZ2UpIHtcbiAgICAndXNlIHN0cmljdCc7XG4gICAgY29uc3QgX3BhZ2UgPSBpblBhZ2U7XG4gICAgdmFyIHByb3RvID0gT2JqZWN0LmNyZWF0ZShFbGVtZW50LnByb3RvdHlwZSk7XG5cbiAgICBwcm90by5jcmVhdGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc3QgY29tcG9uZW50ID0gX3BhZ2UucmVzb2x2ZU5vZGVDb21wb25lbnQodGhpcyk7XG4gICAgICAgIGNvbnN0IG1ldGhvZCA9ICQodGhpcykuYXR0cignbWV0aG9kJykgfHwgJ3JlbW92YWwnO1xuICAgICAgICBjb25zdCBzdGF0ZVBhdHRlcm4gPSBuZXcgUmVnRXhwKCQodGhpcykuYXR0cigncGF0dGVybicpIHx8ICdeJCcpO1xuICAgICAgICBjb25zdCB3YXRjaGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgJCh0aGlzKS5wcm9wKCd3aWxsUmVuZGVyJywgZmFsc2UpO1xuICAgICAgICAgICAgY29uc3QgY3VycmVudFN0YXRlID0gY29tcG9uZW50LmdldEN1cnJlbnRTdGF0ZSgpO1xuICAgICAgICAgICAgaWYgKHN0YXRlUGF0dGVybi50ZXN0KGN1cnJlbnRTdGF0ZS5nZXRQYXRoKCkpKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3Zpc2liaWxpdHknKSB7XG4gICAgICAgICAgICAgICAgICAgICQodGhpcykuY2hpbGRyZW4oKS5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgJCh0aGlzKS5yZW1vdmVDbGFzcygnaXMtaGlkZGVuJyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghJCh0aGlzKS5wcm9wKCd3YXNSZW5kZXJlZCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAkKHRoaXMpLmh0bWwodGhpcy5jb250ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICQodGhpcykucHJvcCgnd2FzUmVuZGVyZWQnLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbi8vICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdhYm91dCB0byBjYWxsIC5yZW5kZXJlZCBvbiAnICsgY3VycmVudFN0YXRlLmdldFBhdGgoKSk7XG4gICAgICAgICAgICAgICAgY3VycmVudFN0YXRlLnJlbmRlcmVkKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChtZXRob2QgPT09ICd2aXNpYmlsaXR5Jykge1xuICAgICAgICAgICAgICAgICAgICAkKHRoaXMpLmNoaWxkcmVuKCkuZWFjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICQodGhpcykuYWRkQ2xhc3MoJ2lzLWhpZGRlbicpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAkKHRoaXMpLmVtcHR5KCk7XG4gICAgICAgICAgICAgICAgICAgICQodGhpcykucHJvcCgnd2FzUmVuZGVyZWQnLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbXBvbmVudC53YXRjaFN0YXRlKCgpID0+IHtcbiAgICAgICAgICAgIGlmKCEkKHRoaXMpLnByb3AoJ3dpbGxSZW5kZXInKSkge1xuICAgICAgICAgICAgICAgICQodGhpcykucHJvcCgnd2lsbFJlbmRlcicsIHRydWUpO1xuICAgICAgICAgICAgICAgIG1pY3JvdGFzayh3YXRjaGVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuY29udGVudCA9ICQodGhpcykuaHRtbCgpO1xuICAgICAgICB3YXRjaGVyKCk7XG5cbiAgICB9O1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG5cbiAgICB9O1xuXG4gICAgcHJvdG8uZGV0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgfTtcblxuICAgIGRvY3VtZW50LnJlZ2lzdGVyRWxlbWVudCgnYWUtc3RhdGUnLCB7IHByb3RvdHlwZTogcHJvdG8gfSk7XG59XG4iLCIndXNlIHN0cmljdCc7XG4vKipcbiAqIEJpbmRzIGEgQnVzIGFjdGlvbiB0byB0aGUgcGFyZW50IG5vZGUuXG4gKlxuICogUGFyYW1zIGNhbiBiZSBwYXNzZWQgdGhyb3VnaCB0aGlzIGVsZW1lbnQncyBwYXJhbS14eHggYXR0cmlidXRlc1xuICogVGhlIHBhcmFtIHR5cGVzIGFyZSBpbmZlcnJlZDogbnVtYmVycywgYm9vbGVhbnMsIG51bGwuXG4gKiBJdCBpcyBwb3NzaWJsZSB0byBwYXNzIGFzIGEgcGFyYW0gYSByZWZlcmVuY2UgdG8gIHRoZSBjdXJyZW50IG1vZGVsJ3MgcHJvcGVydHlcbiAqIGJ5IHVzaW5nIGxlYWRpbmcgdGlsZGUgZm9sbG93ZWQgYnkgdGhlIG1vZGVsJ3MgcGF0aC4gRS5nLiBwYXJhbS11c2VyX25hbWU9XCJ+dXNlcl9wcm9maWxlLm5hbWVcIi5cbiAqIFVzaW5nIGp1c3QgYSB0aWxkZSB3aWxsIHBhc3MgdGhlIHdob2xlIG1vZGVsIG9iamVjdC5cbiAqIFRvIGZvcmNlIHZhbHVlcyB0byBiZSBldmFsdWF0ZWQgYXMgc3RyaW5ncywgd3JhcCBwYXJhbSB2YWx1ZSBpbiBiYWNrdGlja3MuIFxuICogRS5nLiBwYXJhbS1zdHJpbmdfdmFsdWU9XCJgMTIzYFwiXG4gKi9cblxuLypcbiAqIElNUFJPVkVNRU5UUzogYXQgdGhlIG1vbWVudCBvbmx5IHRoZSBsb2NhbCBkYXRhIG1vZGVsIGlzIGFsd2F5cyB1c2VkIGZvciBtb2RlbCBwYXRoIHJlc29sdXRpb25cbiAqIEkgc2hvdWxkIGV2YWx1YXRlIHRoZSBvcHRpb24gb2YgcGFzc2luZyB0aGUgYWN0aW9uIGhhbmRsZXIgYSBQcm9taXNlLCBpbiB0aGUgY2FzZSB3aGVyZVxuICogdGhlIHBhdGggcmVzb2x1dGlvbiByZXF1aXJlcyBhbiBhc3luYyBvcGVyYXRpb24uXG4gKiBUaGUgYXBwbGljYXRpb24gc2hvdWxkIGJlIGluZm9ybWVkIG9mIGEgcGVuZGluZyBvcGVyYXRpb24gc28gaXQgY291bGRcbiAqIHNob3cgYSBwcm9ncmVzcyBwYW5lbCwgd2hlcmUgYXBwcm9wcmlhdGVcbiAqIFRoaXMgaW52b2x2ZXMsIGFzaWRlIGZyb20gcGFzc2luZyBhIFByb21pc2UgdG8gdGhlIGFjdGlvbiBoYW5kbGVyLCBcbiAqIHRoZSByZXNvbHV0aW9uIG9mIGFsbCBwYXJhbWV0ZXJzIHRoYXQgY291bGQgcHJvdGVudGlhbGx5IG1ha2VcbiAqIHNlcGFyYXRlIGFzeW5jIG9wZXJhdGlvbnNcbiAqL1xuXG5cbmltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5pbXBvcnQgRWxlbWVudCBmcm9tICcuL2FlLWVsZW1lbnQnO1xuaW1wb3J0IGF0dGFjaEFjdGlvbiBmcm9tICcuLi9kZWxlZ2F0ZS9hY3Rpb24tdHJpZ2dlci1kZWxlZ2F0ZSc7XG5cbmxldCBfcGFnZTtcblxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhY3Rpb24oaW5QYWdlKSB7XG5cbiAgICBfcGFnZSA9IGluUGFnZTtcblxuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoRWxlbWVudC5wcm90b3R5cGUpO1xuXG4gICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICB9O1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBhdHRhY2hBY3Rpb24uY2FsbCh0aGlzLCBfcGFnZSwge1xuICAgICAgICAgICAgbmFtZTogJCh0aGlzKS5hdHRyKCduYW1lJyksXG4gICAgICAgICAgICB0cmlnZ2VyOiAkKHRoaXMpLmF0dHIoJ3RyaWdnZXInKSxcbiAgICAgICAgICAgIHRhcmdldDogJCh0aGlzKS5hdHRyKCd0YXJnZXQnKSxcbiAgICAgICAgICAgIHBhcmFtczogKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJhbXMgPSB7fTtcbiAgICAgICAgICAgICAgICAkKCQodGhpcykuZ2V0KDApLmF0dHJpYnV0ZXMpLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICgvXnBhcmFtLS8udGVzdCh0aGlzLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXNbdGhpcy5uYW1lLnJlcGxhY2UoJ3BhcmFtLScsICcnKV0gPSB0aGlzLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAgICAgIH0pKClcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLWFjdGlvbicsIHsgcHJvdG90eXBlOiBwcm90byB9KTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcbmltcG9ydCBlYWNoIGZyb20gJ2xvZGFzaC5mb3JlYWNoJztcbmltcG9ydCBpbmNsdWRlcyBmcm9tICdsb2Rhc2guaW5jbHVkZXMnO1xuaW1wb3J0IE9ic2VydmFibGVPYmplY3QgZnJvbSAnLi4vT2JzZXJ2YWJsZU9iamVjdCc7XG5cbmNsYXNzIElucHV0VmFsdWVDaGFuZ2VEZWxlZ2F0ZSB7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcblxuICAgIH1cblxuICAgIGNhbk91dHB1dFZhbHVlKGluRWxlbWVudCkge1xuICAgICAgICByZXR1cm4gKCghIWluRWxlbWVudCkgJiYgKFxuICAgICAgICAgICAgJChpbkVsZW1lbnQpLmdldCgwKSBpbnN0YW5jZW9mIEhUTUxJbnB1dEVsZW1lbnQgfHxcbiAgICAgICAgICAgICQoaW5FbGVtZW50KS5nZXQoMCkgaW5zdGFuY2VvZiBIVE1MVGV4dEFyZWFFbGVtZW50IHx8XG4gICAgICAgICAgICAkKGluRWxlbWVudCkuZ2V0KDApIGluc3RhbmNlb2YgSFRNTFNlbGVjdEVsZW1lbnQpKTtcbiAgICB9XG5cbiAgICBvblZhbHVlQ2hhbmdlKGluRWxlbWVudCwgaW5Db25maWcsIGluSGFuZGxlcikge1xuICAgICAgICBjb25zdCBkZWxheSA9ICFpc05hTihpbkNvbmZpZy5kZWxheSkgPyBOdW1iZXIoaW5Db25maWcuZGVsYXkpIDogbnVsbDtcbiAgICAgICAgY29uc3QgY29tbWl0T25seSA9IGluQ29uZmlnLmNvbW1pdE9ubHkgPT09IHRydWU7XG4gICAgICAgIGxldCBldmVudHMgPSBpbkNvbmZpZy5ldmVudDtcbiAgICAgICAgaWYgKCFldmVudHMpIHtcblxuICAgICAgICAgICAgc3dpdGNoICgkKGluRWxlbWVudCkuZ2V0KDApLm5vZGVOYW1lLnRvVXBwZXJDYXNlKCkpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdJTlBVVCc6XG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHR5cGUgPSAoJChpbkVsZW1lbnQpLmF0dHIoJ3R5cGUnKSB8fCAnVEVYVCcpLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5jbHVkZXMoWydURVhUJywgJ0VNQUlMJywgJ1RFTCcsICdQQVNTV09SRCddLCB0eXBlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50cyA9ICdjaGFuZ2Usa2V5dXAnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpbmNsdWRlcyhbJ0NIRUNLQk9YJywgJ1JBRElPJ10sIHR5cGUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRzID0gJ2NsaWNrJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdTRUxFQ1QnOlxuICAgICAgICAgICAgICAgICAgICBldmVudHMgPSAnY2hhbmdlJztcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzID0gJ2tleWRvd24nO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGxldCBkZWxheWVkVGltZW91dDtcblxuICAgICAgICBjb25zdCBkZWZhdWx0SGFuZGxlciA9ICgpID0+IHtcbiAgICAgICAgICAgIGluSGFuZGxlcih7XG4gICAgICAgICAgICAgICAgdmFsdWU6IHRoaXMuZ2V0VmFsdWUoaW5FbGVtZW50KSxcbiAgICAgICAgICAgICAgICBrZXk6ICQoaW5FbGVtZW50KS5hdHRyKCduYW1lJylcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHRpbWVvdXRIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgZGVmYXVsdEhhbmRsZXIoKTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBkZWxheWVkSGFuZGxlciA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmIChkZWxheWVkVGltZW91dCA9PT0gdW5kZWZpbmVkIHx8ICEhZGVsYXllZFRpbWVvdXQpIHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQoZGVsYXllZFRpbWVvdXQpO1xuICAgICAgICAgICAgICAgIGRlbGF5ZWRUaW1lb3V0ID0gc2V0VGltZW91dCh0aW1lb3V0SGFuZGxlciwgZGVsYXkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZWxheWVkVGltZW91dCA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGltZW91dEhhbmRsZXIoKTtcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgIH07XG5cblxuXG4gICAgICAgIGNvbnN0IGhhbmRsZXIgPSAoIWlzTmFOKGRlbGF5KSA/IGRlbGF5ZWRIYW5kbGVyIDogZGVmYXVsdEhhbmRsZXIpO1xuXG4gICAgICAgIGVhY2goZXZlbnRzLnNwbGl0KCcsJyksIChldmVudE5hbWUpID0+IHtcbiAgICAgICAgICAgICQoaW5FbGVtZW50KS5vZmYoZXZlbnROYW1lLCBoYW5kbGVyKS5vbihldmVudE5hbWUsIGhhbmRsZXIpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBzZXRWYWx1ZShpbkVsZW1lbnQsIGluVmFsdWUsIGluUHJvcE5hbWUpIHtcbiAgICAgICAgaW5FbGVtZW50ID0gJChpbkVsZW1lbnQpO1xuICAgICAgICBpZiAoISQoaW5FbGVtZW50KS5nZXQoMCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBuYW1lID0gaW5FbGVtZW50LmF0dHIoJ25hbWUnKTtcbiAgICAgICAgaWYgKCQoaW5FbGVtZW50KS5nZXQoMCkubm9kZU5hbWUudG9VcHBlckNhc2UoKSA9PT0gJ0lOUFVUJykge1xuICAgICAgICAgICAgY29uc3QgdHlwZSA9ICgkKGluRWxlbWVudCkuYXR0cigndHlwZScpIHx8ICdURVhUJykudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ1RFWFQnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ0VNQUlMJzpcbiAgICAgICAgICAgICAgICBjYXNlICdURUwnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ1BBU1NXT1JEJzpcbiAgICAgICAgICAgICAgICAgICAgaWYgKCQoaW5FbGVtZW50KS52YWwoKSAhPT0gaW5WYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgJChpbkVsZW1lbnQpLnZhbChpblZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdDSEVDS0JPWCc6XG4gICAgICAgICAgICAgICAgICAgICQoaW5FbGVtZW50KS5wcm9wKCdjaGVja2VkJywgaW5WYWx1ZSA9PT0gdHJ1ZSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgKCEhaW5WYWx1ZSAmJiBpblZhbHVlID09PSBpbkVsZW1lbnQuYXR0cigndmFsdWUnKSkpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdSQURJTyc6XG4gICAgICAgICAgICAgICAgICAgICQoaW5FbGVtZW50KS5wcm9wKCdjaGVja2VkJywgaW5WYWx1ZSA9PT0gaW5FbGVtZW50LmF0dHIoJ3ZhbHVlJykpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAoJChpbkVsZW1lbnQpLmdldCgwKS5ub2RlTmFtZS50b1VwcGVyQ2FzZSgpID09PSAnU0VMRUNUJykge1xuICAgICAgICAgICAgJChpbkVsZW1lbnQpLmZpbmQoJ29wdGlvblt2YWx1ZT0nICsgaW5WYWx1ZSArICddJykuZWFjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAkKHRoaXMpLnByb3AoJ2NoZWNrZWQnLCBpblZhbHVlID09PSBpbkVsZW1lbnQuYXR0cigndmFsdWUnKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgZ2V0VmFsdWUoaW5FbGVtZW50KSB7XG4gICAgICAgIGlmICghJChpbkVsZW1lbnQpLmdldCgwKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRhcmdldFZhbHVlID0gJChpbkVsZW1lbnQpLmF0dHIoJ3ZhbHVlJyk7XG4gICAgICAgIGlmICgkKGluRWxlbWVudCkuZ2V0KDApLm5vZGVOYW1lLnRvVXBwZXJDYXNlKCkgPT09ICdJTlBVVCcpIHtcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSAoJChpbkVsZW1lbnQpLmF0dHIoJ3R5cGUnKSB8fCAnVEVYVCcpLnRvVXBwZXJDYXNlKCk7XG5cbiAgICAgICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ1RFWFQnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ0VNQUlMJzpcbiAgICAgICAgICAgICAgICBjYXNlICdURUwnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ1BBU1NXT1JEJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICQoaW5FbGVtZW50KS52YWwoKTtcbiAgICAgICAgICAgICAgICBjYXNlICdDSEVDS0JPWCc6XG4gICAgICAgICAgICAgICAgICAgIGlmICgkKGluRWxlbWVudCkucHJvcCgnY2hlY2tlZCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gISF0YXJnZXRWYWx1ZSA/IHRhcmdldFZhbHVlIDogJChpbkVsZW1lbnQpLnByb3AoJ2NoZWNrZWQnKSA9PT0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gISF0YXJnZXRWYWx1ZSA/IG51bGwgOiBmYWxzZTtcbiAgICAgICAgICAgICAgICBjYXNlICdSQURJTyc6IC8vanNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZvcm0gPSAkKGluRWxlbWVudCkuY2xvc2VzdCgnZm9ybScpLmdldCgwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZm9ybSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW5wdXQgZWxlbWVudHMgbXVzdCBiZSBlbmNsb3NlZCBpbiBhIGZvcm0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzZWxlY3RlZCA9ICQoZm9ybSkuZmluZChgcmFkaW9bbmFtZT0keyQoaW5FbGVtZW50KS5hdHRyKCduYW1lJyl9XTpjaGVja2VkYCkuZ2V0KDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzZWxlY3RlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICQoc2VsZWN0ZWQpLnZhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoJChpbkVsZW1lbnQpLmdldCgwKS5ub2RlTmFtZS50b1VwcGVyQ2FzZSgpID09PSAnVEVYVEFSRUEnKSB7XG4gICAgICAgICAgICByZXR1cm4gJChpbkVsZW1lbnQpLnZhbCgpO1xuICAgICAgICB9IGVsc2UgaWYgKCQoaW5FbGVtZW50KS5nZXQoMCkubm9kZU5hbWUudG9VcHBlckNhc2UoKSA9PT0gJ1NFTEVDVCcpIHtcbiAgICAgICAgICAgIGxldCBvdXQgPSBbXTtcbiAgICAgICAgICAgICQoaW5FbGVtZW50KS5maW5kKCdvcHRpb246c2VsZWN0ZWQnKS5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIG91dC5wdXNoKCQodGhpcykudmFsKCkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoISQoaW5FbGVtZW50KS5wcm9wKCdtdWx0aXBsZScpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG91dFswXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBvdXQ7XG4gICAgICAgIH1cbiAgICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IElucHV0VmFsdWVDaGFuZ2VEZWxlZ2F0ZSgpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IEVsZW1lbnQgZnJvbSAnLi9hZS1lbGVtZW50JztcbmltcG9ydCBpc1N0cmluZyBmcm9tICdsb2Rhc2guaXNTdHJpbmcnO1xuaW1wb3J0IGVhY2ggZnJvbSAnbG9kYXNoLmZvcmVhY2gnO1xuaW1wb3J0IHZhbHVlQ2hhbmdlRGVsZWdhdGUgZnJvbSAnLi4vZGVsZWdhdGUvdmFsdWUtY2hhbmdlLWRlbGVnYXRlJztcblxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBiaW5kKGluUGFnZSkge1xuICAgIGNvbnN0IF9wYWdlID0gaW5QYWdlO1xuICAgIGNvbnN0IF9wcml2YXRlID0gbmV3IFdlYWtTZXQoKTtcblxuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoRWxlbWVudC5wcm90b3R5cGUpO1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoJCh0aGlzKS5hdHRyKCdwYXRoJykgJiYgKCQodGhpcykuYXR0cignZnJvbScpICYmICQodGhpcykuYXR0cigndG8nKSkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignYWUtYmluZCBhdHRyaWJ1dGUgXCJwYXRoXCIgaXMgaWdub3JlZCB3aGVuIGVpdGhlciBcImZyb21cIiBvciBcInRvXCIgYXJlIHNwZWNpZmllZDogXFxuTm9kZTonKTtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybih0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB0YXJnZXQ7XG4gICAgICAgIGlmICgkKHRoaXMpLmNoaWxkcmVuKCkubGVuZ3RoKSB7XG4gICAgICAgICAgICB0YXJnZXQgPSAkKHRoaXMpLmNoaWxkcmVuKCkuZ2V0KDApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0QXR0ciA9ICQodGhpcykuYXR0cigndGFyZ2V0Jyk7XG4gICAgICAgICAgICBpZiAoIXRhcmdldEF0dHIpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSAkKHRoaXMpLnBhcmVudCgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0YXJnZXRBdHRyID09PSAnbmV4dCcpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSAkKHRoaXMpLm5leHQoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoL15jbG9zZXN0Ly50ZXN0KHRhcmdldEF0dHIpKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2VncyA9IHRhcmdldEF0dHIuc3BsaXQoL1xccysvKTtcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSAkKHRoaXMpLmNsb3Nlc3Qoc2Vnc1sxXSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKC9eKFxcLnxcXCMpLy50ZXN0KHRhcmdldEF0dHIpKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gJCh0aGlzKS5wYXJlbnQoKS5maW5kKHRhcmdldEF0dHIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1Vua25vd24gYWUtYmluZCB0YXJnZXQ6ICcgKyB0YXJnZXRBdHRyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBkYXRhU291cmNlTmFtZSA9ICQodGhpcykuYXR0cignc291cmNlJyk7XG4gICAgICAgIGNvbnN0IHBhdGggPSAkKHRoaXMpLmF0dHIoJ3BhdGgnKTtcbiAgICAgICAgbGV0IGRhdGFTb3VyY2UgPSBfcGFnZS5nZXREYXRhU291cmNlKGRhdGFTb3VyY2VOYW1lKTtcbiAgICAgICAgaWYgKCFkYXRhU291cmNlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBiaW5kIHRvIGRhdGEtc291cmNlOiAnICsgZGF0YVNvdXJjZU5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHVzZVBhdGggPSBwYXRoICYmICEkKHRoaXMpLmF0dHIoJ2Zyb20nKSAmJiAhJCh0aGlzKS5hdHRyKCd0bycpO1xuICAgICAgICBjb25zdCB0b0F0dHIgPSB1c2VQYXRoID8gcGF0aCA6ICQodGhpcykuYXR0cigndG8nKTtcbiAgICAgICAgY29uc3QgZnJvbUF0dHIgPSB1c2VQYXRoID8gcGF0aCA6ICQodGhpcykuYXR0cignZnJvbScpO1xuICAgICAgICBsZXQgaW5BdHRyID0gJCh0aGlzKS5hdHRyKCdpbicpIHx8ICcnO1xuICAgICAgICBjb25zdCBpc0Zvcm1FbGVtZW50ID0gdmFsdWVDaGFuZ2VEZWxlZ2F0ZS5jYW5PdXRwdXRWYWx1ZSh0YXJnZXQpO1xuXG4gICAgICAgIGlmICghaW5BdHRyICYmIGlzRm9ybUVsZW1lbnQpIHtcbiAgICAgICAgICAgIGluQXR0ciA9ICdmb3JtLWVsZW1lbnQtdmFsdWUnO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmcm9tQXR0cikge1xuICAgICAgICAgICAgbGV0IG5vZGVBdHRyID0gaW5BdHRyLnNwbGl0KCc6Jyk7XG4gICAgICAgICAgICBub2RlQXR0clswXSA9IG5vZGVBdHRyWzBdIHx8ICdodG1sJztcblxuICAgICAgICAgICAgaWYgKG5vZGVBdHRyWzBdID09PSAnaHRtbCcpIHtcbiAgICAgICAgICAgICAgICAkKHRhcmdldCkuYXR0cignZGF0YS1hZS1iaW5kLWh0bWwnLCBmcm9tQXR0cik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHZhbHVlUmVzb2x2ZXIgPSAoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBjb25kaXRpb24gPSAkKHRoaXMpLmF0dHIoJ2lmJyk7XG4gICAgICAgICAgICAgICAgbGV0IGNvbmRpdGlvbk1ldCA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKGNvbmRpdGlvbikge1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCBuZWdhdGUgPVxuICAgICAgICAgICAgICAgICAgICAgICAgKCEhY29uZGl0aW9uICYmIC9eIS8udGVzdChjb25kaXRpb24pKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb24gPSBjb25kaXRpb24ucmVwbGFjZSgvXiEvLCAnJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmRpdGlvbiAmJiAvXlxcLy4qXFwvJC8udGVzdChjb25kaXRpb24pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25kaXRpb24gPSBuZXcgUmVnRXhwKGNvbmRpdGlvbi5yZXBsYWNlKC9eXFwvLywgJycpLnJlcGxhY2UoL1xcLyQvLCAnJykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9uTWV0ID0gY29uZGl0aW9uLnRlc3QoaW5WYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNTdHJpbmcoY29uZGl0aW9uKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoL14odHJ1ZXxmYWxzZSkkLy50ZXN0KGNvbmRpdGlvbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25kaXRpb24gPSBCb29sZWFuKGNvbmRpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25NZXQgPSAoY29uZGl0aW9uID09PSBpblZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25NZXQgPSBjb25kaXRpb25NZXQgJiYgIW5lZ2F0ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzd2l0Y2ggKG5vZGVBdHRyWzBdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2h0bWwnOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmRpdGlvbk1ldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQodGFyZ2V0KS5odG1sKGluVmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2F0dHInOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmRpdGlvbk1ldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQodGFyZ2V0KS5hdHRyKG5vZGVBdHRyWzFdLCBpblZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdjbGFzcyc6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29uZGl0aW9uTWV0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCh0YXJnZXQpLmFkZENsYXNzKG5vZGVBdHRyWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCh0YXJnZXQpLnJlbW92ZUNsYXNzKG5vZGVBdHRyWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdmb3JtLWVsZW1lbnQtdmFsdWUnOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmRpdGlvbk1ldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlQ2hhbmdlRGVsZWdhdGUuc2V0VmFsdWUodGFyZ2V0LCBpblZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdJIGRvblxcJ3Qga25vdyBob3cgdG8gYmluZCB2YWx1ZSB0byBlbGVtZW50Jyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBkYXRhU291cmNlLmJpbmRQYXRoKHRoaXMsIGZyb21BdHRyLCBmdW5jdGlvbihpbk5ld1ZhbHVlLCBpbk9sZFZhbHVlKSB7XG4gICAgICAgICAgICAgICAgaWYoaW5OZXdWYWx1ZSAhPT0gaW5PbGRWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZVJlc29sdmVyKGluTmV3VmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkYXRhU291cmNlLnJlc29sdmUodGhpcywgZnJvbUF0dHIpLnRoZW4oKGluVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICB2YWx1ZVJlc29sdmVyKGluVmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0b0F0dHIpIHtcbiAgICAgICAgICAgIGlmICghaXNGb3JtRWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRWxlbWVudCAnICsgJCh0YXJnZXQpLmdldCgwKS5ub2RlTmFtZSArICcgY2Fubm90IGJlIHVzZWQgYXMgYSBzb3VyY2Ugb2YgYmluZGluZyBvdXRwdXQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG91dE9wdGlvbnMgPSB7fTtcbiAgICAgICAgICAgIGVhY2godGhpcy5hdHRyaWJ1dGVzLCAoaW5BdHRyaWJ1dGUpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoL15vdXQtLy50ZXN0KGluQXR0cmlidXRlLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIG91dE9wdGlvbnNbaW5BdHRyaWJ1dGUubmFtZS5yZXBsYWNlKC9eb3V0LS8sICcnKV0gPSBpbkF0dHJpYnV0ZS52YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHZhbHVlQ2hhbmdlRGVsZWdhdGUub25WYWx1ZUNoYW5nZSh0YXJnZXQsIG91dE9wdGlvbnMsIChpblZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgZGF0YVNvdXJjZS5zZXRQYXRoKHRoaXMsIHRvQXR0ciwgaW5WYWx1ZS52YWx1ZSA9PSBudWxsID8gbnVsbCA6IGluVmFsdWUudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuXG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLWJpbmQnLCB7IHByb3RvdHlwZTogcHJvdG8gfSk7XG59XG4iLCJpbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IG1pY3JvdGFzayBmcm9tICcuLi9taWNyb3Rhc2snO1xuaW1wb3J0IEVsZW1lbnQgZnJvbSAnLi9hZS1lbGVtZW50JztcbmltcG9ydCBmYWN0b3J5IGZyb20gJy4uL3BhZ2UtZmFjdG9yeSc7XG5pbXBvcnQgT2JzZXJ2YWJsZU9iamVjdCBmcm9tICcuLi9PYnNlcnZhYmxlT2JqZWN0JztcbmltcG9ydCB0cmFuc2Zvcm0gZnJvbSAnbG9kYXNoLnRyYW5zZm9ybSc7XG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByZW5kZXIoaW5QYWdlKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuICAgIGNvbnN0IF9wcml2YXRlID0gbmV3IFdlYWtNYXAoKTtcbiAgICBjb25zdCBfcGFnZSA9IGluUGFnZTtcbiAgICB2YXIgcHJvdG8gPSBPYmplY3QuY3JlYXRlKEVsZW1lbnQucHJvdG90eXBlKTtcblxuICAgIGNvbnN0IGludmFsaWRhdGUgPSBmdW5jdGlvbiBpbnZhbGlkYXRlKCkge1xuICAgICAgICBpZiAoIV9wcml2YXRlLmdldCh0aGlzKS53aWxsUmVuZGVyKSB7XG4gICAgICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykud2lsbFJlbmRlciA9IHRydWU7XG4gICAgICAgICAgICBtaWNyb3Rhc2socmVuZGVyLmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHZhciByZW5kZXIgPSBmdW5jdGlvbiByZW5kZXIoKSB7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS53aWxsUmVuZGVyID0gZmFsc2U7XG4gICAgICAgIC8vIGlmICgkKHRoaXMpLmF0dHIoJ2RlYnVnLW5hbWUnKSkge1xuICAgICAgICAvLyAgICAgY29uc29sZS5pbmZvKCQodGhpcykuYXR0cignZGVidWctbmFtZScpICsgJyB3aWxsIHJlbmRlcicpO1xuICAgICAgICAvLyB9XG5cbiAgICAgICAgbGV0IHRlbXBsYXRlTmFtZSA9ICQodGhpcykuYXR0cigndGVtcGxhdGUnKTtcblxuICAgICAgICBjb25zdCBwYXRoID0gJCh0aGlzKS5hdHRyKCdmcm9tJykgfHwgJy4nO1xuICAgICAgICBfcGFnZS5nZXREYXRhU291cmNlKCkucmVzb2x2ZSh0aGlzLCBwYXRoKS50aGVuKChpblZhbHVlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBhdHRycyA9IHRyYW5zZm9ybSh0aGlzLmF0dHJpYnV0ZXMsIGZ1bmN0aW9uKHJlc3VsdCwgaXRlbSkge1xuICAgICAgICAgICAgICAgIGl0ZW0uc3BlY2lmaWVkICYmIC9ecGFyYW0tLy50ZXN0KGl0ZW0ubmFtZSkgJiYgKHJlc3VsdFtpdGVtLm5hbWUucmVwbGFjZSgncGFyYW0tJywgJycpXSA9IGl0ZW0udmFsdWUpOyAvL2pzaGludCBpZ25vcmU6bGluZVxuICAgICAgICAgICAgfSwge30pO1xuXG4gICAgICAgICAgICBmYWN0b3J5LmdldFRlbXBsYXRpbmdEZWxlZ2F0ZSgpXG4gICAgICAgICAgICAgICAgLnJlbmRlcih0ZW1wbGF0ZU5hbWUsIGluVmFsdWUgfHwge30pXG4gICAgICAgICAgICAgICAgLnRoZW4oKGluSHRtbCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAkKHRoaXMpLmZpbmQoJz5hZS1tYW5hZ2VkJykuaHRtbChpbkh0bWwpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKChpbkVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoaW5FcnJvcik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pLmNhdGNoKChpbkVycm9yKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGluRXJyb3IpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIHByb3RvLmNyZWF0ZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBfcHJpdmF0ZS5zZXQodGhpcywgeyB3aWxsUmVuZGVyOiBmYWxzZSB9KTtcbiAgICAgICAgbGV0IHRlbXBsYXRlTmFtZSA9ICQodGhpcykuYXR0cigndGVtcGxhdGUnKTtcbiAgICAgICAgaWYgKCF0ZW1wbGF0ZU5hbWUpIHtcbiAgICAgICAgICAgIGxldCB0ZW1wbGF0ZSA9ICQodGhpcykuZmluZCgnPnRlbXBsYXRlJyk7XG4gICAgICAgICAgICBpZiAoIXRlbXBsYXRlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCQodGhpcykuZ2V0UGF0aCgpICsgJyBtdXN0IGhhdmUgYSB0ZW1wbGF0ZSBhdHRyaWJ1dGUgb3IgYSB0ZW1wbGF0ZSBlbGVtZW50Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0ZW1wbGF0ZU5hbWUgPSBmYWN0b3J5LmdldFRlbXBsYXRpbmdEZWxlZ2F0ZSgpXG4gICAgICAgICAgICAgICAgLnJlZ2lzdGVyVGVtcGxhdGUodGVtcGxhdGUuaHRtbCgpKTtcbiAgICAgICAgICAgICQodGhpcykuYXR0cigndGVtcGxhdGUnLCB0ZW1wbGF0ZU5hbWUpO1xuICAgICAgICAgICAgJCh0aGlzKS5lbXB0eSgpO1xuICAgICAgICB9XG4gICAgICAgICQodGhpcykuYXBwZW5kKCc8YWUtbWFuYWdlZD48L2FlLW1hbmFnZWQ+Jyk7XG4gICAgfTtcblxuICAgIHByb3RvLmF0dGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICBpbnZhbGlkYXRlLmNhbGwodGhpcyk7XG4gICAgICAgIHZhciBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMpID0+IHtcbiAgICAgICAgICAgIG11dGF0aW9ucy5mb3JFYWNoKChtdXRhdGlvbikgPT4ge1xuICAgICAgICAgICAgICAgIGlmICgvXnBhcmFtLS8udGVzdChtdXRhdGlvbi5hdHRyaWJ1dGVOYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICBpbnZhbGlkYXRlLmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIGNvbmZpZ3VyYXRpb24gb2YgdGhlIG9ic2VydmVyOlxuICAgICAgICB2YXIgY29uZmlnID0geyBhdHRyaWJ1dGVzOiB0cnVlIH07XG5cbiAgICAgICAgLy8gcGFzcyBpbiB0aGUgdGFyZ2V0IG5vZGUsIGFzIHdlbGwgYXMgdGhlIG9ic2VydmVyIG9wdGlvbnNcbiAgICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLCBjb25maWcpO1xuXG4gICAgICAgIGNvbnN0IHBhdGggPSAkKHRoaXMpLmF0dHIoJ2Zyb20nKTtcbiAgICAgICAgX3BhZ2UuZ2V0RGF0YVNvdXJjZSgpLmJpbmRQYXRoKHRoaXMsIHBhdGgsIChpbkJhc2VNb2RlbCkgPT4ge1xuXG4gICAgICAgICAgICBpZiAoaW5CYXNlTW9kZWwgaW5zdGFuY2VvZiBPYnNlcnZhYmxlT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgaW5CYXNlTW9kZWwud2F0Y2gocGF0aCwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpbnZhbGlkYXRlLmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGludmFsaWRhdGUuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGludmFsaWRhdGUuY2FsbCh0aGlzKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICgkKHRoaXMpLmF0dHIoJ3dhdGNoJykpIHtcbiAgICAgICAgICAgIF9wYWdlLmdldERhdGFTb3VyY2UoKS5iaW5kUGF0aCh0aGlzLCAkKHRoaXMpLmF0dHIoJ3dhdGNoJyksIChpbkJhc2VNb2RlbCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaW52YWxpZGF0ZS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBwcm90by5kZXRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICB9O1xuXG4gICAgZG9jdW1lbnQucmVnaXN0ZXJFbGVtZW50KCdhZS1yZW5kZXInLCB7IHByb3RvdHlwZTogcHJvdG8gfSk7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5pbXBvcnQgRWxlbWVudCBmcm9tICcuL2FlLWVsZW1lbnQnO1xuXG4vKipcbiogICBBIGNvbnRhaW5lciBmb3IgZWxlbWVudCB0aGF0IGNoYW5nZSB0aGUgdmFsdWUgb2YgYSBwcm9wZXJ0eSBiYXNlZCBvbiBcbiogICBzZWxlY3Rpb24gb2YgaXRzIGNoaWxkcmVuLiBJdCBiZWhhdmVzIGxpa2UgYSByYWRpbyBncm91cC5cbiogICBpZiBubyBwYXRoIGF0dHJpYnV0ZSBpcyBmb3VuZCwgdGhlIHN3aXRjaCB0YXJnZXRzIHRoZSBjb21wb25lbnQncyBzdGF0ZVxuKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGFlU3dpdGNoKGluUGFnZSkge1xuICAgIGNvbnN0IF9wYWdlID0gaW5QYWdlO1xuICAgIGNvbnN0IF9wcml2YXRlID0gbmV3IFdlYWtNYXAoKTtcblxuICAgIGNvbnN0IHNlbGVjdEhhbmRsZXIgPSBmdW5jdGlvbiBzZWxlY3RIYW5kbGVyKGluU2VsZWN0ZWRFbGVtZW50KSB7XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgICAgICBjb25zdCB2YWwgPSAkKGluU2VsZWN0ZWRFbGVtZW50KS5kYXRhKCdhZS1zd2l0Y2gtdmFsdWUnKTtcbiAgICAgICAgJCh0aGlzKS5jaGlsZHJlbigpLnJlbW92ZUNsYXNzKF9wLnNlbGVjdGVkQ2xhc3MpO1xuICAgICAgICAkKGluU2VsZWN0ZWRFbGVtZW50KS5hZGRDbGFzcyhfcC5zZWxlY3RlZENsYXNzKTtcbiAgICAgICAgaWYoIV9wLnNvdXJjZSkge1xuICAgICAgICAgICAgX3AudGFyZ2V0LnRyeVN0YXRlKHZhbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfcGFnZS5yZXNvbHZlTm9kZUNvbXBvbmVudCh0aGlzKTtcbiAgICAgICAgICAgIF9wYWdlLmdldERhdGFTb3VyY2UoKS5zZXRQYXRoKHRoaXMsIF9wLnNvdXJjZSwgdmFsKTtcblxuICAgICAgICB9XG4gICAgICAgIC8vY29uc29sZS5sb2coJ3N3aXRjaCBlbGVtZW50IGNsaWNrZWQ6ICcgKyAkKGluU2VsZWN0ZWRFbGVtZW50KS5kYXRhKCdhZS1zd2l0Y2gtdmFsdWUnKSk7XG4gICAgfTtcbiAgICBcbiAgICB2YXIgcHJvdG8gPSBPYmplY3QuY3JlYXRlKEhUTUxVTGlzdEVsZW1lbnQucHJvdG90eXBlKTtcbiAgICBwcm90by5jcmVhdGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgX3ByaXZhdGUuc2V0KHRoaXMsIHtcbiAgICAgICAgICAgIHNlbGVjdGVkQ2xhc3M6ICQodGhpcykuYXR0cignc2VsZWN0ZWQtY2xhc3MnKSB8fCAnc2VsZWN0ZWQnLFxuICAgICAgICAgICAgc291cmNlIDogJCh0aGlzKS5hdHRyKCdwYXRoJykgfHwgbnVsbFxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIFxuICAgIHByb3RvLmF0dGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgICAgICBfcC50YXJnZXQgPSBfcGFnZS5yZXNvbHZlTm9kZUNvbXBvbmVudCh0aGlzKTtcbiAgICAgICAgbGV0IGRlZmF1bHRTd2l0Y2g7XG4gICAgICAgICQodGhpcykuY2hpbGRyZW4oKS5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYoJCh0aGlzKS5kYXRhKCdhZS1zd2l0Y2gtdmFsdWUnKSA9PT0gJCh0aGF0KS5hdHRyKCdkZWZhdWx0LXZhbHVlJykpIHtcbiAgICAgICAgICAgICAgICBkZWZhdWx0U3dpdGNoID0gJCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICQodGhpcykub2ZmKCdjbGljaycsIHNlbGVjdEhhbmRsZXIpLm9uKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgICAgICBzZWxlY3RIYW5kbGVyLmNhbGwodGhhdCwgdGhpcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmKGRlZmF1bHRTd2l0Y2gpIHtcbiAgICAgICAgICAgICAgICBzZWxlY3RIYW5kbGVyLmNhbGwodGhhdCwgZGVmYXVsdFN3aXRjaCk7XG4gICAgICAgICAgICB9XG4gICAgICAgfSk7XG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLXN3aXRjaCcsIHsgcHJvdG90eXBlOiBwcm90bywgZXh0ZW5kcyA6ICd1bCcgfSk7XG59XG4iLCJpbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IEVsZW1lbnQgZnJvbSAnLi9hZS1lbGVtZW50JztcbmltcG9ydCBlYWNoIGZyb20gJ2xvZGFzaC5mb3JlYWNoJztcbmltcG9ydCB1dWlkIGZyb20gJ25vZGUtdXVpZCc7XG5pbXBvcnQgYXR0YWNoQWN0aW9uIGZyb20gJy4uL2RlbGVnYXRlL2FjdGlvbi10cmlnZ2VyLWRlbGVnYXRlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYWVUZXh0SW5wdXQoaW5QYWdlKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuICAgIGNvbnN0IF9wYWdlID0gaW5QYWdlO1xuICAgIGxldCBvYnNlcnZlcjtcbiAgICBkb2N1bWVudC5zdHlsZVNoZWV0c1swXS5pbnNlcnRSdWxlKCdhZS1pbnB1dCcgKyAneyBkaXNwbGF5OiBibG9jazt9JywgMSk7XG4gICAgdmFyIHByb3RvID0gT2JqZWN0LmNyZWF0ZShFbGVtZW50LnByb3RvdHlwZSk7XG4gICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihmdW5jdGlvbihtdXRhdGlvbnMpIHtcbiAgICAgICAgICAgIG11dGF0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKG11dGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChtdXRhdGlvbi5hdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2xhYmVsJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICQobXV0YXRpb24udGFyZ2V0KS5maW5kKCdsYWJlbD5zcGFuJykudGV4dCgkKG11dGF0aW9uLnRhcmdldCkuYXR0cignbGFiZWwnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAndmFsdWUnOlxuICAgICAgICAgICAgICAgICAgICAgICAgJChtdXRhdGlvbi50YXJnZXQpLmZpbmQoJ2lucHV0JykuYXR0cigndmFsdWUnLCAkKG11dGF0aW9uLnRhcmdldCkuYXR0cigndmFsdWUnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbGFiZWwtY2xhc3MnOlxuICAgICAgICAgICAgICAgICAgICAgICAgJChtdXRhdGlvbi50YXJnZXQpLmZpbmQoJ2xhYmVsJykuYXR0cignY2xhc3MnLCAkKG11dGF0aW9uLnRhcmdldCkuYXR0cignbGFiZWwtY2xhc3MnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnaW5wdXQtY2xhc3MnOlxuICAgICAgICAgICAgICAgICAgICAgICAgJChtdXRhdGlvbi50YXJnZXQpLmZpbmQoJ2lucHV0JykuYXR0cignY2xhc3MnLCAkKG11dGF0aW9uLnRhcmdldCkuYXR0cignaW5wdXQtY2xhc3MnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKCQodGhpcykuYXR0cignYmluZC1lbmFibGVkJykpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhdGggPSAkKHRoaXMpLmF0dHIoJ2JpbmQtZW5hYmxlZCcpLnJlcGxhY2UoJyEnLCAnJyk7XG4gICAgICAgICAgICBjb25zdCBuZWdhdGUgPSAvXiEvLnRlc3QoJCh0aGlzKS5hdHRyKCdiaW5kLWVuYWJsZWQnKSk7XG4gICAgICAgICAgICBjb25zdCBzb3VyY2UgPSAkKHRoaXMpLmF0dHIoJ3NvdXJjZScpO1xuICAgICAgICAgICAgY29uc3Qgc2V0VmFsdWUgPSAoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICQodGhpcykuZmluZCgnaW5wdXQnKS5wcm9wKCdkaXNhYmxlZCcsXG4gICAgICAgICAgICAgICAgICAgICgoaW5WYWx1ZSA9PT0gZmFsc2UpICYmICFuZWdhdGUpIHx8XG4gICAgICAgICAgICAgICAgICAgICgoaW5WYWx1ZSAhPT0gZmFsc2UpICYmIG5lZ2F0ZSkpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgX3BhZ2VcbiAgICAgICAgICAgICAgICAuZ2V0RGF0YVNvdXJjZShzb3VyY2UpXG4gICAgICAgICAgICAgICAgLmJpbmRQYXRoKHRoaXMsIHBhdGgsIChpbk5ld1ZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHNldFZhbHVlKGluTmV3VmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgX3BhZ2VcbiAgICAgICAgICAgICAgICAuZ2V0RGF0YVNvdXJjZShzb3VyY2UpXG4gICAgICAgICAgICAgICAgLnJlc29sdmUodGhpcywgcGF0aClcbiAgICAgICAgICAgICAgICAudGhlbigoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBzZXRWYWx1ZShpblZhbHVlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy8gY29uZmlndXJhdGlvbiBvZiB0aGUgb2JzZXJ2ZXI6XG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IHsgYXR0cmlidXRlczogdHJ1ZSB9O1xuICAgICAgICAvLyBwYXNzIGluIHRoZSB0YXJnZXQgbm9kZSwgYXMgd2VsbCBhcyB0aGUgb2JzZXJ2ZXIgb3B0aW9uc1xuICAgICAgICBvYnNlcnZlci5vYnNlcnZlKHRoaXMsIGNvbmZpZyk7XG4gICAgICAgIGNvbnN0IGlucHV0VHlwZSA9ICQodGhpcykuYXR0cigndHlwZScpIHx8ICd0ZXh0JztcbiAgICAgICAgaWYgKC9eKGNoZWNrYm94fHJhZGlvKSQvLnRlc3QoaW5wdXRUeXBlLnRvTG93ZXJDYXNlKCkpKSB7XG4gICAgICAgICAgICBjb25zdCBhY3Rpb25OYW1lID0gJCh0aGlzKS5hdHRyKCdhY3Rpb24nKTtcbiAgICAgICAgICAgIGlmIChhY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICAgICAgYXR0YWNoQWN0aW9uLmNhbGwodGhpcywgX3BhZ2UsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogYWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgdHJpZ2dlcjogJ2NsaWNrJyxcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiAnc2VsZidcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGxldCBiaW5kaW5nQXR0ck5hbWU7XG4gICAgICAgIGVhY2goJCh0aGlzLmF0dHJpYnV0ZXMpLCAoaW5BdHRyaWJ1dGUpID0+IHtcbiAgICAgICAgICAgIGlmIChbJ2Zyb20nLCAndG8nLCAncGF0aCddLmluZGV4T2YoaW5BdHRyaWJ1dGUubmFtZSkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgYmluZGluZ0F0dHJOYW1lID0gaW5BdHRyaWJ1dGUubmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGxldCBiaW5kaW5nTm9kZSA9ICcnO1xuICAgICAgICBpZiAoYmluZGluZ0F0dHJOYW1lKSB7XG4gICAgICAgICAgICBjb25zdCBkZWxheUF0dHIgPSAkKHRoaXMpLmF0dHIoJ291dC1kZWxheScpID8gYG91dC1kZWxheT1cIiR7JCh0aGlzKS5hdHRyKCdvdXQtZGVsYXknKX1cImAgOiAnJztcbiAgICAgICAgICAgIGJpbmRpbmdOb2RlID0gYmluZGluZ0F0dHJOYW1lID8gYDxhZS1iaW5kICR7ZGVsYXlBdHRyfSB0YXJnZXQ9XCJuZXh0XCIgJHtiaW5kaW5nQXR0ck5hbWV9PVwiJHskKHRoaXMpLmF0dHIoYmluZGluZ0F0dHJOYW1lKX1cIj48L2FlLWJpbmQ+YCA6ICcnO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGxhYmVsUGxhY2VtZW50ID0gJCh0aGlzKS5hdHRyKCdsYWJlbC1wbGFjZW1lbnQnKSB8fCAnbGVmdCc7XG4gICAgICAgIGNvbnN0IGxhYmVsVGV4dCA9ICQodGhpcykuYXR0cignbGFiZWwnKTtcbiAgICAgICAgY29uc3QgYXV0b2NvbXBsZXRlID0gJCh0aGlzKS5hdHRyKCdhdXRvY29tcGxldGUnKSA/XG4gICAgICAgICAgICAnIGF1dG9jb21wbGV0ZT1cIicgKyAkKHRoaXMpLmF0dHIoJ2F1dG9jb21wbGV0ZScpICsgJ1wiJyA6XG4gICAgICAgICAgICAnJztcbiAgICAgICAgY29uc3QgcGxhY2Vob2xkZXIgPSAkKHRoaXMpLmF0dHIoJ3BsYWNlaG9sZGVyJykgfHwgJyc7XG4gICAgICAgIGNvbnN0IGlucHV0Q2xhc3MgPSAkKHRoaXMpLmF0dHIoJ2lucHV0LWNsYXNzJykgfHwgJyc7XG4gICAgICAgIGNvbnN0IGRpc2FibGVkID0gISgkKHRoaXMpLmF0dHIoJ2VuYWJsZWQnKSAhPT0gJ2ZhbHNlJyAmJiB0cnVlKSA/ICdkaXNhYmxlZCcgOiAnJztcbiAgICAgICAgY29uc3QgaW5wdXROYW1lID0gJCh0aGlzKS5hdHRyKCduYW1lJykgfHwgJ2FlLScgKyB1dWlkLnY0KCk7XG4gICAgICAgIGNvbnN0IHZhbHVlQXR0ciA9ICQodGhpcykuYXR0cigndmFsdWUnKSA/IGB2YWx1ZT1cIiR7JCh0aGlzKS5hdHRyKCd2YWx1ZScpfWAgOiAnJztcbiAgICAgICAgY29uc3QgaW5wdXQgPSBgPGlucHV0IG5hbWU9XCIke2lucHV0TmFtZX1cIiAke2Rpc2FibGVkfSB0eXBlPVwiJHtpbnB1dFR5cGV9XCIgJHthdXRvY29tcGxldGV9IGNsYXNzPVwiJHtpbnB1dENsYXNzfVwiIHBsYWNlaG9sZGVyPVwiJHtwbGFjZWhvbGRlcn1cIiAke3ZhbHVlQXR0cn0+YDtcbiAgICAgICAgY29uc3QgbGFiZWwgPSBsYWJlbFRleHQgPyBgPGxhYmVsIGZvcj1cIiR7aW5wdXROYW1lfVwiIGNsYXNzPVwiJHskKHRoaXMpLmF0dHIoJ2xhYmVsLWNsYXNzJykgfHwgJyd9XCI+JHtsYWJlbFRleHR9PC9sYWJlbD5gIDogJyc7XG5cbiAgICAgICAgJCh0aGlzKS5hcHBlbmQoYCR7bGFiZWxQbGFjZW1lbnQgPT09ICdsZWZ0Jz8gbGFiZWwgOiAnJ30ke2JpbmRpbmdOb2RlfSR7aW5wdXR9JHtsYWJlbFBsYWNlbWVudCA9PT0gJ3JpZ2h0Jz8gbGFiZWwgOiAnJ31gKTtcbiAgICB9O1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLWlucHV0JywgeyBwcm90b3R5cGU6IHByb3RvIH0pO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IEVsZW1lbnQgZnJvbSAnLi9hZS1lbGVtZW50JztcbmltcG9ydCBrZXljb2RlIGZyb20gJ2tleWNvZGUnO1xuaW1wb3J0IGF0dGFjaEFjdGlvbiBmcm9tICcuLi9kZWxlZ2F0ZS9hY3Rpb24tdHJpZ2dlci1kZWxlZ2F0ZSc7XG5pbXBvcnQgdmFsdWVDaGFuZ2VEZWxlZ2F0ZSBmcm9tICcuLi9kZWxlZ2F0ZS92YWx1ZS1jaGFuZ2UtZGVsZWdhdGUnO1xuaW1wb3J0IGVhY2ggZnJvbSAnbG9kYXNoLmZvcmVhY2gnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhZUJ1dHRvbihpblBhZ2UpIHtcbiAgICBjb25zdCBfcGFnZSA9IGluUGFnZTtcbiAgICBsZXQgb2JzZXJ2ZXI7XG5cbiAgICB2YXIgcHJvdG8gPSBPYmplY3QuY3JlYXRlKEhUTUxJbnB1dEVsZW1lbnQucHJvdG90eXBlKTtcblxuICAgIHByb3RvLmNyZWF0ZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIGNvbnN0IHNvdXJjZSA9ICQodGhpcykuYXR0cignc291cmNlJyk7XG5cbiAgICAgICAgbGV0IHJlc3RyaWN0O1xuICAgICAgICBpZiAoKHJlc3RyaWN0ID0gJCh0aGlzKS5hdHRyKCdyZXN0cmljdCcpKSkge1xuICAgICAgICAgICAgaWYgKC9eXFxbLy50ZXN0KHJlc3RyaWN0KSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlID0gbmV3IFJlZ0V4cChyZXN0cmljdCk7XG4gICAgICAgICAgICAgICAgJCh0aGlzKS5rZXlkb3duKChpbkV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoaW5FdmVudC5rZXlDb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIGtleWNvZGUoJ2VudGVyJyk6XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIGtleWNvZGUoJ2xlZnQnKTpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2Uga2V5Y29kZSgndXAnKTpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2Uga2V5Y29kZSgncmlnaHQnKTpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2Uga2V5Y29kZSgnZG93bicpOlxuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBrZXljb2RlKCdkZWwnKTpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2Uga2V5Y29kZSgnaW5zJyk6XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIGtleWNvZGUoJ3RhYicpOlxuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBrZXljb2RlKCdiYWNrc3BhY2UnKTpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2hhciA9IGtleWNvZGUoaW5FdmVudCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFyZS50ZXN0KGNoYXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluRXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICBsZXQgdGFyZ2V0ID0gdGhpcztcblxuICAgICAgICBsZXQgZGF0YVNvdXJjZU5hbWUgPSAkKHRoaXMpLmF0dHIoJ3NvdXJjZScpO1xuICAgICAgICBjb25zdCBwYXRoID0gJCh0aGlzKS5hdHRyKCdwYXRoJyk7XG4gICAgICAgIGxldCBkYXRhU291cmNlID0gX3BhZ2UuZ2V0RGF0YVNvdXJjZShkYXRhU291cmNlTmFtZSk7XG4gICAgICAgIGlmICghZGF0YVNvdXJjZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgYmluZCB0byBkYXRhLXNvdXJjZTogJyArIGRhdGFTb3VyY2VOYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB1c2VQYXRoID0gcGF0aCAmJiAhJCh0aGlzKS5hdHRyKCdmcm9tJykgJiYgISQodGhpcykuYXR0cigndG8nKTtcbiAgICAgICAgY29uc3QgdG9BdHRyID0gdXNlUGF0aCA/IHBhdGggOiAkKHRoaXMpLmF0dHIoJ3RvJyk7XG4gICAgICAgIGNvbnN0IGZyb21BdHRyID0gdXNlUGF0aCA/IHBhdGggOiAkKHRoaXMpLmF0dHIoJ2Zyb20nKTtcbiAgICAgICAgbGV0IGluQXR0ciA9ICQodGhpcykuYXR0cignaW4nKSB8fCAnJztcblxuXG5cbiAgICAgICAgaWYgKGZyb21BdHRyKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHZhbHVlUmVzb2x2ZXIgPSAoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHZhbHVlQ2hhbmdlRGVsZWdhdGUuc2V0VmFsdWUodGFyZ2V0LCBpblZhbHVlKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGRhdGFTb3VyY2UuYmluZFBhdGgodGhpcywgZnJvbUF0dHIsIGZ1bmN0aW9uKGluTmV3VmFsdWUsIGluT2xkVmFsdWUpIHtcbiAgICAgICAgICAgICAgICBpZiAoaW5OZXdWYWx1ZSAhPT0gaW5PbGRWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZVJlc29sdmVyKGluTmV3VmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkYXRhU291cmNlLnJlc29sdmUodGhpcywgZnJvbUF0dHIpLnRoZW4oKGluVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICB2YWx1ZVJlc29sdmVyKGluVmFsdWUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG9BdHRyKSB7XG4gICAgICAgICAgICBjb25zdCBvdXRPcHRpb25zID0ge307XG4gICAgICAgICAgICBlYWNoKHRoaXMuYXR0cmlidXRlcywgKGluQXR0cmlidXRlKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKC9eb3V0LS8udGVzdChpbkF0dHJpYnV0ZS5uYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICBvdXRPcHRpb25zW2luQXR0cmlidXRlLm5hbWUucmVwbGFjZSgvXm91dC0vLCAnJyldID0gaW5BdHRyaWJ1dGUudmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB2YWx1ZUNoYW5nZURlbGVnYXRlLm9uVmFsdWVDaGFuZ2UodGFyZ2V0LCBvdXRPcHRpb25zLCAoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIGRhdGFTb3VyY2Uuc2V0UGF0aCh0aGlzLCB0b0F0dHIsIGluVmFsdWUudmFsdWUgPT0gbnVsbCA/IG51bGwgOiBpblZhbHVlLnZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCQodGhpcykuYXR0cignYWN0aW9uJykpIHtcbiAgICAgICAgICAgIGF0dGFjaEFjdGlvbi5jYWxsKHRoaXMsIF9wYWdlLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJCh0aGlzKS5hdHRyKCdhY3Rpb24nKVxuXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIHByb3RvLmF0dGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuXG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLWlucHV0MicsIHtcbiAgICAgICAgcHJvdG90eXBlOiBwcm90byxcbiAgICAgICAgZXh0ZW5kczogJ2lucHV0J1xuICAgIH0pO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5cbmltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5pbXBvcnQgRWxlbWVudCBmcm9tICcuL2FlLWVsZW1lbnQnO1xuaW1wb3J0IGF0dGFjaEFjdGlvbiBmcm9tICcuLi9kZWxlZ2F0ZS9hY3Rpb24tdHJpZ2dlci1kZWxlZ2F0ZSc7XG5cbmxldCBfcGFnZTtcblxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBsaW5rKGluUGFnZSkge1xuXG4gICAgX3BhZ2UgPSBpblBhZ2U7XG5cbiAgICB2YXIgcHJvdG8gPSBPYmplY3QuY3JlYXRlKEhUTUxBbmNob3JFbGVtZW50LnByb3RvdHlwZSk7XG5cbiAgICBwcm90by5jcmVhdGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgJCh0aGlzKS5wcm9wKCdvbmNsaWNrJywgKCkgPT57fSk7XG4gICAgfTtcblxuICAgIHByb3RvLmF0dGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgYXR0YWNoQWN0aW9uLmNhbGwodGhpcywgX3BhZ2UsIHtcbiAgICAgICAgICAgIG5hbWU6ICQodGhpcykuYXR0cignYWN0aW9uJyksXG4gICAgICAgICAgICB0cmlnZ2VyOiAkKHRoaXMpLmF0dHIoJ3RyaWdnZXInKSxcbiAgICAgICAgICAgIHRhcmdldDogJ3NlbGYnLFxuICAgICAgICAgICAgcGFyYW1zOiAoKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IHt9O1xuICAgICAgICAgICAgICAgICQoJCh0aGlzKS5nZXQoMCkuYXR0cmlidXRlcykuZWFjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKC9ecGFyYW0tLy50ZXN0KHRoaXMubmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKC9ecGFyYW0tLiotanNvbiQvLnRlc3QodGhpcy5uYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtc1t0aGlzLm5hbWUucmVwbGFjZSgncGFyYW0tJywgJycpLnJlcGxhY2UoLy1qc29uJC8sICcnKV0gPSBKU09OLnBhcnNlKHRoaXMudmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXNbdGhpcy5uYW1lLnJlcGxhY2UoJ3BhcmFtLScsICcnKV0gPSB0aGlzLnZhbHVlOyAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAgICAgIH0pKClcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLWxpbmsnLCB7IHByb3RvdHlwZTogcHJvdG8sIGV4dGVuZHM6ICdhJyB9KTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcblxuJC5mbi5leHRlbmQoe1xuICAgIGdldFBhdGg6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHBhdGgsIG5vZGUgPSB0aGlzO1xuICAgICAgICB3aGlsZSAobm9kZS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciByZWFsTm9kZSA9IG5vZGVbMF0sIG5hbWUgPSByZWFsTm9kZS5sb2NhbE5hbWU7XG4gICAgICAgICAgICBpZiAoIW5hbWUpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5hbWUgPSBuYW1lLnRvTG93ZXJDYXNlKCk7XG5cbiAgICAgICAgICAgIHZhciBwYXJlbnQgPSBub2RlLnBhcmVudCgpO1xuXG4gICAgICAgICAgICB2YXIgc2FtZVRhZ1NpYmxpbmdzID0gcGFyZW50LmNoaWxkcmVuKG5hbWUpO1xuICAgICAgICAgICAgaWYgKHNhbWVUYWdTaWJsaW5ncy5sZW5ndGggPiAxKSB7IFxuICAgICAgICAgICAgICAgIGxldCBhbGxTaWJsaW5ncyA9IHBhcmVudC5jaGlsZHJlbigpO1xuICAgICAgICAgICAgICAgIGxldCBpbmRleCA9IGFsbFNpYmxpbmdzLmluZGV4KHJlYWxOb2RlKSArIDE7XG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ID4gMSkge1xuICAgICAgICAgICAgICAgICAgICBuYW1lICs9ICc6bnRoLWNoaWxkKCcgKyBpbmRleCArICcpJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHBhdGggPSBuYW1lICsgKHBhdGggPyAnPicgKyBwYXRoIDogJycpO1xuICAgICAgICAgICAgbm9kZSA9IHBhcmVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwYXRoO1xuICAgIH1cbn0pO1xuXG5pbXBvcnQgYWVNYW5hZ2VkIGZyb20gJy4vYWUtbWFuYWdlZCc7XG5pbXBvcnQgYWVCdXR0b24gZnJvbSAnLi9hZS1idXR0b24nO1xuaW1wb3J0IGFlRWFjaCBmcm9tICcuL2FlLWVhY2gnO1xuaW1wb3J0IGFlU3RhdGUgZnJvbSAnLi9hZS1zdGF0ZSc7XG5pbXBvcnQgYWVBY3Rpb24gZnJvbSAnLi9hZS1hY3Rpb24nO1xuaW1wb3J0IGFlQmluZCBmcm9tICcuL2FlLWJpbmQnO1xuaW1wb3J0IGFlUmVuZGVyIGZyb20gJy4vYWUtcmVuZGVyJztcbmltcG9ydCBhZVN3aXRjaCBmcm9tICcuL2FlLXN3aXRjaCc7XG5pbXBvcnQgYWVUZXh0SW5wdXQgZnJvbSAnLi9hZS1pbnB1dCc7XG5pbXBvcnQgYWVJbnB1dCBmcm9tICcuL2FlLWlucHV0Mic7XG5pbXBvcnQgYWVMaW5rIGZyb20gJy4vYWUtbGluayc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKGluUGFnZSkge1xuXG4gICAgYWVCdXR0b24oaW5QYWdlKTtcbiAgICBhZU1hbmFnZWQoaW5QYWdlKTtcbiAgICBhZUVhY2goaW5QYWdlKTtcbiAgICBhZVN0YXRlKGluUGFnZSk7XG4gICAgYWVBY3Rpb24oaW5QYWdlKTtcbiAgICBhZUJpbmQoaW5QYWdlKTtcbiAgICBhZVJlbmRlcihpblBhZ2UpO1xuICAgIGFlU3dpdGNoKGluUGFnZSk7XG4gICAgYWVUZXh0SW5wdXQoaW5QYWdlKTtcbiAgICBhZUlucHV0KGluUGFnZSk7XG4gICAgYWVMaW5rKGluUGFnZSk7XG59XG5cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IENvbXBvbmVudCBmcm9tICcuL2NvbXBvbmVudCc7XG5pbXBvcnQgZ2V0IGZyb20gJ2xvZGFzaC5nZXQnO1xuaW1wb3J0IGlzRnVuY3Rpb24gZnJvbSAnbG9kYXNoLmlzRnVuY3Rpb24nO1xuaW1wb3J0IGlzUGxhaW5PYmplY3QgZnJvbSAnbG9kYXNoLmlzUGxhaW5PYmplY3QnO1xuXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuXG5pbXBvcnQgbW9kZWxEYXRhU291cmNlIGZyb20gJy4vZGF0YXNvdXJjZS9tb2RlbC1kYXRhc291cmNlJztcbmNvbnN0IF9kYXRhU291cmNlcyA9IG5ldyBNYXAoKTtcbmltcG9ydCBsYW5nIGZyb20gJy4vbGFuZy9hZS1sYW5nJztcbmltcG9ydCBmYWN0b3J5IGZyb20gJy4vcGFnZS1mYWN0b3J5JztcbmltcG9ydCBDb21wb25lbnRMaWZlY3ljbGUgZnJvbSAnLi9Db21wb25lbnRMaWZlY3ljbGUnO1xuaW1wb3J0IHByaXZhdGVIYXNoIGZyb20gJy4vdXRpbC9wcml2YXRlJztcbmltcG9ydCBMaXRlVXJsIGZyb20gJ2xpdGUtdXJsJztcblxuY29uc3QgX3ByaXZhdGUgPSBwcml2YXRlSGFzaCgnY29tcG9uZW50Jyk7XG5cbmxldCBfcmVnaXN0cnkgPSBuZXcgV2Vha01hcCgpO1xubGV0IF90ZW1wbGF0aW5nRGVsZWdhdGU7XG5cbmNvbnN0IF9pbml0aWFsaXplcnMgPSBbXTtcbmNvbnN0IF9jb21wb25lbnRJbmplY3RvcnMgPSBbXTtcblxubGV0IF9jb25maWc7XG5cbmNvbnN0IHBhcnNlVXJsID0gZnVuY3Rpb24gcGFyc2VVcmwoKSB7XG4gICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXJ0dXBQYXJhbXMgPSBuZXcgTGl0ZVVybCh3aW5kb3cubG9jYXRpb24uaHJlZikucGFyYW1zO1xufTtcblxuY29uc3Qgc3RhcnRQYWdlID0gZnVuY3Rpb24gc3RhcnRQYWdlKCkge1xuICAgICQoKCkgPT4ge1xuICAgICAgICB0aGlzLm5vZGUgPSAkKHRoaXMubW91bnRQb2ludCk7XG4gICAgICAgIGxhbmcodGhpcyk7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKVxuICAgICAgICAgICAgLmxpZmVjeWNsZVNpZ25hbC5kaXNwYXRjaCgnZWxlbWVudC1jcmVhdGVkJyk7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKVxuICAgICAgICAgICAgLmxpZmVjeWNsZVNpZ25hbC5kaXNwYXRjaCgnZWxlbWVudC1hdHRhY2hlZCcpO1xuICAgICAgICBpZiAodGhpcy5jb25maWcuYXV0b1JlbmRlciAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgIHRoaXMuaW52YWxpZGF0ZSgpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG5jb25zdCBjYWxsTmV4dEluaXRpYWxpemVyID0gZnVuY3Rpb24oKSB7XG4gICAgbGV0IGluaXRpYWxpemVyID0gX2luaXRpYWxpemVycy5zaGlmdCgpO1xuICAgIGlmICghaW5pdGlhbGl6ZXIpIHtcbiAgICAgICAgc3RhcnRQYWdlLmNhbGwodGhpcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbGV0IHJlc3VsdCA9IGluaXRpYWxpemVyLmNhbGwodGhpcyk7XG4gICAgbGV0IHJlc3VsdEhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICAgIGxldCBmbjtcbiAgICAgICAgd2hpbGUgKGZuID0gX2NvbmZpZy5jb21wb25lbnRzLnNoaWZ0KCkpIHsgLy9qc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgICAgICAgIGZuKHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChfaW5pdGlhbGl6ZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgY2FsbE5leHRJbml0aWFsaXplci5jYWxsKHRoaXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhcnRQYWdlLmNhbGwodGhpcyk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIGlmIChyZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgIHJlc3VsdC50aGVuKHJlc3VsdEhhbmRsZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdEhhbmRsZXIoKTtcbiAgICB9XG5cbn07XG5cbmNsYXNzIFBhZ2UgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIGNvbnN0cnVjdG9yKGluQ29uZmlnLCBpbk1vZGVsUHJvdG90eXBlLCBpbkNvbnN0cnVjdG9yKSB7XG4gICAgICAgIHN1cGVyKGluQ29uZmlnLCBpbk1vZGVsUHJvdG90eXBlKTtcbiAgICAgICAgX2NvbmZpZyA9IGluQ29uZmlnO1xuICAgICAgICBwYXJzZVVybC5jYWxsKHRoaXMpO1xuICAgICAgICB0aGlzLm1vdW50UG9pbnQgPSBpbkNvbmZpZy5tb3VudFBvaW50IHx8ICdib2R5JztcbiAgICAgICAgdGhpcy5hZGREYXRhU291cmNlKCdtb2RlbCcsIG1vZGVsRGF0YVNvdXJjZSh0aGlzKSk7XG4gICAgICAgIGluQ29uc3RydWN0b3IuYmluZCh0aGlzKSgpO1xuICAgICAgICB0aGlzLnBhZ2UgPSB0aGlzO1xuICAgICAgICBjYWxsTmV4dEluaXRpYWxpemVyLmNhbGwodGhpcyk7XG4gICAgfVxuXG4gICAgc3RhcnR1cFBhcmFtKGluUGFyYW1OYW1lKSB7XG4gICAgICAgIHJldHVybiBfcHJpdmF0ZS5nZXQodGhpcykuc3RhcnR1cFBhcmFtc1tpblBhcmFtTmFtZV07XG4gICAgfVxuXG4gICAgcmVzb2x2ZU5vZGVNb2RlbChpbk5vZGUsIGluUGF0aCkge1xuICAgICAgICBsZXQgY29tcG9uZW50ID0gdGhpcy5yZXNvbHZlTm9kZUNvbXBvbmVudChpbk5vZGUpO1xuICAgICAgICBpZiAoIWNvbXBvbmVudC5oYXNNb2RlbCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVzb2x2ZU5vZGVNb2RlbCgkKGNvbXBvbmVudC5ub2RlKS5wYXJlbnQoKSwgaW5QYXRoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29tcG9uZW50Lm1vZGVsO1xuICAgIH1cblxuICAgIHJlc29sdmVOb2RlQ29tcG9uZW50KGluTm9kZSkge1xuICAgICAgICBsZXQgbm9kZSA9ICQoaW5Ob2RlKS5nZXQoMCk7XG4gICAgICAgIHdoaWxlICghX3JlZ2lzdHJ5LmdldChub2RlKSkge1xuICAgICAgICAgICAgbm9kZSA9ICQobm9kZSkucGFyZW50KCkuZ2V0KDApO1xuICAgICAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFfcmVnaXN0cnkuZ2V0KG5vZGUpKSB7XG4gICAgICAgICAgICBpZiAoZ2V0KHdpbmRvdywgJ2xvZ0xldmVsJykgPT09ICdkZWJ1ZycpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmRlYnVnKCdDb3VsZCBub3QgZmluZCBjb21wb25lbnQgaW4gYW5jZXN0cnkuIEZhbGxpbmcgYmFjayB0byBwYWdlIGNvbXBvbmVudCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9yZWdpc3RyeS5nZXQobm9kZSk7XG5cbiAgICB9XG5cbiAgICBhZGREYXRhU291cmNlKGluTmFtZSwgaW5Jbml0RnVuY3Rpb24pIHtcbiAgICAgICAgX2RhdGFTb3VyY2VzLnNldChpbk5hbWUsIGluSW5pdEZ1bmN0aW9uKHRoaXMpKTtcbiAgICB9XG5cbiAgICBnZXREYXRhU291cmNlKGluTmFtZSkge1xuICAgICAgICBpbk5hbWUgPSBpbk5hbWUgfHwgJ21vZGVsJztcbiAgICAgICAgcmV0dXJuIF9kYXRhU291cmNlcy5nZXQoaW5OYW1lKTtcbiAgICB9XG5cbiAgICByZWdpc3RlckluaXRpYWxpemVyKGluRm4pIHtcbiAgICAgICAgX2luaXRpYWxpemVycy5wdXNoKGluRm4pO1xuICAgIH1cblxuICAgIHJlZ2lzdGVyQ29tcG9uZW50SW5qZWN0b3IoaW5JbmplY3RvckZuKSB7XG4gICAgICAgIF9jb21wb25lbnRJbmplY3RvcnMucHVzaChpbkluamVjdG9yRm4pO1xuICAgIH1cblxuICAgIHJlbmRlcihpbk1vZGVsKSB7XG4gICAgICAgIHN1cGVyLnJlbmRlcihpbk1vZGVsKTtcbiAgICAgICAgJCh0aGlzLm1vdW50UG9pbnQpLmNzcygnZGlzcGxheScsICcnKTtcbiAgICB9XG5cbiAgICByZWdpc3RlckNvbXBvbmVudCguLi5hcmdzKSB7XG5cbiAgICAgICAgY29uc3QgY29uc3RydWN0b3IgPSBhcmdzLnBvcCgpO1xuICAgICAgICBjb25zdCBjb25maWcgPSBhcmdzLnNoaWZ0KCk7XG4gICAgICAgIGNvbnN0IG1vZGVsID0gYXJncy5zaGlmdCgpO1xuICAgICAgICBpZiAoIWlzRnVuY3Rpb24oY29uc3RydWN0b3IpIHx8XG4gICAgICAgICAgICAhaXNQbGFpbk9iamVjdChjb25maWcpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1BhZ2UucmVnaXN0ZXJDb21wb25lbnQoKSB1c2FnZTogKGNvbmZpZyA6IE9iamVjdCwgW21vZGVsIDogT2JqZWN0fE9ic2VydmFibGVPYmplY3RdLCBjb25zdHJ1Y3RvciA6IEZ1bmN0aW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZWdpc3RlckNvbXBvbmVudEVsZW1lbnQoe1xuICAgICAgICAgICAgY29uZmlnOiBjb25maWcsXG4gICAgICAgICAgICBtb2RlbFByb3RvdHlwZTogbW9kZWwsXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcjogY29uc3RydWN0b3JcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgaW5pdFN0YXRlKCkge1xuICAgICAgICBsZXQgaGFzaCA9IHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gZGVjb2RlVVJJKHdpbmRvdy5sb2NhdGlvbi5oYXNoKTtcblxuICAgICAgICBpZiAoL14jPltcXHdcXC1dLy50ZXN0KGhhc2gpKSB7XG4gICAgICAgICAgICBoYXNoID0gaGFzaC5yZXBsYWNlKC9eIz4vLCAnJyk7XG4gICAgICAgICAgICBpZiAodGhpcy5zdGF0ZXMuZ2V0UGF0aChoYXNoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMudHJ5U3RhdGUoaGFzaCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAkKHdpbmRvdykub24oJ2hhc2hjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZigvXiNhY3Rpb246Ly50ZXN0KHdpbmRvdy5sb2NhdGlvbi5oYXNoKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZha2VVcmwgPSBuZXcgTGl0ZVVybCh3aW5kb3cubG9jYXRpb24uaGFzaC5yZXBsYWNlKC9eI2FjdGlvbjovLCAnaHR0cDovL2xvY2FsaG9zdC8nKSk7XG4gICAgICAgICAgICAgICAgdGhpcy5idXMudHJpZ2dlckFjdGlvbihmYWtlVXJsLnBhdGhuYW1lLnJlcGxhY2UoL1xcLy9nLCAnJyksIGZha2VVcmwuc2VhcmNoKTtcbiAgICAgICAgICAgICAgICB3aW5kb3cubG9jYXRpb24uaGFzaCA9ICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KS50cmlnZ2VyKCdoYXNoY2hhbmdlJyk7XG4gICAgfVxuXG4gICAgcmVnaXN0ZXJDb21wb25lbnRFbGVtZW50KGluRGVmaW5pdGlvbikge1xuICAgICAgICB2YXIgcHJvdG8gPSBPYmplY3QuY3JlYXRlKEhUTUxEaXZFbGVtZW50LnByb3RvdHlwZSk7XG4gICAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgICAgbGV0IGNvbXBvbmVudDtcbiAgICAgICAgY29uc3QgbmFtZSA9IGluRGVmaW5pdGlvbi5jb25maWcubmFtZTtcbiAgICAgICAgLy8gICAgICAgIGNvbnNvbGUuaW5mbygncmVnaXN0ZXJpbmcgY29tcG9uZW50OiAnICsgbmFtZSk7XG4gICAgICAgIGRvY3VtZW50LnN0eWxlU2hlZXRzWzBdLmluc2VydFJ1bGUobmFtZSArICd7IGRpc3BsYXk6IGJsb2NrO30nLCAxKTtcblxuICAgICAgICBwcm90by5jcmVhdGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudCA9IG5ldyBDb21wb25lbnQoXG4gICAgICAgICAgICAgICAgaW5EZWZpbml0aW9uLmNvbmZpZyxcbiAgICAgICAgICAgICAgICBpbkRlZmluaXRpb24ubW9kZWxQcm90b3R5cGUsXG4gICAgICAgICAgICAgICAgaW5EZWZpbml0aW9uLmNvbnN0cnVjdG9yLFxuICAgICAgICAgICAgICAgIHRoYXQpO1xuICAgICAgICAgICAgX3JlZ2lzdHJ5LnNldCh0aGlzLCBjb21wb25lbnQpO1xuICAgICAgICAgICAgY29tcG9uZW50Lm5vZGUgPSB0aGlzO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpbmplY3RvciBvZiBfY29tcG9uZW50SW5qZWN0b3JzKSB7XG4gICAgICAgICAgICAgICAgaW5qZWN0b3IuY2FsbCh0aGF0LCBjb21wb25lbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KGNvbXBvbmVudClcbiAgICAgICAgICAgICAgICAubGlmZWN5Y2xlU2lnbmFsLmRpc3BhdGNoKCdlbGVtZW50LWNyZWF0ZWQnKTtcbiAgICAgICAgfTtcblxuICAgICAgICBwcm90by5hdHRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBfcmVnaXN0cnkuZ2V0KHRoaXMpO1xuICAgICAgICAgICAgaWYgKCQodGhpcykuYXR0cignZnJvbScpKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhhdC5yZXNvbHZlTm9kZU1vZGVsKCQodGhpcykucGFyZW50KCkpO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5tb2RlbC5wcm9wKCdkYXRhJywgbW9kZWwucHJvcCgnZGF0YS4nICsgJCh0aGlzKS5hdHRyKCdmcm9tJykpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF9wcml2YXRlLmdldChjb21wb25lbnQpXG4gICAgICAgICAgICAgICAgLmxpZmVjeWNsZVNpZ25hbC5kaXNwYXRjaCgnZWxlbWVudC1hdHRhY2hlZCcpO1xuICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5jb25maWcuYXV0b1JlbmRlciAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQucmVuZGVyLmNhbGwoY29tcG9uZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBwcm90by5kZXRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBfcHJpdmF0ZS5nZXQoY29tcG9uZW50KVxuICAgICAgICAgICAgICAgIC5saWZlY3ljbGVTaWduYWwuZGlzcGF0Y2goJ2VsZW1lbnQtZGV0YWNoZWQnKTtcbiAgICAgICAgICAgIC8vX3ByaXZhdGUuZGVsZXRlKGNvbXBvbmVudCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgZG9jdW1lbnQucmVnaXN0ZXJFbGVtZW50KGluRGVmaW5pdGlvbi5jb25maWcubmFtZSwge1xuICAgICAgICAgICAgcHJvdG90eXBlOiBwcm90b1xuICAgICAgICB9KTtcblxuICAgIH1cblxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IFBhZ2U7XG4iLCIndXNlIHN0cmljdCc7XG5cbmNsYXNzIFRlbXBsYXRpbmdEZWxlZ2F0ZSB7XG5cdHJlZ2lzdGVyVGVtcGxhdGUoaW5Tb3VyY2UsIGluTmFtZSkge1xuXHRcdC8vaWYoIWluTmFtZSkgZ2VuZXJhdGUgbmFtZSBhbmQgcmV0dXJuIGl0XG5cdH1cblxuXHRyZW5kZXIoaW5UZW1wbGF0ZU5hbWUsIGluTW9kZWwpIHtcblx0XHQvL3JldHVybiBwcm9taXNlXG5cdH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVGVtcGxhdGluZ0RlbGVnYXRlO1xuIiwiLyohIGR1c3Rqcy1oZWxwZXJzIC0gdjEuNy4zXG4gKiBodHRwOi8vZHVzdGpzLmNvbS9cbiAqIENvcHlyaWdodCAoYykgMjAxNSBBbGVrc2FuZGVyIFdpbGxpYW1zOyBSZWxlYXNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UgKi9cbmltcG9ydCBPYnNlcnZhYmxlT2JqZWN0IGZyb20gJy4uL09ic2VydmFibGVPYmplY3QnO1xuaW1wb3J0IGlzU3RyaW5nIGZyb20gJ2xvZGFzaC5pc1N0cmluZyc7XG5pbXBvcnQga2V5cyBmcm9tICdsb2Rhc2gua2V5cyc7XG5pbXBvcnQgZ2V0IGZyb20gJ2xvZGFzaC5nZXQnO1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24oZHVzdCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuXG4gICAgZHVzdC5oZWxwZXJzLnJlID0gZnVuY3Rpb24oY2h1bmssIGNvbnRleHQsIGJvZGllcywgcGFyYW1zKSB7XG4gICAgICAgIGNvbnNvbGUud2FybigncGFyYW1zOicpO1xuICAgICAgICBjb25zb2xlLndhcm4ocGFyYW1zKTtcbiAgICAgICAgaWYgKCFwYXJhbXMua2V5IHx8ICFwYXJhbXMubWF0Y2gpIHtcbiAgICAgICAgICAgIGNodW5rLndyaXRlKCcnKTtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybignd3JpdGluZyBlbXB0eSBzdHJpbmcnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybignd3JpdGluZyBib2RpZXMnKTtcbiAgICAgICAgICAgIHZhciByZSA9IG5ldyBSZWdFeHAocGFyYW1zLm1hdGNoKTtcbiAgICAgICAgICAgIGlmIChyZS50ZXN0KHBhcmFtcy5rZXkpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJvZGllcykge1xuICAgICAgICAgICAgICAgICAgICBjaHVuayA9IGNodW5rLnJlbmRlcihib2RpZXMsIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjaHVuaztcbiAgICB9O1xuXG5cblxuICAgIGR1c3QuZmlsdGVycy5odHRwcyA9IGZ1bmN0aW9uKGluVXJsKSB7XG4gICAgICAgIGlmICghaW5VcmwpIHtcbiAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW5VcmwudG9TdHJpbmcoKS5yZXBsYWNlKC9eKGh0dHAoPzpzKT8pOi8sICdodHRwczonKTtcbiAgICB9O1xuXG5cbiAgICBkdXN0LmZpbHRlcnMub2JzY3VyZWRjcmVkaXRjYXJkbnVtYmVyID0gZnVuY3Rpb24oaW5WYWx1ZSkge1xuICAgICAgICBpZiAoIWlzU3RyaW5nKGluVmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHNwbGl0ID0gaW5WYWx1ZS5zcGxpdCgnJykucmV2ZXJzZSgpO1xuICAgICAgICB2YXIgdGFpbCA9IHNwbGl0LnNwbGljZSgwLCA0KTtcbiAgICAgICAgdGFpbC51bnNoaWZ0KCctJyk7XG5cbiAgICAgICAgd2hpbGUgKHNwbGl0Lmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCAlIDQgPT09IDApIHtcbiAgICAgICAgICAgICAgICB0YWlsLnVuc2hpZnQoJy0nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRhaWwudW5zaGlmdCgnKicpO1xuICAgICAgICAgICAgc3BsaXQucG9wKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRhaWwuam9pbignJykucmVwbGFjZSgvLS0vLCAnLScpO1xuICAgIH07XG5cbiAgICBkdXN0LmZpbHRlcnMudG9sb3dlciA9IGZ1bmN0aW9uKGluVmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGlzU3RyaW5nKGluVmFsdWUpID8gaW5WYWx1ZS50b0xvd2VyQ2FzZSgpIDogaW5WYWx1ZTtcbiAgICB9O1xuXG4gICAgZHVzdC5maWx0ZXJzLnRvdXBwZXIgPSBmdW5jdGlvbihpblZhbHVlKSB7XG4gICAgICAgIHJldHVybiBpc1N0cmluZyhpblZhbHVlKSA/IGluVmFsdWUudG9VcHBlckNhc2UoKSA6IGluVmFsdWU7XG4gICAgfTtcbiAgICBkdXN0LmhlbHBlcnMuc29ydCA9IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykge1xuICAgICAgICB2YXIgc29ydCA9IEpTT04ucGFyc2UocGFyYW1zLnNvcnQpO1xuICAgICAgICB2YXIgYm9keSA9IGJvZGllcy5ibG9jaztcbiAgICAgICAgdmFyIHNvcnRrZXk7XG5cbiAgICAgICAgZnVuY3Rpb24gaXNFbXB0eShvKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIG8pIHtcbiAgICAgICAgICAgICAgICBpZiAoby5oYXNPd25Qcm9wZXJ0eShwKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc29ydCkge1xuICAgICAgICAgICAgZGVsZXRlIHBhcmFtcy5zb3J0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICB2YXIgY21wID0gZnVuY3Rpb24gY21wKGEsIGIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gKGFbc29ydGtleV0gPCBiW3NvcnRrZXldKSA/IC0xIDogKChhW3NvcnRrZXldID4gYltzb3J0a2V5XSkgPyAxIDogMCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB3aGlsZSAoc29ydC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzb3J0a2V5ID0gc29ydC5wb3AoKS5rZXk7XG4gICAgICAgICAgICAgICAgY29udGV4dC5zdGFjay5oZWFkLnNvcnQoY21wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjaHVuay5zZWN0aW9uKGNvbnRleHQuZ2V0UGF0aCh0cnVlLCBbXSksIGNvbnRleHQsIGJvZGllcywgaXNFbXB0eShwYXJhbXMpID8gbnVsbCA6IHBhcmFtcyk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZHVzdC5maWx0ZXJzLm1vbmV5ID0gZnVuY3Rpb24oaW5WYWx1ZSkge1xuICAgICAgICB2YXIgc1ZhbHVlID0gTnVtYmVyKGluVmFsdWUpLnRvRml4ZWQoMikucmVwbGFjZSgnLicsICcsJyk7XG5cbiAgICAgICAgdmFyIHNSZWdFeHAgPSBuZXcgUmVnRXhwKCcoLT9bMC05XSspKFswLTldezN9KScpO1xuICAgICAgICB3aGlsZSAoc1JlZ0V4cC50ZXN0KHNWYWx1ZSkpIHtcbiAgICAgICAgICAgIHNWYWx1ZSA9IHNWYWx1ZS5yZXBsYWNlKHNSZWdFeHAsICckMScgKyAnLicgKyAnJDInKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc1ZhbHVlO1xuICAgIH07XG5cbiAgICBkdXN0LmhlbHBlcnMuaXRlcmF0ZSA9IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykge1xuICAgICAgICB2YXIgYm9keSA9IGJvZGllcy5ibG9jayxcbiAgICAgICAgICAgIHNvcnQsXG4gICAgICAgICAgICBhcnIsXG4gICAgICAgICAgICBpLFxuICAgICAgICAgICAgayxcbiAgICAgICAgICAgIG9iaixcbiAgICAgICAgICAgIGNvbXBhcmVGbjtcblxuICAgICAgICBwYXJhbXMgPSBwYXJhbXMgfHwge307XG4gICAgICAgIGlmKHBhcmFtcy5zb3J0S2V5KSB7XG4gICAgICAgICAgICBwYXJhbXMuc29ydCA9IHBhcmFtcy5zb3J0IHx8ICdhc2MnO1xuICAgICAgICB9XG4gICAgICAgIGZ1bmN0aW9uIGRlc2MoYSwgYikge1xuICAgICAgICAgICAgaWYocGFyYW1zLnNvcnRLZXkpIHtcbiAgICAgICAgICAgICAgICBhID0gZ2V0KG9iaiwgYSArICcuJyArIHBhcmFtcy5zb3J0S2V5KTtcbiAgICAgICAgICAgICAgICBiID0gZ2V0KG9iaiwgYiArICcuJyArIHBhcmFtcy5zb3J0S2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhIDwgYikge1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhID4gYikge1xuICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gYXNjKGEsIGIpIHtcblxuICAgICAgICAgICAgaWYocGFyYW1zLnNvcnRLZXkpIHtcbiAgICAgICAgICAgICAgICBhID0gZ2V0KG9iaiwgYSArICcuJyArIHBhcmFtcy5zb3J0S2V5KTtcbiAgICAgICAgICAgICAgICBiID0gZ2V0KG9iaiwgYiArICcuJyArIHBhcmFtcy5zb3J0S2V5KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGEgPiBiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGEgPCBiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBwcm9jZXNzQm9keShrZXksIHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gYm9keShjaHVuaywgY29udGV4dC5wdXNoKHtcbiAgICAgICAgICAgICAgICAka2V5OiBrZXksXG4gICAgICAgICAgICAgICAgJHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgICAgICAkdHlwZTogdHlwZW9mIHZhbHVlXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocGFyYW1zLmtleSkge1xuICAgICAgICAgICAgb2JqID0gY29udGV4dC5yZXNvbHZlKHBhcmFtcy5rZXkpO1xuICAgICAgICAgICAgaWYgKG9iaiBpbnN0YW5jZW9mIE9ic2VydmFibGVPYmplY3QpIHtcbiAgICAgICAgICAgICAgICBvYmogPSBvYmoudG9OYXRpdmUodHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgICAgIGlmICghIXBhcmFtcy5zb3J0KSB7XG4gICAgICAgICAgICAgICAgICAgIHNvcnQgPSBkdXN0LmhlbHBlcnMudGFwKHBhcmFtcy5zb3J0LCBjaHVuaywgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIGFyciA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGsgaW4gb2JqKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob2JqLmhhc093blByb3BlcnR5KGspKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJyLnB1c2goayk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29tcGFyZUZuID0gY29udGV4dC5nbG9iYWxbc29ydF07XG4gICAgICAgICAgICAgICAgICAgIGlmICghY29tcGFyZUZuICYmIHNvcnQgPT09ICdkZXNjJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tcGFyZUZuID0gZGVzYztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoY29tcGFyZUZuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcnIuc29ydChjb21wYXJlRm4pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJyLnNvcnQoYXNjKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaHVuayA9IHByb2Nlc3NCb2R5KGFycltpXSwgb2JqW2FycltpXV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChrIGluIG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNodW5rID0gcHJvY2Vzc0JvZHkoaywgb2JqW2tdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ01pc3NpbmcgYm9keSBibG9jayBpbiB0aGUgaXRlciBoZWxwZXIuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnTWlzc2luZyBwYXJhbWV0ZXIgXFwna2V5XFwnIGluIHRoZSBpdGVyIGhlbHBlci4nKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2h1bms7XG5cbiAgICB9O1xuXG5cblxuICAgIGR1c3QuaGVscGVycy5sZW5ndGggPSBmdW5jdGlvbihjaHVuaywgY29udGV4dCwgYm9kaWVzLCBwYXJhbXMpIHtcbiAgICAgICAgaWYgKCFwYXJhbXMua2V5KSB7XG4gICAgICAgICAgICBjaHVuay53cml0ZSgwKTtcbiAgICAgICAgfSBlbHNlIGlmIChwYXJhbXMua2V5LmNvbnN0cnVjdG9yID09PSBTdHJpbmcgfHwgcGFyYW1zLmtleS5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpIHtcbiAgICAgICAgICAgIGNodW5rLndyaXRlKHBhcmFtcy5rZXkubGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIGlmIChwYXJhbXMua2V5LmNvbnN0cnVjdG9yID09PSBPYmplY3QpIHtcbiAgICAgICAgICAgIGNodW5rLndyaXRlKGtleXMocGFyYW1zLmtleS5jb25zdHJ1Y3RvcikubGVuZ3RoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgfTtcblxuICAgIGR1c3QuaGVscGVycy5jYWxjID0gZnVuY3Rpb24oY2h1bmssIGNvbnRleHQsIGJvZGllcywgcGFyYW1zKSB7XG4gICAgICAgIHZhciByZXN1bHQ7XG4gICAgICAgIGlmIChnZXQod2luZG93LCAnbWF0aC5ldmFsJykpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IGdldCh3aW5kb3csICdtYXRoJykuZXZhbChjb250ZXh0LnJlc29sdmUoYm9kaWVzLmJsb2NrKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgPSBjb250ZXh0LnJlc29sdmUoYm9kaWVzLmJsb2NrKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGFyYW1zLmZvcm1hdCkge1xuICAgICAgICAgICAgc3dpdGNoIChwYXJhbXMuZm9ybWF0KSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnbW9uZXknOlxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSByZXN1bHQudG9GaXhlZCgyKS5yZXBsYWNlKCcuJywgJywnKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnaW50ZWdlcic6XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IE1hdGgucm91bmQocmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhcmFtcy52YXIgJiYgcGFyYW1zLnZhci5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnRleHQuZ2xvYmFsW3BhcmFtcy52YXJdID0gcmVzdWx0O1xuICAgICAgICAgICAgY2h1bmsud3JpdGUoJycpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2h1bmsud3JpdGUocmVzdWx0KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgfTtcblxuXG5cblxuXG5cblxuICAgIGZ1bmN0aW9uIGxvZyhoZWxwZXIsIG1zZywgbGV2ZWwpIHtcbiAgICAgICAgbGV2ZWwgPSBsZXZlbCB8fCAnSU5GTyc7XG4gICAgICAgIGhlbHBlciA9IGhlbHBlciA/ICd7QCcgKyBoZWxwZXIgKyAnfTogJyA6ICcnO1xuICAgICAgICBkdXN0LmxvZyhoZWxwZXIgKyBtc2csIGxldmVsKTtcbiAgICB9XG5cbiAgICB2YXIgX2RlcHJlY2F0ZWRDYWNoZSA9IHt9O1xuXG4gICAgZnVuY3Rpb24gX2RlcHJlY2F0ZWQodGFyZ2V0KSB7XG4gICAgICAgIGlmIChfZGVwcmVjYXRlZENhY2hlW3RhcmdldF0pIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsb2codGFyZ2V0LCAnRGVwcmVjYXRpb24gd2FybmluZzogJyArIHRhcmdldCArICcgaXMgZGVwcmVjYXRlZCBhbmQgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIHZlcnNpb24gb2YgZHVzdGpzLWhlbHBlcnMnLCAnV0FSTicpO1xuICAgICAgICBsb2cobnVsbCwgJ0ZvciBoZWxwIGFuZCBhIGRlcHJlY2F0aW9uIHRpbWVsaW5lLCBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2xpbmtlZGluL2R1c3Rqcy1oZWxwZXJzL3dpa2kvRGVwcmVjYXRlZC1GZWF0dXJlcyMnICsgdGFyZ2V0LnJlcGxhY2UoL1xcVysvZywgJycpLCAnV0FSTicpO1xuICAgICAgICBfZGVwcmVjYXRlZENhY2hlW3RhcmdldF0gPSB0cnVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzU2VsZWN0KGNvbnRleHQpIHtcbiAgICAgICAgcmV0dXJuIGNvbnRleHQuc3RhY2sgJiYgY29udGV4dC5zdGFjay50YWlsICYmXG4gICAgICAgICAgICBjb250ZXh0LnN0YWNrLnRhaWwuaGVhZCAmJlxuICAgICAgICAgICAgdHlwZW9mIGNvbnRleHQuc3RhY2sudGFpbC5oZWFkLl9fc2VsZWN0X18gIT09ICd1bmRlZmluZWQnO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNlbGVjdFN0YXRlKGNvbnRleHQpIHtcbiAgICAgICAgcmV0dXJuIGlzU2VsZWN0KGNvbnRleHQpICYmIGNvbnRleHQuZ2V0KCdfX3NlbGVjdF9fJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIHNwZWNpYWwgX19zZWxlY3RfXyBrZXkgYmVoaW5kIHRoZSBoZWFkIG9mIHRoZSBjb250ZXh0IHN0YWNrLiBVc2VkIHRvIG1haW50YWluIHRoZSBzdGF0ZVxuICAgICAqIG9mIHtAc2VsZWN0fSBibG9ja3NcbiAgICAgKiBAcGFyYW0gY29udGV4dCB7Q29udGV4dH0gYWRkIHN0YXRlIHRvIHRoaXMgQ29udGV4dFxuICAgICAqIEBwYXJhbSBvcHRzIHtPYmplY3R9IGFkZCB0aGVzZSBwcm9wZXJ0aWVzIHRvIHRoZSBzdGF0ZSAoYGtleWAgYW5kIGB0eXBlYClcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBhZGRTZWxlY3RTdGF0ZShjb250ZXh0LCBvcHRzKSB7XG4gICAgICAgIHZhciBoZWFkID0gY29udGV4dC5zdGFjay5oZWFkLFxuICAgICAgICAgICAgbmV3Q29udGV4dCA9IGNvbnRleHQucmViYXNlKCksXG4gICAgICAgICAgICBrZXk7XG5cbiAgICAgICAgaWYgKGNvbnRleHQuc3RhY2sgJiYgY29udGV4dC5zdGFjay50YWlsKSB7XG4gICAgICAgICAgICBuZXdDb250ZXh0LnN0YWNrID0gY29udGV4dC5zdGFjay50YWlsO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHN0YXRlID0ge1xuICAgICAgICAgICAgaXNQZW5kaW5nOiBmYWxzZSxcbiAgICAgICAgICAgIGlzUmVzb2x2ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgaXNEZWZlcnJlZENvbXBsZXRlOiBmYWxzZSxcbiAgICAgICAgICAgIGRlZmVycmVkczogW11cbiAgICAgICAgfTtcblxuICAgICAgICBmb3IgKGtleSBpbiBvcHRzKSB7XG4gICAgICAgICAgICBzdGF0ZVtrZXldID0gb3B0c1trZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ld0NvbnRleHRcbiAgICAgICAgICAgIC5wdXNoKHtcbiAgICAgICAgICAgICAgICAnX19zZWxlY3RfXyc6IHN0YXRlXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnB1c2goaGVhZCwgY29udGV4dC5zdGFjay5pbmRleCwgY29udGV4dC5zdGFjay5vZik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWZ0ZXIgYSB7QHNlbGVjdH0gb3Ige0BtYXRofSBibG9jayBpcyBjb21wbGV0ZSwgdGhleSBpbnZva2UgdGhpcyBmdW5jdGlvblxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlc29sdmVTZWxlY3REZWZlcnJlZHMoc3RhdGUpIHtcbiAgICAgICAgdmFyIHgsIGxlbjtcbiAgICAgICAgc3RhdGUuaXNEZWZlcnJlZFBlbmRpbmcgPSB0cnVlO1xuICAgICAgICBpZiAoc3RhdGUuZGVmZXJyZWRzLmxlbmd0aCkge1xuICAgICAgICAgICAgc3RhdGUuaXNEZWZlcnJlZENvbXBsZXRlID0gdHJ1ZTtcbiAgICAgICAgICAgIGZvciAoeCA9IDAsIGxlbiA9IHN0YXRlLmRlZmVycmVkcy5sZW5ndGg7IHggPCBsZW47IHgrKykge1xuICAgICAgICAgICAgICAgIHN0YXRlLmRlZmVycmVkc1t4XSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmlzRGVmZXJyZWRQZW5kaW5nID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXNlZCBieSB7QGNvbnRleHREdW1wfVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGpzb25GaWx0ZXIoa2V5LCB2YWx1ZSkge1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWUudG9TdHJpbmcoKVxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8oXlxccyt8XFxzKyQpL21nLCAnJylcbiAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxuL21nLCAnJylcbiAgICAgICAgICAgICAgICAucmVwbGFjZSgvLFxccyovbWcsICcsICcpXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcKVxcey9tZywgJykgeycpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZSBhIHRydXRoIHRlc3QgaGVscGVyXG4gICAgICovXG4gICAgZnVuY3Rpb24gdHJ1dGhUZXN0KG5hbWUsIHRlc3QpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykge1xuICAgICAgICAgICAgcmV0dXJuIGZpbHRlcihjaHVuaywgY29udGV4dCwgYm9kaWVzLCBwYXJhbXMsIG5hbWUsIHRlc3QpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoaXMgZnVuY3Rpb24gaXMgaW52b2tlZCBieSB0cnV0aCB0ZXN0IGhlbHBlcnNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBmaWx0ZXIoY2h1bmssIGNvbnRleHQsIGJvZGllcywgcGFyYW1zLCBoZWxwZXJOYW1lLCB0ZXN0KSB7IC8vanNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAgIHZhciBib2R5ID0gYm9kaWVzLmJsb2NrLFxuICAgICAgICAgICAgc2tpcCA9IGJvZGllc1snZWxzZSddLFxuICAgICAgICAgICAgc2VsZWN0U3RhdGUgPSBnZXRTZWxlY3RTdGF0ZShjb250ZXh0KSB8fCB7fSxcbiAgICAgICAgICAgIHdpbGxSZXNvbHZlLCBrZXksIHZhbHVlLCB0eXBlO1xuXG4gICAgICAgIC8vIE9uY2Ugb25lIHRydXRoIHRlc3QgaW4gYSBzZWxlY3QgcGFzc2VzLCBzaG9ydC1jaXJjdWl0IHRoZSByZXN0IG9mIHRoZSB0ZXN0c1xuICAgICAgICBpZiAoc2VsZWN0U3RhdGUuaXNSZXNvbHZlZCAmJiAhc2VsZWN0U3RhdGUuaXNEZWZlcnJlZFBlbmRpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBjaHVuaztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpcnN0IGNoZWNrIGZvciBhIGtleSBvbiB0aGUgaGVscGVyIGl0c2VsZiwgdGhlbiBsb29rIGZvciBhIGtleSBvbiB0aGUge0BzZWxlY3R9XG4gICAgICAgIGlmIChwYXJhbXMuaGFzT3duUHJvcGVydHkoJ2tleScpKSB7XG4gICAgICAgICAgICBrZXkgPSBwYXJhbXMua2V5O1xuICAgICAgICB9IGVsc2UgaWYgKHNlbGVjdFN0YXRlLmhhc093blByb3BlcnR5KCdrZXknKSkge1xuICAgICAgICAgICAga2V5ID0gc2VsZWN0U3RhdGUua2V5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9nKGhlbHBlck5hbWUsICdObyBrZXkgc3BlY2lmaWVkJywgJ1dBUk4nKTtcbiAgICAgICAgICAgIHJldHVybiBjaHVuaztcbiAgICAgICAgfVxuXG4gICAgICAgIHR5cGUgPSBwYXJhbXMudHlwZSB8fCBzZWxlY3RTdGF0ZS50eXBlO1xuXG4gICAgICAgIGtleSA9IGNvZXJjZShjb250ZXh0LnJlc29sdmUoa2V5KSwgdHlwZSk7XG4gICAgICAgIHZhbHVlID0gY29lcmNlKGNvbnRleHQucmVzb2x2ZShwYXJhbXMudmFsdWUpLCB0eXBlKTtcblxuICAgICAgICBpZiAodGVzdChrZXksIHZhbHVlKSkge1xuICAgICAgICAgICAgLy8gT25jZSBhIHRydXRoIHRlc3QgcGFzc2VzLCBwdXQgdGhlIHNlbGVjdCBpbnRvICdwZW5kaW5nJyBzdGF0ZS4gTm93IHdlIGNhbiByZW5kZXIgdGhlIGJvZHkgb2ZcbiAgICAgICAgICAgIC8vIHRoZSB0cnV0aCB0ZXN0ICh3aGljaCBtYXkgY29udGFpbiB0cnV0aCB0ZXN0cykgd2l0aG91dCBhbHRlcmluZyB0aGUgc3RhdGUgb2YgdGhlIHNlbGVjdC5cbiAgICAgICAgICAgIGlmICghc2VsZWN0U3RhdGUuaXNQZW5kaW5nKSB7XG4gICAgICAgICAgICAgICAgd2lsbFJlc29sdmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHNlbGVjdFN0YXRlLmlzUGVuZGluZyA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgICAgIGNodW5rID0gY2h1bmsucmVuZGVyKGJvZHksIGNvbnRleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHdpbGxSZXNvbHZlKSB7XG4gICAgICAgICAgICAgICAgc2VsZWN0U3RhdGUuaXNSZXNvbHZlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc2tpcCkge1xuICAgICAgICAgICAgY2h1bmsgPSBjaHVuay5yZW5kZXIoc2tpcCwgY29udGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNodW5rO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvZXJjZSh2YWx1ZSwgdHlwZSkge1xuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgdHlwZSA9IHR5cGUudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgfVxuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgICAgICAgICAgcmV0dXJuICt2YWx1ZTtcbiAgICAgICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XG4gICAgICAgICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgICAgICAgICB2YWx1ZSA9ICh2YWx1ZSA9PT0gJ2ZhbHNlJyA/IGZhbHNlIDogdmFsdWUpO1xuICAgICAgICAgICAgICAgIHJldHVybiBCb29sZWFuKHZhbHVlKTtcbiAgICAgICAgICAgIGNhc2UgJ2RhdGUnOlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgRGF0ZSh2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgdmFyIGhlbHBlcnMgPSB7XG5cbiAgICAgICAgLy8gVXRpbGl0eSBoZWxwaW5nIHRvIHJlc29sdmUgZHVzdCByZWZlcmVuY2VzIGluIHRoZSBnaXZlbiBjaHVua1xuICAgICAgICAvLyB1c2VzIG5hdGl2ZSBEdXN0IENvbnRleHQjcmVzb2x2ZSAoYXZhaWxhYmxlIHNpbmNlIER1c3QgMi42LjIpXG4gICAgICAgICd0YXAnOiBmdW5jdGlvbihpbnB1dCwgY2h1bmssIGNvbnRleHQpIHtcbiAgICAgICAgICAgIC8vIGRlcHJlY2F0ZWQgZm9yIHJlbW92YWwgaW4gMS44XG4gICAgICAgICAgICBfZGVwcmVjYXRlZCgndGFwJyk7XG4gICAgICAgICAgICByZXR1cm4gY29udGV4dC5yZXNvbHZlKGlucHV0KTtcbiAgICAgICAgfSxcblxuICAgICAgICAnc2VwJzogZnVuY3Rpb24oY2h1bmssIGNvbnRleHQsIGJvZGllcykge1xuICAgICAgICAgICAgdmFyIGJvZHkgPSBib2RpZXMuYmxvY2s7XG4gICAgICAgICAgICBpZiAoY29udGV4dC5zdGFjay5pbmRleCA9PT0gY29udGV4dC5zdGFjay5vZiAtIDEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBib2R5KGNodW5rLCBjb250ZXh0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNodW5rO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgICdmaXJzdCc6IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMpIHtcbiAgICAgICAgICAgIGlmIChjb250ZXh0LnN0YWNrLmluZGV4ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJvZGllcy5ibG9jayhjaHVuaywgY29udGV4dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgIH0sXG5cbiAgICAgICAgJ2xhc3QnOiBmdW5jdGlvbihjaHVuaywgY29udGV4dCwgYm9kaWVzKSB7XG4gICAgICAgICAgICBpZiAoY29udGV4dC5zdGFjay5pbmRleCA9PT0gY29udGV4dC5zdGFjay5vZiAtIDEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYm9kaWVzLmJsb2NrKGNodW5rLCBjb250ZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjaHVuaztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICoge0Bjb250ZXh0RHVtcH1cbiAgICAgICAgICogQHBhcmFtIGtleSB7U3RyaW5nfSBzZXQgdG8gJ2Z1bGwnIHRvIHRoZSBmdWxsIGNvbnRleHQgc3RhY2ssIG90aGVyd2lzZSB0aGUgY3VycmVudCBjb250ZXh0IGlzIGR1bXBlZFxuICAgICAgICAgKiBAcGFyYW0gdG8ge1N0cmluZ30gc2V0IHRvICdjb25zb2xlJyB0byBsb2cgdG8gY29uc29sZSwgb3RoZXJ3aXNlIG91dHB1dHMgdG8gdGhlIGNodW5rXG4gICAgICAgICAqL1xuICAgICAgICAnY29udGV4dER1bXAnOiBmdW5jdGlvbihjaHVuaywgY29udGV4dCwgYm9kaWVzLCBwYXJhbXMpIHtcbiAgICAgICAgICAgIHZhciB0byA9IGNvbnRleHQucmVzb2x2ZShwYXJhbXMudG8pLFxuICAgICAgICAgICAgICAgIGtleSA9IGNvbnRleHQucmVzb2x2ZShwYXJhbXMua2V5KSxcbiAgICAgICAgICAgICAgICB0YXJnZXQsIG91dHB1dDtcbiAgICAgICAgICAgIHN3aXRjaCAoa2V5KSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnZnVsbCc6XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldCA9IGNvbnRleHQuc3RhY2s7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldCA9IGNvbnRleHQuc3RhY2suaGVhZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG91dHB1dCA9IEpTT04uc3RyaW5naWZ5KHRhcmdldCwganNvbkZpbHRlciwgMik7XG4gICAgICAgICAgICBzd2l0Y2ggKHRvKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnY29uc29sZSc6XG4gICAgICAgICAgICAgICAgICAgIGxvZygnY29udGV4dER1bXAnLCBvdXRwdXQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQgPSBvdXRwdXQucmVwbGFjZSgvPC9nLCAnXFxcXHUwMDNjJyk7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rID0gY2h1bmsud3JpdGUob3V0cHV0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjaHVuaztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICoge0BtYXRofVxuICAgICAgICAgKiBAcGFyYW0ga2V5IGZpcnN0IHZhbHVlXG4gICAgICAgICAqIEBwYXJhbSBtZXRob2Qge1N0cmluZ30gb3BlcmF0aW9uIHRvIHBlcmZvcm1cbiAgICAgICAgICogQHBhcmFtIG9wZXJhbmQgc2Vjb25kIHZhbHVlIChub3QgcmVxdWlyZWQgZm9yIG9wZXJhdGlvbnMgbGlrZSBgYWJzYClcbiAgICAgICAgICogQHBhcmFtIHJvdW5kIGlmIHRydXRoeSwgcm91bmQoKSB0aGUgcmVzdWx0XG4gICAgICAgICAqL1xuICAgICAgICAnbWF0aCc6IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykgeyAvL2pzaGludCBpZ25vcmU6bGluZVxuICAgICAgICAgICAgdmFyIGtleSA9IHBhcmFtcy5rZXksXG4gICAgICAgICAgICAgICAgbWV0aG9kID0gcGFyYW1zLm1ldGhvZCxcbiAgICAgICAgICAgICAgICBvcGVyYW5kID0gcGFyYW1zLm9wZXJhbmQsXG4gICAgICAgICAgICAgICAgcm91bmQgPSBwYXJhbXMucm91bmQsXG4gICAgICAgICAgICAgICAgb3V0cHV0LCBzdGF0ZSwgeCwgbGVuO1xuXG4gICAgICAgICAgICBpZiAoIXBhcmFtcy5oYXNPd25Qcm9wZXJ0eSgna2V5JykgfHwgIXBhcmFtcy5tZXRob2QpIHtcbiAgICAgICAgICAgICAgICBsb2coJ21hdGgnLCAnYGtleWAgb3IgYG1ldGhvZGAgd2FzIG5vdCBwcm92aWRlZCcsICdFUlJPUicpO1xuICAgICAgICAgICAgICAgIHJldHVybiBjaHVuaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAga2V5ID0gcGFyc2VGbG9hdChjb250ZXh0LnJlc29sdmUoa2V5KSk7XG4gICAgICAgICAgICBvcGVyYW5kID0gcGFyc2VGbG9hdChjb250ZXh0LnJlc29sdmUob3BlcmFuZCkpO1xuXG4gICAgICAgICAgICBzd2l0Y2ggKG1ldGhvZCkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ21vZCc6XG4gICAgICAgICAgICAgICAgICAgIGlmIChvcGVyYW5kID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2coJ21hdGgnLCAnRGl2aXNpb24gYnkgMCcsICdFUlJPUicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dCA9IGtleSAlIG9wZXJhbmQ7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2FkZCc6XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dCA9IGtleSArIG9wZXJhbmQ7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3N1YnRyYWN0JzpcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0ID0ga2V5IC0gb3BlcmFuZDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnbXVsdGlwbHknOlxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQgPSBrZXkgKiBvcGVyYW5kO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdkaXZpZGUnOlxuICAgICAgICAgICAgICAgICAgICBpZiAob3BlcmFuZCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nKCdtYXRoJywgJ0RpdmlzaW9uIGJ5IDAnLCAnRVJST1InKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQgPSBrZXkgLyBvcGVyYW5kO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdjZWlsJzpcbiAgICAgICAgICAgICAgICBjYXNlICdmbG9vcic6XG4gICAgICAgICAgICAgICAgY2FzZSAncm91bmQnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2Ficyc6XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dCA9IE1hdGhbbWV0aG9kXShrZXkpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICd0b2ludCc6XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dCA9IHBhcnNlSW50KGtleSwgMTApO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBsb2coJ21hdGgnLCAnTWV0aG9kIGAnICsgbWV0aG9kICsgJ2AgaXMgbm90IHN1cHBvcnRlZCcsICdFUlJPUicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodHlwZW9mIG91dHB1dCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBpZiAocm91bmQpIHtcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0ID0gTWF0aC5yb3VuZChvdXRwdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoYm9kaWVzICYmIGJvZGllcy5ibG9jaykge1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0ID0gYWRkU2VsZWN0U3RhdGUoY29udGV4dCwge1xuICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBvdXRwdXRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rID0gY2h1bmsucmVuZGVyKGJvZGllcy5ibG9jaywgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmVTZWxlY3REZWZlcnJlZHMoZ2V0U2VsZWN0U3RhdGUoY29udGV4dCkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rID0gY2h1bmsud3JpdGUob3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjaHVuaztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICoge0BzZWxlY3R9XG4gICAgICAgICAqIEdyb3VwcyBhIHNldCBvZiB0cnV0aCB0ZXN0cyBhbmQgb3V0cHV0cyB0aGUgZmlyc3Qgb25lIHRoYXQgcGFzc2VzLlxuICAgICAgICAgKiBBbHNvIGNvbnRhaW5zIHtAYW55fSBhbmQge0Bub25lfSBibG9ja3MuXG4gICAgICAgICAqIEBwYXJhbSBrZXkgYSB2YWx1ZSBvciByZWZlcmVuY2UgdG8gdXNlIGFzIHRoZSBsZWZ0LWhhbmQgc2lkZSBvZiBjb21wYXJpc29uc1xuICAgICAgICAgKiBAcGFyYW0gdHlwZSBjb2VyY2UgYWxsIHRydXRoIHRlc3Qga2V5cyB3aXRob3V0IGFuIGV4cGxpY2l0IHR5cGUgdG8gdGhpcyB0eXBlXG4gICAgICAgICAqL1xuICAgICAgICAnc2VsZWN0JzogZnVuY3Rpb24oY2h1bmssIGNvbnRleHQsIGJvZGllcywgcGFyYW1zKSB7XG4gICAgICAgICAgICB2YXIgYm9keSA9IGJvZGllcy5ibG9jayxcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IHt9O1xuXG4gICAgICAgICAgICBpZiAocGFyYW1zLmhhc093blByb3BlcnR5KCdrZXknKSkge1xuICAgICAgICAgICAgICAgIHN0YXRlLmtleSA9IGNvbnRleHQucmVzb2x2ZShwYXJhbXMua2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChwYXJhbXMuaGFzT3duUHJvcGVydHkoJ3R5cGUnKSkge1xuICAgICAgICAgICAgICAgIHN0YXRlLnR5cGUgPSBwYXJhbXMudHlwZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0ID0gYWRkU2VsZWN0U3RhdGUoY29udGV4dCwgc3RhdGUpO1xuICAgICAgICAgICAgICAgIGNodW5rID0gY2h1bmsucmVuZGVyKGJvZHksIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgIHJlc29sdmVTZWxlY3REZWZlcnJlZHMoZ2V0U2VsZWN0U3RhdGUoY29udGV4dCkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2coJ3NlbGVjdCcsICdNaXNzaW5nIGJvZHkgYmxvY2snLCAnV0FSTicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNodW5rO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcnV0aCB0ZXN0IGhlbHBlcnNcbiAgICAgICAgICogQHBhcmFtIGtleSBhIHZhbHVlIG9yIHJlZmVyZW5jZSB0byB1c2UgYXMgdGhlIGxlZnQtaGFuZCBzaWRlIG9mIGNvbXBhcmlzb25zXG4gICAgICAgICAqIEBwYXJhbSB2YWx1ZSBhIHZhbHVlIG9yIHJlZmVyZW5jZSB0byB1c2UgYXMgdGhlIHJpZ2h0LWhhbmQgc2lkZSBvZiBjb21wYXJpc29uc1xuICAgICAgICAgKiBAcGFyYW0gdHlwZSBpZiBzcGVjaWZpZWQsIGBrZXlgIGFuZCBgdmFsdWVgIHdpbGwgYmUgZm9yY2libHkgY2FzdCB0byB0aGlzIHR5cGVcbiAgICAgICAgICovXG4gICAgICAgICdlcSc6IHRydXRoVGVzdCgnZXEnLCBmdW5jdGlvbihsZWZ0LCByaWdodCkge1xuICAgICAgICAgICAgcmV0dXJuIGxlZnQgPT09IHJpZ2h0O1xuICAgICAgICB9KSxcbiAgICAgICAgJ25lJzogdHJ1dGhUZXN0KCduZScsIGZ1bmN0aW9uKGxlZnQsIHJpZ2h0KSB7XG4gICAgICAgICAgICByZXR1cm4gbGVmdCAhPT0gcmlnaHQ7XG4gICAgICAgIH0pLFxuICAgICAgICAnbHQnOiB0cnV0aFRlc3QoJ2x0JywgZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICAgICAgICAgIHJldHVybiBsZWZ0IDwgcmlnaHQ7XG4gICAgICAgIH0pLFxuICAgICAgICAnbHRlJzogdHJ1dGhUZXN0KCdsdGUnLCBmdW5jdGlvbihsZWZ0LCByaWdodCkge1xuICAgICAgICAgICAgcmV0dXJuIGxlZnQgPD0gcmlnaHQ7XG4gICAgICAgIH0pLFxuICAgICAgICAnZ3QnOiB0cnV0aFRlc3QoJ2d0JywgZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICAgICAgICAgIHJldHVybiBsZWZ0ID4gcmlnaHQ7XG4gICAgICAgIH0pLFxuICAgICAgICAnZ3RlJzogdHJ1dGhUZXN0KCdndGUnLCBmdW5jdGlvbihsZWZ0LCByaWdodCkge1xuICAgICAgICAgICAgcmV0dXJuIGxlZnQgPj0gcmlnaHQ7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB7QGFueX1cbiAgICAgICAgICogT3V0cHV0cyBhcyBsb25nIGFzIGF0IGxlYXN0IG9uZSB0cnV0aCB0ZXN0IGluc2lkZSBhIHtAc2VsZWN0fSBoYXMgcGFzc2VkLlxuICAgICAgICAgKiBNdXN0IGJlIGNvbnRhaW5lZCBpbnNpZGUgYSB7QHNlbGVjdH0gYmxvY2suXG4gICAgICAgICAqIFRoZSBwYXNzaW5nIHRydXRoIHRlc3QgY2FuIGJlIGJlZm9yZSBvciBhZnRlciB0aGUge0Bhbnl9IGJsb2NrLlxuICAgICAgICAgKi9cbiAgICAgICAgJ2FueSc6IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIHNlbGVjdFN0YXRlID0gZ2V0U2VsZWN0U3RhdGUoY29udGV4dCk7XG5cbiAgICAgICAgICAgIGlmICghc2VsZWN0U3RhdGUpIHtcbiAgICAgICAgICAgICAgICBsb2coJ2FueScsICdNdXN0IGJlIHVzZWQgaW5zaWRlIGEge0BzZWxlY3R9IGJsb2NrJywgJ0VSUk9SJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChzZWxlY3RTdGF0ZS5pc0RlZmVycmVkQ29tcGxldGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdhbnknLCAnTXVzdCBub3QgYmUgbmVzdGVkIGluc2lkZSB7QGFueX0gb3Ige0Bub25lfSBibG9jaycsICdFUlJPUicpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rID0gY2h1bmsubWFwKGZ1bmN0aW9uKGNodW5rKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxlY3RTdGF0ZS5kZWZlcnJlZHMucHVzaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZWN0U3RhdGUuaXNSZXNvbHZlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaHVuayA9IGNodW5rLnJlbmRlcihib2RpZXMuYmxvY2ssIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaHVuay5lbmQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHtAbm9uZX1cbiAgICAgICAgICogT3V0cHV0cyBpZiBubyB0cnV0aCB0ZXN0cyBpbnNpZGUgYSB7QHNlbGVjdH0gcGFzcy5cbiAgICAgICAgICogTXVzdCBiZSBjb250YWluZWQgaW5zaWRlIGEge0BzZWxlY3R9IGJsb2NrLlxuICAgICAgICAgKiBUaGUgcG9zaXRpb24gb2YgdGhlIGhlbHBlciBkb2VzIG5vdCBtYXR0ZXIuXG4gICAgICAgICAqL1xuICAgICAgICAnbm9uZSc6IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIHNlbGVjdFN0YXRlID0gZ2V0U2VsZWN0U3RhdGUoY29udGV4dCk7XG5cbiAgICAgICAgICAgIGlmICghc2VsZWN0U3RhdGUpIHtcbiAgICAgICAgICAgICAgICBsb2coJ25vbmUnLCAnTXVzdCBiZSB1c2VkIGluc2lkZSBhIHtAc2VsZWN0fSBibG9jaycsICdFUlJPUicpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZWN0U3RhdGUuaXNEZWZlcnJlZENvbXBsZXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZygnbm9uZScsICdNdXN0IG5vdCBiZSBuZXN0ZWQgaW5zaWRlIHtAYW55fSBvciB7QG5vbmV9IGJsb2NrJywgJ0VSUk9SJyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2h1bmsgPSBjaHVuay5tYXAoZnVuY3Rpb24oY2h1bmspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGVjdFN0YXRlLmRlZmVycmVkcy5wdXNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc2VsZWN0U3RhdGUuaXNSZXNvbHZlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaHVuayA9IGNodW5rLnJlbmRlcihib2RpZXMuYmxvY2ssIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaHVuay5lbmQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHtAc2l6ZX1cbiAgICAgICAgICogV3JpdGUgdGhlIHNpemUgb2YgdGhlIHRhcmdldCB0byB0aGUgY2h1bmtcbiAgICAgICAgICogRmFsc3kgdmFsdWVzIGFuZCB0cnVlIGhhdmUgc2l6ZSAwXG4gICAgICAgICAqIE51bWJlcnMgYXJlIHJldHVybmVkIGFzLWlzXG4gICAgICAgICAqIEFycmF5cyBhbmQgU3RyaW5ncyBoYXZlIHNpemUgZXF1YWwgdG8gdGhlaXIgbGVuZ3RoXG4gICAgICAgICAqIE9iamVjdHMgaGF2ZSBzaXplIGVxdWFsIHRvIHRoZSBudW1iZXIgb2Yga2V5cyB0aGV5IGNvbnRhaW5cbiAgICAgICAgICogRHVzdCBib2RpZXMgYXJlIGV2YWx1YXRlZCBhbmQgdGhlIGxlbmd0aCBvZiB0aGUgc3RyaW5nIGlzIHJldHVybmVkXG4gICAgICAgICAqIEZ1bmN0aW9ucyBhcmUgZXZhbHVhdGVkIGFuZCB0aGUgbGVuZ3RoIG9mIHRoZWlyIHJldHVybiB2YWx1ZSBpcyBldmFsdWF0ZWRcbiAgICAgICAgICogQHBhcmFtIGtleSBmaW5kIHRoZSBzaXplIG9mIHRoaXMgdmFsdWUgb3IgcmVmZXJlbmNlXG4gICAgICAgICAqL1xuICAgICAgICAnc2l6ZSc6IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIGtleSA9IHBhcmFtcy5rZXksXG4gICAgICAgICAgICAgICAgdmFsdWUsIGs7XG5cbiAgICAgICAgICAgIGtleSA9IGNvbnRleHQucmVzb2x2ZShwYXJhbXMua2V5KTtcbiAgICAgICAgICAgIGlmICgha2V5IHx8IGtleSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZHVzdC5pc0FycmF5KGtleSkpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGtleS5sZW5ndGg7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFpc05hTihwYXJzZUZsb2F0KGtleSkpICYmIGlzRmluaXRlKGtleSkpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGtleTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGtleSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IDA7XG4gICAgICAgICAgICAgICAgZm9yIChrIGluIGtleSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoa2V5Lmhhc093blByb3BlcnR5KGspKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSsrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IChrZXkgKyAnJykubGVuZ3RoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNodW5rLndyaXRlKHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIGZvciAodmFyIGtleSBpbiBoZWxwZXJzKSB7XG4gICAgICAgIGR1c3QuaGVscGVyc1trZXldID0gaGVscGVyc1trZXldO1xuICAgIH1cblxuICAgIHJldHVybiBkdXN0O1xuXG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCBUZW1wbGF0aW5nRGVsZWdhdGUgZnJvbSAnLi9UZW1wbGF0aW5nRGVsZWdhdGUnO1xuaW1wb3J0IGR1c3QgZnJvbSAnYWUtZHVzdGpzJztcbmltcG9ydCB1dWlkIGZyb20gJ25vZGUtdXVpZCc7XG5pbXBvcnQgT2JzZXJ2YWJsZU9iamVjdCBmcm9tICcuLi9PYnNlcnZhYmxlT2JqZWN0JztcbmltcG9ydCBnZXQgZnJvbSAnbG9kYXNoLmdldCc7XG5pbXBvcnQgZWFjaCBmcm9tICdsb2Rhc2guZm9yZWFjaCc7XG5cbmltcG9ydCBkdXN0SGVscGVycyBmcm9tICcuL2R1c3QtaGVscGVycyc7XG5kdXN0SGVscGVycyhkdXN0KTtcbmNvbnN0IF90ZW1wbGF0ZXMgPSBuZXcgTWFwKCk7XG5sZXQgZXZpbEZuO1xuXG5jbGFzcyBEdXN0VGVtcGxhdGluZ0RlbGVnYXRlIGV4dGVuZHMgVGVtcGxhdGluZ0RlbGVnYXRlIHtcbiAgICBjb25zdHJ1Y3RvcihpbkV2aWxGbikge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB2YXIgbiA9ICdFVicgKyAnYScgKyAnTCc7XG4gICAgICAgIGV2aWxGbiA9IGluRXZpbEZuIHx8IHdpbmRvd1tuLnRvTG93ZXJDYXNlKCldO1xuXG4gICAgICAgIGR1c3QuY29sbGVjdGlvblJlc29sdmVyID0gZnVuY3Rpb24oaW5Db2xsZWN0aW9uKSB7XG4gICAgICAgICAgICBpZiAoaW5Db2xsZWN0aW9uIGluc3RhbmNlb2YgT2JzZXJ2YWJsZU9iamVjdCAmJiBpbkNvbGxlY3Rpb24uaXNDb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGluQ29sbGVjdGlvbi50b05hdGl2ZSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5Db2xsZWN0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGR1c3QucHJvcGVydHlSZXNvbHZlciA9IGZ1bmN0aW9uKGluQmFzZSwgaW5QYXRoKSB7XG4gICAgICAgICAgICBpZiAoaW5CYXNlIGluc3RhbmNlb2YgT2JzZXJ2YWJsZU9iamVjdCkge1xuICAgICAgICAgICAgICAgIGlmKGluQmFzZS5pc0NvbGxlY3Rpb24gJiYgaW5QYXRoID09PSAnbGVuZ3RoJykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW5CYXNlLmxlbmd0aDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW5CYXNlLnByb3AoaW5QYXRoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXQoaW5CYXNlLCBpblBhdGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgXG4gICAgfVxuXG4gICAgcmVnaXN0ZXJFeHRlbnNpb25zKGluRXh0ZW5zaW9ucykge1xuICAgICAgICBlYWNoKGdldChpbkV4dGVuc2lvbnMsICdmaWx0ZXJzJyksIChpbkZpbHRlciwgaW5OYW1lKSA9PiB7XG4gICAgICAgICAgICBkdXN0LmZpbHRlcnNbaW5OYW1lXSA9IGluRmlsdGVyO1xuICAgICAgICB9KTtcbiAgICAgICAgZWFjaChnZXQoaW5FeHRlbnNpb25zLCAnaGVscGVycycpLCAoaW5IZWxwZXIsIGluTmFtZSkgPT4ge1xuICAgICAgICAgICAgZHVzdC5oZWxwZXJzW2luTmFtZV0gPSBpbkhlbHBlcjtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2V0Q29sbGVjdGlvblJlc29sdmVyKGluUmVzb2x2ZXIpIHtcbiAgICAgICAgZHVzdC5jb2xsZWN0aW9uUmVzb2x2ZXIgPSBpblJlc29sdmVyO1xuICAgIH1cblxuICAgIHNldFByb3BlcnR5UmVzb2x2ZXIoaW5SZXNvbHZlcikge1xuICAgICAgICBkdXN0LnByb3BlcnR5UmVzb2x2ZXIgPSBpblJlc29sdmVyO1xuICAgIH1cblxuICAgIHJlZ2lzdGVyKGluTmFtZSwgaW5UZW1wbGF0ZSkge1xuICAgICAgICBfdGVtcGxhdGVzLnNldChpbk5hbWUsIGluVGVtcGxhdGUpO1xuICAgICAgICBkdXN0LnJlZ2lzdGVyKGluTmFtZSwgaW5UZW1wbGF0ZSk7XG4gICAgfVxuXG4gICAgcmVnaXN0ZXJUZW1wbGF0ZShpblNvdXJjZSwgaW5OYW1lKSB7XG4gICAgICAgIGluTmFtZSA9IGluTmFtZSB8fCAoJ3RlbXBsYXRlXycgKyB1dWlkLnY0KCkpO1xuICAgICAgICBjb25zdCBjb21waWxlZFNyYyA9IGR1c3QuY29tcGlsZShpblNvdXJjZSkucmVwbGFjZSgvXFxiZHVzdFxcYi9nLCAnJyk7XG5cbiAgICAgICAgY29uc3QgY29tcGlsZWRGbiA9IGV2aWxGbihjb21waWxlZFNyYyk7XG4gICAgICAgIGlmIChjb21waWxlZEZuIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgY29tcGlsZWRGbi50aGVuKChpbkZuKSA9PiB7XG4gICAgICAgICAgICAgICAgX3RlbXBsYXRlcy5zZXQoaW5OYW1lLCBpbkZuKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgX3RlbXBsYXRlcy5zZXQoaW5OYW1lLCBjb21waWxlZEZuKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW5OYW1lO1xuICAgIH1cblxuICAgIHJlbmRlcihpblRlbXBsYXRlTmFtZSwgaW5Nb2RlbCkge1xuICAgICAgICBjb25zdCB0ZW1wbGF0ZSA9IF90ZW1wbGF0ZXMuZ2V0KGluVGVtcGxhdGVOYW1lKTtcbiAgICAgICAgaWYgKCF0ZW1wbGF0ZSkge1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGBEdXN0VGVtcGxhdGluZ0RlbGVnYXRlOiBUZW1wbGF0ZSB3aXRoIG5hbWUgJHtpblRlbXBsYXRlTmFtZX0gbm90IGZvdW5kYCk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBkdXN0LnJlbmRlcih0ZW1wbGF0ZSwgaW5Nb2RlbCwgKGluRXJyb3IsIGluSHRtbCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChpbkVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChpbkVycm9yKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGluSHRtbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG59XG5sZXQgaW5zdGFuY2U7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKGluRXZpbEZuKSB7XG4gICAgcmV0dXJuIChpbnN0YW5jZSA/IGluc3RhbmNlIDogKGluc3RhbmNlID0gbmV3IER1c3RUZW1wbGF0aW5nRGVsZWdhdGUoaW5FdmlsRm4pKSk7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5pbXBvcnQgQnVzIGZyb20gJy4vQnVzJztcbmltcG9ydCBDb21wb25lbnQgZnJvbSAnLi9Db21wb25lbnQnO1xuaW1wb3J0IFBhZ2UgZnJvbSAnLi9QYWdlJztcbmltcG9ydCBPYnNlcnZhYmxlT2JqZWN0IGZyb20gJy4vT2JzZXJ2YWJsZU9iamVjdCc7XG5pbXBvcnQgZHVzdFRlbXBsYXRpbmdEZWxlZ2F0ZSBmcm9tICcuL2RlbGVnYXRlL2R1c3QtdGVtcGxhdGluZy1kZWxlZ2F0ZSc7XG5cblxubGV0IF90ZW1wbGF0aW5nRGVsZWdhdGU7XG5sZXQgX2NvbXBvbmVudENvbmZpZ1ByZXByb2Nlc3NvcjtcblxuY2xhc3MgUGFnZUZhY3Rvcnkge1xuICAgIFxuICAgIGdldFRlbXBsYXRpbmdEZWxlZ2F0ZSgpIHtcbiAgICAgICAgcmV0dXJuIF90ZW1wbGF0aW5nRGVsZWdhdGU7XG4gICAgfVxuXG4gICAgc2V0Q29tcG9uZW50Q29uZmlnUHJlUHJvY2Vzc29yKGluRm4pIHtcbiAgICBcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnY29tcG9uZW50Q29uZmlnUHJlcHJvY2Vzc29yJywgeyBcbiAgICAgICAgICAgIGdldCA6IGZ1bmN0aW9uKCkgeyBcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5GbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcGFnZShpbkNvbmZpZywgaW5Nb2RlbCwgaW5TZXR1cEZ1bmN0aW9uKSB7XG4gICAgXHQgX3RlbXBsYXRpbmdEZWxlZ2F0ZSA9IGluQ29uZmlnLnRlbXBsYXRpbmdEZWxlZ2F0ZSB8fCBkdXN0VGVtcGxhdGluZ0RlbGVnYXRlKGluQ29uZmlnLmV2aWxGdW5jdGlvbik7XG4gICAgICAgIGxldCBwYWdlID0gbmV3IFBhZ2UoaW5Db25maWcsIGluTW9kZWwsIGluU2V0dXBGdW5jdGlvbik7XG4gICAgICAgIHJldHVybiBwYWdlO1xuICAgIH1cbn1cblxuXG5leHBvcnQgZGVmYXVsdCBuZXcgUGFnZUZhY3RvcnkoKTtcbiIsIid1c2Ugc3RyaWN0JztcbmltcG9ydCBtaWNyb3Rhc2sgZnJvbSAnLi9taWNyb3Rhc2snO1xuaW1wb3J0IE9ic2VydmFibGVPYmplY3QgZnJvbSAnLi9PYnNlcnZhYmxlT2JqZWN0JztcbmltcG9ydCBDb21wb25lbnRNb2RlbCBmcm9tICcuL0NvbXBvbmVudE1vZGVsJztcbmltcG9ydCBTdGF0ZSBmcm9tICcuL1N0YXRlJztcbmltcG9ydCBCdXMgZnJvbSAnLi9CdXMnO1xuaW1wb3J0IGlzU3RyaW5nIGZyb20gJ2xvZGFzaC5pc1N0cmluZyc7XG5pbXBvcnQgaXNGdW5jdGlvbiBmcm9tICdsb2Rhc2guaXNGdW5jdGlvbic7XG5pbXBvcnQgaXNQbGFpbk9iamVjdCBmcm9tICdsb2Rhc2guaXNQbGFpbk9iamVjdCc7XG5pbXBvcnQgZWFjaCBmcm9tICdsb2Rhc2guZm9yZWFjaCc7XG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IGZhY3RvcnkgZnJvbSAnLi9wYWdlLWZhY3RvcnknO1xuaW1wb3J0IENvbXBvbmVudExpZmVjeWNsZSBmcm9tICcuL0NvbXBvbmVudExpZmVjeWNsZSc7XG5pbXBvcnQgIHtTaWduYWx9IGZyb20gJ3NpZ25hbHMnO1xuaW1wb3J0IHByaXZhdGVIYXNoIGZyb20gJy4vdXRpbC9wcml2YXRlJztcblxuY29uc3QgX3ByaXZhdGUgPSBwcml2YXRlSGFzaCgnY29tcG9uZW50Jyk7XG5cbmNvbnN0IF9zZXR1cE1vZGVsID0gZnVuY3Rpb24gX3NldHVwTW9kZWwoaW5Nb2RlbEluaXRPYmopIHtcblxuICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuXG4gICAgbGV0IGdldHRlcjtcbiAgICBpZiAoIWluTW9kZWxJbml0T2JqKSB7XG4gICAgICAgIGdldHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhZ2UucmVzb2x2ZU5vZGVNb2RlbCh0aGlzLm5vZGUpO1xuICAgICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmKGlzUGxhaW5PYmplY3QoaW5Nb2RlbEluaXRPYmopKSB7XG4gICAgICAgICAgICBfcC5tb2RlbCA9IG5ldyBDb21wb25lbnRNb2RlbChpbk1vZGVsSW5pdE9iaik7XG4gICAgICAgIH0gZWxzZSBpZihpbk1vZGVsSW5pdE9iaiBpbnN0YW5jZW9mIENvbXBvbmVudE1vZGVsKSB7XG4gICAgICAgICAgICBfcC5tb2RlbCA9IGluTW9kZWxJbml0T2JqO1xuICAgICAgICBcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF9wLm1vZGVsID0gT2JzZXJ2YWJsZU9iamVjdC5mcm9tT2JqZWN0KGluTW9kZWxJbml0T2JqKTtcbiAgICAgICAgfVxuICAgICAgICBnZXR0ZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gX3AubW9kZWw7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdtb2RlbCcsIHtcbiAgICAgICAgZ2V0OiBnZXR0ZXJcbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2hhc01vZGVsJywge1xuICAgICAgICBnZXQ6ICgpID0+ICEhaW5Nb2RlbEluaXRPYmpcbiAgICB9KTtcbn07XG5cbmNvbnN0IF9maW5kU3RhdGUgPSBmdW5jdGlvbiBfZmluZFN0YXRlKGluU3RhdGVOYW1lKSB7XG5cbiAgICBpZiAoIWluU3RhdGVOYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0YXRlcztcbiAgICB9XG4gICAgbGV0IHBhdGggPSBpblN0YXRlTmFtZS5zcGxpdCgnLicpO1xuICAgIGxldCBjdXJyZW50U3RhdGUgPSB0aGlzLnN0YXRlcztcbiAgICB3aGlsZSAocGF0aC5sZW5ndGggJiYgY3VycmVudFN0YXRlKSB7XG4gICAgICAgIGxldCBzZWcgPSBwYXRoLnNoaWZ0KCk7XG4gICAgICAgIGN1cnJlbnRTdGF0ZSA9IGN1cnJlbnRTdGF0ZS5jaGlsZChzZWcpO1xuICAgIH1cbiAgICByZXR1cm4gY3VycmVudFN0YXRlO1xufTtcblxuXG5jb25zdCBfd2F0Y2hTdGF0ZSA9IGZ1bmN0aW9uIF93YXRjaFN0YXRlKCkge1xuICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuXG4gICAgX3Auc3RhdGVJbmZvLndhdGNoKCduZXh0U3RhdGUnLCAoaW5QYXRoLCBpbkNoYW5nZXMpID0+IHtcbiAgICAgICAgbGV0IG5leHRTdGF0ZSA9IF9maW5kU3RhdGUuYmluZCh0aGlzKShpbkNoYW5nZXMubmV3VmFsdWUpO1xuICAgICAgICBpZiAoIW5leHRTdGF0ZSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCdDaGFuZ2luZyB0byB1bmtub3duIHN0YXRlOiAnICtcbiAgICAgICAgICAgICAgICBpbkNoYW5nZXMubmV3VmFsdWUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJvbGxiYWNrID0gKGluUmVhc29uKSA9PiB7XG4gICAgICAgICAgICBpblJlYXNvbiAmJiBjb25zb2xlLmRlYnVnKCdDb3VsZCBub3QgY2hhbmdlIHN0YXRlIGJlY2F1c2U6ICcgKyBpblJlYXNvbik7IC8vanNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAgICAgICBfcC5zdGF0ZUluZm8ucHJvcCgnbmV4dFN0YXRlJywgaW5DaGFuZ2VzLm9sZFZhbHVlLCB0cnVlKTtcbiAgICAgICAgICAgIGN1cnJlbnRTdGF0ZS5kaWRudExlYXZlKCk7XG4gICAgICAgICAgICBmb3IgKGxldCB3YXRjaGVyIG9mIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZVdhdGNoZXJzKSB7XG4gICAgICAgICAgICAgICAgd2F0Y2hlcihpbkNoYW5nZXMubmV3VmFsdWUsIGluQ2hhbmdlcy5vbGRWYWx1ZSwgaW5SZWFzb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBsZXQgY3VycmVudFN0YXRlID0gX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5wcm9wKCdjdXJyZW50U3RhdGVPYmplY3QnKTtcbiAgICAgICAgaWYgKGN1cnJlbnRTdGF0ZSkge1xuICAgICAgICAgICAgY3VycmVudFN0YXRlLmxlYXZpbmcoaW5DaGFuZ2VzLm5ld1ZhbHVlKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICBuZXh0U3RhdGUuZW50ZXJpbmcoaW5DaGFuZ2VzLm9sZFZhbHVlKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZUluZm8ucHJvcCgnY3VycmVudFN0YXRlT2JqZWN0JywgbmV4dFN0YXRlKTtcbiAgICAgICAgICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5wcm9wKCdzdGF0ZScsIF9wLnN0YXRlSW5mby5wcm9wKCduZXh0U3RhdGUnKSk7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRTdGF0ZS5sZWZ0KGluQ2hhbmdlcy5uZXdWYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIG5leHRTdGF0ZS5lbnRlcmVkKGluQ2hhbmdlcy5vbGRWYWx1ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgd2F0Y2hlciBvZiBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVXYXRjaGVycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgd2F0Y2hlcihpbkNoYW5nZXMubmV3VmFsdWUsIGluQ2hhbmdlcy5vbGRWYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKHJvbGxiYWNrKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKHJvbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuXG5cbmNsYXNzIENvbXBvbmVudCB7XG5cbiAgICBjb25zdHJ1Y3RvcihpbkNvbmZpZywgaW5Jbml0T2JqLCBpbkNvbnN0cnVjdG9yLCBpblBhZ2UpIHtcbiAgICAgICAgY29uc3QgbGlmZWN5Y2xlU2lnbmFsID0gbmV3IFNpZ25hbCgpO1xuICAgICAgICBjb25zdCBsaWZlY3ljbGUgPSBuZXcgQ29tcG9uZW50TGlmZWN5Y2xlKGxpZmVjeWNsZVNpZ25hbCk7XG4gICAgICAgIHRoaXMubWljcm90YXNrID0gbWljcm90YXNrO1xuICAgICAgICBfcHJpdmF0ZS5zZXQodGhpcywge1xuICAgICAgICAgICAgc3RhdGVXYXRjaGVyczogbmV3IFNldCgpLFxuICAgICAgICAgICAgbGlmZWN5Y2xlU2lnbmFsOiBsaWZlY3ljbGVTaWduYWwsXG4gICAgICAgICAgICBzdGF0ZUluZm86IG5ldyBPYnNlcnZhYmxlT2JqZWN0KClcbiAgICAgICAgfSk7XG5cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdsaWZlY3ljbGUnLCB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBsaWZlY3ljbGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgaWYgKGZhY3RvcnkuY29tcG9uZW50Q29uZmlnUHJlcHJvY2Vzc29yKSB7XG4gICAgICAgICAgICBmYWN0b3J5LmNvbXBvbmVudENvbmZpZ1ByZXByb2Nlc3NvcihpbkNvbmZpZyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jb25maWcgPSBpbkNvbmZpZztcbiAgICAgICAgdGhpcy5wYWdlID0gaW5QYWdlO1xuICAgICAgICB0aGlzLmJ1cyA9IG5ldyBCdXModGhpcyk7IC8vanNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAgIHRoaXMubmFtZSA9IGluQ29uZmlnLm5hbWU7XG4gICAgICAgIGVhY2goaW5Db25maWcuYWN0aW9ucywgKGluQWN0aW9uKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWluQWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignUGFzc2VkIGEgbnVsbCBhY3Rpb24gdG8gY29tcG9uZW50IGNvbmZpZycpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGFjdGlvbk5hbWUgPSBpc1N0cmluZyhpbkFjdGlvbikgPyBpbkFjdGlvbiA6IGluQWN0aW9uLm5hbWU7XG4gICAgICAgICAgICBpZiAoIWFjdGlvbk5hbWUpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdQYXNzZWQgYW4gb2JqZWN0IHdpdGggbm8gYWN0aW9uIG5hbWUgYXMgYWN0aW9uIGluIGNvbXBvbmVudCBjb25maWcnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gaXNQbGFpbk9iamVjdChpbkFjdGlvbikgPyBpbkFjdGlvbi5oYW5kbGVyIDogdW5kZWZpbmVkO1xuXG4gICAgICAgICAgICBpZiAoaGFuZGxlciAmJiAhaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Bhc3NlZCBhIG5vbi1mdW5jdGlvbiBhY3Rpb24gaGFuZGxlciBpbiBjb21wb25lbnQgY29uZmlnJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzUGxhaW5PYmplY3QoaW5BY3Rpb24pICYmIGluQWN0aW9uLnB1Ymxpc2ggPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1cy5wdWJsaXNoQWN0aW9uKGFjdGlvbk5hbWUsIGhhbmRsZXIgPyBoYW5kbGVyLmJpbmQodGhpcykgOiBudWxsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5idXMuYWRkQWN0aW9uKGFjdGlvbk5hbWUsIGhhbmRsZXIgPyBoYW5kbGVyLmJpbmQodGhpcykgOiBudWxsKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcbiAgICAgICAgbGV0IHRlbXBsYXRlcyA9IGluQ29uZmlnLnRlbXBsYXRlcyB8fCB7fTtcblxuICAgICAgICBfc2V0dXBNb2RlbC5jYWxsKHRoaXMsIGluSW5pdE9iaik7XG5cbiAgICAgICAgZm9yIChsZXQgdGVtcGxhdGVOYW1lIGluIHRlbXBsYXRlcykge1xuICAgICAgICAgICAgbGV0IGFjdHVhbFRlbXBsYXRlTmFtZSA9IHRlbXBsYXRlTmFtZSA9PT0gJ19kZWZhdWx0JyA/XG4gICAgICAgICAgICAgICAgJ19kZWZhdWx0LicgKyB0aGlzLm5hbWUgOlxuICAgICAgICAgICAgICAgIHRlbXBsYXRlTmFtZTtcbiAgICAgICAgICAgIGZhY3RvcnkuZ2V0VGVtcGxhdGluZ0RlbGVnYXRlKClcbiAgICAgICAgICAgICAgICAucmVnaXN0ZXIoYWN0dWFsVGVtcGxhdGVOYW1lLCB0ZW1wbGF0ZXNbdGVtcGxhdGVOYW1lXSk7XG4gICAgICAgIH1cbiAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLmhhc0RlZmF1bHRUZW1wbGF0ZSA9ICEhdGVtcGxhdGVzLl9kZWZhdWx0O1xuICAgICAgICBfd2F0Y2hTdGF0ZS5iaW5kKHRoaXMpKCk7XG4gICAgICAgIHRoaXMuc3RhdGVzID0gdGhpcy5zdGF0ZXMgfHwgbmV3IFN0YXRlKCk7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZUluZm8ucHJvcCgnY3VycmVudFN0YXRlT2JqZWN0JywgdGhpcy5zdGF0ZXMpO1xuICAgICAgICBpbkNvbnN0cnVjdG9yICYmIGluQ29uc3RydWN0b3IuYmluZCh0aGlzKSgpOyAvL2pzaGludCBpZ25vcmU6bGluZVxuXG4gICAgICAgIG1pY3JvdGFzayh0aGlzLmluaXRTdGF0ZS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICBkYXRhKGluUGF0aCwgaW5WYWx1ZSwgaW5TaWxlbnQpIHtcbiAgICAgICAgY29uc3QgcGF0aCA9ICdkYXRhJyArIChpblBhdGggPyAnLicgKyBpblBhdGggOiAnJyk7XG4gICAgICAgIHJldHVybiB0aGlzLnBhZ2UucmVzb2x2ZU5vZGVNb2RlbCh0aGlzLm5vZGUsIHBhdGgpLnByb3AocGF0aCwgaW5WYWx1ZSwgaW5TaWxlbnQpO1xuICAgIH1cblxuICAgIHBhcmVudCgpIHtcbiAgICAgICAgaWYodGhpcy5wYWdlID09PSB0aGlzKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMucGFnZS5yZXNvbHZlTm9kZUNvbXBvbmVudCgkKHRoaXMubm9kZSkucGFyZW50KCkpO1xuICAgIH1cblxuICAgIGluaXRTdGF0ZSgpIHtcblxuICAgIH1cblxuICAgIGdldEN1cnJlbnRTdGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZUluZm8ucHJvcCgnY3VycmVudFN0YXRlT2JqZWN0Jyk7XG4gICAgfVxuXG4gICAgdHJ5U3RhdGUoaW5TdGF0ZU5hbWUpIHtcbiAgICAgICAgaWYgKGluU3RhdGVOYW1lID09PSAoX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5wcm9wKCdzdGF0ZScpIHx8ICcnKSkge1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHdhdGNoZXIgPSAoaW5OZXdTdGF0ZSwgaW5PbGRTdGF0ZSwgaW5FcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChpbkVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChpbkVycm9yKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGluTmV3U3RhdGUsIGluT2xkU3RhdGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLnVud2F0Y2hTdGF0ZSh3YXRjaGVyKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLndhdGNoU3RhdGUod2F0Y2hlcik7XG4gICAgICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVJbmZvLnByb3AoJ25leHRTdGF0ZScsIGluU3RhdGVOYW1lKTtcbiAgICAgICAgfSk7XG5cbiAgICB9XG5cbiAgICB1bndhdGNoU3RhdGUoaW5XYXRjaGVyRnVuY3Rpb24pIHtcbiAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlV2F0Y2hlcnMuZGVsZXRlKGluV2F0Y2hlckZ1bmN0aW9uKTtcbiAgICB9XG5cbiAgICB3YXRjaFN0YXRlKGluV2F0Y2hlckZ1bmN0aW9uKSB7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZVdhdGNoZXJzLmFkZChpbldhdGNoZXJGdW5jdGlvbik7XG4gICAgfVxuXG4gICAgaW52YWxpZGF0ZSgpIHtcbiAgICAgICAgaWYgKCFfcHJpdmF0ZS5nZXQodGhpcykud2lsbFJlbmRlcikge1xuICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLndpbGxSZW5kZXIgPSB0cnVlO1xuICAgICAgICAgICAgbWljcm90YXNrKHRoaXMucmVuZGVyLmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyKGluTW9kZWwpIHtcbiAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLndpbGxSZW5kZXIgPSBmYWxzZTtcbiAgICAgICAgaWYgKF9wcml2YXRlLmdldCh0aGlzKS5oYXNEZWZhdWx0VGVtcGxhdGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGRlbGVnYXRlID0gZmFjdG9yeS5nZXRUZW1wbGF0aW5nRGVsZWdhdGUoKTtcbiAgICAgICAgICAgIGNvbnN0IG1vZGVsID0gaW5Nb2RlbCA/XG4gICAgICAgICAgICAgICAgT2JzZXJ2YWJsZU9iamVjdC5mcm9tT2JqZWN0KGluTW9kZWwpIDpcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGEoKTtcbiAgICAgICAgICAgIGRlbGVnYXRlLnJlbmRlcihcbiAgICAgICAgICAgICAgICAnX2RlZmF1bHQuJyArIHRoaXMubmFtZSxcbiAgICAgICAgICAgICAgICBtb2RlbCkudGhlbigoaW5IdG1sKSA9PiB7XG4gICAgICAgICAgICAgICAgJCh0aGlzLm5vZGUpLmh0bWwoaW5IdG1sKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuYWZ0ZXJSZW5kZXIgJiYgdGhpcy5hZnRlclJlbmRlcigpOyAvL2pzaGludCBpZ25vcmU6bGluZVxuICAgICAgICAgICAgICAgIGNvbnN0IG11dGF0aW9uT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIF9wcml2YXRlLmdldCh0aGlzKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmxpZmVjeWNsZVNpZ25hbC5kaXNwYXRjaCgncmVuZGVyZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG11dGF0aW9uT2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIG11dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZSgkKHRoaXMubm9kZSkuZ2V0KDApLCB7Y2hpbGRMaXN0IDogdHJ1ZX0pO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGluRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGluRXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ29tcG9uZW50O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgaXNBcnJheSBmcm9tICdsb2Rhc2guaXNBcnJheSc7XG5pbXBvcnQgbWVyZ2UgZnJvbSAnbG9kYXNoLm1lcmdlJztcbmltcG9ydCBtZXJnZVdpdGggZnJvbSAnbG9kYXNoLm1lcmdlV2l0aCc7XG5pbXBvcnQgcGFnZUZhY3RvcnkgZnJvbSAnLi9wYWdlLWZhY3RvcnknO1xubGV0IF9jb25maWcsIF9tb2RlbCwgX2NvbnN0cnVjdG9yRm47XG5cbmNsYXNzIE1hc3RlclBhZ2Uge1xuXG4gICAgY29uc3RydWN0b3IoaW5Db25maWcsIGluTW9kZWwsIGluQ29uc3RydWN0b3JGbikge1xuICAgICAgICBfY29uZmlnID0gaW5Db25maWc7XG4gICAgICAgIF9tb2RlbCA9IGluTW9kZWw7XG4gICAgICAgIF9jb25zdHJ1Y3RvckZuID0gaW5Db25zdHJ1Y3RvckZuO1xuICAgIH1cblxuICAgIGNyZWF0ZShpbkNvbmZpZywgaW5Nb2RlbCwgaW5Db25zdHJ1Y3RvckZuKSB7XG4gICAgICAgIC8vVE9ETzogbWVyZ2UgcGFyYW1zIHdpdGggdGVtcGxhdGUgcGFyYW1zLiB3cmFwIGNvbnN0cnVjdG9yXG5cbiAgICAgICAgZnVuY3Rpb24gY3VzdG9taXplcihvYmpWYWx1ZSwgc3JjVmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChpc0FycmF5KG9ialZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvYmpWYWx1ZS5jb25jYXQoc3JjVmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29uZmlnID0ge307XG4gICAgICAgIG1lcmdlV2l0aChjb25maWcsIF9jb25maWcsIGluQ29uZmlnLCBjdXN0b21pemVyKTtcblxuICAgICAgICAvLyBjb25zdCBtb2RlbCA9IHt9O1xuICAgICAgICAvLyBtZXJnZShtb2RlbCwgX21vZGVsLCBpbk1vZGVsKTtcblxuICAgICAgICBjb25zdCBjb25zdHJ1Y3RvckZuID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBfY29uc3RydWN0b3JGbi5jYWxsKHRoaXMsIGNvbmZpZyk7XG4gICAgICAgICAgICBpbkNvbnN0cnVjdG9yRm4uY2FsbCh0aGlzKTtcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gcGFnZUZhY3RvcnkucGFnZShjb25maWcsIGluTW9kZWwsIGNvbnN0cnVjdG9yRm4pO1xuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWFzdGVyUGFnZTtcbiJdLCJuYW1lcyI6WyJfcHJpdmF0ZSIsIk9ic2VydmVyIiwiU2lnbmFsIiwiX3NldHVwTW9kZWwiLCJfZmluZFN0YXRlIiwiX3dhdGNoU3RhdGUiLCJmYWN0b3J5IiwiQ29tcG9uZW50IiwiZWFjaCIsIl9wYWdlIiwiYWN0aW9uIiwiYWVCdXR0b24iLCJhZUxpbmsiLCJhZUlucHV0IiwiYWVSZW5kZXIiLCJhZUJpbmQiLCJhZUFjdGlvbiIsImFlU3RhdGUiLCJhZUVhY2giLCJhZU1hbmFnZWQiLCJfY29uZmlnIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFQSxJQUFJLElBQUksR0FBRyxNQUFNLENBQUM7O0FBRWxCLElBQUksS0FBSztJQUFFLFFBQVE7QUFFbkIsSUFBSSxJQUFJLENBQUMsT0FBTyxJQUFJLE9BQU8sSUFBSSxDQUFDLE9BQU8s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