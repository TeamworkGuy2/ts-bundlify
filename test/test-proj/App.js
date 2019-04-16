"use strict";
var DataSource = require("./DataSource");
var HelperUtil = require("./helpers/HelperUtil");
var WidgetUi = require("./WidgetUi");
function main() {
    HelperUtil.App = {
        name: "test-proj",
        version: "0.1.0",
        description: "parser/bundler test project",
    };
    console.log(WidgetUi.createWidget());
    for (var collName in DataSource.collectionCache) {
        console.log(collName + ": " + DataSource.collectionCache[collName]);
    }
}
main();
module.exports = main;
