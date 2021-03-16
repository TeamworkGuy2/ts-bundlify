/// <reference types="browserify" />
/// <reference types="browser-pack" />
/// <reference types="node" />

/** Type of data row that comes out of browserify */
interface ModuleDepRow {
    deps: { [name: string]: string | number };
    file: string;
    id: string | number;
    index: string | number;
    indexDeps: { [name: string]: string | number };
    source: string;
    basedir?: string | undefined;
    entry?: boolean;
    expose?: boolean;
    order?: string | number;
    nomap?: boolean;
    sourceFile?: string;
    sourceRoot?: string;
}


interface BrowserPackOptions /*extends browserPack.Options*/ {
    /** Used if opts.preludePath is undefined, this is used to resolve the prelude.js file location, default: 'process.cwd()'
     */
    basedir?: string;
    /** A string to use in place of 'require' if opts.hasExports is specified, default is 'require'
     */
    externalRequireName?: string;
    /** Whether the bundle should include require= (or the opts.externalRequireName) so that
     * require() is available outside the bundle
     */
    hasExports?: boolean;
    /** Specify a custom prelude, but know what you're doing first. See the prelude.js file in
     * this repo for the default prelude. If you specify a custom prelude, you must also specify
     * a valid opts.preludePath to the prelude source file for sourcemaps to work
     */
    prelude?: string
    /** prelude.js path if a custom opts.prelude is specified */
    preludePath?: string;
    /** External string name to use for UMD, if not provided, UMD declaration is not wrapped around output */
    standalone?: string;
    /** Sets the internal module name to export for standalone */
    standaloneModule?: boolean;
    /** If given and source maps are computed, the opts.sourceMapPrefix string will be used instead of default: '//#' */
    sourceMapPrefix?: string;
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
    /** don't generate a map file */
    noMapFile?: boolean;
}


interface MultiBundleOptions {
    /** The array of bundle parameters, 'destinationPicker' must return values between [0, bundles.length - 1] */
    bundles: (BundleDst & BrowserPackOptions)[];
    /** given a file path (with forward slashes), return the destination bundle index it should be written to */
    destinationPicker: (row: string) => number;
}


interface StylePaths {
    dstDir: string;
    dstFileName: string;
    dstMapFile: string;
    srcPaths: string[];
    projectRoot: string;
}


interface BundleStream<T extends NodeJS.ReadableStream> extends BundleDst {
    /** the data/file stream */
    stream: T;
}


type MultiBundleStreams = {
    baseStream: NodeJS.ReadableStream | Promise<NodeJS.ReadableStream>;
    bundleStreams: BundleStream<NodeJS.ReadableStream>[] | Promise<BundleStream<NodeJS.ReadableStream>[]>;
};
