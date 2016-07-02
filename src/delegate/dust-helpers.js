/*! dustjs-helpers - v1.7.3
 * http://dustjs.com/
 * Copyright (c) 2015 Aleksander Williams; Released under the MIT License */
import ObservableObject from '../ObservableObject';
import {
    isString,
    keys,
    get
} from 'lodash';

export default function(dust) {
    'use strict';


    dust.helpers.re = function(chunk, context, bodies, params) {
        console.warn('params:');
        console.warn(params);
        if (!params.key || !params.match) {
            chunk.write('');
            console.warn('writing empty string');
        } else {
            console.warn('writing bodies');
            var re = new RegExp(params.match);
            if (re.test(params.key)) {
                if (bodies) {
                    chunk = chunk.render(bodies, context);
                }
            }

        }
        return chunk;
    };



    dust.filters.https = function(inUrl) {
        if (!inUrl) {
            return '';
        }
        return inUrl.toString().replace(/^(http(?:s)?):/, 'https:');
    };


    dust.filters.obscuredcreditcardnumber = function(inValue) {
        if (!isString(inValue)) {
            return;
        }
        var split = inValue.split('').reverse();
        var tail = split.splice(0, 4);
        tail.unshift('-');

        while (split.length) {
            if (split.length % 4 === 0) {
                tail.unshift('-');
            }
            tail.unshift('*');
            split.pop();
        }
        return tail.join('').replace(/--/, '-');
    };

    dust.filters.tolower = function(inValue) {
        return isString(inValue) ? inValue.toLowerCase() : inValue;
    };

    dust.filters.toupper = function(inValue) {
        return isString(inValue) ? inValue.toUpperCase() : inValue;
    };
    dust.helpers.sort = function(chunk, context, bodies, params) {
        var sort = JSON.parse(params.sort);
        var body = bodies.block;
        var sortkey;

        function isEmpty(o) {
            for (var p in o) {
                if (o.hasOwnProperty(p)) {
                    return false;
                }
            }
            return true;
        }

        if (sort) {
            delete params.sort;
        }
        if (body) {
            var cmp = function cmp(a, b) {
                return (a[sortkey] < b[sortkey]) ? -1 : ((a[sortkey] > b[sortkey]) ? 1 : 0);
            };
            
            while (sort.length) {
                sortkey = sort.pop().key;
                context.stack.head.sort(cmp);
            }
            return chunk.section(context.getPath(true, []), context, bodies, isEmpty(params) ? null : params);
        }
    };

    dust.filters.money = function(inValue) {
        var sValue = Number(inValue).toFixed(2).replace('.', ',');

        var sRegExp = new RegExp('(-?[0-9]+)([0-9]{3})');
        while (sRegExp.test(sValue)) {
            sValue = sValue.replace(sRegExp, '$1' + '.' + '$2');
        }
        return sValue;
    };

    dust.helpers.iterate = function(chunk, context, bodies, params) { //jshint ignore:line
        var body = bodies.block,
            sort,
            arr,
            i,
            k,
            obj,
            compareFn;

        params = params || {};

        function desc(a, b) {
            if (a < b) {
                return 1;
            } else if (a > b) {
                return -1;
            }
            return 0;
        }

        function processBody(key, value) {
            return body(chunk, context.push({
                $key: key,
                $value: value,
                $type: typeof value
            }));
        }

        if (params.key) {
            obj = context.resolve(params.key);

            if (obj instanceof ObservableObject) {
                obj = obj.toNative();
            }

            if (body) {
                if (!!params.sort) {
                    sort = dust.helpers.tap(params.sort, chunk, context);
                    arr = [];
                    for (k in obj) {
                        if (obj.hasOwnProperty(k)) {
                            arr.push(k);
                        }
                    }
                    compareFn = context.global[sort];
                    if (!compareFn && sort === 'desc') {
                        compareFn = desc;
                    }
                    if (compareFn) {
                        arr.sort(compareFn);
                    } else {
                        arr.sort();
                    }
                    for (i = 0; i < arr.length; i++) {
                        chunk = processBody(arr[i], obj[arr[i]]);
                    }
                } else {
                    for (k in obj) {
                        if (obj.hasOwnProperty(k)) {
                            chunk = processBody(k, obj[k]);
                        }
                    }
                }
            } else {
                console.log('Missing body block in the iter helper.');
            }
        } else {
            console.log('Missing parameter \'key\' in the iter helper.');
        }
        return chunk;

    };

    dust.helpers.length = function(chunk, context, bodies, params) {
        if (!params.key) {
            chunk.write(0);
        } else if (params.key.constructor === String || params.key.constructor === Array) {
            chunk.write(params.key.length);
        } else if (params.key.constructor === Object) {
            chunk.write(keys(params.key.constructor).length);
        }
        return chunk;
    };

    dust.helpers.calc = function(chunk, context, bodies, params) {
        var result;
        if (get(window, 'math.eval')) {
            result = get(window, 'math').eval(context.resolve(bodies.block));
        } else {
            result = context.resolve(bodies.block);
        }
        if (params.format) {
            switch (params.format) {
                case 'money':
                    result = result.toFixed(2).replace('.', ',');
                    break;
                case 'integer':
                    result = Math.round(result);
                    break;
            }
        }
        if (params.var && params.var.length) {
            context.global[params.var] = result;
            chunk.write('');
        } else {
            chunk.write(result);
        }
        return chunk;
    };







    function log(helper, msg, level) {
        level = level || 'INFO';
        helper = helper ? '{@' + helper + '}: ' : '';
        dust.log(helper + msg, level);
    }

    var _deprecatedCache = {};

    function _deprecated(target) {
        if (_deprecatedCache[target]) {
            return;
        }
        log(target, 'Deprecation warning: ' + target + ' is deprecated and will be removed in a future version of dustjs-helpers', 'WARN');
        log(null, 'For help and a deprecation timeline, see https://github.com/linkedin/dustjs-helpers/wiki/Deprecated-Features#' + target.replace(/\W+/g, ''), 'WARN');
        _deprecatedCache[target] = true;
    }

    function isSelect(context) {
        return context.stack.tail &&
            context.stack.tail.head &&
            typeof context.stack.tail.head.__select__ !== 'undefined';
    }

    function getSelectState(context) {
        return isSelect(context) && context.get('__select__');
    }

    /**
     * Adds a special __select__ key behind the head of the context stack. Used to maintain the state
     * of {@select} blocks
     * @param context {Context} add state to this Context
     * @param opts {Object} add these properties to the state (`key` and `type`)
     */
    function addSelectState(context, opts) {
        var head = context.stack.head,
            newContext = context.rebase(),
            key;

        if (context.stack && context.stack.tail) {
            newContext.stack = context.stack.tail;
        }

        var state = {
            isPending: false,
            isResolved: false,
            isDeferredComplete: false,
            deferreds: []
        };

        for (key in opts) {
            state[key] = opts[key];
        }

        return newContext
            .push({
                '__select__': state
            })
            .push(head, context.stack.index, context.stack.of);
    }

    /**
     * After a {@select} or {@math} block is complete, they invoke this function
     */
    function resolveSelectDeferreds(state) {
        var x, len;
        state.isDeferredPending = true;
        if (state.deferreds.length) {
            state.isDeferredComplete = true;
            for (x = 0, len = state.deferreds.length; x < len; x++) {
                state.deferreds[x]();
            }
        }
        state.isDeferredPending = false;
    }

    /**
     * Used by {@contextDump}
     */
    function jsonFilter(key, value) {
        if (typeof value === 'function') {
            return value.toString()
                .replace(/(^\s+|\s+$)/mg, '')
                .replace(/\n/mg, '')
                .replace(/,\s*/mg, ', ')
                .replace(/\)\{/mg, ') {');
        }
        return value;
    }

    /**
     * Generate a truth test helper
     */
    function truthTest(name, test) {
        return function(chunk, context, bodies, params) {
            return filter(chunk, context, bodies, params, name, test);
        };
    }

    /**
     * This function is invoked by truth test helpers
     */
    function filter(chunk, context, bodies, params, helperName, test) { //jshint ignore:line
        var body = bodies.block,
            skip = bodies['else'],
            selectState = getSelectState(context) || {},
            willResolve, key, value, type;

        // Once one truth test in a select passes, short-circuit the rest of the tests
        if (selectState.isResolved && !selectState.isDeferredPending) {
            return chunk;
        }

        // First check for a key on the helper itself, then look for a key on the {@select}
        if (params.hasOwnProperty('key')) {
            key = params.key;
        } else if (selectState.hasOwnProperty('key')) {
            key = selectState.key;
        } else {
            log(helperName, 'No key specified', 'WARN');
            return chunk;
        }

        type = params.type || selectState.type;

        key = coerce(context.resolve(key), type);
        value = coerce(context.resolve(params.value), type);

        if (test(key, value)) {
            // Once a truth test passes, put the select into 'pending' state. Now we can render the body of
            // the truth test (which may contain truth tests) without altering the state of the select.
            if (!selectState.isPending) {
                willResolve = true;
                selectState.isPending = true;
            }
            if (body) {
                chunk = chunk.render(body, context);
            }
            if (willResolve) {
                selectState.isResolved = true;
            }
        } else if (skip) {
            chunk = chunk.render(skip, context);
        }
        return chunk;
    }

    function coerce(value, type) {
        if (type) {
            type = type.toLowerCase();
        }
        switch (type) {
            case 'number':
                return +value;
            case 'string':
                return String(value);
            case 'boolean':
                value = (value === 'false' ? false : value);
                return Boolean(value);
            case 'date':
                return new Date(value);
        }

        return value;
    }

    var helpers = {

        // Utility helping to resolve dust references in the given chunk
        // uses native Dust Context#resolve (available since Dust 2.6.2)
        'tap': function(input, chunk, context) {
            // deprecated for removal in 1.8
            _deprecated('tap');
            return context.resolve(input);
        },

        'sep': function(chunk, context, bodies) {
            var body = bodies.block;
            if (context.stack.index === context.stack.of - 1) {
                return chunk;
            }
            if (body) {
                return body(chunk, context);
            } else {
                return chunk;
            }
        },

        'first': function(chunk, context, bodies) {
            if (context.stack.index === 0) {
                return bodies.block(chunk, context);
            }
            return chunk;
        },

        'last': function(chunk, context, bodies) {
            if (context.stack.index === context.stack.of - 1) {
                return bodies.block(chunk, context);
            }
            return chunk;
        },

        /**
         * {@contextDump}
         * @param key {String} set to 'full' to the full context stack, otherwise the current context is dumped
         * @param to {String} set to 'console' to log to console, otherwise outputs to the chunk
         */
        'contextDump': function(chunk, context, bodies, params) {
            var to = context.resolve(params.to),
                key = context.resolve(params.key),
                target, output;
            switch (key) {
                case 'full':
                    target = context.stack;
                    break;
                default:
                    target = context.stack.head;
            }
            output = JSON.stringify(target, jsonFilter, 2);
            switch (to) {
                case 'console':
                    log('contextDump', output);
                    break;
                default:
                    output = output.replace(/</g, '\\u003c');
                    chunk = chunk.write(output);
            }
            return chunk;
        },

        /**
         * {@math}
         * @param key first value
         * @param method {String} operation to perform
         * @param operand second value (not required for operations like `abs`)
         * @param round if truthy, round() the result
         */
        'math': function(chunk, context, bodies, params) { //jshint ignore:line
            var key = params.key,
                method = params.method,
                operand = params.operand,
                round = params.round,
                output, state, x, len;

            if (!params.hasOwnProperty('key') || !params.method) {
                log('math', '`key` or `method` was not provided', 'ERROR');
                return chunk;
            }

            key = parseFloat(context.resolve(key));
            operand = parseFloat(context.resolve(operand));

            switch (method) {
                case 'mod':
                    if (operand === 0) {
                        log('math', 'Division by 0', 'ERROR');
                    }
                    output = key % operand;
                    break;
                case 'add':
                    output = key + operand;
                    break;
                case 'subtract':
                    output = key - operand;
                    break;
                case 'multiply':
                    output = key * operand;
                    break;
                case 'divide':
                    if (operand === 0) {
                        log('math', 'Division by 0', 'ERROR');
                    }
                    output = key / operand;
                    break;
                case 'ceil':
                case 'floor':
                case 'round':
                case 'abs':
                    output = Math[method](key);
                    break;
                case 'toint':
                    output = parseInt(key, 10);
                    break;
                default:
                    log('math', 'Method `' + method + '` is not supported', 'ERROR');
            }

            if (typeof output !== 'undefined') {
                if (round) {
                    output = Math.round(output);
                }
                if (bodies && bodies.block) {
                    context = addSelectState(context, {
                        key: output
                    });
                    chunk = chunk.render(bodies.block, context);
                    resolveSelectDeferreds(getSelectState(context));
                } else {
                    chunk = chunk.write(output);
                }
            }

            return chunk;
        },

        /**
         * {@select}
         * Groups a set of truth tests and outputs the first one that passes.
         * Also contains {@any} and {@none} blocks.
         * @param key a value or reference to use as the left-hand side of comparisons
         * @param type coerce all truth test keys without an explicit type to this type
         */
        'select': function(chunk, context, bodies, params) {
            var body = bodies.block,
                state = {};

            if (params.hasOwnProperty('key')) {
                state.key = context.resolve(params.key);
            }
            if (params.hasOwnProperty('type')) {
                state.type = params.type;
            }

            if (body) {
                context = addSelectState(context, state);
                chunk = chunk.render(body, context);
                resolveSelectDeferreds(getSelectState(context));
            } else {
                log('select', 'Missing body block', 'WARN');
            }
            return chunk;
        },

        /**
         * Truth test helpers
         * @param key a value or reference to use as the left-hand side of comparisons
         * @param value a value or reference to use as the right-hand side of comparisons
         * @param type if specified, `key` and `value` will be forcibly cast to this type
         */
        'eq': truthTest('eq', function(left, right) {
            return left === right;
        }),
        'ne': truthTest('ne', function(left, right) {
            return left !== right;
        }),
        'lt': truthTest('lt', function(left, right) {
            return left < right;
        }),
        'lte': truthTest('lte', function(left, right) {
            return left <= right;
        }),
        'gt': truthTest('gt', function(left, right) {
            return left > right;
        }),
        'gte': truthTest('gte', function(left, right) {
            return left >= right;
        }),

        /**
         * {@any}
         * Outputs as long as at least one truth test inside a {@select} has passed.
         * Must be contained inside a {@select} block.
         * The passing truth test can be before or after the {@any} block.
         */
        'any': function(chunk, context, bodies, params) {
            var selectState = getSelectState(context);

            if (!selectState) {
                log('any', 'Must be used inside a {@select} block', 'ERROR');
            } else {
                if (selectState.isDeferredComplete) {
                    log('any', 'Must not be nested inside {@any} or {@none} block', 'ERROR');
                } else {
                    chunk = chunk.map(function(chunk) {
                        selectState.deferreds.push(function() {
                            if (selectState.isResolved) {
                                chunk = chunk.render(bodies.block, context);
                            }
                            chunk.end();
                        });
                    });
                }
            }
            return chunk;
        },

        /**
         * {@none}
         * Outputs if no truth tests inside a {@select} pass.
         * Must be contained inside a {@select} block.
         * The position of the helper does not matter.
         */
        'none': function(chunk, context, bodies, params) {
            var selectState = getSelectState(context);

            if (!selectState) {
                log('none', 'Must be used inside a {@select} block', 'ERROR');
            } else {
                if (selectState.isDeferredComplete) {
                    log('none', 'Must not be nested inside {@any} or {@none} block', 'ERROR');
                } else {
                    chunk = chunk.map(function(chunk) {
                        selectState.deferreds.push(function() {
                            if (!selectState.isResolved) {
                                chunk = chunk.render(bodies.block, context);
                            }
                            chunk.end();
                        });
                    });
                }
            }
            return chunk;
        },

        /**
         * {@size}
         * Write the size of the target to the chunk
         * Falsy values and true have size 0
         * Numbers are returned as-is
         * Arrays and Strings have size equal to their length
         * Objects have size equal to the number of keys they contain
         * Dust bodies are evaluated and the length of the string is returned
         * Functions are evaluated and the length of their return value is evaluated
         * @param key find the size of this value or reference
         */
        'size': function(chunk, context, bodies, params) {
            var key = params.key,
                value, k;

            key = context.resolve(params.key);
            if (!key || key === true) {
                value = 0;
            } else if (dust.isArray(key)) {
                value = key.length;
            } else if (!isNaN(parseFloat(key)) && isFinite(key)) {
                value = key;
            } else if (typeof key === 'object') {
                value = 0;
                for (k in key) {
                    if (key.hasOwnProperty(k)) {
                        value++;
                    }
                }
            } else {
                value = (key + '').length;
            }
            return chunk.write(value);
        }

    };

    for (var key in helpers) {
        dust.helpers[key] = helpers[key];
    }

    return dust;

}
