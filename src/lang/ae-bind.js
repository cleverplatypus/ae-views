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
        if ($(this).attr('path') && ($(this).attr('from') && $(this).attr('to'))) {
            console.warn('ae-bind attribute "path" is ignored when either "from" or "to" are specified: \nNode:');
            console.warn(this);
        }
        
        let target;
        if ($(this).children().length) {
            target = $(this).children().get(0);
        } else {
            const targetAttr = $(this).attr('target');
            if(!targetAttr) {
                target = $(this).parent();
            } else if(targetAttr === 'next') {
                target = $(this).next();
            } else if(/^closest/.test(targetAttr)) {
                const segs = targetAttr.split(/\s+/);
                target = $(this).closest(segs[1]);
            } else {
                console.warn('Unknown ae-bind target: ' + targetAttr);
            }
        }

        let dataSourceName = $(this).attr('source');
        const path = $(this).attr('path');
        let dataSource = _page.getDataSource(dataSourceName);
        if (!dataSource) {
            throw new Error('Cannot bind to data-source: ' + dataSourceName);
        }
        const usePath = path && !$(this).attr('from') && !$(this).attr('to');
        const toAttr = usePath ? path : $(this).attr('to');
        const fromAttr = usePath ? path : $(this).attr('from');
        let inAttr = $(this).attr('in') || '';
        const isFormElement = valueChangeDelegate.canOutputValue(target);
        if (!inAttr && isFormElement) {
            inAttr = 'form-element-value';
        }
        if (fromAttr) {
            let nodeAttr = inAttr.split(':');
            nodeAttr[0] = nodeAttr[0] || 'html';

            if (nodeAttr[0] === 'html') {
                $(target).attr('data-ae-bind-html', fromAttr);
            }
            

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
                        let match = false;
                        if(condition && /^\/.*\/$/.test(condition)) {
                            condition = new RegExp(condition.replace(/^\//, '').replace(/\/$/, ''));
                            match = condition.test(inValue);
                        } else if(_.isString(condition)) {
                            match = (condition === inValue);
                        }
                        if(match) {
                            $(target).addClass(nodeAttr[1]);
                        } else {
                            $(target).removeClass(nodeAttr[1]);
                        }
                        break;
                    case 'form-element-value':
                            valueChangeDelegate.setValue(target, inValue);
                            console.log('should set form element state');
                        break;
                    default:
                        console.warn('I don\'t know how to bind value to element');
                }

            };
            dataSource.bindPath(this, fromAttr, function(inNewValue) {
                valueResolver(inNewValue);
            });
            
            dataSource.resolve(this, fromAttr).then((inValue) => {
                valueResolver(inValue);
            });

        }

        if (toAttr) {
            if (!isFormElement) {
                throw new Error('Element ' + $(target).get(0).nodeName + ' cannot be used as a source of binding output');
            }
            const outOptions = {};
            _.each(this.attributes, (inAttribute) => {
                if (/^out-/.test(inAttribute.name)) {
                    outOptions[inAttribute.name.replace(/^out-/, '')] = inAttribute.value;
                }
            });
            valueChangeDelegate.onValueChange(target, outOptions, (inValue) => {
                dataSource.setPath(this, toAttr, inValue.value == null ? null : inValue.value);
            });
        }


    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-bind', { prototype: proto });
}
