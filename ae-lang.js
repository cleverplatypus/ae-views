const $ = require('jquery');
const dust = require('dustjs-linkedin');
const _ = require('lodash');

module.exports = function(inPage) {
    const _page = inPage;
    const _registry = new WeakMap();

    function newProto() {
        return Object.create(HTMLElement.prototype);

    }


    (function checkbox() {
        var proto = newProto();
        proto.createdCallback = function() {
            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    switch (mutation.attributeName) {
                        case 'label':
                            $(mutation.target).find('label>span').text($(mutation.target).attr('label'));
                            break;
                        case 'label-class':
                            $(mutation.target).find('label').attr('class', $(mutation.target).attr('label-class'));
                            break;
                        case 'value':
                            $(mutation.target).find('input').attr('value', $(mutation.target).attr('value'));
                            break;
                        case 'input-class':
                            $(mutation.target).find('input').attr('class', $(mutation.target).attr('input-class'));
                            break;
                    }
                });
            });

            // configuration of the observer:
            var config = { attributes: true };

            // pass in the target node, as well as the observer options
            observer.observe(this, config);

            // later, you can stop observing
            let input = `<input type="checkbox" class="${$(this).attr('input-class') || ''}" value="${$(this).attr('value') || ''}">`;
            let out =
                `<label class="${$(this).attr('label-class') || ''}">${input}<span>${$(this).attr('label') || ''}</span></label>`;
            $(this).append(out);
        };
        proto.valueChangedHook = function(inHandler) {
            const handler = function() {
                inHandler($(this).find('input').attr('value'));
            };
            if (_.isFunction(inHandler)) {
                $(this).off('click', handler).on('click', handler);
            }

        };

        proto.attachedCallback = function() {

        };

        proto.detachedCallback = function() {
            observer.disconnect();
        };

        document.registerElement('ae-checkbox', { prototype: proto });
    })();

    (function radio() {
        var proto = newProto();
        proto.createdCallback = function() {};
        proto.valueChangedHook = function(inHandler) {
            const handler = function() {
                inHandler($(this).attr('value'));
            };
            if (_.isFunction(inHandler)) {
                $(this).find('input').off('click', handler).on('click', handler);
            }

        };

        proto.attachedCallback = function() {
            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    switch (mutation.attributeName) {
                        case 'label':
                            $(mutation.target).find('label>span').text($(mutation.target).attr('label'));
                            break;
                        case 'label-class':
                            $(mutation.target).find('label').attr('class', $(mutation.target).attr('label-class'));
                            break;
                        case 'value':
                            $(mutation.target).find('input').attr('value', $(mutation.target).attr('value'));
                            break;
                        case 'input-class':
                            $(mutation.target).find('input').attr('class', $(mutation.target).attr('input-class'));
                            break;
                    }
                });
            });

            // configuration of the observer:
            var config = { attributes: true };

            // pass in the target node, as well as the observer options
            observer.observe(this, config);

            // later, you can stop observing
            const selected = $(this).attr('checked') === 'checked' ? 'checked' : '';
            let input = `<input type="radio" name="${$(this).attr('name') || ''}" class="${$(this).attr('input-class') || ''}" ${selected} value="${$(this).attr('value') || ''}">`;
            let out =
                `<label class="${$(this).attr('label-class') || ''}">${input}<span>${$(this).attr('label') || ''}</span></label>`;
            $(this).append(out);
        };

        proto.detachedCallback = function() {
            observer.disconnect();
        };

        document.registerElement('ae-radio', { prototype: proto });
    })();


    (function each() {
        var proto = newProto();

        proto.createdCallback = function() {

        };

        proto.attachedCallback = function() {

        };

        proto.detachedCallback = function() {

        };

        document.registerElement('ae-each', { prototype: proto });
    })();

 
    (function state() {
        let proto = newProto();



        proto.createdCallback = function() {
            const component = _page.resolveNodeComponent(this);
            const statePattern = $(this).attr('pattern');
            const watcher = (inState) => {
                if (inState.matches(statePattern)) {
                    $(this).html(this.content);
                } else {
                    $(this).empty();
                }
            }
            component.watchState(watcher);
            this.content = $(this).html();
            watcher(component.currentState);

        };

        proto.attachedCallback = function() {


        };

        proto.detachedCallback = function() {

        };

        document.registerElement('ae-state', { prototype: proto });
    })();





    (function aeBind() {
        var proto = newProto();

        proto.createdCallback = function() {
            _registry.set(this, {});
        };

        proto.attachedCallback = function() {
            let target = $(this).parent();
            let dataSourceName = $(this).attr('source');
            let shouldOut = $(this).attr('out') === 'true';
            const path = $(this).attr('path');
            let dataSource = _page.getDataSource(dataSourceName);
            if (!dataSource) {
                throw new Error('Cannot bind to data-source: ' + dataSourceName);
            }
            _registry.get(this).dataSource = dataSource;
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
    })();

    (function aeAction() {
        var proto = newProto();

        proto.createdCallback = function() {
            var target = $(this).parent();
            var actionName = $(this).attr('name');
            var node = $(this);

            while (!$(node).prop('component')) {
                node = $(node).parent();
            }
            $(target).click(() => {
                $(node).prop('component').bus.triggerAction(actionName);
            });


        };

        proto.attachedCallback = function() {

        };

        proto.detachedCallback = function() {

        };

        document.registerElement('ae-action', { prototype: proto });

    })();

    (function aeRender() {
        var proto = newProto();

        var render = function render() {
            const templateName = $(this).attr('template');
            var attrs = _.transform(this.attributes, function(result, item) {
                item.specified && /^param-/.test(item.name) && (result[item.name.replace('param-', '')] = item.value);
            }, {});

            var compiled = dust.compile('cippirimerlo: {world}');
            var tmpl = dust.loadSource(compiled);
            dust.render(tmpl, { world: attrs['world'] }, (err, out) => {
                $(this).find('>.ae-render-container').html(out);
            });
        };
        proto.createdCallback = function() {
            $(this).append('<div class="ae-render-container"></div>');
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


        };

        proto.detachedCallback = function() {

        };

        document.registerElement('ae-render', { prototype: proto });

    })();
};
