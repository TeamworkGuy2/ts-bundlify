ts-bundlify
==============

You want to compile all your JS (or TS, JSX, coffee, etc.) files into multiple bundles?

Been having trouble getting [browserify](https://www.npmjs.com/package/browserify) to output bundles exactly the way you want?

__ts-bundlify__ aims to solve two issues:
1. reduce the amount of code required to setup a simple browserify build process
2. easily generate multiple, highly customized, bundles from browserify

ts-bundlify includes several default bundle transformers, including uglify-js, babel, and traceur, but you can easily plug your own transform in via `BundleBuilder.transforms()`.
ts-bundlify uses Browserify under the hood along with gulp.js to do the actual bundling with a little magic (see [bundlers/browser/BrowserMultiPack.ts](bundlers/browser/BrowserMultiPack.ts)).

See each of the 'bundlers/' sub-directories as well as the [browser-bundle-examples](https://github.com/TeamworkGuy2/browser-bundle-examples) project for more examples.

Two examples, creatingsingle and multiple bundle compilers that rebuild when source file changes are detected (using watchify and browserify) compiled using babel:

`gulpfile.js`
```ts
var babelify = require("babelify");
var BundleBuilder = require("path-to-ts-bundlify/bundlers/BundleBuilder");
var BabelBundler = require("path-to-ts-bundlify/bundlers/babel/BabelBundler");
```

```ts
// [...]

// create the bundle builder with some build options
BundleBuilder.buildOptions({
  rebuild: true,
  debug: false,
  verbose: true,
  typescript: { includeHelpers: true }
})
// add a babelify transform step, you can add multiple transforms which are passed on to browserify.transform()
.transforms((browserify) => [
  BabelBundler.createTransformer(babelify)
])
// kick off the build process with information about the source files to compile and the bundle destination file path
.compileBundle({
  entryFile: "./src/[...]/myApp.js",
  dstDir: "./build/",
  srcPaths: ["node_modules", "./src/[...]"],
  projectRoot: process.cwd()
}, {
  dstFileName: "app-compiled.js"
});
```

--------
Here's an example that produces two bundles.
Bundle 1 contains code from all `./src/[...]` files.
Bundle 2 contains all the `node_modules` files.

```ts
var browserifyOpts;

// create the bundle builder with some build options (same as before but save the browserify options via the options inspector callback)
var bundleBldr = BundleBuilder.buildOptions({
  rebuild: true,
  debug: false,
  verbose: true,
  typescript: { includeHelpers: true }
}, (opts) => browserifyOpts = opts);


// 'the magic', insert a custom 'browser-pack' implementation into browserify's pipeline
BrowserMultiPack.overrideBrowserifyPack(bundleBldr, BundleBuilder.getBrowserify(), () => ({
  bundles: [{ // bundle 1 (destinationPicker() => 0)
    dstFileName: "app-compiled.js",
    prelude: browserifyOpts.prelude
  }, { // bundle 2 (destinationPicker() => 1)
    dstFileName: "app-modules.js",
    prelude: browserifyOpts.typescriptHelpers + "var require = " + browserifyOpts.prelude, // example of customizing the generated bundle code, in this case to insert typescript helper functions like __extends and __awaiter
    preludePath: "./_prelude-with-typescript-helpers.js"
  }],
  maxDestinations: 2,
  destinationPicker: (path) => {
    // this is where the magic happens, pick each file's destination bundle based on file path
    return path.indexOf("node_modules") > -1 ? 1 /* app-modules.js */ : 0 /* app-compiled.js */;
  }
}));


// add a babelify transform step, you can add multiple transforms which are passed on to browserify.transform() (same as before)
bundleBldr.transforms((browserify) => [
  BabelBundler.createTransformer(babelify)
])
// kick off the build process with information about the source files to compile and the bundle destination file path
// (excluding the default bundle destination file name since this was already configured with BrowserMultiPack.overrideBrowserifyPack())
.compileBundle({
  entryFile: "./src/[...]/myApp.js",
  dstDir: "./build/",
  srcPaths: ["node_modules", "./src/[...]"],
  projectRoot: process.cwd()
}, null);
```