# Change Log
All notable changes to this project will be documented in this file.
This project does its best to adhere to [Semantic Versioning](http://semver.org/).


--------
### [0.6.5](N/A) - 2018-03-02
#### Changed
* Update to TypeScript 2.7
* Update dependencies: mocha, @types/chai, @types/mocha, @types/node
* Enable tsconfig.json `noImplicitAny`


--------
### [0.6.4](https://github.com/TeamworkGuy2/ts-bundlify/commit/9514b79bee0b8907a8be4987db6e115c0aaa49de) - 2017-11-19
#### Changed
* `tsconfig.json` added `strictNullChecks` and setup code to handle null types
* Updated some `package.json` dependencies


--------
### [0.6.3](https://github.com/TeamworkGuy2/ts-bundlify/commit/77b5624f2afeafd2149dc43f399adccd704b125c) - 2017-09-10
#### Changed
* `tsconfig.json` added `noImplicitThis: true`


--------
### [0.6.2](https://github.com/TeamworkGuy2/ts-bundlify/commit/896270d305a1d24c779a30e1a4289bf22d0a9dfa) - 2017-08-09
#### Changed
* Added browserify pipeline 'error' event listener to BrowserifyHelper.setupRebundleListener() so errors don't get lost


--------
### [0.6.1](https://github.com/TeamworkGuy2/ts-bundlify/commit/196b8a3cf05c9ab3db4a053fed182bde054b18fc) - 2017-08-06
#### Changed
* Update to TypeScript 2.4
* README.md improved


--------
### [0.6.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/1bf781d76b78bcd618b5f1e693f5100824e9b6c9) - 2017-05-12
#### Changed
* `BrowserifyHelper.setupRebundleListener()`
  * no longer returns a promise
  * instead it now takes an additional parameter, an object containing optional event callback functions for the following events: `startBundle`, `finishBundle`, `finishAll`, `skipBundle`, and `error`.
  * additional 'verbose' parameter and default gulp-util log() messages changed and are only printed when 'verbose' == true
* Updated BundleBuilder interfaces to handle new `BrowserifyHelper.setupRebundleListener()` parameters
* Added `setBundleListeners()` step/function to the `Builder` interface
* `BabelBundler`, `TraceurBundler`, and `UglifyBundler` `createTransformer()` methods now accept an optional `verbose` flag which controls whether file compilation info is printed to `console`
* Updated readme with examples

#### Fixed
* `BrowserMultiPack` fixed an issue where rebuilds of a bundle pack would do nothing when the modified files affected bundle `0` (as returned by `MultiBundleStreams.destinationPicker()`)
* Fixed a bug in `Es6ifyToStream` and `UglifyToStream`, was calling `through.queue()` instead of the correct through2 `stream.Transform.push()` after upgrading to through2 at version 0.4.0


--------
### [0.5.1](https://github.com/TeamworkGuy2/ts-bundlify/commit/f4e5a2f89a3f1f08d4b7aa6c4358609069f61a52) - 2017-05-09
#### Changed
* Update to TypeScript 2.3, add tsconfig.json, use @types/ definitions


--------
### [0.5.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/6a0dc3abb7604ec6fb7f29ac5380831fdc484782) - 2017-05-06
#### Added
* `BrowserMultiPack.getPreludeSrc()` to return customized version of prelude.js customized for easier readability

#### Changed
* `BrowserifyHelper.setupRebundleListener()`
  * parameter `getInitialStream` renamed `getSourceStreams` and is passed the browserify 'update' event when available (on rebuilds).
  * return promise result changed to an object with info about the build process and default console message changed to print info about multiple bundles.
* `BundleBuilder.buildOptions()` and `createBundleBuilder()` provide finer control over bundle specific build options include prelude source string and path.
* `TypeScriptHelper.createPreludeStringWithTypeScriptHelpers()` now synchronous, uses BrowserMultiPack prelude string
* `BrowserMultiPack.createPackStreams()`
  * Better documentation
  * Modified to support custom prelude source and path per bundle stream
  * Stopped adding the 'standaloneModule' and 'hasExports' properties to the returned baseStream, these options are ready directly from the 'bundles.bundles' options
  * Reduced number of Buffers created and number of stream.push() calls  during stream write and flush
* `BrowserMultiPack.overrideBrowserifyPack()` removed 'getOpts' parameter in favor of per bundle customized options on the 'getMultiBundleOpts' parameter's return value

#### Fixed
* `UglifyToStream.createStreamCompiler()`'s returned stream not completing correctly
* `Es6ifyToStream.createCompiler()`'s returned stream not completing correctly after 

#### Removed
* 'browser-pack' package dependency
* `BundlifyHelper.getPreludeJsSource()` removed in favor of `BrowserMultiPack.getPreludeSrc()`
* `BundlifyHelper.createBrowserPacker()` removed in favor of using `BrowserMultiPack`


--------
### [0.4.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/f1974d72cf2a7ce12cf0ed5a68685a136b80d543) - 2017-05-02
#### Added
Multiple output bundle support; Browserify pipeline output customization
* Added `BrowserifyMultiPack` (port of npm 'browser-pack' package) which supports filtering/redirecting an input stream into multiple output streams.

#### Changed
* Extensive `BrowserifyHelper` and `BundleBuilder` refactoring
  * `BrowserifyHelper.setupRebundleListener()` has been refitted to support multiple streams instead of just one
  * The `BundleBuilder.buildOptions()` return API `setBundleStreamCreator()` now expects a function that returns a `MultiBundleStreams` object and `compileBundle()` requires a `CodePaths` object instead of passing the options to the initial `buildOptions()` call
* `Es6ifyToStream` and `UglifyToStream` updated to use `through2` instead of `through` package


--------
### [0.3.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/ee6c6fe7e629c7d794e9e54384eca92ba7c3b4ca) - 2016-11-09
#### Added
* UglifyBundler and UglifyToStream leveraging 'uglify-js' package to transform files for browserify to bundle
* Added 'convert-source-map@~1.3.0', 'minimatch@~3.0.3', and 'watchify@~3.7.0' project.json dependencies
* Added BrowserifyHelper.combineOpts()
* Added parameters to BabelBundler and TraceurBundler createTransformer()

#### Changed
* Renamed Es6ifyLike -> Es6ifyToStream


--------
### [0.2.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/6a659706da5ba85a628bada4486870962114b896) - 2016-11-08
#### Changed
Complete refactor.
* Renamed directory util/ -> utils/
* Renamed bundlers:
  * BabelBabelify -> BabelBundler
  * SassCssify -> SassBundler
  * TraceurEs6ify -> TraceurBundler
* BrowserifyHelper interface BufferViewTransformFunc -> BrowserifyTransform
* Refactored BundleBuilder - completely rebuilt, BundleBuilder interface includes new transform() step
* Moved/deduplicated buildOptions() and compileBundle() from BabelBundler and TraceurBundler to BundleBuilder
* TypeScriptHelper.insertTypeScriptHelpers() -> createPreludeStringWithTypeScriptHelpers()
* babelify, traceur, and node-sass are now required as parameters allow for the removal of those dependencies from package.json


--------
### [0.1.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/3ac56cd6841da23bcd7107f4616a51b62aa1ffc7) - 2016-11-07
#### Added
Initial commit of existing browserify, babel, and traceur build scripts helpers with some modifications.
Moved from original [browser-bundle-examples](https://github.com/TeamworkGuy2/browser-bundle-examples) project.
Includes:
* bundlers for Babel, Traceur, and Node-Sass
* Browserify, TypeScript, and a few other miscellaneous helper classes (mostly static methods)
* utils for dealing with paths, files, gulp, and logging
