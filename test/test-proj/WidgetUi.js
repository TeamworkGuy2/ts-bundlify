"use strict";
var HelperUtil = require("./helpers/HelperUtil");
/** For widget UI stuff!
 */
var WidgetUi;
(function (WidgetUi) {
    function createWidget(app) {
        var widget = {
            name: app.name + "@" + app.version + " - " + app.description,
            app: app,
            render: function () { return console.log(widget.name); },
        };
        return widget;
    }
    WidgetUi.createWidget = createWidget;
    function updateWidget(widget) {
        var deps = HelperUtil.notNull(widget.app.dependencies);
        for (var depName in deps) {
            var charCodes = Array.prototype.map.call(depName, function (ch) { return ch.charCodeAt(0); });
            var charCodesSquareSum = charCodes.reduce(function (sqrSum, ch) { return sqrSum + (ch * ch); }, 0);
            var num = Math.sqrt(charCodesSquareSum);
            console.log(depName + ": " + charCodesSquareSum + " => " + num);
        }
    }
    WidgetUi.updateWidget = updateWidget;
})(WidgetUi || (WidgetUi = {}));
module.exports = WidgetUi;
