"use strict";
/** A basic parser for 'var identifier = require(...);' lines at the top of a javascript file.
 * This parser is not meant to be complete or accept all javascript syntax, just to be fast and handle TypeScript compiled *.js files.
 * Could be used as a replacement for 'detective' in 'module-deps'
 */
var RequireParser;
(function (RequireParser) {
    /** Parse the given source string for require() calls.
     * example: "var a = require('a'); var b = require ("./b"); ..."
     * returns: ["a", "./b"]
     * @param src the string to parse
     * @returns a list of the require("...") strings
     */
    function parse(src) {
        var requires = [];
        // 0 =
        // 1 = \n
        // 2 = \t \r\n
        // 3 = /
        // 4 = //
        // 5 = /*
        // 6 = /* ... *
        // 7 = "
        // 8 = " ... \
        // 9 = '
        // 10 = ' ... \
        // 11 = `
        // 12 = ` ... \
        var state = 0;
        // 0 =
        // 1 = var
        // 2 = var identifier
        // 3 = var identifier =
        // 4 = var identifier = require
        var token = 0;
        var ch = '\0';
        main_loop: for (var i = 0, len = src.length; i < len; i++) {
            switch (ch = src[i]) {
                case '\n':
                    state = 1;
                    break;
                case '/':
                    state = (state === 3 ? 4 : 3);
                    //console.log("start single line comment @ " + i);
                    // single line comment
                    if (state === 4) {
                        i++; // next char after '//'
                        while (i < len && src[i] !== '\n')
                            i++;
                        if (src[i] === '\n') {
                            state = 0;
                            i--;
                        } // reset for next loop increment
                        //console.log("finished single line comment @ " + i);
                    }
                    break;
                case '*':
                    //console.log("start multi line comment @ " + i);
                    // multi-line comment
                    if (state === 3) {
                        i++; // next char after '/*'
                        while (i < len) {
                            ch = src[i];
                            if (state === 6) {
                                // end of '*/'
                                if (ch === '/') {
                                    state = 0;
                                    break;
                                }
                                else
                                    state = 5;
                            }
                            if (ch === '*')
                                state = 6;
                            i++;
                        }
                        //console.log("finished multi-line comment @ " + i);
                    }
                    break;
                case '"':
                    state = 7;
                    // double quote string
                    i++; // next char after '"'
                    while (i < len) {
                        ch = src[i];
                        if (ch === '\\')
                            state = 8;
                        else if (state === 7 && ch === '"') {
                            state = 0;
                            break;
                        }
                        else
                            state = 7;
                        i++;
                    }
                    //console.log("finished double quote string @ " + i);
                    break;
                case '\'':
                    state = 9;
                    // single quote string
                    i++; // next char after '\''
                    while (i < len) {
                        ch = src[i];
                        if (ch === '\\')
                            state = 10;
                        else if (state === 9 && ch === '\'') {
                            state = 0;
                            break;
                        }
                        else
                            state = 9;
                        i++;
                    }
                    //console.log("finished single quote string @ " + i);
                    break;
                case '`':
                    state = 11;
                    // backtick quote string
                    i++; // next char after '`'
                    while (i < len) {
                        ch = src[i];
                        if (ch === '\\')
                            state = 12;
                        else if (state === 11 && ch === '`') {
                            state = 0;
                            break;
                        }
                        else
                            state = 11;
                        i++;
                    }
                    //console.log("finished backtick quote string @ " + i);
                    break;
                case ' ':
                case '\t':
                case '\r':
                case '\n':
                    state = 2;
                    break;
                default:
                    // 0 =
                    // 1 = var
                    // 2 = var identifier
                    // 3 = var identifier =
                    // 4 = var identifier = require(
                    var dst = { token: "", endedWithSemicolon: false };
                    i = nextToken(i, src, len, dst);
                    var t = dst.token;
                    //console.log("got token '" + t + "' @ " + i);
                    if (t === "var") {
                        token = 1;
                    }
                    else if (token === 1 && isIdentifier(t)) {
                        token = 2;
                    }
                    else if (token === 2 && t === "=") {
                        token = 3;
                    }
                    else if (token === 3 && t === "require") {
                        token = 4;
                    }
                    else if (token === 3 && t.startsWith("require(")) {
                        requires.push(trimQuotes(trimParens(t.substr("require".length))));
                        token = 0;
                    }
                    else if (token === 4) {
                        requires.push(trimQuotes(trimParens(t)));
                        token = 0;
                    }
                    else if (t === ';') {
                        token = 0;
                    }
                    else {
                        break main_loop;
                    }
                    break;
            }
        }
        return requires;
    }
    RequireParser.parse = parse;
    /** Starting at index 'i' in string 'src' up to length 'len', read until the next whitespace not inside a single or double quoted string.
     * Example: "value('1 2'); end();"
     * Returns: 13 AND dst.token = "value('1 2')" AND dst.endedWithSemicolon = true
     * @param i the offset into 'src' at which to start reading
     * @param src the source string
     * @param len the length of 'src'
     * @param dst store results in this object
     * @returns the new 'i' value at which parsing ended
     */
    function nextToken(i, src, len, dst) {
        var state = 0;
        var token = "";
        while (i < len) {
            var ch = src[i];
            if (ch === '"') {
                token += ch;
                // double quote string
                state = 7;
                i++; // next char after '"'
                while (i < len) {
                    ch = src[i];
                    if (ch === '\\')
                        state = 8;
                    else if (state === 7 && ch === '"') {
                        token += ch;
                        i++;
                        break;
                    }
                    else
                        state = 7;
                    token += ch;
                    i++;
                }
            }
            else if (ch === '\'') {
                token += ch;
                // single quote string
                state = 9;
                i++; // next char after '\''
                while (i < len) {
                    ch = src[i];
                    if (ch === '\\')
                        state = 10;
                    else if (state === 9 && ch === '\'') {
                        token += ch;
                        i++;
                        break;
                    }
                    else
                        state = 9;
                    token += ch;
                    i++;
                }
            }
            else if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
                break; // whitespace, end of token
            }
            else {
                i++;
                token += ch;
            }
        }
        dst.endedWithSemicolon = (token[token.length - 1] === ';' ? (token = token.substr(0, token.length - 1)) != null : false);
        dst.token = token;
        return i;
    }
    RequireParser.nextToken = nextToken;
    /** Is the given string a valid javascript identifier
     */
    function isIdentifier(token) {
        var len = token.length;
        if (len < 1)
            return false;
        var ch = token[0];
        if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$') {
            var i = 1;
            while (i < len) {
                if ((ch < '0' && ch !== '$') || (ch > '9' && ch < 'A') || (ch > 'Z' && ch < 'a' && ch !== '_') || ch > 'z') {
                    return false;
                }
                i++;
            }
            return true;
        }
        return false;
    }
    RequireParser.isIdentifier = isIdentifier;
    /** remove surrounding parenthesis '()' from a string
     */
    function trimParens(str) {
        var len = str.length;
        if (len < 2)
            return str;
        var h = (str[0] === '(' && str[len - 1] === ')');
        return (h ? str.substring(1, len - 1) : str);
    }
    RequireParser.trimParens = trimParens;
    /** remove surrounding 'single', "double", or `backtick` quotes from a string
     */
    function trimQuotes(str) {
        var len = str.length;
        if (len < 2)
            return str;
        var h = (str[0] === '\'' && str[len - 1] === '\'') ||
            (str[0] === '"' && str[len - 1] === '"') ||
            (str[0] === '`' && str[len - 1] === '`');
        return (h ? str.substring(1, len - 1) : str);
    }
    RequireParser.trimQuotes = trimQuotes;
})(RequireParser || (RequireParser = {}));
module.exports = RequireParser;
