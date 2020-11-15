"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai = require("chai");
var through = require("through2");
var deps = require("module-deps");
var pack = require("browser-pack");
var concat = require("concat-stream");
var Splicer = require("../../bundlers/browser/LabeledStreamSplicer");
var asr = chai.assert;
suite("LabeledStreamSplicer", function LabeledStreamSplicerTest() {
    test("bundle", function (done) {
        this.timeout(500);
        done = plan(1, done);
        var pipeline = Splicer.obj([
            "deps", [deps()],
            "pack", [pack({ raw: true })]
        ]);
        pipeline.pipe(concat(function (body) {
            var bundleSrc = body.toString("utf8");
            Function("console", bundleSrc)({ log: log });
            function log(msg) {
                asr.equal(msg, "main: 56055");
                done();
            }
        }));
        pipeline.getGroup("deps").push(through.obj(function (row, enc, next) {
            row.source = row.source.replace(/111/g, "11111");
            this.push(row);
            next();
        }));
        pipeline.end(__dirname + "/bundle/main.js");
    });
});
function plan(count, done) {
    var i = 0;
    return function (err) {
        i++;
        if (err != null) {
            done(err);
        }
        else if (i === count) {
            done();
        }
        else if (i > count) {
            done(new Error("done called more times than expected (" + count + ")"));
        }
    };
}
