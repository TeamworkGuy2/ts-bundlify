ts-bundlify
==============

Are you trying to compile JS (or TS, JSX, etc.) files into multiple bundle files with the ability to require() any file from one bundle in another bundle without asynchronous waits?

Having trouble getting [browserify](https://www.npmjs.com/package/browserify) to output bundles exactly the way you want?

__ts-bundlify__ addresses three issues:
1. reduce the amount of code required to setup a browserify build process
2. easily generate multiple, customizable, bundles from browserify
3. reduce build dependencies by inlining build utilities/wrappers (see [source-maps/](source-maps/) and [streams/](streams/)) and using `^` dependency versions in `package.json` so that the user of this package has greater control over dependencies.
  - aside: the node.js ecosystem is awesome but can suffer from versioning issues caused by deep dependency trees with many maintainers; it's hard to get all packages updated to new versions. 10 and 20 LOC packages should be inlined, in my opinion/experience, and that's what this package does in several places.

Several default bundle transforms are included: `browserify`, `uglify-js` and `babel`. You can easily plug your own transform in via `BundleBuilder.buildBundle(...).transforms()`.

ts-bundlify can use this projects' own [TsBrowserify](bundlers/browser/TsBrowserify.ts) class or a custom browserify-like implementation along with gulp.js to do the actual bundling with a little magic (see [bundlers/browser/BrowserMultiPack.ts](bundlers/browser/BrowserMultiPack.ts)).

See each of the [bundlers/](bundlers/) sub-directories as well as the [test/](test/) folder for examples.

Example of single and multiple out file bundles that rebuild when source file changes are detected (using `watchify` and `browserify`) and compiled using `babel` via [BabelBundler](bundlers/babel/BabelBundler.ts):

Setup:
```ts
// gulpfile.js
var babelify = require("babelify");
var browserify = require("browserify");
var watchify = require("watchify");
var BundleBuilder = require("ts-bundlify/bundlers/BundleBuilder");
var BabelBundler = require("ts-bundlify/bundlers/babel/BabelBundler");
```

--------
Build a single bundle with `browserify` and rebuild with `watchify`:

```ts
// gulpfile.js
// [...]

// define the bundle file paths and options
var bundlePaths: CodePaths = {
    entryFile: "./src/[...]/myApp.js",
    dstDir: "./build/",
    srcPaths: ["node_modules", "./src/[...]"],
    projectRoot: process.cwd()
};

var bundleOpts = BundleBuilder.createOptions<TsBrowserify.Options>({
    rebuild: true,
    debug: false,
    verbose: true,
    typescript: { includeHelpers: true },
    browserPack: browserPack,
    depsSort: depsSort,
    moduleDeps: moduleDeps,
}, bundlePaths, watchify);

// create the bundler implementation
var bundler = new browserify(bundleOpts);

// add a babelify transform step, you can add multiple transforms which are passed to browserify.transform()
var transforms = [
    BabelBundler.createTransformer(babelify)
];

// run the build with options about the source files to compile and the bundle destination file path
BundleBuilder.compileBundle(bundler, bundleOpts, bundlePaths.dstDir, (br) => BundleBuilder.createDefaultBundler(br, { dstFileName: "app-compiled.js" }), transforms, {
    error: (srcName, dstFileName, err) => { ... },
    finishAll: (res) => { ... },
    finishBundle: (fileName) => { ... },
    skipBundle: (fileName) => { ... },
    startBundle: (fileName) => { ... }
});
```

--------
Here's an example that produces two bundles.

Bundle 1 contains code from all `./src/[...]` files.

Bundle 2 contains all the required `node_modules` files.

```ts
// gulpfile.js
// [...]

// create the bundle file paths and options
var bundlePaths: CodePaths = {
    entryFile: "./src/[...]/myApp.js",
    dstDir: "./build/",
    srcPaths: ["node_modules", "./src/[...]"],
    projectRoot: process.cwd()
};

var bundleOpts = BundleBuilder.createOptions<TsBrowserify.Options>({
    rebuild: true,
    debug: false,
    verbose: true,
    typescript: { includeHelpers: true },
    browserPack: browserPack,
    depsSort: depsSort,
    moduleDeps: moduleDeps,
}, bundlePaths, watchify);

// create the bundler implementation
var bundler = new browserify(bundleOpts);

// the magic, insert a custom 'browser-pack' implementation into browserify's pipeline
var packer = BrowserMultiPack.overrideBrowserifyPack(bundler, () => ({
    bundles: [{
        // bundle 1 (destinationPicker() => 0)
        dstFileName: "app-compiled.js",
        prelude: bundleOpts.prelude
    }, {
        // bundle 2 (destinationPicker() => 1)
        dstFileName: "app-modules.js",
        // example of customizing the generated bundle code, in this case to insert typescript
        // helper functions like '__extends' and '__awaiter'
        prelude: bundleOpts.typescriptHelpers + "var require = " + bundleOpts.prelude,
        preludePath: "./_prelude-with-typescript-helpers.js"
    }],
    destinationPicker: (path) => {
        // this is where we pick each file's destination bundle based on file path
        return path.indexOf("node_modules") > -1 ? 1 /* app-modules.js */ : 0 /* app-compiled.js */;
    }
}));

// add a babelify transform step, you can add multiple transforms which are passed to browserify.transform()
var transforms = [
    BabelBundler.createTransformer(babelify)
];

// start the build process with options about the source files to compile
// the 'dstFileName' was configured by the previous call to BrowserMultiPack.overrideBrowserifyPack()
BundleBuilder.compileBundle(bundler, bundleOpts, bundlePaths.dstDir, packer.multiBundleSourceCreator, transforms, {
    error: (srcName, dstFileName, err) => { ... },
    finishAll: (res) => { ... },
    finishBundle: (fileName) => { ... },
    skipBundle: (fileName) => { ... },
    startBundle: (fileName) => { ... }
});
```