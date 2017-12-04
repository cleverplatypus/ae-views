'use strict';


const get = require('lodash.get');
const each = require('lodash.foreach');
const isString = require('lodash.isstring');
const map = require('lodash.map');
const isBoolean = require('lodash.isboolean');
const expressionParser = require('./peg/binding-expression').parse;
const isPlainObject = require('lodash.isplainobject');
const some = require('lodash.some');

const ComponentModel = require('./ComponentModel');
const isFunction = require('lodash.isfunction');
const microtask = require('./microtask');

const typifyParams = require('./util/typify-parameters');

const $ = require('jquery');

const _private = new Map();

// const castBoolean = function castBoolean(inValue) {
//     return Boolean(inValue);
// };

// const castNumber = function castNumber(inValue) {
//     return Number(inValue);
// };

// const tokenizeArgs = function tokenizeArgs(inArgsString) {
//     var currentToken = '';
//     var args = [];
//     var isInQuotes = false;
//     var idx = 0;

//     while (idx <= inArgsString.length) {
//         if (idx === inArgsString.length) {
//             args.push(currentToken);
//             break;
//         }
//         var c = inArgsString.charAt(idx);
//         if (c === '`') {
//             isInQuotes = !isInQuotes;
//             currentToken += c;
//             if (!isInQuotes) {
//                 args.push(currentToken);
//                 currentToken = '';
//             }
//         } else if (c === ',') {
//             if (isInQuotes) {
//                 currentToken += c;
//             } else {
//                 args.push(currentToken);
//                 currentToken = '';
//             }
//         } else {
//             currentToken += c;
//         }
//         idx++;
//     }
//     //args = typifyParams(null, args);
//     return args.map((inElement) => {
//         if (isString(inElement) && /^`.*`$/.test(inElement)) {
//             return inElement.replace(/^`/, '').replace(/`$/, '');
//         }
//         return inElement;
//     });
// };

// class BindingExpression {

//     constructor(inExpressionString) {

//         this.arguments = tokenizeArgs(get(inExpressionString.match(/(\((.*?)\))$/), 2), 0);
//         const pathAndCast = get(this.arguments, 0).split(':');
//         const cast = get(pathAndCast, 1);
//         const sourceAndPath = get(pathAndCast, 0).split('>');
//         sourceAndPath.reverse();
//         this.path = sourceAndPath.shift().replace('!', '');
//         this.dataSourceName = this.path === '_state' ? 'state' : sourceAndPath.shift();
//         const negate = /^!/.test(get(pathAndCast, 0));
//         this.arguments.shift(); //binding path doesn't belong in the args list

//         this.truthy = (inValue) => {
//             if (!isBoolean(inValue) && cast !== 'bool') {
//                 return inValue;
//             }
//             if (negate) {
//                 return !inValue;
//             } else {
//                 return !!inValue;
//             }
//         };
        
//         const modelAndResolver = get(inExpressionString.match(/~((?:\w+:)?\w*)/), 1);
//         this.modelName = /:/.test(modelAndResolver) ? modelAndResolver.split(':')[0] : null;
//         this.resolverName = /:/.test(modelAndResolver) ? modelAndResolver.split(':')[1] : modelAndResolver.split(':')[0];
//         switch (get(pathAndCast, 1)) {
//             case 'number':
//                 this.cast = castNumber;
//                 break;
//             case 'bool':
//                 this.cast = castBoolean;
//                 break;
//             default:
//                 this.cast = (inValue) => inValue;
//         }
//     }

//     static isBinding(inString) {
//         return isString(inString) &&
//             /^~(?:\w+:)?\w*\((.?!?[\w\-]+(\.[\w\-]+)*(?::(bool|number))?)((\s*,\s*)(.?!?(`[^`]*`|\d+|true|false)(?::(bool|number))?))*\)$/
//             .test(inString);
//     }

//     static isExpression(inString) {
//         return isString(inString) &&
//             /~(?:\w+:)?\w*\((.?!?[\w\-]+(\.[\w\-]+)*(?::(bool|number))?)((\s*,\s*)(.?!?(`[^`]*`|\d+|true|false)(?::(bool|number))?))*\)/
//             .test(inString);
//     }

//     static parse(inString) {
//         let idx = 0;
//         let currentToken = '';
//         let segments = [];

//         while (idx < inString.length) {
//             let match = inString.substr(idx).match(/^~(?:[\w\-]+:)?[\w\-]*\((.?!?[\w\-]+(\.[\w\-]+)*(?::(bool|number))?)((\s*,\s*)(.?!?(`[^`]*`|\d+|true|false)(?::(bool|number))?))*\)/);
//             if (match) {
//                 if (currentToken) {
//                     segments.push(currentToken);
//                     currentToken = '';
//                 }
//                 segments.push(match[0]);
//                 idx += match[0].length;
//             } else if ((match = inString.substr(idx).match(/^\s+/))) {
//                 if (currentToken) {
//                     segments.push(currentToken);
//                     currentToken = '';
//                 }
//                 segments.push(match[0]);
//                 idx += match[0].length;
//             } else {
//                 currentToken += inString.charAt(idx);
//                 idx++;
//             }
//         }
//         if (currentToken) {
//             segments.push(currentToken);
//         }

//         return map(segments,
//             (inSegment) => {
//                 if (BindingExpression.isBinding(inSegment)) {
//                     return new BindingExpression(inSegment);
//                 } else {
//                     return inSegment;
//                 }
//             });
//     }
// }

const privateConstructor = function privateConstructor(inExpression, inElement) {
    _private.set(this, {
        expression: inExpression
    });
};

class Binding {

    constructor(inPrivateConstructor, inExpression) {
        if (inPrivateConstructor !== privateConstructor) {
            throw new Error('Binding cannot be instanciated directly. Please use Binding.parse()');
        }
        privateConstructor.call(this, inExpression);
    }

    setValue(inValue) { //CRITICAL: support the .path.bla relative binding format
        const _p = _private.get(this);
        const exp = _p.expression;
        _p.dataSource.setPath(
            _p.element,
            exp.binding.path,
            inValue, exp.binding.modelName);
    }

    getValue() { //CRITICAL: support the .path.bla relative binding format
        const _p = _private.get(this);
        const exp = _p.expression;
        return new Promise((resolve, reject) => {

            _p.dataSource.resolve(
                _p.element,
                exp.binding.path, exp.binding.modelName).then((inNewValue) => {
                resolve(exp.accessor.apply(null, [inNewValue].concat(exp.arguments)));
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


    attach(inApp, inHandler, inTargetElement) {
        const _p = _private.get(this);
        if (inApp) {
            _p.app = inApp;
            _p.handler = inHandler;
            _p.element = inTargetElement;
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
                    Defaulting to path "${exp.binding.path}" raw value.`);

            }
        }
        const observer = (inNewValue, inOldValue, inEventType) => {
            if (inNewValue === inOldValue && !/(change|prune)/.test(inEventType)) {
                return;
            }
            const result = exp.accessor.apply(null, [inNewValue].concat(exp.arguments));
            if (result instanceof Promise) {
                result
                    .then((inResultValue) => {
                        inHandler(inResultValue);
                    })
                    .catch((inError) => {
                        console.error(inError);
                    });
            } else {
                inHandler(result);
            }
        };
        //NOTE: bindPath returns a function wrapper, therefore
        //      we're saving such wrapper in order to be able
        //      to unbind it later

        let watchPath = exp.binding.path.split('.');
        watchPath[watchPath.length - 1] = '[' + watchPath[watchPath.length - 1] + ']';
        watchPath = watchPath.join('.');

        _p.observer = //CRITICAL: support the .path.bla relative binding format
            _p.dataSource.bindPath(_p.element, watchPath, observer, exp.binding.modelName);
        _p.hander = observer;
        this.fire();
    }

    detach() {
        const _p = _private.get(this);
        let watchPath = _p.expression.path.split('.');
        watchPath[watchPath.length - 1] = '[' + watchPath[watchPath.length - 1] + ']';
        watchPath = watchPath.join('.');
        if(!_p.dataSource) {
            LOG.warn('_p.dataSource is null -- please debug');
        }
        _p.dataSource //CRITICAL: support the .path.bla relative binding format
            .unbindPath(_p.element, watchPath, _p.observer, _p.expression.modelName);
    }

    static parse(inExpressionString) {
        const parsed = expressionParser(inExpressionString);
        if(!some(parsed, isPlainObject)) {
            return inExpressionString;
        }

        return map(parsed, (inValue) => {
            if (isPlainObject(inValue)) {
                return new Binding(privateConstructor, inValue);
            } else {
                return inValue;
            }
        });
    }

    static hasBindings(inExpressionString) {
        return some(expressionParser(inExpressionString), isPlainObject);
    }

}

module.exports = Binding;
