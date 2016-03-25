'use strict';
import Observable from './Observable';

const _private = new Map();

class ObservableCollection extends Observable {

    constructor() {
        super();
        _private.set(this, {
            data: []
        });
    }

    * [Symbol.iterator]() {
        for (var item of _private.get(this).data) {
            yield item;
        }
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

    push(inItem) {
        if (inItem !== undefined) {
            _private.get(this).data.push(inItem);
        }
    }

    pop() {
        return _private.get(this).data.pop();
    }

    setItemAt(inIndex, inValue) {
        if (isNaN(inIndex)) {
            throw new Error(`Trying to set a value with an invalid index in collection: ${inIndex}`);
        }
        _private.get(this).data[parseInt(inIndex)] = inValue;
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
