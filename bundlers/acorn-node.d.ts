// https://github.com/browserify/acorn-node

declare module "acorn-node" {
    export function parse(input: string, options?: acorn.Options): acorn.Node;

    export function parseExpressionAt(input: string, pos: number, options?: acorn.Options): acorn.Node;

    export function tokenizer(input: string, options?: acorn.Options): {
        getToken(): acorn.Token;
        [Symbol.iterator](): Iterator<acorn.Token>;
    };
}