"use strict";

// based on path@2.0.0 (https://github.com/sindresorhus/path-is-absolute/commit/c6c907f26ac5080af0a836f7e8e7dcb9d4815ddb)
function posix(path: string): boolean {
	return path.charAt(0) === '/';
}

function win32(path: string): boolean {
	// https://github.com/nodejs/node/blob/b3fcc245fb25539909ef1d5eaa01dbf92e168633/lib/path.js#L56
	var splitDeviceRe = /^([a-zA-Z]:|[\\/]{2}[^\\/]+[\\/]+[^\\/]+)?([\\/])?([\s\S]*?)$/;
	var result = <RegExpExecArray><any>splitDeviceRe.exec(path);
	var device = result[1] || '';
	var isUnc = !!device && device.charAt(1) !== ':';

	// UNC paths are always absolute
	return !!result[2] || isUnc;
}

var res = process.platform === 'win32' ? win32 : posix;
(<any>res).posix = posix;
(<any>res).win32 = win32;

export = <((path: string) => boolean) & { posix: (path: string) => boolean; win32: (path: string) => boolean }>res;
