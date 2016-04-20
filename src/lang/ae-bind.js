
import $ from 'jquery';
import Element from './ae-element';
import _ from 'lodash';
import valueChangeDelegate from '../delegate/value-change-delegate';


export default function bind(inPage) {
    'use strict';
    const _page = inPage;
    const _private = new WeakSet();

    var proto = Object.create(Element.prototype);
    
    proto.attachedCallback = function() {

        let target = $(this).attr('target') === 'next' ? $(this).next() : $(this).parent();

        let dataSourceName = $(this).attr('source');
        const shouldOut = $(this).attr('out') === 'true';
        const path = $(this).attr('path');
        let dataSource = _page.getDataSource(dataSourceName);
        if (!dataSource) {
            throw new Error('Cannot bind to data-source: ' + dataSourceName);
        }
        let outAttr = $(this).attr('out');
        let inAttr = $(this).attr('in');
        if (!inAttr && !outAttr) {
            inAttr = 'html';
        }
        if (inAttr) {
            let nodeAttr = inAttr.split(':');
            nodeAttr[0] = nodeAttr[0] || 'html';

            if(nodeAttr[0] === 'html') {
                $(target).attr('data-ae-bind-html', path);
            }
            let val = dataSource.resolve(this, path);

            const valueResolver = (inValue) => {
                switch (nodeAttr[0]) {
                    case 'html':
                        {
                            console.log('should modify html');

                            $(target).html(inValue);
                        }
                        break;
                    case 'attr':
                        console.log('should modify attribute: ' + nodeAttr[1]);
                        $(target).attr(nodeAttr[1], inValue);
                        break;
                    case 'class':
                        console.log('should add class: ' + nodeAttr[1]);
                        let condition = $(this).attr('if');
                        if (!condition || condition === inValue) {
                            $(target).addClass(nodeAttr[1]);
                        } else {
                            $(target).removeClass(nodeAttr[1]);
                        }

                }

            };
             dataSource.bindPath(this, path, function(inNewValue) {
                valueResolver(inNewValue);
            });
            if (val instanceof Promise) {
                val.then(valueResolver);
            } else {
                valueResolver(val);
            }

           
        }

        if(outAttr) {
            if(!valueChangeDelegate.canOutputValue(target)) {
                throw new Error('Element ' + $(target).get(0).nodeName + ' cannot be used as a source of binding output');
            }
            const outOptions = {};
            _.each(target.attributes, (inAttribute) => {
                if(/^out-/.test(inAttribute.name)) {
                    outOptions[inAttribute.replace(/^out-/, '')] = inAttribute.value;
                }
            });
            valueChangeDelegate.onValueChange(target, outOptions, (inValue) => {
                //TODO: manage collection element set
                dataSource.setPath(this, outAttr, inValue);
            });
        }


    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-bind', { prototype: proto });
}
