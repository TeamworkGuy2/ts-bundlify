"use strict";
var HelperUtil = require("./helpers/HelperUtil");
var WidgetUi;
(function (WidgetUi) {
    function createWidget() {
        var app = HelperUtil.App;
        return app.name + "@" + app.version + " - " + app.description;
    }
    WidgetUi.createWidget = createWidget;
})(WidgetUi || (WidgetUi = {}));
module.exports = WidgetUi;
