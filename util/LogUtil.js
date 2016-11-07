"use strict";
var gutil = require("gulp-util");
var PathUtil = require("./PathUtil");
var LogUtil;
(function (LogUtil) {
    function log(taskDescription, promise) {
        return promise.then(function (res) {
            gutil.log("done " + taskDescription, res);
        }, function (err) {
            gutil.log("error " + taskDescription, err);
            throw err;
        });
    }
    LogUtil.log = log;
    /** Converts an object to a string using JSON.stringify, but reformats escaped newlines, quotes and forward slashes back to
     * unescaped form for pretty console printing and relativizes project paths if requested
     * @param obj the objec to stringify
     * @param [relativizeProjPaths] if specified, replace all path backslashes with forward slashes and relativize any paths against the 'projRoot' parameter
     * @param [projRoot] optional project root directory, defaults to process.cwd()
     */
    function objToString(obj, relativizeProjPaths, projRoot) {
        projRoot = PathUtil.getSetOrDefaultProjectPath(projRoot);
        var res = JSON.stringify(obj, undefined, "  ").split("\\n").join("\n").split("\\\"").join("\"").split("\\\\").join("\\");
        if (relativizeProjPaths) {
            res = res.replace(/\\/g, '/').split(projRoot).join("");
        }
        return res;
    }
    LogUtil.objToString = objToString;
    /** Best attempt to get a descriptive name from an object, first by checking the object's .constructor, then .prototype, then .name, various Object.prototype.toString.call() permutations,
     * and eventually Object.keys().
     * If the object is not an object, String() is used
     * @param obj
     */
    function objName(obj) {
        if (!obj) {
            return String(obj);
        }
        var toStr = Object.prototype.toString;
        if (typeof obj !== "object" && typeof obj !== "function") {
            return String(obj);
        }
        if (obj.constructor) {
            var res = (obj.constructor ? obj.constructor.name : toStr.call(obj.constructor));
            if (res !== "object") {
                return res;
            }
        }
        if (obj.prototype) {
            var res = (obj.prototype.constructor ? obj.prototype.constructor.name : (obj.prototype.name ? obj.prototype.name : toStr.call(obj.prototype)));
            if (res !== "object") {
                return res;
            }
        }
        return obj.name ? obj.name : (typeof obj === "object" ? ("keys:[" + Object.keys(obj).join(", ") + "]") : String(obj));
    }
    LogUtil.objName = objName;
})(LogUtil || (LogUtil = {}));
module.exports = LogUtil;
