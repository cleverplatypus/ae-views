'use strict';

const $ = require('jquery');

let _page = null;


module.exports = function() {
    return function(inPage) {
        return new(function(inPage) {
            this.page = _page = inPage;

            this.resolve = function resolve(inNode, inPath) {
                if (!/^_/.test(inPath)) {
                    inPath = 'data.' + inPath;
                }
                return _page.resolveNodeComponent(inNode).model.prop(inPath);
            };

            this.bindPath = function resolve(inNode, inPath, inHandler) {
                if (!/^_/.test(inPath)) {
                    inPath = 'data.' + inPath;
                }
                const model = _page.resolveNodeComponent(inNode).model;

                model.watch(inPath, function(inPath, inChanges) {
                	inHandler(inChanges.newValue, inChanges.oldValue);
                });
            };

            this.setPath = function setPath(inNode, inPath, inValue) {
            	if (!/^_/.test(inPath)) {
                    inPath = 'data.' + inPath;
                }
                const model = _page.resolveNodeComponent(inNode).model;
                model.prop(inPath, inValue);
            }


        })(inPage);
    };

};
