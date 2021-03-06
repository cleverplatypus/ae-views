'use strict';

const $ = require('jquery');

const isString = require('lodash.isstring');
const each = require('lodash.foreach');
const valueChangeDelegate = require('../delegate/value-change-delegate');


module.exports =  function bind(inPage) {
    const _page = inPage;
    const _private = new WeakSet();

    var proto = Object.create(HTMLElement.prototype);

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
            if (!targetAttr) {
                target = $(this).parent();
            } else if (targetAttr === 'next') {
                target = $(this).next();
            } else if (/^closest/.test(targetAttr)) {
                const segs = targetAttr.split(/\s+/);
                target = $(this).closest(segs[1]);
            } else if (/^(\.|\#)/.test(targetAttr)) {
                target = $(this).parent().find(targetAttr);
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
                let condition = $(this).attr('if');
                let conditionMet = true;
                if (condition) {

                    let negate =
                        (!!condition && /^!/.test(condition));

                    condition = condition.replace(/^!/, '');

                    if (condition && /^\/.*\/$/.test(condition)) {
                        condition = new RegExp(condition.replace(/^\//, '').replace(/\/$/, ''));
                        conditionMet = condition.test(inValue);
                    } else if (isString(condition)) {
                        if(/^(true|false)$/.test(condition)) {
                            condition = Boolean(condition);
                        }
                        conditionMet = (condition === inValue);
                    }
                    conditionMet = conditionMet === (!negate);//jshint ignore:line
                }

                switch (nodeAttr[0]) {
                    case 'html':
                        if (conditionMet) {
                            $(target).html(inValue);
                        }
                        break;
                    case 'attr':
                        if (conditionMet) {
                            $(target).attr(nodeAttr[1], inValue);
                        }
                        break;
                    case 'class':
                        if (conditionMet) {
                            $(target).addClass(nodeAttr[1]);
                        } else {
                            $(target).removeClass(nodeAttr[1]);
                        }
                        break;
                    case 'form-element-value':
                        if (conditionMet) {
                            valueChangeDelegate.setValue(target, inValue);
                        }
                        break;
                    default:
                        console.warn('I don\'t know how to bind value to element');
                }

            };

            dataSource.bindPath(this, fromAttr, function(inNewValue, inOldValue) {
                if(inNewValue !== inOldValue) {
                    valueResolver(inNewValue);
                }
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
            each(this.attributes, (inAttribute) => {
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
