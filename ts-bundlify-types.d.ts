﻿/// <reference path="../definitions/babelify/babelify.d.ts" />
/// <reference path="../definitions/browserify/browserify.d.ts" />
/// <reference path="../definitions/browser-pack/browser-pack.d.ts" />
/// <reference path="../definitions/combine-source-map/combine-source-map.d.ts" />
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
/// <reference path="../definitions/through2/through2.d.ts" />
/// <reference path="../definitions/uglify-js/uglify-js.d.ts" />
/// <reference path="../definitions/umd/umd.d.ts" />
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


interface ModuleDepRow {
    deps: { [name: string]: string | number };
    file: string;
    id: string | number;
    index: string | number;
    indexDeps: { [name: string]: string | number };
    source: string;
    sourceFile: string;
    sourceRoot: string
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
    /** The directory where bundle files and map files are written */
    dstDir: string;
    /** the source code paths for the bundle */
    srcPaths: string[];
    /** the project root directory path */
    projectRoot: string;
}


interface BundleDst {
    /** the bundle output file path/name, relative to the CodePaths 'dstDir' */
    dstFileName: string;
    /** the bundle output map file, can be null, in which the following name is used: dstFileName + '.map' */
    dstMapFile?: string;
}


interface MultiBundleOptions {
    bundles: BundleDst[];
    /** the max value + 1 of the indices returned by destinationPicker */
    maxDestinations: number;
    /** given a 'module-deps' object, return the destination bundle index it should be written to */
    destinationPicker: (row: ModuleDepRow) => number;
}


interface StylePaths {
    dstDir: string;
    dstFileName: string;
    dstMapFile: string;
    srcPaths: string[];
    projectRoot: string;
}


interface BundleStream<T extends NodeJS.ReadableStream> extends BundleDst {
    /** the stream */
    stream: T;
}


type MultiBundleStreams = {
    baseStream: NodeJS.ReadableStream | Q.Promise<NodeJS.ReadableStream>;
    bundleStreams: BundleStream<NodeJS.ReadableStream>[] | Q.Promise<BundleStream<NodeJS.ReadableStream>[]>;
};
