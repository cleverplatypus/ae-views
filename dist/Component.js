'use strict';
const microtask = require('./microtask');
const ObservableObject = require('./ObservableObject');
const ComponentModel = require('./ComponentModel');
const State = require('./State');
const Bus = require('./Bus');
const isString = require('lodash.isstring');
const isFunction = require('lodash.isfunction');
const isPlainObject = require('lodash.isplainobject');
const each = require('lodash.foreach');
const get = require('lodash.get');
const $ = require('jquery');
const ComponentLifecycle = require('./ComponentLifecycle');
const Signal = require('signals').Signal;
const privateHash = require('./util/private');
const result = require('lodash.result');
const templatingDelegate = require('./delegate/dust-templating-delegate');
const _private = privateHash('component');

const _setupModel = function _setupModel(inModel) {
    if (isPlainObject(inModel)) {
        return new ComponentModel(inModel);
    } else if (!!inModel && !(Object.getPrototypeOf(inModel) instanceof ComponentModel)) {
        throw new Error('Attempt to use an invalid object as Component model');
    } else if (!inModel) {
        return null;
    }
    return inModel;
};

const _findState = function _findState(inState) {
    if (!inState) {
        return this.states;
    }
    const statePath = isString(inState) ? inState : inState.getPath();
    let path = statePath.split('.');
    let currentState = this.states;
    while (path.length && currentState) {
        let seg = path.shift();
        currentState = currentState.child(seg);
    }
    return currentState;
};


const _watchState = function _watchState() {
    const _p = _private.get(this);

    _p.stateInfo.watch('[nextState]', (inPath, inChanges) => {
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
            (currentState.leaving(inChanges.newValue) || Promise.resolve()).then(() => {
                (nextState.entering(inChanges.oldValue) || Promise.resolve()).then(() => {

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


const componentConfigPreprocessor = function componentConfigPreprocessor(inConfig) {
    if (!inConfig || !inConfig.templates || isPlainObject(inConfig.templates)) {
        return;
    }
    const templatesObj = {};
    each(inConfig.templates, (inValue) => {
        if (isPlainObject(inValue)) {
            each(inValue, (inTemplate, inKey) => {
                templatesObj[inKey] = inTemplate;
            });
        } else {
            if (!isFunction(inValue)) {
                throw new Error('Templates in component config must be either a dust template reference or a { name : templateFn} tuple');
            }
            templatesObj[inValue._defaultName] = inValue;
        }
        inConfig.templates = templatesObj;
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
        this._renderCount = 0;

        const lifecycleSignal = new Signal();
        const lifecycle = new ComponentLifecycle(lifecycleSignal);
        this.microtask = microtask;
        _private.set(this, {
            stateWatchers: new Set(),
            lifecycleSignal: lifecycleSignal,
            stateInfo: new ObservableObject(),
            resolvers: inConfig.resolvers,
            active: true,
            model: _setupModel(inInitObj)
        });

        Object.defineProperty(this, 'lifecycle', {
            get: function() {
                return lifecycle;
            }
        });


        componentConfigPreprocessor(inConfig);

        this._properties = {};
        this.config = inConfig;

        this.page = inPage || this;
        this.bus = new Bus(this); //jshint ignore:line
        this.name = inConfig.name;
        this.isComponent = function isComponent() {
            return true;
        };
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
                this.bus.publishAction(actionName, handler ? handler.bind(this) : null, this);
            } else {
                this.bus.addAction(actionName, handler ? handler.bind(this) : null);
            }

        });
        let templates = inConfig.templates || {};

        _setupModel.call(this, inInitObj);

        this.hasModel = (inName) => {
            if (inName) {
                return !!result(inConfig, 'models.' + inName);
            }

            return !!_private.get(this).model;
        };

        this.getModel = (inName) => {
            if (!inName) {
                return this.page.resolveNodeModel(this.node);
            }
            if (this.hasModel(inName)) {
                return result(inConfig, 'models.' + inName) || _private.get(this).model;
            }
            if (this === this.page) {
                LOG.warn('Model ' + inName + ' is not registered with the page');
                return;
            }
            return this.page.getModel(inName);
        };

        for (let templateName in templates) {
            let actualTemplateName = templateName === '_default' ?
                '_default.' + this.name :
                templateName;
            templatingDelegate
                .register(actualTemplateName, templates[templateName]);
        }
        _private.get(this).hasDefaultTemplate = !!templates._default;
        _watchState.bind(this)();
        this.states = this.states || new State();
        _private.get(this).stateInfo.prop('currentStateObject', this.states);
        inConstructor && inConstructor.bind(this)(); //jshint ignore:line

        microtask(this.initState.bind(this));
    }

    getController(inName) {
        let controller = get(this.config, 'controllers.' + inName);
        if (!controller && this === this.page) {
            LOG.warn('Controller ' + inName + ' is not registered with the page');
        } else if (!controller) {
            return this.page.getController(inName);
        }
        return controller;
    }


    data(inPath, inValue, inSilent) {
        const model = this.page.resolveNodeModel(this.node);
        if (isPlainObject(inPath)) {
            model.prop('data', inPath);
        }
        const path = 'data' + (inPath ? '.' + inPath : '');
        if (model) {
            return model.prop(path, inValue, inSilent);
        } else if (this !== this.page) {
            return this.page.resolveNodeModel(this.node).prop(path, inValue, inSilent);
        }
        return null;
    }

    get properties() {
        return this._properties;
    }

    attr(inName) {
        return $(this.node).attr(inName);
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

    get model() {
        return _private.get(this).model;
    }

    initState() {

        let defaultState;
        const descend = (inParent) => {
            each(inParent.children, (inChild) => {
                if (!!this.page.getStartupState()) {
                    if (this.page.getStartupState() === inChild.getPath()) {
                        defaultState = inChild;
                        return false;
                    }
                } else if (inChild.is_default) {
                    defaultState = inChild;
                    return false;
                }
                descend(inChild);
            });
            if (defaultState) {
                return;
            }
        };
        descend(this.states);
        if (defaultState) {
            this.tryState(defaultState.getPath());
        }
    }

    getCurrentState() {
        return _private.get(this).stateInfo.prop('currentStateObject');
    }

    tryState(inStateName) {
        if (!_private.get(this).active || inStateName === (_private.get(this).stateInfo.prop('state') || '')) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const watcher = (inNewState, inOldState, inError) => {
                if (inError) {
                    reject(inError);
                } else {
                    if(inOldState) {
                        $(this.element).removeClass('ae-state-' + inOldState);
                    }
                    if(inNewState) {
                        $(this.element).addClass('ae-state-' + inNewState);
                    }
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

    set active(inValue) {
        const _p = _private.get(this);
        if (inValue) {
            if (!_p.active) {
                microtask(this.initState.bind(this));
                this.invalidate();
            }
        }
        _p.active = inValue;
    }

    get active() {
        return _private.get(this).active;
    }

    render(inModel) {
        if (!this.active) {
            return;
        }
        return new Promise((resolve, reject) => {
            _private.get(this).willRender = false;
            if (_private.get(this).hasDefaultTemplate) {
                const delegate = templatingDelegate;
                const model = inModel ?
                    ObservableObject.fromObject(inModel) :
                    this.data();
                delegate.render(
                    '_default.' + this.name,
                    model).then((inHtml) => {
                    $(this.node).html(inHtml);

                    this.afterRender && this.afterRender(); //jshint ignore:line
                    this._renderCount++;
                    this.microtask(() => {
                        _private.get(this)
                            .lifecycleSignal.dispatch('rendered');
                        resolve();
                    });
                }).catch((inError) => {
                    console.error(inError);
                    reject(inError);
                });
            }

        });

    }

}

module.exports = Component;
