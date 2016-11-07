
module StringUtil {


    /** Add optional prefix and suffix strings to an array of strings as well as optional first line prefix and last line prefix to the first and last line
     * @return the input 'lines', now modified
     */
    export function formatLines(lines: string[], prefix = "", suffix = "", firstLinePrefix = "", lastLineSuffix = ""): string[] {
        if (prefix.length > 0 || suffix.length > 0) {
            lines = lines.map((ln) => (ln.length > 0 ? prefix + ln + suffix : ln));
        }
        if (lines.length > 0) {
            lines[0] = firstLinePrefix + lines[0];
            lines[lines.length - 1] = lines[lines.length - 1] + lastLineSuffix;
        }
        return lines;
    }


    // TODO copy of ts-mortar/utils/Strings
    export function removeLeading(str: string, leadingStr: string, removeRepeats: boolean = false) {
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


    // TODO copy of ts-mortar/utils/Strings
    export function removeTrailing(str: string, trailingStr: string, removeRepeats: boolean = false) {
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

}

export = StringUtil;