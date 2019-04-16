import fs = require("fs");
import WidgetUi = require("../WidgetUi");

module HelperUtil {

    interface PackageLike {
        name: string;
        version: string;
        description?: string;
        dependencies?: { [prop: string]: string };
        devDependencies?: { [prop: string]: string };
        [prop: string]: any
    }


    export var App: PackageLike;
    export var Ui: typeof WidgetUi = WidgetUi;

}

export = HelperUtil;