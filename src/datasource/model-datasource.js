'use strict';

let _page = null;

export default function() {
    return function(inPage) {
        const ModelDataSource = function(inPage) {
            this.page = _page = inPage;

            this.resolve = function resolve(inNode, inPath) {
                return new Promise((resolvePromise, rejectPromise) => {

                    if (!/^_/.test(inPath) && inPath) {
                        if (inPath === '.') {
                            inPath = 'data';
                        } else {
                            inPath = 'data' + (inPath ? '.' + inPath : '');
                        }
                    }
                    const model = _page.resolveNodeModel(inNode, inPath);
                    resolvePromise(inPath ? model.prop(inPath) : model);

                });
            };

            this.unbindPath = function unbindPath(inNode, inObserver, inPath) {
                const model = _page.resolveNodeModel(inNode, inPath);
                model.unwatch(inObserver, inPath);
            };

            this.bindPath = function bindPath(inNode, inPath, inHandler) {
                if (!/^_/.test(inPath) && inPath) {
                    if (inPath === '.') {
                        inPath = 'data';
                    } else {
                        inPath = 'data' + (inPath ? '.' + inPath : '');
                    }
                }
                const model = _page.resolveNodeModel(inNode, inPath);

                model.watch(inPath, function(inPath, inChanges) {
                    inHandler(inChanges.newValue, inChanges.oldValue);//TODO: test the change.type === 'pruned' scenario
                });
            };

            this.setPath = function setPath(inNode, inPath, inValue) {
                if (!/^_/.test(inPath)) {
                    inPath = 'data.' + inPath;
                }
                const model = _page.resolveNodeModel(inNode, inPath);
                model.prop(inPath, inValue);
            };


        };
        return new ModelDataSource(inPage);
    };

}
