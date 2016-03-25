'use strict';

import $ from 'jquery';
import Element from './ae-element';
import _ from 'lodash';

export default function bind(inPage) {
    const _page = inPage;

    var proto = Object.create(Element.prototype);
    proto.attachedCallback = function() {
        let target = $(this).parent();
        let dataSourceName = $(this).attr('source');
        let shouldOut = $(this).attr('out') === 'true';
        const path = $(this).attr('path');
        let dataSource = _page.getDataSource(dataSourceName);
        if (!dataSource) {
            throw new Error('Cannot bind to data-source: ' + dataSourceName);
        }
        let outAttr = $(this).attr('out')
        let inAttr = $(this).attr('in');
        if (!inAttr && !outAttr) {
            inAttr = 'html';
        }
        if (inAttr) {
            let nodeAttr = inAttr.split(':');
            let val = dataSource.resolve(this, path);
            const valueResolver = (inValue) => {
                switch (nodeAttr[0]) {
                    case '':
                    case undefined:
                    case 'html':
                        console.log('should modify html');
                        $(target).html(inValue);
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
            if (val instanceof Promise) {
                val.then(valueResolver);
            } else {
                valueResolver(val);
            }

            dataSource.bindPath(this, path, function(inNewValue) {
                valueResolver(inNewValue);
            });
        }

        if (shouldOut) {
            if (_.isFunction($(target).get(0).valueChangedHook)) {
                $(target).get(0).valueChangedHook((inValue) => {
                    dataSource.setPath(this, path, inValue);
                });
            }
        }


    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-bind', { prototype: proto });
};
