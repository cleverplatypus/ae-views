module.exports = function() {
    return function(inPage) {
        return new(function(inPage) {
            this.page = inPage;

            this.resolve = function(inNode) {
                return;
            }

            this.bindPath = function resolve(inPath, inHandler) {
            	
            };


        })(inPage);
    };
};
