import process = require("process");
import minimist = require("minimist");

/** Helpers for common gulp.js related task
 * @since 2016-06-16
 */
module GulpUtil {
    var env = minimist(process.argv.slice(2));


    export function parseString(flagName: string, defaultValue = "") {
        var flagStr = (<string>env[flagName] || defaultValue).toString().trim();
        return flagStr;
    }


    export function parseFlag(flagName: string, defaultValue = "", strictTrue = false) {
        var flagStr = (<string>env[flagName] || defaultValue).toString().trim().toLowerCase();
        return strictTrue ? flagStr === "true" : flagStr !== "false";
    }

}

export = GulpUtil;