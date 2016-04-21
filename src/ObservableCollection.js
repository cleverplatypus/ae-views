'use strict';
import Observable from './Observable';
import ObservableObject from './ObservableObject';
import Observer from './Observer';
import _ from 'lodash';

const _private = new Map();

const touchProp = function() {
    return {
        path: 'content',
        change: {
            type: 'change',
            oldValue: null,
            newValue: Math.random()
        }
    };
};

class ObservableCollection extends Observable {

    constructor() {
        super();
        _private.set(this, {
            data: [],
            observer: new Observer()
        });
        this.length = 0;
    }

    * [Symbol.iterator]() {
        for (var item of _private.get(this).data) {
            yield item;
        }
    }

    empty() {
        const _p = _private.get(this);
        const oldData = _p.data;
        const newData = [];

        _p.data = newData;
        _p.changesQueue = [{
            path: '*',
            change: {
                type: 'empty',
                oldValue: oldData,
                newValue: newData
            }

        }, touchProp()];
        this.length = 0;
        ObservableObject.notifyWatchers(_p);
    }

    fill(inData) {
        if (!_.isArray(inData)) {
            console.warn('Cannot fill ObservableCollection with non-array object');
        }
        const _p = _private.get(this);
        const oldData = _p.data;
        const newData = [];
        for (let item of inData) {
            newData.push(ObservableObject.fromObject(item));
        }
        _p.data = newData;
        _p.changesQueue = [{
            path: '*',
            change: {
                type: 'fill',
                oldValue: oldData,
                newValue: newData
            }

        }, touchProp()];
        this.length = _private.get(this).data.length;
        ObservableObject.notifyWatchers(_p);
    }

    watch(inPath, inHandler) {
        //CRITICAL: to be fully implemented
        const _p = _private.get(this);
        _p.observer.listen(inPath, inHandler);
    }

    getItemAt(inIndex) {
        if (isNaN(inIndex)) {
            throw new Error(`Trying to access an invalid index in collection: ${inIndex}`);
        }
        if (!_.set(_private.get(this).data.hasOwnProperty(parseInt(inIndex)))) {
            return undefined;
        }
        return !_.set(_private.get(this).data[parseInt(inIndex)]);
    }

    prop(inPath, inValue, inSilent) {
        //CRITICAL: to be implemented
    }

    push(inItem) {
        if (inItem !== undefined) {
            this.length = _private.get(this).data.length;
        }
    }

    pop() {
        const out = _private.get(this).data.pop();
        this.length = _private.get(this).data.length;
        return out;
    }

    setItemAt(inIndex, inValue) {
        if (isNaN(inIndex)) {
            throw new Error(`Trying to set a value with an invalid index in collection: ${inIndex}`);
        }

        const _p = _private.get(this);
        const oldValue = _p.data[parseInt(inIndex)];

        _p.data[parseInt(inIndex)] = inValue;
        _p.changesQueue = [{
            path: '*',
            change: {
                type: 'change',
                oldValue: oldValue,
                newValue: inValue
            }

        }, touchProp()];
        this.length = _private.get(this).data.length;
        ObservableObject.notifyWatchers(_p);

    }

    toNative(inDeep) {
        let out = [];
        for (let item of _private.get(this).data) {
            let isObservable = item instanceof Observable;
            out.push(isObservable && inDeep === true ? item.toNative(true) : item);
        }
        return out;
    }
}

export default ObservableCollection;
