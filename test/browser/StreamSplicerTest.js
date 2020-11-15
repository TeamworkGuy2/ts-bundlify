"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai = require("chai");
var through = require("through2");
var JSONStream = require("jsonstream");
var split = require("split");
var concat = require("concat-stream");
var LabeledStreamSplicer = require("../../bundlers/browser/LabeledStreamSplicer");
var Splicer = LabeledStreamSplicer.StreamSplicer;
var asr = chai.assert;
var stringify = JSONStream.stringify;
suite("StreamSplicer", function StreamSplicerTest() {
    test("combiner", function (done) {
        this.timeout(500);
        done = plan(1, done);
        var a = split();
        var b = through.obj(function (row, enc, next) {
            this.push(JSON.parse(row));
            next();
        });
        var c = through.obj(function (row, enc, next) { this.push(row.x); next(); });
        var d = through.obj(function (x, enc, next) { this.push(x * 111); next(); });
        var e = stringify();
        var input = through();
        var output = through();
        output.pipe(concat(function (body) {
            try {
                asr.deepEqual(body.toString(), '[\n333\n,\n444\n,\n555\n]\n');
                done();
            }
            catch (err) {
                done(err);
            }
        }));
        new Splicer([input, a, b, c, d, e, output]);
        input.write('{"x":3}\n');
        input.write('{"x":4}\n');
        input.write('{"x":5}');
        input.end();
    });
    test("combiner_stream: returned stream", function (done) {
        this.timeout(500);
        done = plan(1, done);
        var a = split();
        var b = through.obj(function (row, enc, next) {
            this.push(JSON.parse(row));
            next();
        });
        var c = through.obj(function (row, enc, next) { this.push(row.x); next(); });
        var d = through.obj(function (x, enc, next) { this.push(x * 111); next(); });
        var e = stringify();
        var stream = new Splicer([a, b, c, d, e]);
        stream.pipe(concat(function (body) {
            try {
                asr.deepEqual(body.toString(), '[\n333\n,\n444\n,\n555\n]\n');
                done();
            }
            catch (err) {
                done(err);
            }
        }));
        stream.write('{"x":3}\n');
        stream.write('{"x":4}\n');
        stream.write('{"x":5}');
        stream.end();
    });
    test("empty: passthrough stream", function (done) {
        this.timeout(500);
        done = plan(1, done);
        var stream = new Splicer([]);
        stream.pipe(concat(function (body) {
            try {
                asr.deepEqual(body.toString(), 'abc');
                done();
            }
            catch (err) {
                done(err);
            }
        }));
        stream.write('a');
        stream.write('b');
        stream.write('c');
        stream.end();
    });
    test("empty_no_data: with no data", function (done) {
        this.timeout(500);
        done = plan(1, done);
        var stream = new Splicer([]);
        stream.end();
        stream.pipe(concat(function (body) {
            try {
                asr.deepEqual(body.toString(), '');
                done();
            }
            catch (err) {
                done(err);
            }
        }));
    });
    test("get", function () {
        var a = through.obj();
        var b = through.obj();
        var c = through.obj();
        var pipe = new Splicer([a, b, c]);
        asr.equal(pipe.get(0), a, '0');
        asr.equal(pipe.get(1), b, '1');
        asr.equal(pipe.get(2), c, '2');
        asr.equal(pipe.get(3), undefined, '3');
        asr.equal(pipe.get(4), undefined, '4');
        asr.equal(pipe.get(5), undefined, '5');
        asr.equal(pipe.get(-1), c, '-1');
        asr.equal(pipe.get(-1), c, '-1');
        asr.equal(pipe.get(-2), b, '-2');
        asr.equal(pipe.get(-3), a, '-3');
        asr.equal(pipe.get(-4), undefined, '-4');
        asr.equal(pipe.get(-5), undefined, '-5');
    });
    test("get: nested", function () {
        var a = through.obj();
        var b = through.obj();
        var c = through.obj();
        var d = through.obj();
        var e = through.obj();
        var f = through.obj();
        var g = through.obj();
        var pipe = new Splicer([a, [b, c], d, [e], f, g]);
        asr.equal(pipe.get(0), a, "0");
        asr.equal(pipe.get(1, -1), c, "-1");
        asr.equal(pipe.get(1, 3), undefined, "1, 3");
        asr.equal(pipe.get(4, -1), undefined, "4, -1");
        asr.equal(pipe.get(5), g, "5");
    });
    test("multipush", function (done) {
        this.timeout(500);
        done = plan(1, done);
        var a = split();
        var b = through.obj(function (row, enc, next) {
            this.push(JSON.parse(row));
            next();
        });
        var c = through.obj(function (row, enc, next) { this.push(row.x); next(); });
        var d = through.obj(function (x, enc, next) { this.push(x * 111); next(); });
        var e = stringify();
        var stream = new Splicer([]);
        stream.push(a, b, c);
        stream.push(d, e);
        stream.pipe(concat(function (body) {
            try {
                asr.deepEqual(body.toString(), '[\n333\n,\n444\n,\n555\n]\n');
                done();
            }
            catch (err) {
                done(err);
            }
        }));
        stream.write('{"x":3}\n');
        stream.write('{"x":4}\n');
        stream.write('{"x":5}');
        stream.end();
    });
    test("multiunshift", function (done) {
        this.timeout(500);
        done = plan(1, done);
        var a = split();
        var b = through.obj(function (row, enc, next) {
            this.push(JSON.parse(row));
            next();
        });
        var c = through.obj(function (row, enc, next) { this.push(row.x); next(); });
        var d = through.obj(function (x, enc, next) { this.push(x * 111); next(); });
        var e = stringify();
        var stream = new Splicer([]);
        stream.unshift(d, e);
        stream.unshift(a, b, c);
        stream.pipe(concat(function (body) {
            try {
                asr.deepEqual(body.toString(), '[\n333\n,\n444\n,\n555\n]\n');
                done();
            }
            catch (err) {
                done(err);
            }
        }));
        stream.write('{"x":3}\n');
        stream.write('{"x":4}\n');
        stream.write('{"x":5}');
        stream.end();
    });
    test("nested: splicer", function (done) {
        this.timeout(500);
        done = plan(1, done);
        var addNewLines = through(function (buf, enc, next) {
            this.push(buf + '\n');
            next();
        });
        var stream = Splicer.obj([
            [split(), addNewLines],
            through(function (buf, enc, next) {
                this.push('> ' + buf);
                next();
            })
        ]);
        stream.getGroup(0).unshift(through(function (buf, enc, next) {
            this.push(buf.toString('utf8').toUpperCase());
            next();
        }));
        stream.pipe(concat(function (body) {
            try {
                asr.deepEqual(body.toString(), '> A\n> B\n> C\n');
                done();
            }
            catch (err) {
                done(err);
            }
        }));
        stream.write('a\n');
        stream.write('b\n');
        stream.write('c');
        stream.end();
    });
    test("nested_middle: splicer", function (done) {
        this.timeout(500);
        done = plan(1, done);
        var addNewLines = through(function (buf, enc, next) {
            this.push(buf + '\n');
            next();
        });
        var stream = Splicer.obj([
            through.obj(function (str, enc, next) {
                this.push(str.replace(/^./, function (c) {
                    return String.fromCharCode(c.charCodeAt(0) + 5);
                }));
                next();
            }),
            [split(), addNewLines],
            through(function (buf, enc, next) {
                this.push('> ' + buf);
                next();
            })
        ]);
        stream.getGroup(1).unshift(through(function (buf, enc, next) {
            this.push(buf.toString('utf8').toUpperCase());
            next();
        }));
        stream.pipe(concat(function (body) {
            try {
                asr.deepEqual(body.toString(), '> F\n> G\n> H\n');
                done();
            }
            catch (err) {
                done(err);
            }
        }));
        stream.write('a\n');
        stream.write('b\n');
        stream.write('c');
        stream.end();
    });
    test("pop", function (done) {
        this.timeout(500);
        done = plan(3, done);
        var expected = { replacer: ['333', '444'] };
        var a = split();
        var b = through.obj(function (row, enc, next) {
            this.push(JSON.parse(row));
            next();
        });
        var c = through.obj(function (row, enc, next) {
            this.push(row.x);
            next();
        });
        var d = through.obj(function (x, enc, next) {
            this.push(String(x * 111));
            next();
        });
        var replacer = through(function (buf, enc, next) {
            var ex = expected.replacer.shift();
            asr.equal(buf.toString(), ex);
            done();
            this.push(buf.toString('hex') + '\n');
            if (expected.replacer.length === 0) {
                stream.pop();
            }
            next();
        });
        var stream = new Splicer([a, b, c, d, replacer]);
        stream.pipe(concat(function (body) {
            try {
                asr.deepEqual(body.toString(), '333333\n343434\n555666');
                done();
            }
            catch (err) {
                done(err);
            }
        }));
        stream.write('{"x":3}\n');
        stream.write('{"x":4}\n');
        stream.write('{"x":5}\n');
        stream.write('{"x":6}');
        stream.end();
    });
    test("push", function (done) {
        this.timeout(500);
        var expected = {
            first: [333, 444, 555, 666, 777],
            second: [6.66, 7.77],
            output: [3.33, 4.44, 5.55, 3, 2],
        };
        done = plan(5 + 2 + 5 + 3, done);
        var a = split();
        var b = through.obj(function (row, enc, next) {
            this.push(JSON.parse(row));
            next();
        });
        var c = through.obj(function (row, enc, next) { this.push(row.x); next(); });
        var d = through.obj(function (x, enc, next) { this.push(x * 111); next(); });
        var first = through.obj(function (row, enc, next) {
            if (expected.first.length === 2) {
                asr.equal(p.length, 5);
                done();
                p.push(second);
                asr.equal(p.length, 6);
                done();
            }
            var ex = expected.first.shift();
            asr.deepEqual(row, ex);
            done();
            this.push(row / 100);
            next();
        });
        var second = through.obj(function (row, enc, next) {
            var ex = expected.second.shift();
            asr.deepEqual(row, ex);
            done();
            this.push(Math.floor(10 - row));
            next();
        });
        var p = Splicer.obj([a, b, c, d, first]);
        asr.equal(p.length, 5);
        done();
        p.pipe(through.obj(function (row, enc, next) {
            var ex = expected.output.shift();
            asr.deepEqual(row, ex);
            done();
            next();
        }));
        p.write('{"x":3}\n');
        p.write('{"x":4}\n');
        p.write('{"x":5}\n');
        p.write('{"x":6}\n');
        p.write('{"x":7}');
        p.end();
    });
    test("shift", function (done) {
        this.timeout(500);
        var expected = {
            a: [3, 4],
            b: [300, 400, 5, 6],
            c: [310, 410, 15, 16],
            output: [155, 205, 15 / 2, 8],
        };
        done = plan(2 + 4 + 4 + 4, done);
        var a = through.obj(function (x, enc, next) {
            var ex = expected.a.shift();
            asr.equal(x, ex, 'a');
            done();
            this.push(x * 100);
            next();
        });
        var b = through.obj(function (x, enc, next) {
            var ex = expected.b.shift();
            asr.equal(x, ex, 'b');
            done();
            if (expected.b.length === 2)
                p.shift();
            this.push(x + 10);
            next();
        });
        var c = through.obj(function (x, enc, next) {
            var ex = expected.c.shift();
            asr.equal(x, ex, 'c');
            done();
            this.push(x / 2);
            next();
        });
        var p = Splicer.obj([a, b, c]);
        p.pipe(through.obj(function (x, enc, next) {
            var ex = expected.output.shift();
            asr.equal(x, ex);
            done();
            next();
        }));
        p.write(3);
        p.write(4);
        p.write(5);
        p.write(6);
        p.end();
    });
    test("shift", function (done) {
        var expected = {
            a: [3, 4],
            b: [300, 400, 5, 6],
            c: [310, 410, 15, 16],
            output: [155, 205, 15 / 2, 8],
        };
        done = plan(2 + 4 + 4 + 4, done);
        var a = through.obj(function (x, enc, next) {
            var ex = expected.a.shift();
            asr.equal(x, ex, 'a');
            done();
            this.push(x * 100);
            next();
        });
        var b = through.obj(function (x, enc, next) {
            var ex = expected.b.shift();
            asr.equal(x, ex, 'b');
            done();
            if (expected.b.length === 2)
                p.shift();
            this.push(x + 10);
            next();
        });
        var c = through.obj(function (x, enc, next) {
            var ex = expected.c.shift();
            asr.equal(x, ex, 'c');
            done();
            this.push(x / 2);
            next();
        });
        var p = Splicer.obj([a, b, c]);
        p.pipe(through.obj(function (x, enc, next) {
            var ex = expected.output.shift();
            asr.equal(x, ex);
            done();
            next();
        }));
        p.write(3);
        p.write(4);
        p.write(5);
        p.write(6);
        p.end();
    });
    test("splice", function (done) {
        var expected = {
            replacer: ['333', '444', '5000', '6000'],
            d: [3, 4],
            thousander: [5, 6],
        };
        done = plan(4 + 2 + 2 + 1, done);
        var a = split();
        var b = through.obj(function (row, enc, next) {
            this.push(JSON.parse(row));
            next();
        });
        var c = through.obj(function (row, enc, next) {
            this.push(row.x);
            next();
        });
        var d = through.obj(function (x, enc, next) {
            asr.equal(x, expected.d.shift(), 'd');
            done();
            this.push(String(x * 111));
            next();
        });
        var thousander = through.obj(function (x, enc, next) {
            asr.equal(x, expected.thousander.shift(), 'thousander');
            done();
            this.push(String(x * 1000));
            next();
        });
        var replacer = through(function (buf, enc, next) {
            var ex = expected.replacer.shift();
            asr.equal(buf.toString(), ex);
            done();
            if (expected.replacer.length === 2) {
                stream.splice(3, 1, thousander);
            }
            this.push(buf.toString('hex') + '\n');
            next();
        });
        var stream = new Splicer([a, b, c, d, replacer]);
        stream.pipe(concat(function (body) {
            asr.deepEqual(body.toString(), '333333\n343434\n35303030\n36303030\n');
            done();
        }));
        stream.write('{"x":3}\n');
        stream.write('{"x":4}\n');
        stream.write('{"x":5}\n');
        stream.write('{"x":6}');
        stream.end();
    });
    test("unshift", function (done) {
        var expected = {
            a: [5, 6],
            b: [3, 4, 500, 600],
            c: [13, 14, 510, 610],
            output: [13 / 2, 7, 255, 305],
        };
        done = plan(2 + 4 + 4 + 4, done);
        var a = through.obj(function (x, enc, next) {
            var ex = expected.a.shift();
            asr.equal(x, ex, 'a');
            done();
            this.push(x * 100);
            next();
        });
        var b = through.obj(function (x, enc, next) {
            var ex = expected.b.shift();
            asr.equal(x, ex, 'b');
            done();
            if (expected.b.length === 2)
                p.unshift(a);
            this.push(x + 10);
            next();
        });
        var c = through.obj(function (x, enc, next) {
            var ex = expected.c.shift();
            asr.equal(x, ex, 'c');
            done();
            this.push(x / 2);
            next();
        });
        var p = Splicer.obj([b, c]);
        p.pipe(through.obj(function (x, enc, next) {
            var ex = expected.output.shift();
            asr.equal(x, ex);
            done();
            next();
        }));
        p.write(3);
        p.write(4);
        p.write(5);
        p.write(6);
        p.end();
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
