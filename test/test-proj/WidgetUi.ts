import DataSource = require("./DataSource");
import HelperUtil = require("./helpers/HelperUtil");

module WidgetUi {

    export function createWidget() {
        var app = HelperUtil.App;
        return app.name + "@" + app.version + " - " + app.description;
    }

}

export = WidgetUi;