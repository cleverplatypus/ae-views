'use strict';
import Observable from './Observable';
import ObservableObject from './ObservableObject';
import Observer from './Observer';
import _ from 'lodash';

const _private = new Map();

// function fromObject(inObj) {
//     if (_.isArray(inObj)) {
//         let a = new ObservableCollection();
//         _.each(inObj, function(inVal, inKey) {
//             a.setItemAt(inKey, fromObject(inVal));
//         });
//         return a;
//     } else if (_.isPlainObject(inObj)) {
//         let o = new ObservableObject();
//         _.each(inObj, function(inVal, inKey) {
//             o.prop(inKey, fromObject(inVal));
//         });
//         return o;
//     } else {
//         return inObj;
//     }
// }

class ObservableCollection extends Observable {

    constructor() {
        super();
        _private.set(this, {
            data: [],
            observer: new Observer()
        });
    }

    * [Symbol.iterator]() {
        for (var item of _private.get(this).data) {
            yield item;
        }
    }

    watch(inHandler) {
        const _p = _private.get(this);
        _p.observer.listen('*', inHandler);
    }


    fill(inData) {
        if (!_.isArray(inData)) {
            console.warn('Cannot fill ObservableCollection with non-array object');
        }
        const _p = _private.get(this);
        const oldData = _p.data;
        const newData = [];
        for(let item of inData ) {
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

        }];
        ObservableObject.notifyWatchers(_p);
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
