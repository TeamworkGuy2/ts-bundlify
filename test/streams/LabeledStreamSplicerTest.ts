"use strict";
import chai = require("chai");
import mocha = require("mocha");
import deps = require("module-deps");
import pack = require("browser-pack");
import ConcatStream = require("../../streams/ConcatStream");
import Splicer = require("../../streams/LabeledStreamSplicer");
import StreamUtil = require("../../streams/StreamUtil");

var asr = chai.assert;

suite("LabeledStreamSplicer", function LabeledStreamSplicerTest() {

    test("bundle", function (done) {
        this.timeout(500);
        done = plan(1, done);

        var pipeline = Splicer.obj([
            "deps", [deps()],
            "pack", [pack({ raw: true })]
        ]);
        pipeline.pipe(ConcatStream.from(function (body) {
            var bundleSrc = body.toString("utf8");
            Function("console", bundleSrc)({ log: log });
            function log(msg: string) {
                asr.equal(msg, "main: 56055");
                done();
            }
        }));

        pipeline.getGroup("deps").push(StreamUtil.readWrite({ objectMode: true }, function (row, enc, next) {
            row.source = row.source.replace(/111/g, "11111");
            this.push(row);
            next();
        }));

        pipeline.end(__dirname + "/../browser/bundle/main.js");
    });
});


function plan(count: number, done: mocha.Done) {
    var i = 0;

    return function (err?: any) {
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