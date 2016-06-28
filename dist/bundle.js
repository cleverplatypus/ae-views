'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var lodash = require('lodash');
var $ = _interopDefault(require('jquery'));
var signals = require('signals');
var uuid = _interopDefault(require('node-uuid'));
var dust = _interopDefault(require('ae-dustjs'));

var root = window;

    var defer;
var observer$1;
if (root.process && typeof root.process.nextTick === 'function') {
        /* avoid buggy nodejs setImmediate */
        if (root.setImmediate && root.process.versions.node.split('.')[1] > '10') defer = root.setImmediate;
        else defer = root.process.nextTick;
    } else if (root.vertx && typeof root.vertx.runOnLoop === 'function') defer = root.vertx.RunOnLoop;
    else if (root.vertx && typeof root.vertx.runOnContext === 'function') defer = root.vertx.runOnContext;
    else if ((observer$1 = root.MutationObserver || root.WebKitMutationObserver)) {
        defer = (function(document, observer, drain) {
            var el = document.createElement('div');
            new observer(drain).observe(el, { attributes: true });
            return function() { el.setAttribute('x', 'y'); };
        }(document, observer$1, drain));
    } else if (typeof root.setTimeout === 'function' && (root.ActiveXObject || !root.postMessage)) {
        /* use setTimeout to avoid buggy IE MessageChannel */
        defer = function(f) { root.setTimeout(f, 0); };
    } else if (root.MessageChannel && typeof root.MessageChannel === 'function') {
        var fifo = [],
            channel = new root.MessageChannel();
        channel.port1.onmessage = function() {
            (fifo.shift())(); };
        defer = function(f) { fifo[fifo.length] = f;
            channel.port2.postMessage(0); };
    } else if (typeof root.setTimeout === 'function') defer = function(f) { root.setTimeout(f, 0); };
    else throw new Error("no candidate for defer");

    var queue = [];
var length = 0;
function microtask(func, args, ctx, err) {
        if (!length) defer(drain);

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
                } else throw err;
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

class Observer {
    constructor(inParent) {
        _private$2.set(this, {
            parent: inParent,
            listeners: new Set(),
            childrenListeners: new Set(),
            descendantListeners: new Set(),
            children: {}
        });
    }


    unlisten(inPath, inListener) {

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
        if (/\w+/.test(propName)) {
            _p.children[propName] = _p.children[propName] || new Observer(this);
            if (segs.length) {
                _p.children[propName].listen(segs.join('.'), inListener);
            } else {
                _p.listeners.add(function(inNotifiedPath, inChanges) {
                    if (inNotifiedPath === inPath) {
                        inListener(inNotifiedPath, inChanges);
                    }
                });
                _private$2.get(_p.children[propName]).listeners.add(inListener);
            }
        } else if (propName === '*') {
            //_p.childrenListeners.add(inListener);
            _p.listeners.add(inListener);

        } else if (propName === '**') {
            _p.descendantListeners.add(inListener);
            // _p.listeners.add(inListener);
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
            _queue.get(fn).push({ path: inPath, changes: inChanges });
        };
        if (propName) {
            if (lodash.has(_p.children, propName) && segs.length) {
                _p.children[propName].notify(segs.join('.'), inChanges);
            }
            if (!segs.length) {
                shouldTrigger = shouldTrigger || _p.listeners.size;
                for (let l of _p.listeners) {
                    pushQueue(l);
                }
            }
            shouldTrigger = shouldTrigger || _p.childrenListeners.size;
            for (let l of _p.childrenListeners) {
                pushQueue(l);
            }
            shouldTrigger = shouldTrigger || _p.descendantListeners.size;
            for (let l of _p.descendantListeners) {
                pushQueue(l);
            }
        } else {
            shouldTrigger = shouldTrigger || _p.listeners.size;
            for (let l of _p.listeners) {
                pushQueue(l);
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

class Observable {

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

class ObservableObject$1 extends Observable {

    constructor(inConfig) {
        super();
        const isCollection = (lodash.get(inConfig, 'isCollection') === true);
        _private$1.set(this, {
            isSilent: false,
            isCollection: isCollection,
            changesQueue: [],
            observer: new Observer(),
            props: new Dummy(isCollection),
            setProp: function(inPath, inValue, inBackPath, inAlreadyFoundChange) {

                const path = !isNaN(inPath) ? [inPath] : inPath.split('.');
                var localProp = path.shift();

                inBackPath = inBackPath || [];
                inBackPath.push(localProp);
                let out;

                let val = _private$1.get(this).props.prop(localProp);

                if (!path.length) {
                    _private$1.get(this).props.prop(localProp, ObservableObject$1.fromObject(inValue));
                    return inAlreadyFoundChange ? null : {
                        path: inBackPath.join('.'),
                        change: {
                            type: val === undefined ? 'add' : 'replace',
                            oldValue: val,
                            newValue: _private$1.get(this).props.prop(localProp)
                        }
                    };
                } else if (val !== undefined && !(val instanceof Observable)) {
                    throw new Error('trying to set a value through a branch with a non Observable node');
                } else {
                    let alreadyFound = false;
                    if (val === undefined) {
                        val = new ObservableObject$1();
                        _private$1.get(this).props.prop(localProp, val);
                        out = inAlreadyFoundChange ? null : {
                            path: inBackPath.join('.'),
                            change: {
                                type: 'add',
                                oldValue: undefined,
                                newValue: _private$1.get(this).props.prop(localProp)
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
        } else if (this.prop(inPath) instanceof ObservableObject$1) {
            this.prop(inPath).empty();
        }

        if (lodash.keys(inData).length) {
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
                ObservableObject$1.notifyWatchers(_p);
            }
        }


    }

    merge(inData, inPath, inSilent) {

        if (!lodash.isPlainObject(inData) && !lodash.isArray(inData)) {
            throw new Error('ObservableObject.fill() must be passed a plain object');
        }
        lodash.each(inData, (inValue, inKey) => {
            const path = (inPath ? inPath + '.' : '') + inKey;
            this.prop(path, ObservableObject$1.fromObject(inValue), inSilent);
        });
    }

    static fromObject(inData) {
        if (lodash.isArray(inData)) { //REFACTOR: duplicated code?
            let a = new ObservableObject$1({ isCollection: true });
            lodash.each(inData, function(inVal, inKey) {
                a.prop(inKey, ObservableObject$1.fromObject(inVal));
            });
            return a;
        } else if (lodash.isPlainObject(inData)) {
            let o = new ObservableObject$1();
            lodash.each(inData, function(inVal, inKey) {
                o.prop(inKey, ObservableObject$1.fromObject(inVal));
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
        if (!(inBase instanceof ObservableObject$1)) {
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
            return lodash.keys(_p.props._obj).length;
        }
        return undefined;
    }

    prop(inPath, inValue, inSilent) {
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
                if (path.length && !(myProps.prop(propName) instanceof Observable)) {
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
                ObservableObject$1.notifyWatchers(_p);
            }
            return inValue;
        }
    }


//TODO: implement event-specific watch
    watch(inPath, inHandler, inEvent) {
        const _p = _private$1.get(this);
        _p.observer.listen(inPath, inHandler, inEvent);
    }
    
    toNative(inDeep) {
        var out = _private$1.get(this).isCollection ? [] : {};
        lodash.each(_private$1.get(this).props._obj, (inVal, inKey) => {
            let isObservable = inVal instanceof Observable;
            out[inKey] = isObservable && inDeep === true ? inVal.toNative(true) : inVal;
        });
        return out;
    }

    sort(inComparator) {
        if(_private$1.get(this).isCollection) {
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
        if (!inTarget || !(inTarget instanceof ObservableObject$1)) {
            throw new Error('fill() can only be invoked on an ObservableObject');
        }
        if (!inTarget || !(inTarget instanceof ObservableObject$1)) {
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
            ObservableObject$1.notifyWatchers(_p);
        }
    }

    static merge(inTarget, inPath, inContent, inSilent) {
        if (!inTarget || !(inTarget instanceof ObservableObject$1)) {
            throw new Error('merge () can only be invoked on an ObservableObject');
        }

        if (!inTarget || !(inTarget instanceof ObservableObject$1)) {
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
            ObservableObject$1.notifyWatchers(_p);
        }

    }


    empty(inSilent) {
        this.fill(null, inSilent);
    }
}
window.ObservableObject = ObservableObject$1;

const _private$3 = new WeakMap();

class State {
	constructor(...rest) {	
		let name = lodash.find(rest, (param) => lodash.isString(param)) || '';
		let children = lodash.find(rest, (param) => lodash.isArray(param));
		let parent = lodash.find(rest, (param) => param instanceof State);

		children = lodash.map(children, (inValue) => {
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
		return lodash.find(_private$3.get(this).children, (inChild) => inChild.getName() === inName);
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

var Signal$1 = require('signals').Signal;
class Bus {

    constructor(inParentBus) {
        this.parent = () => inParentBus;
        this.signals = {};
    }

    publishAction(inName, inHandler) {
        if (this.parent()) {
            this.parent().publishAction(inName, inHandler);
        } else {
            this.addAction(inName, inHandler)
        }
    }

    triggerAction(inName, ...rest) {
        if (!this.signals[inName]) {
            if (this.parent()) {
                this.parent().triggerAction.apply(this.parent(), [inName].concat(rest));
            } else {
                console.warn('Trying to trigger non existing action: ' + inName);
                return;
            }

        } else {
            this.signals[inName].dispatch.apply(null, rest);
        }
    }

    addAction(inName, inHandler, inOnce) {
        if(!this.signals[inName]) {
            this.signals[inName] = new Signal$1();
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
            if (this.parent()) {
                this.parent().onAction(inName, inHandler, inOnce);
            } else {
                this.addAction(inName, inHandler, inOnce);
                console.warn('Possibly registering listener to non existing action: ' + inName);
                console.warn('You might want to use addAction or publishAction');
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
		})
	}

	elementCreated(inHandler) {
		_private$6.get(this).signal.add((inType) => {
			if(inType === 'element-created') {
				inHandler();
			}
		})

	}

	elementAttached(inHandler) {
		_private$6.get(this).signal.add((inType) => {
			if(inType === 'element-attached') {
				inHandler();
			}
		})

	}

	elementDetached(inHandler) {
		_private$6.get(this).signal.add((inType) => {
			if(inType === 'element-detached') {
				inHandler();
			}
		})

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
        _p.model = ObservableObject$1.fromObject(inModelInitObj);
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
        let currentState = _private$5.get(this).stateInfo.currentStateObject;
        if (currentState) {
            currentState.leaving(inChanges.newValue).then(() => {
                nextState.entering(inChanges.oldValue).then(() => {
                    _private$5.get(this).stateInfo.currentStateObject = nextState;
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
        _private$5.set(this, {
            stateWatchers: new Set(),
            lifecycleSignal: lifecycleSignal,
            stateInfo: new ObservableObject$1()
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
        this.bus = new Bus(inPage ? inPage.bus : null); //jshint ignore:line
        this.name = inConfig.name;
        lodash.each(inConfig.actions, (inAction) => {
            if (!inAction) {
                console.error('Passed a null action to component config');
                return;
            }
            const actionName = lodash.isString(inAction) ? inAction : inAction.name;
            if (!actionName) {
                console.error('Passed an object with no action name as action in component config');
                return;
            }
            const handler = lodash.isPlainObject(inAction) ? inAction.handler : undefined;

            if (handler && !lodash.isFunction(handler)) {
                console.error('Passed a non-function action handler in component config');
                return;
            }
            if (lodash.isPlainObject(inAction) && inAction.publish === true) {
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
        _private$5.get(this).stateInfo.currentStateObject = this.states;
        inConstructor && inConstructor.bind(this)(); //jshint ignore:line

        microtask(this.initState.bind(this));
    }

    data(inPath, inValue, inSilent) {
        const path = 'data' + (inPath ? '.' + inPath : '');
        return this.page.resolveNodeModel(this.node, path).prop(path, inValue, inSilent);
    }

    initState() {

    }

    getCurrentState() {
        return _private$5.get(this).stateInfo.currentStateObject;
    }

    tryState(inStateName) {
        if (inStateName === _private$5.get(this).stateInfo.prop('state')) {
            return;
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
                ObservableObject$1.fromObject(inModel) :
                this.page.resolveNodeModel(this.node);
            delegate.render(
                '_default.' + this.name,
                model).then((inHtml) => {
                $(this.node).html(inHtml);
                this.afterRender && this.afterRender(); //jshint ignore:line
                _private$5.get(this)
                    .lifecycleSignal.dispatch('rendered');
            }).catch((inError) => {
                console.error(inError);
            });
        }
    }

}

const $$1 = require('jquery');

let _page = null;


function modelDataSource() {
    return function(inPage) {
        return new(function(inPage) {
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


        })(inPage);
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
};

var UNRESOLVED = Symbol('unresolved');

function typifyParams(inPage, inParams) {
    const out = {};
    lodash.each(inParams, function(inParamValue, inParamKey) {
        if (!inParamValue) {
            out[inParamKey] = null;
        } else if (lodash.isString(inParamValue) && /^~/.test(inParamValue)) {
            let resolvedValue = UNRESOLVED;
            inPage.getDataSource()
                .resolve(this, inParamValue.replace('~', '')).then((inValue) => {
                    resolvedValue = inValue;
                });
            if (resolvedValue === UNRESOLVED) {
                throw new Error('Action parameters must be resolved synchronously');
            }
            out[inParamKey] = resolvedValue;
        } else if (lodash.isString(inParamValue) && /^`.*`$/.test(inParamValue)) {
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
    if (lodash.get(this, 'pending') === true) {
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
        lodash.each(target.node, (inTargetNode) => {
            const component = inPage.resolveNodeComponent(inTargetNode);
            let event;

            const handler = (inEvent, inTrigger) => {
                if (inTrigger === 'enter' && inEvent.keyCode !== 13) {
                    return;
                }
                if (inTrigger === 'esc' && inEvent.keyCode !== 27) {
                    return;
                }
                component.bus.triggerAction(
                    actionName,
                    inEvent,
                    typifyParams(inPage, inConfig.params)
                );
            };


            for (let trigger of(inConfig.trigger || '').split(',')) {
                switch (trigger) {
                    case 'enter':
                    case 'esc':
                        event = 'keyup';
                        break;
                    case '':
                        event = 'click';
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
        console.log('created ae-button');
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
        let templateName = $(this).attr('template')
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
        })
        
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
                console.log('about to call .rendered on ' + currentState.getPath());
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

function checkbox(inPage) {
    const _page = inPage;
    let observer;
    var proto = Object.create(Element.prototype);
    proto.createdCallback = function() {
        observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                switch (mutation.attributeName) {
                    case 'label':
                        $(mutation.target).find('label>span').text($(mutation.target).attr('label'));
                        break;
                    case 'label-class':
                        $(mutation.target).find('label').attr('class', $(mutation.target).attr('label-class'));
                        break;
                    case 'value':
                        $(mutation.target).find('input').attr('value', $(mutation.target).attr('value'));
                        break;
                    case 'input-class':
                        $(mutation.target).find('input').attr('class', $(mutation.target).attr('input-class'));
                        break;
                }
            });
        });

        // configuration of the observer:
        var config = { attributes: true };

        // pass in the target node, as well as the observer options
        observer.observe(this, config);

        // later, you can stop observing
        let input = `<input type="checkbox" class="${$(this).attr('input-class') || ''}" value="${$(this).attr('value') || ''}">`;
        let out =
            `<label class="${$(this).attr('label-class') || ''}">${input}<span>${$(this).attr('label') || ''}</span></label>`;
        $(this).append(out);
    };
    proto.valueChangedHook = function(inHandler) {
        const handler = function() {
            inHandler($(this).find('input').attr('value'));
        };
        if (lodash.isFunction(inHandler)) {
            $(this).find('input').off('click', handler).on('click', handler);
        }

    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {
        observer.disconnect();
    };

    document.registerElement('ae-checkbox', { prototype: proto });
};

function radio(inPage) {
    const _page = inPage;

    var proto = Object.create(Element.prototype);
    proto.createdCallback = function() {};
    proto.valueChangedHook = function(inHandler) {
        const handler = function() {
            inHandler($(this).attr('value'));
        };
        if (lodash.isFunction(inHandler)) {
            $(this).find('input').off('click', handler).on('click', handler);
        }

    };

    proto.attachedCallback = function() {
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                switch (mutation.attributeName) {
                    case 'label':
                        $(mutation.target).find('label>span').text($(mutation.target).attr('label'));
                        break;
                    case 'label-class':
                        $(mutation.target).find('label').attr('class', $(mutation.target).attr('label-class'));
                        break;
                    case 'value':
                        $(mutation.target).find('input').attr('value', $(mutation.target).attr('value'));
                        break;
                    case 'input-class':
                        $(mutation.target).find('input').attr('class', $(mutation.target).attr('input-class'));
                        break;
                }
            });
        });

        // configuration of the observer:
        var config = { attributes: true };

        // pass in the target node, as well as the observer options
        observer.observe(this, config);

        // later, you can stop observing
        const selected = $(this).attr('checked') === 'checked' ? 'checked' : '';
        let input = `<input type="radio" name="${$(this).attr('name') || ''}" class="${$(this).attr('input-class') || ''}" ${selected} value="${$(this).attr('value') || ''}">`;
        let out =
            `<label class="${$(this).attr('label-class') || ''}">${input}<span>${$(this).attr('label') || ''}</span></label>`;
        $(this).append(out);
    };

    proto.detachedCallback = function() {
        observer.disconnect();
    };

    document.registerElement('ae-radio', { prototype: proto });
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
        if(!events) {

            switch ($(inElement).get(0).nodeName.toUpperCase()) {
                case 'INPUT':
                    if (lodash.includes(['TEXT', 'EMAIL', 'TEL', 'PASSWORD'], $(inElement).attr('type').toUpperCase())) {
                        events = 'change,keyup';
                    } else if (lodash.includes(['CHECKBOX', 'RADIO'], $(inElement).attr('type').toUpperCase())) {
                        events = 'click';
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
            inHandler({ value: this.getValue(inElement), key: $(inElement).attr('name') });
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

        lodash.each(events.split(','), (eventName) => {
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
            switch ($(inElement).attr('type').toLowerCase()) {
                case 'text':
                case 'email':
                case 'tel':
                case 'password':
                    if($(inElement).val() !== inValue) {
                        $(inElement).val(inValue);
                    }
                    break;
                case 'checkbox':
                    $(inElement).prop('checked', inValue === true|| 
                    	(!!inValue && inValue === inElement.attr('value')));
                    break;
                case 'radio':
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
            switch ($(inElement).attr('type').toLowerCase()) {
                case 'text':
                case 'email':
                case 'tel':
                case 'password':
                    return $(inElement).val();
                case 'checkbox':
                    if ($(inElement).prop('checked')) {
                        return !!targetValue ?  targetValue : $(inElement).prop('checked') === true;
                    }
                    return !!targetValue ? null : false;
                case 'radio': //jshint ignore:line
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
        } else if($(inElement).get(0).nodeName.toUpperCase() === 'TEXTAREA') {
            return $(inElement).val();
        } else if ($(inElement).get(0).nodeName.toUpperCase() === 'SELECT') {
            let out = [];
            $(inElement).find('option:selected').each(function() {
                out.push($(this).text());
            });
            return out;
        }
    }

}

var valueChangeDelegate = new InputValueChangeDelegate();

function bind(inPage) {
    'use strict';
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
                    } else if (lodash.isString(condition)) {
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
            lodash.each(this.attributes, (inAttribute) => {
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
        if ($(this).attr('debug-name')) {
            console.info($(this).attr('debug-name') + ' will render');
        }

        let templateName = $(this).attr('template');

        const path = $(this).attr('from') || '.';
        _page.getDataSource().resolve(this, path).then((inValue) => {
            const attrs = lodash.transform(this.attributes, function(result, item) {
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
        _private.set(this, { willRender: true });
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

            if (inBaseModel instanceof Observable) {
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

                console.log(inBaseModel instanceof Observable ? inBaseModel.toNative(true) : inBaseModel);
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
    
    var proto = Object.create(Element.prototype);
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
       })
    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-switch', { prototype: proto });
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
        lodash.each($(this.attributes), (inAttribute) => {
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
    checkbox(inPage);
    radio(inPage);
    action$1(inPage);
    bind(inPage);
    render(inPage);
    aeSwitch(inPage);
    aeTextInput(inPage);
}

const _dataSources = new Map();
const _private$4 = privateHash('component');

let _registry = new WeakMap();
const _initializers = [];
const _componentInjectors = [];

let _config;

const callNextInitializer = function() {
    let initializer = _initializers.shift();
    if (!initializer) {
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
            $(() => {
                this.node = $(this.mountPoint);
                lang(this);
                _private$4.get(this)
                    .lifecycleSignal.dispatch('element-created');
                _private$4.get(this)
                    .lifecycleSignal.dispatch('element-attached');
                this.render();
            });
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
        this.mountPoint = inConfig.mountPoint || 'body';
        this.addDataSource('model', modelDataSource(this));
        inConstructor.bind(this)();
        this.page = this;
        callNextInitializer.call(this);
    }


    resolveNodeModel(inNode, inPath) {
        let component = this.resolveNodeComponent(inNode);
        if(!component.hasModel) {
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
            console.debug('Could not find component in ancestry. Falling back to page component');
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

    registerComponent(inConfig, inModelPrototype, inConstructor) {
        this.registerComponentElement({
            config: inConfig,
            modelPrototype: inModelPrototype,
            constructor: inConstructor
        });
    }

    initState() {
        let hash = window.location.hash;
        if (/^#>[\w\-]/.test(hash)) {
            hash = hash.replace(/^#>/, '');
            if (this.states.getPath(hash)) {
                this.tryState(hash);
            }
        }
    }

    registerComponentElement(inDefinition) {
        var proto = Object.create(HTMLDivElement.prototype);
        var that = this;
        let component;
        const name = inDefinition.config.name;
        console.info('registering component: ' + name);
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
            _private$4.get(component)
                .lifecycleSignal.dispatch('element-attached');
            if (component.config.autoRender !== false) {
                component.render.call(component);
            }
        };

        proto.detachedCallback = function() {
            _private$4.get(component)
                .lifecycleSignal.dispatch('element-detached');
        };

        document.registerElement(inDefinition.config.name, { prototype: proto });
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
        if (!lodash.isString(inValue)) {
            return;
        }
        var split = inValue.split('').reverse();
        var tail = split.splice(0, 4);
        tail.unshift('-');

        while (split.length) {
            if(!(split.length % 4)) {
                tail.unshift('-');
            }
            tail.unshift('*');
            split.pop();
        }
        return tail.join('').replace(/--/, '-');
    };

    dust.filters.tolower = function(inValue) {
        return lodash.isString(inValue) ? inValue.toLowerCase() : inValue;
    };

    dust.filters.toupper = function(inValue) {
        return lodash.isString(inValue) ? inValue.toUpperCase() : inValue;
    };
    dust.helpers.sort = function(chunk, context, bodies, params) {
        var sort = JSON.parse(params.sort);
        var body = bodies.block;
        var sortkey;

        function isEmpty(o) {
            for (var p in o) {
                if (o.hasOwnProperty(p)) return false;
            }
            return true;
        }

        if (sort) delete params.sort;
        if (body) {
            function cmp(a, b) {
                return (a[sortkey] < b[sortkey]) ? -1 : ((a[sortkey] > b[sortkey]) ? 1 : 0);
            }
            while (sort.length) {
                sortkey = sort.pop().key;
                context.stack.head.sort(cmp);
            }
            return chunk.section(context.getPath(true, []), context, bodies, isEmpty(params) ? null : params);
        }
    }

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

        function desc(a, b) {
            if (a < b) {
                return 1;
            } else if (a > b) {
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

            if (obj instanceof Observable) {
                obj = obj.toNative();
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
                        arr.sort();
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
            chunk.write(lodash.keys(params.key.constructor).length);
        }
        return chunk;
    };

    dust.helpers.calc = function(chunk, context, bodies, params) {
        var result;
        if (lodash.get(window, 'math.eval')) {
            result = lodash.get(window, 'math').eval(context.resolve(bodies.block));
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
        return context.stack.tail &&
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
            .push({ '__select__': state })
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
    function filter(chunk, context, bodies, params, helperName, test) {
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
        'math': function(chunk, context, bodies, params) {
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
                    context = addSelectState(context, { key: output });
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
            if (inCollection instanceof ObservableObject$1 && inCollection.isCollection) {
                return inCollection.toNative();
            } else {
                return inCollection;
            }
        };

        dust.propertyResolver = function(inBase, inPath) {
            if (inBase instanceof ObservableObject$1) {
                if(inBase.isCollection && inPath === 'length') {
                    return inBase.length;
                } else {
                    return inBase.prop(inPath);
                }
            } else {
                return lodash.get(inBase, inPath);
            }
        };

       
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
        _p.model = ObservableObject$1.fromObject(inModelInitObj);
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
        let currentState = _private.get(this).stateInfo.currentStateObject;
        if (currentState) {
            currentState.leaving(inChanges.newValue).then(() => {
                nextState.entering(inChanges.oldValue).then(() => {
                    _private.get(this).stateInfo.currentStateObject = nextState;
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
        _private.set(this, {
            stateWatchers: new Set(),
            lifecycleSignal: lifecycleSignal,
            stateInfo: new ObservableObject$1()
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
        this.bus = new Bus(inPage ? inPage.bus : null); //jshint ignore:line
        this.name = inConfig.name;
        lodash.each(inConfig.actions, (inAction) => {
            if (!inAction) {
                console.error('Passed a null action to component config');
                return;
            }
            const actionName = lodash.isString(inAction) ? inAction : inAction.name;
            if (!actionName) {
                console.error('Passed an object with no action name as action in component config');
                return;
            }
            const handler = lodash.isPlainObject(inAction) ? inAction.handler : undefined;

            if (handler && !lodash.isFunction(handler)) {
                console.error('Passed a non-function action handler in component config');
                return;
            }
            if (lodash.isPlainObject(inAction) && inAction.publish === true) {
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
        _private.get(this).stateInfo.currentStateObject = this.states;
        inConstructor && inConstructor.bind(this)(); //jshint ignore:line

        microtask(this.initState.bind(this));
    }

    data(inPath, inValue, inSilent) {
        const path = 'data' + (inPath ? '.' + inPath : '');
        return this.page.resolveNodeModel(this.node, path).prop(path, inValue, inSilent);
    }

    initState() {

    }

    getCurrentState() {
        return _private.get(this).stateInfo.currentStateObject;
    }

    tryState(inStateName) {
        if (inStateName === _private.get(this).stateInfo.prop('state')) {
            return;
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
                ObservableObject$1.fromObject(inModel) :
                this.page.resolveNodeModel(this.node);
            delegate.render(
                '_default.' + this.name,
                model).then((inHtml) => {
                $(this.node).html(inHtml);
                this.afterRender && this.afterRender(); //jshint ignore:line
                _private.get(this)
                    .lifecycleSignal.dispatch('rendered');
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
            if (lodash.isArray(objValue)) {
                return objValue.concat(srcValue);
            }
        }

        const config = {};
        lodash.mergeWith(config, _config$1, inConfig, customizer);

        const model = {};
        lodash.merge(model, _model, inModel);

        const constructorFn = function() {
            _constructorFn.call(this);
            inConstructorFn.call(this);
        };

        return pageFactory.page(config, model, constructorFn);
    }
}

class ComponentModel extends ObservableObject$1 {
	constructor(inData, inRootProperties) {
		super();
		inRootProperties.data = inData;
		this.fill(inRootProperties);
	}
}

exports.ComponentModel = ComponentModel;
exports.Component = Component;
exports.Page = Page;
exports.State = State;
exports.pagefactory = pageFactory;
exports.TemplatingDelegate = TemplatingDelegate;
exports.MasterPage = MasterPage;
exports.ObservableObject = ObservableObject$1;
exports.UNRESOLVED = UNRESOLVED;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9taWNyb3Rhc2suanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvT2JzZXJ2ZXIuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvT2JzZXJ2YWJsZS5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9PYnNlcnZhYmxlT2JqZWN0LmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL1N0YXRlLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL0J1cy5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9Db21wb25lbnRMaWZlY3ljbGUuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvdXRpbC9wcml2YXRlLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2NvbXBvbmVudC5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9kYXRhc291cmNlL21vZGVsLWRhdGFzb3VyY2UuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvbGFuZy9hZS1lbGVtZW50LmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2xhbmcvYWUtbWFuYWdlZC5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9zeW1ib2wvdW5yZXNvbHZlZC5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy91dGlsL3R5cGlmeS1wYXJhbWV0ZXJzLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2RlbGVnYXRlL2FjdGlvbi10cmlnZ2VyLWRlbGVnYXRlLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2xhbmcvYWUtYnV0dG9uLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2xhbmcvYWUtZWFjaC5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9sYW5nL2FlLXN0YXRlLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2xhbmcvYWUtY2hlY2tib3guanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvbGFuZy9hZS1yYWRpby5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9sYW5nL2FlLWFjdGlvbi5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9kZWxlZ2F0ZS92YWx1ZS1jaGFuZ2UtZGVsZWdhdGUuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvbGFuZy9hZS1iaW5kLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2xhbmcvYWUtcmVuZGVyLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2xhbmcvYWUtc3dpdGNoLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2xhbmcvYWUtaW5wdXQuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvbGFuZy9hZS1sYW5nLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL1BhZ2UuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvZGVsZWdhdGUvVGVtcGxhdGluZ0RlbGVnYXRlLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL2RlbGVnYXRlL2R1c3QtaGVscGVycy5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9kZWxlZ2F0ZS9kdXN0LXRlbXBsYXRpbmctZGVsZWdhdGUuanMiLCIvVXNlcnMvYWVraWRuYS9EZXZlbG9wbWVudC9hZS12aWV3cy9zcmMvcGFnZS1mYWN0b3J5LmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL0NvbXBvbmVudC5qcyIsIi9Vc2Vycy9hZWtpZG5hL0RldmVsb3BtZW50L2FlLXZpZXdzL3NyYy9NYXN0ZXJQYWdlLmpzIiwiL1VzZXJzL2Fla2lkbmEvRGV2ZWxvcG1lbnQvYWUtdmlld3Mvc3JjL0NvbXBvbmVudE1vZGVsLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIHZhciByb290ID0gd2luZG93O1xuXG4gICAgdmFyIGRlZmVyLCBvYnNlcnZlcjtcblxuICAgIGlmIChyb290LnByb2Nlc3MgJiYgdHlwZW9mIHJvb3QucHJvY2Vzcy5uZXh0VGljayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvKiBhdm9pZCBidWdneSBub2RlanMgc2V0SW1tZWRpYXRlICovXG4gICAgICAgIGlmIChyb290LnNldEltbWVkaWF0ZSAmJiByb290LnByb2Nlc3MudmVyc2lvbnMubm9kZS5zcGxpdCgnLicpWzFdID4gJzEwJykgZGVmZXIgPSByb290LnNldEltbWVkaWF0ZTtcbiAgICAgICAgZWxzZSBkZWZlciA9IHJvb3QucHJvY2Vzcy5uZXh0VGljaztcbiAgICB9IGVsc2UgaWYgKHJvb3QudmVydHggJiYgdHlwZW9mIHJvb3QudmVydHgucnVuT25Mb29wID09PSAnZnVuY3Rpb24nKSBkZWZlciA9IHJvb3QudmVydHguUnVuT25Mb29wO1xuICAgIGVsc2UgaWYgKHJvb3QudmVydHggJiYgdHlwZW9mIHJvb3QudmVydHgucnVuT25Db250ZXh0ID09PSAnZnVuY3Rpb24nKSBkZWZlciA9IHJvb3QudmVydHgucnVuT25Db250ZXh0O1xuICAgIGVsc2UgaWYgKChvYnNlcnZlciA9IHJvb3QuTXV0YXRpb25PYnNlcnZlciB8fCByb290LldlYktpdE11dGF0aW9uT2JzZXJ2ZXIpKSB7XG4gICAgICAgIGRlZmVyID0gKGZ1bmN0aW9uKGRvY3VtZW50LCBvYnNlcnZlciwgZHJhaW4pIHtcbiAgICAgICAgICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgbmV3IG9ic2VydmVyKGRyYWluKS5vYnNlcnZlKGVsLCB7IGF0dHJpYnV0ZXM6IHRydWUgfSk7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7IGVsLnNldEF0dHJpYnV0ZSgneCcsICd5Jyk7IH07XG4gICAgICAgIH0oZG9jdW1lbnQsIG9ic2VydmVyLCBkcmFpbikpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHJvb3Quc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJyAmJiAocm9vdC5BY3RpdmVYT2JqZWN0IHx8ICFyb290LnBvc3RNZXNzYWdlKSkge1xuICAgICAgICAvKiB1c2Ugc2V0VGltZW91dCB0byBhdm9pZCBidWdneSBJRSBNZXNzYWdlQ2hhbm5lbCAqL1xuICAgICAgICBkZWZlciA9IGZ1bmN0aW9uKGYpIHsgcm9vdC5zZXRUaW1lb3V0KGYsIDApOyB9O1xuICAgIH0gZWxzZSBpZiAocm9vdC5NZXNzYWdlQ2hhbm5lbCAmJiB0eXBlb2Ygcm9vdC5NZXNzYWdlQ2hhbm5lbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB2YXIgZmlmbyA9IFtdLFxuICAgICAgICAgICAgY2hhbm5lbCA9IG5ldyByb290Lk1lc3NhZ2VDaGFubmVsKCk7XG4gICAgICAgIGNoYW5uZWwucG9ydDEub25tZXNzYWdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAoZmlmby5zaGlmdCgpKSgpOyB9O1xuICAgICAgICBkZWZlciA9IGZ1bmN0aW9uKGYpIHsgZmlmb1tmaWZvLmxlbmd0aF0gPSBmO1xuICAgICAgICAgICAgY2hhbm5lbC5wb3J0Mi5wb3N0TWVzc2FnZSgwKTsgfTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiByb290LnNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIGRlZmVyID0gZnVuY3Rpb24oZikgeyByb290LnNldFRpbWVvdXQoZiwgMCk7IH07XG4gICAgZWxzZSB0aHJvdyBuZXcgRXJyb3IoXCJubyBjYW5kaWRhdGUgZm9yIGRlZmVyXCIpO1xuXG4gICAgdmFyIHF1ZXVlID0gW10sXG4gICAgICAgIGxlbmd0aCA9IDA7XG5cbiAgICBmdW5jdGlvbiBtaWNyb3Rhc2soZnVuYywgYXJncywgY3R4LCBlcnIpIHtcbiAgICAgICAgaWYgKCFsZW5ndGgpIGRlZmVyKGRyYWluKTtcblxuICAgICAgICBxdWV1ZVtsZW5ndGgrK10gPSBbZnVuYywgYXJncywgY3R4LCBlcnJdO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRyYWluKCkge1xuICAgICAgICB2YXIgcSA9IHF1ZXVlLFxuICAgICAgICAgICAgbCA9IGxlbmd0aDtcblxuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICBsZW5ndGggPSAwO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHFbaV1bMF0uYXBwbHkocVtpXVsyXSwgcVtpXVsxXSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHFbaV1bM10gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgcVtpXVszXShlcnIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB0aHJvdyBlcnI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIGV4cG9ydCBkZWZhdWx0IG1pY3JvdGFzaztcbiIsIid1c2Ugc3RyaWN0JztcbmltcG9ydCBtaWNyb3Rhc2sgZnJvbSAnLi9taWNyb3Rhc2snO1xuXG5jb25zdCBfcXVldWUgPSBuZXcgTWFwKCk7XG5pbXBvcnQge2hhc30gZnJvbSAnbG9kYXNoJztcbmxldCBfd2lsbE5vdGlmeSA9IGZhbHNlO1xuXG5jb25zdCBfcHJpdmF0ZSA9IG5ldyBXZWFrTWFwKCk7XG5cbmNvbnN0IF9lbWl0ID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yIChsZXQgZiBvZiBfcXVldWUua2V5cygpKSB7XG4gICAgICAgIGxldCBpbmZvID0gX3F1ZXVlLmdldChmKTtcbiAgICAgICAgZm9yIChsZXQgaSBvZiBpbmZvKSB7XG4gICAgICAgICAgICBmKGkucGF0aCwgaS5jaGFuZ2VzKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBfcXVldWUuY2xlYXIoKTtcbiAgICBfd2lsbE5vdGlmeSA9IGZhbHNlO1xufTtcblxuY2xhc3MgT2JzZXJ2ZXIge1xuICAgIGNvbnN0cnVjdG9yKGluUGFyZW50KSB7XG4gICAgICAgIF9wcml2YXRlLnNldCh0aGlzLCB7XG4gICAgICAgICAgICBwYXJlbnQ6IGluUGFyZW50LFxuICAgICAgICAgICAgbGlzdGVuZXJzOiBuZXcgU2V0KCksXG4gICAgICAgICAgICBjaGlsZHJlbkxpc3RlbmVyczogbmV3IFNldCgpLFxuICAgICAgICAgICAgZGVzY2VuZGFudExpc3RlbmVyczogbmV3IFNldCgpLFxuICAgICAgICAgICAgY2hpbGRyZW46IHt9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG4gICAgdW5saXN0ZW4oaW5QYXRoLCBpbkxpc3RlbmVyKSB7XG5cbiAgICB9XG5cbiAgICBoYXNMaXN0ZW5lcnMoKSB7XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgICAgICByZXR1cm4gX3AubGlzdGVuZXJzLnNpemUgPiAwIHx8IF9wLmNoaWxkcmVuTGlzdGVuZXJzLnNpemUgPiAwIHx8IF9wLmRlc2NlbmRhbnRMaXN0ZW5lcnMuc2l6ZSA+IDA7XG4gICAgfVxuXG4gICAgbGlzdGVuKGluUGF0aCwgaW5MaXN0ZW5lcikge1xuICAgICAgICBpZiAoIWluUGF0aCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgICAgICBjb25zdCBzZWdzID0gaW5QYXRoID8gaW5QYXRoLnNwbGl0KCcuJykgOiBbXTtcbiAgICAgICAgY29uc3QgcHJvcE5hbWUgPSBzZWdzLnNoaWZ0KCk7XG4gICAgICAgIGlmICgvXFx3Ky8udGVzdChwcm9wTmFtZSkpIHtcbiAgICAgICAgICAgIF9wLmNoaWxkcmVuW3Byb3BOYW1lXSA9IF9wLmNoaWxkcmVuW3Byb3BOYW1lXSB8fCBuZXcgT2JzZXJ2ZXIodGhpcyk7XG4gICAgICAgICAgICBpZiAoc2Vncy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBfcC5jaGlsZHJlbltwcm9wTmFtZV0ubGlzdGVuKHNlZ3Muam9pbignLicpLCBpbkxpc3RlbmVyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgX3AubGlzdGVuZXJzLmFkZChmdW5jdGlvbihpbk5vdGlmaWVkUGF0aCwgaW5DaGFuZ2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbk5vdGlmaWVkUGF0aCA9PT0gaW5QYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbkxpc3RlbmVyKGluTm90aWZpZWRQYXRoLCBpbkNoYW5nZXMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KF9wLmNoaWxkcmVuW3Byb3BOYW1lXSkubGlzdGVuZXJzLmFkZChpbkxpc3RlbmVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChwcm9wTmFtZSA9PT0gJyonKSB7XG4gICAgICAgICAgICAvL19wLmNoaWxkcmVuTGlzdGVuZXJzLmFkZChpbkxpc3RlbmVyKTtcbiAgICAgICAgICAgIF9wLmxpc3RlbmVycy5hZGQoaW5MaXN0ZW5lcik7XG5cbiAgICAgICAgfSBlbHNlIGlmIChwcm9wTmFtZSA9PT0gJyoqJykge1xuICAgICAgICAgICAgX3AuZGVzY2VuZGFudExpc3RlbmVycy5hZGQoaW5MaXN0ZW5lcik7XG4gICAgICAgICAgICAvLyBfcC5saXN0ZW5lcnMuYWRkKGluTGlzdGVuZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbm90aWZ5KGluUGF0aCwgaW5DaGFuZ2VzKSB7XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgICAgICBjb25zdCBzZWdzID0gaW5QYXRoID8gaW5QYXRoLnNwbGl0KCcuJykgOiBbXTtcbiAgICAgICAgY29uc3QgcHJvcE5hbWUgPSBzZWdzLnNoaWZ0KCk7XG4gICAgICAgIGxldCBzaG91bGRUcmlnZ2VyID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IHB1c2hRdWV1ZSA9IGZ1bmN0aW9uKGZuKSB7XG4gICAgICAgICAgICBpZiAoIV9xdWV1ZS5oYXMoZm4pKSB7XG4gICAgICAgICAgICAgICAgX3F1ZXVlLnNldChmbiwgW10pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX3F1ZXVlLmdldChmbikucHVzaCh7IHBhdGg6IGluUGF0aCwgY2hhbmdlczogaW5DaGFuZ2VzIH0pO1xuICAgICAgICB9O1xuICAgICAgICBpZiAocHJvcE5hbWUpIHtcbiAgICAgICAgICAgIGlmIChoYXMoX3AuY2hpbGRyZW4sIHByb3BOYW1lKSAmJiBzZWdzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIF9wLmNoaWxkcmVuW3Byb3BOYW1lXS5ub3RpZnkoc2Vncy5qb2luKCcuJyksIGluQ2hhbmdlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXNlZ3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgc2hvdWxkVHJpZ2dlciA9IHNob3VsZFRyaWdnZXIgfHwgX3AubGlzdGVuZXJzLnNpemU7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbCBvZiBfcC5saXN0ZW5lcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgcHVzaFF1ZXVlKGwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNob3VsZFRyaWdnZXIgPSBzaG91bGRUcmlnZ2VyIHx8IF9wLmNoaWxkcmVuTGlzdGVuZXJzLnNpemU7XG4gICAgICAgICAgICBmb3IgKGxldCBsIG9mIF9wLmNoaWxkcmVuTGlzdGVuZXJzKSB7XG4gICAgICAgICAgICAgICAgcHVzaFF1ZXVlKGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2hvdWxkVHJpZ2dlciA9IHNob3VsZFRyaWdnZXIgfHwgX3AuZGVzY2VuZGFudExpc3RlbmVycy5zaXplO1xuICAgICAgICAgICAgZm9yIChsZXQgbCBvZiBfcC5kZXNjZW5kYW50TGlzdGVuZXJzKSB7XG4gICAgICAgICAgICAgICAgcHVzaFF1ZXVlKGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2hvdWxkVHJpZ2dlciA9IHNob3VsZFRyaWdnZXIgfHwgX3AubGlzdGVuZXJzLnNpemU7XG4gICAgICAgICAgICBmb3IgKGxldCBsIG9mIF9wLmxpc3RlbmVycykge1xuICAgICAgICAgICAgICAgIHB1c2hRdWV1ZShsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghX3dpbGxOb3RpZnkgJiYgc2hvdWxkVHJpZ2dlcikge1xuICAgICAgICAgICAgbWljcm90YXNrKF9lbWl0LCBbaW5QYXRoLCBpbkNoYW5nZXNdKTtcbiAgICAgICAgICAgIF93aWxsTm90aWZ5ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgYnViYmxlKHBhdGgsIGNoYW5nZXMpIHtcblxuICAgIH1cblxuICAgIHN0YXRpYyB0YXJnZXQoYmFzZSwgcGF0aCwgY2hhbmdlcykge1xuXG4gICAgfVxufVxuZXhwb3J0IGRlZmF1bHQgT2JzZXJ2ZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbmNsYXNzIE9ic2VydmFibGUge1xuXG59XG5leHBvcnQgZGVmYXVsdCBPYnNlcnZhYmxlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuaW1wb3J0IE9ic2VydmVyIGZyb20gJy4vT2JzZXJ2ZXInO1xuaW1wb3J0IHsgaXNQbGFpbk9iamVjdCwga2V5cywgZWFjaCwgaXNTdHJpbmcsIGdldCwgaXNBcnJheSB9IGZyb20gJ2xvZGFzaCc7XG5pbXBvcnQgT2JzZXJ2YWJsZSBmcm9tICcuL09ic2VydmFibGUnO1xuXG5cblxuY29uc3QgX3ByaXZhdGUgPSBuZXcgV2Vha01hcCgpO1xuXG5cbmNsYXNzIER1bW15IHtcbiAgICBjb25zdHJ1Y3RvcihpbklzQ29sbGVjdGlvbikge1xuICAgICAgICB0aGlzLl9vYmogPSBpbklzQ29sbGVjdGlvbiA/IFtdIDoge307XG4gICAgICAgIF9wcml2YXRlLnNldCh0aGlzLCB7XG5cbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHByb3AoaW5OYW1lLCBpblZhbHVlKSB7XG4gICAgICAgIGlmIChpblZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX29ialtpbk5hbWVdID0gaW5WYWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9vYmpbaW5OYW1lXTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY2xhc3MgT2JzZXJ2YWJsZU9iamVjdCBleHRlbmRzIE9ic2VydmFibGUge1xuXG4gICAgY29uc3RydWN0b3IoaW5Db25maWcpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgY29uc3QgaXNDb2xsZWN0aW9uID0gKGdldChpbkNvbmZpZywgJ2lzQ29sbGVjdGlvbicpID09PSB0cnVlKTtcbiAgICAgICAgX3ByaXZhdGUuc2V0KHRoaXMsIHtcbiAgICAgICAgICAgIGlzU2lsZW50OiBmYWxzZSxcbiAgICAgICAgICAgIGlzQ29sbGVjdGlvbjogaXNDb2xsZWN0aW9uLFxuICAgICAgICAgICAgY2hhbmdlc1F1ZXVlOiBbXSxcbiAgICAgICAgICAgIG9ic2VydmVyOiBuZXcgT2JzZXJ2ZXIoKSxcbiAgICAgICAgICAgIHByb3BzOiBuZXcgRHVtbXkoaXNDb2xsZWN0aW9uKSxcbiAgICAgICAgICAgIHNldFByb3A6IGZ1bmN0aW9uKGluUGF0aCwgaW5WYWx1ZSwgaW5CYWNrUGF0aCwgaW5BbHJlYWR5Rm91bmRDaGFuZ2UpIHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHBhdGggPSAhaXNOYU4oaW5QYXRoKSA/IFtpblBhdGhdIDogaW5QYXRoLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICAgICAgdmFyIGxvY2FsUHJvcCA9IHBhdGguc2hpZnQoKTtcblxuICAgICAgICAgICAgICAgIGluQmFja1BhdGggPSBpbkJhY2tQYXRoIHx8IFtdO1xuICAgICAgICAgICAgICAgIGluQmFja1BhdGgucHVzaChsb2NhbFByb3ApO1xuICAgICAgICAgICAgICAgIGxldCBvdXQ7XG5cbiAgICAgICAgICAgICAgICBsZXQgdmFsID0gX3ByaXZhdGUuZ2V0KHRoaXMpLnByb3BzLnByb3AobG9jYWxQcm9wKTtcblxuICAgICAgICAgICAgICAgIGlmICghcGF0aC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnByb3BzLnByb3AobG9jYWxQcm9wLCBPYnNlcnZhYmxlT2JqZWN0LmZyb21PYmplY3QoaW5WYWx1ZSkpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW5BbHJlYWR5Rm91bmRDaGFuZ2UgPyBudWxsIDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogaW5CYWNrUGF0aC5qb2luKCcuJyksXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiB2YWwgPT09IHVuZGVmaW5lZCA/ICdhZGQnIDogJ3JlcGxhY2UnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiB2YWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsdWU6IF9wcml2YXRlLmdldCh0aGlzKS5wcm9wcy5wcm9wKGxvY2FsUHJvcClcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbCAhPT0gdW5kZWZpbmVkICYmICEodmFsIGluc3RhbmNlb2YgT2JzZXJ2YWJsZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd0cnlpbmcgdG8gc2V0IGEgdmFsdWUgdGhyb3VnaCBhIGJyYW5jaCB3aXRoIGEgbm9uIE9ic2VydmFibGUgbm9kZScpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBhbHJlYWR5Rm91bmQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWwgPSBuZXcgT2JzZXJ2YWJsZU9iamVjdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnByb3BzLnByb3AobG9jYWxQcm9wLCB2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3V0ID0gaW5BbHJlYWR5Rm91bmRDaGFuZ2UgPyBudWxsIDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IGluQmFja1BhdGguam9pbignLicpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYWRkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsdWU6IF9wcml2YXRlLmdldCh0aGlzKS5wcm9wcy5wcm9wKGxvY2FsUHJvcClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgYWxyZWFkeUZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsZXQgcmVzdWx0ID0gX3ByaXZhdGUuZ2V0KHZhbCkuc2V0UHJvcChwYXRoLmpvaW4oJy4nKSwgaW5WYWx1ZSwgaW5CYWNrUGF0aCwgYWxyZWFkeUZvdW5kKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChyZXN1bHQgPyByZXN1bHQgOiBvdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0uYmluZCh0aGlzKVxuICAgICAgICB9KTtcblxuICAgIH1cblxuICAgICogW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgICAgIGNvbnN0IHNyYyA9IF9wcml2YXRlLmdldCh0aGlzKS5wcm9wcy5fb2JqO1xuICAgICAgICBpZiAodGhpcy5pc0NvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgIGZvciAodmFyIGl0ZW0gb2Ygc3JjKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAobGV0IGtleSBpbiBzcmMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBvdXQgPSB7fTtcbiAgICAgICAgICAgICAgICBvdXRba2V5XSA9IHNyY1trZXldO1xuICAgICAgICAgICAgICAgIHlpZWxkIG91dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgZmlsbChpbkRhdGEsIGluUGF0aCwgaW5TaWxlbnQpIHtcbiAgICAgICAgY29uc3QgX3AgPSBfcHJpdmF0ZS5nZXQodGhpcyk7XG4gICAgICAgIGlmICghaW5QYXRoKSB7XG4gICAgICAgICAgICBfcC5wcm9wcy5fb2JqID0gdGhpcy5pc0NvbGxlY3Rpb24gPyBbXSA6IHt9O1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMucHJvcChpblBhdGgpIGluc3RhbmNlb2YgT2JzZXJ2YWJsZU9iamVjdCkge1xuICAgICAgICAgICAgdGhpcy5wcm9wKGluUGF0aCkuZW1wdHkoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChrZXlzKGluRGF0YSkubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLm1lcmdlKGluRGF0YSwgaW5QYXRoLCBpblNpbGVudCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoIWluU2lsZW50KSB7XG4gICAgICAgICAgICAgICAgX3AuY2hhbmdlc1F1ZXVlLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBwYXRoOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnZW1wdGllZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdWYWx1ZTogX3AucHJvcHMuX29ialxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgT2JzZXJ2YWJsZU9iamVjdC5ub3RpZnlXYXRjaGVycyhfcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG4gICAgfVxuXG4gICAgbWVyZ2UoaW5EYXRhLCBpblBhdGgsIGluU2lsZW50KSB7XG5cbiAgICAgICAgaWYgKCFpc1BsYWluT2JqZWN0KGluRGF0YSkgJiYgIWlzQXJyYXkoaW5EYXRhKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdPYnNlcnZhYmxlT2JqZWN0LmZpbGwoKSBtdXN0IGJlIHBhc3NlZCBhIHBsYWluIG9iamVjdCcpO1xuICAgICAgICB9XG4gICAgICAgIGVhY2goaW5EYXRhLCAoaW5WYWx1ZSwgaW5LZXkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBhdGggPSAoaW5QYXRoID8gaW5QYXRoICsgJy4nIDogJycpICsgaW5LZXk7XG4gICAgICAgICAgICB0aGlzLnByb3AocGF0aCwgT2JzZXJ2YWJsZU9iamVjdC5mcm9tT2JqZWN0KGluVmFsdWUpLCBpblNpbGVudCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHN0YXRpYyBmcm9tT2JqZWN0KGluRGF0YSkge1xuICAgICAgICBpZiAoaXNBcnJheShpbkRhdGEpKSB7IC8vUkVGQUNUT1I6IGR1cGxpY2F0ZWQgY29kZT9cbiAgICAgICAgICAgIGxldCBhID0gbmV3IE9ic2VydmFibGVPYmplY3QoeyBpc0NvbGxlY3Rpb246IHRydWUgfSk7XG4gICAgICAgICAgICBlYWNoKGluRGF0YSwgZnVuY3Rpb24oaW5WYWwsIGluS2V5KSB7XG4gICAgICAgICAgICAgICAgYS5wcm9wKGluS2V5LCBPYnNlcnZhYmxlT2JqZWN0LmZyb21PYmplY3QoaW5WYWwpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGE7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNQbGFpbk9iamVjdChpbkRhdGEpKSB7XG4gICAgICAgICAgICBsZXQgbyA9IG5ldyBPYnNlcnZhYmxlT2JqZWN0KCk7XG4gICAgICAgICAgICBlYWNoKGluRGF0YSwgZnVuY3Rpb24oaW5WYWwsIGluS2V5KSB7XG4gICAgICAgICAgICAgICAgby5wcm9wKGluS2V5LCBPYnNlcnZhYmxlT2JqZWN0LmZyb21PYmplY3QoaW5WYWwpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIG87XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gaW5EYXRhO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIHByb3AoaW5CYXNlLCBpblBhdGgpIHtcbiAgICAgICAgaWYgKCFpbkJhc2UpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIShpbkJhc2UgaW5zdGFuY2VvZiBPYnNlcnZhYmxlT2JqZWN0KSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpbkJhc2UucHJvcChpblBhdGgpO1xuICAgIH1cblxuICAgIGR1bW15KCkge1xuICAgICAgICByZXR1cm4gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgIH1cblxuICAgIGdldCBpc0NvbGxlY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBfcHJpdmF0ZS5nZXQodGhpcykuaXNDb2xsZWN0aW9uO1xuICAgIH1cblxuICAgIGdldCBsZW5ndGgoKSB7XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgICAgICBpZiAoX3AuaXNDb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4ga2V5cyhfcC5wcm9wcy5fb2JqKS5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBwcm9wKGluUGF0aCwgaW5WYWx1ZSwgaW5TaWxlbnQpIHtcbiAgICAgICAgaWYgKGluUGF0aCAhPT0gMCAmJiAhaW5QYXRoKSB7IC8vcGF0aCBjYW4gYmUgYW4gaW5kZXguICFpblBhdGggd291bGQgaWdub3JlIHplcm8gYXMgYSBwcm9wZXJ0eVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgX3AgPSBfcHJpdmF0ZS5nZXQodGhpcyk7XG4gICAgICAgIGNvbnN0IG15UHJvcHMgPSBfcC5wcm9wcztcbiAgICAgICAgY29uc3QgcGF0aCA9ICFpc05hTihpblBhdGgpID8gW2luUGF0aF0gOiBpblBhdGguc3BsaXQoJy4nKTtcbiAgICAgICAgdmFyIHByb3BOYW1lID0gcGF0aC5zaGlmdCgpO1xuICAgICAgICBpZiAoX3AuaXNDb2xsZWN0aW9uICYmIGlzTmFOKHByb3BOYW1lKSAmJiBwcm9wTmFtZSAhPT0gJ2xlbmd0aCcpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ29sbGVjdGlvbiBPYnNlcnZhYmxlT2JqZWN0IGNhbiBvbmx5IGhhdmUgbnVtYmVycyBhcyBrZXlzJyk7XG4gICAgICAgIH0gZWxzZSBpZiAoX3AuaXNDb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICBwcm9wTmFtZSA9ICFpc05hTihwcm9wTmFtZSkgPyBwYXJzZUludChwcm9wTmFtZSkgOiBwcm9wTmFtZTtcbiAgICAgICAgICAgIGlmIChpc05hTihwcm9wTmFtZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5sZW5ndGg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGluVmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKG15UHJvcHMucHJvcChwcm9wTmFtZSkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChwYXRoLmxlbmd0aCAmJiAhKG15UHJvcHMucHJvcChwcm9wTmFtZSkgaW5zdGFuY2VvZiBPYnNlcnZhYmxlKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ3RyeWluZyB0byBhY2Nlc3MgcGF0aCB0aHJvdWdoIGEgbm9uIHRyYXZlcnNhYmxlIHByb3BlcnR5Jyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwYXRoLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbXlQcm9wcy5wcm9wKHByb3BOYW1lKS5wcm9wKHBhdGguam9pbignLicpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG15UHJvcHMucHJvcChwcm9wTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBicmFuY2ggPSBbXTtcbiAgICAgICAgICAgIHZhciBjaGFuZ2UgPSBfcC5zZXRQcm9wKGluUGF0aCwgaW5WYWx1ZSwgYnJhbmNoKTtcbiAgICAgICAgICAgIGlmICghaW5TaWxlbnQpIHtcbiAgICAgICAgICAgICAgICBfcC5jaGFuZ2VzUXVldWUucHVzaChjaGFuZ2UpO1xuICAgICAgICAgICAgICAgIE9ic2VydmFibGVPYmplY3Qubm90aWZ5V2F0Y2hlcnMoX3ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGluVmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG5cblxuLy9UT0RPOiBpbXBsZW1lbnQgZXZlbnQtc3BlY2lmaWMgd2F0Y2hcbiAgICB3YXRjaChpblBhdGgsIGluSGFuZGxlciwgaW5FdmVudCkge1xuICAgICAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcbiAgICAgICAgX3Aub2JzZXJ2ZXIubGlzdGVuKGluUGF0aCwgaW5IYW5kbGVyLCBpbkV2ZW50KTtcbiAgICB9XG4gICAgXG4gICAgdG9OYXRpdmUoaW5EZWVwKSB7XG4gICAgICAgIHZhciBvdXQgPSBfcHJpdmF0ZS5nZXQodGhpcykuaXNDb2xsZWN0aW9uID8gW10gOiB7fTtcbiAgICAgICAgZWFjaChfcHJpdmF0ZS5nZXQodGhpcykucHJvcHMuX29iaiwgKGluVmFsLCBpbktleSkgPT4ge1xuICAgICAgICAgICAgbGV0IGlzT2JzZXJ2YWJsZSA9IGluVmFsIGluc3RhbmNlb2YgT2JzZXJ2YWJsZTtcbiAgICAgICAgICAgIG91dFtpbktleV0gPSBpc09ic2VydmFibGUgJiYgaW5EZWVwID09PSB0cnVlID8gaW5WYWwudG9OYXRpdmUodHJ1ZSkgOiBpblZhbDtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBvdXQ7XG4gICAgfVxuXG4gICAgc29ydChpbkNvbXBhcmF0b3IpIHtcbiAgICAgICAgaWYoX3ByaXZhdGUuZ2V0KHRoaXMpLmlzQ29sbGVjdGlvbikge1xuICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnByb3BzLl9vYmouc29ydChpbkNvbXBhcmF0b3IpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIHN0YXRpYyBub3RpZnlXYXRjaGVycyhpbkluc3RhbmNlKSB7XG4gICAgICAgIGlmIChpbkluc3RhbmNlLmlzU2lsZW50KSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgYyBvZiBpbkluc3RhbmNlLmNoYW5nZXNRdWV1ZSkge1xuICAgICAgICAgICAgaW5JbnN0YW5jZS5vYnNlcnZlci5ub3RpZnkoYy5wYXRoLCBjLmNoYW5nZSk7XG4gICAgICAgIH1cbiAgICAgICAgaW5JbnN0YW5jZS5jaGFuZ2VzUXVldWUgPSBbXTtcblxuICAgIH1cblxuICAgIHN0YXRpYyBmaWxsKGluVGFyZ2V0LCBpblBhdGgsIGluQ29udGVudCwgaW5TaWxlbnQpIHtcbiAgICAgICAgaWYgKCFpblRhcmdldCB8fCAhKGluVGFyZ2V0IGluc3RhbmNlb2YgT2JzZXJ2YWJsZU9iamVjdCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignZmlsbCgpIGNhbiBvbmx5IGJlIGludm9rZWQgb24gYW4gT2JzZXJ2YWJsZU9iamVjdCcpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaW5UYXJnZXQgfHwgIShpblRhcmdldCBpbnN0YW5jZW9mIE9ic2VydmFibGVPYmplY3QpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCByZXNvbHZlIE9ic2VydmFibGVPYmplY3QgdG8gZmlsbCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaW5UYXJnZXQuZmlsbChpbkNvbnRlbnQsIGluUGF0aCwgaW5TaWxlbnQpO1xuICAgICAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldChpblRhcmdldCk7XG4gICAgICAgIGlmICghaW5TaWxlbnQpIHtcbiAgICAgICAgICAgIF9wLmNoYW5nZXNRdWV1ZS5wdXNoKHtcbiAgICAgICAgICAgICAgICBwYXRoOiBpblBhdGgsXG4gICAgICAgICAgICAgICAgY2hhbmdlOiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdmaWxsZWQnLFxuICAgICAgICAgICAgICAgICAgICBuZXdWYWx1ZTogaW5Db250ZW50XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBPYnNlcnZhYmxlT2JqZWN0Lm5vdGlmeVdhdGNoZXJzKF9wKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBtZXJnZShpblRhcmdldCwgaW5QYXRoLCBpbkNvbnRlbnQsIGluU2lsZW50KSB7XG4gICAgICAgIGlmICghaW5UYXJnZXQgfHwgIShpblRhcmdldCBpbnN0YW5jZW9mIE9ic2VydmFibGVPYmplY3QpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ21lcmdlICgpIGNhbiBvbmx5IGJlIGludm9rZWQgb24gYW4gT2JzZXJ2YWJsZU9iamVjdCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpblRhcmdldCB8fCAhKGluVGFyZ2V0IGluc3RhbmNlb2YgT2JzZXJ2YWJsZU9iamVjdCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IHJlc29sdmUgT2JzZXJ2YWJsZU9iamVjdCB0byBtZXJnZScpO1xuICAgICAgICB9XG5cbiAgICAgICAgaW5UYXJnZXQubWVyZ2UoaW5Db250ZW50LCBpblBhdGgpO1xuICAgICAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldChpblRhcmdldCk7XG4gICAgICAgIGlmICghaW5TaWxlbnQpIHtcbiAgICAgICAgICAgIF9wLmNoYW5nZXNRdWV1ZS5wdXNoKHtcbiAgICAgICAgICAgICAgICBwYXRoOiBpblBhdGgsXG4gICAgICAgICAgICAgICAgY2hhbmdlOiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdtZXJnZWQnLFxuICAgICAgICAgICAgICAgICAgICBuZXdWYWx1ZTogaW5Db250ZW50XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBPYnNlcnZhYmxlT2JqZWN0Lm5vdGlmeVdhdGNoZXJzKF9wKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG5cbiAgICBlbXB0eShpblNpbGVudCkge1xuICAgICAgICB0aGlzLmZpbGwobnVsbCwgaW5TaWxlbnQpO1xuICAgIH1cbn1cbndpbmRvdy5PYnNlcnZhYmxlT2JqZWN0ID0gT2JzZXJ2YWJsZU9iamVjdDtcbmV4cG9ydCBkZWZhdWx0IE9ic2VydmFibGVPYmplY3Q7XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7ZmluZCwgbWFwLCBpc1N0cmluZywgaXNBcnJheX0gZnJvbSAnbG9kYXNoJztcblxuY29uc3QgX3ByaXZhdGUgPSBuZXcgV2Vha01hcCgpO1xuXG5jbGFzcyBTdGF0ZSB7XG5cdGNvbnN0cnVjdG9yKC4uLnJlc3QpIHtcdFxuXHRcdGxldCBuYW1lID0gZmluZChyZXN0LCAocGFyYW0pID0+IGlzU3RyaW5nKHBhcmFtKSkgfHwgJyc7XG5cdFx0bGV0IGNoaWxkcmVuID0gZmluZChyZXN0LCAocGFyYW0pID0+IGlzQXJyYXkocGFyYW0pKTtcblx0XHRsZXQgcGFyZW50ID0gZmluZChyZXN0LCAocGFyYW0pID0+IHBhcmFtIGluc3RhbmNlb2YgU3RhdGUpO1xuXG5cdFx0Y2hpbGRyZW4gPSBtYXAoY2hpbGRyZW4sIChpblZhbHVlKSA9PiB7XG5cdFx0XHRjb25zdCBzdGF0ZSA9IChpblZhbHVlIGluc3RhbmNlb2YgU3RhdGUgPyBpblZhbHVlIDogbmV3IFN0YXRlKGluVmFsdWUpKTtcblx0XHRcdF9wcml2YXRlLmdldChzdGF0ZSkucGFyZW50ID0gdGhpcztcblx0XHRcdHJldHVybiBzdGF0ZTtcblx0XHR9KTtcblxuXHRcdF9wcml2YXRlLnNldCh0aGlzLCB7XG5cdFx0XHRuYW1lIDogbmFtZSxcblx0XHRcdGNoaWxkcmVuIDogY2hpbGRyZW4sXG5cdFx0XHRwYXJlbnQgOiBwYXJlbnRcblx0XHR9KTtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMuY2hpbGRyZW4gPSBjaGlsZHJlbjtcblx0fVxuXG5cdGdldFBhdGgoKSB7XG5cdFx0Y29uc3QgcGFyZW50ID0gIF9wcml2YXRlLmdldCh0aGlzKS5wYXJlbnQ7XG5cdFx0cmV0dXJuIChwYXJlbnQgJiYgcGFyZW50LmdldE5hbWUoKSA/IHBhcmVudC5nZXRQYXRoKCkgKyAnLicgOiAnJykgKyBfcHJpdmF0ZS5nZXQodGhpcykubmFtZTtcblx0fVxuXG5cblx0Z2V0TmFtZSgpIHtcblx0XHRyZXR1cm4gX3ByaXZhdGUuZ2V0KHRoaXMpLm5hbWU7XG5cdH1cblxuXHRjaGlsZChpbk5hbWUpIHtcblx0XHRyZXR1cm4gZmluZChfcHJpdmF0ZS5nZXQodGhpcykuY2hpbGRyZW4sIChpbkNoaWxkKSA9PiBpbkNoaWxkLmdldE5hbWUoKSA9PT0gaW5OYW1lKTtcblx0fVxuXG5cdHJlc29sdmUoaW5QYXRoKSB7XG5cdFx0aWYoIWluUGF0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBzZWdzID0gaW5QYXRoLnNwbGl0KCcuJyk7XG5cdFx0Y29uc3QgY2hpbGQgPSB0aGlzLmNoaWxkKHNlZ3Muc2hpZnQoKSk7XG5cdFx0aWYoIWNoaWxkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fSBlbHNlIGlmKHNlZ3MubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gY2hpbGQucmVzb2x2ZShzZWdzLmpvaW4oJy4nKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBjaGlsZDtcblx0XHR9XG5cdH1cblxuXHRvbkxlYXZpbmcoaW5Gbikge1xuXHRcdHRoaXMubGVhdmluZyA9IGluRm47XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRsZWF2aW5nKCkge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0fVxuXG5cdG9uTGVmdChpbkZuKSB7XG5cdFx0dGhpcy5sZWZ0ID0gaW5Gbjtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdGxlZnQoKSB7XG5cblx0fVxuXG5cdG9uUmVuZGVyZWQoaW5Gbikge1xuXHRcdHRoaXMucmVuZGVyZWQgPSBpbkZuO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0b25FbnRlcmluZyhpbkZuKSB7XG5cdFx0dGhpcy5lbnRlcmluZyA9IGluRm47XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRlbnRlcmluZygpIHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxuXHRvbkVudGVyZWQoaW5Gbikge1xuXHRcdHRoaXMuZW50ZXJlZCA9IGluRm47XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRyZW5kZXJlZCgpIHtcblxuXHR9XG5cdFxuXG5cdGVudGVyZWQoKSB7XG5cblx0fVxuXG5cdGRpZG50TGVhdmUoKSB7XG5cblx0fVxuXG5cdG1hdGNoZXMoaW5QYXR0ZXJuKSB7XG5cdFx0cmV0dXJuICghaW5QYXR0ZXJuICYmICFfcHJpdmF0ZS5nZXQodGhpcykubmFtZSkgfHxcblx0XHRcdChuZXcgUmVnRXhwKGluUGF0dGVybikpLnRlc3QoX3ByaXZhdGUuZ2V0KHRoaXMpLm5hbWUpO1xuXHR9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFN0YXRlO1xuIiwiJ3VzZSBzdHJpY3QnO1xudmFyIFNpZ25hbCA9IHJlcXVpcmUoJ3NpZ25hbHMnKS5TaWduYWw7XG5jbGFzcyBCdXMge1xuXG4gICAgY29uc3RydWN0b3IoaW5QYXJlbnRCdXMpIHtcbiAgICAgICAgdGhpcy5wYXJlbnQgPSAoKSA9PiBpblBhcmVudEJ1cztcbiAgICAgICAgdGhpcy5zaWduYWxzID0ge307XG4gICAgfVxuXG4gICAgcHVibGlzaEFjdGlvbihpbk5hbWUsIGluSGFuZGxlcikge1xuICAgICAgICBpZiAodGhpcy5wYXJlbnQoKSkge1xuICAgICAgICAgICAgdGhpcy5wYXJlbnQoKS5wdWJsaXNoQWN0aW9uKGluTmFtZSwgaW5IYW5kbGVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYWRkQWN0aW9uKGluTmFtZSwgaW5IYW5kbGVyKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgdHJpZ2dlckFjdGlvbihpbk5hbWUsIC4uLnJlc3QpIHtcbiAgICAgICAgaWYgKCF0aGlzLnNpZ25hbHNbaW5OYW1lXSkge1xuICAgICAgICAgICAgaWYgKHRoaXMucGFyZW50KCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudCgpLnRyaWdnZXJBY3Rpb24uYXBwbHkodGhpcy5wYXJlbnQoKSwgW2luTmFtZV0uY29uY2F0KHJlc3QpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdUcnlpbmcgdG8gdHJpZ2dlciBub24gZXhpc3RpbmcgYWN0aW9uOiAnICsgaW5OYW1lKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc2lnbmFsc1tpbk5hbWVdLmRpc3BhdGNoLmFwcGx5KG51bGwsIHJlc3QpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkQWN0aW9uKGluTmFtZSwgaW5IYW5kbGVyLCBpbk9uY2UpIHtcbiAgICAgICAgaWYoIXRoaXMuc2lnbmFsc1tpbk5hbWVdKSB7XG4gICAgICAgICAgICB0aGlzLnNpZ25hbHNbaW5OYW1lXSA9IG5ldyBTaWduYWwoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5IYW5kbGVyKSB7XG4gICAgICAgICAgICB0aGlzLnNpZ25hbHNbaW5OYW1lXVsnYWRkJyArIChpbk9uY2UgPyAnT25jZScgOiAnJyldKGluSGFuZGxlcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbmNlQWN0aW9uKGluTmFtZSwgaW5IYW5kbGVyKSB7XG4gICAgICAgIC8vVE9ETzogdG8gYmUgaW1wbGVtZW50ZWRcbiAgICB9XG5cbiAgICBvbkFjdGlvbihpbk5hbWUsIGluSGFuZGxlciwgaW5PbmNlKSB7XG4gICAgICAgIGlmICghdGhpcy5zaWduYWxzW2luTmFtZV0pIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhcmVudCgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnQoKS5vbkFjdGlvbihpbk5hbWUsIGluSGFuZGxlciwgaW5PbmNlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hZGRBY3Rpb24oaW5OYW1lLCBpbkhhbmRsZXIsIGluT25jZSk7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdQb3NzaWJseSByZWdpc3RlcmluZyBsaXN0ZW5lciB0byBub24gZXhpc3RpbmcgYWN0aW9uOiAnICsgaW5OYW1lKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1lvdSBtaWdodCB3YW50IHRvIHVzZSBhZGRBY3Rpb24gb3IgcHVibGlzaEFjdGlvbicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zaWduYWxzW2luTmFtZV1bJ2FkZCcgKyAoaW5PbmNlID8gJ09uY2UnIDogJycpXShpbkhhbmRsZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb2ZmQWN0aW9uKGluTmFtZSwgaW5IYW5kbGVyKSB7XG4gICAgICAgIC8vVE9ETzogdG8gYmUgaW1wbGVtZW50ZWRcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1cztcbiIsImNvbnN0IF9wcml2YXRlID0gbmV3IFdlYWtNYXAoKTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ29tcG9uZW50TGlmZWN5Y2xlIHtcblx0Y29uc3RydWN0b3IoaW5TaWduYWwpIHtcblx0XHRfcHJpdmF0ZS5zZXQodGhpcywge3NpZ25hbCA6IGluU2lnbmFsfSk7XG5cdH1cblxuXHRyZW5kZXJlZChpbkhhbmRsZXIpIHtcblx0XHRfcHJpdmF0ZS5nZXQodGhpcykuc2lnbmFsLmFkZCgoaW5UeXBlKSA9PiB7XG5cdFx0XHRpZihpblR5cGUgPT09ICdyZW5kZXJlZCcpIHtcblx0XHRcdFx0aW5IYW5kbGVyKCk7XG5cdFx0XHR9XG5cdFx0fSlcblx0fVxuXG5cdGVsZW1lbnRDcmVhdGVkKGluSGFuZGxlcikge1xuXHRcdF9wcml2YXRlLmdldCh0aGlzKS5zaWduYWwuYWRkKChpblR5cGUpID0+IHtcblx0XHRcdGlmKGluVHlwZSA9PT0gJ2VsZW1lbnQtY3JlYXRlZCcpIHtcblx0XHRcdFx0aW5IYW5kbGVyKCk7XG5cdFx0XHR9XG5cdFx0fSlcblxuXHR9XG5cblx0ZWxlbWVudEF0dGFjaGVkKGluSGFuZGxlcikge1xuXHRcdF9wcml2YXRlLmdldCh0aGlzKS5zaWduYWwuYWRkKChpblR5cGUpID0+IHtcblx0XHRcdGlmKGluVHlwZSA9PT0gJ2VsZW1lbnQtYXR0YWNoZWQnKSB7XG5cdFx0XHRcdGluSGFuZGxlcigpO1xuXHRcdFx0fVxuXHRcdH0pXG5cblx0fVxuXG5cdGVsZW1lbnREZXRhY2hlZChpbkhhbmRsZXIpIHtcblx0XHRfcHJpdmF0ZS5nZXQodGhpcykuc2lnbmFsLmFkZCgoaW5UeXBlKSA9PiB7XG5cdFx0XHRpZihpblR5cGUgPT09ICdlbGVtZW50LWRldGFjaGVkJykge1xuXHRcdFx0XHRpbkhhbmRsZXIoKTtcblx0XHRcdH1cblx0XHR9KVxuXG5cdH1cblxuXHRlbWl0KGluVHlwZSkge1xuXHRcdF9wcml2YXRlLmdldCh0aGlzKS5zaWduYWwuZGlzcGF0Y2goaW5UeXBlKTtcblx0fVxufVxuIiwiY29uc3QgcmVnaXN0cnkgPSBuZXcgTWFwKCk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKGluQ2xhc3MpIHtcbiAgICAndXNlIHN0cmljdCc7XG4gICAgaWYgKCFyZWdpc3RyeS5oYXMoaW5DbGFzcykpIHtcbiAgICAgICAgY29uc3QgbWFwID0gbmV3IFdlYWtNYXAoKTtcbiAgICAgICAgcmVnaXN0cnkuc2V0KGluQ2xhc3MsIG1hcCk7XG4gICAgfVxuICAgIHJldHVybiByZWdpc3RyeS5nZXQoaW5DbGFzcyk7XG59XG4iLCIndXNlIHN0cmljdCc7XG5pbXBvcnQgbWljcm90YXNrIGZyb20gJy4vbWljcm90YXNrJztcbmltcG9ydCBPYnNlcnZhYmxlT2JqZWN0IGZyb20gJy4vT2JzZXJ2YWJsZU9iamVjdCc7XG5pbXBvcnQgT2JzZXJ2YWJsZSBmcm9tICcuL09ic2VydmFibGUnO1xuaW1wb3J0IFN0YXRlIGZyb20gJy4vU3RhdGUnO1xuaW1wb3J0IEJ1cyBmcm9tICcuL0J1cyc7XG5pbXBvcnQgeyBpc1N0cmluZywgaXNGdW5jdGlvbiwgaXNQbGFpbk9iamVjdCwgZWFjaCB9IGZyb20gJ2xvZGFzaCc7XG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IGZhY3RvcnkgZnJvbSAnLi9wYWdlLWZhY3RvcnknO1xuaW1wb3J0IENvbXBvbmVudExpZmVjeWNsZSBmcm9tICcuL0NvbXBvbmVudExpZmVjeWNsZSc7XG5pbXBvcnQgeyBTaWduYWwgfSBmcm9tICdzaWduYWxzJztcbmltcG9ydCBwcml2YXRlSGFzaCBmcm9tICcuL3V0aWwvcHJpdmF0ZSc7XG5cbmNvbnN0IF9wcml2YXRlID0gcHJpdmF0ZUhhc2goJ2NvbXBvbmVudCcpO1xuXG5jb25zdCBfc2V0dXBNb2RlbCA9IGZ1bmN0aW9uIF9zZXR1cE1vZGVsKGluTW9kZWxJbml0T2JqKSB7XG5cbiAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcblxuICAgIGxldCBnZXR0ZXI7XG5cbiAgICBpZiAoIWluTW9kZWxJbml0T2JqKSB7XG4gICAgICAgIGdldHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhZ2UucmVzb2x2ZU5vZGVNb2RlbCh0aGlzLm5vZGUpO1xuICAgICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIF9wLm1vZGVsID0gT2JzZXJ2YWJsZU9iamVjdC5mcm9tT2JqZWN0KGluTW9kZWxJbml0T2JqKTtcbiAgICAgICAgZ2V0dGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIF9wLm1vZGVsO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbW9kZWwnLCB7XG4gICAgICAgIGdldDogZ2V0dGVyXG4gICAgfSk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdoYXNNb2RlbCcsIHtcbiAgICAgICAgZ2V0OiAoKSA9PiAhIWluTW9kZWxJbml0T2JqXG4gICAgfSk7XG59O1xuXG5jb25zdCBfZmluZFN0YXRlID0gZnVuY3Rpb24gX2ZpbmRTdGF0ZShpblN0YXRlTmFtZSkge1xuXG4gICAgaWYgKCFpblN0YXRlTmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5zdGF0ZXM7XG4gICAgfVxuICAgIGxldCBwYXRoID0gaW5TdGF0ZU5hbWUuc3BsaXQoJy4nKTtcbiAgICBsZXQgY3VycmVudFN0YXRlID0gdGhpcy5zdGF0ZXM7XG4gICAgd2hpbGUgKHBhdGgubGVuZ3RoICYmIGN1cnJlbnRTdGF0ZSkge1xuICAgICAgICBsZXQgc2VnID0gcGF0aC5zaGlmdCgpO1xuICAgICAgICBjdXJyZW50U3RhdGUgPSBjdXJyZW50U3RhdGUuY2hpbGQoc2VnKTtcbiAgICB9XG4gICAgcmV0dXJuIGN1cnJlbnRTdGF0ZTtcbn07XG5cblxuY29uc3QgX3dhdGNoU3RhdGUgPSBmdW5jdGlvbiBfd2F0Y2hTdGF0ZSgpIHtcbiAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcblxuICAgIF9wLnN0YXRlSW5mby53YXRjaCgnbmV4dFN0YXRlJywgKGluUGF0aCwgaW5DaGFuZ2VzKSA9PiB7XG4gICAgICAgIGxldCBuZXh0U3RhdGUgPSBfZmluZFN0YXRlLmJpbmQodGhpcykoaW5DaGFuZ2VzLm5ld1ZhbHVlKTtcbiAgICAgICAgaWYgKCFuZXh0U3RhdGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignQ2hhbmdpbmcgdG8gdW5rbm93biBzdGF0ZTogJyArXG4gICAgICAgICAgICAgICAgaW5DaGFuZ2VzLm5ld1ZhbHVlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByb2xsYmFjayA9IChpblJlYXNvbikgPT4ge1xuICAgICAgICAgICAgaW5SZWFzb24gJiYgY29uc29sZS5kZWJ1ZygnQ291bGQgbm90IGNoYW5nZSBzdGF0ZSBiZWNhdXNlOiAnICsgaW5SZWFzb24pOyAvL2pzaGludCBpZ25vcmU6bGluZVxuICAgICAgICAgICAgX3Auc3RhdGVJbmZvLnByb3AoJ25leHRTdGF0ZScsIGluQ2hhbmdlcy5vbGRWYWx1ZSwgdHJ1ZSk7XG4gICAgICAgICAgICBjdXJyZW50U3RhdGUuZGlkbnRMZWF2ZSgpO1xuICAgICAgICAgICAgZm9yIChsZXQgd2F0Y2hlciBvZiBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVXYXRjaGVycykge1xuICAgICAgICAgICAgICAgIHdhdGNoZXIoaW5DaGFuZ2VzLm5ld1ZhbHVlLCBpbkNoYW5nZXMub2xkVmFsdWUsIGluUmVhc29uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgbGV0IGN1cnJlbnRTdGF0ZSA9IF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZUluZm8uY3VycmVudFN0YXRlT2JqZWN0O1xuICAgICAgICBpZiAoY3VycmVudFN0YXRlKSB7XG4gICAgICAgICAgICBjdXJyZW50U3RhdGUubGVhdmluZyhpbkNoYW5nZXMubmV3VmFsdWUpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIG5leHRTdGF0ZS5lbnRlcmluZyhpbkNoYW5nZXMub2xkVmFsdWUpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVJbmZvLmN1cnJlbnRTdGF0ZU9iamVjdCA9IG5leHRTdGF0ZTtcbiAgICAgICAgICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5wcm9wKCdzdGF0ZScsIF9wLnN0YXRlSW5mby5wcm9wKCduZXh0U3RhdGUnKSk7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRTdGF0ZS5sZWZ0KGluQ2hhbmdlcy5uZXdWYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIG5leHRTdGF0ZS5lbnRlcmVkKGluQ2hhbmdlcy5vbGRWYWx1ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgd2F0Y2hlciBvZiBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVXYXRjaGVycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgd2F0Y2hlcihpbkNoYW5nZXMubmV3VmFsdWUsIGluQ2hhbmdlcy5vbGRWYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKHJvbGxiYWNrKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKHJvbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuXG5cbmNsYXNzIENvbXBvbmVudCB7XG5cbiAgICBjb25zdHJ1Y3RvcihpbkNvbmZpZywgaW5Jbml0T2JqLCBpbkNvbnN0cnVjdG9yLCBpblBhZ2UpIHtcbiAgICAgICAgY29uc3QgbGlmZWN5Y2xlU2lnbmFsID0gbmV3IFNpZ25hbCgpO1xuICAgICAgICBjb25zdCBsaWZlY3ljbGUgPSBuZXcgQ29tcG9uZW50TGlmZWN5Y2xlKGxpZmVjeWNsZVNpZ25hbCk7XG4gICAgICAgIF9wcml2YXRlLnNldCh0aGlzLCB7XG4gICAgICAgICAgICBzdGF0ZVdhdGNoZXJzOiBuZXcgU2V0KCksXG4gICAgICAgICAgICBsaWZlY3ljbGVTaWduYWw6IGxpZmVjeWNsZVNpZ25hbCxcbiAgICAgICAgICAgIHN0YXRlSW5mbzogbmV3IE9ic2VydmFibGVPYmplY3QoKVxuICAgICAgICB9KTtcblxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2xpZmVjeWNsZScsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxpZmVjeWNsZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cblxuICAgICAgICBpZiAoZmFjdG9yeS5jb21wb25lbnRDb25maWdQcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgICAgIGZhY3RvcnkuY29tcG9uZW50Q29uZmlnUHJlcHJvY2Vzc29yKGluQ29uZmlnKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNvbmZpZyA9IGluQ29uZmlnO1xuICAgICAgICB0aGlzLnBhZ2UgPSBpblBhZ2U7XG4gICAgICAgIHRoaXMuYnVzID0gbmV3IEJ1cyhpblBhZ2UgPyBpblBhZ2UuYnVzIDogbnVsbCk7IC8vanNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAgIHRoaXMubmFtZSA9IGluQ29uZmlnLm5hbWU7XG4gICAgICAgIGVhY2goaW5Db25maWcuYWN0aW9ucywgKGluQWN0aW9uKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWluQWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignUGFzc2VkIGEgbnVsbCBhY3Rpb24gdG8gY29tcG9uZW50IGNvbmZpZycpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGFjdGlvbk5hbWUgPSBpc1N0cmluZyhpbkFjdGlvbikgPyBpbkFjdGlvbiA6IGluQWN0aW9uLm5hbWU7XG4gICAgICAgICAgICBpZiAoIWFjdGlvbk5hbWUpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdQYXNzZWQgYW4gb2JqZWN0IHdpdGggbm8gYWN0aW9uIG5hbWUgYXMgYWN0aW9uIGluIGNvbXBvbmVudCBjb25maWcnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gaXNQbGFpbk9iamVjdChpbkFjdGlvbikgPyBpbkFjdGlvbi5oYW5kbGVyIDogdW5kZWZpbmVkO1xuXG4gICAgICAgICAgICBpZiAoaGFuZGxlciAmJiAhaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Bhc3NlZCBhIG5vbi1mdW5jdGlvbiBhY3Rpb24gaGFuZGxlciBpbiBjb21wb25lbnQgY29uZmlnJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzUGxhaW5PYmplY3QoaW5BY3Rpb24pICYmIGluQWN0aW9uLnB1Ymxpc2ggPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1cy5wdWJsaXNoQWN0aW9uKGFjdGlvbk5hbWUsIGhhbmRsZXIgPyBoYW5kbGVyLmJpbmQodGhpcykgOiBudWxsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5idXMuYWRkQWN0aW9uKGFjdGlvbk5hbWUsIGhhbmRsZXIgPyBoYW5kbGVyLmJpbmQodGhpcykgOiBudWxsKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcbiAgICAgICAgbGV0IHRlbXBsYXRlcyA9IGluQ29uZmlnLnRlbXBsYXRlcyB8fCB7fTtcblxuICAgICAgICBfc2V0dXBNb2RlbC5jYWxsKHRoaXMsIGluSW5pdE9iaik7XG5cbiAgICAgICAgZm9yIChsZXQgdGVtcGxhdGVOYW1lIGluIHRlbXBsYXRlcykge1xuICAgICAgICAgICAgbGV0IGFjdHVhbFRlbXBsYXRlTmFtZSA9IHRlbXBsYXRlTmFtZSA9PT0gJ19kZWZhdWx0JyA/XG4gICAgICAgICAgICAgICAgJ19kZWZhdWx0LicgKyB0aGlzLm5hbWUgOlxuICAgICAgICAgICAgICAgIHRlbXBsYXRlTmFtZTtcbiAgICAgICAgICAgIGZhY3RvcnkuZ2V0VGVtcGxhdGluZ0RlbGVnYXRlKClcbiAgICAgICAgICAgICAgICAucmVnaXN0ZXIoYWN0dWFsVGVtcGxhdGVOYW1lLCB0ZW1wbGF0ZXNbdGVtcGxhdGVOYW1lXSk7XG4gICAgICAgIH1cbiAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLmhhc0RlZmF1bHRUZW1wbGF0ZSA9ICEhdGVtcGxhdGVzLl9kZWZhdWx0O1xuICAgICAgICBfd2F0Y2hTdGF0ZS5iaW5kKHRoaXMpKCk7XG4gICAgICAgIHRoaXMuc3RhdGVzID0gdGhpcy5zdGF0ZXMgfHwgbmV3IFN0YXRlKCk7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZUluZm8uY3VycmVudFN0YXRlT2JqZWN0ID0gdGhpcy5zdGF0ZXM7XG4gICAgICAgIGluQ29uc3RydWN0b3IgJiYgaW5Db25zdHJ1Y3Rvci5iaW5kKHRoaXMpKCk7IC8vanNoaW50IGlnbm9yZTpsaW5lXG5cbiAgICAgICAgbWljcm90YXNrKHRoaXMuaW5pdFN0YXRlLmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIGRhdGEoaW5QYXRoLCBpblZhbHVlLCBpblNpbGVudCkge1xuICAgICAgICBjb25zdCBwYXRoID0gJ2RhdGEnICsgKGluUGF0aCA/ICcuJyArIGluUGF0aCA6ICcnKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFnZS5yZXNvbHZlTm9kZU1vZGVsKHRoaXMubm9kZSwgcGF0aCkucHJvcChwYXRoLCBpblZhbHVlLCBpblNpbGVudCk7XG4gICAgfVxuXG4gICAgaW5pdFN0YXRlKCkge1xuXG4gICAgfVxuXG4gICAgZ2V0Q3VycmVudFN0YXRlKCkge1xuICAgICAgICByZXR1cm4gX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5jdXJyZW50U3RhdGVPYmplY3Q7XG4gICAgfVxuXG4gICAgdHJ5U3RhdGUoaW5TdGF0ZU5hbWUpIHtcbiAgICAgICAgaWYgKGluU3RhdGVOYW1lID09PSBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVJbmZvLnByb3AoJ3N0YXRlJykpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB3YXRjaGVyID0gKGluTmV3U3RhdGUsIGluT2xkU3RhdGUsIGluRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoaW5FcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoaW5FcnJvcik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShpbk5ld1N0YXRlLCBpbk9sZFN0YXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy51bndhdGNoU3RhdGUod2F0Y2hlcik7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy53YXRjaFN0YXRlKHdhdGNoZXIpO1xuICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5wcm9wKCduZXh0U3RhdGUnLCBpblN0YXRlTmFtZSk7XG4gICAgICAgIH0pO1xuXG4gICAgfVxuXG4gICAgdW53YXRjaFN0YXRlKGluV2F0Y2hlckZ1bmN0aW9uKSB7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZVdhdGNoZXJzLmRlbGV0ZShpbldhdGNoZXJGdW5jdGlvbik7XG4gICAgfVxuXG4gICAgd2F0Y2hTdGF0ZShpbldhdGNoZXJGdW5jdGlvbikge1xuICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVXYXRjaGVycy5hZGQoaW5XYXRjaGVyRnVuY3Rpb24pO1xuICAgIH1cblxuICAgIGludmFsaWRhdGUoKSB7XG4gICAgICAgIGlmICghX3ByaXZhdGUuZ2V0KHRoaXMpLndpbGxSZW5kZXIpIHtcbiAgICAgICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS53aWxsUmVuZGVyID0gdHJ1ZTtcbiAgICAgICAgICAgIG1pY3JvdGFzayh0aGlzLnJlbmRlci5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlcihpbk1vZGVsKSB7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS53aWxsUmVuZGVyID0gZmFsc2U7XG4gICAgICAgIGlmIChfcHJpdmF0ZS5nZXQodGhpcykuaGFzRGVmYXVsdFRlbXBsYXRlKSB7XG4gICAgICAgICAgICBjb25zdCBkZWxlZ2F0ZSA9IGZhY3RvcnkuZ2V0VGVtcGxhdGluZ0RlbGVnYXRlKCk7XG4gICAgICAgICAgICBjb25zdCBtb2RlbCA9IGluTW9kZWwgP1xuICAgICAgICAgICAgICAgIE9ic2VydmFibGVPYmplY3QuZnJvbU9iamVjdChpbk1vZGVsKSA6XG4gICAgICAgICAgICAgICAgdGhpcy5wYWdlLnJlc29sdmVOb2RlTW9kZWwodGhpcy5ub2RlKTtcbiAgICAgICAgICAgIGRlbGVnYXRlLnJlbmRlcihcbiAgICAgICAgICAgICAgICAnX2RlZmF1bHQuJyArIHRoaXMubmFtZSxcbiAgICAgICAgICAgICAgICBtb2RlbCkudGhlbigoaW5IdG1sKSA9PiB7XG4gICAgICAgICAgICAgICAgJCh0aGlzLm5vZGUpLmh0bWwoaW5IdG1sKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFmdGVyUmVuZGVyICYmIHRoaXMuYWZ0ZXJSZW5kZXIoKTsgLy9qc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgICAgICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcylcbiAgICAgICAgICAgICAgICAgICAgLmxpZmVjeWNsZVNpZ25hbC5kaXNwYXRjaCgncmVuZGVyZWQnKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChpbkVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihpbkVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IENvbXBvbmVudDtcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgJCA9IHJlcXVpcmUoJ2pxdWVyeScpO1xuXG5sZXQgX3BhZ2UgPSBudWxsO1xuXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmdW5jdGlvbihpblBhZ2UpIHtcbiAgICAgICAgcmV0dXJuIG5ldyhmdW5jdGlvbihpblBhZ2UpIHtcbiAgICAgICAgICAgIHRoaXMucGFnZSA9IF9wYWdlID0gaW5QYWdlO1xuXG4gICAgICAgICAgICB0aGlzLnJlc29sdmUgPSBmdW5jdGlvbiByZXNvbHZlKGluTm9kZSwgaW5QYXRoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlUHJvbWlzZSwgcmVqZWN0UHJvbWlzZSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghL15fLy50ZXN0KGluUGF0aCkgJiYgaW5QYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5QYXRoID09PSAnLicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpblBhdGggPSAnZGF0YSc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluUGF0aCA9ICdkYXRhJyArIChpblBhdGggPyAnLicgKyBpblBhdGggOiAnJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbW9kZWwgPSBfcGFnZS5yZXNvbHZlTm9kZU1vZGVsKGluTm9kZSwgaW5QYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZVByb21pc2UoaW5QYXRoID8gbW9kZWwucHJvcChpblBhdGgpIDogbW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB0aGlzLmJpbmRQYXRoID0gZnVuY3Rpb24gYmluZFBhdGgoaW5Ob2RlLCBpblBhdGgsIGluSGFuZGxlcikge1xuICAgICAgICAgICAgICAgIGlmICghL15fLy50ZXN0KGluUGF0aCkgJiYgaW5QYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpblBhdGggPT09ICcuJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5QYXRoID0gJ2RhdGEnO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5QYXRoID0gJ2RhdGEnICsgKGluUGF0aCA/ICcuJyArIGluUGF0aCA6ICcnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBtb2RlbCA9IF9wYWdlLnJlc29sdmVOb2RlTW9kZWwoaW5Ob2RlLCBpblBhdGgpO1xuXG4gICAgICAgICAgICAgICAgbW9kZWwud2F0Y2goaW5QYXRoLCBmdW5jdGlvbihpblBhdGgsIGluQ2hhbmdlcykge1xuICAgICAgICAgICAgICAgICAgICBpbkhhbmRsZXIoaW5DaGFuZ2VzLm5ld1ZhbHVlLCBpbkNoYW5nZXMub2xkVmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdGhpcy5zZXRQYXRoID0gZnVuY3Rpb24gc2V0UGF0aChpbk5vZGUsIGluUGF0aCwgaW5WYWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmICghL15fLy50ZXN0KGluUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5QYXRoID0gJ2RhdGEuJyArIGluUGF0aDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgbW9kZWwgPSBfcGFnZS5yZXNvbHZlTm9kZU1vZGVsKGluTm9kZSwgaW5QYXRoKTtcbiAgICAgICAgICAgICAgICBtb2RlbC5wcm9wKGluUGF0aCwgaW5WYWx1ZSk7XG4gICAgICAgICAgICB9O1xuXG5cbiAgICAgICAgfSkoaW5QYWdlKTtcbiAgICB9O1xuXG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydCBkZWZhdWx0IChmdW5jdGlvbigpIHtcbiAgICB2YXIgcHJvdG8gPSBPYmplY3QuY3JlYXRlKHdpbmRvdy5IVE1MRWxlbWVudC5wcm90b3R5cGUpO1xuICAgIHJldHVybiBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLWVsZW1lbnQnLCB7IHByb3RvdHlwZTogcHJvdG8gfSk7XG59KSgpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IEVsZW1lbnQgZnJvbSAnLi9hZS1lbGVtZW50JztcbmltcG9ydCBfIGZyb20gJ2xvZGFzaCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGFjdGlvbihpblBhZ2UpIHtcbiAgICBjb25zdCBfcGFnZSA9IGluUGFnZTtcblxuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoRWxlbWVudC5wcm90b3R5cGUpO1xuXG4gICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICB9O1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLW1hbmFnZWQnLCB7IHByb3RvdHlwZTogcHJvdG8gfSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnQgZGVmYXVsdCBTeW1ib2woJ3VucmVzb2x2ZWQnKTtcbiIsIid1c2Ugc3RyaWN0JztcbmltcG9ydCBVTlJFU09MVkVEIGZyb20gJy4uL3N5bWJvbC91bnJlc29sdmVkJztcbmltcG9ydCB7ZWFjaCwgaXNTdHJpbmd9IGZyb20gJ2xvZGFzaCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHR5cGlmeVBhcmFtcyhpblBhZ2UsIGluUGFyYW1zKSB7XG4gICAgY29uc3Qgb3V0ID0ge307XG4gICAgZWFjaChpblBhcmFtcywgZnVuY3Rpb24oaW5QYXJhbVZhbHVlLCBpblBhcmFtS2V5KSB7XG4gICAgICAgIGlmICghaW5QYXJhbVZhbHVlKSB7XG4gICAgICAgICAgICBvdXRbaW5QYXJhbUtleV0gPSBudWxsO1xuICAgICAgICB9IGVsc2UgaWYgKGlzU3RyaW5nKGluUGFyYW1WYWx1ZSkgJiYgL15+Ly50ZXN0KGluUGFyYW1WYWx1ZSkpIHtcbiAgICAgICAgICAgIGxldCByZXNvbHZlZFZhbHVlID0gVU5SRVNPTFZFRDtcbiAgICAgICAgICAgIGluUGFnZS5nZXREYXRhU291cmNlKClcbiAgICAgICAgICAgICAgICAucmVzb2x2ZSh0aGlzLCBpblBhcmFtVmFsdWUucmVwbGFjZSgnficsICcnKSkudGhlbigoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlZFZhbHVlID0gaW5WYWx1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChyZXNvbHZlZFZhbHVlID09PSBVTlJFU09MVkVEKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBY3Rpb24gcGFyYW1ldGVycyBtdXN0IGJlIHJlc29sdmVkIHN5bmNocm9ub3VzbHknKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG91dFtpblBhcmFtS2V5XSA9IHJlc29sdmVkVmFsdWU7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNTdHJpbmcoaW5QYXJhbVZhbHVlKSAmJiAvXmAuKmAkLy50ZXN0KGluUGFyYW1WYWx1ZSkpIHtcbiAgICAgICAgICAgIG91dFtpblBhcmFtS2V5XSA9IGluUGFyYW1WYWx1ZS5yZXBsYWNlKC9eYC8sICcnKS5yZXBsYWNlKC9gJC8sICcnKTtcbiAgICAgICAgfSBlbHNlIGlmICghaXNOYU4oaW5QYXJhbVZhbHVlKSkge1xuICAgICAgICAgICAgb3V0W2luUGFyYW1LZXldID0gTnVtYmVyKGluUGFyYW1WYWx1ZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoL14odHJ1ZXxmYWxzZSkkLy50ZXN0KGluUGFyYW1WYWx1ZSkpIHtcbiAgICAgICAgICAgIG91dFtpblBhcmFtS2V5XSA9IChpblBhcmFtVmFsdWUgPT09ICd0cnVlJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ3VzaW5nIGRlcHJlY2F0ZWQgc2lnbmFsIHN0cmluZyBwYXJhbSBmb3JtYXQnKTtcbiAgICAgICAgICAgIG91dFtpblBhcmFtS2V5XSA9IGluUGFyYW1WYWx1ZTsgLy9pcyBhIHN0cmluZ1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG91dDtcblxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IHtnZXQsIGVhY2gsIGlzU3RyaW5nIH0gZnJvbSAnbG9kYXNoJztcbmltcG9ydCBVTlJFU09MVkVEIGZyb20gJy4uL3N5bWJvbC91bnJlc29sdmVkJztcbmltcG9ydCB0eXBpZnlQYXJhbXMgZnJvbSAnLi4vdXRpbC90eXBpZnktcGFyYW1ldGVycyc7XG5cblxuY29uc3QgcmVzb2x2ZVRhcmdldHMgPSBmdW5jdGlvbiByZXNvbHZlVGFyZ2V0cyhpblBhZ2UsIGluQ29uZmlnKSB7XG4gICAgbGV0IHRhcmdldCA9IHt9O1xuICAgICAgICBjb25zdCB0YXJnZXRBdHRyID0gaW5Db25maWcudGFyZ2V0O1xuICAgIGlmICgkKHRoaXMpLmNoaWxkcmVuKCkubGVuZ3RoICYmIHRhcmdldEF0dHIgIT09ICdzZWxmJykge1xuICAgICAgICB0YXJnZXQubm9kZSA9ICQodGhpcykuY2hpbGRyZW4oKS5nZXQoMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKCF0YXJnZXRBdHRyKSB7XG4gICAgICAgICAgICB0YXJnZXQubm9kZSA9ICQodGhpcykucGFyZW50KCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGFyZ2V0QXR0ciA9PT0gJ25leHQnKSB7XG4gICAgICAgICAgICB0YXJnZXQubm9kZSA9ICQodGhpcykubmV4dCgpO1xuICAgICAgICB9IGVsc2UgaWYgKC9eY2xvc2VzdC8udGVzdCh0YXJnZXRBdHRyKSkge1xuICAgICAgICAgICAgY29uc3Qgc2VncyA9IHRhcmdldEF0dHIuc3BsaXQoL1xccysvKTtcbiAgICAgICAgICAgIHRhcmdldC5ub2RlID0gJCh0aGlzKS5jbG9zZXN0KHNlZ3NbMV0pO1xuICAgICAgICB9IGVsc2UgaWYgKC9eKFxcLnxcXCMpLy50ZXN0KHRhcmdldEF0dHIpKSB7XG4gICAgICAgICAgICB0YXJnZXQubm9kZSA9ICQodGhpcykucGFyZW50KCkuZmluZCh0YXJnZXRBdHRyKTtcbiAgICAgICAgfSBlbHNlIGlmICgvXnNlbGYkLy50ZXN0KHRhcmdldEF0dHIpKSB7XG4gICAgICAgICAgICB0YXJnZXQubm9kZSA9ICQodGhpcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1Vua25vd24gYWUtYmluZCB0YXJnZXQ6ICcgKyB0YXJnZXRBdHRyKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAodGFyZ2V0Lm5vZGUgJiYgdGFyZ2V0Lm5vZGUubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfSBlbHNlIGlmICh0YXJnZXQubm9kZSAmJiAhdGFyZ2V0Lm5vZGUubGVuZ3RoKSB7XG4gICAgICAgIHRhcmdldC5wZW5kaW5nID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG4gICAgcmV0dXJuO1xufTtcblxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhdHRhY2hBY3Rpb24oaW5QYWdlLCBpbkNvbmZpZykge1xuICAgIGxldCB0YXJnZXQgPSByZXNvbHZlVGFyZ2V0cy5jYWxsKHRoaXMsIGluUGFnZSwgaW5Db25maWcpO1xuICAgIGlmIChnZXQodGhpcywgJ3BlbmRpbmcnKSA9PT0gdHJ1ZSkge1xuICAgICAgICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMpID0+IHtcbiAgICAgICAgICAgIGF0dGFjaEFjdGlvbi5jYWxsKHRoaXMpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3Qgb2JzZXJ2ZXJDb25maWcgPSB7XG4gICAgICAgICAgICBzdWJ0cmVlOiB0cnVlLFxuICAgICAgICAgICAgY2hpbGRMaXN0OiB0cnVlXG4gICAgICAgIH07XG4gICAgICAgIG9ic2VydmVyLm9ic2VydmUodGhpcy5wYXJlbnROb2RlLCBvYnNlcnZlckNvbmZpZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgYWN0aW9uTmFtZSA9IGluQ29uZmlnLm5hbWU7XG4gICAgICAgIGVhY2godGFyZ2V0Lm5vZGUsIChpblRhcmdldE5vZGUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IGluUGFnZS5yZXNvbHZlTm9kZUNvbXBvbmVudChpblRhcmdldE5vZGUpO1xuICAgICAgICAgICAgbGV0IGV2ZW50O1xuXG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gKGluRXZlbnQsIGluVHJpZ2dlcikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChpblRyaWdnZXIgPT09ICdlbnRlcicgJiYgaW5FdmVudC5rZXlDb2RlICE9PSAxMykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChpblRyaWdnZXIgPT09ICdlc2MnICYmIGluRXZlbnQua2V5Q29kZSAhPT0gMjcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb21wb25lbnQuYnVzLnRyaWdnZXJBY3Rpb24oXG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGluRXZlbnQsXG4gICAgICAgICAgICAgICAgICAgIHR5cGlmeVBhcmFtcyhpblBhZ2UsIGluQ29uZmlnLnBhcmFtcylcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfTtcblxuXG4gICAgICAgICAgICBmb3IgKGxldCB0cmlnZ2VyIG9mKGluQ29uZmlnLnRyaWdnZXIgfHwgJycpLnNwbGl0KCcsJykpIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHRyaWdnZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnZW50ZXInOlxuICAgICAgICAgICAgICAgICAgICBjYXNlICdlc2MnOlxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSAna2V5dXAnO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJyc6XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudCA9ICdjbGljayc7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgvXlxcdys6Ly50ZXN0KHRyaWdnZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSB0cmlnZ2VyLm1hdGNoKC9eKFxcdyspLylbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50ID0gdHJpZ2dlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjYWxsZXIgPSAoaW5FdmVudCkgPT4geyAvL2pzaGludCBpZ25vcmU6bGluZVxuICAgICAgICAgICAgICAgICAgICBoYW5kbGVyKGluRXZlbnQsIHRyaWdnZXIpO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAkKGluVGFyZ2V0Tm9kZSkub2ZmKGV2ZW50LCBjYWxsZXIpLm9uKGV2ZW50LCBjYWxsZXIpO1xuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgfSk7XG4gICAgfVxuXG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5pbXBvcnQgRWxlbWVudCBmcm9tICcuL2FlLWVsZW1lbnQnO1xuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJztcbmltcG9ydCBhdHRhY2hBY3Rpb24gZnJvbSAnLi4vZGVsZWdhdGUvYWN0aW9uLXRyaWdnZXItZGVsZWdhdGUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhZUJ1dHRvbihpblBhZ2UpIHtcbiAgICBjb25zdCBfcGFnZSA9IGluUGFnZTtcbiAgICBsZXQgb2JzZXJ2ZXI7XG5cbiAgICB2YXIgcHJvdG8gPSBPYmplY3QuY3JlYXRlKEhUTUxCdXR0b25FbGVtZW50LnByb3RvdHlwZSk7XG4gICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdjcmVhdGVkIGFlLWJ1dHRvbicpO1xuICAgICAgICBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGZ1bmN0aW9uKG11dGF0aW9ucykge1xuICAgICAgICAgICAgbXV0YXRpb25zLmZvckVhY2goZnVuY3Rpb24obXV0YXRpb24pIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKG11dGF0aW9uLmF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbGFiZWwnOlxuICAgICAgICAgICAgICAgICAgICAgICAgJChtdXRhdGlvbi50YXJnZXQpLnRleHQoJChtdXRhdGlvbi50YXJnZXQpLmF0dHIoJ2xhYmVsJykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICAvLyBjb25maWd1cmF0aW9uIG9mIHRoZSBvYnNlcnZlcjpcbiAgICAgICAgdmFyIGNvbmZpZyA9IHsgYXR0cmlidXRlczogdHJ1ZSB9O1xuXG4gICAgICAgIC8vIHBhc3MgaW4gdGhlIHRhcmdldCBub2RlLCBhcyB3ZWxsIGFzIHRoZSBvYnNlcnZlciBvcHRpb25zXG4gICAgICAgIG9ic2VydmVyLm9ic2VydmUodGhpcywgY29uZmlnKTtcblxuXG4gICAgICAgIGlmICgkKHRoaXMpLmF0dHIoJ2JpbmQtbGFiZWwnKSkge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9ICQodGhpcykuYXR0cignYmluZC1sYWJlbCcpO1xuICAgICAgICAgICAgY29uc3Qgc291cmNlID0gJCh0aGlzKS5hdHRyKCdzb3VyY2UnKTtcblxuICAgICAgICAgICAgX3BhZ2VcbiAgICAgICAgICAgICAgICAuZ2V0RGF0YVNvdXJjZShzb3VyY2UpXG4gICAgICAgICAgICAgICAgLmJpbmRQYXRoKHRoaXMsIHBhdGgsIChpbk5ld1ZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICQodGhpcykudGV4dChpbk5ld1ZhbHVlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIF9wYWdlXG4gICAgICAgICAgICAgICAgLmdldERhdGFTb3VyY2Uoc291cmNlKVxuICAgICAgICAgICAgICAgIC5yZXNvbHZlKHRoaXMsIHBhdGgpXG4gICAgICAgICAgICAgICAgLnRoZW4oKGluVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgJCh0aGlzKS50ZXh0KGluVmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCQodGhpcykuYXR0cignYmluZC1lbmFibGVkJykpIHtcbiAgICAgICAgICAgIGxldCBwYXRoID0gJCh0aGlzKS5hdHRyKCdiaW5kLWVuYWJsZWQnKTtcbiAgICAgICAgICAgIGxldCBzdHJpY3RCb29sZWFuID0gZmFsc2U7XG4gICAgICAgICAgICBpZigvISQvLnRlc3QocGF0aCkpIHtcbiAgICAgICAgICAgICAgICBwYXRoID0gcGF0aC5yZXBsYWNlKC8hJC8sICcnKTtcbiAgICAgICAgICAgICAgICBzdHJpY3RCb29sZWFuID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHNvdXJjZSA9ICQodGhpcykuYXR0cignc291cmNlJyk7XG4gICAgICAgICAgICBjb25zdCBzZXRWYWx1ZSA9IChpblZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgJCh0aGlzKS5wcm9wKCdkaXNhYmxlZCcsIHN0cmljdEJvb2xlYW4gPyBpblZhbHVlICE9PSB0cnVlIDogIWluVmFsdWUpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgX3BhZ2VcbiAgICAgICAgICAgICAgICAuZ2V0RGF0YVNvdXJjZShzb3VyY2UpXG4gICAgICAgICAgICAgICAgLmJpbmRQYXRoKHRoaXMsIHBhdGgsIChpbk5ld1ZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHNldFZhbHVlKGluTmV3VmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgX3BhZ2VcbiAgICAgICAgICAgICAgICAuZ2V0RGF0YVNvdXJjZShzb3VyY2UpXG4gICAgICAgICAgICAgICAgLnJlc29sdmUodGhpcywgcGF0aClcbiAgICAgICAgICAgICAgICAudGhlbigoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBzZXRWYWx1ZShpblZhbHVlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgkKHRoaXMpLmF0dHIoJ2FjdGlvbicpKSB7XG4gICAgICAgICAgICBhdHRhY2hBY3Rpb24uY2FsbCh0aGlzLCBfcGFnZSwge1xuICAgICAgICAgICAgICAgIG5hbWU6ICQodGhpcykuYXR0cignYWN0aW9uJyksXG4gICAgICAgICAgICAgICAgdHJpZ2dlcjogJ2NsaWNrJyxcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdzZWxmJyxcbiAgICAgICAgICAgICAgICBwYXJhbXM6ICgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAkKCQodGhpcykuZ2V0KDApLmF0dHJpYnV0ZXMpLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoL15wYXJhbS0vLnRlc3QodGhpcy5uYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtc1t0aGlzLm5hbWUucmVwbGFjZSgncGFyYW0tJywgJycpXSA9IHRoaXMudmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGFyYW1zO1xuICAgICAgICAgICAgICAgIH0pKClcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cblxuXG4gICAgfTtcblxuICAgIHByb3RvLmF0dGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKCQodGhpcykuYXR0cignbGFiZWwnKSkge1xuICAgICAgICAgICAgJCh0aGlzKS5odG1sKCQodGhpcykuYXR0cignbGFiZWwnKSk7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBwcm90by5kZXRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICB9O1xuXG4gICAgZG9jdW1lbnQucmVnaXN0ZXJFbGVtZW50KCdhZS1idXR0b24nLCB7IHByb3RvdHlwZTogcHJvdG8sIGV4dGVuZHMgOiAnYnV0dG9uJ30pO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuaW1wb3J0IGZhY3RvcnkgZnJvbSAnLi4vcGFnZS1mYWN0b3J5JztcbmltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5pbXBvcnQgRWxlbWVudCBmcm9tICcuL2FlLWVsZW1lbnQnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBlYWNoKGluUGFnZSkge1xuICAgIGNvbnN0IF9wYWdlID0gaW5QYWdlO1xuICAgIGNvbnN0IF9wcml2YXRlID0gbmV3IFdlYWtNYXAoKTtcbiAgICBjb25zdCBfdGVtcGxhdGluZ0RlbGVnYXRlID0gZmFjdG9yeS5nZXRUZW1wbGF0aW5nRGVsZWdhdGUoKTtcblxuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoRWxlbWVudC5wcm90b3R5cGUpO1xuXG4gICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgJCh0aGlzKS5jaGlsZHJlbigpLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZiAoIShkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRoaXMudGFnTmFtZSkgaW5zdGFuY2VvZiBFbGVtZW50KSAmJiB0aGlzLm5vZGVOYW1lLnRvVXBwZXJDYXNlKCkgIT09ICdURU1QTEFURScpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2FlLWVhY2ggY2hpbGRyZW4gbXVzdCBiZSBlaXRoZXIgPGFlLS4uLj4gb3IgYSA8dGVtcGxhdGU+IGVsZW1lbnQuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBsZXQgdGVtcGxhdGVOYW1lID0gJCh0aGlzKS5hdHRyKCd0ZW1wbGF0ZScpXG4gICAgICAgIGlmICghdGVtcGxhdGVOYW1lKSB7XG4gICAgICAgICAgICBsZXQgdGVtcGxhdGUgPSAkKHRoaXMpLmZpbmQoJz50ZW1wbGF0ZScpO1xuXG4gICAgICAgICAgICBfcHJpdmF0ZS5zZXQodGhpcywge1xuICAgICAgICAgICAgICAgIHRlbXBsYXRlTmFtZTogX3RlbXBsYXRpbmdEZWxlZ2F0ZS5yZWdpc3RlclRlbXBsYXRlKHRlbXBsYXRlLmh0bWwoKSlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgX3ByaXZhdGUuc2V0KHRoaXMsIHtcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZU5hbWU6IHRlbXBsYXRlTmFtZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEkKHRoaXMpLmZpbmQoJz5hZS1tYW5hZ2VkJykubGVuZ3RoKSB7XG4gICAgICAgICAgICAkKHRoaXMpLmFwcGVuZChkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhZS1tYW5hZ2VkJykpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHByb3RvLmF0dGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgbGV0IGRhdGFTb3VyY2VOYW1lID0gJCh0aGlzKS5hdHRyKCdzb3VyY2UnKTtcbiAgICAgICAgY29uc3QgcGF0aCA9ICQodGhpcykuYXR0cigncGF0aCcpO1xuICAgICAgICBsZXQgZGF0YVNvdXJjZSA9IF9wYWdlLmdldERhdGFTb3VyY2UoZGF0YVNvdXJjZU5hbWUpO1xuICAgICAgICBjb25zdCB0ZW1wbGF0ZU5hbWUgPSBfcHJpdmF0ZS5nZXQodGhpcykudGVtcGxhdGVOYW1lO1xuXG4gICAgICAgIGNvbnN0IGFwcGVuZEZuID0gKGluSHRtbCkgPT4ge1xuICAgICAgICAgICAgJCh0aGlzKS5maW5kKCc+YWUtbWFuYWdlZCcpLmFwcGVuZChpbkh0bWwpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGVycm9yRm4gPSAoaW5FcnJvcikgPT4ge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGluRXJyb3IpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHJlbmRlckZuID0gKGluRGF0YSkgPT4ge1xuICAgICAgICAgICAgJCh0aGlzKS5maW5kKCc+YWUtbWFuYWdlZCcpLmVtcHR5KCk7XG4gICAgICAgICAgICBpZiAoaW5EYXRhIGluc3RhbmNlb2YgT2JzZXJ2YWJsZU9iamVjdCApIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpbnN0YW5jZSBvZiBpbkRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgX3RlbXBsYXRpbmdEZWxlZ2F0ZS5yZW5kZXIodGVtcGxhdGVOYW1lLCBpbnN0YW5jZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKGFwcGVuZEZuKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGVycm9yRm4pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgX3RlbXBsYXRpbmdEZWxlZ2F0ZS5yZW5kZXIodGVtcGxhdGVOYW1lLCBpbkRhdGEpXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKGFwcGVuZEZuKVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZXJyb3JGbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgZGF0YVNvdXJjZS5iaW5kUGF0aCh0aGlzLCBwYXRoLCAoaW5OZXdWYWx1ZSkgPT4ge1xuICAgICAgICAgICAgcmVuZGVyRm4oaW5OZXdWYWx1ZSk7XG4gICAgICAgIH0pO1xuICAgICAgICBkYXRhU291cmNlLnJlc29sdmUodGhpcywgcGF0aCkudGhlbigoaW5EYXRhKSA9PiB7XG4gICAgICAgICAgICByZW5kZXJGbihpbkRhdGEpOyAgICBcbiAgICAgICAgfSlcbiAgICAgICAgXG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLWVhY2gnLCB7IHByb3RvdHlwZTogcHJvdG8gfSk7XG59XG4iLCJpbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IEVsZW1lbnQgZnJvbSAnLi9hZS1lbGVtZW50JztcbmltcG9ydCBtaWNyb3Rhc2sgZnJvbSAnLi4vbWljcm90YXNrJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc3RhdGUoaW5QYWdlKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuICAgIGNvbnN0IF9wYWdlID0gaW5QYWdlO1xuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoRWxlbWVudC5wcm90b3R5cGUpO1xuXG4gICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IF9wYWdlLnJlc29sdmVOb2RlQ29tcG9uZW50KHRoaXMpO1xuICAgICAgICBjb25zdCBtZXRob2QgPSAkKHRoaXMpLmF0dHIoJ21ldGhvZCcpIHx8ICdyZW1vdmFsJztcbiAgICAgICAgY29uc3Qgc3RhdGVQYXR0ZXJuID0gbmV3IFJlZ0V4cCgkKHRoaXMpLmF0dHIoJ3BhdHRlcm4nKSB8fCAnXiQnKTtcbiAgICAgICAgY29uc3Qgd2F0Y2hlciA9ICgpID0+IHtcbiAgICAgICAgICAgICQodGhpcykucHJvcCgnd2lsbFJlbmRlcicsIGZhbHNlKTtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRTdGF0ZSA9IGNvbXBvbmVudC5nZXRDdXJyZW50U3RhdGUoKTtcbiAgICAgICAgICAgIGlmIChzdGF0ZVBhdHRlcm4udGVzdChjdXJyZW50U3RhdGUuZ2V0UGF0aCgpKSkge1xuICAgICAgICAgICAgICAgIGlmIChtZXRob2QgPT09ICd2aXNpYmlsaXR5Jykge1xuICAgICAgICAgICAgICAgICAgICAkKHRoaXMpLmNoaWxkcmVuKCkuZWFjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICQodGhpcykucmVtb3ZlQ2xhc3MoJ2lzLWhpZGRlbicpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoISQodGhpcykucHJvcCgnd2FzUmVuZGVyZWQnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgJCh0aGlzKS5odG1sKHRoaXMuY29udGVudCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAkKHRoaXMpLnByb3AoJ3dhc1JlbmRlcmVkJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2Fib3V0IHRvIGNhbGwgLnJlbmRlcmVkIG9uICcgKyBjdXJyZW50U3RhdGUuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgICAgICBjdXJyZW50U3RhdGUucmVuZGVyZWQoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ3Zpc2liaWxpdHknKSB7XG4gICAgICAgICAgICAgICAgICAgICQodGhpcykuY2hpbGRyZW4oKS5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgJCh0aGlzKS5hZGRDbGFzcygnaXMtaGlkZGVuJyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICQodGhpcykuZW1wdHkoKTtcbiAgICAgICAgICAgICAgICAgICAgJCh0aGlzKS5wcm9wKCd3YXNSZW5kZXJlZCcsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgY29tcG9uZW50LndhdGNoU3RhdGUoKCkgPT4ge1xuICAgICAgICAgICAgaWYoISQodGhpcykucHJvcCgnd2lsbFJlbmRlcicpKSB7XG4gICAgICAgICAgICAgICAgJCh0aGlzKS5wcm9wKCd3aWxsUmVuZGVyJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgbWljcm90YXNrKHdhdGNoZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5jb250ZW50ID0gJCh0aGlzKS5odG1sKCk7XG4gICAgICAgIHdhdGNoZXIoKTtcblxuICAgIH07XG5cbiAgICBwcm90by5hdHRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cblxuICAgIH07XG5cbiAgICBwcm90by5kZXRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICB9O1xuXG4gICAgZG9jdW1lbnQucmVnaXN0ZXJFbGVtZW50KCdhZS1zdGF0ZScsIHsgcHJvdG90eXBlOiBwcm90byB9KTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcbmltcG9ydCBFbGVtZW50IGZyb20gJy4vYWUtZWxlbWVudCc7XG5pbXBvcnQge2lzRnVuY3Rpb259IGZyb20gJ2xvZGFzaCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGNoZWNrYm94KGluUGFnZSkge1xuICAgIGNvbnN0IF9wYWdlID0gaW5QYWdlO1xuICAgIGxldCBvYnNlcnZlcjtcbiAgICB2YXIgcHJvdG8gPSBPYmplY3QuY3JlYXRlKEVsZW1lbnQucHJvdG90eXBlKTtcbiAgICBwcm90by5jcmVhdGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihmdW5jdGlvbihtdXRhdGlvbnMpIHtcbiAgICAgICAgICAgIG11dGF0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKG11dGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChtdXRhdGlvbi5hdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2xhYmVsJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICQobXV0YXRpb24udGFyZ2V0KS5maW5kKCdsYWJlbD5zcGFuJykudGV4dCgkKG11dGF0aW9uLnRhcmdldCkuYXR0cignbGFiZWwnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbGFiZWwtY2xhc3MnOlxuICAgICAgICAgICAgICAgICAgICAgICAgJChtdXRhdGlvbi50YXJnZXQpLmZpbmQoJ2xhYmVsJykuYXR0cignY2xhc3MnLCAkKG11dGF0aW9uLnRhcmdldCkuYXR0cignbGFiZWwtY2xhc3MnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAndmFsdWUnOlxuICAgICAgICAgICAgICAgICAgICAgICAgJChtdXRhdGlvbi50YXJnZXQpLmZpbmQoJ2lucHV0JykuYXR0cigndmFsdWUnLCAkKG11dGF0aW9uLnRhcmdldCkuYXR0cigndmFsdWUnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnaW5wdXQtY2xhc3MnOlxuICAgICAgICAgICAgICAgICAgICAgICAgJChtdXRhdGlvbi50YXJnZXQpLmZpbmQoJ2lucHV0JykuYXR0cignY2xhc3MnLCAkKG11dGF0aW9uLnRhcmdldCkuYXR0cignaW5wdXQtY2xhc3MnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gY29uZmlndXJhdGlvbiBvZiB0aGUgb2JzZXJ2ZXI6XG4gICAgICAgIHZhciBjb25maWcgPSB7IGF0dHJpYnV0ZXM6IHRydWUgfTtcblxuICAgICAgICAvLyBwYXNzIGluIHRoZSB0YXJnZXQgbm9kZSwgYXMgd2VsbCBhcyB0aGUgb2JzZXJ2ZXIgb3B0aW9uc1xuICAgICAgICBvYnNlcnZlci5vYnNlcnZlKHRoaXMsIGNvbmZpZyk7XG5cbiAgICAgICAgLy8gbGF0ZXIsIHlvdSBjYW4gc3RvcCBvYnNlcnZpbmdcbiAgICAgICAgbGV0IGlucHV0ID0gYDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjbGFzcz1cIiR7JCh0aGlzKS5hdHRyKCdpbnB1dC1jbGFzcycpIHx8ICcnfVwiIHZhbHVlPVwiJHskKHRoaXMpLmF0dHIoJ3ZhbHVlJykgfHwgJyd9XCI+YDtcbiAgICAgICAgbGV0IG91dCA9XG4gICAgICAgICAgICBgPGxhYmVsIGNsYXNzPVwiJHskKHRoaXMpLmF0dHIoJ2xhYmVsLWNsYXNzJykgfHwgJyd9XCI+JHtpbnB1dH08c3Bhbj4keyQodGhpcykuYXR0cignbGFiZWwnKSB8fCAnJ308L3NwYW4+PC9sYWJlbD5gO1xuICAgICAgICAkKHRoaXMpLmFwcGVuZChvdXQpO1xuICAgIH07XG4gICAgcHJvdG8udmFsdWVDaGFuZ2VkSG9vayA9IGZ1bmN0aW9uKGluSGFuZGxlcikge1xuICAgICAgICBjb25zdCBoYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpbkhhbmRsZXIoJCh0aGlzKS5maW5kKCdpbnB1dCcpLmF0dHIoJ3ZhbHVlJykpO1xuICAgICAgICB9O1xuICAgICAgICBpZiAoaXNGdW5jdGlvbihpbkhhbmRsZXIpKSB7XG4gICAgICAgICAgICAkKHRoaXMpLmZpbmQoJ2lucHV0Jykub2ZmKCdjbGljaycsIGhhbmRsZXIpLm9uKCdjbGljaycsIGhhbmRsZXIpO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLWNoZWNrYm94JywgeyBwcm90b3R5cGU6IHByb3RvIH0pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcbmltcG9ydCBFbGVtZW50IGZyb20gJy4vYWUtZWxlbWVudCc7XG5pbXBvcnQge2lzRnVuY3Rpb259IGZyb20gJ2xvZGFzaCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHJhZGlvKGluUGFnZSkge1xuICAgIGNvbnN0IF9wYWdlID0gaW5QYWdlO1xuXG4gICAgdmFyIHByb3RvID0gT2JqZWN0LmNyZWF0ZShFbGVtZW50LnByb3RvdHlwZSk7XG4gICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7fTtcbiAgICBwcm90by52YWx1ZUNoYW5nZWRIb29rID0gZnVuY3Rpb24oaW5IYW5kbGVyKSB7XG4gICAgICAgIGNvbnN0IGhhbmRsZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGluSGFuZGxlcigkKHRoaXMpLmF0dHIoJ3ZhbHVlJykpO1xuICAgICAgICB9O1xuICAgICAgICBpZiAoaXNGdW5jdGlvbihpbkhhbmRsZXIpKSB7XG4gICAgICAgICAgICAkKHRoaXMpLmZpbmQoJ2lucHV0Jykub2ZmKCdjbGljaycsIGhhbmRsZXIpLm9uKCdjbGljaycsIGhhbmRsZXIpO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihmdW5jdGlvbihtdXRhdGlvbnMpIHtcbiAgICAgICAgICAgIG11dGF0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKG11dGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChtdXRhdGlvbi5hdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2xhYmVsJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICQobXV0YXRpb24udGFyZ2V0KS5maW5kKCdsYWJlbD5zcGFuJykudGV4dCgkKG11dGF0aW9uLnRhcmdldCkuYXR0cignbGFiZWwnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbGFiZWwtY2xhc3MnOlxuICAgICAgICAgICAgICAgICAgICAgICAgJChtdXRhdGlvbi50YXJnZXQpLmZpbmQoJ2xhYmVsJykuYXR0cignY2xhc3MnLCAkKG11dGF0aW9uLnRhcmdldCkuYXR0cignbGFiZWwtY2xhc3MnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAndmFsdWUnOlxuICAgICAgICAgICAgICAgICAgICAgICAgJChtdXRhdGlvbi50YXJnZXQpLmZpbmQoJ2lucHV0JykuYXR0cigndmFsdWUnLCAkKG11dGF0aW9uLnRhcmdldCkuYXR0cigndmFsdWUnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnaW5wdXQtY2xhc3MnOlxuICAgICAgICAgICAgICAgICAgICAgICAgJChtdXRhdGlvbi50YXJnZXQpLmZpbmQoJ2lucHV0JykuYXR0cignY2xhc3MnLCAkKG11dGF0aW9uLnRhcmdldCkuYXR0cignaW5wdXQtY2xhc3MnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gY29uZmlndXJhdGlvbiBvZiB0aGUgb2JzZXJ2ZXI6XG4gICAgICAgIHZhciBjb25maWcgPSB7IGF0dHJpYnV0ZXM6IHRydWUgfTtcblxuICAgICAgICAvLyBwYXNzIGluIHRoZSB0YXJnZXQgbm9kZSwgYXMgd2VsbCBhcyB0aGUgb2JzZXJ2ZXIgb3B0aW9uc1xuICAgICAgICBvYnNlcnZlci5vYnNlcnZlKHRoaXMsIGNvbmZpZyk7XG5cbiAgICAgICAgLy8gbGF0ZXIsIHlvdSBjYW4gc3RvcCBvYnNlcnZpbmdcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWQgPSAkKHRoaXMpLmF0dHIoJ2NoZWNrZWQnKSA9PT0gJ2NoZWNrZWQnID8gJ2NoZWNrZWQnIDogJyc7XG4gICAgICAgIGxldCBpbnB1dCA9IGA8aW5wdXQgdHlwZT1cInJhZGlvXCIgbmFtZT1cIiR7JCh0aGlzKS5hdHRyKCduYW1lJykgfHwgJyd9XCIgY2xhc3M9XCIkeyQodGhpcykuYXR0cignaW5wdXQtY2xhc3MnKSB8fCAnJ31cIiAke3NlbGVjdGVkfSB2YWx1ZT1cIiR7JCh0aGlzKS5hdHRyKCd2YWx1ZScpIHx8ICcnfVwiPmA7XG4gICAgICAgIGxldCBvdXQgPVxuICAgICAgICAgICAgYDxsYWJlbCBjbGFzcz1cIiR7JCh0aGlzKS5hdHRyKCdsYWJlbC1jbGFzcycpIHx8ICcnfVwiPiR7aW5wdXR9PHNwYW4+JHskKHRoaXMpLmF0dHIoJ2xhYmVsJykgfHwgJyd9PC9zcGFuPjwvbGFiZWw+YDtcbiAgICAgICAgJCh0aGlzKS5hcHBlbmQob3V0KTtcbiAgICB9O1xuXG4gICAgcHJvdG8uZGV0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgfTtcblxuICAgIGRvY3VtZW50LnJlZ2lzdGVyRWxlbWVudCgnYWUtcmFkaW8nLCB7IHByb3RvdHlwZTogcHJvdG8gfSk7XG59XG4iLCIndXNlIHN0cmljdCc7XG4vKipcbiAqIEJpbmRzIGEgQnVzIGFjdGlvbiB0byB0aGUgcGFyZW50IG5vZGUuXG4gKlxuICogUGFyYW1zIGNhbiBiZSBwYXNzZWQgdGhyb3VnaCB0aGlzIGVsZW1lbnQncyBwYXJhbS14eHggYXR0cmlidXRlc1xuICogVGhlIHBhcmFtIHR5cGVzIGFyZSBpbmZlcnJlZDogbnVtYmVycywgYm9vbGVhbnMsIG51bGwuXG4gKiBJdCBpcyBwb3NzaWJsZSB0byBwYXNzIGFzIGEgcGFyYW0gYSByZWZlcmVuY2UgdG8gIHRoZSBjdXJyZW50IG1vZGVsJ3MgcHJvcGVydHlcbiAqIGJ5IHVzaW5nIGxlYWRpbmcgdGlsZGUgZm9sbG93ZWQgYnkgdGhlIG1vZGVsJ3MgcGF0aC4gRS5nLiBwYXJhbS11c2VyX25hbWU9XCJ+dXNlcl9wcm9maWxlLm5hbWVcIi5cbiAqIFVzaW5nIGp1c3QgYSB0aWxkZSB3aWxsIHBhc3MgdGhlIHdob2xlIG1vZGVsIG9iamVjdC5cbiAqIFRvIGZvcmNlIHZhbHVlcyB0byBiZSBldmFsdWF0ZWQgYXMgc3RyaW5ncywgd3JhcCBwYXJhbSB2YWx1ZSBpbiBiYWNrdGlja3MuIFxuICogRS5nLiBwYXJhbS1zdHJpbmdfdmFsdWU9XCJgMTIzYFwiXG4gKi9cblxuLypcbiAqIElNUFJPVkVNRU5UUzogYXQgdGhlIG1vbWVudCBvbmx5IHRoZSBsb2NhbCBkYXRhIG1vZGVsIGlzIGFsd2F5cyB1c2VkIGZvciBtb2RlbCBwYXRoIHJlc29sdXRpb25cbiAqIEkgc2hvdWxkIGV2YWx1YXRlIHRoZSBvcHRpb24gb2YgcGFzc2luZyB0aGUgYWN0aW9uIGhhbmRsZXIgYSBQcm9taXNlLCBpbiB0aGUgY2FzZSB3aGVyZVxuICogdGhlIHBhdGggcmVzb2x1dGlvbiByZXF1aXJlcyBhbiBhc3luYyBvcGVyYXRpb24uXG4gKiBUaGUgYXBwbGljYXRpb24gc2hvdWxkIGJlIGluZm9ybWVkIG9mIGEgcGVuZGluZyBvcGVyYXRpb24gc28gaXQgY291bGRcbiAqIHNob3cgYSBwcm9ncmVzcyBwYW5lbCwgd2hlcmUgYXBwcm9wcmlhdGVcbiAqIFRoaXMgaW52b2x2ZXMsIGFzaWRlIGZyb20gcGFzc2luZyBhIFByb21pc2UgdG8gdGhlIGFjdGlvbiBoYW5kbGVyLCBcbiAqIHRoZSByZXNvbHV0aW9uIG9mIGFsbCBwYXJhbWV0ZXJzIHRoYXQgY291bGQgcHJvdGVudGlhbGx5IG1ha2VcbiAqIHNlcGFyYXRlIGFzeW5jIG9wZXJhdGlvbnNcbiAqL1xuXG5cbmltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5pbXBvcnQgRWxlbWVudCBmcm9tICcuL2FlLWVsZW1lbnQnO1xuaW1wb3J0IGF0dGFjaEFjdGlvbiBmcm9tICcuLi9kZWxlZ2F0ZS9hY3Rpb24tdHJpZ2dlci1kZWxlZ2F0ZSc7XG5cbmxldCBfcGFnZTtcblxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhY3Rpb24oaW5QYWdlKSB7XG5cbiAgICBfcGFnZSA9IGluUGFnZTtcblxuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoRWxlbWVudC5wcm90b3R5cGUpO1xuXG4gICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICB9O1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBhdHRhY2hBY3Rpb24uY2FsbCh0aGlzLCBfcGFnZSwge1xuICAgICAgICAgICAgbmFtZTogJCh0aGlzKS5hdHRyKCduYW1lJyksXG4gICAgICAgICAgICB0cmlnZ2VyOiAkKHRoaXMpLmF0dHIoJ3RyaWdnZXInKSxcbiAgICAgICAgICAgIHRhcmdldDogJCh0aGlzKS5hdHRyKCd0YXJnZXQnKSxcbiAgICAgICAgICAgIHBhcmFtczogKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJhbXMgPSB7fTtcbiAgICAgICAgICAgICAgICAkKCQodGhpcykuZ2V0KDApLmF0dHJpYnV0ZXMpLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICgvXnBhcmFtLS8udGVzdCh0aGlzLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXNbdGhpcy5uYW1lLnJlcGxhY2UoJ3BhcmFtLScsICcnKV0gPSB0aGlzLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAgICAgIH0pKClcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLWFjdGlvbicsIHsgcHJvdG90eXBlOiBwcm90byB9KTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcbmltcG9ydCB7ZWFjaCwgaW5jbHVkZXN9IGZyb20gJ2xvZGFzaCc7XG5pbXBvcnQgT2JzZXJ2YWJsZU9iamVjdCBmcm9tICcuLi9PYnNlcnZhYmxlT2JqZWN0JztcblxuY2xhc3MgSW5wdXRWYWx1ZUNoYW5nZURlbGVnYXRlIHtcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuXG4gICAgfVxuXG4gICAgY2FuT3V0cHV0VmFsdWUoaW5FbGVtZW50KSB7XG4gICAgICAgIHJldHVybiAoKCEhaW5FbGVtZW50KSAmJiAoXG4gICAgICAgICAgICAkKGluRWxlbWVudCkuZ2V0KDApIGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCB8fFxuICAgICAgICAgICAgJChpbkVsZW1lbnQpLmdldCgwKSBpbnN0YW5jZW9mIEhUTUxUZXh0QXJlYUVsZW1lbnQgfHxcbiAgICAgICAgICAgICQoaW5FbGVtZW50KS5nZXQoMCkgaW5zdGFuY2VvZiBIVE1MU2VsZWN0RWxlbWVudCkpO1xuICAgIH1cblxuICAgIG9uVmFsdWVDaGFuZ2UoaW5FbGVtZW50LCBpbkNvbmZpZywgaW5IYW5kbGVyKSB7XG4gICAgICAgIGNvbnN0IGRlbGF5ID0gIWlzTmFOKGluQ29uZmlnLmRlbGF5KSA/IE51bWJlcihpbkNvbmZpZy5kZWxheSkgOiBudWxsO1xuICAgICAgICBjb25zdCBjb21taXRPbmx5ID0gaW5Db25maWcuY29tbWl0T25seSA9PT0gdHJ1ZTtcbiAgICAgICAgbGV0IGV2ZW50cyA9IGluQ29uZmlnLmV2ZW50O1xuICAgICAgICBpZighZXZlbnRzKSB7XG5cbiAgICAgICAgICAgIHN3aXRjaCAoJChpbkVsZW1lbnQpLmdldCgwKS5ub2RlTmFtZS50b1VwcGVyQ2FzZSgpKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnSU5QVVQnOlxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5jbHVkZXMoWydURVhUJywgJ0VNQUlMJywgJ1RFTCcsICdQQVNTV09SRCddLCAkKGluRWxlbWVudCkuYXR0cigndHlwZScpLnRvVXBwZXJDYXNlKCkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudHMgPSAnY2hhbmdlLGtleXVwJztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpbmNsdWRlcyhbJ0NIRUNLQk9YJywgJ1JBRElPJ10sICQoaW5FbGVtZW50KS5hdHRyKCd0eXBlJykudG9VcHBlckNhc2UoKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50cyA9ICdjbGljayc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnU0VMRUNUJzpcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzID0gJ2NoYW5nZSc7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50cyA9ICdrZXlkb3duJztcbiAgICAgICAgICAgIH1cbn1cbiAgICAgICAgbGV0IGRlbGF5ZWRUaW1lb3V0O1xuXG4gICAgICAgIGNvbnN0IGRlZmF1bHRIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgaW5IYW5kbGVyKHsgdmFsdWU6IHRoaXMuZ2V0VmFsdWUoaW5FbGVtZW50KSwga2V5OiAkKGluRWxlbWVudCkuYXR0cignbmFtZScpIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHRpbWVvdXRIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgZGVmYXVsdEhhbmRsZXIoKTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBkZWxheWVkSGFuZGxlciA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmIChkZWxheWVkVGltZW91dCA9PT0gdW5kZWZpbmVkIHx8ICEhZGVsYXllZFRpbWVvdXQpIHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQoZGVsYXllZFRpbWVvdXQpO1xuICAgICAgICAgICAgICAgIGRlbGF5ZWRUaW1lb3V0ID0gc2V0VGltZW91dCh0aW1lb3V0SGFuZGxlciwgZGVsYXkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZWxheWVkVGltZW91dCA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGltZW91dEhhbmRsZXIoKTtcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgIH07XG5cblxuXG4gICAgICAgIGNvbnN0IGhhbmRsZXIgPSAoIWlzTmFOKGRlbGF5KSA/IGRlbGF5ZWRIYW5kbGVyIDogZGVmYXVsdEhhbmRsZXIpO1xuXG4gICAgICAgIGVhY2goZXZlbnRzLnNwbGl0KCcsJyksIChldmVudE5hbWUpID0+IHtcbiAgICAgICAgICAgICQoaW5FbGVtZW50KS5vZmYoZXZlbnROYW1lLCBoYW5kbGVyKS5vbihldmVudE5hbWUsIGhhbmRsZXIpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBzZXRWYWx1ZShpbkVsZW1lbnQsIGluVmFsdWUsIGluUHJvcE5hbWUpIHtcbiAgICAgICAgaW5FbGVtZW50ID0gJChpbkVsZW1lbnQpO1xuICAgICAgICBpZiAoISQoaW5FbGVtZW50KS5nZXQoMCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBuYW1lID0gaW5FbGVtZW50LmF0dHIoJ25hbWUnKTtcbiAgICAgICAgaWYgKCQoaW5FbGVtZW50KS5nZXQoMCkubm9kZU5hbWUudG9VcHBlckNhc2UoKSA9PT0gJ0lOUFVUJykge1xuICAgICAgICAgICAgc3dpdGNoICgkKGluRWxlbWVudCkuYXR0cigndHlwZScpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgICAgICAgICBjYXNlICd0ZXh0JzpcbiAgICAgICAgICAgICAgICBjYXNlICdlbWFpbCc6XG4gICAgICAgICAgICAgICAgY2FzZSAndGVsJzpcbiAgICAgICAgICAgICAgICBjYXNlICdwYXNzd29yZCc6XG4gICAgICAgICAgICAgICAgICAgIGlmKCQoaW5FbGVtZW50KS52YWwoKSAhPT0gaW5WYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgJChpbkVsZW1lbnQpLnZhbChpblZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdjaGVja2JveCc6XG4gICAgICAgICAgICAgICAgICAgICQoaW5FbGVtZW50KS5wcm9wKCdjaGVja2VkJywgaW5WYWx1ZSA9PT0gdHJ1ZXx8IFxuICAgICAgICAgICAgICAgICAgICBcdCghIWluVmFsdWUgJiYgaW5WYWx1ZSA9PT0gaW5FbGVtZW50LmF0dHIoJ3ZhbHVlJykpKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAncmFkaW8nOlxuICAgICAgICAgICAgICAgICAgICAkKGluRWxlbWVudCkucHJvcCgnY2hlY2tlZCcsIGluVmFsdWUgPT09IGluRWxlbWVudC5hdHRyKCd2YWx1ZScpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKCQoaW5FbGVtZW50KS5nZXQoMCkubm9kZU5hbWUudG9VcHBlckNhc2UoKSA9PT0gJ1NFTEVDVCcpIHtcbiAgICAgICAgICAgICQoaW5FbGVtZW50KS5maW5kKCdvcHRpb25bdmFsdWU9JyArIGluVmFsdWUgKyAnXScpLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgJCh0aGlzKS5wcm9wKCdjaGVja2VkJywgaW5WYWx1ZSA9PT0gaW5FbGVtZW50LmF0dHIoJ3ZhbHVlJykpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGdldFZhbHVlKGluRWxlbWVudCkge1xuICAgICAgICBpZiAoISQoaW5FbGVtZW50KS5nZXQoMCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0YXJnZXRWYWx1ZSA9ICQoaW5FbGVtZW50KS5hdHRyKCd2YWx1ZScpO1xuICAgICAgICBpZiAoJChpbkVsZW1lbnQpLmdldCgwKS5ub2RlTmFtZS50b1VwcGVyQ2FzZSgpID09PSAnSU5QVVQnKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKCQoaW5FbGVtZW50KS5hdHRyKCd0eXBlJykudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ3RleHQnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2VtYWlsJzpcbiAgICAgICAgICAgICAgICBjYXNlICd0ZWwnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ3Bhc3N3b3JkJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICQoaW5FbGVtZW50KS52YWwoKTtcbiAgICAgICAgICAgICAgICBjYXNlICdjaGVja2JveCc6XG4gICAgICAgICAgICAgICAgICAgIGlmICgkKGluRWxlbWVudCkucHJvcCgnY2hlY2tlZCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gISF0YXJnZXRWYWx1ZSA/ICB0YXJnZXRWYWx1ZSA6ICQoaW5FbGVtZW50KS5wcm9wKCdjaGVja2VkJykgPT09IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICEhdGFyZ2V0VmFsdWUgPyBudWxsIDogZmFsc2U7XG4gICAgICAgICAgICAgICAgY2FzZSAncmFkaW8nOiAvL2pzaGludCBpZ25vcmU6bGluZVxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3JtID0gJChpbkVsZW1lbnQpLmNsb3Nlc3QoJ2Zvcm0nKS5nZXQoMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWZvcm0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lucHV0IGVsZW1lbnRzIG11c3QgYmUgZW5jbG9zZWQgaW4gYSBmb3JtJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc2VsZWN0ZWQgPSAkKGZvcm0pLmZpbmQoYHJhZGlvW25hbWU9JHskKGluRWxlbWVudCkuYXR0cignbmFtZScpfV06Y2hlY2tlZGApLmdldCgwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc2VsZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAkKHNlbGVjdGVkKS52YWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYoJChpbkVsZW1lbnQpLmdldCgwKS5ub2RlTmFtZS50b1VwcGVyQ2FzZSgpID09PSAnVEVYVEFSRUEnKSB7XG4gICAgICAgICAgICByZXR1cm4gJChpbkVsZW1lbnQpLnZhbCgpO1xuICAgICAgICB9IGVsc2UgaWYgKCQoaW5FbGVtZW50KS5nZXQoMCkubm9kZU5hbWUudG9VcHBlckNhc2UoKSA9PT0gJ1NFTEVDVCcpIHtcbiAgICAgICAgICAgIGxldCBvdXQgPSBbXTtcbiAgICAgICAgICAgICQoaW5FbGVtZW50KS5maW5kKCdvcHRpb246c2VsZWN0ZWQnKS5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIG91dC5wdXNoKCQodGhpcykudGV4dCgpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIG91dDtcbiAgICAgICAgfVxuICAgIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBuZXcgSW5wdXRWYWx1ZUNoYW5nZURlbGVnYXRlKCk7XG4iLCJpbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IEVsZW1lbnQgZnJvbSAnLi9hZS1lbGVtZW50JztcbmltcG9ydCB7aXNTdHJpbmcsIGVhY2h9IGZyb20gJ2xvZGFzaCc7XG5pbXBvcnQgdmFsdWVDaGFuZ2VEZWxlZ2F0ZSBmcm9tICcuLi9kZWxlZ2F0ZS92YWx1ZS1jaGFuZ2UtZGVsZWdhdGUnO1xuXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGJpbmQoaW5QYWdlKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuICAgIGNvbnN0IF9wYWdlID0gaW5QYWdlO1xuICAgIGNvbnN0IF9wcml2YXRlID0gbmV3IFdlYWtTZXQoKTtcblxuICAgIHZhciBwcm90byA9IE9iamVjdC5jcmVhdGUoRWxlbWVudC5wcm90b3R5cGUpO1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoJCh0aGlzKS5hdHRyKCdwYXRoJykgJiYgKCQodGhpcykuYXR0cignZnJvbScpICYmICQodGhpcykuYXR0cigndG8nKSkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignYWUtYmluZCBhdHRyaWJ1dGUgXCJwYXRoXCIgaXMgaWdub3JlZCB3aGVuIGVpdGhlciBcImZyb21cIiBvciBcInRvXCIgYXJlIHNwZWNpZmllZDogXFxuTm9kZTonKTtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybih0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB0YXJnZXQ7XG4gICAgICAgIGlmICgkKHRoaXMpLmNoaWxkcmVuKCkubGVuZ3RoKSB7XG4gICAgICAgICAgICB0YXJnZXQgPSAkKHRoaXMpLmNoaWxkcmVuKCkuZ2V0KDApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0QXR0ciA9ICQodGhpcykuYXR0cigndGFyZ2V0Jyk7XG4gICAgICAgICAgICBpZiAoIXRhcmdldEF0dHIpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSAkKHRoaXMpLnBhcmVudCgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0YXJnZXRBdHRyID09PSAnbmV4dCcpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSAkKHRoaXMpLm5leHQoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoL15jbG9zZXN0Ly50ZXN0KHRhcmdldEF0dHIpKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2VncyA9IHRhcmdldEF0dHIuc3BsaXQoL1xccysvKTtcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSAkKHRoaXMpLmNsb3Nlc3Qoc2Vnc1sxXSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKC9eKFxcLnxcXCMpLy50ZXN0KHRhcmdldEF0dHIpKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gJCh0aGlzKS5wYXJlbnQoKS5maW5kKHRhcmdldEF0dHIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1Vua25vd24gYWUtYmluZCB0YXJnZXQ6ICcgKyB0YXJnZXRBdHRyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBkYXRhU291cmNlTmFtZSA9ICQodGhpcykuYXR0cignc291cmNlJyk7XG4gICAgICAgIGNvbnN0IHBhdGggPSAkKHRoaXMpLmF0dHIoJ3BhdGgnKTtcbiAgICAgICAgbGV0IGRhdGFTb3VyY2UgPSBfcGFnZS5nZXREYXRhU291cmNlKGRhdGFTb3VyY2VOYW1lKTtcbiAgICAgICAgaWYgKCFkYXRhU291cmNlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBiaW5kIHRvIGRhdGEtc291cmNlOiAnICsgZGF0YVNvdXJjZU5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHVzZVBhdGggPSBwYXRoICYmICEkKHRoaXMpLmF0dHIoJ2Zyb20nKSAmJiAhJCh0aGlzKS5hdHRyKCd0bycpO1xuICAgICAgICBjb25zdCB0b0F0dHIgPSB1c2VQYXRoID8gcGF0aCA6ICQodGhpcykuYXR0cigndG8nKTtcbiAgICAgICAgY29uc3QgZnJvbUF0dHIgPSB1c2VQYXRoID8gcGF0aCA6ICQodGhpcykuYXR0cignZnJvbScpO1xuICAgICAgICBsZXQgaW5BdHRyID0gJCh0aGlzKS5hdHRyKCdpbicpIHx8ICcnO1xuICAgICAgICBjb25zdCBpc0Zvcm1FbGVtZW50ID0gdmFsdWVDaGFuZ2VEZWxlZ2F0ZS5jYW5PdXRwdXRWYWx1ZSh0YXJnZXQpO1xuXG4gICAgICAgIGlmICghaW5BdHRyICYmIGlzRm9ybUVsZW1lbnQpIHtcbiAgICAgICAgICAgIGluQXR0ciA9ICdmb3JtLWVsZW1lbnQtdmFsdWUnO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmcm9tQXR0cikge1xuICAgICAgICAgICAgbGV0IG5vZGVBdHRyID0gaW5BdHRyLnNwbGl0KCc6Jyk7XG4gICAgICAgICAgICBub2RlQXR0clswXSA9IG5vZGVBdHRyWzBdIHx8ICdodG1sJztcblxuICAgICAgICAgICAgaWYgKG5vZGVBdHRyWzBdID09PSAnaHRtbCcpIHtcbiAgICAgICAgICAgICAgICAkKHRhcmdldCkuYXR0cignZGF0YS1hZS1iaW5kLWh0bWwnLCBmcm9tQXR0cik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHZhbHVlUmVzb2x2ZXIgPSAoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBjb25kaXRpb24gPSAkKHRoaXMpLmF0dHIoJ2lmJyk7XG4gICAgICAgICAgICAgICAgbGV0IGNvbmRpdGlvbk1ldCA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKGNvbmRpdGlvbikge1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCBuZWdhdGUgPVxuICAgICAgICAgICAgICAgICAgICAgICAgKCEhY29uZGl0aW9uICYmIC9eIS8udGVzdChjb25kaXRpb24pKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb24gPSBjb25kaXRpb24ucmVwbGFjZSgvXiEvLCAnJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmRpdGlvbiAmJiAvXlxcLy4qXFwvJC8udGVzdChjb25kaXRpb24pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25kaXRpb24gPSBuZXcgUmVnRXhwKGNvbmRpdGlvbi5yZXBsYWNlKC9eXFwvLywgJycpLnJlcGxhY2UoL1xcLyQvLCAnJykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9uTWV0ID0gY29uZGl0aW9uLnRlc3QoaW5WYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNTdHJpbmcoY29uZGl0aW9uKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoL14odHJ1ZXxmYWxzZSkkLy50ZXN0KGNvbmRpdGlvbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25kaXRpb24gPSBCb29sZWFuKGNvbmRpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25NZXQgPSAoY29uZGl0aW9uID09PSBpblZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25NZXQgPSBjb25kaXRpb25NZXQgJiYgIW5lZ2F0ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzd2l0Y2ggKG5vZGVBdHRyWzBdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2h0bWwnOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmRpdGlvbk1ldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQodGFyZ2V0KS5odG1sKGluVmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2F0dHInOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmRpdGlvbk1ldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQodGFyZ2V0KS5hdHRyKG5vZGVBdHRyWzFdLCBpblZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdjbGFzcyc6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29uZGl0aW9uTWV0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCh0YXJnZXQpLmFkZENsYXNzKG5vZGVBdHRyWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCh0YXJnZXQpLnJlbW92ZUNsYXNzKG5vZGVBdHRyWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdmb3JtLWVsZW1lbnQtdmFsdWUnOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmRpdGlvbk1ldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlQ2hhbmdlRGVsZWdhdGUuc2V0VmFsdWUodGFyZ2V0LCBpblZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdJIGRvblxcJ3Qga25vdyBob3cgdG8gYmluZCB2YWx1ZSB0byBlbGVtZW50Jyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBkYXRhU291cmNlLmJpbmRQYXRoKHRoaXMsIGZyb21BdHRyLCBmdW5jdGlvbihpbk5ld1ZhbHVlLCBpbk9sZFZhbHVlKSB7XG4gICAgICAgICAgICAgICAgaWYoaW5OZXdWYWx1ZSAhPT0gaW5PbGRWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZVJlc29sdmVyKGluTmV3VmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkYXRhU291cmNlLnJlc29sdmUodGhpcywgZnJvbUF0dHIpLnRoZW4oKGluVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICB2YWx1ZVJlc29sdmVyKGluVmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0b0F0dHIpIHtcbiAgICAgICAgICAgIGlmICghaXNGb3JtRWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRWxlbWVudCAnICsgJCh0YXJnZXQpLmdldCgwKS5ub2RlTmFtZSArICcgY2Fubm90IGJlIHVzZWQgYXMgYSBzb3VyY2Ugb2YgYmluZGluZyBvdXRwdXQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG91dE9wdGlvbnMgPSB7fTtcbiAgICAgICAgICAgIGVhY2godGhpcy5hdHRyaWJ1dGVzLCAoaW5BdHRyaWJ1dGUpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoL15vdXQtLy50ZXN0KGluQXR0cmlidXRlLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIG91dE9wdGlvbnNbaW5BdHRyaWJ1dGUubmFtZS5yZXBsYWNlKC9eb3V0LS8sICcnKV0gPSBpbkF0dHJpYnV0ZS52YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHZhbHVlQ2hhbmdlRGVsZWdhdGUub25WYWx1ZUNoYW5nZSh0YXJnZXQsIG91dE9wdGlvbnMsIChpblZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgZGF0YVNvdXJjZS5zZXRQYXRoKHRoaXMsIHRvQXR0ciwgaW5WYWx1ZS52YWx1ZSA9PSBudWxsID8gbnVsbCA6IGluVmFsdWUudmFsdWUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuXG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLWJpbmQnLCB7IHByb3RvdHlwZTogcHJvdG8gfSk7XG59XG4iLCJpbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IG1pY3JvdGFzayBmcm9tICcuLi9taWNyb3Rhc2snO1xuaW1wb3J0IEVsZW1lbnQgZnJvbSAnLi9hZS1lbGVtZW50JztcbmltcG9ydCBmYWN0b3J5IGZyb20gJy4uL3BhZ2UtZmFjdG9yeSc7XG5pbXBvcnQgT2JzZXJ2YWJsZSBmcm9tICcuLi9PYnNlcnZhYmxlJztcbmltcG9ydCB7IHRyYW5zZm9ybSB9IGZyb20gJ2xvZGFzaCc7XG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByZW5kZXIoaW5QYWdlKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuICAgIGNvbnN0IF9wcml2YXRlID0gbmV3IFdlYWtNYXAoKTtcbiAgICBjb25zdCBfcGFnZSA9IGluUGFnZTtcbiAgICB2YXIgcHJvdG8gPSBPYmplY3QuY3JlYXRlKEVsZW1lbnQucHJvdG90eXBlKTtcblxuICAgIGNvbnN0IGludmFsaWRhdGUgPSBmdW5jdGlvbiBpbnZhbGlkYXRlKCkge1xuICAgICAgICBpZiAoIV9wcml2YXRlLmdldCh0aGlzKS53aWxsUmVuZGVyKSB7XG4gICAgICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykud2lsbFJlbmRlciA9IHRydWU7XG4gICAgICAgICAgICBtaWNyb3Rhc2socmVuZGVyLmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHZhciByZW5kZXIgPSBmdW5jdGlvbiByZW5kZXIoKSB7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS53aWxsUmVuZGVyID0gZmFsc2U7XG4gICAgICAgIGlmICgkKHRoaXMpLmF0dHIoJ2RlYnVnLW5hbWUnKSkge1xuICAgICAgICAgICAgY29uc29sZS5pbmZvKCQodGhpcykuYXR0cignZGVidWctbmFtZScpICsgJyB3aWxsIHJlbmRlcicpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHRlbXBsYXRlTmFtZSA9ICQodGhpcykuYXR0cigndGVtcGxhdGUnKTtcblxuICAgICAgICBjb25zdCBwYXRoID0gJCh0aGlzKS5hdHRyKCdmcm9tJykgfHwgJy4nO1xuICAgICAgICBfcGFnZS5nZXREYXRhU291cmNlKCkucmVzb2x2ZSh0aGlzLCBwYXRoKS50aGVuKChpblZhbHVlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBhdHRycyA9IHRyYW5zZm9ybSh0aGlzLmF0dHJpYnV0ZXMsIGZ1bmN0aW9uKHJlc3VsdCwgaXRlbSkge1xuICAgICAgICAgICAgICAgIGl0ZW0uc3BlY2lmaWVkICYmIC9ecGFyYW0tLy50ZXN0KGl0ZW0ubmFtZSkgJiYgKHJlc3VsdFtpdGVtLm5hbWUucmVwbGFjZSgncGFyYW0tJywgJycpXSA9IGl0ZW0udmFsdWUpOyAvL2pzaGludCBpZ25vcmU6bGluZVxuICAgICAgICAgICAgfSwge30pO1xuXG4gICAgICAgICAgICBmYWN0b3J5LmdldFRlbXBsYXRpbmdEZWxlZ2F0ZSgpXG4gICAgICAgICAgICAgICAgLnJlbmRlcih0ZW1wbGF0ZU5hbWUsIGluVmFsdWUgfHwge30pXG4gICAgICAgICAgICAgICAgLnRoZW4oKGluSHRtbCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAkKHRoaXMpLmZpbmQoJz5hZS1tYW5hZ2VkJykuaHRtbChpbkh0bWwpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKChpbkVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoaW5FcnJvcik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pLmNhdGNoKChpbkVycm9yKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGluRXJyb3IpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIHByb3RvLmNyZWF0ZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBfcHJpdmF0ZS5zZXQodGhpcywgeyB3aWxsUmVuZGVyOiB0cnVlIH0pO1xuICAgICAgICBsZXQgdGVtcGxhdGVOYW1lID0gJCh0aGlzKS5hdHRyKCd0ZW1wbGF0ZScpO1xuICAgICAgICBpZiAoIXRlbXBsYXRlTmFtZSkge1xuICAgICAgICAgICAgbGV0IHRlbXBsYXRlID0gJCh0aGlzKS5maW5kKCc+dGVtcGxhdGUnKTtcbiAgICAgICAgICAgIGlmICghdGVtcGxhdGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJCh0aGlzKS5nZXRQYXRoKCkgKyAnIG11c3QgaGF2ZSBhIHRlbXBsYXRlIGF0dHJpYnV0ZSBvciBhIHRlbXBsYXRlIGVsZW1lbnQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRlbXBsYXRlTmFtZSA9IGZhY3RvcnkuZ2V0VGVtcGxhdGluZ0RlbGVnYXRlKClcbiAgICAgICAgICAgICAgICAucmVnaXN0ZXJUZW1wbGF0ZSh0ZW1wbGF0ZS5odG1sKCkpO1xuICAgICAgICAgICAgJCh0aGlzKS5hdHRyKCd0ZW1wbGF0ZScsIHRlbXBsYXRlTmFtZSk7XG4gICAgICAgICAgICAkKHRoaXMpLmVtcHR5KCk7XG4gICAgICAgIH1cbiAgICAgICAgJCh0aGlzKS5hcHBlbmQoJzxhZS1tYW5hZ2VkPjwvYWUtbWFuYWdlZD4nKTtcbiAgICB9O1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIGludmFsaWRhdGUuY2FsbCh0aGlzKTtcbiAgICAgICAgdmFyIG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4ge1xuICAgICAgICAgICAgbXV0YXRpb25zLmZvckVhY2goKG11dGF0aW9uKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKC9ecGFyYW0tLy50ZXN0KG11dGF0aW9uLmF0dHJpYnV0ZU5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGludmFsaWRhdGUuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gY29uZmlndXJhdGlvbiBvZiB0aGUgb2JzZXJ2ZXI6XG4gICAgICAgIHZhciBjb25maWcgPSB7IGF0dHJpYnV0ZXM6IHRydWUgfTtcblxuICAgICAgICAvLyBwYXNzIGluIHRoZSB0YXJnZXQgbm9kZSwgYXMgd2VsbCBhcyB0aGUgb2JzZXJ2ZXIgb3B0aW9uc1xuICAgICAgICBvYnNlcnZlci5vYnNlcnZlKHRoaXMsIGNvbmZpZyk7XG5cbiAgICAgICAgY29uc3QgcGF0aCA9ICQodGhpcykuYXR0cignZnJvbScpO1xuICAgICAgICBfcGFnZS5nZXREYXRhU291cmNlKCkuYmluZFBhdGgodGhpcywgcGF0aCwgKGluQmFzZU1vZGVsKSA9PiB7XG5cbiAgICAgICAgICAgIGlmIChpbkJhc2VNb2RlbCBpbnN0YW5jZW9mIE9ic2VydmFibGUpIHtcbiAgICAgICAgICAgICAgICBpbkJhc2VNb2RlbC53YXRjaChwYXRoLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGludmFsaWRhdGUuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaW52YWxpZGF0ZS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaW52YWxpZGF0ZS5jYWxsKHRoaXMpO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKCQodGhpcykuYXR0cignd2F0Y2gnKSkge1xuICAgICAgICAgICAgX3BhZ2UuZ2V0RGF0YVNvdXJjZSgpLmJpbmRQYXRoKHRoaXMsICQodGhpcykuYXR0cignd2F0Y2gnKSwgKGluQmFzZU1vZGVsKSA9PiB7XG5cbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhpbkJhc2VNb2RlbCBpbnN0YW5jZW9mIE9ic2VydmFibGUgPyBpbkJhc2VNb2RlbC50b05hdGl2ZSh0cnVlKSA6IGluQmFzZU1vZGVsKTtcbiAgICAgICAgICAgICAgICBpbnZhbGlkYXRlLmNhbGwodGhpcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblxuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLXJlbmRlcicsIHsgcHJvdG90eXBlOiBwcm90byB9KTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcbmltcG9ydCBFbGVtZW50IGZyb20gJy4vYWUtZWxlbWVudCc7XG5pbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuXG4vKipcbiogICBBIGNvbnRhaW5lciBmb3IgZWxlbWVudCB0aGF0IGNoYW5nZSB0aGUgdmFsdWUgb2YgYSBwcm9wZXJ0eSBiYXNlZCBvbiBcbiogICBzZWxlY3Rpb24gb2YgaXRzIGNoaWxkcmVuLiBJdCBiZWhhdmVzIGxpa2UgYSByYWRpbyBncm91cC5cbiogICBpZiBubyBwYXRoIGF0dHJpYnV0ZSBpcyBmb3VuZCwgdGhlIHN3aXRjaCB0YXJnZXRzIHRoZSBjb21wb25lbnQncyBzdGF0ZVxuKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGFlU3dpdGNoKGluUGFnZSkge1xuICAgIGNvbnN0IF9wYWdlID0gaW5QYWdlO1xuICAgIGNvbnN0IF9wcml2YXRlID0gbmV3IFdlYWtNYXAoKTtcblxuICAgIGNvbnN0IHNlbGVjdEhhbmRsZXIgPSBmdW5jdGlvbiBzZWxlY3RIYW5kbGVyKGluU2VsZWN0ZWRFbGVtZW50KSB7XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgICAgICBjb25zdCB2YWwgPSAkKGluU2VsZWN0ZWRFbGVtZW50KS5kYXRhKCdhZS1zd2l0Y2gtdmFsdWUnKTtcbiAgICAgICAgJCh0aGlzKS5jaGlsZHJlbigpLnJlbW92ZUNsYXNzKF9wLnNlbGVjdGVkQ2xhc3MpO1xuICAgICAgICAkKGluU2VsZWN0ZWRFbGVtZW50KS5hZGRDbGFzcyhfcC5zZWxlY3RlZENsYXNzKTtcbiAgICAgICAgaWYoIV9wLnNvdXJjZSkge1xuICAgICAgICAgICAgX3AudGFyZ2V0LnRyeVN0YXRlKHZhbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfcGFnZS5yZXNvbHZlTm9kZUNvbXBvbmVudCh0aGlzKTtcbiAgICAgICAgICAgIF9wYWdlLmdldERhdGFTb3VyY2UoKS5zZXRQYXRoKHRoaXMsIF9wLnNvdXJjZSwgdmFsKTtcblxuICAgICAgICB9XG4gICAgICAgIC8vY29uc29sZS5sb2coJ3N3aXRjaCBlbGVtZW50IGNsaWNrZWQ6ICcgKyAkKGluU2VsZWN0ZWRFbGVtZW50KS5kYXRhKCdhZS1zd2l0Y2gtdmFsdWUnKSk7XG4gICAgfTtcbiAgICBcbiAgICB2YXIgcHJvdG8gPSBPYmplY3QuY3JlYXRlKEVsZW1lbnQucHJvdG90eXBlKTtcbiAgICBwcm90by5jcmVhdGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgX3ByaXZhdGUuc2V0KHRoaXMsIHtcbiAgICAgICAgICAgIHNlbGVjdGVkQ2xhc3M6ICQodGhpcykuYXR0cignc2VsZWN0ZWQtY2xhc3MnKSB8fCAnc2VsZWN0ZWQnLFxuICAgICAgICAgICAgc291cmNlIDogJCh0aGlzKS5hdHRyKCdwYXRoJykgfHwgbnVsbFxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIFxuICAgIHByb3RvLmF0dGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XG4gICAgICAgIGNvbnN0IF9wID0gX3ByaXZhdGUuZ2V0KHRoaXMpO1xuICAgICAgICBfcC50YXJnZXQgPSBfcGFnZS5yZXNvbHZlTm9kZUNvbXBvbmVudCh0aGlzKTtcbiAgICAgICAgbGV0IGRlZmF1bHRTd2l0Y2g7XG4gICAgICAgICQodGhpcykuY2hpbGRyZW4oKS5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYoJCh0aGlzKS5kYXRhKCdhZS1zd2l0Y2gtdmFsdWUnKSA9PT0gJCh0aGF0KS5hdHRyKCdkZWZhdWx0LXZhbHVlJykpIHtcbiAgICAgICAgICAgICAgICBkZWZhdWx0U3dpdGNoID0gJCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICQodGhpcykub2ZmKCdjbGljaycsIHNlbGVjdEhhbmRsZXIpLm9uKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgICAgICBzZWxlY3RIYW5kbGVyLmNhbGwodGhhdCwgdGhpcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmKGRlZmF1bHRTd2l0Y2gpIHtcbiAgICAgICAgICAgICAgICBzZWxlY3RIYW5kbGVyLmNhbGwodGhhdCwgZGVmYXVsdFN3aXRjaCk7XG4gICAgICAgICAgICB9XG4gICAgICAgfSlcbiAgICB9O1xuXG4gICAgcHJvdG8uZGV0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgfTtcblxuICAgIGRvY3VtZW50LnJlZ2lzdGVyRWxlbWVudCgnYWUtc3dpdGNoJywgeyBwcm90b3R5cGU6IHByb3RvIH0pO1xufVxuIiwiaW1wb3J0ICQgZnJvbSAnanF1ZXJ5JztcbmltcG9ydCBFbGVtZW50IGZyb20gJy4vYWUtZWxlbWVudCc7XG5pbXBvcnQgeyBlYWNoIH0gZnJvbSAnbG9kYXNoJztcbmltcG9ydCB1dWlkIGZyb20gJ25vZGUtdXVpZCc7XG5pbXBvcnQgYXR0YWNoQWN0aW9uIGZyb20gJy4uL2RlbGVnYXRlL2FjdGlvbi10cmlnZ2VyLWRlbGVnYXRlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYWVUZXh0SW5wdXQoaW5QYWdlKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuICAgIGNvbnN0IF9wYWdlID0gaW5QYWdlO1xuICAgIGxldCBvYnNlcnZlcjtcbiAgICBkb2N1bWVudC5zdHlsZVNoZWV0c1swXS5pbnNlcnRSdWxlKCdhZS1pbnB1dCcgKyAneyBkaXNwbGF5OiBibG9jazt9JywgMSk7XG4gICAgdmFyIHByb3RvID0gT2JqZWN0LmNyZWF0ZShFbGVtZW50LnByb3RvdHlwZSk7XG4gICAgcHJvdG8uY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihmdW5jdGlvbihtdXRhdGlvbnMpIHtcbiAgICAgICAgICAgIG11dGF0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKG11dGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChtdXRhdGlvbi5hdHRyaWJ1dGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2xhYmVsJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICQobXV0YXRpb24udGFyZ2V0KS5maW5kKCdsYWJlbD5zcGFuJykudGV4dCgkKG11dGF0aW9uLnRhcmdldCkuYXR0cignbGFiZWwnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAndmFsdWUnOlxuICAgICAgICAgICAgICAgICAgICAgICAgJChtdXRhdGlvbi50YXJnZXQpLmZpbmQoJ2lucHV0JykuYXR0cigndmFsdWUnLCAkKG11dGF0aW9uLnRhcmdldCkuYXR0cigndmFsdWUnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbGFiZWwtY2xhc3MnOlxuICAgICAgICAgICAgICAgICAgICAgICAgJChtdXRhdGlvbi50YXJnZXQpLmZpbmQoJ2xhYmVsJykuYXR0cignY2xhc3MnLCAkKG11dGF0aW9uLnRhcmdldCkuYXR0cignbGFiZWwtY2xhc3MnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnaW5wdXQtY2xhc3MnOlxuICAgICAgICAgICAgICAgICAgICAgICAgJChtdXRhdGlvbi50YXJnZXQpLmZpbmQoJ2lucHV0JykuYXR0cignY2xhc3MnLCAkKG11dGF0aW9uLnRhcmdldCkuYXR0cignaW5wdXQtY2xhc3MnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKCQodGhpcykuYXR0cignYmluZC1lbmFibGVkJykpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhdGggPSAkKHRoaXMpLmF0dHIoJ2JpbmQtZW5hYmxlZCcpLnJlcGxhY2UoJyEnLCAnJyk7XG4gICAgICAgICAgICBjb25zdCBuZWdhdGUgPSAvXiEvLnRlc3QoJCh0aGlzKS5hdHRyKCdiaW5kLWVuYWJsZWQnKSk7XG4gICAgICAgICAgICBjb25zdCBzb3VyY2UgPSAkKHRoaXMpLmF0dHIoJ3NvdXJjZScpO1xuICAgICAgICAgICAgY29uc3Qgc2V0VmFsdWUgPSAoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICQodGhpcykuZmluZCgnaW5wdXQnKS5wcm9wKCdkaXNhYmxlZCcsXG4gICAgICAgICAgICAgICAgICAgICgoaW5WYWx1ZSA9PT0gZmFsc2UpICYmICFuZWdhdGUpIHx8XG4gICAgICAgICAgICAgICAgICAgICgoaW5WYWx1ZSAhPT0gZmFsc2UpICYmIG5lZ2F0ZSkpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgX3BhZ2VcbiAgICAgICAgICAgICAgICAuZ2V0RGF0YVNvdXJjZShzb3VyY2UpXG4gICAgICAgICAgICAgICAgLmJpbmRQYXRoKHRoaXMsIHBhdGgsIChpbk5ld1ZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHNldFZhbHVlKGluTmV3VmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgX3BhZ2VcbiAgICAgICAgICAgICAgICAuZ2V0RGF0YVNvdXJjZShzb3VyY2UpXG4gICAgICAgICAgICAgICAgLnJlc29sdmUodGhpcywgcGF0aClcbiAgICAgICAgICAgICAgICAudGhlbigoaW5WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBzZXRWYWx1ZShpblZhbHVlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy8gY29uZmlndXJhdGlvbiBvZiB0aGUgb2JzZXJ2ZXI6XG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IHsgYXR0cmlidXRlczogdHJ1ZSB9O1xuICAgICAgICAvLyBwYXNzIGluIHRoZSB0YXJnZXQgbm9kZSwgYXMgd2VsbCBhcyB0aGUgb2JzZXJ2ZXIgb3B0aW9uc1xuICAgICAgICBvYnNlcnZlci5vYnNlcnZlKHRoaXMsIGNvbmZpZyk7XG4gICAgICAgIGNvbnN0IGlucHV0VHlwZSA9ICQodGhpcykuYXR0cigndHlwZScpIHx8ICd0ZXh0JztcbiAgICAgICAgaWYgKC9eKGNoZWNrYm94fHJhZGlvKSQvLnRlc3QoaW5wdXRUeXBlLnRvTG93ZXJDYXNlKCkpKSB7XG4gICAgICAgICAgICBjb25zdCBhY3Rpb25OYW1lID0gJCh0aGlzKS5hdHRyKCdhY3Rpb24nKTtcbiAgICAgICAgICAgIGlmIChhY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICAgICAgYXR0YWNoQWN0aW9uLmNhbGwodGhpcywgX3BhZ2UsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogYWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgdHJpZ2dlcjogJ2NsaWNrJyxcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiAnc2VsZidcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGxldCBiaW5kaW5nQXR0ck5hbWU7XG4gICAgICAgIGVhY2goJCh0aGlzLmF0dHJpYnV0ZXMpLCAoaW5BdHRyaWJ1dGUpID0+IHtcbiAgICAgICAgICAgIGlmIChbJ2Zyb20nLCAndG8nLCAncGF0aCddLmluZGV4T2YoaW5BdHRyaWJ1dGUubmFtZSkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgYmluZGluZ0F0dHJOYW1lID0gaW5BdHRyaWJ1dGUubmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGxldCBiaW5kaW5nTm9kZSA9ICcnO1xuICAgICAgICBpZiAoYmluZGluZ0F0dHJOYW1lKSB7XG4gICAgICAgICAgICBjb25zdCBkZWxheUF0dHIgPSAkKHRoaXMpLmF0dHIoJ291dC1kZWxheScpID8gYG91dC1kZWxheT1cIiR7JCh0aGlzKS5hdHRyKCdvdXQtZGVsYXknKX1cImAgOiAnJztcbiAgICAgICAgICAgIGJpbmRpbmdOb2RlID0gYmluZGluZ0F0dHJOYW1lID8gYDxhZS1iaW5kICR7ZGVsYXlBdHRyfSB0YXJnZXQ9XCJuZXh0XCIgJHtiaW5kaW5nQXR0ck5hbWV9PVwiJHskKHRoaXMpLmF0dHIoYmluZGluZ0F0dHJOYW1lKX1cIj48L2FlLWJpbmQ+YCA6ICcnO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGxhYmVsUGxhY2VtZW50ID0gJCh0aGlzKS5hdHRyKCdsYWJlbC1wbGFjZW1lbnQnKSB8fCAnbGVmdCc7XG4gICAgICAgIGNvbnN0IGxhYmVsVGV4dCA9ICQodGhpcykuYXR0cignbGFiZWwnKTtcbiAgICAgICAgY29uc3QgYXV0b2NvbXBsZXRlID0gJCh0aGlzKS5hdHRyKCdhdXRvY29tcGxldGUnKSA/XG4gICAgICAgICAgICAnIGF1dG9jb21wbGV0ZT1cIicgKyAkKHRoaXMpLmF0dHIoJ2F1dG9jb21wbGV0ZScpICsgJ1wiJyA6XG4gICAgICAgICAgICAnJztcbiAgICAgICAgY29uc3QgcGxhY2Vob2xkZXIgPSAkKHRoaXMpLmF0dHIoJ3BsYWNlaG9sZGVyJykgfHwgJyc7XG4gICAgICAgIGNvbnN0IGlucHV0Q2xhc3MgPSAkKHRoaXMpLmF0dHIoJ2lucHV0LWNsYXNzJykgfHwgJyc7XG4gICAgICAgIGNvbnN0IGRpc2FibGVkID0gISgkKHRoaXMpLmF0dHIoJ2VuYWJsZWQnKSAhPT0gJ2ZhbHNlJyAmJiB0cnVlKSA/ICdkaXNhYmxlZCcgOiAnJztcbiAgICAgICAgY29uc3QgaW5wdXROYW1lID0gJCh0aGlzKS5hdHRyKCduYW1lJykgfHwgJ2FlLScgKyB1dWlkLnY0KCk7XG4gICAgICAgIGNvbnN0IHZhbHVlQXR0ciA9ICQodGhpcykuYXR0cigndmFsdWUnKSA/IGB2YWx1ZT1cIiR7JCh0aGlzKS5hdHRyKCd2YWx1ZScpfWAgOiAnJztcbiAgICAgICAgY29uc3QgaW5wdXQgPSBgPGlucHV0IG5hbWU9XCIke2lucHV0TmFtZX1cIiAke2Rpc2FibGVkfSB0eXBlPVwiJHtpbnB1dFR5cGV9XCIgJHthdXRvY29tcGxldGV9IGNsYXNzPVwiJHtpbnB1dENsYXNzfVwiIHBsYWNlaG9sZGVyPVwiJHtwbGFjZWhvbGRlcn1cIiAke3ZhbHVlQXR0cn0+YDtcbiAgICAgICAgY29uc3QgbGFiZWwgPSBsYWJlbFRleHQgPyBgPGxhYmVsIGZvcj1cIiR7aW5wdXROYW1lfVwiIGNsYXNzPVwiJHskKHRoaXMpLmF0dHIoJ2xhYmVsLWNsYXNzJykgfHwgJyd9XCI+JHtsYWJlbFRleHR9PC9sYWJlbD5gIDogJyc7XG5cbiAgICAgICAgJCh0aGlzKS5hcHBlbmQoYCR7bGFiZWxQbGFjZW1lbnQgPT09ICdsZWZ0Jz8gbGFiZWwgOiAnJ30ke2JpbmRpbmdOb2RlfSR7aW5wdXR9JHtsYWJlbFBsYWNlbWVudCA9PT0gJ3JpZ2h0Jz8gbGFiZWwgOiAnJ31gKTtcbiAgICB9O1xuXG4gICAgcHJvdG8uYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXG4gICAgfTtcblxuICAgIHByb3RvLmRldGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgIH07XG5cbiAgICBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2FlLWlucHV0JywgeyBwcm90b3R5cGU6IHByb3RvIH0pO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuXG4kLmZuLmV4dGVuZCh7XG4gICAgZ2V0UGF0aDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcGF0aCwgbm9kZSA9IHRoaXM7XG4gICAgICAgIHdoaWxlIChub2RlLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIHJlYWxOb2RlID0gbm9kZVswXSwgbmFtZSA9IHJlYWxOb2RlLmxvY2FsTmFtZTtcbiAgICAgICAgICAgIGlmICghbmFtZSkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmFtZSA9IG5hbWUudG9Mb3dlckNhc2UoKTtcblxuICAgICAgICAgICAgdmFyIHBhcmVudCA9IG5vZGUucGFyZW50KCk7XG5cbiAgICAgICAgICAgIHZhciBzYW1lVGFnU2libGluZ3MgPSBwYXJlbnQuY2hpbGRyZW4obmFtZSk7XG4gICAgICAgICAgICBpZiAoc2FtZVRhZ1NpYmxpbmdzLmxlbmd0aCA+IDEpIHsgXG4gICAgICAgICAgICAgICAgbGV0IGFsbFNpYmxpbmdzID0gcGFyZW50LmNoaWxkcmVuKCk7XG4gICAgICAgICAgICAgICAgbGV0IGluZGV4ID0gYWxsU2libGluZ3MuaW5kZXgocmVhbE5vZGUpICsgMTtcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWUgKz0gJzpudGgtY2hpbGQoJyArIGluZGV4ICsgJyknO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcGF0aCA9IG5hbWUgKyAocGF0aCA/ICc+JyArIHBhdGggOiAnJyk7XG4gICAgICAgICAgICBub2RlID0gcGFyZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgfVxufSk7XG5cbmltcG9ydCBhZU1hbmFnZWQgZnJvbSAnLi9hZS1tYW5hZ2VkJztcbmltcG9ydCBhZUJ1dHRvbiBmcm9tICcuL2FlLWJ1dHRvbic7XG5pbXBvcnQgYWVFYWNoIGZyb20gJy4vYWUtZWFjaCc7XG5pbXBvcnQgYWVTdGF0ZSBmcm9tICcuL2FlLXN0YXRlJztcbmltcG9ydCBhZUNoZWNrYm94IGZyb20gJy4vYWUtY2hlY2tib3gnO1xuaW1wb3J0IGFlUmFkaW8gZnJvbSAnLi9hZS1yYWRpbyc7XG5pbXBvcnQgYWVBY3Rpb24gZnJvbSAnLi9hZS1hY3Rpb24nO1xuaW1wb3J0IGFlQmluZCBmcm9tICcuL2FlLWJpbmQnO1xuaW1wb3J0IGFlUmVuZGVyIGZyb20gJy4vYWUtcmVuZGVyJztcbmltcG9ydCBhZVN3aXRjaCBmcm9tICcuL2FlLXN3aXRjaCc7XG5pbXBvcnQgYWVUZXh0SW5wdXQgZnJvbSAnLi9hZS1pbnB1dCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKGluUGFnZSkge1xuXG4gICAgYWVCdXR0b24oaW5QYWdlKTtcbiAgICBhZU1hbmFnZWQoaW5QYWdlKTtcbiAgICBhZUVhY2goaW5QYWdlKTtcbiAgICBhZVN0YXRlKGluUGFnZSk7XG4gICAgYWVDaGVja2JveChpblBhZ2UpO1xuICAgIGFlUmFkaW8oaW5QYWdlKTtcbiAgICBhZUFjdGlvbihpblBhZ2UpO1xuICAgIGFlQmluZChpblBhZ2UpO1xuICAgIGFlUmVuZGVyKGluUGFnZSk7XG4gICAgYWVTd2l0Y2goaW5QYWdlKTtcbiAgICBhZVRleHRJbnB1dChpblBhZ2UpO1xufVxuXG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCBDb21wb25lbnQgZnJvbSAnLi9jb21wb25lbnQnO1xuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJztcbmltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5cbmltcG9ydCBtb2RlbERhdGFTb3VyY2UgZnJvbSAnLi9kYXRhc291cmNlL21vZGVsLWRhdGFzb3VyY2UnO1xuY29uc3QgX2RhdGFTb3VyY2VzID0gbmV3IE1hcCgpO1xuaW1wb3J0IGxhbmcgZnJvbSAnLi9sYW5nL2FlLWxhbmcnO1xuaW1wb3J0IGZhY3RvcnkgZnJvbSAnLi9wYWdlLWZhY3RvcnknO1xuaW1wb3J0IENvbXBvbmVudExpZmVjeWNsZSBmcm9tICcuL0NvbXBvbmVudExpZmVjeWNsZSc7XG5pbXBvcnQgcHJpdmF0ZUhhc2ggZnJvbSAnLi91dGlsL3ByaXZhdGUnO1xuXG5jb25zdCBfcHJpdmF0ZSA9IHByaXZhdGVIYXNoKCdjb21wb25lbnQnKTtcblxubGV0IF9yZWdpc3RyeSA9IG5ldyBXZWFrTWFwKCk7XG5sZXQgX3RlbXBsYXRpbmdEZWxlZ2F0ZTtcblxuY29uc3QgX2luaXRpYWxpemVycyA9IFtdO1xuY29uc3QgX2NvbXBvbmVudEluamVjdG9ycyA9IFtdO1xuXG5sZXQgX2NvbmZpZztcblxuY29uc3QgY2FsbE5leHRJbml0aWFsaXplciA9IGZ1bmN0aW9uKCkge1xuICAgIGxldCBpbml0aWFsaXplciA9IF9pbml0aWFsaXplcnMuc2hpZnQoKTtcbiAgICBpZiAoIWluaXRpYWxpemVyKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbGV0IHJlc3VsdCA9IGluaXRpYWxpemVyLmNhbGwodGhpcyk7XG4gICAgbGV0IHJlc3VsdEhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICAgIGxldCBmbjtcbiAgICAgICAgd2hpbGUgKGZuID0gX2NvbmZpZy5jb21wb25lbnRzLnNoaWZ0KCkpIHsgLy9qc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgICAgICAgIGZuKHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChfaW5pdGlhbGl6ZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgY2FsbE5leHRJbml0aWFsaXplci5jYWxsKHRoaXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgJCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5ub2RlID0gJCh0aGlzLm1vdW50UG9pbnQpO1xuICAgICAgICAgICAgICAgIGxhbmcodGhpcyk7XG4gICAgICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgIC5saWZlY3ljbGVTaWduYWwuZGlzcGF0Y2goJ2VsZW1lbnQtY3JlYXRlZCcpO1xuICAgICAgICAgICAgICAgIF9wcml2YXRlLmdldCh0aGlzKVxuICAgICAgICAgICAgICAgICAgICAubGlmZWN5Y2xlU2lnbmFsLmRpc3BhdGNoKCdlbGVtZW50LWF0dGFjaGVkJyk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXIoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICByZXN1bHQudGhlbihyZXN1bHRIYW5kbGVyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHRIYW5kbGVyKCk7XG4gICAgfVxuXG59O1xuXG5jbGFzcyBQYWdlIGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICBjb25zdHJ1Y3RvcihpbkNvbmZpZywgaW5Nb2RlbFByb3RvdHlwZSwgaW5Db25zdHJ1Y3Rvcikge1xuICAgICAgICBzdXBlcihpbkNvbmZpZywgaW5Nb2RlbFByb3RvdHlwZSk7XG4gICAgICAgIF9jb25maWcgPSBpbkNvbmZpZztcbiAgICAgICAgdGhpcy5tb3VudFBvaW50ID0gaW5Db25maWcubW91bnRQb2ludCB8fCAnYm9keSc7XG4gICAgICAgIHRoaXMuYWRkRGF0YVNvdXJjZSgnbW9kZWwnLCBtb2RlbERhdGFTb3VyY2UodGhpcykpO1xuICAgICAgICBpbkNvbnN0cnVjdG9yLmJpbmQodGhpcykoKTtcbiAgICAgICAgdGhpcy5wYWdlID0gdGhpcztcbiAgICAgICAgY2FsbE5leHRJbml0aWFsaXplci5jYWxsKHRoaXMpO1xuICAgIH1cblxuXG4gICAgcmVzb2x2ZU5vZGVNb2RlbChpbk5vZGUsIGluUGF0aCkge1xuICAgICAgICBsZXQgY29tcG9uZW50ID0gdGhpcy5yZXNvbHZlTm9kZUNvbXBvbmVudChpbk5vZGUpO1xuICAgICAgICBpZighY29tcG9uZW50Lmhhc01vZGVsKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yZXNvbHZlTm9kZU1vZGVsKCQoY29tcG9uZW50Lm5vZGUpLnBhcmVudCgpLCBpblBhdGgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb21wb25lbnQubW9kZWw7XG4gICAgfVxuXG4gICAgcmVzb2x2ZU5vZGVDb21wb25lbnQoaW5Ob2RlKSB7XG4gICAgICAgIGxldCBub2RlID0gJChpbk5vZGUpLmdldCgwKTtcbiAgICAgICAgd2hpbGUgKCFfcmVnaXN0cnkuZ2V0KG5vZGUpKSB7XG4gICAgICAgICAgICBub2RlID0gJChub2RlKS5wYXJlbnQoKS5nZXQoMCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIV9yZWdpc3RyeS5nZXQobm9kZSkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZGVidWcoJ0NvdWxkIG5vdCBmaW5kIGNvbXBvbmVudCBpbiBhbmNlc3RyeS4gRmFsbGluZyBiYWNrIHRvIHBhZ2UgY29tcG9uZW50Jyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gX3JlZ2lzdHJ5LmdldChub2RlKTtcblxuICAgIH1cblxuICAgIGFkZERhdGFTb3VyY2UoaW5OYW1lLCBpbkluaXRGdW5jdGlvbikge1xuICAgICAgICBfZGF0YVNvdXJjZXMuc2V0KGluTmFtZSwgaW5Jbml0RnVuY3Rpb24odGhpcykpO1xuICAgIH1cblxuICAgIGdldERhdGFTb3VyY2UoaW5OYW1lKSB7XG4gICAgICAgIGluTmFtZSA9IGluTmFtZSB8fCAnbW9kZWwnO1xuICAgICAgICByZXR1cm4gX2RhdGFTb3VyY2VzLmdldChpbk5hbWUpO1xuICAgIH1cblxuICAgIHJlZ2lzdGVySW5pdGlhbGl6ZXIoaW5Gbikge1xuICAgICAgICBfaW5pdGlhbGl6ZXJzLnB1c2goaW5Gbik7XG4gICAgfVxuXG4gICAgcmVnaXN0ZXJDb21wb25lbnRJbmplY3RvcihpbkluamVjdG9yRm4pIHtcbiAgICAgICAgX2NvbXBvbmVudEluamVjdG9ycy5wdXNoKGluSW5qZWN0b3JGbik7XG4gICAgfVxuXG4gICAgcmVuZGVyKGluTW9kZWwpIHtcbiAgICAgICAgc3VwZXIucmVuZGVyKGluTW9kZWwpO1xuICAgICAgICAkKHRoaXMubW91bnRQb2ludCkuY3NzKCdkaXNwbGF5JywgJycpO1xuICAgIH1cblxuICAgIHJlZ2lzdGVyQ29tcG9uZW50KGluQ29uZmlnLCBpbk1vZGVsUHJvdG90eXBlLCBpbkNvbnN0cnVjdG9yKSB7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJDb21wb25lbnRFbGVtZW50KHtcbiAgICAgICAgICAgIGNvbmZpZzogaW5Db25maWcsXG4gICAgICAgICAgICBtb2RlbFByb3RvdHlwZTogaW5Nb2RlbFByb3RvdHlwZSxcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yOiBpbkNvbnN0cnVjdG9yXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGluaXRTdGF0ZSgpIHtcbiAgICAgICAgbGV0IGhhc2ggPSB3aW5kb3cubG9jYXRpb24uaGFzaDtcbiAgICAgICAgaWYgKC9eIz5bXFx3XFwtXS8udGVzdChoYXNoKSkge1xuICAgICAgICAgICAgaGFzaCA9IGhhc2gucmVwbGFjZSgvXiM+LywgJycpO1xuICAgICAgICAgICAgaWYgKHRoaXMuc3RhdGVzLmdldFBhdGgoaGFzaCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRyeVN0YXRlKGhhc2gpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVnaXN0ZXJDb21wb25lbnRFbGVtZW50KGluRGVmaW5pdGlvbikge1xuICAgICAgICB2YXIgcHJvdG8gPSBPYmplY3QuY3JlYXRlKEhUTUxEaXZFbGVtZW50LnByb3RvdHlwZSk7XG4gICAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgICAgbGV0IGNvbXBvbmVudDtcbiAgICAgICAgY29uc3QgbmFtZSA9IGluRGVmaW5pdGlvbi5jb25maWcubmFtZTtcbiAgICAgICAgY29uc29sZS5pbmZvKCdyZWdpc3RlcmluZyBjb21wb25lbnQ6ICcgKyBuYW1lKTtcbiAgICAgICAgZG9jdW1lbnQuc3R5bGVTaGVldHNbMF0uaW5zZXJ0UnVsZShuYW1lICsgJ3sgZGlzcGxheTogYmxvY2s7fScsIDEpO1xuXG4gICAgICAgIHByb3RvLmNyZWF0ZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY29tcG9uZW50ID0gbmV3IENvbXBvbmVudChcbiAgICAgICAgICAgICAgICBpbkRlZmluaXRpb24uY29uZmlnLFxuICAgICAgICAgICAgICAgIGluRGVmaW5pdGlvbi5tb2RlbFByb3RvdHlwZSxcbiAgICAgICAgICAgICAgICBpbkRlZmluaXRpb24uY29uc3RydWN0b3IsXG4gICAgICAgICAgICAgICAgdGhhdCk7XG4gICAgICAgICAgICBfcmVnaXN0cnkuc2V0KHRoaXMsIGNvbXBvbmVudCk7XG4gICAgICAgICAgICBjb21wb25lbnQubm9kZSA9IHRoaXM7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGluamVjdG9yIG9mIF9jb21wb25lbnRJbmplY3RvcnMpIHtcbiAgICAgICAgICAgICAgICBpbmplY3Rvci5jYWxsKHRoYXQsIGNvbXBvbmVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBfcHJpdmF0ZS5nZXQoY29tcG9uZW50KVxuICAgICAgICAgICAgICAgIC5saWZlY3ljbGVTaWduYWwuZGlzcGF0Y2goJ2VsZW1lbnQtY3JlYXRlZCcpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHByb3RvLmF0dGFjaGVkQ2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IF9yZWdpc3RyeS5nZXQodGhpcyk7XG4gICAgICAgICAgICBfcHJpdmF0ZS5nZXQoY29tcG9uZW50KVxuICAgICAgICAgICAgICAgIC5saWZlY3ljbGVTaWduYWwuZGlzcGF0Y2goJ2VsZW1lbnQtYXR0YWNoZWQnKTtcbiAgICAgICAgICAgIGlmIChjb21wb25lbnQuY29uZmlnLmF1dG9SZW5kZXIgIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LnJlbmRlci5jYWxsKGNvbXBvbmVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcHJvdG8uZGV0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KGNvbXBvbmVudClcbiAgICAgICAgICAgICAgICAubGlmZWN5Y2xlU2lnbmFsLmRpc3BhdGNoKCdlbGVtZW50LWRldGFjaGVkJyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgZG9jdW1lbnQucmVnaXN0ZXJFbGVtZW50KGluRGVmaW5pdGlvbi5jb25maWcubmFtZSwgeyBwcm90b3R5cGU6IHByb3RvIH0pO1xuICAgIH1cblxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IFBhZ2U7XG4iLCIndXNlIHN0cmljdCc7XG5cbmNsYXNzIFRlbXBsYXRpbmdEZWxlZ2F0ZSB7XG5cdHJlZ2lzdGVyVGVtcGxhdGUoaW5Tb3VyY2UsIGluTmFtZSkge1xuXHRcdC8vaWYoIWluTmFtZSkgZ2VuZXJhdGUgbmFtZSBhbmQgcmV0dXJuIGl0XG5cdH1cblxuXHRyZW5kZXIoaW5UZW1wbGF0ZU5hbWUsIGluTW9kZWwpIHtcblx0XHQvL3JldHVybiBwcm9taXNlXG5cdH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVGVtcGxhdGluZ0RlbGVnYXRlO1xuIiwiLyohIGR1c3Rqcy1oZWxwZXJzIC0gdjEuNy4zXG4gKiBodHRwOi8vZHVzdGpzLmNvbS9cbiAqIENvcHlyaWdodCAoYykgMjAxNSBBbGVrc2FuZGVyIFdpbGxpYW1zOyBSZWxlYXNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UgKi9cbmltcG9ydCBPYnNlcnZhYmxlIGZyb20gJy4uL09ic2VydmFibGUnO1xuaW1wb3J0IHsgaXNTdHJpbmcsIGtleXMsIGdldCB9IGZyb20gJ2xvZGFzaCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKGR1c3QpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cblxuICAgIGR1c3QuaGVscGVycy5yZSA9IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykge1xuICAgICAgICBjb25zb2xlLndhcm4oJ3BhcmFtczonKTtcbiAgICAgICAgY29uc29sZS53YXJuKHBhcmFtcyk7XG4gICAgICAgIGlmICghcGFyYW1zLmtleSB8fCAhcGFyYW1zLm1hdGNoKSB7XG4gICAgICAgICAgICBjaHVuay53cml0ZSgnJyk7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ3dyaXRpbmcgZW1wdHkgc3RyaW5nJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ3dyaXRpbmcgYm9kaWVzJyk7XG4gICAgICAgICAgICB2YXIgcmUgPSBuZXcgUmVnRXhwKHBhcmFtcy5tYXRjaCk7XG4gICAgICAgICAgICBpZiAocmUudGVzdChwYXJhbXMua2V5KSkge1xuICAgICAgICAgICAgICAgIGlmIChib2RpZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgY2h1bmsgPSBjaHVuay5yZW5kZXIoYm9kaWVzLCBjb250ZXh0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgfTtcblxuXG5cbiAgICBkdXN0LmZpbHRlcnMuaHR0cHMgPSBmdW5jdGlvbihpblVybCkge1xuICAgICAgICBpZiAoIWluVXJsKSB7XG4gICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGluVXJsLnRvU3RyaW5nKCkucmVwbGFjZSgvXihodHRwKD86cyk/KTovLCAnaHR0cHM6Jyk7XG4gICAgfTtcblxuXG4gICAgZHVzdC5maWx0ZXJzLm9ic2N1cmVkY3JlZGl0Y2FyZG51bWJlciA9IGZ1bmN0aW9uKGluVmFsdWUpIHtcbiAgICAgICAgaWYgKCFpc1N0cmluZyhpblZhbHVlKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHZhciBzcGxpdCA9IGluVmFsdWUuc3BsaXQoJycpLnJldmVyc2UoKTtcbiAgICAgICAgdmFyIHRhaWwgPSBzcGxpdC5zcGxpY2UoMCwgNCk7XG4gICAgICAgIHRhaWwudW5zaGlmdCgnLScpO1xuXG4gICAgICAgIHdoaWxlIChzcGxpdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmKCEoc3BsaXQubGVuZ3RoICUgNCkpIHtcbiAgICAgICAgICAgICAgICB0YWlsLnVuc2hpZnQoJy0nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRhaWwudW5zaGlmdCgnKicpO1xuICAgICAgICAgICAgc3BsaXQucG9wKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRhaWwuam9pbignJykucmVwbGFjZSgvLS0vLCAnLScpO1xuICAgIH07XG5cbiAgICBkdXN0LmZpbHRlcnMudG9sb3dlciA9IGZ1bmN0aW9uKGluVmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGlzU3RyaW5nKGluVmFsdWUpID8gaW5WYWx1ZS50b0xvd2VyQ2FzZSgpIDogaW5WYWx1ZTtcbiAgICB9O1xuXG4gICAgZHVzdC5maWx0ZXJzLnRvdXBwZXIgPSBmdW5jdGlvbihpblZhbHVlKSB7XG4gICAgICAgIHJldHVybiBpc1N0cmluZyhpblZhbHVlKSA/IGluVmFsdWUudG9VcHBlckNhc2UoKSA6IGluVmFsdWU7XG4gICAgfTtcbiAgICBkdXN0LmhlbHBlcnMuc29ydCA9IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykge1xuICAgICAgICB2YXIgc29ydCA9IEpTT04ucGFyc2UocGFyYW1zLnNvcnQpO1xuICAgICAgICB2YXIgYm9keSA9IGJvZGllcy5ibG9jaztcbiAgICAgICAgdmFyIHNvcnRrZXk7XG5cbiAgICAgICAgZnVuY3Rpb24gaXNFbXB0eShvKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIG8pIHtcbiAgICAgICAgICAgICAgICBpZiAoby5oYXNPd25Qcm9wZXJ0eShwKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc29ydCkgZGVsZXRlIHBhcmFtcy5zb3J0O1xuICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgZnVuY3Rpb24gY21wKGEsIGIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gKGFbc29ydGtleV0gPCBiW3NvcnRrZXldKSA/IC0xIDogKChhW3NvcnRrZXldID4gYltzb3J0a2V5XSkgPyAxIDogMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSAoc29ydC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzb3J0a2V5ID0gc29ydC5wb3AoKS5rZXk7XG4gICAgICAgICAgICAgICAgY29udGV4dC5zdGFjay5oZWFkLnNvcnQoY21wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjaHVuay5zZWN0aW9uKGNvbnRleHQuZ2V0UGF0aCh0cnVlLCBbXSksIGNvbnRleHQsIGJvZGllcywgaXNFbXB0eShwYXJhbXMpID8gbnVsbCA6IHBhcmFtcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkdXN0LmZpbHRlcnMubW9uZXkgPSBmdW5jdGlvbihpblZhbHVlKSB7XG4gICAgICAgIHZhciBzVmFsdWUgPSBOdW1iZXIoaW5WYWx1ZSkudG9GaXhlZCgyKS5yZXBsYWNlKCcuJywgJywnKTtcblxuICAgICAgICB2YXIgc1JlZ0V4cCA9IG5ldyBSZWdFeHAoJygtP1swLTldKykoWzAtOV17M30pJyk7XG4gICAgICAgIHdoaWxlIChzUmVnRXhwLnRlc3Qoc1ZhbHVlKSkge1xuICAgICAgICAgICAgc1ZhbHVlID0gc1ZhbHVlLnJlcGxhY2Uoc1JlZ0V4cCwgJyQxJyArICcuJyArICckMicpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzVmFsdWU7XG4gICAgfTtcblxuICAgIGR1c3QuaGVscGVycy5pdGVyYXRlID0gZnVuY3Rpb24oY2h1bmssIGNvbnRleHQsIGJvZGllcywgcGFyYW1zKSB7XG4gICAgICAgIHZhciBib2R5ID0gYm9kaWVzLmJsb2NrLFxuICAgICAgICAgICAgc29ydCxcbiAgICAgICAgICAgIGFycixcbiAgICAgICAgICAgIGksXG4gICAgICAgICAgICBrLFxuICAgICAgICAgICAgb2JqLFxuICAgICAgICAgICAgY29tcGFyZUZuO1xuXG4gICAgICAgIHBhcmFtcyA9IHBhcmFtcyB8fCB7fTtcblxuICAgICAgICBmdW5jdGlvbiBkZXNjKGEsIGIpIHtcbiAgICAgICAgICAgIGlmIChhIDwgYikge1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhID4gYikge1xuICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gcHJvY2Vzc0JvZHkoa2V5LCB2YWx1ZSkge1xuICAgICAgICAgICAgcmV0dXJuIGJvZHkoY2h1bmssIGNvbnRleHQucHVzaCh7XG4gICAgICAgICAgICAgICAgJGtleToga2V5LFxuICAgICAgICAgICAgICAgICR2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgICAgICAgJHR5cGU6IHR5cGVvZiB2YWx1ZVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBhcmFtcy5rZXkpIHtcbiAgICAgICAgICAgIG9iaiA9IGNvbnRleHQucmVzb2x2ZShwYXJhbXMua2V5KTtcblxuICAgICAgICAgICAgaWYgKG9iaiBpbnN0YW5jZW9mIE9ic2VydmFibGUpIHtcbiAgICAgICAgICAgICAgICBvYmogPSBvYmoudG9OYXRpdmUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgICAgICBpZiAoISFwYXJhbXMuc29ydCkge1xuICAgICAgICAgICAgICAgICAgICBzb3J0ID0gZHVzdC5oZWxwZXJzLnRhcChwYXJhbXMuc29ydCwgY2h1bmssIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgICAgICBhcnIgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChrIGluIG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFyci5wdXNoKGspO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbXBhcmVGbiA9IGNvbnRleHQuZ2xvYmFsW3NvcnRdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbXBhcmVGbiAmJiBzb3J0ID09PSAnZGVzYycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBhcmVGbiA9IGRlc2M7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbXBhcmVGbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJyLnNvcnQoY29tcGFyZUZuKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyci5zb3J0KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2h1bmsgPSBwcm9jZXNzQm9keShhcnJbaV0sIG9ialthcnJbaV1dKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoayBpbiBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoaykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaHVuayA9IHByb2Nlc3NCb2R5KGssIG9ialtrXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdNaXNzaW5nIGJvZHkgYmxvY2sgaW4gdGhlIGl0ZXIgaGVscGVyLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ01pc3NpbmcgcGFyYW1ldGVyIFxcJ2tleVxcJyBpbiB0aGUgaXRlciBoZWxwZXIuJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNodW5rO1xuXG4gICAgfTtcblxuICAgIGR1c3QuaGVscGVycy5sZW5ndGggPSBmdW5jdGlvbihjaHVuaywgY29udGV4dCwgYm9kaWVzLCBwYXJhbXMpIHtcbiAgICAgICAgaWYgKCFwYXJhbXMua2V5KSB7XG4gICAgICAgICAgICBjaHVuay53cml0ZSgwKTtcbiAgICAgICAgfSBlbHNlIGlmIChwYXJhbXMua2V5LmNvbnN0cnVjdG9yID09PSBTdHJpbmcgfHwgcGFyYW1zLmtleS5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpIHtcbiAgICAgICAgICAgIGNodW5rLndyaXRlKHBhcmFtcy5rZXkubGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIGlmIChwYXJhbXMua2V5LmNvbnN0cnVjdG9yID09PSBPYmplY3QpIHtcbiAgICAgICAgICAgIGNodW5rLndyaXRlKGtleXMocGFyYW1zLmtleS5jb25zdHJ1Y3RvcikubGVuZ3RoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgfTtcblxuICAgIGR1c3QuaGVscGVycy5jYWxjID0gZnVuY3Rpb24oY2h1bmssIGNvbnRleHQsIGJvZGllcywgcGFyYW1zKSB7XG4gICAgICAgIHZhciByZXN1bHQ7XG4gICAgICAgIGlmIChnZXQod2luZG93LCAnbWF0aC5ldmFsJykpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IGdldCh3aW5kb3csICdtYXRoJykuZXZhbChjb250ZXh0LnJlc29sdmUoYm9kaWVzLmJsb2NrKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgPSBjb250ZXh0LnJlc29sdmUoYm9kaWVzLmJsb2NrKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGFyYW1zLmZvcm1hdCkge1xuICAgICAgICAgICAgc3dpdGNoIChwYXJhbXMuZm9ybWF0KSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnbW9uZXknOlxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSByZXN1bHQudG9GaXhlZCgyKS5yZXBsYWNlKCcuJywgJywnKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnaW50ZWdlcic6XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IE1hdGgucm91bmQocmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhcmFtcy52YXIgJiYgcGFyYW1zLnZhci5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnRleHQuZ2xvYmFsW3BhcmFtcy52YXJdID0gcmVzdWx0O1xuICAgICAgICAgICAgY2h1bmsud3JpdGUoJycpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2h1bmsud3JpdGUocmVzdWx0KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgfTtcblxuXG5cblxuXG5cblxuICAgIGZ1bmN0aW9uIGxvZyhoZWxwZXIsIG1zZywgbGV2ZWwpIHtcbiAgICAgICAgbGV2ZWwgPSBsZXZlbCB8fCAnSU5GTyc7XG4gICAgICAgIGhlbHBlciA9IGhlbHBlciA/ICd7QCcgKyBoZWxwZXIgKyAnfTogJyA6ICcnO1xuICAgICAgICBkdXN0LmxvZyhoZWxwZXIgKyBtc2csIGxldmVsKTtcbiAgICB9XG5cbiAgICB2YXIgX2RlcHJlY2F0ZWRDYWNoZSA9IHt9O1xuXG4gICAgZnVuY3Rpb24gX2RlcHJlY2F0ZWQodGFyZ2V0KSB7XG4gICAgICAgIGlmIChfZGVwcmVjYXRlZENhY2hlW3RhcmdldF0pIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsb2codGFyZ2V0LCAnRGVwcmVjYXRpb24gd2FybmluZzogJyArIHRhcmdldCArICcgaXMgZGVwcmVjYXRlZCBhbmQgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIHZlcnNpb24gb2YgZHVzdGpzLWhlbHBlcnMnLCAnV0FSTicpO1xuICAgICAgICBsb2cobnVsbCwgJ0ZvciBoZWxwIGFuZCBhIGRlcHJlY2F0aW9uIHRpbWVsaW5lLCBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2xpbmtlZGluL2R1c3Rqcy1oZWxwZXJzL3dpa2kvRGVwcmVjYXRlZC1GZWF0dXJlcyMnICsgdGFyZ2V0LnJlcGxhY2UoL1xcVysvZywgJycpLCAnV0FSTicpO1xuICAgICAgICBfZGVwcmVjYXRlZENhY2hlW3RhcmdldF0gPSB0cnVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzU2VsZWN0KGNvbnRleHQpIHtcbiAgICAgICAgcmV0dXJuIGNvbnRleHQuc3RhY2sudGFpbCAmJlxuICAgICAgICAgICAgY29udGV4dC5zdGFjay50YWlsLmhlYWQgJiZcbiAgICAgICAgICAgIHR5cGVvZiBjb250ZXh0LnN0YWNrLnRhaWwuaGVhZC5fX3NlbGVjdF9fICE9PSAndW5kZWZpbmVkJztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRTZWxlY3RTdGF0ZShjb250ZXh0KSB7XG4gICAgICAgIHJldHVybiBpc1NlbGVjdChjb250ZXh0KSAmJiBjb250ZXh0LmdldCgnX19zZWxlY3RfXycpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBzcGVjaWFsIF9fc2VsZWN0X18ga2V5IGJlaGluZCB0aGUgaGVhZCBvZiB0aGUgY29udGV4dCBzdGFjay4gVXNlZCB0byBtYWludGFpbiB0aGUgc3RhdGVcbiAgICAgKiBvZiB7QHNlbGVjdH0gYmxvY2tzXG4gICAgICogQHBhcmFtIGNvbnRleHQge0NvbnRleHR9IGFkZCBzdGF0ZSB0byB0aGlzIENvbnRleHRcbiAgICAgKiBAcGFyYW0gb3B0cyB7T2JqZWN0fSBhZGQgdGhlc2UgcHJvcGVydGllcyB0byB0aGUgc3RhdGUgKGBrZXlgIGFuZCBgdHlwZWApXG4gICAgICovXG4gICAgZnVuY3Rpb24gYWRkU2VsZWN0U3RhdGUoY29udGV4dCwgb3B0cykge1xuICAgICAgICB2YXIgaGVhZCA9IGNvbnRleHQuc3RhY2suaGVhZCxcbiAgICAgICAgICAgIG5ld0NvbnRleHQgPSBjb250ZXh0LnJlYmFzZSgpLFxuICAgICAgICAgICAga2V5O1xuXG4gICAgICAgIGlmIChjb250ZXh0LnN0YWNrICYmIGNvbnRleHQuc3RhY2sudGFpbCkge1xuICAgICAgICAgICAgbmV3Q29udGV4dC5zdGFjayA9IGNvbnRleHQuc3RhY2sudGFpbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzdGF0ZSA9IHtcbiAgICAgICAgICAgIGlzUGVuZGluZzogZmFsc2UsXG4gICAgICAgICAgICBpc1Jlc29sdmVkOiBmYWxzZSxcbiAgICAgICAgICAgIGlzRGVmZXJyZWRDb21wbGV0ZTogZmFsc2UsXG4gICAgICAgICAgICBkZWZlcnJlZHM6IFtdXG4gICAgICAgIH07XG5cbiAgICAgICAgZm9yIChrZXkgaW4gb3B0cykge1xuICAgICAgICAgICAgc3RhdGVba2V5XSA9IG9wdHNba2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXdDb250ZXh0XG4gICAgICAgICAgICAucHVzaCh7ICdfX3NlbGVjdF9fJzogc3RhdGUgfSlcbiAgICAgICAgICAgIC5wdXNoKGhlYWQsIGNvbnRleHQuc3RhY2suaW5kZXgsIGNvbnRleHQuc3RhY2sub2YpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFmdGVyIGEge0BzZWxlY3R9IG9yIHtAbWF0aH0gYmxvY2sgaXMgY29tcGxldGUsIHRoZXkgaW52b2tlIHRoaXMgZnVuY3Rpb25cbiAgICAgKi9cbiAgICBmdW5jdGlvbiByZXNvbHZlU2VsZWN0RGVmZXJyZWRzKHN0YXRlKSB7XG4gICAgICAgIHZhciB4LCBsZW47XG4gICAgICAgIHN0YXRlLmlzRGVmZXJyZWRQZW5kaW5nID0gdHJ1ZTtcbiAgICAgICAgaWYgKHN0YXRlLmRlZmVycmVkcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHN0YXRlLmlzRGVmZXJyZWRDb21wbGV0ZSA9IHRydWU7XG4gICAgICAgICAgICBmb3IgKHggPSAwLCBsZW4gPSBzdGF0ZS5kZWZlcnJlZHMubGVuZ3RoOyB4IDwgbGVuOyB4KyspIHtcbiAgICAgICAgICAgICAgICBzdGF0ZS5kZWZlcnJlZHNbeF0oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5pc0RlZmVycmVkUGVuZGluZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVzZWQgYnkge0Bjb250ZXh0RHVtcH1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBqc29uRmlsdGVyKGtleSwgdmFsdWUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlLnRvU3RyaW5nKClcbiAgICAgICAgICAgICAgICAucmVwbGFjZSgvKF5cXHMrfFxccyskKS9tZywgJycpXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcbi9tZywgJycpXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoLyxcXHMqL21nLCAnLCAnKVxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXClcXHsvbWcsICcpIHsnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGUgYSB0cnV0aCB0ZXN0IGhlbHBlclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHRydXRoVGVzdChuYW1lLCB0ZXN0KSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihjaHVuaywgY29udGV4dCwgYm9kaWVzLCBwYXJhbXMpIHtcbiAgICAgICAgICAgIHJldHVybiBmaWx0ZXIoY2h1bmssIGNvbnRleHQsIGJvZGllcywgcGFyYW1zLCBuYW1lLCB0ZXN0KTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGlzIGZ1bmN0aW9uIGlzIGludm9rZWQgYnkgdHJ1dGggdGVzdCBoZWxwZXJzXG4gICAgICovXG4gICAgZnVuY3Rpb24gZmlsdGVyKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcywgaGVscGVyTmFtZSwgdGVzdCkge1xuICAgICAgICB2YXIgYm9keSA9IGJvZGllcy5ibG9jayxcbiAgICAgICAgICAgIHNraXAgPSBib2RpZXNbJ2Vsc2UnXSxcbiAgICAgICAgICAgIHNlbGVjdFN0YXRlID0gZ2V0U2VsZWN0U3RhdGUoY29udGV4dCkgfHwge30sXG4gICAgICAgICAgICB3aWxsUmVzb2x2ZSwga2V5LCB2YWx1ZSwgdHlwZTtcblxuICAgICAgICAvLyBPbmNlIG9uZSB0cnV0aCB0ZXN0IGluIGEgc2VsZWN0IHBhc3Nlcywgc2hvcnQtY2lyY3VpdCB0aGUgcmVzdCBvZiB0aGUgdGVzdHNcbiAgICAgICAgaWYgKHNlbGVjdFN0YXRlLmlzUmVzb2x2ZWQgJiYgIXNlbGVjdFN0YXRlLmlzRGVmZXJyZWRQZW5kaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaXJzdCBjaGVjayBmb3IgYSBrZXkgb24gdGhlIGhlbHBlciBpdHNlbGYsIHRoZW4gbG9vayBmb3IgYSBrZXkgb24gdGhlIHtAc2VsZWN0fVxuICAgICAgICBpZiAocGFyYW1zLmhhc093blByb3BlcnR5KCdrZXknKSkge1xuICAgICAgICAgICAga2V5ID0gcGFyYW1zLmtleTtcbiAgICAgICAgfSBlbHNlIGlmIChzZWxlY3RTdGF0ZS5oYXNPd25Qcm9wZXJ0eSgna2V5JykpIHtcbiAgICAgICAgICAgIGtleSA9IHNlbGVjdFN0YXRlLmtleTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZyhoZWxwZXJOYW1lLCAnTm8ga2V5IHNwZWNpZmllZCcsICdXQVJOJyk7XG4gICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgIH1cblxuICAgICAgICB0eXBlID0gcGFyYW1zLnR5cGUgfHwgc2VsZWN0U3RhdGUudHlwZTtcblxuICAgICAgICBrZXkgPSBjb2VyY2UoY29udGV4dC5yZXNvbHZlKGtleSksIHR5cGUpO1xuICAgICAgICB2YWx1ZSA9IGNvZXJjZShjb250ZXh0LnJlc29sdmUocGFyYW1zLnZhbHVlKSwgdHlwZSk7XG5cbiAgICAgICAgaWYgKHRlc3Qoa2V5LCB2YWx1ZSkpIHtcbiAgICAgICAgICAgIC8vIE9uY2UgYSB0cnV0aCB0ZXN0IHBhc3NlcywgcHV0IHRoZSBzZWxlY3QgaW50byAncGVuZGluZycgc3RhdGUuIE5vdyB3ZSBjYW4gcmVuZGVyIHRoZSBib2R5IG9mXG4gICAgICAgICAgICAvLyB0aGUgdHJ1dGggdGVzdCAod2hpY2ggbWF5IGNvbnRhaW4gdHJ1dGggdGVzdHMpIHdpdGhvdXQgYWx0ZXJpbmcgdGhlIHN0YXRlIG9mIHRoZSBzZWxlY3QuXG4gICAgICAgICAgICBpZiAoIXNlbGVjdFN0YXRlLmlzUGVuZGluZykge1xuICAgICAgICAgICAgICAgIHdpbGxSZXNvbHZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBzZWxlY3RTdGF0ZS5pc1BlbmRpbmcgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgICAgICBjaHVuayA9IGNodW5rLnJlbmRlcihib2R5LCBjb250ZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh3aWxsUmVzb2x2ZSkge1xuICAgICAgICAgICAgICAgIHNlbGVjdFN0YXRlLmlzUmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHNraXApIHtcbiAgICAgICAgICAgIGNodW5rID0gY2h1bmsucmVuZGVyKHNraXAsIGNvbnRleHQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjaHVuaztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjb2VyY2UodmFsdWUsIHR5cGUpIHtcbiAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgIHR5cGUgPSB0eXBlLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgICAgICAgIHJldHVybiArdmFsdWU7XG4gICAgICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcodmFsdWUpO1xuICAgICAgICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgICAgICAgICAgdmFsdWUgPSAodmFsdWUgPT09ICdmYWxzZScgPyBmYWxzZSA6IHZhbHVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gQm9vbGVhbih2YWx1ZSk7XG4gICAgICAgICAgICBjYXNlICdkYXRlJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IERhdGUodmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIHZhciBoZWxwZXJzID0ge1xuXG4gICAgICAgIC8vIFV0aWxpdHkgaGVscGluZyB0byByZXNvbHZlIGR1c3QgcmVmZXJlbmNlcyBpbiB0aGUgZ2l2ZW4gY2h1bmtcbiAgICAgICAgLy8gdXNlcyBuYXRpdmUgRHVzdCBDb250ZXh0I3Jlc29sdmUgKGF2YWlsYWJsZSBzaW5jZSBEdXN0IDIuNi4yKVxuICAgICAgICAndGFwJzogZnVuY3Rpb24oaW5wdXQsIGNodW5rLCBjb250ZXh0KSB7XG4gICAgICAgICAgICAvLyBkZXByZWNhdGVkIGZvciByZW1vdmFsIGluIDEuOFxuICAgICAgICAgICAgX2RlcHJlY2F0ZWQoJ3RhcCcpO1xuICAgICAgICAgICAgcmV0dXJuIGNvbnRleHQucmVzb2x2ZShpbnB1dCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgJ3NlcCc6IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMpIHtcbiAgICAgICAgICAgIHZhciBib2R5ID0gYm9kaWVzLmJsb2NrO1xuICAgICAgICAgICAgaWYgKGNvbnRleHQuc3RhY2suaW5kZXggPT09IGNvbnRleHQuc3RhY2sub2YgLSAxKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNodW5rO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYm9keShjaHVuaywgY29udGV4dCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBjaHVuaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICAnZmlyc3QnOiBmdW5jdGlvbihjaHVuaywgY29udGV4dCwgYm9kaWVzKSB7XG4gICAgICAgICAgICBpZiAoY29udGV4dC5zdGFjay5pbmRleCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBib2RpZXMuYmxvY2soY2h1bmssIGNvbnRleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNodW5rO1xuICAgICAgICB9LFxuXG4gICAgICAgICdsYXN0JzogZnVuY3Rpb24oY2h1bmssIGNvbnRleHQsIGJvZGllcykge1xuICAgICAgICAgICAgaWYgKGNvbnRleHQuc3RhY2suaW5kZXggPT09IGNvbnRleHQuc3RhY2sub2YgLSAxKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJvZGllcy5ibG9jayhjaHVuaywgY29udGV4dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHtAY29udGV4dER1bXB9XG4gICAgICAgICAqIEBwYXJhbSBrZXkge1N0cmluZ30gc2V0IHRvICdmdWxsJyB0byB0aGUgZnVsbCBjb250ZXh0IHN0YWNrLCBvdGhlcndpc2UgdGhlIGN1cnJlbnQgY29udGV4dCBpcyBkdW1wZWRcbiAgICAgICAgICogQHBhcmFtIHRvIHtTdHJpbmd9IHNldCB0byAnY29uc29sZScgdG8gbG9nIHRvIGNvbnNvbGUsIG90aGVyd2lzZSBvdXRwdXRzIHRvIHRoZSBjaHVua1xuICAgICAgICAgKi9cbiAgICAgICAgJ2NvbnRleHREdW1wJzogZnVuY3Rpb24oY2h1bmssIGNvbnRleHQsIGJvZGllcywgcGFyYW1zKSB7XG4gICAgICAgICAgICB2YXIgdG8gPSBjb250ZXh0LnJlc29sdmUocGFyYW1zLnRvKSxcbiAgICAgICAgICAgICAgICBrZXkgPSBjb250ZXh0LnJlc29sdmUocGFyYW1zLmtleSksXG4gICAgICAgICAgICAgICAgdGFyZ2V0LCBvdXRwdXQ7XG4gICAgICAgICAgICBzd2l0Y2ggKGtleSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2Z1bGwnOlxuICAgICAgICAgICAgICAgICAgICB0YXJnZXQgPSBjb250ZXh0LnN0YWNrO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICB0YXJnZXQgPSBjb250ZXh0LnN0YWNrLmhlYWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBvdXRwdXQgPSBKU09OLnN0cmluZ2lmeSh0YXJnZXQsIGpzb25GaWx0ZXIsIDIpO1xuICAgICAgICAgICAgc3dpdGNoICh0bykge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2NvbnNvbGUnOlxuICAgICAgICAgICAgICAgICAgICBsb2coJ2NvbnRleHREdW1wJywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0LnJlcGxhY2UoLzwvZywgJ1xcXFx1MDAzYycpO1xuICAgICAgICAgICAgICAgICAgICBjaHVuayA9IGNodW5rLndyaXRlKG91dHB1dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHtAbWF0aH1cbiAgICAgICAgICogQHBhcmFtIGtleSBmaXJzdCB2YWx1ZVxuICAgICAgICAgKiBAcGFyYW0gbWV0aG9kIHtTdHJpbmd9IG9wZXJhdGlvbiB0byBwZXJmb3JtXG4gICAgICAgICAqIEBwYXJhbSBvcGVyYW5kIHNlY29uZCB2YWx1ZSAobm90IHJlcXVpcmVkIGZvciBvcGVyYXRpb25zIGxpa2UgYGFic2ApXG4gICAgICAgICAqIEBwYXJhbSByb3VuZCBpZiB0cnV0aHksIHJvdW5kKCkgdGhlIHJlc3VsdFxuICAgICAgICAgKi9cbiAgICAgICAgJ21hdGgnOiBmdW5jdGlvbihjaHVuaywgY29udGV4dCwgYm9kaWVzLCBwYXJhbXMpIHtcbiAgICAgICAgICAgIHZhciBrZXkgPSBwYXJhbXMua2V5LFxuICAgICAgICAgICAgICAgIG1ldGhvZCA9IHBhcmFtcy5tZXRob2QsXG4gICAgICAgICAgICAgICAgb3BlcmFuZCA9IHBhcmFtcy5vcGVyYW5kLFxuICAgICAgICAgICAgICAgIHJvdW5kID0gcGFyYW1zLnJvdW5kLFxuICAgICAgICAgICAgICAgIG91dHB1dCwgc3RhdGUsIHgsIGxlbjtcblxuICAgICAgICAgICAgaWYgKCFwYXJhbXMuaGFzT3duUHJvcGVydHkoJ2tleScpIHx8ICFwYXJhbXMubWV0aG9kKSB7XG4gICAgICAgICAgICAgICAgbG9nKCdtYXRoJywgJ2BrZXlgIG9yIGBtZXRob2RgIHdhcyBub3QgcHJvdmlkZWQnLCAnRVJST1InKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGtleSA9IHBhcnNlRmxvYXQoY29udGV4dC5yZXNvbHZlKGtleSkpO1xuICAgICAgICAgICAgb3BlcmFuZCA9IHBhcnNlRmxvYXQoY29udGV4dC5yZXNvbHZlKG9wZXJhbmQpKTtcblxuICAgICAgICAgICAgc3dpdGNoIChtZXRob2QpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdtb2QnOlxuICAgICAgICAgICAgICAgICAgICBpZiAob3BlcmFuZCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nKCdtYXRoJywgJ0RpdmlzaW9uIGJ5IDAnLCAnRVJST1InKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQgPSBrZXkgJSBvcGVyYW5kO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdhZGQnOlxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQgPSBrZXkgKyBvcGVyYW5kO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdzdWJ0cmFjdCc6XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dCA9IGtleSAtIG9wZXJhbmQ7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ211bHRpcGx5JzpcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0ID0ga2V5ICogb3BlcmFuZDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnZGl2aWRlJzpcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wZXJhbmQgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZygnbWF0aCcsICdEaXZpc2lvbiBieSAwJywgJ0VSUk9SJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0ID0ga2V5IC8gb3BlcmFuZDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnY2VpbCc6XG4gICAgICAgICAgICAgICAgY2FzZSAnZmxvb3InOlxuICAgICAgICAgICAgICAgIGNhc2UgJ3JvdW5kJzpcbiAgICAgICAgICAgICAgICBjYXNlICdhYnMnOlxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQgPSBNYXRoW21ldGhvZF0oa2V5KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAndG9pbnQnOlxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQgPSBwYXJzZUludChrZXksIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdtYXRoJywgJ01ldGhvZCBgJyArIG1ldGhvZCArICdgIGlzIG5vdCBzdXBwb3J0ZWQnLCAnRVJST1InKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBvdXRwdXQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJvdW5kKSB7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dCA9IE1hdGgucm91bmQob3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGJvZGllcyAmJiBib2RpZXMuYmxvY2spIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dCA9IGFkZFNlbGVjdFN0YXRlKGNvbnRleHQsIHsga2V5OiBvdXRwdXQgfSk7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rID0gY2h1bmsucmVuZGVyKGJvZGllcy5ibG9jaywgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmVTZWxlY3REZWZlcnJlZHMoZ2V0U2VsZWN0U3RhdGUoY29udGV4dCkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rID0gY2h1bmsud3JpdGUob3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjaHVuaztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICoge0BzZWxlY3R9XG4gICAgICAgICAqIEdyb3VwcyBhIHNldCBvZiB0cnV0aCB0ZXN0cyBhbmQgb3V0cHV0cyB0aGUgZmlyc3Qgb25lIHRoYXQgcGFzc2VzLlxuICAgICAgICAgKiBBbHNvIGNvbnRhaW5zIHtAYW55fSBhbmQge0Bub25lfSBibG9ja3MuXG4gICAgICAgICAqIEBwYXJhbSBrZXkgYSB2YWx1ZSBvciByZWZlcmVuY2UgdG8gdXNlIGFzIHRoZSBsZWZ0LWhhbmQgc2lkZSBvZiBjb21wYXJpc29uc1xuICAgICAgICAgKiBAcGFyYW0gdHlwZSBjb2VyY2UgYWxsIHRydXRoIHRlc3Qga2V5cyB3aXRob3V0IGFuIGV4cGxpY2l0IHR5cGUgdG8gdGhpcyB0eXBlXG4gICAgICAgICAqL1xuICAgICAgICAnc2VsZWN0JzogZnVuY3Rpb24oY2h1bmssIGNvbnRleHQsIGJvZGllcywgcGFyYW1zKSB7XG4gICAgICAgICAgICB2YXIgYm9keSA9IGJvZGllcy5ibG9jayxcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IHt9O1xuXG4gICAgICAgICAgICBpZiAocGFyYW1zLmhhc093blByb3BlcnR5KCdrZXknKSkge1xuICAgICAgICAgICAgICAgIHN0YXRlLmtleSA9IGNvbnRleHQucmVzb2x2ZShwYXJhbXMua2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChwYXJhbXMuaGFzT3duUHJvcGVydHkoJ3R5cGUnKSkge1xuICAgICAgICAgICAgICAgIHN0YXRlLnR5cGUgPSBwYXJhbXMudHlwZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0ID0gYWRkU2VsZWN0U3RhdGUoY29udGV4dCwgc3RhdGUpO1xuICAgICAgICAgICAgICAgIGNodW5rID0gY2h1bmsucmVuZGVyKGJvZHksIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgIHJlc29sdmVTZWxlY3REZWZlcnJlZHMoZ2V0U2VsZWN0U3RhdGUoY29udGV4dCkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2coJ3NlbGVjdCcsICdNaXNzaW5nIGJvZHkgYmxvY2snLCAnV0FSTicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNodW5rO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcnV0aCB0ZXN0IGhlbHBlcnNcbiAgICAgICAgICogQHBhcmFtIGtleSBhIHZhbHVlIG9yIHJlZmVyZW5jZSB0byB1c2UgYXMgdGhlIGxlZnQtaGFuZCBzaWRlIG9mIGNvbXBhcmlzb25zXG4gICAgICAgICAqIEBwYXJhbSB2YWx1ZSBhIHZhbHVlIG9yIHJlZmVyZW5jZSB0byB1c2UgYXMgdGhlIHJpZ2h0LWhhbmQgc2lkZSBvZiBjb21wYXJpc29uc1xuICAgICAgICAgKiBAcGFyYW0gdHlwZSBpZiBzcGVjaWZpZWQsIGBrZXlgIGFuZCBgdmFsdWVgIHdpbGwgYmUgZm9yY2libHkgY2FzdCB0byB0aGlzIHR5cGVcbiAgICAgICAgICovXG4gICAgICAgICdlcSc6IHRydXRoVGVzdCgnZXEnLCBmdW5jdGlvbihsZWZ0LCByaWdodCkge1xuICAgICAgICAgICAgcmV0dXJuIGxlZnQgPT09IHJpZ2h0O1xuICAgICAgICB9KSxcbiAgICAgICAgJ25lJzogdHJ1dGhUZXN0KCduZScsIGZ1bmN0aW9uKGxlZnQsIHJpZ2h0KSB7XG4gICAgICAgICAgICByZXR1cm4gbGVmdCAhPT0gcmlnaHQ7XG4gICAgICAgIH0pLFxuICAgICAgICAnbHQnOiB0cnV0aFRlc3QoJ2x0JywgZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICAgICAgICAgIHJldHVybiBsZWZ0IDwgcmlnaHQ7XG4gICAgICAgIH0pLFxuICAgICAgICAnbHRlJzogdHJ1dGhUZXN0KCdsdGUnLCBmdW5jdGlvbihsZWZ0LCByaWdodCkge1xuICAgICAgICAgICAgcmV0dXJuIGxlZnQgPD0gcmlnaHQ7XG4gICAgICAgIH0pLFxuICAgICAgICAnZ3QnOiB0cnV0aFRlc3QoJ2d0JywgZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICAgICAgICAgIHJldHVybiBsZWZ0ID4gcmlnaHQ7XG4gICAgICAgIH0pLFxuICAgICAgICAnZ3RlJzogdHJ1dGhUZXN0KCdndGUnLCBmdW5jdGlvbihsZWZ0LCByaWdodCkge1xuICAgICAgICAgICAgcmV0dXJuIGxlZnQgPj0gcmlnaHQ7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB7QGFueX1cbiAgICAgICAgICogT3V0cHV0cyBhcyBsb25nIGFzIGF0IGxlYXN0IG9uZSB0cnV0aCB0ZXN0IGluc2lkZSBhIHtAc2VsZWN0fSBoYXMgcGFzc2VkLlxuICAgICAgICAgKiBNdXN0IGJlIGNvbnRhaW5lZCBpbnNpZGUgYSB7QHNlbGVjdH0gYmxvY2suXG4gICAgICAgICAqIFRoZSBwYXNzaW5nIHRydXRoIHRlc3QgY2FuIGJlIGJlZm9yZSBvciBhZnRlciB0aGUge0Bhbnl9IGJsb2NrLlxuICAgICAgICAgKi9cbiAgICAgICAgJ2FueSc6IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIHNlbGVjdFN0YXRlID0gZ2V0U2VsZWN0U3RhdGUoY29udGV4dCk7XG5cbiAgICAgICAgICAgIGlmICghc2VsZWN0U3RhdGUpIHtcbiAgICAgICAgICAgICAgICBsb2coJ2FueScsICdNdXN0IGJlIHVzZWQgaW5zaWRlIGEge0BzZWxlY3R9IGJsb2NrJywgJ0VSUk9SJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChzZWxlY3RTdGF0ZS5pc0RlZmVycmVkQ29tcGxldGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdhbnknLCAnTXVzdCBub3QgYmUgbmVzdGVkIGluc2lkZSB7QGFueX0gb3Ige0Bub25lfSBibG9jaycsICdFUlJPUicpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rID0gY2h1bmsubWFwKGZ1bmN0aW9uKGNodW5rKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxlY3RTdGF0ZS5kZWZlcnJlZHMucHVzaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZWN0U3RhdGUuaXNSZXNvbHZlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaHVuayA9IGNodW5rLnJlbmRlcihib2RpZXMuYmxvY2ssIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaHVuay5lbmQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHtAbm9uZX1cbiAgICAgICAgICogT3V0cHV0cyBpZiBubyB0cnV0aCB0ZXN0cyBpbnNpZGUgYSB7QHNlbGVjdH0gcGFzcy5cbiAgICAgICAgICogTXVzdCBiZSBjb250YWluZWQgaW5zaWRlIGEge0BzZWxlY3R9IGJsb2NrLlxuICAgICAgICAgKiBUaGUgcG9zaXRpb24gb2YgdGhlIGhlbHBlciBkb2VzIG5vdCBtYXR0ZXIuXG4gICAgICAgICAqL1xuICAgICAgICAnbm9uZSc6IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIHNlbGVjdFN0YXRlID0gZ2V0U2VsZWN0U3RhdGUoY29udGV4dCk7XG5cbiAgICAgICAgICAgIGlmICghc2VsZWN0U3RhdGUpIHtcbiAgICAgICAgICAgICAgICBsb2coJ25vbmUnLCAnTXVzdCBiZSB1c2VkIGluc2lkZSBhIHtAc2VsZWN0fSBibG9jaycsICdFUlJPUicpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZWN0U3RhdGUuaXNEZWZlcnJlZENvbXBsZXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZygnbm9uZScsICdNdXN0IG5vdCBiZSBuZXN0ZWQgaW5zaWRlIHtAYW55fSBvciB7QG5vbmV9IGJsb2NrJywgJ0VSUk9SJyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2h1bmsgPSBjaHVuay5tYXAoZnVuY3Rpb24oY2h1bmspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGVjdFN0YXRlLmRlZmVycmVkcy5wdXNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc2VsZWN0U3RhdGUuaXNSZXNvbHZlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaHVuayA9IGNodW5rLnJlbmRlcihib2RpZXMuYmxvY2ssIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaHVuay5lbmQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2h1bms7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHtAc2l6ZX1cbiAgICAgICAgICogV3JpdGUgdGhlIHNpemUgb2YgdGhlIHRhcmdldCB0byB0aGUgY2h1bmtcbiAgICAgICAgICogRmFsc3kgdmFsdWVzIGFuZCB0cnVlIGhhdmUgc2l6ZSAwXG4gICAgICAgICAqIE51bWJlcnMgYXJlIHJldHVybmVkIGFzLWlzXG4gICAgICAgICAqIEFycmF5cyBhbmQgU3RyaW5ncyBoYXZlIHNpemUgZXF1YWwgdG8gdGhlaXIgbGVuZ3RoXG4gICAgICAgICAqIE9iamVjdHMgaGF2ZSBzaXplIGVxdWFsIHRvIHRoZSBudW1iZXIgb2Yga2V5cyB0aGV5IGNvbnRhaW5cbiAgICAgICAgICogRHVzdCBib2RpZXMgYXJlIGV2YWx1YXRlZCBhbmQgdGhlIGxlbmd0aCBvZiB0aGUgc3RyaW5nIGlzIHJldHVybmVkXG4gICAgICAgICAqIEZ1bmN0aW9ucyBhcmUgZXZhbHVhdGVkIGFuZCB0aGUgbGVuZ3RoIG9mIHRoZWlyIHJldHVybiB2YWx1ZSBpcyBldmFsdWF0ZWRcbiAgICAgICAgICogQHBhcmFtIGtleSBmaW5kIHRoZSBzaXplIG9mIHRoaXMgdmFsdWUgb3IgcmVmZXJlbmNlXG4gICAgICAgICAqL1xuICAgICAgICAnc2l6ZSc6IGZ1bmN0aW9uKGNodW5rLCBjb250ZXh0LCBib2RpZXMsIHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIGtleSA9IHBhcmFtcy5rZXksXG4gICAgICAgICAgICAgICAgdmFsdWUsIGs7XG5cbiAgICAgICAgICAgIGtleSA9IGNvbnRleHQucmVzb2x2ZShwYXJhbXMua2V5KTtcbiAgICAgICAgICAgIGlmICgha2V5IHx8IGtleSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZHVzdC5pc0FycmF5KGtleSkpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGtleS5sZW5ndGg7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFpc05hTihwYXJzZUZsb2F0KGtleSkpICYmIGlzRmluaXRlKGtleSkpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGtleTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGtleSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IDA7XG4gICAgICAgICAgICAgICAgZm9yIChrIGluIGtleSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoa2V5Lmhhc093blByb3BlcnR5KGspKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSsrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IChrZXkgKyAnJykubGVuZ3RoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNodW5rLndyaXRlKHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIGZvciAodmFyIGtleSBpbiBoZWxwZXJzKSB7XG4gICAgICAgIGR1c3QuaGVscGVyc1trZXldID0gaGVscGVyc1trZXldO1xuICAgIH1cblxuICAgIHJldHVybiBkdXN0O1xuXG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCBUZW1wbGF0aW5nRGVsZWdhdGUgZnJvbSAnLi9UZW1wbGF0aW5nRGVsZWdhdGUnO1xuaW1wb3J0IGR1c3QgZnJvbSAnYWUtZHVzdGpzJztcbmltcG9ydCB1dWlkIGZyb20gJ25vZGUtdXVpZCc7XG5pbXBvcnQgT2JzZXJ2YWJsZU9iamVjdCBmcm9tICcuLi9PYnNlcnZhYmxlT2JqZWN0JztcbmltcG9ydCBPYnNlcnZhYmxlIGZyb20gJy4uL09ic2VydmFibGUnO1xuaW1wb3J0IHtnZXR9IGZyb20gJ2xvZGFzaCc7XG5cbmltcG9ydCBkdXN0SGVscGVycyBmcm9tICcuL2R1c3QtaGVscGVycyc7XG5kdXN0SGVscGVycyhkdXN0KTtcbmNvbnN0IF90ZW1wbGF0ZXMgPSBuZXcgTWFwKCk7XG5sZXQgZXZpbEZuO1xuXG5jbGFzcyBEdXN0VGVtcGxhdGluZ0RlbGVnYXRlIGV4dGVuZHMgVGVtcGxhdGluZ0RlbGVnYXRlIHtcbiAgICBjb25zdHJ1Y3RvcihpbkV2aWxGbikge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB2YXIgbiA9ICdFVicgKyAnYScgKyAnTCc7XG4gICAgICAgIGV2aWxGbiA9IGluRXZpbEZuIHx8IHdpbmRvd1tuLnRvTG93ZXJDYXNlKCldO1xuXG4gICAgICAgIGR1c3QuY29sbGVjdGlvblJlc29sdmVyID0gZnVuY3Rpb24oaW5Db2xsZWN0aW9uKSB7XG4gICAgICAgICAgICBpZiAoaW5Db2xsZWN0aW9uIGluc3RhbmNlb2YgT2JzZXJ2YWJsZU9iamVjdCAmJiBpbkNvbGxlY3Rpb24uaXNDb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGluQ29sbGVjdGlvbi50b05hdGl2ZSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5Db2xsZWN0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGR1c3QucHJvcGVydHlSZXNvbHZlciA9IGZ1bmN0aW9uKGluQmFzZSwgaW5QYXRoKSB7XG4gICAgICAgICAgICBpZiAoaW5CYXNlIGluc3RhbmNlb2YgT2JzZXJ2YWJsZU9iamVjdCkge1xuICAgICAgICAgICAgICAgIGlmKGluQmFzZS5pc0NvbGxlY3Rpb24gJiYgaW5QYXRoID09PSAnbGVuZ3RoJykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW5CYXNlLmxlbmd0aDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW5CYXNlLnByb3AoaW5QYXRoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXQoaW5CYXNlLCBpblBhdGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgXG4gICAgfVxuXG4gICAgc2V0Q29sbGVjdGlvblJlc29sdmVyKGluUmVzb2x2ZXIpIHtcbiAgICAgICAgZHVzdC5jb2xsZWN0aW9uUmVzb2x2ZXIgPSBpblJlc29sdmVyO1xuICAgIH1cblxuICAgIHNldFByb3BlcnR5UmVzb2x2ZXIoaW5SZXNvbHZlcikge1xuICAgICAgICBkdXN0LnByb3BlcnR5UmVzb2x2ZXIgPSBpblJlc29sdmVyO1xuICAgIH1cblxuICAgIHJlZ2lzdGVyKGluTmFtZSwgaW5UZW1wbGF0ZSkge1xuICAgICAgICBfdGVtcGxhdGVzLnNldChpbk5hbWUsIGluVGVtcGxhdGUpO1xuICAgICAgICBkdXN0LnJlZ2lzdGVyKGluTmFtZSwgaW5UZW1wbGF0ZSk7XG4gICAgfVxuXG4gICAgcmVnaXN0ZXJUZW1wbGF0ZShpblNvdXJjZSwgaW5OYW1lKSB7XG4gICAgICAgIGluTmFtZSA9IGluTmFtZSB8fCAoJ3RlbXBsYXRlXycgKyB1dWlkLnY0KCkpO1xuICAgICAgICBjb25zdCBjb21waWxlZFNyYyA9IGR1c3QuY29tcGlsZShpblNvdXJjZSkucmVwbGFjZSgvXFxiZHVzdFxcYi9nLCAnJyk7XG5cbiAgICAgICAgY29uc3QgY29tcGlsZWRGbiA9IGV2aWxGbihjb21waWxlZFNyYyk7XG4gICAgICAgIGlmIChjb21waWxlZEZuIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgY29tcGlsZWRGbi50aGVuKChpbkZuKSA9PiB7XG4gICAgICAgICAgICAgICAgX3RlbXBsYXRlcy5zZXQoaW5OYW1lLCBpbkZuKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgX3RlbXBsYXRlcy5zZXQoaW5OYW1lLCBjb21waWxlZEZuKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW5OYW1lO1xuICAgIH1cblxuICAgIHJlbmRlcihpblRlbXBsYXRlTmFtZSwgaW5Nb2RlbCkge1xuICAgICAgICBjb25zdCB0ZW1wbGF0ZSA9IF90ZW1wbGF0ZXMuZ2V0KGluVGVtcGxhdGVOYW1lKTtcbiAgICAgICAgaWYgKCF0ZW1wbGF0ZSkge1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGBEdXN0VGVtcGxhdGluZ0RlbGVnYXRlOiBUZW1wbGF0ZSB3aXRoIG5hbWUgJHtpblRlbXBsYXRlTmFtZX0gbm90IGZvdW5kYCk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBkdXN0LnJlbmRlcih0ZW1wbGF0ZSwgaW5Nb2RlbCwgKGluRXJyb3IsIGluSHRtbCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChpbkVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChpbkVycm9yKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGluSHRtbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG59XG5sZXQgaW5zdGFuY2U7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKGluRXZpbEZuKSB7XG4gICAgcmV0dXJuIChpbnN0YW5jZSA/IGluc3RhbmNlIDogKGluc3RhbmNlID0gbmV3IER1c3RUZW1wbGF0aW5nRGVsZWdhdGUoaW5FdmlsRm4pKSk7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCAkIGZyb20gJ2pxdWVyeSc7XG5pbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IEJ1cyBmcm9tICcuL0J1cyc7XG5pbXBvcnQgQ29tcG9uZW50IGZyb20gJy4vQ29tcG9uZW50JztcbmltcG9ydCBQYWdlIGZyb20gJy4vUGFnZSc7XG5pbXBvcnQgT2JzZXJ2YWJsZU9iamVjdCBmcm9tICcuL09ic2VydmFibGVPYmplY3QnO1xuaW1wb3J0IGR1c3RUZW1wbGF0aW5nRGVsZWdhdGUgZnJvbSAnLi9kZWxlZ2F0ZS9kdXN0LXRlbXBsYXRpbmctZGVsZWdhdGUnO1xuXG5cbmxldCBfdGVtcGxhdGluZ0RlbGVnYXRlO1xubGV0IF9jb21wb25lbnRDb25maWdQcmVwcm9jZXNzb3I7XG5cbmNsYXNzIFBhZ2VGYWN0b3J5IHtcbiAgICBcbiAgICBnZXRUZW1wbGF0aW5nRGVsZWdhdGUoKSB7XG4gICAgICAgIHJldHVybiBfdGVtcGxhdGluZ0RlbGVnYXRlO1xuICAgIH1cblxuICAgIHNldENvbXBvbmVudENvbmZpZ1ByZVByb2Nlc3NvcihpbkZuKSB7XG4gICAgXHRPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2NvbXBvbmVudENvbmZpZ1ByZXByb2Nlc3NvcicsIHsgXG4gICAgICAgICAgICBnZXQgOiBmdW5jdGlvbigpIHsgXG4gICAgICAgICAgICAgICAgcmV0dXJuIGluRm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHBhZ2UoaW5Db25maWcsIGluTW9kZWwsIGluU2V0dXBGdW5jdGlvbikge1xuICAgIFx0IF90ZW1wbGF0aW5nRGVsZWdhdGUgPSBpbkNvbmZpZy50ZW1wbGF0aW5nRGVsZWdhdGUgfHwgZHVzdFRlbXBsYXRpbmdEZWxlZ2F0ZShpbkNvbmZpZy5ldmlsRnVuY3Rpb24pO1xuICAgICAgICBsZXQgcGFnZSA9IG5ldyBQYWdlKGluQ29uZmlnLCBpbk1vZGVsLCBpblNldHVwRnVuY3Rpb24pO1xuICAgICAgICByZXR1cm4gcGFnZTtcbiAgICB9XG59XG5cblxuZXhwb3J0IGRlZmF1bHQgbmV3IFBhZ2VGYWN0b3J5KCk7XG4iLCIndXNlIHN0cmljdCc7XG5pbXBvcnQgbWljcm90YXNrIGZyb20gJy4vbWljcm90YXNrJztcbmltcG9ydCBPYnNlcnZhYmxlT2JqZWN0IGZyb20gJy4vT2JzZXJ2YWJsZU9iamVjdCc7XG5pbXBvcnQgT2JzZXJ2YWJsZSBmcm9tICcuL09ic2VydmFibGUnO1xuaW1wb3J0IFN0YXRlIGZyb20gJy4vU3RhdGUnO1xuaW1wb3J0IEJ1cyBmcm9tICcuL0J1cyc7XG5pbXBvcnQgeyBpc1N0cmluZywgaXNGdW5jdGlvbiwgaXNQbGFpbk9iamVjdCwgZWFjaCB9IGZyb20gJ2xvZGFzaCc7XG5pbXBvcnQgJCBmcm9tICdqcXVlcnknO1xuaW1wb3J0IGZhY3RvcnkgZnJvbSAnLi9wYWdlLWZhY3RvcnknO1xuaW1wb3J0IENvbXBvbmVudExpZmVjeWNsZSBmcm9tICcuL0NvbXBvbmVudExpZmVjeWNsZSc7XG5pbXBvcnQgeyBTaWduYWwgfSBmcm9tICdzaWduYWxzJztcbmltcG9ydCBwcml2YXRlSGFzaCBmcm9tICcuL3V0aWwvcHJpdmF0ZSc7XG5cbmNvbnN0IF9wcml2YXRlID0gcHJpdmF0ZUhhc2goJ2NvbXBvbmVudCcpO1xuXG5jb25zdCBfc2V0dXBNb2RlbCA9IGZ1bmN0aW9uIF9zZXR1cE1vZGVsKGluTW9kZWxJbml0T2JqKSB7XG5cbiAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcblxuICAgIGxldCBnZXR0ZXI7XG5cbiAgICBpZiAoIWluTW9kZWxJbml0T2JqKSB7XG4gICAgICAgIGdldHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhZ2UucmVzb2x2ZU5vZGVNb2RlbCh0aGlzLm5vZGUpO1xuICAgICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIF9wLm1vZGVsID0gT2JzZXJ2YWJsZU9iamVjdC5mcm9tT2JqZWN0KGluTW9kZWxJbml0T2JqKTtcbiAgICAgICAgZ2V0dGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIF9wLm1vZGVsO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbW9kZWwnLCB7XG4gICAgICAgIGdldDogZ2V0dGVyXG4gICAgfSk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdoYXNNb2RlbCcsIHtcbiAgICAgICAgZ2V0OiAoKSA9PiAhIWluTW9kZWxJbml0T2JqXG4gICAgfSk7XG59O1xuXG5jb25zdCBfZmluZFN0YXRlID0gZnVuY3Rpb24gX2ZpbmRTdGF0ZShpblN0YXRlTmFtZSkge1xuXG4gICAgaWYgKCFpblN0YXRlTmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5zdGF0ZXM7XG4gICAgfVxuICAgIGxldCBwYXRoID0gaW5TdGF0ZU5hbWUuc3BsaXQoJy4nKTtcbiAgICBsZXQgY3VycmVudFN0YXRlID0gdGhpcy5zdGF0ZXM7XG4gICAgd2hpbGUgKHBhdGgubGVuZ3RoICYmIGN1cnJlbnRTdGF0ZSkge1xuICAgICAgICBsZXQgc2VnID0gcGF0aC5zaGlmdCgpO1xuICAgICAgICBjdXJyZW50U3RhdGUgPSBjdXJyZW50U3RhdGUuY2hpbGQoc2VnKTtcbiAgICB9XG4gICAgcmV0dXJuIGN1cnJlbnRTdGF0ZTtcbn07XG5cblxuY29uc3QgX3dhdGNoU3RhdGUgPSBmdW5jdGlvbiBfd2F0Y2hTdGF0ZSgpIHtcbiAgICBjb25zdCBfcCA9IF9wcml2YXRlLmdldCh0aGlzKTtcblxuICAgIF9wLnN0YXRlSW5mby53YXRjaCgnbmV4dFN0YXRlJywgKGluUGF0aCwgaW5DaGFuZ2VzKSA9PiB7XG4gICAgICAgIGxldCBuZXh0U3RhdGUgPSBfZmluZFN0YXRlLmJpbmQodGhpcykoaW5DaGFuZ2VzLm5ld1ZhbHVlKTtcbiAgICAgICAgaWYgKCFuZXh0U3RhdGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignQ2hhbmdpbmcgdG8gdW5rbm93biBzdGF0ZTogJyArXG4gICAgICAgICAgICAgICAgaW5DaGFuZ2VzLm5ld1ZhbHVlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByb2xsYmFjayA9IChpblJlYXNvbikgPT4ge1xuICAgICAgICAgICAgaW5SZWFzb24gJiYgY29uc29sZS5kZWJ1ZygnQ291bGQgbm90IGNoYW5nZSBzdGF0ZSBiZWNhdXNlOiAnICsgaW5SZWFzb24pOyAvL2pzaGludCBpZ25vcmU6bGluZVxuICAgICAgICAgICAgX3Auc3RhdGVJbmZvLnByb3AoJ25leHRTdGF0ZScsIGluQ2hhbmdlcy5vbGRWYWx1ZSwgdHJ1ZSk7XG4gICAgICAgICAgICBjdXJyZW50U3RhdGUuZGlkbnRMZWF2ZSgpO1xuICAgICAgICAgICAgZm9yIChsZXQgd2F0Y2hlciBvZiBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVXYXRjaGVycykge1xuICAgICAgICAgICAgICAgIHdhdGNoZXIoaW5DaGFuZ2VzLm5ld1ZhbHVlLCBpbkNoYW5nZXMub2xkVmFsdWUsIGluUmVhc29uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgbGV0IGN1cnJlbnRTdGF0ZSA9IF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZUluZm8uY3VycmVudFN0YXRlT2JqZWN0O1xuICAgICAgICBpZiAoY3VycmVudFN0YXRlKSB7XG4gICAgICAgICAgICBjdXJyZW50U3RhdGUubGVhdmluZyhpbkNoYW5nZXMubmV3VmFsdWUpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIG5leHRTdGF0ZS5lbnRlcmluZyhpbkNoYW5nZXMub2xkVmFsdWUpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVJbmZvLmN1cnJlbnRTdGF0ZU9iamVjdCA9IG5leHRTdGF0ZTtcbiAgICAgICAgICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5wcm9wKCdzdGF0ZScsIF9wLnN0YXRlSW5mby5wcm9wKCduZXh0U3RhdGUnKSk7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRTdGF0ZS5sZWZ0KGluQ2hhbmdlcy5uZXdWYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIG5leHRTdGF0ZS5lbnRlcmVkKGluQ2hhbmdlcy5vbGRWYWx1ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgd2F0Y2hlciBvZiBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVXYXRjaGVycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgd2F0Y2hlcihpbkNoYW5nZXMubmV3VmFsdWUsIGluQ2hhbmdlcy5vbGRWYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKHJvbGxiYWNrKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKHJvbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuXG5cbmNsYXNzIENvbXBvbmVudCB7XG5cbiAgICBjb25zdHJ1Y3RvcihpbkNvbmZpZywgaW5Jbml0T2JqLCBpbkNvbnN0cnVjdG9yLCBpblBhZ2UpIHtcbiAgICAgICAgY29uc3QgbGlmZWN5Y2xlU2lnbmFsID0gbmV3IFNpZ25hbCgpO1xuICAgICAgICBjb25zdCBsaWZlY3ljbGUgPSBuZXcgQ29tcG9uZW50TGlmZWN5Y2xlKGxpZmVjeWNsZVNpZ25hbCk7XG4gICAgICAgIF9wcml2YXRlLnNldCh0aGlzLCB7XG4gICAgICAgICAgICBzdGF0ZVdhdGNoZXJzOiBuZXcgU2V0KCksXG4gICAgICAgICAgICBsaWZlY3ljbGVTaWduYWw6IGxpZmVjeWNsZVNpZ25hbCxcbiAgICAgICAgICAgIHN0YXRlSW5mbzogbmV3IE9ic2VydmFibGVPYmplY3QoKVxuICAgICAgICB9KTtcblxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2xpZmVjeWNsZScsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxpZmVjeWNsZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cblxuICAgICAgICBpZiAoZmFjdG9yeS5jb21wb25lbnRDb25maWdQcmVwcm9jZXNzb3IpIHtcbiAgICAgICAgICAgIGZhY3RvcnkuY29tcG9uZW50Q29uZmlnUHJlcHJvY2Vzc29yKGluQ29uZmlnKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNvbmZpZyA9IGluQ29uZmlnO1xuICAgICAgICB0aGlzLnBhZ2UgPSBpblBhZ2U7XG4gICAgICAgIHRoaXMuYnVzID0gbmV3IEJ1cyhpblBhZ2UgPyBpblBhZ2UuYnVzIDogbnVsbCk7IC8vanNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAgIHRoaXMubmFtZSA9IGluQ29uZmlnLm5hbWU7XG4gICAgICAgIGVhY2goaW5Db25maWcuYWN0aW9ucywgKGluQWN0aW9uKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWluQWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignUGFzc2VkIGEgbnVsbCBhY3Rpb24gdG8gY29tcG9uZW50IGNvbmZpZycpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGFjdGlvbk5hbWUgPSBpc1N0cmluZyhpbkFjdGlvbikgPyBpbkFjdGlvbiA6IGluQWN0aW9uLm5hbWU7XG4gICAgICAgICAgICBpZiAoIWFjdGlvbk5hbWUpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdQYXNzZWQgYW4gb2JqZWN0IHdpdGggbm8gYWN0aW9uIG5hbWUgYXMgYWN0aW9uIGluIGNvbXBvbmVudCBjb25maWcnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gaXNQbGFpbk9iamVjdChpbkFjdGlvbikgPyBpbkFjdGlvbi5oYW5kbGVyIDogdW5kZWZpbmVkO1xuXG4gICAgICAgICAgICBpZiAoaGFuZGxlciAmJiAhaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Bhc3NlZCBhIG5vbi1mdW5jdGlvbiBhY3Rpb24gaGFuZGxlciBpbiBjb21wb25lbnQgY29uZmlnJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzUGxhaW5PYmplY3QoaW5BY3Rpb24pICYmIGluQWN0aW9uLnB1Ymxpc2ggPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1cy5wdWJsaXNoQWN0aW9uKGFjdGlvbk5hbWUsIGhhbmRsZXIgPyBoYW5kbGVyLmJpbmQodGhpcykgOiBudWxsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5idXMuYWRkQWN0aW9uKGFjdGlvbk5hbWUsIGhhbmRsZXIgPyBoYW5kbGVyLmJpbmQodGhpcykgOiBudWxsKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcbiAgICAgICAgbGV0IHRlbXBsYXRlcyA9IGluQ29uZmlnLnRlbXBsYXRlcyB8fCB7fTtcblxuICAgICAgICBfc2V0dXBNb2RlbC5jYWxsKHRoaXMsIGluSW5pdE9iaik7XG5cbiAgICAgICAgZm9yIChsZXQgdGVtcGxhdGVOYW1lIGluIHRlbXBsYXRlcykge1xuICAgICAgICAgICAgbGV0IGFjdHVhbFRlbXBsYXRlTmFtZSA9IHRlbXBsYXRlTmFtZSA9PT0gJ19kZWZhdWx0JyA/XG4gICAgICAgICAgICAgICAgJ19kZWZhdWx0LicgKyB0aGlzLm5hbWUgOlxuICAgICAgICAgICAgICAgIHRlbXBsYXRlTmFtZTtcbiAgICAgICAgICAgIGZhY3RvcnkuZ2V0VGVtcGxhdGluZ0RlbGVnYXRlKClcbiAgICAgICAgICAgICAgICAucmVnaXN0ZXIoYWN0dWFsVGVtcGxhdGVOYW1lLCB0ZW1wbGF0ZXNbdGVtcGxhdGVOYW1lXSk7XG4gICAgICAgIH1cbiAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLmhhc0RlZmF1bHRUZW1wbGF0ZSA9ICEhdGVtcGxhdGVzLl9kZWZhdWx0O1xuICAgICAgICBfd2F0Y2hTdGF0ZS5iaW5kKHRoaXMpKCk7XG4gICAgICAgIHRoaXMuc3RhdGVzID0gdGhpcy5zdGF0ZXMgfHwgbmV3IFN0YXRlKCk7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZUluZm8uY3VycmVudFN0YXRlT2JqZWN0ID0gdGhpcy5zdGF0ZXM7XG4gICAgICAgIGluQ29uc3RydWN0b3IgJiYgaW5Db25zdHJ1Y3Rvci5iaW5kKHRoaXMpKCk7IC8vanNoaW50IGlnbm9yZTpsaW5lXG5cbiAgICAgICAgbWljcm90YXNrKHRoaXMuaW5pdFN0YXRlLmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIGRhdGEoaW5QYXRoLCBpblZhbHVlLCBpblNpbGVudCkge1xuICAgICAgICBjb25zdCBwYXRoID0gJ2RhdGEnICsgKGluUGF0aCA/ICcuJyArIGluUGF0aCA6ICcnKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFnZS5yZXNvbHZlTm9kZU1vZGVsKHRoaXMubm9kZSwgcGF0aCkucHJvcChwYXRoLCBpblZhbHVlLCBpblNpbGVudCk7XG4gICAgfVxuXG4gICAgaW5pdFN0YXRlKCkge1xuXG4gICAgfVxuXG4gICAgZ2V0Q3VycmVudFN0YXRlKCkge1xuICAgICAgICByZXR1cm4gX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5jdXJyZW50U3RhdGVPYmplY3Q7XG4gICAgfVxuXG4gICAgdHJ5U3RhdGUoaW5TdGF0ZU5hbWUpIHtcbiAgICAgICAgaWYgKGluU3RhdGVOYW1lID09PSBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVJbmZvLnByb3AoJ3N0YXRlJykpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB3YXRjaGVyID0gKGluTmV3U3RhdGUsIGluT2xkU3RhdGUsIGluRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoaW5FcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoaW5FcnJvcik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShpbk5ld1N0YXRlLCBpbk9sZFN0YXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy51bndhdGNoU3RhdGUod2F0Y2hlcik7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy53YXRjaFN0YXRlKHdhdGNoZXIpO1xuICAgICAgICAgICAgX3ByaXZhdGUuZ2V0KHRoaXMpLnN0YXRlSW5mby5wcm9wKCduZXh0U3RhdGUnLCBpblN0YXRlTmFtZSk7XG4gICAgICAgIH0pO1xuXG4gICAgfVxuXG4gICAgdW53YXRjaFN0YXRlKGluV2F0Y2hlckZ1bmN0aW9uKSB7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS5zdGF0ZVdhdGNoZXJzLmRlbGV0ZShpbldhdGNoZXJGdW5jdGlvbik7XG4gICAgfVxuXG4gICAgd2F0Y2hTdGF0ZShpbldhdGNoZXJGdW5jdGlvbikge1xuICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcykuc3RhdGVXYXRjaGVycy5hZGQoaW5XYXRjaGVyRnVuY3Rpb24pO1xuICAgIH1cblxuICAgIGludmFsaWRhdGUoKSB7XG4gICAgICAgIGlmICghX3ByaXZhdGUuZ2V0KHRoaXMpLndpbGxSZW5kZXIpIHtcbiAgICAgICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS53aWxsUmVuZGVyID0gdHJ1ZTtcbiAgICAgICAgICAgIG1pY3JvdGFzayh0aGlzLnJlbmRlci5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlcihpbk1vZGVsKSB7XG4gICAgICAgIF9wcml2YXRlLmdldCh0aGlzKS53aWxsUmVuZGVyID0gZmFsc2U7XG4gICAgICAgIGlmIChfcHJpdmF0ZS5nZXQodGhpcykuaGFzRGVmYXVsdFRlbXBsYXRlKSB7XG4gICAgICAgICAgICBjb25zdCBkZWxlZ2F0ZSA9IGZhY3RvcnkuZ2V0VGVtcGxhdGluZ0RlbGVnYXRlKCk7XG4gICAgICAgICAgICBjb25zdCBtb2RlbCA9IGluTW9kZWwgP1xuICAgICAgICAgICAgICAgIE9ic2VydmFibGVPYmplY3QuZnJvbU9iamVjdChpbk1vZGVsKSA6XG4gICAgICAgICAgICAgICAgdGhpcy5wYWdlLnJlc29sdmVOb2RlTW9kZWwodGhpcy5ub2RlKTtcbiAgICAgICAgICAgIGRlbGVnYXRlLnJlbmRlcihcbiAgICAgICAgICAgICAgICAnX2RlZmF1bHQuJyArIHRoaXMubmFtZSxcbiAgICAgICAgICAgICAgICBtb2RlbCkudGhlbigoaW5IdG1sKSA9PiB7XG4gICAgICAgICAgICAgICAgJCh0aGlzLm5vZGUpLmh0bWwoaW5IdG1sKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFmdGVyUmVuZGVyICYmIHRoaXMuYWZ0ZXJSZW5kZXIoKTsgLy9qc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgICAgICAgICAgICBfcHJpdmF0ZS5nZXQodGhpcylcbiAgICAgICAgICAgICAgICAgICAgLmxpZmVjeWNsZVNpZ25hbC5kaXNwYXRjaCgncmVuZGVyZWQnKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChpbkVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihpbkVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IENvbXBvbmVudDtcbiIsIid1c2Ugc3RyaWN0JztcbmltcG9ydCB7aXNBcnJheSwgbWVyZ2VXaXRoLCBtZXJnZX0gZnJvbSAnbG9kYXNoJztcbmltcG9ydCBwYWdlRmFjdG9yeSBmcm9tICcuL3BhZ2UtZmFjdG9yeSc7XG5sZXQgX2NvbmZpZywgX21vZGVsLCBfY29uc3RydWN0b3JGblxuXG5jbGFzcyBNYXN0ZXJQYWdlIHtcblxuICAgIGNvbnN0cnVjdG9yKGluQ29uZmlnLCBpbk1vZGVsLCBpbkNvbnN0cnVjdG9yRm4pIHtcbiAgICAgICAgX2NvbmZpZyA9IGluQ29uZmlnO1xuICAgICAgICBfbW9kZWwgPSBpbk1vZGVsO1xuICAgICAgICBfY29uc3RydWN0b3JGbiA9IGluQ29uc3RydWN0b3JGbjtcbiAgICB9XG5cbiAgICBjcmVhdGUoaW5Db25maWcsIGluTW9kZWwsIGluQ29uc3RydWN0b3JGbikge1xuICAgICAgICAvL1RPRE86IG1lcmdlIHBhcmFtcyB3aXRoIHRlbXBsYXRlIHBhcmFtcy4gd3JhcCBjb25zdHJ1Y3RvclxuXG4gICAgICAgIGZ1bmN0aW9uIGN1c3RvbWl6ZXIob2JqVmFsdWUsIHNyY1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAoaXNBcnJheShvYmpWYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqVmFsdWUuY29uY2F0KHNyY1ZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IHt9O1xuICAgICAgICBtZXJnZVdpdGgoY29uZmlnLCBfY29uZmlnLCBpbkNvbmZpZywgY3VzdG9taXplcik7XG5cbiAgICAgICAgY29uc3QgbW9kZWwgPSB7fTtcbiAgICAgICAgbWVyZ2UobW9kZWwsIF9tb2RlbCwgaW5Nb2RlbCk7XG5cbiAgICAgICAgY29uc3QgY29uc3RydWN0b3JGbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgX2NvbnN0cnVjdG9yRm4uY2FsbCh0aGlzKTtcbiAgICAgICAgICAgIGluQ29uc3RydWN0b3JGbi5jYWxsKHRoaXMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBwYWdlRmFjdG9yeS5wYWdlKGNvbmZpZywgbW9kZWwsIGNvbnN0cnVjdG9yRm4pO1xuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWFzdGVyUGFnZTtcbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IE9ic2VydmFibGVPYmplY3QgZnJvbSAnLi9PYnNlcnZhYmxlT2JqZWN0JztcblxuY2xhc3MgQ29tcG9uZW50TW9kZWwgZXh0ZW5kcyBPYnNlcnZhYmxlT2JqZWN0IHtcblx0Y29uc3RydWN0b3IoaW5EYXRhLCBpblJvb3RQcm9wZXJ0aWVzKSB7XG5cdFx0c3VwZXIoKTtcblx0XHRpblJvb3RQcm9wZXJ0aWVzLmRhdGEgPSBpbkRhdGE7XG5cdFx0dGhpcy5maWxsKGluUm9vdFByb3BlcnRpZXMpO1xuXHR9XG59XG5cbmV4cG9ydCBkZWZhdWx0IENvbXBvbmVudE1vZGVsOyJdLCJuYW1lcyI6WyJvYnNlcnZlciIsIl9wcml2YXRlIiwiaGFzIiwiT2JzZXJ2YWJsZU9iamVjdCIsImVhY2giLCJrZXlzIiwiaXNQbGFpbk9iamVjdCIsImlzQXJyYXkiLCJnZXQiLCJmaW5kIiwibWFwIiwiaXNTdHJpbmciLCJTaWduYWwiLCJfc2V0dXBNb2RlbCIsIl9maW5kU3RhdGUiLCJfd2F0Y2hTdGF0ZSIsImZhY3RvcnkiLCJpc0Z1bmN0aW9uIiwiQ29tcG9uZW50IiwiJCIsIl9wYWdlIiwiYWN0aW9uIiwiaW5jbHVkZXMiLCJ0cmFuc2Zvcm0iLCJhZVJlbmRlciIsImFlQmluZCIsImFlQWN0aW9uIiwiYWVSYWRpbyIsImFlQ2hlY2tib3giLCJhZVN0YXRlIiwiYWVFYWNoIiwiYWVNYW5hZ2VkIiwiX2NvbmZpZyIsIm1lcmdlIiwibWVyZ2VXaXRoIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBRUksSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDOztJQUVsQixJQUFJLEtBQUs7SUFBRUE7QUFFWCxJQUFJLElBQUksQ0FBQyxPQUFPLElBQUksT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsS0FBSyxVQUFVLEVBQUU7O1FBRTdELElBQUksSUFBSSxDQUFDLFlBQVksSUFBSSxJQUFJLENB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