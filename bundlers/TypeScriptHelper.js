"use strict";
var child_process = require("child_process");
var log = require("fancy-log");
var Q = require("q");
var BrowserMultiPack = require("./browser/BrowserMultiPack");
/** Helpers for compiling TypeScript to Javascript
 */
var TypeScriptHelper;
(function (TypeScriptHelper) {
    /** copied from TypeScript package: typescript/lib/tsserver.js or https://github.com/Microsoft/tslib/blob/master/tslib.js
     * used by compiled TypeScript code that utilizes 'extends' in classes, async functions, and decorators
     */
    TypeScriptHelper.staticHelpers = {
        extendsHelper: "\nvar __extends = (this && this.__extends) || function (d, b) {\n  for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];\n  function __() { this.constructor = d; }\n  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());\n};",
        restHelper: "\nvar __rest = (this && this.__rest) || function (s, e) {\n  var t = {};\n  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)\n    t[p] = s[p];\n  if (s != null && typeof Object.getOwnPropertySymbols === \"function\")\n    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {\n      if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))\n        t[p[i]] = s[p[i]];\n    }\n  return t;\n};",
        decorateHelper: "\nvar __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {\n  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;\n  if (typeof Reflect === \"object\" && typeof Reflect.decorate === \"function\") r = Reflect.decorate(decorators, target, key, desc);\n  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;\n  return c > 3 && r && Object.defineProperty(target, key, r), r;\n};",
        metadataHelper: "\nvar __metadata = (this && this.__metadata) || function (k, v) {\n  if (typeof Reflect === \"object\" && typeof Reflect.metadata === \"function\") return Reflect.metadata(k, v);\n};",
        paramHelper: "\nvar __param = (this && this.__param) || function (paramIndex, decorator) {\n  return function (target, key) { decorator(target, key, paramIndex); }\n};",
        awaiterHelper: "\nvar __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {\n  return new (P || (P = Promise))(function (resolve, reject) {\n    function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }\n    function rejected(value) { try { step(generator[\"throw\"](value)); } catch (e) { reject(e); } }\n    function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }\n    step((generator = generator.apply(thisArg, _arguments || [])).next());\n  });\n};",
        readHelper: "\nvar __read = (this && this.__read) || function (o, n) {\n  var m = typeof Symbol === \"function\" && o[Symbol.iterator];\n  if (!m) return o;\n  var i = m.call(o), r, ar = [], e;\n  try {\n    while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);\n  }\n  catch (error) { e = { error: error }; }\n  finally {\n    try {\n      if (r && !r.done && (m = i[\"return\"])) m.call(i);\n    }\n    finally { if (e) throw e.error; }\n  }\n  return ar;\n};",
        spreadHelper: "\nvar __spread = (this && this.__spread) || function () {\n  for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));\n  return ar;\n};",
        spreadArraysHelper: "\nvar __spreadArrays = (this && this.__spreadArrays) || function () {\n  for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;\n  for (var r = Array(s), k = 0, i = 0; i < il; i++)\n    for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)\n      r[k] = a[j];\n  return r;\n};",
    };
    /** NOTE: typescript (i.e. 'tsc') must be installed and available via the command line.
     * Example: "tsc -t ES5 -m commonjs --preserveConstEnums --forceConsistentCasingInFileNames --noEmitHelpers " + projectRelativeSrcPath
     * @param tscCmd the typescript compiler command to execute
     */
    function compileTypeScriptFile(tscCmd) {
        var dfd = Q.defer();
        var child = child_process.exec(tscCmd, function (error, stdout, stderr) {
            if (stdout != null && stdout.length > 0) {
                log("TypeScript compile stdout: " + stdout);
            }
            if (stderr != null && stderr.length > 0) {
                log("TypeScript compile stderr: " + stderr);
            }
            if (error != null) {
                log("TypeScript compile error: " + error);
                dfd.reject(error);
            }
            else {
                dfd.resolve(null);
            }
        });
        return dfd.promise;
    }
    TypeScriptHelper.compileTypeScriptFile = compileTypeScriptFile;
    /** Get the 'prelude.js' source string used by browser-pack, insert the TypeScript static helpers (required for 'extends', annotations, and other TypeScript features) into it, and return it
     * @param includeUsageComment optional (default: true), whether to include a comment in the source string explaining why the TypeScript static helpers are inserted
     */
    function createPreludeStringWithTypeScriptHelpers(includeUsageComment) {
        var preludeSrc = BrowserMultiPack.getPreludeSrc();
        var comment = "/* TypeScript static helpers - inserted once, here.  Run TypeScript compiler with '--noEmitHelpers' option to prevent duplicate helpers being inserted into each bundled TypeScript file */";
        var typeScriptHelpers = (includeUsageComment != false ? comment : "") +
            Object.keys(TypeScriptHelper.staticHelpers).map(function (s) { return TypeScriptHelper.staticHelpers[s]; }).join("\n") + "\n\n";
        var customPrelude = typeScriptHelpers + preludeSrc;
        return {
            prelude: customPrelude,
            typeScriptHelpers: typeScriptHelpers,
            preludeSrc: preludeSrc,
        };
    }
    TypeScriptHelper.createPreludeStringWithTypeScriptHelpers = createPreludeStringWithTypeScriptHelpers;
    /** Can be passed to 'RequireParser.parse()' to skip typescript helpers at the beginning of a file when parsing imports
     */
    function skipTypeScriptHelpersWhenParsingRequire(src, i, state, text) {
        // allow TypeScript helpers at top of file (see TypeScriptHelper)
        if (state === 3 && text === "(this") {
            var nextLnIdx = src.indexOf('\n', i);
            // skip indented lines following the start of the TypeScript helper
            while (nextLnIdx > -1 && (src[nextLnIdx + 1] === ' ' || src[nextLnIdx + 1] === '\t')) {
                nextLnIdx = src.indexOf('\n', nextLnIdx + 1);
            }
            // loop ended, if more lines are available and closing brace of TypeScript helper found
            if (nextLnIdx > -1 && src[nextLnIdx + 1] === '}') {
                return src.indexOf('\n', nextLnIdx + 1); // skip the closing line and continue parsing at the next line start index
            }
        }
        return -1;
    }
    TypeScriptHelper.skipTypeScriptHelpersWhenParsingRequire = skipTypeScriptHelpersWhenParsingRequire;
})(TypeScriptHelper || (TypeScriptHelper = {}));
module.exports = TypeScriptHelper;
