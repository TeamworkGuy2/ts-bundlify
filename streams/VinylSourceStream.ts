import path = require("path");
import VinylFile = require("vinyl");
import StreamUtil = require("./StreamUtil");

/** Based on 'vinyl-source-stream@2.0.0' (https://github.com/hughsk/vinyl-source-stream)
 * Use conventional text streams at the start of your gulp or vinyl pipelines, making for nicer interoperability with the existing npm stream ecosystem.
 */
function VinylSourceStream(filename?: string, baseDir?: string) {
    var ins = StreamUtil.readWrite();
    var out = false;

    var opts: {
        contents: _Readable.Transform;
        path?: string;
        base?: string;
    } = {
        contents: ins,
    };

    if (filename) opts.path = path.resolve(baseDir || process.cwd(), filename);
    if (baseDir) opts.base = baseDir;

    var file = new VinylFile(opts);

    return StreamUtil.readWrite({
        objectMode: true
    }, function (chunk, enc, next) {
        if (!out) {
            this.push(file);
            out = true;
        }

        ins.push(chunk);
        next();
    }, function () {
        ins.push(null);
        this.push(null);
    });
}

export = VinylSourceStream;