import DataSource = require("./DataSource");
import HelperUtil = require("./helpers/HelperUtil");
import WidgetUi = require("./WidgetUi");

function main() {
    HelperUtil.App = {
        name: "test-proj",
        version: "0.1.0",
        description: "parser/bundler test project",
        dependencies: { "base": "none" },
    };
    HelperUtil.Ui = WidgetUi;

    var widget = WidgetUi.createWidget(HelperUtil.App);
    console.log(widget);

    for (var collName in DataSource.collectionCache) {
        console.log(collName + ": " + DataSource.collectionCache[collName]);
    }

    WidgetUi.updateWidget(widget);
    console.log("done");
}

main();

export = main;