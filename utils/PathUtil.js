"use strict";
var path = require("path");
var process = require("process");
var StringUtil = require("./StringUtil");
/** File system path utilities (some overlap with Node 'path' module).
 * Also contains a static 'projectRoot' property which can be initialized once and some of the other methods in this module can subsequently be called with relative paths
 * @since 2016-06-17
 */
var PathUtil;
(function (PathUtil) {
    // used to store/cache the project's root directory
    var projectRoot;
    function setProjectRoot(projRoot) {
        projectRoot = projRoot.replace(/\\/g, '/');
    }
    PathUtil.setProjectRoot = setProjectRoot;
    function getProjectRoot() {
        return projectRoot;
    }
    PathUtil.getProjectRoot = getProjectRoot;
    function getSetOrDefaultProjectPath(projRoot, projRootNormalized) {
        projRoot = projRoot ? (projRootNormalized ? projRoot : projRoot.replace(/\\/g, '/')) : (projectRoot || (projectRoot = process.cwd().replace(/\\/g, '/')));
        return projRoot;
    }
    PathUtil.getSetOrDefaultProjectPath = getSetOrDefaultProjectPath;
    /** Relativize a path against a root directory, also convert backslashes to forward slashes.
     * Example: toShortFileName('a\b\c\log.txt', 'a/b')
     * returns: 'c/log.txt'
     * @param file the file name to relativize
     * @param [projRoot] the optional path used to relativize the 'file', default value is 'process.cwd()'
     */
    function toShortFileName(file, projRoot, projRootNormalized) {
        projRoot = getSetOrDefaultProjectPath(projRoot, projRootNormalized);
        var parts = file.replace(/\\/g, '/').split(projRoot);
        return parts.length > 1 ? StringUtil.removeLeading(parts[parts.length - 1], '/') : file;
    }
    PathUtil.toShortFileName = toShortFileName;
    /** Create a custom proxy for a RegExp's test() function which logs messages to gulp-util each time test() is called
     * @param regex the regular expression to modify
     * @param show an object containing a boolean property 'showRegexTests' which is dynamically checked each time the RegExp's test() function is called to determine whether or not to print a message
     */
    function createRegexInspector(regex, show, cb) {
        var origTest = regex.test;
        regex.test = function testInspector(str) {
            var res = origTest.call(regex, str);
            if (show.showRegexTests) {
                cb(str, res);
            }
            return res;
        };
        return regex;
    }
    PathUtil.createRegexInspector = createRegexInspector;
    function getFileNameWithoutExt(file) {
        return file.substr(0, file.length - path.extname(file).length);
    }
    PathUtil.getFileNameWithoutExt = getFileNameWithoutExt;
})(PathUtil || (PathUtil = {}));
module.exports = PathUtil;
