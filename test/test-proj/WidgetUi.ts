import DataSource = require("./DataSource");
import HelperUtil = require("./helpers/HelperUtil");

/** For widget UI stuff!
 */
module WidgetUi {

    export function createWidget(app: HelperUtil.PackageLike) {
        var widget = {
            name: app.name + "@" + app.version + " - " + app.description,
            app: app,
            render: () => console.log(widget.name),
        };
        return widget;
    }


    export function updateWidget(widget: ReturnType<typeof WidgetUi["createWidget"]>) {
        var deps = HelperUtil.notNull(widget.app.dependencies);
        for (var depName in deps) {
            var charCodes = <number[]>Array.prototype.map.call(depName, (ch) => ch.charCodeAt(0));
            var charCodesSquareSum = charCodes.reduce((sqrSum, ch) => { return sqrSum + (ch * ch); }, 0);
            var num = Math.sqrt(charCodesSquareSum);
            console.log(depName + ": " + charCodesSquareSum + " => " + num);
        }
    }

}

export = WidgetUi;