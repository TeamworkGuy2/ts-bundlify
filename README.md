ts-bundlify
==============

Are you trying to compile your JS (or TS, JSX, coffee, etc.) files into multiple bundle files with the ability to require() any file from one bundle in another bundle without asynchronous waits?

Been having trouble getting [browserify](https://www.npmjs.com/package/browserify) to output bundles exactly the way you want?

__ts-bundlify__ aims to solve two issues:
1. reduce the amount of code required to setup a simple browserify build process
2. easily generate multiple, highly customized, bundles from browserify

ts-bundlify includes several default bundle transformers, including uglify-js, babel, and traceur, but you can easily plug your own transform in via `BundleBuilder.transforms()`.
ts-bundlify uses Browserify under the hood along with gulp.js to do the actual bundling with a little magic (see [bundlers/browser/BrowserMultiPack.ts](bundlers/browser/BrowserMultiPack.ts)).

See each of the 'bundlers/' sub-directories as well as the [browser-bundle-examples](https://github.com/TeamworkGuy2/browser-bundle-examples) project for more examples.

Two examples, creating single and multiple bundle compilers that rebuild when source file changes are detected (using watchify and browserify) compiled using babel:

`gulpfile.js`
```ts
var babelify = require("babelify");
var BundleBuilder = require("ts-bundlify/bundlers/BundleBuilder");
var BabelBundler = require("ts-bundlify/bundlers/babel/BabelBundler");
```


```ts
// [...]

// create the bundle builder with some build options
BundleBuilder.buildOptions(browserify, watchify, {
  rebuild: true,
  debug: false,
  verbose: true,
  typescript: { includeHelpers: true }
}, BundleBuilder.compileBundle)
// add a babelify transform step, you can add multiple transforms which are passed on to browserify.transform()
.transforms((browserify) => [
  BabelBundler.createTransformer(babelify)
])
// start the build process with options about the source files to compile and the bundle destination file path
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
var BrowserMultiPack = require("ts-bundlify/bundlers/browser/BrowserMultiPack");

// create the bundle builder with some build options (same as before but save
// the browserify options via the buildBundle() `optsModifier` callback)
var browserifyOpts;
var bundleBldr = BundleBuilder.buildBundle(browserify, watchify, {
  rebuild: true,
  debug: false,
  verbose: true,
  typescript: { includeHelpers: true }
}, BundleBuilder.compileBundle, (opts) => browserifyOpts = opts);


// the magic, insert a custom 'browser-pack' implementation into browserify's pipeline
BrowserMultiPack.overrideBrowserifyPack(bundleBldr, BundleBuilder.getBrowserify(), () => ({
  bundles: [{
    // bundle 1 (destinationPicker() => 0)
    dstFileName: "app-compiled.js",
    prelude: browserifyOpts.prelude
  }, {
    // bundle 2 (destinationPicker() => 1)
    dstFileName: "app-modules.js",
    // example of customizing the generated bundle code, in this case to insert typescript
    // helper functions like __extends and __awaiter
    prelude: browserifyOpts.typescriptHelpers + "var require = " + browserifyOpts.prelude,
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
// start the build process with options about the source files to compile and the bundle destination file path
// (excluding the default bundle destination file name since this was already configured with BrowserMultiPack.overrideBrowserifyPack())
.compileBundle({
  entryFile: "./src/[...]/myApp.js",
  dstDir: "./build/",
  srcPaths: ["node_modules", "./src/[...]"],
  projectRoot: process.cwd()
}, null);
```