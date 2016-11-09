# Change Log
All notable changes to this project will be documented in this file.
This project does its best to adhere to [Semantic Versioning](http://semver.org/).


--------
### [0.3.0](N/A) - 2016-11-09
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
