
/** A basic parser for 'var identifier = require(...);' lines at the top of a javascript file.
 * This parser is not meant to be complete or accept all javascript syntax, just to be fast and handle TypeScript compiled *.js files.
 * Could be used as a replacement for 'detective' in 'module-deps'
 */
module RequireParser {

    /** Parse the given source string for require() calls.
     * example: "var a = require('a'); var b = require ("./b"); ..."
     * returns: ["a", "./b"]
     * @param src the string to parse
     * @returns a list of the require("...") strings
     */
    export function parse(src: string) {
        var requires: string[] = [];

        // 0 =
        // 1 = ;
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

        main_loop:
        for (var i = 0, len = src.length; i < len; i++) {
            switch (ch = src[i]) {
                case ';': state = 1;
                    break;
                case ' ':
                case '\t':
                case '\r':
                case '\n':
                    state = 2;
                    break;
                case '/': state = (state === 3 ? 4 : 3);
                    // single line comment
                    if (state === 4) {
                        //console.log("start single line comment @ " + i);
                        i++; // next char after '//'
                        while (i < len && src[i] !== '\n') i++;
                        if (src[i] === '\n') { state = 0; i--; } // reset for next loop increment
                        //console.log("finished single line comment @ " + i);
                    }
                    break;
                case '*':
                    // multi-line comment
                    if (state === 3) {
                        //console.log("start multi line comment @ " + i);
                        i++; // next char after '/*'
                        while (i < len) {
                            ch = src[i];
                            if (state === 6) {
                                // end of '*/'
                                if (ch === '/') { state = 0; break; }
                                else state = 5;
                            }
                            if (ch === '*') state = 6;
                            i++;
                        }
                        //console.log("finished multi-line comment @ " + i);
                    }
                    break;
                case '"': state = 7;
                    // double quote string
                    i++; // next char after '"'
                    while (i < len) {
                        ch = src[i];
                        if (ch === '\\') state = 8;
                        else if (state === 7 && ch === '"') { state = 0; break; }
                        else state = 7;
                        i++;
                    }
                    //console.log("finished double quote string @ " + i);
                    break;
                case '\'': state = 9;
                    // single quote string
                    i++; // next char after '\''
                    while (i < len) {
                        ch = src[i];
                        if (ch === '\\') state = 10;
                        else if (state === 9 && ch === '\'') { state = 0; break; }
                        else state = 9;
                        i++;
                    }
                    //console.log("finished single quote string @ " + i);
                    break;
                case '`': state = 11;
                    // backtick quote string
                    i++; // next char after '`'
                    while (i < len) {
                        ch = src[i];
                        if (ch === '\\') state = 12;
                        else if (state === 11 && ch === '`') { state = 0; break; }
                        else state = 11;
                        i++;
                    }
                    //console.log("finished backtick quote string @ " + i);
                    break;
                default:
                    var nextIdx = nextToken(i, src, len);
                    var text = src.substring(i, nextIdx);
                    i = nextIdx;

                    //console.log("got token '" + text + "' @ " + i);

                    if (text === "var") {
                        token = 1;
                    }
                    else if (token === 1 && isIdentifier(text)) {
                        token = 2;
                    }
                    else if (token === 2 && text === "=") {
                        token = 3;
                    }
                    else if (token === 3 && text === "require") {
                        token = 4;
                    }
                    else if (token === 3 && text.startsWith("require(")) {
                        requires.push(trimSemicolonParensAndQuotes(text, "require".length, text.length));
                        token = 0;
                    }
                    else if (token === 4 && text.startsWith("(")) {
                        requires.push(trimSemicolonParensAndQuotes(text, 0, text.length));
                        token = 0;
                    }
                    else if (text === ";") {
                        token = 0;
                    }
                    else {
                        // does NOT match sequence: var identifier = require
                        break main_loop;
                    }
                    break;
            }
        }

        return requires;
    }


    /** Starting at index 'i' in string 'src' up to length 'len', read until the next whitespace not inside a single or double quoted string.
     * Example: "value('1 2'); end();"
     * Returns: 13 (i.e. "value('1 2');")
     * @param i the offset into 'src' at which to start reading
     * @param src the source string
     * @param len the length of 'src'
     * @param dst store results in this object
     * @returns the new 'i' index at which parsing ended
     */
    export function nextToken(i: number, src: string, len: number): number {
        var state = 0;
        while (i < len) {
            var ch = src[i];
            if (ch === '"') {
                // double quote string
                state = 7;
                i++; // next char after '"'
                while (i < len) {
                    ch = src[i];
                    if (ch === '\\') state = 8;
                    else if (state === 7 && ch === '"') { state = 0; i++; break; }
                    else state = 7;
                    i++;
                }
            }
            else if (ch === '\'') {
                // single quote string
                state = 9;
                i++; // next char after '\''
                while (i < len) {
                    ch = src[i];
                    if (ch === '\\') state = 10;
                    else if (state === 9 && ch === '\'') { state = 0; i++; break; }
                    else state = 9;
                    i++;
                }
            }
            else if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
                break; // whitespace, end of token
            }
            else {
                i++;
            }
        }
        return i;
    }


    /** Is the given string a valid javascript identifier
     */
    export function isIdentifier(token: string) {
        var len = token.length;
        if (len < 1) return false;

        var ch = token[0]; // tested with charCodeAt() and no notable performance difference
        if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$') {
            var i = 1;
            while (i < len) {
                ch = token[i];
                if ((ch < '0' && ch !== '$') || (ch > '9' && ch < 'A') || (ch > 'Z' && ch < 'a' && ch !== '_') || ch > 'z') {
                    return false;
                }
                i++;
            }
            return true;
        }
        return false;
    }


    /** check if a string starts adn ends with parenthesis '()'. start = inclusive, end = exclusive
     */
    export function hasParens(str: string, start: number, end: number) {
        return end - start > 1 && (str[start] === '(' && str[end - 1] === ')');
    }


    /** check if a string starts and ends with 'single' or "double" quotes. start = inclusive, end = exclusive
     */
    export function hasQuotes(str: string, start: number, end: number) {
        return end - start > 1 && ((str[start] === '\'' && str[end - 1] === '\'') || (str[start] === '"' && str[end - 1] === '"'));
    }


    /** This messy function saves ~8% parsing performance by reducing 'require("...");' string extraction down to one operation
     */
    export function trimSemicolonParensAndQuotes(str: string, start: number, end: number) {
        var len = str.length;
        var semicolon = str[len - 1] === ';' ? 1 : 0;
        var trimCnt = hasParens(str, start, len - semicolon) ? 1 : 0;
        trimCnt += hasQuotes(str, start + trimCnt, len - trimCnt - semicolon) ? 1 : 0;
        return (trimCnt > 0 || semicolon > 0 ? str.substring(start + trimCnt, len - trimCnt - semicolon) : str);
    }

}

export = RequireParser;