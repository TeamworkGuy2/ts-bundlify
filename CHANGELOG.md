﻿# Change Log
All notable changes to this project will be documented in this file.
This project does its best to adhere to [Semantic Versioning](http://semver.org/).


--------
### [0.26.0](N/A) - 2022-01-02
#### Changed
* Update to TypeScript 4.4


--------
### [0.25.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/a62340fe837e89ff9b9a1d1056f5f80314c1274e) - 2021-11-07
#### Added
* `BundleBuilder.createOptions()`
* `BundleBuilder.createDefaultBundler()`

#### Changed
Refactor with goal of removing excess layers of complexity and giving the caller more transparent control over the bundler implementation setup and usage.
* `BundleBuilder` refactored, see README.md for usage instructions, summary:
  1. create your own options using `BundleBuilder.createOptions(...)`
  2. create a bundler implementation (i.e. new browserify() or new TsBrowserify())
  3. call `BundleBuilder.compileBundle()` with the options, paths, and bundler you created (for the `bundleSourceCreator` parameter use `BundleBuilder.createDefaultBundler()` or `BrowserMultiPack.createPacker().multiBundleSourceCreator`)

#### Removed
* `BundleBuilder.buildBundler()` in favor of createOptions() and compileBundle() - see 'Changes' above and README.md for new usage pattern
* `BundleBuilder` interfaces removed: `CompileFunc`, `Builder`, `BuilderListenersStep`, `BuilderListenersStep`, and `BuilderCompileStep` - see 'Changes' above and README.md for new usage pattern
* `BrowserifyHelper.createStreamTransformer()` (and private runFuncResultToBuffer()) because they were unused


--------
### [0.24.1](https://github.com/TeamworkGuy2/ts-bundlify/commit/08fe38301ab455259a5e2f8e1adb28e3a5c256ab) - 2021-10-04
#### Changed
* `InlineSourceMap.addSourceContent()` `sourcesContent` parameter now optional
* `ConcatWithSourceMaps.contentParts` now strongly typed as `Buffer[]` instead of `any[]`
* `CombineSourceMap` `offset` parameters on several functions loosened to `Partial<...>` to match the underlying `InlineSourceMap` instance not requiring line/column offsets

#### Fixed
* A `BrowserMultiPack` bug not counting bundled source lines properly, could throw off source map line numbers
* A `VinylConcat` bug not identifying when source maps are enabled


--------
### [0.24.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/0c6ad45a3e8550975b8a1ecaa7c0f5a3f01e6110) - 2021-10-03
#### Changed
* `BrowserMultiPack.createWrappedSourceAndMap()` parameters changed, line numbers array instead of `lineNum` and `sourceMapIndex` renamed to `bundleIndex and moved later in the parameter list

#### Fixed
* Fix source map line numbers in bundles not matching up to source files


--------
### [0.23.1](https://github.com/TeamworkGuy2/ts-bundlify/commit/d9d2f48be5e6bd87e64130828ee5cac34acbd757) - 2021-08-30
#### Fixed
* Fix `GlobWatcher.WatchOptions` type to extend `chokidar.WatchOptions`
* Fix `GlobWatcher.watch()` `cb` parameter type to receive a `done()` function parameter
* Remove unnecessary `GlobWatcher.watch()` `options.events` array check
* Fix an issue in `BrowserifyHelper` when used in a project without tsconfig `strict` enabled


--------
### [0.23.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/7cac4c4cd749161a928fbf50bfa26747ceb60938) - 2021-08-28
#### Added
* Add several implementations of stream and source-map operations: `InlineSourceMap`, `Memoize`, `PathIsAbsolute`, and `GlobWatcher`. These are meant to centralize and simplify dependency management, especially updating dependency versions when security issues and bug fixes are released
  * The biggest addition is the `GlobWatcher` implementation which has only 4 non-core dependencies and directly uses `picomatch` and `chokidar` instead of `anymatch@2.0.*`. This eliminates over 150 dependencies required by anymatch.
* `BrowserPackOptions.sourceRoot` new optional string property that gets passed to `CombineSourceMap.create()`
* `BrowserMultiPack` refactored to expose `toUmdSource()` and `createWrappedSourceAndMap()`

#### Changed
* Switch from `source-map` to `source-map-js` for fixes and performance improvements. We can't update to `source-map@0.7.*` due to the async wasm (see https://github.com/mozilla/source-map/issues/370)
* Dependency updates:
  * add `end-of-stream`, `once`, `picomatch`, and `source-map-js` to dependencies in place of `combine-source-map` and `glob-watcher`
  * remove `combine-source-map` and `@types/combine-source-map` in favor of custom implementation (see `/streams/CombineSourceMap.ts`)
  * remove `concat-with-sourcemaps` in favor of custom implementation (see `/streams/ConcatWithSourceMaps`)


--------
### [0.22.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/317aea345dc2e6ac056f25cf03955f6e3142faee) - 2021-08-22
#### Added
* Add several implementations of basic stream operations: `ConcatStream`, `ConcatWithSourceMaps`, and `VinylSourceStream`. These are meant to centralize and simplify dependency management, especially updating dependency versions when security issues and bug fixes are released

#### Changed
* Dependency updates:
  * remove `concat-stream` and `@types/concat-stream` in favor of custom implementation (see `/streams/ConcatStream.ts`)
  * remove `concat-with-sourcemaps` in favor of custom implementation (see `/streams/ConcatWithSourceMaps`)
  * remove `vinyl-source-streams` in favor of custom implementation (see `/streams/VinylSourceStream`)
  * update `exorcist` from `0.4.6` to `2.0.0`
  * move `browser-pack` from `dependencies` to `devDependencies` (keep `@types/browser-pack` as a dependency since it is required by `TsBrowserify`)


--------
### [0.21.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/ff8e7b73bc7f46e2f03a46d94d747bb7a253f850) - 2021-08-17
#### Changed
* Dependency updates:
  * bump `resolve` from `1.17.1` to `1.20.1`
  * pin `readable-stream` to `2.3.9` to fix breaking changes in `2.3.10` - `readable-stream` types no longer match `node` types because they don't properly implement/mirror `EventEmitter`, this commit appears to have introduced the issue https://github.com/DefinitelyTyped/DefinitelyTyped/blob/6c4cb0df04cfaa6ac31ab8136bfd12f8f05f9ef1/types/readable-stream/index.d.ts


--------
### [0.20.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/48f23ca34d0156408ac044b8f39162e8f8bcf93c) - 2021-06-12
#### Changed
* Update to TypeScript 4.3


--------
### [0.19.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/3a3f909554a43b0fb142d7d6d66fa96a20526736) - 2021-03-28
#### Added
* `TsBrowserify` option `createPipeline` to allow overriding the default pipeline creation completely
  * Refactored `_createPipeline()` code into several sub functions: `_setupBundleTransform()` (split out from `_createDepsOpts()` which is already called by `_createPipeline()`) and `_exposeAllDeps()` which is called to create a pipeline `deps` transform when `options.exposeAll` is true

#### Changed
* Move dependencies only used for testing to 'devDependencies': `deps-sort` and `insert-module-globals`
* Update dependencies: `chokidar` from 3.3 to 3.5, `exorcist` from 1.0 to 2.0
* Made `TsBrowserify` constructor `options.insertModuleGlobals` optional, if not provided the `insertModuleGlobals` step will be skipped

#### Fixed
* `InsertModuleGlobals` TypeScript signature not matching the popular npm package `insert-module-globals`

#### Removed
* `TsBrowserify` `plugin()` and constructor `options.plugin` (only useful for CLI, which this project is not focused on supporting). `tsBrowserifyInst.plugin(p, [opts])` is equivalent to `p(tsBrowserifyInst, [opts])`
* `TsBrowserify` constructor `options.node` (equivalent to `{ bare: true, browserField: false }`)
* `GulpUtil` small helper file that did not contribute to the purpose of this project
* Removed unused dependency `minimist`


--------
### [0.18.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/185d4922effc074db23ec42901cdc5ff359bcb49) - 2021-03-15
#### Changed
* Remove `Q` dependency
* Change `TypeScriptHelper.compileTpeScriptFile()` to take a callback rather than return a promise
* Change `BrowserifyHelper` and `LogUtil.log()` to use interface `Promise` instead of `Q.Promise`
* Change `MultiBundleStreams` `baseStream` and `bundleStream` properties from accepting `Q.Promise` to `Promise`


--------
### [0.17.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/705a0f162e3cbe5492a2235dcd4ec95bad9c9e90) - 2021-02-21
#### Added
* Added a TypeScript implementation of `detective@5.2.0` in `bundlers/Detective.ts` (includes a port of `acorn-node/walk` since it couldn't be imported into a TypeScript via `import ...`)

#### Changed
* `TsBrowserify.Options` `plugin` and `TsBrowserify.plugin()` no longer supports `string`, import plugins into your calling code and pass the plugin function, since TsBrowserify is not designed to run via cli (which appears to have been the use case for supporting `string` on this option)
* `TsBrowserify.Options` `transform` and `TsBrowserify.transform()` no longer supports `string`, import transform functions into your calling code and pass them directly, since TsBrowserify is not designed to run via cli (which appears to have been the use case for supporting `string` on this option)

#### Removed
* `TsBrowserify.Options` `ignoreTransform` removed - no compelling use case


--------
### [0.16.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/cb8fccf1668a6305fca00c8f1913b9a016fabe06) - 2020-11-28
#### Added
* `StreamUtil` with a `readWrite()` method which can be used as a replacement for `through2`
* Untested TypeScript conversion of `insert-module-globals` in `bundlers/InsertModuleGlobals`

#### Changed
* More specific/correct types for `TsBrowserify.Options` fields: `entries`, `plugin`, `require`, `transform`, `builtins`, `exposeAll`, and `noParse`
* Moved `LabeledStreamSplicer` to new `streams/` directory

#### Removed
* `through2` dependency, replaced by `streams/StreamUtil`
* `events` dependency in favor or `TsBrowserify` extending node.js `events` directly since TsBrowserify is not designed to run in a browser context


--------
### [0.15.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/3ee631f034dd73e02d2defff7d387f870cefd5cc) - 2020-11-14
#### Added
* Add/port `LabeledStreamSplicer` and `StreamSplicer` classes into this project based on `labeled-stream-splicer@2.0.2` and `stream-splicer@2.0.1`
  * Adjust API `getGroup()` method added to handle the return type difference between a stream and a stream-splicer

#### Changed
* Update dependencies: `browser-resolve@2.0.0`, `resolve@1.17.1`, and `concat-stream@2.0.0`

#### Removed
* Remove `labeled-stream-splicer@2.0.1` dependency and `labeled-stream-splicer.d.ts` definition since the library is now included in this project


--------
### [0.14.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/d4edda9bb7d5a2d0d2324c09546f42d1c17dcb03) - 2020-09-04
#### Changed
* Update to TypeScript 4.0


--------
### [0.13.1](https://github.com/TeamworkGuy2/ts-bundlify/commit/4fe3743d0849ad133005a410847c118cd64baa22) - 2019-11-08
#### Changed
* Update to TypeScript 3.7 and `chokidar@~3.3.0` and `anymatch@~3.1.1`


--------
### [0.13.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/9868b8c54b8cd41555d6f5a9a6f6f1e28d2ccc10) - 2019-08-19
#### Removed
* `traceur/`: `Es6ifyToStream` and `TraceurBundler` since traceur has not been updated in over 2 years
* `shasum` dependency in favor of placing simplified code directly in `TsBrowserify`


--------
### [0.12.4](https://github.com/TeamworkGuy2/ts-bundlify/commit/83045313e00b4765c880c9c4f8a08586da9f7430) - 2019-08-19
#### Changed
* Add latest TypeScript helpers code to `TypeScriptHelper`


--------
### [0.12.3](https://github.com/TeamworkGuy2/ts-bundlify/commit/afd1e0ff680b731fcc89f5d5ed23076935ea12c9) - 2019-07-06
#### Changed
* Update to TypeScript 3.5


--------
### [0.12.2](https://github.com/TeamworkGuy2/ts-bundlify/commit/7aef9a703c774f0fecad2b45564c1b4ae9fb39ec) - 2019-05-09
#### Fixed
* Fix `TsBrowserify` strict compile errors that don't show in this project until it's required in another strict TypeScript project


--------
### [0.12.1](https://github.com/TeamworkGuy2/ts-bundlify/commit/9290401120e1580be541160fe461c4d7b13a4e16) - 2019-05-09
#### Changed
* Enable `tsconfig.json` `strict` so package works with strict projects
* Fixed related code errors from enabling TypeScript `strict`


--------
### [0.12.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/bc703a4cff96c093b9e4a870360aece465250214) - 2019-05-09
#### Changed
* Update `package.json` dependencies: correctly move devDependependencies -> dependencies, @types/node@12.0.0, remove @types/chokidar since chokidar bundles types with it now.


--------
### [0.11.0](https://github.com/TeamworkGuy2/ts-bundlify/commit/9ca0e9401bbb126c6a4210a695fd04f017730fee) - 2019-05-08
#### Changed
* Added `read-only-stream` directly into `TsBrowserify` and switched `read-only-stream@^2.0.0` dependency in package.json to `readable-stream@^2.0.0`

#### Removed
* `read-only-stream.d.ts` since the package is only 30 lines, added directly into `TsBrowserify`
* `browserify-14.4.0.js` and `stream-splicer.d.ts-unused` accidentally committed previously


--------
### [0.10.5](https://github.com/TeamworkGuy2/ts-bundlify/commit/d9c93d60e5fa973aeedc33a0269ab46ecd18084b) - 2019-04-16
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
