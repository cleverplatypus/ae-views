'use strict';

import $ from 'jquery';
import Element from './ae-element';
import ObservableCollection from '../ObservableCollection';

export default function each(inPage) {
    const _page = inPage;
    const _private = new WeakMap();
    const _renderDelegate = _page.getRenderDelegate();

    var proto = Object.create(Element.prototype);

    proto.createdCallback = function() {

        $(this).children().each(function() {
            if (!(document.createElement(this.tagName) instanceof Element) && this.nodeName.toUpperCase() !== 'TEMPLATE') {
                throw new Error('ae-each children must be either <ae-...> or a <template> element.');
            }
        });

        let template = $(this).find('>template');

        _private.set(this, {
            templateName: _renderDelegate.registerTemplate(template.html())
        });

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
            if (inData instanceof ObservableCollection) {
                for (let instance of inData) {
                    _renderDelegate.render(templateName, instance)
                        .then(appendFn)
                        .catch(errorFn);
                }
            } else {
                _renderDelegate.render(templateName, inData)
                .then(appendFn)
                .catch(errorFn);
            }
        };

        dataSource.bindPath(this, path, (inNewValue) => {
            renderFn(inNewValue);
        });
        renderFn(dataSource.resolve(this, path));
    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-each', { prototype: proto });
}
