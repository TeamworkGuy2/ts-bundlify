import fs = require("fs");
import path = require("path");
import stream = require("stream");
import ReadableStream = require("readable-stream");
import vinylfs = require("vinyl-fs");
import VinylFile = require("vinyl");
import ConcatSourceMaps = require("../streams/ConcatWithSourceMaps");

/** Helpers for creating bundles
 */
module VinylConcat {

    /** Concatenate the contents of one or more files together with a string separator between each and dump the resulting string to a destination file
     * @param srcFiles the source files to concatenate in the order given
     * @param dstFile the destination file to write the concatenated source files to
     * @param fileSeparator the separator string to insert between each source file
     */
    export function concat(srcFiles: string[], dstFile: string, fileSeparator = "\n") {
        var dstDir = path.dirname(dstFile);
        var dstName = path.basename(dstFile);
        return vinylfs.src(srcFiles)
            //.pipe(uglify())
            .pipe(vinylConcat(dstName, { newLine: fileSeparator }))
            .pipe(vinylfs.dest(dstDir));
    }


    // modified version of 'gulp-concat@2.6.1'
    export function vinylConcat(file: string | VinylOptions, opt?: { newLine?: string | undefined }) {
        var _opt = opt || <{ newLine: string }><any>{};

        // to preserve existing |undefined| behaviour and to introduce |newLine: ""| for binaries
        if (typeof _opt.newLine !== "string") {
            _opt.newLine = "\n";
        }

        var isUsingSourceMaps = false;
        var latestFile: VinylFile;
        var latestMod: Date | null;
        var fileName: string;
        var concat: ConcatSourceMaps;

        if (typeof file === "string") {
            fileName = file;
        } else if (typeof file.path === "string") {
            fileName = path.basename(file.path);
        } else {
            throw new Error("Missing path in file options");
        }

        function bufferContents(this: NodeJS.EventEmitter, file: VinylFile, enc: any, cb: () => void) {
            // ignore empty files
            if (file.isNull()) {
                cb();
                return;
            }

            // we don't do streams (yet)
            if (file.isStream()) {
                this.emit("error", new Error("Streaming not supported"));
                cb();
                return;
            }

            // enable sourcemap support for concat
            // if a sourcemap initialized file comes in
            if (file.sourceMap && isUsingSourceMaps === false) {
                isUsingSourceMaps = true;
            }

            // set latest file if not already set,
            // or if the current file was modified more recently.
            if (!latestMod || file.stat && file.stat.mtime > latestMod) {
                latestFile = file;
                latestMod = file.stat && file.stat.mtime;
            }

            // construct concat instance
            if (!concat) {
                concat = new ConcatSourceMaps(isUsingSourceMaps, fileName, _opt.newLine);
            }

            // add file to concat instance
            concat.add(file.relative, <any>file.contents, file.sourceMap); // the 'file.isNull()' check above ensures that this cast is safe
            cb();
        }

        function endStream(this: stream.Readable, cb: (err?: any, data?: any) => void) {
            // no files passed in, no file goes out
            if (!latestFile || !concat) {
                cb();
                return;
            }

            var joinedFile: VinylFile;

            // if file opt was a file path
            // clone everything from the latest file
            if (typeof file === "string") {
                joinedFile = latestFile.clone({ contents: false });
                joinedFile.path = path.join(latestFile.base, file);
            }
            else {
                joinedFile = new VinylFile(file);
            }

            joinedFile.contents = concat.content;

            var rawSourceMap = concat.sourceMap;
            if (rawSourceMap) {
                joinedFile.sourceMap = JSON.parse(rawSourceMap);
            }

            this.push(joinedFile);
            cb();
        }

        return new ReadableStream.Transform({ objectMode: true, highWaterMark: 16, transform: bufferContents, flush: endStream });
    }


    export interface VinylOptions /*VinylFile.ConstructorOptions*/ {
        /** The current working directory of the file. Default: process.cwd() */
        cwd?: string;
        /** Used for relative pathing. Typically where a glob starts. Default: options.cwd */
        base?: string;
        /** Full path to the file */
        path?: string;
        /** Stores the path history. If 'options.path' and 'options.history' are both passed, 'options.path' is appended to 'options.history'.
         * All 'options.history' paths are normalized by the 'file.path' setter.
         * Default: '[]' (or '[options.path]' if 'options.path' is passed)
         */
        history?: string[];
        /** The result of an fs.stat call. This is how you mark the file as a directory or symbolic link.
         * See 'isDirectory()', 'isSymbolic()' and 'fs.Stats' for more information.
         * http://nodejs.org/api/fs.html#fs_class_fs_stats
         */
        stat?: fs.Stats;
        /** File contents. Type: 'Buffer', 'Stream', or null
         * Default: null
         */
        contents?: Buffer | NodeJS.ReadableStream | null;
        /** Any custom option properties will be directly assigned to the new Vinyl object. */
        [customOption: string]: any;
    }

}

export = VinylConcat;