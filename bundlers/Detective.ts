import acornNode = require("acorn-node");
import walk = require("acorn-walk");

// based on: acorn-node/walk@1.8.2
//function xtend<T1, T2>(t1: T1, t2: T2): { [P in (keyof T1 | keyof T2)]: (T2[P & keyof T2] extends void ? T1[P & keyof T1] : T2[P & keyof T2]) };
function xtend(...args: any[]): any;
function xtend() {
    var target = arguments[0];
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target;
}

var base: walk.RecursiveVisitors<any> = xtend((<any>walk).base);
base.Import = function () { }

function simple(node: acorn.Node, visitors: walk.SimpleVisitors<any>, baseVisitor?: walk.RecursiveVisitors<any>, state?: any): void {
    return walk.simple(node, visitors, baseVisitor || base, state);
}

function ancestor(node: acorn.Node, visitors: walk.AncestorVisitors<any>, baseVisitor?: walk.RecursiveVisitors<any>, state?: any): void {
    return walk.ancestor(node, visitors, baseVisitor || base, state);
}

function recursive(node: acorn.Node, state: any, funcs: walk.RecursiveVisitors<any>, baseVisitor?: walk.RecursiveVisitors<any>): void {
    return walk.recursive(node, state, funcs, baseVisitor || base);
}

function full(node: acorn.Node, callback: walk.FullWalkerCallback<any>, baseVisitor?: walk.RecursiveVisitors<any>, state?: any): void {
    return walk.full(node, callback, baseVisitor || base, state);
}

function fullAncestor(node: acorn.Node, callback: walk.FullAncestorWalkerCallback<any>, baseVisitor?: walk.RecursiveVisitors<any>, state?: any): void {
    return walk.fullAncestor(node, callback, baseVisitor || base, state);
}

function findNodeAt(node: acorn.Node, start: number | undefined, end?: number | undefined, test?: walk.FindPredicate | string, baseVisitor?: walk.RecursiveVisitors<any>, state?: any): walk.Found<any> | undefined {
    return walk.findNodeAt(node, start, end, test, baseVisitor || base, state);
}

function findNodeAround(node: acorn.Node, pos: number | undefined, test?: walk.FindPredicate | string, baseVisitor?: walk.RecursiveVisitors<any>, state?: any): walk.Found<any> | undefined {
    return walk.findNodeAround(node, pos, test, baseVisitor || base, state);
}

function findNodeAfter(node: acorn.Node, pos: number | undefined, test?: walk.FindPredicate | string, baseVisitor?: walk.RecursiveVisitors<any>, state?: any): walk.Found<any> | undefined {
    return walk.findNodeAfter(node, pos, test, baseVisitor || base, state);
}

function findNodeBefore(node: acorn.Node, pos: number | undefined, test?: walk.FindPredicate | string, baseVisitor?: walk.RecursiveVisitors<any>, state?: any): walk.Found<any> | undefined{
    return (<any>walk).findNodeBefore(node, pos, test, baseVisitor || base, state);
}

function make(funcs: walk.RecursiveVisitors<any>, baseVisitor?: walk.RecursiveVisitors<any>): walk.RecursiveVisitors<any> {
    return walk.make(funcs, baseVisitor || base)
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

function defined(...args: any[]): any;
function defined() {
    for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] !== undefined) return arguments[i];
    }
}

function parse(src: string, opts?: acorn.Options) {
    if (!opts) opts = {};
    var acornOpts: any = {
        ranges: opts.ranges,
        locations: opts.locations,
        allowReserved: defined(opts.allowReserved, true),
        allowImportExportEverywhere: defined(opts.allowImportExportEverywhere, false)
    };

    // Use acorn-node's defaults for the rest.
    if (opts.ecmaVersion != null) acornOpts.ecmaVersion = opts.ecmaVersion;
    if (opts.sourceType != null) acornOpts.sourceType = opts.sourceType;
    if (opts.allowHashBang != null) acornOpts.allowHashBang = opts.allowHashBang;
    if (opts.allowReturnOutsideFunction != null) acornOpts.allowReturnOutsideFunction = opts.allowReturnOutsideFunction;

    return acornNode.parse(src, acornOpts);
}

function findStrings(src: string, opts?: acorn.Options) {
    return find(src, opts).strings;
}

function find(src: string, opts?: acorn.Options & { word?: string; isRequire?: (node: any/*acorn.Node*/) => boolean; nodes?: boolean; parse?: acorn.Options }) {
    if (!opts) opts = {};

    var word = opts.word === undefined ? 'require' : opts.word;
    if (typeof src !== 'string') src = String(src);

    var isRequire = opts.isRequire || function (node: any/*acorn.Node*/) {
        return node.callee.type === "Identifier" && node.callee.name === word;
    };

    var modules: { strings: any[]; expressions: string[]; nodes: acorn.Node[] } = <any>{ strings: [], expressions: [] };
    if (opts.nodes) modules.nodes = [];

    var wordRe = word === "require" ? requireRe : RegExp('\\b' + word + '\\b');
    if (!wordRe.test(src)) return modules;

    var ast = parse(src, opts.parse);

    function visit(node: acorn.Node, st: any, c: walk.WalkerCallback<any>): void {
        var hasRequire = wordRe.test(src.slice(node.start, node.end));
        if (!hasRequire) return;
        acornWalk.base[node.type](node, st, c);
        if (node.type !== "CallExpression") return;
        if (isRequire(node)) {
            if ((<any>node)["arguments"].length) {
                var arg = (<any>node)["arguments"][0];
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
            if ((<Exclude<typeof opts, undefined>>opts).nodes) modules.nodes.push(node);
        }
    }

    acornWalk.recursive(ast, null, {
        Statement: visit,
        Expression: visit
    });

    return modules;
}

findStrings.find = find;

export = findStrings;