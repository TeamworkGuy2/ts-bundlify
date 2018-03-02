"use strict";
var process = require("process");
var minimist = require("minimist");
/** Helpers for common gulp.js related task
 * @since 2016-06-16
 */
var GulpUtil;
(function (GulpUtil) {
    var env = minimist(process.argv.slice(2));
    function parseString(flagName, defaultValue) {
        if (defaultValue === void 0) { defaultValue = ""; }
        var flagStr = (env[flagName] || defaultValue).toString().trim();
        return flagStr;
    }
    GulpUtil.parseString = parseString;
    function parseFlag(flagName, defaultValue, strictTrue) {
        if (defaultValue === void 0) { defaultValue = ""; }
        if (strictTrue === void 0) { strictTrue = false; }
        var flagStr = (env[flagName] || defaultValue).toString().trim().toLowerCase();
        return strictTrue ? flagStr === "true" : flagStr !== "false";
    }
    GulpUtil.parseFlag = parseFlag;
})(GulpUtil || (GulpUtil = {}));
module.exports = GulpUtil;
