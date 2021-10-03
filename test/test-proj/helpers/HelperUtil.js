"use strict";
var HelperUtil;
(function (HelperUtil) {
    function notNull(obj) {
        var copy = {};
        for (var key in obj) {
            var value = obj[key];
            if (value != null) {
                copy[key] = value;
            }
        }
        return copy;
    }
    HelperUtil.notNull = notNull;
})(HelperUtil || (HelperUtil = {}));
module.exports = HelperUtil;
