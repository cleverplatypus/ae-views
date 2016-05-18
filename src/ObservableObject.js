'use strict';
import Observer from './Observer';
import _ from 'lodash';
import Observable from './Observable';



const _private = new WeakMap();


class Dummy {
    constructor(inIsCollection) {
        this._obj = inIsCollection ? [] : {};
        _private.set(this, {

        });
    }
    prop(inName, inValue) {
        if (inValue !== undefined) {
            this._obj[inName] = inValue;
        } else {
            return this._obj[inName];
        }
    }
}

class ObservableObject extends Observable {

    constructor(inConfig) {
        super();
        const isCollection = (_.get(inConfig, 'isCollection') === true);
        _private.set(this, {
            isSilent: false,
            isCollection: isCollection,
            changesQueue: [],
            observer: new Observer(),
            props: new Dummy(isCollection),
            setProp: function(inPath, inValue, inBackPath, inAlreadyFoundChange) {

                const path = !isNaN(inPath) ? [inPath] : inPath.split('.');
                var localProp = path.shift();

                inBackPath = inBackPath || [];
                inBackPath.push(localProp);
                let out;

                let val = _private.get(this).props.prop(localProp);

                if (!path.length) {
                    _private.get(this).props.prop(localProp, ObservableObject.fromObject(inValue));
                    return inAlreadyFoundChange ? null : {
                        path: inBackPath.join('.'),
                        change: {
                            type: val === undefined ? 'add' : 'replace',
                            oldValue: val,
                            newValue: _private.get(this).props.prop(localProp)
                        }
                    };
                } else if (val !== undefined && !(val instanceof Observable)) {
                    throw new Error('trying to set a value through a branch with a non Observable node');
                } else {
                    let alreadyFound = false;
                    if (val === undefined) {
                        val = new ObservableObject();
                        _private.get(this).props.prop(localProp, val);
                        out = inAlreadyFoundChange ? null : {
                            path: inBackPath.join('.'),
                            change: {
                                type: 'add',
                                oldValue: undefined,
                                newValue: _private.get(this).props.prop(localProp)
                            }
                        };
                        alreadyFound = true;
                    }
                    let result = _private.get(val).setProp(path.join('.'), inValue, inBackPath, alreadyFound);
                    return (result ? result : out);
                }
            }.bind(this)
        });

    }

    * [Symbol.iterator]() {
        const src = _private.get(this).props._obj;
        if(this.isCollection) {
            for (var item of src) {
                yield item;
            }
        } else {
            for(let key in src) {
                const out = {};
                out[key] = src[key];
                yield out;
            }
        }
    }


    fill(inData, inSilent) {
        const _p = _private.get(this);
        _p.props._obj = this.isCollection ? [] : {};
        if (_.keys(inData).length) {
            this.merge(inData, inSilent);
        } else {
            if (!inSilent) {
                _p.changesQueue.push({
                    path: '',
                    type: 'emptied'
                });
                ObservableObject.notifyWatchers(_p);
            }
        }


    }

    merge(inData, inSilent) {

        if (!_.isPlainObject(inData) && !_.isArray(inData)) {
            throw new Error('ObservableObject.fill() must be passed a plain object');
        }
        _.each(inData, (inValue, inKey) => {
            this.prop(inKey, ObservableObject.fromObject(inValue), inSilent);
        });
    }

    static fromObject(inData) {
        if (_.isArray(inData)) { //REFACTOR: duplicated code?
            let a = new ObservableObject({ isCollection: true });
            _.each(inData, function(inVal, inKey) {
                a.prop(inKey, ObservableObject.fromObject(inVal));
            });
            return a;
        } else if (_.isPlainObject(inData)) {
            let o = new ObservableObject();
            _.each(inData, function(inVal, inKey) {
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

    dummy() {
        return _private.get(this);
    }

    get isCollection() {
        return _private.get(this).isCollection;
    }

    get length() {
        const _p = _private.get(this);
        if (_p.isCollection) {
            return _.keys(_p.props._obj).length;
        }
        return undefined;
    }

    prop(inPath, inValue, inSilent) {
        if (inPath !== 0 && !inPath) { //path can be an index. !inPath would ignore zero as a property
            return this;
        }
        const _p = _private.get(this);
        const myProps = _p.props;
        const path = !isNaN(inPath) ? [inPath] : inPath.split('.');
        var propName = path.shift();
        if (_p.isCollection && isNaN(propName) && propName !== 'length') {
            throw new Error('Collection ObservableObject can only have numbers as keys');
        } else if (_p.isCollection) {
            propName = !isNaN(propName) ? parseInt(propName) : propName;
            if (isNaN(propName)) {
                return this.length;
            }
        }
        if (inValue === undefined) {
            if (myProps.prop(propName) === undefined) {
                return undefined;
            } else {
                if (path.length && !(myProps.prop(propName) instanceof Observable)) {
                    console.warn('trying to access path through a non traversable property');
                    return undefined;
                } else if (path.length) {
                    return myProps.prop(propName).prop(path.join('.'));
                }
                return myProps.prop(propName);
            }
        } else {
            const branch = [];
            var change = _p.setProp(inPath, inValue, branch);
            if (!inSilent) {
                _p.changesQueue.push(change);
                ObservableObject.notifyWatchers(_p);
            }
        }
    }


    watch(inPath, inHandler) {
        const _p = _private.get(this);
        _p.observer.listen(inPath, inHandler);
    }

    toNative(inDeep) {
        var out = _private.get(this).isCollection ? [] : {};
        _.each(_private.get(this).props._obj, (inVal, inKey) => {
            let isObservable = inVal instanceof Observable;
            out[inKey] = isObservable && inDeep === true ? inVal.toNative(true) : inVal;
        });
        return out;
    }

    static notifyWatchers(inInstance) {
        if (inInstance.isSilent) {
            return;
        }
        for (let c of inInstance.changesQueue) {
            inInstance.observer.notify(c.path, c.change);
        }
        inInstance.changesQueue = [];

    }

    empty(inSilent) {
        this.fill(null, inSilent);
    }
}
export default ObservableObject;
