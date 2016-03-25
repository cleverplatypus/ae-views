import $ from 'jquery';
import _ from 'lodash';
import Element from './ae-element';
import dust from 'dustjs-linkedin';
import Observable from './Observable';
import ObservableCollection from './ObservableCollection';

export default function each(inPage) {
    const _page = inPage;
    const _private = new Map();

    var proto = Object.create(Element.prototype);

    proto.createdCallback = function() {

        $(this).children().each(function() {
            if (!(this instanceof Element) && this.nodeName.toUpperCase() !== 'TEMPLATE') {
                throw new Error('ae-each children must be either <ae-...> or a <template> element.');
            }
        });
        let template = $(this).find('>template');
        let compiled = dust.compile($(template).html());




        _private.set(this, {
            template: dust.loadSource(compiled)
        });
        $(this).append($('<ae-managed></ae-managed>'));
    };

    proto.attachedCallback = function() {
        let dataSourceName = $(this).attr('source');
        const path = $(this).attr('path');
        let dataSource = _page.getDataSource(dataSourceName);
        let component = _page.resolveNodeComponent(this);
        const template = _private.get(this).template;

        const renderFn = (inData) => {
            $(this).find('>ae-managed').empty();
            if (inData instanceof ObservableCollection) {
               for(let instance of inData) {
                    dust.render(template, instance, (err, out) => {
                        if (err) {
                            throw new Error(err);
                        }
                        $(this).find('>ae-managed').append(out);
                    });
                }
                // _.each(inData.toNative(false), (instance) => {
                //     dust.render(template, instance, (err, out) => {
                //         if (err) {
                //             throw new Error(err);
                //         }
                //         $(this).find('>ae-managed').append(out);
                //     });
                // });
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
};
