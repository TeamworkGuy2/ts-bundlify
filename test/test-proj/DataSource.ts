import HelperUtil = require("./HelperUtil");

module DataSource {
    export var collectionCache: { [name: string]: Collection<any> } = {};


    export function connect(name: string) {
        var coll = collectionCache[name];
        if (coll == null) {
            coll = collectionCache[name] = new Collection(name);
        }
        return coll;
    }


    export class Collection<T> {
        public readonly name: string;
        private data: T[];

        public constructor(name: string) {
            this.name = name;
            this.data = [];
        }
    }

}

export = DataSource;