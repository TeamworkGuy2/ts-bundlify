# Change Log
All notable changes to this project will be documented in this file.
This project does its best to adhere to [Semantic Versioning](http://semver.org/).


--------
### [0.10.5](N/A) - 2019-04-16
#### Added
* Optional `BrowserifyHelper.addDependencyTracker()` `filter` parameter to allow for control over which dependencies get tracked

#### Fixed
* `BrowserifyHelper.addDependencyTracker()` was ignoring repeat updates to the same file dependency mapping, adjusted to always save so that re-bundling works
* `BrowserifyHelper.detectCircularDependencies()` returns an empty array instead of null when no circular dependencies are detected


--------
### [0.10.4](https://github.com/TeamworkGuy2/ts-bundlify/commit/da17b4e9d87fa9b41ee86d5b4fc7cea2b74efe71) - 2019-04-15
#### Added
* `BrowserifyHelper` `addDependencyTracker()` and `detectCircularDependencies()` (see `BundleBuilderTest` for examples of how to use these functions)
* `PathUtil.getFileNameWithoutExt()`

#### Changed
* `BrowserifyHelper.runFuncResultToBuffer()` now always returns the `chunk` argument


--------
### [0.10.3](https://github.com/TeamworkGuy2/ts-bundlify/commit/e7a5fadf714ae314cb69c002eb4a5605558fc416) - 2019-01-27
#### Added
* Bundle test for `BrowserMultiPack`
* `BrowserPackOptions` comments

#### Changed
* `BabelBundler`, `TraceurBundler`, and `UglifyBundler` `verbose` parameters allow boolean flags or logging functions to be passed in (default is `console.log`)

#### Fixed
* `BundleBuilder.getMapFilePath()` - prepend 'dstDir' to 'mapFile' name which fixes a map file path issue with `compileBundle()`


--------
### [0.10.2](https://github.com/TeamworkGuy2/ts-bundlify/commit/948650734c658edff536b98f9801d2f7248ad6ee) - 2019-01-19
#### Added
* Add `RequireParser.parse()` callback parameter to allow control of unknown token handling
* Add `TypeScriptHelper.skipTypeScriptHelpersWhenParsingRequire()` which can be passed to `RequireParser.parse()` to skip typescript helpers at the beginning of TypeScript compiled .js files

#### Changed
* Added unit test for RequireParser parsing of TypeScript helpers


--------
### [0.10.1](https://github.com/TeamworkGuy2/ts-bundlify/commit/58471dcbafc9072784ae04f3b67a095c588b2c82) - 2019-01-19
#### Changed
* Forgot to commit `package.json`


--------
### [0.10.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/f4deae8d1cad63249b84d68c5255bb6d5809fc25) - 2019-01-19
#### Added
* `BrowserMultiPack.createPacker()` with code from `overrideBrowserifyPack()`
  * `var packer = createPacker(...); var browserPack = (opts) => packer.createPackStreams().baseStream` can be used as a `browserPack` replacement for `TsBrowserify`)

#### Changed
* Renamed `BundlifyHelper` -> `VinylConcat`
* `BrowserMultiPack.overrideBrowserifyPack()` returns the underlying `createPacker()` object created
* `RequireParser` performance improvement and unit tests added
  * Added `hasQuotes()`, `hasParens()`, and `trimSemicolonParensAndQuotes()`

#### Fixed
* `RequireParser` support for `"use strict";` on first line before `require()` calls to parse

#### Removed
* `RequireParser` removed `trimQuotes()` and `trimParens()` (use `trimSemicolonParensAndQuotes()` or `hasQuotes()` and `hasParens()`)


--------
### [0.9.5](https://github.com/TeamworkGuy2/ts-bundlify/commit/6f05d1ac94de1fbaaf70f60447af078ab2a54f6d) - 2019-01-14
#### Added
* Added `TsWatchify` (TypeScript conversion of `watchify@3.11.0`). Allows projects to switch from browserify to TsBrowserify since watchify requiring browserify as a dependency.
* `RequireParser` which is a simple (not prod ready) replacement for `detective` to extract 'require()' calls from js files where require calls must appear at the beginning of the file


--------
### [0.9.4](https://github.com/TeamworkGuy2/ts-bundlify/commit/e241f011873fad30aed3a2b64bf688231d8cf0ae) - 2019-01-13
#### Added
* Unit test for `StringUtil`
* Basic `BundleBuilderTest` unit test of full bundle build with [test/test-proj/](test/test-proj/) test files to be bundled
* Added `insert-module-globals` and `module-deps` back to `package.json` for unit tests

#### Changed
* Updated README.md with up-to-date examples
* Moved/renamed private method `BrowserMultiPack.newlinesIn()` -> `StringUtil.countNewlines()`
* `TsBrowserify` - added documentation and cleaned up some code (`plugin()` and `bundle()` arguments stronger types)
* `TsBrowserify.buildBundler()` return value has a new `createOptions()` function which can be replaced/wrapped to customize the `opts` passed to the `browserBundler` callback each time it is called

#### Removed
* Removed `TsBrowserify.buildBundler()` last optional `optsModifier` parameter. Simplified, just pass in all options via the `bundleOpts` parameter.
* Removed `MultiBundleOptions.maxDestinations` (use `bundles.length` internally since it should be the same value)


--------
### [0.9.3](https://github.com/TeamworkGuy2/ts-bundlify/commit/7534839a5abb4f3e1845353d6175307c22126ad6) - 2019-01-12
#### Fixed
* `TsBrowserify` xtend() calls not correctly creating new objects


--------
### [0.9.2](https://github.com/TeamworkGuy2/ts-bundlify/commit/02737880b5ce398af3dead01475212aa1e7d4d60) - 2019-01-12
#### Changed
* `BrowserMultiPack` fully generic now, `browserify` changed to `bundler`
* `BrowserifyHelper.setupRebundleListener()` no longer using browserify interfaces, generic
* `BundleBuilder` new `BasicBundler` interface
* `BundleBuilder` `compileBundle()` no longer using browserify interfaces, requires `BasicBundler` type object


--------
### [0.9.1](https://github.com/TeamworkGuy2/ts-bundlify/commit/3a07e250f58dca5e15da30addf7abf9e7dcd7be5) - 2019-01-12
#### Changed
* `TsBrowserify` exposed interfaces: `CreateDepsOptions`, `CreatePipelineOptions`, `RowLike`, `RequireOptions`, `StreamLike`

#### Fixed
* `BrowserMultiPack.overrideBrowserifyPack()` `_browserify` parameter type incorrect


--------
### [0.9.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/4bd8c7896bb5bddf2ad390fc5f16e2b2250345a3) - 2019-01-12
#### Changed
* Cleaned up some documentation, change 'browserify' to 'browser-bundler'
* Make `BundleBuilder` more generic to handle `browserify` and `TsBrowserify`:
  * Renamed interface `BrowserifyCompileFunc` -> `CompileFunc<T>`
  * `buildBundler()` parameters now generic and `browserBundler` parameter now expected to be a function, not a constructor
* `BrowserifyHelper` changed `BuildResults` `totalTimeMs` -> `totalTimeMillis` and `FileBundleResults` `timeMs` -> `timeMillis`

#### Fixed
* `TsBrowserify` constructor still not working with one argument

#### Removed
* `BundleBuilder.createBrowserify()` (simplified and moved the code into `buildBundler()`)


--------
### [0.8.4](https://github.com/TeamworkGuy2/ts-bundlify/commit/714874b086ca77df220a6469cffb167eb30590e8) - 2019-01-12
#### Changed
* `BrowserMultiPack.overrideBrowserifyPack()` `_browserify` parameter type simplified
* `BundleBuilder` `buildBundler()` and `createBrowserify()` `browserify` parameters renamed `browserBundler` and types are more generic now to make it easier to use `TsBrowserify` with them

#### Fixed
* `TsBrowserify` compile errors using certain TypeScript settings


--------
### [0.8.3](https://github.com/TeamworkGuy2/ts-bundlify/commit/e472bd3cac51552656e464a2ffcc6d7568907f5c) - 2019-01-12
#### Changed
* Modified `package.json` dependencies to use `^` for versions to allow projects which depend on this project to specify their own minor.patch version
* Adjusted TsBrowserify constructor to work with one argument


--------
### [0.8.2](https://github.com/TeamworkGuy2/ts-bundlify/commit/ba8c576390f55427d48693a1a752fb57bff182fc) - 2019-10-12
#### Added
* Added `bundlers/browser/TsBrowserify` - TypeScript conversion of `Browserify@14.4.0` with some customizations
* Added `package.json` dependencies for TsBrowserify

#### Changed
* Enable tsconfig.json `strictBindCallApply` and fixed compile error


--------
### [0.8.1](https://github.com/TeamworkGuy2/ts-bundlify/commit/1ffd757f924ea9e9b70d0809dec9ea019987da12) - 2018-12-29
#### Changed
* Update to TypeScript 3.2
* Replaced `gulp-concat` with `concat-with-sourcemaps` and `vinyl` (`through2` also required but already imported)


--------
### [0.8.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/b2cebfb8af2c76700f86f4bb13129ef8a2fb8fe3) - 2018-10-13
#### Changed
* Update to TypeScript 3.1
* Update README documentation
* `BundleBuilder.buildBundler()` now requires a `browserify` and `rebuilder` parameter to decouple this package from version dependencies
* Switched from `gulp` to `vinyl-fs` for `src()` and `dest()` in `BundleBuilder` and `BundlifyHelper`
* Minor dependency updates, removed browserify, gulp, and watchify.
* Removed compiled bin tarball in favor of git tags and github releases


--------
### [0.7.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/38bd772ce1928f8be080f4c24df2823bf19ad23e) - 2018-04-09
#### Changed
* Changed interface `BundleBuilder.BundleSourceCreator<T>` to a type and use it in more places
* Renamed `BundleBuilder.createBundleBuilder()` -> `BundleBuilder.buildBundler()`

#### Removed
* `BundleBuilder.buildOptions()` use new `buildBundler()` with `BundleBuilder.compileBundle()` as the second parameter


--------
### [0.6.7](https://github.com/TeamworkGuy2/ts-bundlify/commit/b68d9569b0acd65329d8399c6a51a97837a510bb) - 2018-03-31
#### Changed
* Update tsconfig.json with `noImplicitReturns: true` and `forceConsistentCasingInFileNames: true`, fixed a few methods that didn't explicitly return from every code path.


--------
### [0.6.6](https://github.com/TeamworkGuy2/ts-bundlify/commit/8134ace2745988b6106fa6f2560eca7034b09324) - 2018-03-30
#### Changed
* Update to TypeScript 2.8
* Update dependencies: browserify, @types/node, @types/q, other minor version bumps


--------
### [0.6.5](https://github.com/TeamworkGuy2/ts-bundlify/commit/f06db45f9603503e354a71d0699cc7d891cda7c4) - 2018-03-01
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
* Added `BrowserifyMultiPack` (port of npm `browser-pack` package) which supports filtering/redirecting an input stream into multiple output streams.

#### Changed
* Extensive `BrowserifyHelper` and `BundleBuilder` refactoring
  * `BrowserifyHelper.setupRebundleListener()` has been refitted to support multiple streams instead of just one
  * The `BundleBuilder.buildOptions()` return API `setBundleStreamCreator()` now expects a function that returns a `MultiBundleStreams` object and `compileBundle()` requires a `CodePaths` object instead of passing the options to the initial `buildOptions()` call
* `Es6ifyToStream` and `UglifyToStream` updated to use `through2` instead of `through` package


--------
### [0.3.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/ee6c6fe7e629c7d794e9e54384eca92ba7c3b4ca) - 2016-11-09
#### Added
* UglifyBundler and UglifyToStream leveraging `uglify-js` package to transform files for browserify to bundle
* Added `convert-source-map@~1.3.0`, `minimatch@~3.0.3`, and `watchify@~3.7.0` project.json dependencies
* Added BrowserifyHelper.combineOpts()
* Added parameters to `BabelBundler` and `TraceurBundler` `createTransformer()`

#### Changed
* Renamed `Es6ifyLike` -> `Es6ifyToStream`


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
