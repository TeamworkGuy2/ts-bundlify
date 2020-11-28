// https://github.com/goto-bus-stop/undeclared-identifiers
declare module "undeclared-identifiers" {
    function undeclaredIdentifiers(source: any, opts: { properties?: any; wildcard?: any;[key: string]: any }): { identifiers: string[]; properties: any[] };
    export = undeclaredIdentifiers;
}