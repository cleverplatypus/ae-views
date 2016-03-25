'use strict';

module.exports = function(fRef) { //koala

    return function(inPage) {
        return new(function(inPage) {
            this.page = inPage;

            this.resolve = function(inNode, inPath) {
                return new Promise(function(resolve, reject) {
                    fRef.child(inPath).once('value', function(inSnap) {
                        resolve(inSnap.val())
                    }, function() {});
                });
            }

            this.bindPath = function resolve(inPath, inHandler) {
            	
            };

        })(inPage);
    };
};
