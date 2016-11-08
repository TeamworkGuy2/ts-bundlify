"use strict";
var gutil = require("gulp-util");
/** Helpers for common gulp.js related task
 * @since 2016-06-16
 */
var GulpUtil;
(function (GulpUtil) {
    function parseString(flagName, defaultValue) {
        if (defaultValue === void 0) { defaultValue = ""; }
        var flagStr = (gutil.env[flagName] || defaultValue).toString().trim();
        return flagStr;
    }
    GulpUtil.parseString = parseString;
    function parseFlag(flagName, defaultValue, strictTrue) {
        if (defaultValue === void 0) { defaultValue = ""; }
        if (strictTrue === void 0) { strictTrue = false; }
        var flagStr = (gutil.env[flagName] || defaultValue).toString().trim().toLowerCase();
        return strictTrue ? flagStr === "true" : flagStr !== "false";
    }
    GulpUtil.parseFlag = parseFlag;
})(GulpUtil || (GulpUtil = {}));
module.exports = GulpUtil;
