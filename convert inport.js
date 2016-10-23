'use strict';
var each = require('lodash/foreach');
var values = require('lodash/values');

var path = require('path'),
    fs = require('fs');

function fromDir(startPath, filter, out) {

    //console.log('Starting from dir '+startPath+'/');

    if (!fs.existsSync(startPath)) {
        console.log("no dir ", startPath);
        return;
    }

    var files = fs.readdirSync(startPath);
    for (var i = 0; i < files.length; i++) {
        var filename = path.join(startPath, files[i]);
        var stat = fs.lstatSync(filename);
        if (stat.isDirectory()) {

            fromDir(filename, filter, out); //recurse
        } else if (filename.indexOf(filter) >= 0) {
            out.push(filename);
        };
    };
    return out;
};

each(fromDir('src', '.js', []), (inPath) => {
    let data = fs.readFileSync(inPath).toString();

    if (/import\s+{/.test(data)) {
        const match = data.match(/import\s+{[\S\s]*?} from '\S*?';/g);
        console.log(match);
        each(match, (inImport) => {
            const imports = inImport.match(/\{\s*(.\w+),?\s*(.\w+)*\s*\}/);
            const lib = inImport.match(/from\s+'([\w\-]+)/)[1];
            // console.log(inPath + '=================');
            // console.log(imports);
            // return;
            //imports.shift();
            var replacementText = [];
            for (let idx in imports) {
                if (idx > 0 && !isNaN(parseInt(idx)) && imports[idx]) {

                    let val = imports[idx];
                    replacementText.push(' const ' + val + ' = require(\'' + lib + '\').' + val + ';');
                }
            }
            data = data.replace(inImport, replacementText.join('\n'));
            fs.writeFileSync(inPath, data);

        });
    }
});
