"use strict";
var acornNode = require("acorn-node");
var walk = require("acorn-walk");
function xtend() {
    var target = arguments[0];
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                target[key] = source[key];
            }
        }
    }
    return target;
}
var base = xtend(walk.base);
base.Import = function () { };
function simple(node, visitors, baseVisitor, state) {
    return walk.simple(node, visitors, baseVisitor || base, state);
}
function ancestor(node, visitors, baseVisitor, state) {
    return walk.ancestor(node, visitors, baseVisitor || base, state);
}
function recursive(node, state, funcs, baseVisitor) {
    return walk.recursive(node, state, funcs, baseVisitor || base);
}
function full(node, callback, baseVisitor, state) {
    return walk.full(node, callback, baseVisitor || base, state);
}
function fullAncestor(node, callback, baseVisitor, state) {
    return walk.fullAncestor(node, callback, baseVisitor || base, state);
}
function findNodeAt(node, start, end, test, baseVisitor, state) {
    return walk.findNodeAt(node, start, end, test, baseVisitor || base, state);
}
function findNodeAround(node, pos, test, baseVisitor, state) {
    return walk.findNodeAround(node, pos, test, baseVisitor || base, state);
}
function findNodeAfter(node, pos, test, baseVisitor, state) {
    return walk.findNodeAfter(node, pos, test, baseVisitor || base, state);
}
function findNodeBefore(node, pos, test, baseVisitor, state) {
    return walk.findNodeBefore(node, pos, test, baseVisitor || base, state);
}
function make(funcs, baseVisitor) {
    return walk.make(funcs, baseVisitor || base);
}
var acornWalk = {
    simple: simple,
    ancestor: ancestor,
    recursive: recursive,
    full: full,
    fullAncestor: fullAncestor,
    findNodeAt: findNodeAt,
    findNodeAround: findNodeAround,
    findNodeAfter: findNodeAfter,
    findNodeBefore: findNodeBefore,
    make: make,
    base: base,
};
// based on: detective@5.2.0
var requireRe = /\brequire\b/;
function defined() {
    for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] !== undefined)
            return arguments[i];
    }
}
function parse(src, opts) {
    if (!opts)
        opts = {};
    var acornOpts = {
        ranges: opts.ranges,
        locations: opts.locations,
        allowReserved: defined(opts.allowReserved, true),
        allowImportExportEverywhere: defined(opts.allowImportExportEverywhere, false)
    };
    // Use acorn-node's defaults for the rest.
    if (opts.ecmaVersion != null)
        acornOpts.ecmaVersion = opts.ecmaVersion;
    if (opts.sourceType != null)
        acornOpts.sourceType = opts.sourceType;
    if (opts.allowHashBang != null)
        acornOpts.allowHashBang = opts.allowHashBang;
    if (opts.allowReturnOutsideFunction != null)
        acornOpts.allowReturnOutsideFunction = opts.allowReturnOutsideFunction;
    return acornNode.parse(src, acornOpts);
}
function findStrings(src, opts) {
    return find(src, opts).strings;
}
function find(src, opts) {
    if (!opts)
        opts = {};
    var word = opts.word === undefined ? 'require' : opts.word;
    if (typeof src !== 'string')
        src = String(src);
    var isRequire = opts.isRequire || function (node /*acorn.Node*/) {
        return node.callee.type === "Identifier" && node.callee.name === word;
    };
    var modules = { strings: [], expressions: [] };
    if (opts.nodes)
        modules.nodes = [];
    var wordRe = word === "require" ? requireRe : RegExp('\\b' + word + '\\b');
    if (!wordRe.test(src))
        return modules;
    var ast = parse(src, opts.parse);
    function visit(node, st, c) {
        var hasRequire = wordRe.test(src.slice(node.start, node.end));
        if (!hasRequire)
            return;
        acornWalk.base[node.type](node, st, c);
        if (node.type !== "CallExpression")
            return;
        if (isRequire(node)) {
            if (node["arguments"].length) {
                var arg = node["arguments"][0];
                if (arg.type === "Literal") {
                    modules.strings.push(arg.value);
                }
                else if (arg.type === "TemplateLiteral"
                    && arg.quasis.length === 1
                    && arg.expressions.length === 0) {
                    modules.strings.push(arg.quasis[0].value.raw);
                }
                else {
                    modules.expressions.push(src.slice(arg.start, arg.end));
                }
            }
            if (opts.nodes)
                modules.nodes.push(node);
        }
    }
    acornWalk.recursive(ast, null, {
        Statement: visit,
        Expression: visit
    });
    return modules;
}
findStrings.find = find;
module.exports = findStrings;
