"use strict";
// based on lodash.memoize@3.0.3
/** lodash 3.0.4 (Custom Build) <https://lodash.com/>
 * Build: 'lodash modern modularize exports="npm" -o ./'
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
/** Used to check objects for own properties. */
var hasOwnProperty = Object.prototype.hasOwnProperty;
/** A cache object to store key/value pairs.
 */
var Memoize;
(function (Memoize) {
    var MapCache = /** @class */ (function () {
        function MapCache() {
            this.__data__ = {};
        }
        /** Removes 'key' and its value from the cache.
         * @param key the key of the value to remove
         * @returns 'true' if the entry was removed successfully, else 'false'
         */
        MapCache.prototype.delete = function (key) {
            return this.has(key) && delete this.__data__[key];
        };
        /** Gets the cached value for 'key'.
         * @param key the key of the value to get
         * @returns the cached value
         */
        MapCache.prototype.get = function (key) {
            return key == "__proto__" ? undefined : this.__data__[key];
        };
        /** Checks if a cached value for 'key' exists.
         * @param key The key of the entry to check.
         * @returns 'true' if an entry for 'key' exists, else 'false'.
         */
        MapCache.prototype.has = function (key) {
            return key != "__proto__" && hasOwnProperty.call(this.__data__, key);
        };
        /** Sets 'value' to 'key' of the cache.
         * @param key the key of the value to cache
         * @param value the value to cache
         * @returns the cache object
         */
        MapCache.prototype.set = function (key, value) {
            if (key != "__proto__") {
                this.__data__[key] = value;
            }
            return this;
        };
        return MapCache;
    }());
    Memoize.MapCache = MapCache;
    /** Creates a function that memoizes the result of 'func'. If 'resolver' is
     * provided it determines the cache key for storing the result based on the
     * arguments provided to the memoized function. By default, the first argument
     * provided to the memoized function is coerced to a string and used as the
     * cache key. The 'func' is invoked with the 'this' binding of the memoized
     * function.
     *
     * **Note:** The cache is exposed as the 'cache' property on the memoized
     * function. Its creation may be customized by replacing the 'memoize.Cache'
     * constructor with one whose instances implement the ['Map'](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-properties-of-the-map-prototype-object)
     * method interface of 'get', 'has', and 'set'.
     *
     * @static
     * @param func The function to have its output memoized
     * @param [resolver] the function to resolve the cache key
     * @returns the new memoizing function
     *
     * @example
     * var upperCase = memoize(function(string) {
     *   return string.toUpperCase();
     * });
     *
     * upperCase('fred');
     * // => 'FRED'
     *
     * // modifying the result cache
     * upperCase.cache.set('fred', 'BARNEY');
     * upperCase('fred');
     * // => 'BARNEY'
     *
     * // replacing 'memoize.Cache'
     * var object = { 'user': 'fred' };
     * var other = { 'user': 'barney' };
     * var identity = memoize(_.identity);
     *
     * identity(object);
     * // => { 'user': 'fred' }
     * identity(other);
     * // => { 'user': 'fred' }
     *
     * memoize.Cache = WeakMap;
     * var identity = memoize(_.identity);
     *
     * identity(object);
     * // => { 'user': 'fred' }
     * identity(other);
     * // => { 'user': 'barney' }
     */
    function memoize(func, resolver) {
        if (typeof func != "function" || (resolver && typeof resolver != "function")) {
            throw new TypeError("Expected a function");
        }
        function memoized() {
            var args = arguments;
            var key = resolver ? resolver.apply(this, args) : args[0];
            var cache = memoized.cache;
            if (cache.has(key)) {
                return cache.get(key);
            }
            var result = func.apply(this, args);
            memoized.cache = cache.set(key, result);
            return result;
        }
        memoized.cache = new memoize.Cache();
        return memoized;
    }
    Memoize.memoize = memoize;
    // Assign cache to 'memoize'.
    memoize.Cache = MapCache;
})(Memoize || (Memoize = {}));
module.exports = Memoize;
