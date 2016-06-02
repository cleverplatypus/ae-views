'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var _$1 = _interopDefault(require('lodash'));
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
            if (_$1.has(_p.children, propName) && segs.length) {
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
        const isCollection = (_$1.get(inConfig, 'isCollection') === true);
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
        if(this.isCollection) {
            for (var item of src) {
                yield item;
            }
        } else {
            for(let key in src) {
                const out = {};
                out[key] = src[key];
                yield out;
            }
        }
    }


    fill(inData, inSilent) {
        const _p = _private$1.get(this);
        _p.props._obj = this.isCollection ? [] : {};
        if (_$1.keys(inData).length) {
            this.merge(inData, inSilent);
        } else {
            if (!inSilent) {
                _p.changesQueue.push({
                    path: '',
                    change : {
                        type: 'emptied',
                        newValue : _p.props._obj
                    }
                });
                ObservableObject$1.notifyWatchers(_p);
            }
        }


    }

    merge(inData, inSilent) {

        if (!_$1.isPlainObject(inData) && !_$1.isArray(inData)) {
            throw new Error('ObservableObject.fill() must be passed a plain object');
        }
        _$1.each(inData, (inValue, inKey) => {
            this.prop(inKey, ObservableObject$1.fromObject(inValue), inSilent);
        });
    }

    static fromObject(inData) {
        if (_$1.isArray(inData)) { //REFACTOR: duplicated code?
            let a = new ObservableObject$1({ isCollection: true });
            _$1.each(inData, function(inVal, inKey) {
                a.prop(inKey, ObservableObject$1.fromObject(inVal));
            });
            return a;
        } else if (_$1.isPlainObject(inData)) {
            let o = new ObservableObject$1();
            _$1.each(inData, function(inVal, inKey) {
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
            return _$1.keys(_p.props._obj).length;
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
        }
    }


    watch(inPath, inHandler) {
        const _p = _private$1.get(this);
        _p.observer.listen(inPath, inHandler);
    }

    toNative(inDeep) {
        var out = _private$1.get(this).isCollection ? [] : {};
        _$1.each(_private$1.get(this).props._obj, (inVal, inKey) => {
            let isObservable = inVal instanceof Observable;
            out[inKey] = isObservable && inDeep === true ? inVal.toNative(true) : inVal;
        });
        return out;
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
        if(!inTarget || !(inTarget instanceof ObservableObject$1)) {
            throw new error('fill() can only be invoked on an ObservableObject');
        }
        let dest = inTarget;
        if(_$1.isString(inPath) && inPath.length) {
            dest = inTarget.prop(inPath);

        }
        if(!inTarget || !(inTarget instanceof ObservableObject$1)) {
            throw new error('Cannot resolve ObservableObject to fill');
        }

        dest.fill(inContent);
        const _p = _private$1.get(inTarget);
        if (!inSilent) {
            _p.changesQueue.push({
                path: inPath,
                change : {
                    type: 'filled',
                    newValue : inContent
                }
            });
            ObservableObject$1.notifyWatchers(_p);
        }
    
        
    }


    empty(inSilent) {
        this.fill(null, inSilent);
    }
}

const _private$3 = new WeakMap();

class State {
	constructor(...rest) {	
		let name = _$1.find(rest, (param) => _$1.isString(param)) || '';
		let children = _$1.find(rest, (param) => _$1.isArray(param));
		let parent = _$1.find(rest, (param) => param instanceof State);

		children = _$1.map(children, (inValue) => {
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
		return _$1.find(_private$3.get(this).children, (inChild) => inChild.getName() === inName);
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

const _conformsToComponentModel$1 = function _conformsToComponentModel(inOrig) {
    if(!inOrig) {
        return false;
    }
    if(inOrig instanceof Observable) {
        return inOrig.prop('data') !== undefined &&
            inOrig.prop('_state') !== undefined &&
            inOrig.prop('_nextState') !== undefined;
    } else {
        return _$1.isPlainObject(inOrig) &&
            inOrig.data !== undefined &&
            inOrig._state !== undefined &&
            inOrig._nextState !== undefined;
    }

};


const _watchState$1 = function _watchState() {
    this.model.watch('_nextState', (inPath, inChanges) => {
        let nextState = _findState$1.bind(this)(inChanges.newValue);
        if (!nextState) {
            console.warn('Changing to unknown state: ' +
                inChanges.newValue);
            return;
        }
        const rollback = (inReason) => {
            inReason && console.debug('Could not change state because: ' + inReason); //jshint ignore:line
            this.model.prop('_nextState', inChanges.oldValue, true);
            currentState.didntLeave();
            for (let watcher of _private$5.get(this).stateWatchers) {
                watcher(inChanges.newValue, inChanges.oldValue, inReason);
            }
        };
        let currentState = _private$5.get(this).currentState;
        if (currentState) {
            currentState.leaving(inChanges.newValue).then(() => {
                nextState.entering(inChanges.oldValue).then(() => {
                    _private$5.get(this).currentState = nextState;
                    this.model.prop('_state', this.model.prop('_nextState'));
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
            lifecycleSignal : lifecycleSignal
        });

        Object.defineProperty(this, 'lifecycle', { 
            get : function() { 
                return lifecycle;
            }
        });

        this.config = inConfig;
        this.page = inPage;
        this.bus = new Bus(inPage ? inPage.bus : null); //jshint ignore:line
        this.name = inConfig.name;
        _$1.each(inConfig.actions, (inAction) => {
            if(!inAction) {
                console.error('Passed a null action to component config');
                return;
            }
            const actionName = _$1.isString(inAction) ? inAction : inAction.name;
            if(!actionName) {
                console.error('Passed an object with no action name as action in component config');
                return;
            }
            const handler = _$1.isPlainObject(inAction) ? inAction.handler : undefined;

            if(handler && !_$1.isFunction(handler)) {
                console.error('Passed a non-function action handler in component config');
                return;
            }
            if(_$1.isPlainObject(inAction) && inAction.publish === true) {
                this.bus.publishAction(actionName, handler ? handler.bind(this) : null);
            } else {
                this.bus.addAction(actionName, handler ? handler.bind(this) : null);
            }
            
        });
        let templates = inConfig.templates || {};

        this.model = _conformsToComponentModel$1(inInitObj) ?
            ObservableObject$1.fromObject(inInitObj) :
            ObservableObject$1.fromObject({
                data: inInitObj,
                _state: '',
                _nextState: ''
            });
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
        _private$5.get(this).currentState = this.states;
        inConstructor && inConstructor.bind(this)(); //jshint ignore:line

    }

    getCurrentState() {
        return _private$5.get(this).currentState;
    }

    tryState(inStateName) {
        if (inStateName === this.model.prop('_state')) {
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
            this.model.prop('_nextState', inStateName);
        });

    }

    unwatchState(inWatcherFunction) {
        _private$5.get(this).stateWatchers.delete(inWatcherFunction);
    }

    watchState(inWatcherFunction) {
        _private$5.get(this).stateWatchers.add(inWatcherFunction);
    }

    render(inModel) {
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
                        inPath = 'data' + (inPath ? '.' + inPath : '');
                    }
                    resolvePromise(_page.resolveNodeModel(inNode, inPath).prop(inPath));

                });
            };

            this.bindPath = function bindPath(inNode, inPath, inHandler) {
                if (!/^_/.test(inPath)) {
                    inPath = 'data.' + inPath;
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

function each(inPage) {
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

        component.watchState(watcher);
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

    var proto = Object.create(Element.prototype);
    proto.createdCallback = function() {
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
        let input = `<input type="checkbox" class="${$(this).attr('input-class') || ''}" value="${$(this).attr('value') || ''}">`;
        let out =
            `<label class="${$(this).attr('label-class') || ''}">${input}<span>${$(this).attr('label') || ''}</span></label>`;
        $(this).append(out);
    };
    proto.valueChangedHook = function(inHandler) {
        const handler = function() {
            inHandler($(this).find('input').attr('value'));
        };
        if (_$1.isFunction(inHandler)) {
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
        if (_$1.isFunction(inHandler)) {
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

var UNRESOLVED = Symbol('unresolved');

let _page$1;


/* 
 * REFACTOR: move this to library. 
 * Typification should be html node agnostic therefore some kind
 * of delegation should be used or the tilde string handling has to be
 * hanled after returning
 */
var typifyParams = function typifyParams(inActionNode, inParams) {
    var out = {};
    _$1.each(inParams, function(inParamValue, inParamKey) {
        if (!inParamValue) {
            out[inParamKey] = null;
        } else if (_$1.isString(inParamValue) && /^~/.test(inParamValue)) {
            let resolvedValue = UNRESOLVED;
            _page$1.getDataSource()
                .resolve(inActionNode, inParamValue.replace('~', '')).then((inValue) => {
                    resolvedValue = inValue;
                });
            if (resolvedValue === UNRESOLVED) {
                throw new Error('Action parameters must be resolved synchronously');
            }
            out[inParamKey] = resolvedValue;
        } else if (_$1.isString(inParamValue) && /^`.*`$/.test(inParamValue)) {
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
};

var assembleParams = function(inActionNode) {
    let params = {};
    $($(inActionNode).get(0).attributes).each(function() {
        if (/^param-/.test(this.name)) {
            params[this.name.replace('param-', '')] = this.value;
        }
    });
    return typifyParams(inActionNode, params);
};

const _resolveTargets = function _resolveTargets() {
    let target = {};
    if ($(this).children().length) {
        target.node = $(this).children().get(0);
    } else {
        const targetAttr = $(this).attr('target');
        if (!targetAttr) {
            target.node = $(this).parent();
        } else if (targetAttr === 'next') {
            target.node = $(this).next();
        } else if (/^closest/.test(targetAttr)) {
            const segs = targetAttr.split(/\s+/);
            target.node = $(this).closest(segs[1]);
        } else if (/^(\.|\#)/.test(targetAttr)) {
            target.node = $(this).parent().find(targetAttr);
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

const _attachAction = function _attachAction() {
    let target = _resolveTargets.call(this);
    if (_$1.get(target, 'pending') === true) {
        const observer = new MutationObserver((mutations) => {
            _attachAction.call(this);
        });
        var observerConfig = {
            subtree: true,
            childList : true
        };
        observer.observe(this.parentNode, observerConfig);
    } else {
        const actionName = $(this).attr('name');
        _$1.each(target.node, (inTargetNode) => {
            const component = _page$1.resolveNodeComponent(inTargetNode);
            let event;

            let trigger = $(this).attr('trigger') || '';
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


            $(inTargetNode).off(event).on(event, (inEvent) => {
                if (trigger === 'enter' && inEvent.keyCode !== 13) {
                    return;
                }
                if (trigger === 'esc' && inEvent.keyCode !== 27) {
                    return;
                }
                component.bus.triggerAction(
                    actionName,
                    inEvent,
                    assembleParams(this)
                );
            });
        });
    }
};


function action$1(inPage) {

    _page$1 = inPage;

    var proto = Object.create(Element.prototype);

    proto.createdCallback = function() {
       
    };

    proto.attachedCallback = function() {
 _attachAction.call(this);
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
        let eventName = inConfig.event;
        if(!eventName) {

            switch ($(inElement).get(0).nodeName.toUpperCase()) {
                case 'INPUT':
                    if (_$1.includes(['TEXT', 'EMAIL', 'TEL', 'PASSWORD'], $(inElement).attr('type').toUpperCase())) {
                        eventName = (commitOnly ? 'change' : 'keyup');
                    } else if (_$1.includes(['CHECKBOX', 'RADIO'], $(inElement).attr('type').toUpperCase())) {
                        eventName = 'click';
                    }
                    break;
                case 'SELECT':
                    eventName = 'change';
                    break;
                default:
                    eventName = 'keydown';
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
        
        $(inElement).off(eventName, handler).on(eventName, handler);
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
                    $(inElement).val(inValue);
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
                    } else if (_$1.isString(condition)) {
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

            dataSource.bindPath(this, fromAttr, function(inNewValue) {
                valueResolver(inNewValue);
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
            _$1.each(this.attributes, (inAttribute) => {
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
    const _page = inPage;
    var proto = Object.create(Element.prototype);

    var render = function render() {
        let templateName = $(this).attr('template');

        const path = $(this).attr('from');
        _page.getDataSource().resolve(this, path).then((inValue) => {
            const attrs = _.transform(this.attributes, function(result, item) {
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
        render.bind(this)();
        var observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (/^param-/.test(mutation.attributeName)) {
                    render.bind(this)();
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
                    render.call(this);
                });
            } else {
                render.call(this);
            }
            render.call(this);
        });
        if ($(this).attr('watch')) {
            _page.getDataSource().bindPath(this, $(this).attr('watch'), (inBaseModel) => {
                console.log('should render now');
                console.log(inBaseModel instanceof Observable ? inBaseModel.toNative(true) : inBaseModel);
                render.call(this);
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
*/
function aeSwitch(inPage) {
    const _page = inPage;
    const _private = new WeakMap();

    const selectHandler = function selectHandler(inSelectedElement) {
        const _p = _private.get(this);
        const state = $(inSelectedElement).data('ae-switch-value');
        $(this).children().removeClass(_p.selectedClass);
        $(inSelectedElement).addClass(_p.selectedClass);
        if(_p.source === '_state') {
            _p.target.tryState(state);
        }
        console.log('switch element clicked: ' + $(inSelectedElement).data('ae-switch-value'));
    };
    
    var proto = Object.create(Element.prototype);
    proto.createdCallback = function() {
        _private.set(this, {
            selectedClass: $(this).attr('selected-class') || 'selected',
            source : $(this).attr('path') || '_state'
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
            //TODO: register click handlers
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

        // configuration of the observer:
        const config = { attributes: true };
        // pass in the target node, as well as the observer options
        observer.observe(this, config);
        const inputType = $(this).attr('type') || 'text';
        let bindingAttrName;
        _$1.each($(this.attributes), (inAttribute) => {
            if (['from', 'to', 'path'].indexOf(inAttribute.name) !== -1) {
                bindingAttrName = inAttribute.name;
            }
        });
        const bindingNode = bindingAttrName ? `<ae-bind target="next" ${bindingAttrName}="${$(this).attr(bindingAttrName)}"></ae-bind>` : '';
        const labelText = $(this).attr('label');
        const placeholder = $(this).attr('placeholder') || '';
        const inputName = $(this).attr('name') || 'ae-' + uuid.v4();
        const valueAttr = $(this).attr('value') ? `value="${$(this).attr('value')}` : '';
        const input = `<input name="${inputName}" type="${inputType}" placeholder="${placeholder}" class="${$(this).attr('input-class') || ''}" ${valueAttr}>`;
        const label = labelText ? `<label for="${inputName}" class="${$(this).attr('label-class') || ''}">${labelText}</label>` : '';

        $(this).append(`${label}${bindingNode}${input}`);
    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {
        observer.disconnect();
    };

    document.registerElement('ae-text-input', { prototype: proto });
}

$.fn.extend({
    getPath: function () {
        var path, node = this;
        while (node.length) {
            var realNode = node[0], name = realNode.localName;
            if (!name) break;
            name = name.toLowerCase();

            var parent = node.parent();

            var sameTagSiblings = parent.children(name);
            if (sameTagSiblings.length > 1) { 
                allSiblings = parent.children();
                var index = allSiblings.index(realNode) + 1;
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

    action(inPage);
    each(inPage);
    state(inPage);
    checkbox(inPage);
    radio(inPage);
    action$1(inPage);
    bind(inPage);
    render(inPage);
    aeSwitch(inPage);
    aeTextInput(inPage);
};

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
        if (inPath && !/^(_state|_nextState)/.test(inPath.split('.')[0]) &&
            !component.model.prop('data')) {
            return this.resolveNodeModel($(component.node).parent(), inPath);
        }
        return component.model;
    }

    resolveNodeComponent(inNode) {
        let node = $(inNode).get(0);
        ;
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

    render() {
        super.render();
        $(this.mountPoint).css('display', '');
    }

    registerComponent(inConfig, inModelPrototype, inConstructor) {
        this.registerComponentElement({
            config: inConfig,
            modelPrototype: inModelPrototype,
            constructor: inConstructor
        });
    }

    registerComponentElement(inDefinition) {
        var proto = Object.create(HTMLDivElement.prototype);
        var that = this;
        let component;
        const name = inDefinition.config.name;

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
        if (!params.key || !params.match) {
            chunk.write('');
        } else {
            var re = new RegExp(params.match);
            if (re.test(params.key)) {
                if (body) {
                    chunk = chunk.render(body, context);
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
        if (!_.isString(inValue)) {
            return;
        }
        inValue = inValue.replace(/\D/g, '');
        if (/\d+\d{4}/.test(inValue)) {
            var match = inValue.match(/(\d+)(\d{4})$/);
            return match[1].replace(/(.)/g, 'x') + '-' + match[2];
        }
        return '';
    };

    dust.filters.tolower = function(inValue) {
        return _.isString(inValue) ? inValue.toLowerCase() : inValue;
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
            chunk.write(_.keys(params.key.constructor).length);
        }
        return chunk;
    };

    dust.helpers.calc = function(chunk, context, bodies, params) {
        var result;
        if (_.get(window, 'math.eval')) {
            result = _.get(window, 'math').eval(context.resolve(bodies.block));
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
        level = level || "INFO";
        helper = helper ? '{@' + helper + '}: ' : '';
        dust.log(helper + msg, level);
    }

    var _deprecatedCache = {};

    function _deprecated(target) {
        if (_deprecatedCache[target]) {
            return;
        }
        log(target, "Deprecation warning: " + target + " is deprecated and will be removed in a future version of dustjs-helpers", "WARN");
        log(null, "For help and a deprecation timeline, see https://github.com/linkedin/dustjs-helpers/wiki/Deprecated-Features#" + target.replace(/\W+/g, ""), "WARN");
        _deprecatedCache[target] = true;
    }

    function isSelect(context) {
        return context.stack.tail &&
            context.stack.tail.head &&
            typeof context.stack.tail.head.__select__ !== "undefined";
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
            .push({ "__select__": state })
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
        if (typeof value === "function") {
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
            log(helperName, "No key specified", "WARN");
            return chunk;
        }

        type = params.type || selectState.type;

        key = coerce(context.resolve(key), type);
        value = coerce(context.resolve(params.value), type);

        if (test(key, value)) {
            // Once a truth test passes, put the select into "pending" state. Now we can render the body of
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
        "tap": function(input, chunk, context) {
            // deprecated for removal in 1.8
            _deprecated("tap");
            return context.resolve(input);
        },

        "sep": function(chunk, context, bodies) {
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

        "first": function(chunk, context, bodies) {
            if (context.stack.index === 0) {
                return bodies.block(chunk, context);
            }
            return chunk;
        },

        "last": function(chunk, context, bodies) {
            if (context.stack.index === context.stack.of - 1) {
                return bodies.block(chunk, context);
            }
            return chunk;
        },

        /**
         * {@contextDump}
         * @param key {String} set to "full" to the full context stack, otherwise the current context is dumped
         * @param to {String} set to "console" to log to console, otherwise outputs to the chunk
         */
        "contextDump": function(chunk, context, bodies, params) {
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
        "math": function(chunk, context, bodies, params) {
            var key = params.key,
                method = params.method,
                operand = params.operand,
                round = params.round,
                output, state, x, len;

            if (!params.hasOwnProperty('key') || !params.method) {
                log("math", "`key` or `method` was not provided", "ERROR");
                return chunk;
            }

            key = parseFloat(context.resolve(key));
            operand = parseFloat(context.resolve(operand));

            switch (method) {
                case "mod":
                    if (operand === 0) {
                        log("math", "Division by 0", "ERROR");
                    }
                    output = key % operand;
                    break;
                case "add":
                    output = key + operand;
                    break;
                case "subtract":
                    output = key - operand;
                    break;
                case "multiply":
                    output = key * operand;
                    break;
                case "divide":
                    if (operand === 0) {
                        log("math", "Division by 0", "ERROR");
                    }
                    output = key / operand;
                    break;
                case "ceil":
                case "floor":
                case "round":
                case "abs":
                    output = Math[method](key);
                    break;
                case "toint":
                    output = parseInt(key, 10);
                    break;
                default:
                    log("math", "Method `" + method + "` is not supported", "ERROR");
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
        "select": function(chunk, context, bodies, params) {
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
                log("select", "Missing body block", "WARN");
            }
            return chunk;
        },

        /**
         * Truth test helpers
         * @param key a value or reference to use as the left-hand side of comparisons
         * @param value a value or reference to use as the right-hand side of comparisons
         * @param type if specified, `key` and `value` will be forcibly cast to this type
         */
        "eq": truthTest('eq', function(left, right) {
            return left === right;
        }),
        "ne": truthTest('ne', function(left, right) {
            return left !== right;
        }),
        "lt": truthTest('lt', function(left, right) {
            return left < right;
        }),
        "lte": truthTest('lte', function(left, right) {
            return left <= right;
        }),
        "gt": truthTest('gt', function(left, right) {
            return left > right;
        }),
        "gte": truthTest('gte', function(left, right) {
            return left >= right;
        }),

        /**
         * {@any}
         * Outputs as long as at least one truth test inside a {@select} has passed.
         * Must be contained inside a {@select} block.
         * The passing truth test can be before or after the {@any} block.
         */
        "any": function(chunk, context, bodies, params) {
            var selectState = getSelectState(context);

            if (!selectState) {
                log("any", "Must be used inside a {@select} block", "ERROR");
            } else {
                if (selectState.isDeferredComplete) {
                    log("any", "Must not be nested inside {@any} or {@none} block", "ERROR");
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
        "none": function(chunk, context, bodies, params) {
            var selectState = getSelectState(context);

            if (!selectState) {
                log("none", "Must be used inside a {@select} block", "ERROR");
            } else {
                if (selectState.isDeferredComplete) {
                    log("none", "Must not be nested inside {@any} or {@none} block", "ERROR");
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
        "size": function(chunk, context, bodies, params) {
            var key = params.key,
                value, k;

            key = context.resolve(params.key);
            if (!key || key === true) {
                value = 0;
            } else if (dust.isArray(key)) {
                value = key.length;
            } else if (!isNaN(parseFloat(key)) && isFinite(key)) {
                value = key;
            } else if (typeof key === "object") {
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

};

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
                return _.get(inBase, inPath);
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

    page(inConfig, inModel, inSetupFunction) {
    	 _templatingDelegate = inConfig.templatingDelegate || dustTemplatingDelegate(inConfig.evilFunction);
        let page = new Page(inConfig, inModel, inSetupFunction);
        return page;
    }
}


var pageFactory = new PageFactory();

const _private = privateHash('component');

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

const _conformsToComponentModel = function _conformsToComponentModel(inOrig) {
    if(!inOrig) {
        return false;
    }
    if(inOrig instanceof Observable) {
        return inOrig.prop('data') !== undefined &&
            inOrig.prop('_state') !== undefined &&
            inOrig.prop('_nextState') !== undefined;
    } else {
        return _$1.isPlainObject(inOrig) &&
            inOrig.data !== undefined &&
            inOrig._state !== undefined &&
            inOrig._nextState !== undefined;
    }

};


const _watchState = function _watchState() {
    this.model.watch('_nextState', (inPath, inChanges) => {
        let nextState = _findState.bind(this)(inChanges.newValue);
        if (!nextState) {
            console.warn('Changing to unknown state: ' +
                inChanges.newValue);
            return;
        }
        const rollback = (inReason) => {
            inReason && console.debug('Could not change state because: ' + inReason); //jshint ignore:line
            this.model.prop('_nextState', inChanges.oldValue, true);
            currentState.didntLeave();
            for (let watcher of _private.get(this).stateWatchers) {
                watcher(inChanges.newValue, inChanges.oldValue, inReason);
            }
        };
        let currentState = _private.get(this).currentState;
        if (currentState) {
            currentState.leaving(inChanges.newValue).then(() => {
                nextState.entering(inChanges.oldValue).then(() => {
                    _private.get(this).currentState = nextState;
                    this.model.prop('_state', this.model.prop('_nextState'));
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
            lifecycleSignal : lifecycleSignal
        });

        Object.defineProperty(this, 'lifecycle', { 
            get : function() { 
                return lifecycle;
            }
        });

        this.config = inConfig;
        this.page = inPage;
        this.bus = new Bus(inPage ? inPage.bus : null); //jshint ignore:line
        this.name = inConfig.name;
        _$1.each(inConfig.actions, (inAction) => {
            if(!inAction) {
                console.error('Passed a null action to component config');
                return;
            }
            const actionName = _$1.isString(inAction) ? inAction : inAction.name;
            if(!actionName) {
                console.error('Passed an object with no action name as action in component config');
                return;
            }
            const handler = _$1.isPlainObject(inAction) ? inAction.handler : undefined;

            if(handler && !_$1.isFunction(handler)) {
                console.error('Passed a non-function action handler in component config');
                return;
            }
            if(_$1.isPlainObject(inAction) && inAction.publish === true) {
                this.bus.publishAction(actionName, handler ? handler.bind(this) : null);
            } else {
                this.bus.addAction(actionName, handler ? handler.bind(this) : null);
            }
            
        });
        let templates = inConfig.templates || {};

        this.model = _conformsToComponentModel(inInitObj) ?
            ObservableObject$1.fromObject(inInitObj) :
            ObservableObject$1.fromObject({
                data: inInitObj,
                _state: '',
                _nextState: ''
            });
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
        _private.get(this).currentState = this.states;
        inConstructor && inConstructor.bind(this)(); //jshint ignore:line

    }

    getCurrentState() {
        return _private.get(this).currentState;
    }

    tryState(inStateName) {
        if (inStateName === this.model.prop('_state')) {
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
            this.model.prop('_nextState', inStateName);
        });

    }

    unwatchState(inWatcherFunction) {
        _private.get(this).stateWatchers.delete(inWatcherFunction);
    }

    watchState(inWatcherFunction) {
        _private.get(this).stateWatchers.add(inWatcherFunction);
    }

    render(inModel) {
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
            if (_$1.isArray(objValue)) {
                return objValue.concat(srcValue);
            }
        }

        const config = {};
        _$1.mergeWith(config, _config$1, inConfig, customizer);

        const model = {};
        _$1.merge(model, _model, inModel);

        const constructorFn = function() {
            _constructorFn.call(this);
            inConstructorFn.call(this);
        };

        return pageFactory.page(config, model, constructorFn);
    }
}

exports.Component = Component;
exports.Page = Page;
exports.State = State;
exports.pagefactory = pageFactory;
exports.TemplatingDelegate = TemplatingDelegate;
exports.MasterPage = MasterPage;
exports.ObservableObject = ObservableObject$1;
exports.UNRESOLVED = UNRESOLVED;