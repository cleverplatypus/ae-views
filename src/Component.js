'use strict';
import microtask from './microtask';
import ObservableObject from './ObservableObject';
import ComponentModel from './ComponentModel';
import State from './State';
import Bus from './Bus';
import { isString, isFunction, isPlainObject, each } from 'lodash';
import $ from 'jquery';
import factory from './page-factory';
import ComponentLifecycle from './ComponentLifecycle';
import  {Signal} from 'signals';
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
        if(isPlainObject(inModelInitObj)) {
            _p.model = new ComponentModel(inModelInitObj);
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
        const lifecycleSignal = new Signal();
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


        if (factory.componentConfigPreprocessor) {
            factory.componentConfigPreprocessor(inConfig);
        }
        this.config = inConfig;
        this.page = inPage;
        this.bus = new Bus(inPage ? inPage.bus : null); //jshint ignore:line
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
            factory.getTemplatingDelegate()
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
            const delegate = factory.getTemplatingDelegate();
            const model = inModel ?
                ObservableObject.fromObject(inModel) :
                this.data();
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

export default Component;
