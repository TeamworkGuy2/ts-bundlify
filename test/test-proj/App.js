"use strict";
var DataSource = require("./DataSource");
var HelperUtil = require("./HelperUtil");
function main() {
    console.log(HelperUtil.App.name + "@" + HelperUtil.App.version);
    for (var collName in DataSource.collectionCache) {
        console.log(collName + ": " + DataSource.collectionCache[collName]);
    }
}
main();
module.exports = main;
