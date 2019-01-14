"use strict";
var StringUtil;
(function (StringUtil) {
    /** Count '\n' characters in the given string
     */
    function countNewlines(src) {
        if (!src)
            return 0;
        var newlines = src.match(/\n/g);
        return (newlines != null ? newlines.length : 0);
    }
    StringUtil.countNewlines = countNewlines;
    /** Add optional prefix and suffix strings to an array of strings as well as optional first line prefix and last line prefix to the first and last line
     * @return the input 'lines', now modified
     */
    function formatLines(lines, prefix, suffix, firstLinePrefix, lastLineSuffix) {
        if (prefix === void 0) { prefix = ""; }
        if (suffix === void 0) { suffix = ""; }
        if (firstLinePrefix === void 0) { firstLinePrefix = ""; }
        if (lastLineSuffix === void 0) { lastLineSuffix = ""; }
        if (prefix.length > 0 || suffix.length > 0) {
            lines = lines.map(function (ln) { return (ln.length > 0 ? prefix + ln + suffix : ln); });
        }
        if (lines.length > 0) {
            lines[0] = firstLinePrefix + lines[0];
            lines[lines.length - 1] = lines[lines.length - 1] + lastLineSuffix;
        }
        return lines;
    }
    StringUtil.formatLines = formatLines;
    // TODO copy of ts-mortar/utils/Strings
    function removeLeading(str, leadingStr, removeRepeats) {
        if (removeRepeats === void 0) { removeRepeats = false; }
        var res = str;
        var leadingStrLen = leadingStr.length;
        if (res.indexOf(leadingStr) === 0) {
            res = res.substr(leadingStrLen);
        }
        if (removeRepeats) {
            while (res.indexOf(leadingStr) === 0) {
                res = res.substr(leadingStrLen);
            }
        }
        return res;
    }
    StringUtil.removeLeading = removeLeading;
    // TODO copy of ts-mortar/utils/Strings
    function removeTrailing(str, trailingStr, removeRepeats) {
        if (removeRepeats === void 0) { removeRepeats = false; }
        var res = str;
        var trailingStrLen = trailingStr.length;
        if (res.lastIndexOf(trailingStr) === res.length - trailingStrLen) {
            res = res.substr(0, res.length - trailingStrLen);
        }
        if (removeRepeats) {
            while (res.lastIndexOf(trailingStr) === res.length - trailingStrLen) {
                res = res.substr(0, res.length - trailingStrLen);
            }
        }
        return res;
    }
    StringUtil.removeTrailing = removeTrailing;
})(StringUtil || (StringUtil = {}));
module.exports = StringUtil;
