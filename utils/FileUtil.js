"use strict";
var fs = require("fs");
var log = require("fancy-log");
/** Helpers for dealing with Node 'fs' file system manipulation
 * @since 2016-07-15
 */
var FileUtil;
(function (FileUtil) {
    // delete file: fs.unlinkSync(fileName)
    // rename file: fs.renameSync(oldName, newName);
    function existsFileOrDirSync(path) {
        return _existsFileOrDirSync(path, true, true);
    }
    FileUtil.existsFileOrDirSync = existsFileOrDirSync;
    function existsDirSync(path) {
        return _existsFileOrDirSync(path, false, true);
    }
    FileUtil.existsDirSync = existsDirSync;
    function existsFileSync(path) {
        return _existsFileOrDirSync(path, true, false);
    }
    FileUtil.existsFileSync = existsFileSync;
    function _existsFileOrDirSync(path, orFile, orDir) {
        try {
            var info = fs.statSync(path);
            return (orFile ? info.isFile() : false) || (orDir ? info.isDirectory() : false);
        }
        catch (err) {
            return err.code === "ENOENT" ? false : null;
        }
    }
    function swapFileNames(fileName1, fileName2) {
        var tmpExt = ".tmp_swap_" + Math.round(Math.random() * 1000);
        fs.renameSync(fileName1, fileName1 + tmpExt);
        fs.renameSync(fileName2, fileName1);
        fs.renameSync(fileName1 + tmpExt, fileName2);
    }
    FileUtil.swapFileNames = swapFileNames;
    /** Read the specified file from the file system and check whether it contains only ASCII characters.
     * Return data about lines and characters in the file which contain non-ASCII characters.
     * Also, optionally log messages gulp-util.
     * @param fileName the file to check
     * @param debug whether to print debugging messages
     */
    function checkFileAsciiEncoding(fileName, debug) {
        var f = fs.readFileSync(fileName);
        if (debug) {
            log("checking '" + fileName + "' file for ASCII encoding");
        }
        var lines = f.toString().split("\n");
        var badCharRanges = findBadCharRanges(lines);
        if (debug) {
            log(badCharRanges.length + " bad char segments:\n" +
                badCharRanges.map(function (r) { return "(" + r.lineNumber + ":[" + r.startIndex + "," + (r.startIndex + r.length) + "])" +
                    " '" + r.text + "' line: '" + (r.line.length > 200 ? r.line.substr(0, 200) + "..." : r.line) + "'\n"; }));
        }
        return badCharRanges;
    }
    FileUtil.checkFileAsciiEncoding = checkFileAsciiEncoding;
    /** Read the specified file from the file system and check whether it contains only ASCII characters.
     * Return data about lines and characters in the file which contain non-ASCII characters.
     * @param srcFile the file to read UTF-8 text from
     * @param dstFile the file to write ASCII text to
     * @param replace a string or function to use as replacement/replacer for consecutive sub-strings of non-ASCII characters
     */
    function convertFileEncodingToAscii(srcFile, dstFile, replace) {
        var f = fs.readFileSync(srcFile);
        log("converting '" + srcFile + "' file encoding to ASCII");
        var lines = f.toString().split("\n");
        var badCharRanges = findBadCharRanges(lines);
        var replacer = (typeof replace === "string" || typeof replace === "function") ? replace : "";
        var resLines = [];
        Array.prototype.push.apply(resLines, lines);
        for (var i = 0, size = badCharRanges.length; i < size; i++) {
            var badRng = badCharRanges[i];
            var ln = resLines[badRng.lineNumber - 1];
            var resLn = ln.replace(badRng.text, replacer);
            resLines[badRng.lineNumber - 1] = resLn;
        }
        fs.writeFileSync(dstFile, resLines.join("\n"), { encoding: "ascii" });
        return resLines;
    }
    FileUtil.convertFileEncodingToAscii = convertFileEncodingToAscii;
    /** Check a file for non-ASCII characters or convert a file by replacing non-ASCII characters
     * If a 'dstFile' path is specified, the special characters are dropped amd the resulting text is written to the 'dstFile' path.
     * If 'dstFile' path is '*in' the file is overwritten with the special characters dropped
     * parameters:
     * '--file ../... [--dstFile [../...]|[*in]]' - path of file to check
     */
    function checkOrConvertFileEncodingToAscii(file, dstFile, useSrcAsDstKey) {
        if (useSrcAsDstKey === void 0) { useSrcAsDstKey = "*in"; }
        var srcFile = (file || "").toString().trim();
        var dstFile = (dstFile || "").toString().trim();
        if (dstFile.length === 0) {
            FileUtil.checkFileAsciiEncoding(srcFile, true);
        }
        else {
            FileUtil.convertFileEncodingToAscii(srcFile, dstFile !== useSrcAsDstKey ? dstFile : srcFile, "");
        }
    }
    FileUtil.checkOrConvertFileEncodingToAscii = checkOrConvertFileEncodingToAscii;
    function findBadCharRanges(lines) {
        var badCharRanges = [];
        for (var i = 0, size = lines.length; i < size; i++) {
            var ln = lines[i];
            for (var k = 0, count = ln.length; k < count; k++) {
                // found invalid char
                if (ln.charCodeAt(k) > 127) {
                    var startIndex = k;
                    var length = 0;
                    while (k < count && ln.charCodeAt(k) > 127) {
                        k++;
                    }
                    var badCharRng = {
                        startIndex: startIndex,
                        length: k - startIndex,
                        lineNumber: i + 1,
                        line: ln,
                        text: ln.substr(startIndex, k - startIndex)
                    };
                    badCharRanges.push(badCharRng);
                }
            }
        }
        return badCharRanges;
    }
    function bestCloseSubstr(str, offset, maxLen) {
        if (maxLen < 4) {
            throw new Error("'maxLen' out of range, must be greater than 3, was " + maxLen);
        }
        var len = str.length;
        if (len < maxLen) {
            return str;
        }
        // character of interest at beginning of a long string
        else if (offset === 0) {
            return str.substr(0, maxLen) + "...";
        }
        // character of interest at end of a long string
        else if (offset >= len - 1) {
            var start = offset - maxLen;
            return (start > 0 ? "..." : "") + str.substr(Math.max(0, start));
        }
        // character of interest somewhere in the middle of a long string
        else {
            return "..." + str.substr(offset, maxLen) + (len > offset + maxLen ? "..." : "");
        }
    }
})(FileUtil || (FileUtil = {}));
module.exports = FileUtil;
