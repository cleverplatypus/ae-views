import $ from 'jquery';
import microtask from '../microtask';
import Element from './ae-element';
import factory from '../page-factory';
import Observable from '../Observable';
import { transform } from 'lodash';
export default function render(inPage) {
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
            const attrs = transform(this.attributes, function(result, item) {
                item.specified && /^param-/.test(item.name) && (result[item.name.replace('param-', '')] = item.value); //jshint ignore:line
            }, {});

            factory.getTemplatingDelegate()
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
            templateName = factory.getTemplatingDelegate()
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
