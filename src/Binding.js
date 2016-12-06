'use strict';


const get = require('lodash.get');
const each = require('lodash.foreach');
const isString = require('lodash.isString');
const map = require('lodash.map');
const isBoolean = require('lodash.isBoolean');
import ComponentModel from './ComponentModel';
import isFunction from 'lodash.isfunction';

import typifyParams from './util/typify-parameters';

const $ = require('jquery');

const _private = new Map();

const castBoolean = function castBoolean(inValue) {
    return Boolean(inValue);
};

const castNumber = function castNumber(inValue) {
    return Number(inValue);
};

const tokenizeArgs = function tokenizeArgs(inArgsString) {
    var currentToken = '';
    var args = [];
    var isInQuotes = false;
    var idx = 0;

    while (idx <= inArgsString.length) {
        if (idx === inArgsString.length) {
            args.push(currentToken);
            break;
        }
        var c = inArgsString.charAt(idx);
        if (c === '`') {
            isInQuotes = !isInQuotes;
            currentToken += c;
            if (!isInQuotes) {
                args.push(currentToken);
                currentToken = '';
            }
        } else if (c === ',') {
            if (isInQuotes) {
                currentToken += c;
            } else {
                args.push(currentToken);
                currentToken = '';
            }
        } else {
            currentToken += c;
        }
        idx++;
    }
    //args = typifyParams(null, args);
    return args.map((inElement) => {
        if (isString(inElement) && /^`.*`$/.test(inElement)) {
            return inElement.replace(/^`/, '').replace(/`$/, '');
        }
        return inElement;
    });
};

class BindingExpression {

    constructor(inExpressionString) {

        this.arguments = tokenizeArgs(get(inExpressionString.match(/(\((.*?)\))$/), 2), 0);
        const pathAndCast = get(this.arguments, 0).split(':');
        const cast = get(pathAndCast, 1);
        const sourceAndPath = get(pathAndCast, 0).split('>');
        sourceAndPath.reverse();
        this.path = sourceAndPath.shift().replace('!', '');
        this.dataSourceName = this.path === '_state' ? 'state' : sourceAndPath.shift();
        const negate = /^!/.test(get(pathAndCast, 0));
        this.arguments.shift(); //binding path doesn't belong in the args list

        this.truthy = (inValue) => {
            if (!isBoolean(inValue)) {
                return inValue;
            }
            if (negate) {
                return !inValue;
            } else {
                return !!inValue;
            }
        };

        this.resolverName = get(inExpressionString.match(/~(\w+)/), 1);
        switch (get(pathAndCast, 1)) {
            case 'number':
                this.cast = castNumber;
                break;
            case 'boolean':
                this.cast = castBoolean;
                break;
            default:
                this.cast = (inValue) => inValue;
        }
    }

    static isBinding(inString) {
        return isString(inString) &&
            /^~\w*\((.?!?\w+(\.[\w]+)*(?::(bool|number))?)((\s*,\s*)(.?!?(`[^`]*`|\d+|true|false)(?::(bool|number))?))*\)$/
            .test(inString);
    }

    static isExpression(inString) {
        return isString(inString) &&
            /~\w*\((.?!?\w+(\.[\w]+)*(?::(bool|number))?)((\s*,\s*)(.?!?(`[^`]*`|\d+|true|false)(?::(bool|number))?))*\)/
            .test(inString);
    }

    static parse(inString) {
        let idx = 0;
        let currentToken = '';
        let segments = [];

        while (idx < inString.length) {
            let match = inString.substr(idx).match(/^~\w*\((.?!?\w+(\.[\w]+)*(?::(bool|number))?)((\s*,\s*)(.?!?(`[^`]*`|\d+|true|false)(?::(bool|number))?))*\)/);
            if (match) {
                if (currentToken) {
                    segments.push(currentToken);
                    currentToken = '';
                }
                segments.push(match[0]);
                idx += match[0].length;
            } else if ((match = inString.substr(idx).match(/^\s+/))) {
                if (currentToken) {
                    segments.push(currentToken);
                    currentToken = '';
                }
                segments.push(match[0]);
                idx += match[0].length;
            } else {
                currentToken += inString.charAt(idx);
                idx++;
            }
        }
        if(currentToken) {
            segments.push(currentToken);
        }

        return map(segments,
            (inSegment) => {
                if (BindingExpression.isBinding(inSegment)) {
                    return new BindingExpression(inSegment);
                } else {
                    return inSegment;
                }
            });
    }
}

const privateConstructor = function privateConstructor(inExpression, inElement) {
    _private.set(this, {
        element: inElement,
        expression: inExpression
    });
};

class Binding {

    constructor(inPrivateConstructor, inExpression, inElement) {
        if (inPrivateConstructor !== privateConstructor) {
            throw new Error('Binding cannot be instanciated directly. Please use Binding.parse()');
        }
        privateConstructor.call(this, inExpression, inElement);
    }

    setValue(inValue) { //CRITICAL: support the .path.bla relative binding format
        const _p = _private.get(this);
        const exp = _p.expression;
        _p.dataSource.setPath(
            _p.element,
            exp.path,
            exp.cast(inValue));
    }

    getValue() { //CRITICAL: support the .path.bla relative binding format
        const _p = _private.get(this);
        const exp = _p.expression;
        return new Promise((resolve, reject) => {
            _p.dataSource.resolve(
                _p.element,
                exp.path).then((inNewValue) => {
                resolve(exp.cast(exp.accessor.apply(null, [inNewValue].concat(exp.arguments))));
            });
        });
    }

    fire() {
        const _p = _private.get(this);
        const exp = _p.expression;
        this.getValue().then((inValue) => {
                _p.handler(inValue);
            })
            .catch((inError) => {
                LOG.error(inError);
            });
    }


    attach(inApp, inHandler) {
        const _p = _private.get(this);
        if (inApp) {
            _p.app = inApp;
            _p.handler = inHandler;

            _p.dataSource = _p.app.getDataSource(_p.expression.dataSourceName);
            _p.component = _p.app.resolveNodeComponent(_p.element);

        } else {
            if (!_p.app || !_p.handler) {
                throw new Error('Binding cannot be attached for the first time without app reference or handler');
            }
        }

        const exp = _p.expression;
        exp.accessor = (inValue) => inValue;
        if (exp.resolverName) {
            if (_p.component.getResolver(exp.resolverName)) {
                exp.accessor = _p.component.getResolver(exp.resolverName).bind(_p.component);
            } else if (_p.component.model instanceof ComponentModel &&
                isFunction(get(_p.component.model, exp.resolverName))) {
                exp.accessor = _p.component.model[exp.resolverName].bind(_p.component.model);
            } else if (_p.component.page.getResolver(exp.resolverName)) {
                exp.accessor = _p.component.page.getResolver(exp.resolverName).bind(_p.component);

            } else {
                console.warn(`Cannot find getter accessor "${exp.resolverName}" in component or model. 
                    Defaulting to path "${exp.path}" raw value.`);

            }
        }
        let pu = _p;
        const observer = (inNewValue, inOldValue) => {
            if (inNewValue === inOldValue) {
                return;
            }
            const result = exp.accessor.apply(null, [inNewValue].concat(exp.arguments));
            if (result instanceof Promise) {
                result
                    .then((inResultValue) => {
                        inHandler(exp.cast(inResultValue));
                    })
                    .catch((inError) => {
                        console.error(inError);
                    });
            } else {
                inHandler(exp.cast(result));
            }
        };
        //NOTE: bindPath returns a function wrapper, therefore
        //      we're saving such wrapper in order to be able
        //      to unbind it later

        _p.observer = //CRITICAL: support the .path.bla relative binding format
            _p.dataSource.bindPath(_p.element, exp.path, observer);
        _p.hander = observer;
        this.fire();
    }

    detach() {
        const _p = _private.get(this);
        _p.dataSource //CRITICAL: support the .path.bla relative binding format
            .unbindPath(_p.element, _p.path, _p.observer);
    }

    static parse(inExpressionString, inElement) {
        if (!BindingExpression.isExpression(inExpressionString)) {
            return inExpressionString;
        }

        return map(BindingExpression.parse(inExpressionString), (inValue) => {
            if (inValue instanceof BindingExpression) {
                return new Binding(privateConstructor, inValue, inElement);
            } else {
                return inValue;
            }
        });
    }

    static hasBindings(inExpressionString) {
        return BindingExpression.isExpression(inExpressionString);
    }

}

export default Binding;
