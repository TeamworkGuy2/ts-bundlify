"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai = require("chai");
var ConcatStream = require("../../streams/ConcatStream");
var asr = chai.assert;
suite("ConcatStream", function () {
    test("array stream", function (done) {
        var arrays = ConcatStream.from({ encoding: "array" }, function (out) {
            asr.deepEqual(out, [1, 2, 3, 4, 5, 6]);
            done();
        });
        arrays.write([1, 2, 3]);
        arrays.write([4, 5, 6]);
        arrays.end();
    });
    test("buffer stream", function (done) {
        var buffers = ConcatStream.from(function (out) {
            asr.ok(Buffer.isBuffer(out));
            asr.equal(out.toString("utf8"), "pizza Array is not a stringy cat");
            done();
        });
        buffers.write(ConcatStream.bufferFrom("pizza Array is not a ", "utf8"));
        buffers.write(ConcatStream.bufferFrom("stringy cat"));
        buffers.end();
    });
    test("buffer mixed writes", function (done) {
        var buffers = ConcatStream.from(function (out) {
            asr.ok(Buffer.isBuffer(out));
            asr.equal(out.toString("utf8"), "pizza Array is not a stringy cat555");
            done();
        });
        buffers.write(ConcatStream.bufferFrom("pizza"));
        buffers.write(" Array is not a ");
        buffers.write([115, 116, 114, 105, 110, 103, 121]);
        var u8 = new Uint8Array(4);
        u8[0] = 32;
        u8[1] = 99;
        u8[2] = 97;
        u8[3] = 116;
        buffers.write(u8);
        buffers.write(555);
        buffers.end();
    });
    test("type inference works as expected", function () {
        var stream = ConcatStream.from();
        asr.equal(stream.inferEncoding(["hello"]), "array");
        asr.equal(stream.inferEncoding(ConcatStream.bufferFrom("hello")), "buffer");
        asr.equal(stream.inferEncoding(undefined), "buffer");
        asr.equal(stream.inferEncoding(new Uint8Array(1)), "uint8array");
        asr.equal(stream.inferEncoding("hello"), "string");
        asr.equal(stream.inferEncoding(""), "string");
        asr.equal(stream.inferEncoding({ hello: "world" }), "object");
        asr.equal(stream.inferEncoding(1), "buffer");
    });
    test("no callback stream", function () {
        var stream = ConcatStream.from();
        stream.write("space");
        stream.end(" cats");
    });
    test("no encoding set, no data", function (done) {
        var stream = ConcatStream.from(function (data) {
            asr.deepEqual(data, []);
            done();
        });
        stream.end();
    });
    test("encoding set to string, no data", function (done) {
        var stream = ConcatStream.from({ encoding: "string" }, function (data) {
            asr.deepEqual(data, "");
            done();
        });
        stream.end();
    });
    test("writing objects", function (done) {
        var stream = ConcatStream.from({ encoding: "objects" }, concatted);
        function concatted(objs) {
            asr.equal(objs.length, 2);
            asr.deepEqual(objs[0], { "foo": "bar" });
            asr.deepEqual(objs[1], { "baz": "taco" });
            done();
        }
        stream.write({ "foo": "bar" });
        stream.write({ "baz": "taco" });
        stream.end();
    });
    test("switch to objects encoding if no encoding specified and objects are written", function (done) {
        var stream = ConcatStream.from(concatted);
        function concatted(objs) {
            asr.equal(objs.length, 2);
            asr.deepEqual(objs[0], { "foo": "bar" });
            asr.deepEqual(objs[1], { "baz": "taco" });
            done();
        }
        stream.write({ "foo": "bar" });
        stream.write({ "baz": "taco" });
        stream.end();
    });
    test("string -> buffer stream", function (done) {
        var strings = ConcatStream.from({ encoding: "buffer" }, function (out) {
            asr.ok(Buffer.isBuffer(out));
            asr.equal(out.toString("utf8"), "nacho dogs");
            done();
        });
        strings.write("nacho ");
        strings.write("dogs");
        strings.end();
    });
    test("string stream", function (done) {
        var strings = ConcatStream.from({ encoding: "string" }, function (out) {
            asr.equal(typeof out, "string");
            asr.equal(out, "nacho dogs");
            done();
        });
        strings.write("nacho ");
        strings.write("dogs");
        strings.end();
    });
    test("end chunk", function (done) {
        var endchunk = ConcatStream.from({ encoding: "string" }, function (out) {
            asr.equal(out, "this is the end");
            done();
        });
        endchunk.write("this ");
        endchunk.write("is the ");
        endchunk.end("end");
    });
    test("string from mixed write encodings", function (done) {
        var strings = ConcatStream.from({ encoding: "string" }, function (out) {
            asr.equal(typeof out, "string");
            asr.equal(out, "nacho dogs");
            done();
        });
        strings.write("na");
        strings.write(ConcatStream.bufferFrom("cho"));
        strings.write([32, 100]);
        var u8 = new Uint8Array(3);
        u8[0] = 111;
        u8[1] = 103;
        u8[2] = 115;
        strings.end(u8);
    });
    test("string from buffers with multibyte characters", function (done) {
        var strings = ConcatStream.from({ encoding: "string" }, function (out) {
            asr.equal(typeof out, "string");
            asr.equal(out, "☃☃☃☃☃☃☃☃");
            done();
        });
        var snowman = ConcatStream.bufferFrom("☃");
        for (var i = 0; i < 8; i++) {
            strings.write(snowman.slice(0, 1));
            strings.write(snowman.slice(1));
        }
        strings.end();
    });
    test("string infer encoding with empty string chunk", function (done) {
        var strings = ConcatStream.from(function (out) {
            asr.equal(typeof out, "string");
            asr.equal(out, "nacho dogs");
            done();
        });
        strings.write("");
        strings.write("nacho ");
        strings.write("dogs");
        strings.end();
    });
    test("to string numbers", function (done) {
        var write = ConcatStream.from(function (str) {
            asr.equal(str, "a1000");
            done();
        });
        write.write("a");
        write.write(1000);
        write.end();
    });
    test("typed array stream", function (done) {
        var a = new Uint8Array(5);
        a[0] = 97;
        a[1] = 98;
        a[2] = 99;
        a[3] = 100;
        a[4] = 101;
        var b = new Uint8Array(3);
        b[0] = 32;
        b[1] = 102;
        b[2] = 103;
        var c = new Uint8Array(4);
        c[0] = 32;
        c[1] = 120;
        c[2] = 121;
        c[3] = 122;
        var arrays = ConcatStream.from({ encoding: "Uint8Array" }, function (out) {
            asr.equal(typeof out.subarray, "function");
            asr.deepEqual(ConcatStream.bufferFrom(out).toString("utf8"), "abcde fg xyz");
            done();
        });
        arrays.write(a);
        arrays.write(b);
        arrays.end(c);
    });
    test("typed array from strings, buffers, and arrays", function (done) {
        var arrays = ConcatStream.from({ encoding: "Uint8Array" }, function (out) {
            asr.equal(typeof out.subarray, "function");
            asr.deepEqual(ConcatStream.bufferFrom(out).toString("utf8"), "abcde fg xyz");
            done();
        });
        arrays.write("abcde");
        arrays.write(ConcatStream.bufferFrom(" fg "));
        arrays.end([120, 121, 122]);
    });
});
