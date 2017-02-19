'use strict';

import $ from 'jquery';
import microtask from '../microtask';

/**
 *   A container for element that change the value of a property based on 
 *   selection of its children. It behaves like a radio group.
 *   if no path attribute is found, the switch targets the component's state
 */
export default function aeSwitch(inPage) {
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
    };

    var proto = Object.create(HTMLDivElement.prototype);
    proto.createdCallback = function() {
        _private.set(this, {
            selectedClass: $(this).attr('selected-class') || 'selected',
            source: $(this).attr('path') || null
        });
    };

    proto.attachedCallback = function() {
        const _p = _private.get(this);
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

        const resolve = () => {
            if (!_p.source) {
                return Promise.resolve(_p.target.getCurrentState().getPath());
            } else {
                let watchPath = _p.source.split('.');
                watchPath[watchPath.length - 1] = '[' + watchPath[watchPath.length - 1] + ']';
                watchPath = watchPath.join('.');

                _page.getDataSource().bindPath(this, watchPath, _p.observer);
                return _page.getDataSource().resolve(this, _p.source);
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
        const _p = _private.get(this);
        if (!!_p.target) {
            _page.getDataSource().unbindPath(this, _p.source, _p.observer);
        }
    };

    document.registerElement('ae-switch', {
        prototype: proto,
        extends: 'div'
    });
}
