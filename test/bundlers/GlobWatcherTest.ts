"use strict";
import mocha = require("mocha");
import chai = require("chai");
import domain = require("domain");
import GlobWatcher = require("../../bundlers/GlobWatcher");

var asr = chai.assert;
var is = GlobWatcher.isNegatedGlob;

suite("isNegatedGlob", function () {

    test("should export a function", function () {
        asr.equal(typeof is, "function");
    });

    test("should return an object", function () {
        asr.equal(typeof is("foo"), "object");
    });

    test("should expose a negated property", function () {
        asr.equal(typeof is("foo").negated, "boolean");
    });

    test("should expose an original property", function () {
        asr.equal(typeof is("foo").original, "string");
        asr.equal(is("foo").original, "foo");
    });

    test("should expose an pattern property", function () {
        asr.equal(typeof is("foo").pattern, "string");
    });

    test("should throw an error when invalid args are passed", function (done) {
        try {
            (<any>is)();
            done(new Error("expected an error"));
        } catch (err) {
            asr.isNotNull(err);
            done();
        }
    });

    test("should be true when a pattern is negated", function () {
        asr.isNotNull(is("!foo").negated);
    });

    test("should be false when the exclamation is escaped", function () {
        asr.isNotNull(!is("\\!foo").negated);
    });

    test("should be false when a pattern is not negated", function () {
        asr.isNotNull(!is("foo").negated);
    });

    test("should be false when a pattern is an extglob", function () {
        asr.isNotNull(!is("!(foo)").negated);
    });

    test("should be true when first paren is escaped", function () {
        asr.isNotNull(is("!\\(foo)").negated);
    });

    test("should remove the leading `!` from a pattern", function () {
        asr.equal(is("!foo").pattern, "foo");
    });

    test("should not remove the leading `!` from an extglob pattern", function () {
        asr.equal(is("!(foo)").pattern, "!(foo)");
        asr.isNotNull(!is("!(foo)").negated);
    });
});


var normalize = GlobWatcher.normalizePath;

suite("normalize-path", function () {

    test("should always return a single forward slash", function () {
        asr.equal(normalize("/"), "/");
        asr.equal(normalize("/", true), "/");

        asr.equal(normalize("\\"), "/");
        asr.equal(normalize("\\", true), "/");
    });

    test("should normalize", function () {
        var units = [
            ["../../foo/bar", "../../foo/bar"],
            ["..\\..\\foo/bar", "../../foo/bar"],
            ["..\\\\..\\\\foo/bar", "../../foo/bar"],
            ["//foo/bar\\baz", "/foo/bar/baz"],
            ["//foo\\bar\\baz", "/foo/bar/baz"],
            ["/user/docs/Letter.txt", "/user/docs/Letter.txt"],
            ["\\?\\C:\\user\\docs\\Letter.txt", "/?/C:/user/docs/Letter.txt"],
            ["\\?\\UNC\\Server01\\user\\docs\\Letter.txt", "/?/UNC/Server01/user/docs/Letter.txt"],
            ["\\\\.\\CdRomX", "//./CdRomX"],
            ["\\\\.\\PhysicalDiskX", "//./PhysicalDiskX"],
            ["\\\\?\\C:\\user\\docs\\Letter.txt", "//?/C:/user/docs/Letter.txt"],
            ["\\\\?\\UNC\\Server01\\user\\docs\\Letter.txt", "//?/UNC/Server01/user/docs/Letter.txt"],
            ["\\Server01\\user\\docs\\Letter.txt", "/Server01/user/docs/Letter.txt"],
            ["C:\\user\\docs\\Letter.txt", "C:/user/docs/Letter.txt"],
            ["C:\\user\\docs\\somefile.ext:alternate_stream_name", "C:/user/docs/somefile.ext:alternate_stream_name"],
            ["C:Letter.txt", "C:Letter.txt"],
            ["E://foo//bar//baz", "E:/foo/bar/baz"],
            ["E://foo//bar//baz//", "E:/foo/bar/baz"],
            ["E://foo//bar//baz//////", "E:/foo/bar/baz"],
            ["E://foo/bar\\baz", "E:/foo/bar/baz"],
            ["E://foo\\bar\\baz", "E:/foo/bar/baz"],
            ["E:/foo/bar/baz/", "E:/foo/bar/baz"],
            ["E:/foo/bar/baz///", "E:/foo/bar/baz"],
            ["E:\\\\foo/bar\\baz", "E:/foo/bar/baz"],
            ["foo\\bar\\baz", "foo/bar/baz"],
            ["foo\\bar\\baz\\", "foo/bar/baz"],
            ["foo\\bar\\baz\\\\\\", "foo/bar/baz"],
        ];

        units.forEach(function (unit) {
            asr.equal(normalize(unit[0]), unit[1]);
        });
    });

    test("keep trailing slashes", function () {
        var units = [
            ["\\", "/"],
            ["foo\\bar\\baz\\", "foo/bar/baz/"],
            ["foo\\\\bar\\\\baz\\\\", "foo/bar/baz/"],
            ["foo//bar//baz//", "foo/bar/baz/"],
            ["foo/bar/baz/", "foo/bar/baz/"],
            ["./foo/bar/baz/", "./foo/bar/baz/"]
        ];

        units.forEach(function (unit) {
            asr.equal(normalize(unit[0], false), unit[1]);
        });
    });
});


suite("async-done promises", function () {
    var asyncDone = GlobWatcher.AsyncDone.asyncDone;

    function success() {
        return Promise.resolve(2);
    }

    function failure() {
        return Promise.reject(new Error("Promise Error"));
    }

    function rejectNoError() {
        return Promise.reject();
    }

    test("should handle a resolved promise", function (done) {
        asyncDone(success, function (err, result) {
            asr.equal(result, 2);
            done(err);
        });
    });

    test("should handle a rejected promise", function (done) {
        asyncDone(failure, function (err) {
            asr.instanceOf(err, Error);
            done();
        });
    });

    test("properly errors when rejected without an error", function (done) {
        asyncDone(rejectNoError, function (err) {
            asr.isNotNull(err);
            asr.instanceOf(err, Error);
            done();
        });
    });

    test("does not swallow thrown errors in callback", function (done) {
        var d = domain.create();
        d.once("error", function (err) {
            asr.isNotNull(err);
            asr.include(err.message, "Boom");
            done();
        });
        d.run(function () {
            asyncDone(success, function () {
                throw new Error("Boom");
            });
        });
    });
});


suite("async-done callbacks", function () {
    var asyncDone = GlobWatcher.AsyncDone.asyncDone;

    function success(cb: (err: any, res?: any) => any) {
        cb(null, 2);
    }

    function failure(cb: (err: any, res?: any) => any) {
        cb(new Error("Callback Error"));
    }

    function neverDone() {
        return 2;
    }

    test("should handle a successful callback", function (done) {
        asyncDone(success, function (err, result) {
            asr.equal(result, 2);
            done(err);
        });
    });

    test("should handle an errored callback", function (done) {
        asyncDone(failure, function (err) {
            asr.instanceOf(err, Error);
            done();
        });
    });

    test("a function that takes an argument but never calls callback", function (done) {
        asyncDone(neverDone, function () {
            done(new Error("Callback called"));
        });

        setTimeout(function () {
            done();
        }, 1000);
    });

    test("should not handle error if something throws inside the callback", function (done) {
        var d = require("domain").create();
        d.on("error", function (err: any) {
            asr.instanceOf(err, Error);
            done();
        });

        d.run(function () {
            asyncDone(success, function () {
                throw new Error("Thrown Error");
            });
        });
    });
});


suite("debounce", function () {
    var debounce = GlobWatcher.debounce;

    test("debounce", function (done) {
        var fn = debounce(function (this: any, a, b) {
            asr.deepEqual(this, { call: 3 }, "context should be preserved");
            asr.equal(a, 30, "should preserve args");
            asr.equal(b, 300, "should preserve args");
            done();
        }, 10);

        fn.call({ call: 1 }, 10, 100);
        fn.call({ call: 2 }, 20, 200);

        setTimeout(function () {
            fn.call({ call: 3 }, 30, 300);
        }, 3);
    });

    test("multiple calls should extend delay", function (done) {
        var wasDelayed = false;

        var fn = debounce(function (this: any, a, b) {
            asr.deepEqual(this, { call: 3 }, "context should be preserved");
            asr.equal(a, 30, "should preserve args");
            asr.equal(b, 300, "should preserve args");
            asr.isTrue(wasDelayed, "should have waited longer than debounce period");
            done();
        }, 6);

        setTimeout(function longer() {
            wasDelayed = true;
        }, 9);

        fn.call({ call: 1 }, 10, 100);

        setTimeout(function () {
            fn.call({ call: 2 }, 20, 200);

            setTimeout(function () {
                fn.call({ call: 3 }, 30, 300);
            }, 5);
        }, 3);
    });

    test("multiple calls should not extend delay when guarantee is true", function (done) {
        var calls = 0;
        var first = true;
        var wasDelayed = false;

        var fn = debounce(
            function (this: any, a, b) {
                if (first) {
                    asr.deepEqual(this, { call: 2 }, "1st context should be preserved");
                    asr.equal(a, 20, "1st should preserve args[0]");
                    asr.equal(b, 200, "1st should preserve 2nd args[1]");
                    asr.isFalse(wasDelayed, "should not have waited longer than debounce period");
                    first = false;
                }
                else {
                    asr.deepEqual(this, { call: 3 }, "context should be preserved");
                    asr.equal(a, 30, "should preserve args[0]");
                    asr.equal(b, 300, "should preserve args[1]");
                    asr.isTrue(wasDelayed, "should have waited longer than debounce period");
                }

                calls++;
                if (calls === 2) {
                    done();
                }
                else if(calls > 2) {
                    done(new Error("only expected 2 calls"));
                }
            },
            6,
            false,
            true
        );

        setTimeout(function longer() {
            wasDelayed = true;
        }, 7);

        fn.call({ call: 1 }, 10, 100);

        setTimeout(function () {
            fn.call({ call: 2 }, 20, 200);

            setTimeout(function () {
                fn.call({ call: 3 }, 30, 300);
            }, 5);
        }, 3);
    });

    test("at start", function (done) {
        var calls = 0;

        var fn = debounce(
            function (this: any, a, b) {
                if (calls === 0) {
                    asr.deepEqual(this, { call: 1 }, "1st context should be preserved");
                    asr.equal(a, 10, "1st should preserve 1st args");
                    asr.equal(b, 100, "1st should preserve 2nd args");
                }
                else if (calls === 1) {
                    asr.deepEqual(this, { call: 3 }, "context should be preserved");
                    asr.equal(a, 30, "should preserve args");
                    asr.equal(b, 300, "should preserve args");
                }
                else {
                    asr.deepEqual(this, { call: 4 }, "context should be preserved");
                    asr.equal(a, 40, "should preserve 1st args");
                    asr.equal(b, 400, "should preserve 2nd args");
                }

                calls += 1;
                if (calls === 3) {
                    done();
                }
                else if (calls > 3) {
                    done(new Error("only expected 3 calls"));
                }
            },
            6,
            true
        );

        fn.call({ call: 1 }, 10, 100);
        fn.call({ call: 2 }, 20, 200);

        setTimeout(function () {
            fn.call({ call: 3 }, 30, 300);

            setTimeout(function () {
                fn.call({ call: 4 }, 40, 400);
            }, 10);

            setTimeout(function () {
                fn.call({ call: 5 }, 50, 500);
            }, 3);
        }, 10);
    });
});
