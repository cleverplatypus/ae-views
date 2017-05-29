const $ = require('jquery');
const microtask = require('../microtask');

const factory = require('../page-factory');
const ObservableObject = require('../ObservableObject');
const transform = require('lodash.transform');
const each = require('lodash.foreach');
const AttributeWiring = require('../wiring/AttributeWiring');
const StateWiring = require('../wiring/StateWiring');

module.exports =  function render(inPage) {
    const _private = new WeakMap();
    const _page = inPage;
    var proto = Object.create(HTMLDivElement.prototype);

    const invalidate = function invalidate() {
        if (!_private.get(this).willRender) {
            _private.get(this).willRender = true;
            microtask(render.bind(this));
        }
    };

    var render = function render() {
        if (!$.contains(document, this)) {
            return;
        }
        _private.get(this).willRender = false;
        // if ($(this).attr('debug-name')) {
        //     console.info($(this).attr('debug-name') + ' will render');
        // }

        let templateName = $(this).attr('template');

        const path = $(this).attr('from') || '.';
        _page.getDataSource().resolve(this, path).then((inValue) => {
            const attrs = transform(this.attributes, function(result, item) {
                item.specified && /^param-/.test(item.name) && (result[item.name.replace('param-', '')] = item.value); //jshint ignore:line
            }, {});

            factory.getTemplatingDelegate()
                .render(templateName, inValue || {}, _private.get(this).params)
                .then((inHtml) => {
                    $(this).html(inHtml);
                })
                .catch((inError) => {
                    console.error(inError);
                });
        }).catch((inError) => {
            console.error(inError);
        });
    };
    proto.createdCallback = function() {
        const stateWiring = new StateWiring(this);
        stateWiring.onEnter.add(invalidate.bind(this));
        $(this).prop('ae', {
            wirings: AttributeWiring.wire(this, [
                'class',
                'id',
                'name',
                'param',
                'data',
                'style'
            ]).concat([
                stateWiring
            ])
        });
        _private.set(this, {
            willRender: false,
            params: (() => {
                var out = {};
                each(this.attributes, (inAttribute) => {
                    if (/^param-/.test(inAttribute.name)) {
                        out[inAttribute.name.replace('param-', '')] = inAttribute.value;
                    }
                });
                return out;
            })()
        });
        let templateName = $(this).attr('template');
        if (!templateName) {
            let template = $(this).find('>ae-template');
            if (!template) {
                throw new Error($(this).getPath() + ' must have a template attribute or a template element');
            }
            templateName = factory.getTemplatingDelegate()
                .registerTemplate(template.html());
            $(this).attr('template', templateName);
            $(this).empty();
        }
    };

    proto.attachedCallback = function() {
        const ae = $(this).prop('ae');
        each(ae.wirings, (wiring) => {
            wiring.attach(_page);
        });
        invalidate.call(this);
        // var observer = new MutationObserver((mutations) => {
        //     mutations.forEach((mutation) => {
        //         if (/^param-/.test(mutation.attributeName)) {
        //             invalidate.call(this);
        //         }
        //     });
        // });

        // // configuration of the observer:
        // var config = {
        //     attributes: true
        // };

        // // pass in the target node, as well as the observer options
        // observer.observe(this, config);

        const path = $(this).attr('from');
        let watchPath = '';
        if (path) {
            watchPath = path.split('.');
            watchPath[watchPath.length - 1] = '[' + watchPath[watchPath.length - 1] + ']';
            watchPath = watchPath.join('.');
        }
        _page.getDataSource().bindPath(this, watchPath, (inBaseModel) => {

            if (inBaseModel instanceof ObservableObject) {
                inBaseModel.watch(watchPath, () => {
                    invalidate.call(this);
                });
            } else {
                invalidate.call(this);
            }
            invalidate.call(this);
        });
        if ($(this).attr('watch')) {
            _page.getDataSource().bindPath(this, $(this).attr('watch'), (inBaseModel) => {

                invalidate.call(this);
            });
        }

        if ($(this).attr('trigger-on')) {
            _page.resolveNodeComponent(this).bus.onAction($(this).attr('trigger-on'), () => {
                invalidate.call(this);
            });
        }
    };

    proto.detachedCallback = function() {
        const ae = $(this).prop('ae');
        each(ae.wirings, (wiring) => {
            wiring.detach();
        });
    };

    document.registerElement('ae-rendered', {
        prototype: proto,
        extends: 'div'
    });
}
