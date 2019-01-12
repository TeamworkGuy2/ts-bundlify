/// <reference types="node" />

declare module 'labeled-stream-splicer' {
    interface Pipeline extends NodeJS.ReadWriteStream {
        splice(index: number | string, howMany: any, stream: any, ...args: any[]): any;
        push(...streams: any[]): any;
        pop(): any;
        unshift(...streams: any[]): void;
        shift(): any;
        get(index: number | string): any;
    }
    type _Pipeline = Pipeline;

    var splicer: {
        (streams: any[], opts?: any): Pipeline;
        obj(streams: any[], opts?: any): Pipeline;
    };
    module splicer {
        type Pipeline = _Pipeline;
    }

    export = splicer;
}
