'use strict';
import Observer from './Observer';
import _ from 'lodash';
import Observable from './Observable';
import ObservableCollection from './ObservableCollection';



const _private = new WeakMap();


class Dummy {
    constructor() {
        this._obj = {};
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

    constructor() {
        super();
        _private.set(this, {
            isSilent: false,
            changesQueue: [],
            observer: new Observer(),
            props: new Dummy(),
            setProp: function(inPath, inValue, inBackPath, inAlreadyFoundChange) {
                const path = inPath.split('.');
                const localProp = path.shift();
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
                } else if (val !== undefined && !(val instanceof ObservableObject)) {
                    throw new Error('trying to set a value through a branch with a non Object node');
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

    fill(inData, inSilent) {
        if(!_.isPlainObject(inData)) {
            throw new Error('ObservableObject.fill() must be passed a plain object');
        }
        _.each(inData, (inValue, inKey) => {
            this.prop(inKey, ObservableObject.fromObject(inValue), inSilent);
        });
    }

    static fromObject(inData) {
        if (_.isArray(inData)) {
            let a = new ObservableCollection();
            _.each(inData, function(inVal, inKey) {
                a.setItemAt(inKey, ObservableObject.fromObject(inVal));
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
        if(!inBase) {
            return;
        }
        if(!(inBase instanceof ObservableObject)) {
            return;
        }
        return inBase.prop(inPath);
    }

    dummy() {
        return _private.get(this);
    }

    prop(inPath, inValue, inSilent) {
        if (!inPath) {
            return this;
        }
        const _p = _private.get(this);
        const myProps = _p.props;
        const path = inPath.split('.');
        var propName = path.shift();
        if (inValue === undefined) {
            if (!myProps.prop(propName)) {
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
        var out = {};
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

    empty() {

    }
}
export default ObservableObject;
