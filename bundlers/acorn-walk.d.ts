// https://github.com/acornjs/acorn
import type * as AcornWalk from "acorn-walk";

type NodeFn = AcornWalk.RecursiveWalkerFn<any>;

//declare module "acorn-node/walk" {
declare module AcornNodeWalk {

    export var simple: typeof AcornWalk["simple"];

    export var ancestor: typeof AcornWalk["ancestor"];

    export var recursive: typeof AcornWalk["recursive"];

    export var full: typeof AcornWalk["full"];

    export var fullAncestor: typeof AcornWalk["fullAncestor"];

    export var findNodeAt: typeof AcornWalk["findNodeAt"];

    export var findNodeAround: typeof AcornWalk["findNodeAround"];

    export var findNodeAfter: typeof AcornWalk["findNodeAfter"];

    export var findNodeBefore: typeof AcornWalk["findNodeAfter"];

    export var make: typeof AcornWalk["make"];

    export var base: {
        BlockStatement: NodeFn;
        Program: NodeFn;
        Statement: NodeFn;
        EmptyStatement: NodeFn;
        ChainExpression: NodeFn;
        ParenthesizedExpression: NodeFn;
        ExpressionStatement: NodeFn;
        IfStatement: NodeFn;
        LabeledStatement: NodeFn;
        ContinueStatement: NodeFn;
        BreakStatement: NodeFn;
        WithStatement: NodeFn;
        SwitchStatement: NodeFn;
        SwitchCase: NodeFn;
        AwaitExpression: NodeFn;
        YieldExpression: NodeFn;
        ReturnStatement: NodeFn;
        SpreadElement: NodeFn;
        ThrowStatement: NodeFn;
        TryStatement: NodeFn;
        CatchClause: NodeFn;
        DoWhileStatement: NodeFn;
        WhileStatement: NodeFn;
        ForStatement: NodeFn;
        ForOfStatement: NodeFn;
        ForInStatement: NodeFn;
        ForInit: NodeFn;
        DebuggerStatement: NodeFn;
        FunctionDeclaration: NodeFn;
        VariableDeclaration: NodeFn;
        VariableDeclarator: NodeFn;
        Function: NodeFn;
        Pattern: NodeFn;
        VariablePattern: NodeFn;
        MemberPattern: NodeFn;
        RestElement: NodeFn;
        ArrayPattern: NodeFn;
        ObjectPattern: NodeFn;
        Expression: NodeFn;
        MetaProperty: NodeFn;
        Super: NodeFn;
        ThisExpression: NodeFn;
        ArrayExpression: NodeFn;
        ObjectExpression: NodeFn;
        ArrowFunctionExpression: NodeFn;
        FunctionExpression: NodeFn;
        SequenceExpression: NodeFn;
        TemplateLiteral: NodeFn;
        TemplateElement: NodeFn;
        UpdateExpression: NodeFn;
        UnaryExpression: NodeFn;
        LogicalExpression: NodeFn;
        BinaryExpression: NodeFn;
        AssignmentPattern: NodeFn;
        AssignmentExpression: NodeFn;
        ConditionalExpression: NodeFn;
        CallExpression: NodeFn;
        NewExpression: NodeFn;
        MemberExpression: NodeFn;
        ExportDefaultDeclaration: NodeFn;
        ExportNamedDeclaration: NodeFn;
        ExportAllDeclaration: NodeFn;
        ImportDeclaration: NodeFn;
        ImportExpression: NodeFn;
        Literal: NodeFn;
        Identifier: NodeFn;
        ImportNamespaceSpecifier: NodeFn;
        ImportDefaultSpecifier: NodeFn;
        ImportSpecifier: NodeFn;
        TaggedTemplateExpression: NodeFn;
        ClassExpression: NodeFn;
        ClassDeclaration: NodeFn;
        Class: NodeFn;
        ClassBody: NodeFn;
        Property: NodeFn;
        MethodDefinition: NodeFn;
        Import: NodeFn;
    };
}