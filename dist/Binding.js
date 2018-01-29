'use strict';


const get = require('lodash.get');
const each = require('lodash.foreach');
const isString = require('lodash.isstring');
const map = require('lodash.map');
const isBoolean = require('lodash.isboolean');
const ComponentModel = require('./ComponentModel');
const isFunction = require('lodash.isfunction');
const microtask = require('./microtask');

const typifyParams = require('./util/typify-parameters');

const $ = require('jquery');

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
            if (!isBoolean(inValue) && cast !== 'bool') {
                return inValue;
            }
            if (negate) {
                return !inValue;
            } else {
                return !!inValue;
            }
        };

        const modelAndResolver = get(inExpressionString.match(/~((?:\w+:)?\w*)/), 1);
        this.modelName = /:/.test(modelAndResolver) ? modelAndResolver.split(':')[0] : null;
        this.resolverName = /:/.test(modelAndResolver) ? modelAndResolver.split(':')[1] : modelAndResolver.split(':')[0];
        switch (get(pathAndCast, 1)) {
            case 'number':
                this.cast = castNumber;
                break;
            case 'bool':
                this.cast = castBoolean;
                break;
            default:
                this.cast = (inValue) => inValue;
        }
    }

    static isBinding(inString) {
        return isString(inString) &&
            /^~(?:\w+:)?\w*\((.?!?[\w\-]+(\.[\w\-]+)*(?::(bool|number))?)((\s*,\s*)(.?!?(`[^`]*`|\d+|true|false)(?::(bool|number))?))*\)$/
            .test(inString);
    }

    static isExpression(inString) {
        return isString(inString) &&
            /~(?:\w+:)?\w*\((.?!?[\w\-]+(\.[\w\-]+)*(?::(bool|number))?)((\s*,\s*)(.?!?(`[^`]*`|\d+|true|false)(?::(bool|number))?))*\)/
            .test(inString);
    }

    static parse(inString) {
        let idx = 0;
        let currentToken = '';
        let segments = [];

        while (idx < inString.length) {
            let match = inString.substr(idx).match(/^~(?:[\w\-]+:)?[\w\-]*\((.?!?[\w\-]+(\.[\w\-]+)*(?::(bool|number))?)((\s*,\s*)(.?!?(`[^`]*`|\d+|true|false)(?::(bool|number))?))*\)/);
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
        if (currentToken) {
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
    this._expression = inExpression;
};

class Binding {

    constructor(inPrivateConstructor, inExpression) {
        if (inPrivateConstructor !== privateConstructor) {
            throw new Error('Binding cannot be instanciated directly. Please use Binding.parse()');
        }
        privateConstructor.call(this, inExpression);
    }

    setValue(inValue) { //CRITICAL: support the .path.bla relative binding format
        const exp = this._expression;
        this._dataSource.setPath(
            this._element,
            exp.path,
            exp.cast(inValue), exp.modelName);
    }

    getValue() { //CRITICAL: support the .path.bla relative binding format
        const exp = this._expression;
        return new Promise((resolve, reject) => {

            this._dataSource.resolve(
                this._element,
                exp.path, exp.modelName).then((inNewValue) => {
                resolve(exp.accessor.apply(null, [exp.truthy(exp.cast(inNewValue))].concat(exp.arguments)));
            });
        });
    }

    fire() {
        const exp = this._expression;
        this.getValue().then((inValue) => {
                this._handler(inValue);
            })
            .catch((inError) => {
                LOG.error(inError);
            });
    }


    attach(inApp, inHandler, inTargetElement) {
        if (inApp) {
            this._app = inApp;
            this._handler = inHandler;
            this._element = inTargetElement;
            this._dataSource = this._app.getDataSource(this._expression.dataSourceName);
            this._component = this._app.resolveNodeComponent(this._element);

        } else {
            if (!this._app || !this._handler) {
                throw new Error('Binding cannot be attached for the first time without app reference or handler');
            }
        }

        const exp = this._expression;
        exp.accessor = (inValue) => inValue;
        if (exp.resolverName) {
            if (this._component.getResolver(exp.resolverName)) {
                exp.accessor = this._component.getResolver(exp.resolverName).bind(this._component);
            } else if (this._component.model instanceof ComponentModel &&
                isFunction(get(this._component.model, exp.resolverName))) {
                exp.accessor = this._component.model[exp.resolverName].bind(this._component.model);
            } else if (this._component.page.getResolver(exp.resolverName)) {
                exp.accessor = this._component.page.getResolver(exp.resolverName).bind(this._component);

            } else {
                console.warn(`Cannot find getter accessor "${exp.resolverName}" in component or model. 
                    Defaulting to path "${exp.path}" raw value.`);

            }
        }
        const observer = (inNewValue, inOldValue, inEventType) => {
            if (inNewValue === inOldValue && !/(change|prune)/.test(inEventType)) {
                return;
            }
            const result = exp.accessor.apply(null, [exp.cast(exp.truthy(inNewValue))].concat(exp.arguments));
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

        let watchPath = exp.path.split('.');
        watchPath[watchPath.length - 1] = '[' + watchPath[watchPath.length - 1] + ']';
        watchPath = watchPath.join('.');

        this._observer = //CRITICAL: support the .path.bla relative binding format
            this._dataSource.bindPath(this._element, watchPath, observer, exp.modelName);
       //this._handler  = observer;
        this.fire();
    }

    detach() {
        if (this._dataSource) {
            let watchPath = this._expression.path.split('.');
            watchPath[watchPath.length - 1] = '[' + watchPath[watchPath.length - 1] + ']';
            watchPath = watchPath.join('.');
            this._dataSource //CRITICAL: support the .path.bla relative binding format
                .unbindPath(this._element, watchPath, this._observer, this._expression.modelName);
        }
    }

    static parse(inExpressionString) {
        if (!BindingExpression.isExpression(inExpressionString)) {
            return inExpressionString;
        }

        return map(BindingExpression.parse(inExpressionString), (inValue) => {
            if (inValue instanceof BindingExpression) {
                return new Binding(privateConstructor, inValue);
            } else {
                return inValue;
            }
        });
    }

    static hasBindings(inExpressionString) {
        return BindingExpression.isExpression(inExpressionString);
    }

}

module.exports = Binding;
