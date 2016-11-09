/// <reference path="../definitions/babelify/babelify.d.ts" />
/// <reference path="../definitions/browserify/browserify.d.ts" />
/// <reference path="../definitions/browser-pack/browser-pack.d.ts" />
/// <reference path="../definitions/convert-source-map/convert-source-map.d.ts" />
/// <reference path="../definitions/exorcist/exorcist.d.ts" />
/// <reference path="../definitions/gulp/gulp.d.ts" />
/// <reference path="../definitions/gulp-concat/gulp-concat.d.ts" />
/// <reference path="../definitions/gulp-rename/gulp-rename.d.ts" />
/// <reference path="../definitions/gulp-util/gulp-util.d.ts" />
/// <reference path="../definitions/minimatch/minimatch.d.ts" />
/// <reference path="../definitions/node/node.d.ts" />
/// <reference path="../definitions/node-sass/node-sass.d.ts" />
/// <reference path="../definitions/q/Q.d.ts" />
/// <reference path="../definitions/through/through.d.ts" />
/// <reference path="../definitions/uglify-js/uglify-js.d.ts" />
/// <reference path="../definitions/vinyl-source-stream/vinyl-source-stream.d.ts" />
/// <reference path="../definitions/watchify/watchify.d.ts" />


declare module "traceur" {

    export class NodeCompiler implements TraceurCompiler {
        constructor(opts?: any);

        compile(contents: string, file: string, opts: any): any;
    }

}

interface TraceurCompiler {
    compile(contents: string, file: string, opts: any): any;
}


/** Options used to build bundles
 */
interface BundleOptions {
    /** Whether the bundler should watch the bundle's source files for changes and rebuild/recompile when changes are detected.  If false, bundling/compiling should be run once and then the script will exit */
    rebuild: boolean;
    /** Whether to run additional debugging logic to catch errors ealier and print additional debugging messages */
    debug: boolean;
    /** Whether to print verbose bundle compilation information */
    verbose: boolean;
    /** Whether to include TypeScript static helper code in the compiled bundle */
    typescript?: {
        includeHelpers?: boolean;
        includeHelpersComment?: boolean;
    }
}


/** Paths used to build bundles
 */
interface CodePaths {
    /** The entry file (C equivalent of file containing main(), jquery equivalent of file containing $.ready() */
    entryFile: string;
    /** The directory where 'dst*' files are written */
    dstDir: string;
    /** the bundle output file path/name, relative to 'dstDir' */
    dstFileName: string;
    /** the bundle output map file, can be null, in which the following name is used: dstFileName + '.map' */
    dstMapFile: string;
    /** the source code paths for the bundle */
    srcPaths: string[];
    /** the project root directory path */
    projectRoot: string;
}


interface StylePaths {
    dstDir: string;
    dstFileName: string;
    dstMapFile: string;
    srcPaths: string[];
    projectRoot: string;
}
