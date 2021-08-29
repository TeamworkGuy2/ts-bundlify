"use strict";
import chai = require("chai");
import fs = require("fs");
import path = require("path");
import VinylFile = require("vinyl");
import StreamUtil = require("../../streams/StreamUtil");
import VinylSourceStream = require("../../streams/VinylSourceStream");

var asr = chai.assert;

function upper() {
    var stream = StreamUtil.readWrite({}, function (chunk, _, cb) {
        var str = chunk.toString().toUpperCase();
        (<any>stream).results.push(str);
        cb(<any>null, Buffer.from(str));
    });
    (<any>stream).results = [];
    return stream;
}

suite("VinylSourceStream", function () {

    test("capitalizing test file", function (done) {
        var upperStream = upper();

        fs.createReadStream(__filename)
            .pipe(VinylSourceStream(__filename))
            .pipe(StreamUtil.readWrite({ objectMode: true }, function (f, _, cb) {
                var file = <VinylFile><any>f;
                file.contents = (<NodeJS.ReadableStream>file.contents).pipe(upperStream);
                cb(<any>null, file);
            }))
            .once("finish", function () {
                asr.equal((<any>upperStream).results.join(""), fs.readFileSync(__filename, "utf8").toUpperCase(), "transformed as expected");
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