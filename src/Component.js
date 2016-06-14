'use strict';
import microtask from './microtask';
import ObservableObject from './ObservableObject';
import Observable from './Observable';
import State from './State';
import Bus from './Bus';
import _ from 'lodash';
import $ from 'jquery';
import factory from './page-factory';
import ComponentLifecycle from './ComponentLifecycle';
import { Signal } from 'signals';
import privateHash from './util/private';

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
    if (!inOrig) {
        return false;
    }
    if (inOrig instanceof Observable) {
        return inOrig.prop('data') !== undefined &&
            inOrig.prop('_state') !== undefined &&
            inOrig.prop('_nextState') !== undefined;
    } else {
        return _.isPlainObject(inOrig) &&
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
        const lifecycleSignal = new Signal();
        const lifecycle = new ComponentLifecycle(lifecycleSignal);
        _private.set(this, {
            stateWatchers: new Set(),
            lifecycleSignal: lifecycleSignal
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
        _.each(inConfig.actions, (inAction) => {
            if (!inAction) {
                console.error('Passed a null action to component config');
                return;
            }
            const actionName = _.isString(inAction) ? inAction : inAction.name;
            if (!actionName) {
                console.error('Passed an object with no action name as action in component config');
                return;
            }
            const handler = _.isPlainObject(inAction) ? inAction.handler : undefined;

            if (handler && !_.isFunction(handler)) {
                console.error('Passed a non-function action handler in component config');
                return;
            }
            if (_.isPlainObject(inAction) && inAction.publish === true) {
                this.bus.publishAction(actionName, handler ? handler.bind(this) : null);
            } else {
                this.bus.addAction(actionName, handler ? handler.bind(this) : null);
            }

        });
        let templates = inConfig.templates || {};
        this.model = _conformsToComponentModel(inInitObj) ?
            ObservableObject.fromObject(inInitObj) :
            ObservableObject.fromObject({
                data: inInitObj,
                _state: '',
                _nextState: ''
            });

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
        _private.get(this).currentState = this.states;
        inConstructor && inConstructor.bind(this)(); //jshint ignore:line

        microtask(this.initState.bind(this));
    }

    data(inPath, inValue) {
        const path = 'data.' + inPath;
        return this.page.resolveNodeModel(this.node, path).prop(path, inValue);
    }

    initState() {

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
            const delegate = factory.getTemplatingDelegate();
            const model = inModel ?
                ObservableObject.fromObject(inModel) :
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

export default Component;
