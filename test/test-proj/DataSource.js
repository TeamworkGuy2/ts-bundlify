"use strict";
var DataSource;
(function (DataSource) {
    DataSource.collectionCache = {};
    function connect(name) {
        var coll = DataSource.collectionCache[name];
        if (coll == null) {
            coll = DataSource.collectionCache[name] = new Collection(name);
        }
        return coll;
    }
    DataSource.connect = connect;
    var Collection = /** @class */ (function () {
        function Collection(name) {
            this.name = name;
            this.data = [];
        }
        return Collection;
    }());
    DataSource.Collection = Collection;
})(DataSource || (DataSource = {}));
module.exports = DataSource;
