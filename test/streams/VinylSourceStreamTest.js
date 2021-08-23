"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai = require("chai");
var fs = require("fs");
var path = require("path");
var StreamUtil = require("../../streams/StreamUtil");
var VinylSourceStream = require("../../streams/VinylSourceStream");
var asr = chai.assert;
function upper() {
    var stream = StreamUtil.readWrite({}, function (chunk, _, cb) {
        var str = chunk.toString().toUpperCase();
        stream.results.push(str);
        cb(null, new Buffer(str));
    });
    stream.results = [];
    return stream;
}
suite("VinylSourceStream", function () {
    test("capitalizing test file", function (done) {
        var upperStream = upper();
        fs.createReadStream(__filename)
            .pipe(VinylSourceStream(__filename))
            .pipe(StreamUtil.readWrite({ objectMode: true }, function (f, _, cb) {
            var file = f;
            file.contents = file.contents.pipe(upperStream);
            cb(null, file);
        }))
            .once("finish", function () {
            asr.equal(upperStream.results.join(""), fs.readFileSync(__filename, "utf8").toUpperCase(), "transformed as expected");
            done();
        })
            .once("error", function (err) {
            done(err);
        });
    });
    test("baseDir: defaults to process.cwd()", function (done) {
        process.chdir(path.resolve(__dirname, "..", ".."));
        fs.createReadStream(__filename)
            .pipe(VinylSourceStream(path.basename(__filename)))
            .on("data", function (file) {
            asr.equal(process.cwd(), path.dirname(file.path), "defaults to process.cwd()");
            process.chdir(__dirname);
            done();
        });
    });
});
