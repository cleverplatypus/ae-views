'use strict';

import $ from 'jquery';
import Element from './ae-element';
import factory from '../page-factory';

export default function render(inPage) {
    const _page = inPage;
    var proto = Object.create(Element.prototype);

    var render = function render() {
        const templateName = $(this).attr('template');
        const path = $(this).attr('path')
        const model = _page.getDataSource().resolve(this, path);
        const attrs = _.transform(this.attributes, function(result, item) {
            item.specified && /^param-/.test(item.name) && (result[item.name.replace('param-', '')] = item.value);
        }, {});


        factory.getTemplatingDelegate()
            .render(templateName, model)
            .then((inHtml) => {
                $(this).find('>ae-managed').html(inHtml);
            })
            .catch((inError) => {
                console.error(inError);
            });
    };
    proto.createdCallback = function() {
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
        _page.getDataSource().bindPath(this,
            $(this).attr('watch') || '*',
            () => {
                render.bind(this)();
            });

    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-render', { prototype: proto });
};
