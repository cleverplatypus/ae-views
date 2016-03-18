const Observer = require('./Observer');
const _ = require('lodash');

module.exports = (function() {
	'use strict';

	const _private = new WeakMap();
	
	function notifyWatchers(inInstance) {
        const _p = _private.get(inInstance);
        if (_p.isSilent) {
            return;
        }
        for (let c of _p.changesQueue) {
           // console.log(c);
            _p.observer.notify(c.path, c.change);
        }
        _p.changesQueue = [];

	}

	function fromObject(inObj) {
		if(_.isArray(inObj)) {
			let a = new ObservableCollection();
			_.each(inObj, function(inVal, inKey) {
				a.setItemAt(inKey, fromObject(inVal));
			});
			return a;
		} else if(_.isPlainObject(inObj)) {
			let o = new ObservableObject();
			_.each(inObj, function(inVal, inKey) {
				o.prop(inKey, fromObject(inVal));
			});
			return o;
		} else {
			return inObj;
		}
	}
    class Observable {

    }

	class ObservableCollection extends Observable{

		constructor() {
			_private.set(this, {
				_data : []
			});
		}

		setItemAt(inIndex, inValue) {
			_.set(_private.get(this)._data, inIndex, inValue);
		}

		toArray() {
			return _private.get(this)._data.concat();
		}
	}

	class Dummy {
		constructor() {
			this._obj = {};
            _private.set(this, {

            });
		}
		prop(inName, inValue) {
			if(inValue) {
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
				isSilent : false,
				changesQueue : [],
				observer : new Observer(),
				props : new Dummy(),
                setProp : function(inPath, inValue, inBackPath, inAlreadyFoundChange) {
                    const path = inPath.split('.');
                    const localProp = path.shift();
                    inBackPath = inBackPath || [];
                    inBackPath.push(localProp);
                    let out;

                    let val = _private.get(this).props[localProp];

                    if(!path.length) {
                        _private.get(this).props[localProp] = fromObject(inValue);
                        return inAlreadyFoundChange ? null : {
                            path : inBackPath.join('.'),
                            change : {
                                type : val === undefined ? 'add' : 'replace',
                                oldValue : val,
                                newValue : _private.get(this).props[localProp]
                            }
                        };
                    } else if(val !== undefined && !(val instanceof Observable)) {
                        throw new Error('trying to set a value through a branch with a primitive node');
                    } else {
                        let alreadyFound = false;
                        if(val === undefined) {
                            val = new ObservableObject();
                            _private.get(this).props[localProp] = val;
                            out = inAlreadyFoundChange ? null : {
                                path : inBackPath.join('.'),
                                change : {
                                    type : 'add',
                                    oldValue : undefined,
                                    newValue : _private.get(this).props[localProp]
                                }
                            };
                            alreadyFound = true
                        }
                        let result = _private.get(val).setProp(path.join('.'), inValue, inBackPath, alreadyFound);
                        return (result ? result : out);
                    }
                }.bind(this)
			});

		}

		dummy() {
			return _private.get(this);
		}

        prop(inPath, inValue) {
            if (!inPath) {
                throw new Error('ObservableObject.prototype.prop must be passed a valid path');
            }
            const _p = _private.get(this);
            const myProps = _p.props;
            const path = inPath.split('.');
            var propName = path.shift();
            if (!inValue) {
                if(!myProps.prop(propName)) {
                    return undefined;
                } else {
                    if (path.length && !(myProps.prop(propName) instanceof Observable)) {
                        console.warn('trying to access path through a non traversable property');
                        return undefined;
                    } else if (path.length) {
                        return myProps.prop(propName).prop(path.join('.'))
                    }
                    return myProps.prop(propName);
                }
            } else {
                const branch = [];
                var change = _p.setProp(inPath, inValue, branch);
                console.log(change.path);
                _p.changesQueue.push(change);
                notifyWatchers(this);
            }
        }


		watch(inPath, inHandler) {
			const _p = _private.get(this);
			_p.observer.listen(inPath, inHandler);
		}

		change(inPath, inHandler) {
			_private.get(this).isSilent = true;
			this.prop(inPath, inHandler(this.prop(inPath))) &&
				notifyWatchers(this, inPath);

			this.isSilent = false;
		}

		empty() {

		}

		static fromObject(inObj) {
			return fromObject(inObj)
		}
	}
	return ObservableObject;

})();
