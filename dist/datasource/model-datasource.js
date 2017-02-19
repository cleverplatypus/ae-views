'use strict';

let _page = null;
import ComponentModel from '../ComponentModel';

export default function() {
    return function(inPage) {
        const ModelDataSource = function(inPage) {
            this.page = _page = inPage;

            this.resolve = function resolve(inNode, inPath, inModelName) {
                return new Promise((resolve, rejectPromise) => {

                    const model = _page.resolveNodeModel(inNode, inModelName);
                    if (model instanceof ComponentModel) {
                        if (!/^_/.test(inPath) && inPath) {
                            if (inPath === '.') {
                                inPath = 'data';
                            } else {
                                inPath = 'data' + (inPath ? '.' + inPath : '');
                            }
                        }
                    }
                    if (inPath) {
                        const value = model.prop(inPath);
                        if (value instanceof Promise) {
                            value.then(resolve);
                        } else {
                            resolve(value);
                        }
                    } else {
                        resolve(model);
                    }

                });
            };

            this.unbindPath = function unbindPath(inNode, inObserver, inPath, inModelName) { //CRITICAL: refactor to comply to new binding mechanism
                const model = _page.resolveNodeModel(inNode, inModelName);
                model.unwatch(inObserver, inPath);
            };

            this.bindPath = function bindPath(inNode, inPath, inHandler, inModelName) {
                const model = _page.resolveNodeModel(inNode, inModelName);

                if (model instanceof ComponentModel) {
                    if (!/^(?:\[)?_/.test(inPath) && inPath) {
                        if (inPath === '.') {
                            inPath = 'data';
                        } else {
                            inPath = 'data' + (inPath ? '.' + inPath : '');
                        }
                    }
                }

                model.watch(inPath, function(inPath, inChanges) {
                    inHandler(inChanges.newValue, inChanges.oldValue, inChanges.type); //TODO: test the change.type === 'pruned' scenario
                });
            };

            this.setPath = function setPath(inNode, inPath, inValue, inModelName) {
                const model = _page.resolveNodeModel(inNode, inModelName);
                if (model instanceof ComponentModel) {
                    if (!/^(?:\[)?_/.test(inPath) && inPath) {
                        if (inPath === '.') {
                            inPath = 'data';
                        } else {
                            inPath = 'data' + (inPath ? '.' + inPath : '');
                        }
                    }
                }
                model.prop(inPath, inValue);
            };

        };
        return new ModelDataSource(inPage);
    };

}
