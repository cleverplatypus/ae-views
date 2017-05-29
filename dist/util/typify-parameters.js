'use strict';
const UNRESOLVED = require('../symbol/unresolved');
const each = require('lodash.foreach');
const isString = require('lodash.isString');

export default function typifyParams(inPage, inParams) {
    const out = {};
    each(inParams, function(inParamValue, inParamKey) {
        if (!inParamValue) {
            out[inParamKey] = null;
        } else if (isString(inParamValue) && /^~/.test(inParamValue)) {
            let resolvedValue = UNRESOLVED;
            inPage.getDataSource()
                .resolve(this, inParamValue.replace('~', '')).then((inValue) => {
                    resolvedValue = inValue;
                });
            if (resolvedValue === UNRESOLVED) {
                throw new Error('Action parameters must be resolved synchronously');
            }
            out[inParamKey] = resolvedValue;
        } else if (isString(inParamValue) && /^`.*`$/.test(inParamValue)) {
            out[inParamKey] = inParamValue.replace(/^`/, '').replace(/`$/, '');
        } else if (!isNaN(inParamValue)) {
            out[inParamKey] = Number(inParamValue);
        } else if (/^(true|false)$/.test(inParamValue)) {
            out[inParamKey] = (inParamValue === 'true');
        } else {
            console.warn('using deprecated signal string param format');
            out[inParamKey] = inParamValue; //is a string
        }
    });
    return out;

}
