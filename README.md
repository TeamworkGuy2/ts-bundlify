ts-bundlify
==============

Browser JS bundle builders built around Browserify designed for use with gulp.js. 
Includes bundler helpers for Browserify customization (multiple bundles), Babel, Traceur, and Node-Sass.

See each of the 'bundlers/' sub-directories as well as the [browser-bundle-examples](https://github.com/TeamworkGuy2/browser-bundle-examples) project.

Example of creating a bundle compiler that rebuilds when source file changes are detected (using watchify and browserify) compiled using babel:

`gulpfile.js`
```ts
var babelify = require("babelify");
var BundleBuilder = require("path-to-ts-bundlify/bundlers/BundleBuilder");
var BabelBundler = require("path-to-ts-bundlify/bundlers/babel/BabelBundler");

BundleBuilder.buildOptions({
  rebuild: true,
  debug: false,
  verbose: false,
  typescript: { includeHelpers: true }
})
.transforms((browserify) => [
  BabelBundler.createTransformer(babelify)
])
.compileBundle({
  entryFile: "./src/.../myApp.js",
  dstDir: "./build/",
  srcPaths: ["node_modules", "./src/.../"],
  projectRoot: process.cwd()
}, { dstFileName: "app-compiled.js" });
```