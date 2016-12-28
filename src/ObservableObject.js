'use strict';
import Observer from './Observer';
import isPlainObject from 'lodash.isPlainObject';
import keys from 'lodash.keys';
import each from 'lodash.foreach';
import isString from 'lodash.isString';
import get from 'lodash.get';
import isArray from 'lodash.isArray';



const setProp = function(inPath, inValue) { //jshint ignore:line
    const notifyDescendantListeners = (inSource, inBackPath, inEventName) => {
        if (inSource instanceof ObservableObject) {
            for (let propName in inSource.toNative(true)) {
                const newBackPath = inBackPath.concat(propName);
                this._changesQueue.push({
                    path: newBackPath.join('.'),
                    change: {
                        type: inEventName,
                        newValue: this.prop(newBackPath.join('.'))
                    }
                });
                if (inSource._props[propName] instanceof ObservableObject) {
                    notifyDescendantListeners(inSource._props[propName], newBackPath.splice(1), inEventName);
                }
            }
        }
    };

    const descend = (inSource, inPath, inNewValue, inBackPath) => {
        const pathSegs = inPath.toString().split('.');
        inNewValue = ObservableObject.fromObject(inNewValue);
        if (pathSegs.length === 1) {
            const oldValue = inSource._props[inPath];
            if (oldValue !== inNewValue) {
                this._changesQueue.push({
                    path: inBackPath.concat(inPath).join('.'),
                    change: {
                        type: oldValue === undefined ? 'add' : 'replace',
                        oldValue: oldValue,
                        newValue: inNewValue
                    }
                });
            }
            inSource._props[inPath] = inNewValue;
            if (oldValue instanceof ObservableObject) {
                notifyDescendantListeners(oldValue, inBackPath.concat([inPath]), 'prune');
            } else if (inNewValue instanceof ObservableObject) {
                notifyDescendantListeners(inNewValue, inBackPath.concat([inPath]), 'add');
            }
        } else {
            const localProp = pathSegs.shift();
            const oldValue = inSource._props[localProp];

            if (!(oldValue instanceof ObservableObject) || (oldValue.isCollection && isNaN(localProp)) || (!oldValue.isCollection && !isNaN(localProp))) {
                inSource._props[localProp] = new ObservableObject({
                    isCollection: !isNaN(localProp)
                });
                if (oldValue instanceof ObservableObject) {
                    notifyDescendantListeners(oldValue, inBackPath.concat([inPath]), 'prune');
                } else if (inNewValue instanceof ObservableObject) {
                    notifyDescendantListeners(inNewValue, inBackPath.concat([inPath]), 'add');
                }

                this._changesQueue.push({
                    path: inBackPath.concat(localProp).join('.'),
                    change: {
                        type: oldValue instanceof ObservableObject ? 'replace' : 'add',
                        oldValue: oldValue,
                        newValue: inSource._props[localProp]
                    }
                });

            }

            descend(
                inSource._props[localProp],
                pathSegs.join('.'),
                inNewValue, inBackPath.concat([localProp]));

        }

    };
    descend(this, inPath.toString(), inValue, []);
};


const getProp = function(inPath) {
    const descend = (inBase, inSubPath) => {
        if (inSubPath.length === 1) {
            let propName = inSubPath.pop();
            if (inBase.isCollection && !isNaN(propName)) {
                propName = parseInt(propName);
            }
            return inBase._props[propName];
        } else {
            const propName = inSubPath.shift();
            if (!inBase._props.hasOwnProperty(propName)) {
                return undefined;
            }
            if(inBase._props[propName]) {
                return descend(inBase._props[propName], inSubPath);
            }
        }
    };
    return descend(this, inPath.toString().split('.'));
};

class ObservableObject {

    constructor(inConfig) {
        const isCollection = (get(inConfig, 'isCollection') === true);
        this._lazyPaths = {};
        this._isSilent = false;
        this._isCollection = isCollection;
        this._changesQueue = [];
        this._observer = new Observer();
        this._props = isCollection ? [] : {};
    }

    * [Symbol.iterator]() {
        const src = this._props;
        if (this.isCollection) {
            for (var item of src) {
                yield item;
            }
        } else {
            for (let key in src) {
                const out = {};
                out[key] = src[key];
                yield out;
            }
        }
    }

    /**
     * makes a given path lazy loadable
     * the thenable function is a function that returns
     * a promise. This function is only called the first time
     * the path is accessed
     */
    lazyPath(inPath, inThenableFunction) {
        if (!getProp.call(this, inPath)) {
            //this ensures that calling toNative with lazyProps == true
            //resolves this path
            setProp.call(this, inPath, null);
        }
        let promise;
        this._lazyPaths[inPath] = () => {
            if (promise) {
                return promise;
            }
            promise = inThenableFunction();
            promise.then((inVal) => {
                this.prop(inPath, inVal);
                delete this._lazyPaths[inPath];
            });
            return promise;
        };
    }

    get observer() {
        return this._observer;
    }

    fill(inData, inPath, inSilent) {
        if (!inPath) {
            this._props = this.isCollection ? [] : {};
        } else if (this.prop(inPath) instanceof ObservableObject) {
            this.prop(inPath).empty();
        }

        if (keys(inData).length) {
            this.merge(inData, inPath, inSilent);
        } else {
            if (!inSilent) {
                this._changesQueue.push({
                    path: '',
                    change: {
                        type: 'emptied',
                        newValue: this._props
                    }
                });
                ObservableObject.notifyWatchers(this);
            }
        }


    }

    merge(inData, inPath, inSilent) {

        if (!isPlainObject(inData) && !isArray(inData)) {
            throw new Error('ObservableObject.fill() must be passed a plain object');
        }
        each(inData, (inValue, inKey) => {
            const path = (inPath ? inPath + '.' : '') + inKey;
            this.prop(path, ObservableObject.fromObject(inValue), inSilent);
        });
    }

    static fromObject(inData) {
        if (isArray(inData)) {
            let a = new ObservableObject({
                isCollection: true
            });
            each(inData, function(inVal, inKey) {
                a.prop(inKey, ObservableObject.fromObject(inVal));
            });
            return a;
        } else if (isPlainObject(inData)) {
            let o = new ObservableObject();
            each(inData, function(inVal, inKey) {
                o.prop(inKey, ObservableObject.fromObject(inVal));
            });
            return o;
        } else {
            return inData;
        }
    }

    static prop(inBase, inPath) {
        if (!inBase) {
            return;
        }
        if (!(inBase instanceof ObservableObject)) {
            return;
        }
        return inBase.prop(inPath);
    }

    get isCollection() {
        return this._isCollection;
    }

    keys() {
        return keys(this._props);
    }

    get length() {

        if (this._isCollection) {
            return keys(this._props).length;
        }
        return undefined;
    }

    prop(inPath, inValue, inSilent) { //jshint ignore:line
        if (inPath !== 0 && !inPath) { //path can be an index. !inPath would ignore zero as a property
            return this;
        }

        const path = inPath.toString().split('.');
        var propName = path.shift();
        if (inValue !== undefined && this._isCollection && isNaN(propName) && propName !== 'length') {
            throw new Error('Collection ObservableObject can only have numbers as keys');
        } else if (this._isCollection) {
            propName = !isNaN(propName) ? parseInt(propName) : propName;
            if (isNaN(propName)) {
                return this.length;
            }
        }
        if (inValue === undefined) {
            if (this._lazyPaths[inPath]) {
                return this._lazyPaths[inPath]();
            }
            if (this._props[propName] === undefined) {
                return undefined;
            } else {
                return getProp.call(this, inPath);
            }
        } else {
            const branch = [];
            setProp.call(this, inPath, inValue, branch);
            if (!inSilent) {
                ObservableObject.notifyWatchers(this);
            }
            return inValue;
        }
    }


    //TODO: implement event-specific watch
    watch(inPath, inHandler, inEvent) {
        this._observer.listen(inPath, inHandler, inEvent);
    }

    unwatch(inHandler, inPath) {
        this._observer.unlisten(inHandler, inPath);
    }

    toNative(inDeep, inLazyProps) {
        if (inLazyProps) {
            return new Promise((resolve, reject) => {
                const allPromises = [];
                const descend = (inObj, inFullPath) => {
                    each(inObj._props, (inVal, inKey) => {
                        const fullPath = inFullPath ? inFullPath.split('.').concat([inKey]).join('.') : inKey;
                        if (this._lazyPaths[fullPath]) {
                            allPromises.push(this._lazyPaths[fullPath]());
                        }
                        if (inVal instanceof ObservableObject) {
                            if (inDeep) {
                                descend(inVal, fullPath);
                            }
                        }
                    });
                };
                descend(this, '');
                Promise.all(allPromises).then(() => {
                    resolve(this.toNative(inDeep));
                });
            });
        } else {
            var out = this._isCollection ? [] : {};
            each(this._props, (inVal, inKey) => {
                let isObservable = inVal instanceof ObservableObject;
                out[inKey] = isObservable && inDeep === true ? inVal.toNative(true) : inVal;
            });
            return out;
        }



    }

    sort(inComparator) {
        if (this._isCollection) {
            this._props.sort(inComparator);
        }
        return this;
    }

    static notifyWatchers(inInstance) {
        if (inInstance.isSilent) {
            return;
        }
        for (let c of inInstance._changesQueue) {
            inInstance.observer.notify(c.path, c.change);
        }
        inInstance._changesQueue = [];

    }

    static fill(inTarget, inPath, inContent, inSilent) {
        if (!inTarget || !(inTarget instanceof ObservableObject)) {
            throw new Error('fill() can only be invoked on an ObservableObject');
        }
        if (!inTarget || !(inTarget instanceof ObservableObject)) {
            throw new Error('Cannot resolve ObservableObject to fill');
        }

        inTarget.fill(inContent, inPath, inSilent);
        if (!inSilent) {
            inTarget._changesQueue.push({
                path: inPath,
                change: {
                    type: 'filled',
                    newValue: inContent
                }
            });
            ObservableObject.notifyWatchers(inTarget);
        }
    }

    static merge(inTarget, inPath, inContent, inSilent) {
        if (!inTarget || !(inTarget instanceof ObservableObject)) {
            throw new Error('merge () can only be invoked on an ObservableObject');
        }

        if (!inTarget || !(inTarget instanceof ObservableObject)) {
            throw new Error('Cannot resolve ObservableObject to merge');
        }

        inTarget.merge(inContent, inPath);
        if (!inSilent) {
            inTarget._changesQueue.push({
                path: inPath,
                change: {
                    type: 'merged',
                    newValue: inContent
                }
            });
            ObservableObject.notifyWatchers(inTarget);
        }

    }


    empty(inSilent) {
        this.fill(null, inSilent);
    }

}

export default ObservableObject;
