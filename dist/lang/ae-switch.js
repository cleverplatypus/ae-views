'use strict';

const $ = require('jquery');
const microtask = require('../microtask');
const isArray = require('lodash.isarray');
const Binding = require('../Binding');

/**
 *   A container for element that change the value of a property based on 
 *   selection of its children. It behaves like a radio group.
 *   if no path attribute is found, the switch targets the component's state
 */
module.exports =  function aeSwitch(inPage) {
    const _page = inPage;

    const selectHandler = function selectHandler(inSelectedElement) {
        const _p = $(this).prop('ae');
        const val = $(inSelectedElement).data('ae-switch-value');
        $(this).children().removeClass(_p.selectedClass);
        $(inSelectedElement).addClass(_p.selectedClass);
        if (!_p.source) {
            _p.target.tryState(val);
        } else {
            if (_p.source instanceof Binding) {
                _p.source.setValue(val);
            } else {
                _page.resolveNodeComponent(this);
                _page.getDataSource().setPath(this, _p.source, val);
            }
        }
    };

    var proto = Object.create(HTMLDivElement.prototype);

    proto.createdCallback = function() {
        let pathAttr = $(this).attr('path');
        if (!!pathAttr) {
            pathAttr = Binding.parse(pathAttr);
        }
        if (isArray(pathAttr)) {
            pathAttr = pathAttr.shift();
        }
        $(this).prop('ae', {
            selectedClass: $(this).attr('selected-class') || 'selected',
            source: pathAttr || null
        });
    };

    proto.attachedCallback = function() {
        const _p = $(this).prop('ae');
        const that = this;
        _p.target = _page.resolveNodeComponent(this);

        $(this).children().each(function() {
            $(this).off('click', selectHandler).on('click', () => {
                selectHandler.call(that, this);
            });
        });
        _p.observer = (inNewValue) => {
            $(this).children().each(function() {
                if ((inNewValue || '') === ($(this).data('ae-switch-value') || '')) {
                    selectHandler.call(that, this);
                }
            });

        };


        if (_p.source instanceof Binding) {
            _p.source.attach(_page, _p.observer, this);
        }
        
        const resolve = () => {
            if (!_p.source) {
                return Promise.resolve(_p.target.getCurrentState().getPath());
            } else {
                if (_p.source instanceof Binding) {
                    return _p.source.getValue();
                } else {
                    let watchPath = _p.source.split('.');
                    watchPath[watchPath.length - 1] = '[' + watchPath[watchPath.length - 1] + ']';
                    watchPath = watchPath.join('.');

                    _page.getDataSource().bindPath(this, watchPath, _p.observer);
                    return _page.getDataSource().resolve(this, _p.source);
                }
            }

        };
        const defaultValue = $(this).attr('default-value');
        resolve().then((inValue) => {
            let defaultSwitch;
            $(this).children().each(function() {
                if (inValue !== undefined && inValue === $(this).data('ae-switch-value')) {
                    defaultSwitch = $(this);
                    return false;
                }
                if (inValue === undefined && defaultValue !== undefined &&
                    $(this).data('ae-switch-value') === defaultValue) {
                    defaultSwitch = $(this);
                    return false;
                }
            });
            microtask(() => {
                if (!defaultSwitch) {
                    selectHandler.call(this, $(this).children().first());
                } else {
                    selectHandler.call(this, defaultSwitch);
                }
            });

        });

        

    };

    proto.detachedCallback = function() {
        const _p = $(this).prop('ae');
        if (!!_p.source) {
            if (_p.source instanceof Binding) {
                _p.source.detach();
            } else {
                _page.getDataSource().unbindPath(this, _p.source, _p.observer);
            }
        }
    };

    document.registerElement('ae-switch', {
        prototype: proto,
        extends: 'div'
    });
}
