const $ = require('jquery');
const microtask = require('../microtask');

module.exports =  function state(inPage) {
    'use strict';
    const _page = inPage;
    var proto = Object.create(HTMLElement.prototype);
    const watcher = function() {
        const component = _page.resolveNodeComponent(this);
        const method = $(this).attr('method') || 'removal';
        const statePattern = new RegExp($(this).attr('pattern') || '^$');
        const statePathMatch = $(this).attr('path');
        const stateNameMatch = $(this).attr('name');
        
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
                      $(this).removeClass('is-hidden');
                      $(this).html(this.content);
                    $(this).prop('wasRendered', true);
                }
            }
            currentState.rendered();
        } else {
            if (method === 'visibility') {
                $(this).children().each(function() {
                    $(this).addClass('is-hidden');
                });
            } else {
                $(this).addClass('is-hidden');
                $(this).empty();
                $(this).prop('wasRendered', false);
            }
        }
    };

    proto.createdCallback = function() {
        const component = _page.resolveNodeComponent(this);
        component.watchState(() => {
            if (!$(this).prop('willRender')) {
                $(this).prop('willRender', true);
                microtask(watcher.bind(this));
            }
        });
        this.content = $(this).html();
        watcher.call(this);

    };

    proto.attachedCallback = function() {
        const component = _page.resolveNodeComponent(this);
        watcher.call(this);
    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-state', {
        prototype: proto
    });
}
