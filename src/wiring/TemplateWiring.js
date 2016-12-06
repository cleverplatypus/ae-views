'use strict';
import AppFactory  from '../page-factory';
import Wiring from './Wiring';
const $ = require('jquery');
import Binding  from '../Binding';
import ObservableObject from '../ObservableObject';
const get = require('lodash.get');
const each = require('lodash.foreach');
const isFunction = require('lodash.isFunction');
const isArray = require('lodash.isArray');

const _private = new WeakMap();

const _p = (instance, hash) => {
    if (hash) {
        _private.set(instance, hash);
    } else {
        return _private.get(instance);
    }
};

class BaseTemplateWiring extends Wiring {
    constructor(inElement) {
        super(inElement);
        _p(this, {
            element: inElement,
            eachFunction: (inData) => inData,
            templateNode: $(this).find('>template').get(0),
            binding: Binding.parse($(this).attr('from'))[0],
            iterate: !!$(inElement).attr('each')
        });
    }

    attach(inApp) {
        _p(this).binding.attach(inApp, this.handler);
        if (inApp) {
            const eachFnName = $(_p(this).element).attr('each');
            if (eachFnName) {
                const component = inApp.resolveNodeComponent(_p(this).element);
                if (isFunction(get(component, eachFnName))) {
                    _p(this).eachFunction =
                        get(component, eachFnName)
                        .bind(component);
                } else if (isFunction(get(component.model, eachFnName))) {
                    _p(this).eachFunction =
                        get(component.model, eachFnName)
                        .bind(component.model);
                }

            }
        }
        this.handler();
    }

    handler() {
        throw new Error('Unimplemented hander() method');
    }

}

class DelegatedTemplateWiring extends BaseTemplateWiring {
    constructor(inElement) {
        super(inElement);
        _p(this).templateName = $(inElement).attr('src');
    }

    handler() {
        _p(this).binding.getValue().then((inValue) => {
            if (inValue instanceof ObservableObject) {
                inValue = inValue.toNative(true);
            }
            let html = '';
            if (_p(this).iterate && isArray(inValue)) { //TODO: handle other ES6 types of iteratable
                each(inValue, (inItem) => {
                	inValue = _p(this).eachFunction(inValue);
                    AppFactory.render(_p(this).templateName, inItem).then((inHtml) => {
                        html += inHtml;
                    });
                });
            } else {
                AppFactory.render(_p(this).templateName, inValue).then((inHtml) => {
                    html = inHtml;
                });
            }
            $(_p(this).element).html(html); //REFACTOR: template rendering can be async. Use Promise.all ?
        });
    }

}

class ExplicitTemplateWiring extends BaseTemplateWiring {
    constructor(inElement) {
        super(inElement);
    }


    handler() {
        _p(this).binding.getValue().then((inValue) => {
            if (!!inValue && !(inValue instanceof ObservableObject)) {
                throw new Error('Template binding must be bound to an ObservableObject');
            }


            const idProperty = $(_p(this).element).attr('id-property');


            if (inValue.isCollection) {
                let currentElement = $(_p(this).element).firstChild();
                let index = 0; //CRITICAL: how to get the index in a for-of loop?
                for (let item of inValue) {

                    let transformedValue = _p(this).eachFunction(item);
                    let element = $(_p(this).element).find('[data-ae-id="' + transformedValue.prop(idProperty) + '"]');
                    if (transformedValue === false) {
                        if (!idProperty) {
                            return;
                        }
                        if (element) {
                            currentElement = element.next() || currentElement;
                            element.remove();
                        }
                    } else {
                        if (!element) {
                            element = $($(this.templateNode).html());
                            element.attr('from', Binding.descend($(_p(this).element).attr('from'), index));
                            currentElement = $(currentElement).appendAfter(element);

                        } else {
                            currentElement = element;
                        }

                    }
                }
            }
        });
    }


}


class TemplateWiring {
    constructor() {
        throw new Error('TemplateWiring cannot be instanciated directly. Use TemplateWiring.wire() instead');
    }

    static wire(inElement) {
        const templateNode = $(inElement).find('>template').get(0);
        if (!Binding.hasBindings($(inElement).attr('from'))) {
            console.warn('---------------------------------------------------');
            console.warn('Element with ae-template doesn\'t declare a binding');
            console.warn(inElement);
            console.warn('---------------------------------------------------');
            return;
        }
        if ($(templateNode).attr('src')) {
            return new DelegatedTemplateWiring(inElement);
        } else {
            return new ExplicitTemplateWiring(inElement);
        }
    }
}

export default TemplateWiring;
