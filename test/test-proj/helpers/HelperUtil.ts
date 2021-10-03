import fs = require("fs");
import WidgetUi = require("../WidgetUi");

module HelperUtil {

    export interface PackageLike {
        name: string;
        version: string;
        description?: string;
        dependencies?: { [prop: string]: string };
        devDependencies?: { [prop: string]: string };
        [prop: string]: any
    }


    export var App: PackageLike;
    export var Ui: typeof WidgetUi;

    export function notNull(obj: any) {
        var copy = <any>{};
        for (var key in obj) {
            var value = obj[key];
            if (value != null) {
                copy[key] = value;
            }
        }

        return copy;
    }
}

export = HelperUtil;