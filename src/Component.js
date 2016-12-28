'use strict';
import microtask from './microtask';
import ObservableObject from './ObservableObject';
import ComponentModel from './ComponentModel';
import State from './State';
import Bus from './Bus';
import isString from 'lodash.isString';
import isFunction from 'lodash.isFunction';
import isPlainObject from 'lodash.isPlainObject';
import each from 'lodash.foreach';
import get from 'lodash.get';
import $ from 'jquery';
import factory from './page-factory';
import ComponentLifecycle from './ComponentLifecycle';
import {
    Signal
} from 'signals';
import privateHash from './util/private';

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


        const lifecycleSignal = new Signal();
        const lifecycle = new ComponentLifecycle(lifecycleSignal);
        this.microtask = microtask;
        _private.set(this, {
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


        if (factory.componentConfigPreprocessor) {
            factory.componentConfigPreprocessor(inConfig);
        }
        this._properties = {};
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

        this.hasModel = (inName) => {
            if (inName) {
                return !!get(inConfig, 'models.' + inName);
            }

            return !!_private.get(this).model;
        };

        this.getModel = (inName) => {
            if (this.hasModel(inName)) {
                return get(inConfig, 'models.' + inName) || _private.get(this).model ;
            }
            if (this === this.page) {
                LOG.warn('Model ' + inName + ' is not registered with the page');
                return;
            }
            return this.page.getModel(inName);
        };

        this.getController = (inName) => {
            let controller = get(inConfig, 'controllers.' + inName);
            if (!controller && this === this.page) {
                LOG.warn('Controller ' + inName + ' is not registered with the page');
            } else if (!controller) {
                return this.page.getController(inName);
            }
            return controller;
        };
        for (let templateName in templates) {
            let actualTemplateName = templateName === '_default' ?
                '_default.' + this.name :
                templateName;
            factory.getTemplatingDelegate()
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
        if (this.model) {
            return this.model.prop(path, inValue, inSilent);
        } else {
            return this.page.resolveNodeModel(this.node, path).prop(path, inValue, inSilent);
        }
    }

    get properties() {
        return this._properties;
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
                const delegate = factory.getTemplatingDelegate();
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

export default Component;
