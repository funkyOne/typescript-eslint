import { TSESTree } from '@typescript-eslint/experimental-utils';
import * as tsutils from 'tsutils';
import ts from 'typescript';

import * as util from '../util';

export default util.createRule({
  name: 'no-enum-literals',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallows usage of literals instead of enums',
      category: 'Best Practices',
      recommended: 'error',
      requiresTypeChecking: true,
    },
    messages: {
      noLiterals: 'Do not use literal values instead of enums',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const parserServices = util.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    function isEnumType(type: ts.Type): boolean {
      if (type.symbol == null) return false;

      return !['Number', 'String'].includes(type.symbol.name);
    }

    /**
     * is node an identifier with type of an enum
     * @param node identifier node
     */
    function isNodeEnumIdentifier(node: TSESTree.Node): boolean {
      const originalNode = parserServices.esTreeNodeToTSNodeMap.get<
        ts.Identifier
      >(node);
      const type = checker.getTypeAtLocation(originalNode);

      return isEnumType(type);
    }

    function isNumberOrStringLiteral(
      node: TSESTree.Node,
    ): node is TSESTree.Literal {
      return (
        node.type === 'Literal' &&
        ['number', 'string'].includes(typeof node.value)
      );
    }

    function getEnumParams(identifier: TSESTree.Node): Set<number> {
      const originalNode = parserServices.esTreeNodeToTSNodeMap.get<
        ts.Identifier
      >(identifier);

      const type = checker.getTypeAtLocation(originalNode);

      const enumParams = new Set<number>();

      for (const subType of tsutils.unionTypeParts(type)) {
        const signatures = subType.getCallSignatures();

        for (const signature of signatures) {
          for (const [index, parameter] of signature.parameters.entries()) {
            const type = checker.getTypeOfSymbolAtLocation(
              parameter,
              originalNode,
            );

            if (isEnumType(type)) {
              enumParams.add(index);
            }
          }
        }
      }

      return enumParams;
    }

    return {
      AssignmentExpression(node): void {
        if (
          isNodeEnumIdentifier(node.left) &&
          isNumberOrStringLiteral(node.right)
        ) {
          context.report({
            node: node.right,
            messageId: 'noLiterals',
          });
        }
      },
      BinaryExpression(node): void {
        if (
          isNodeEnumIdentifier(node.left) &&
          isNumberOrStringLiteral(node.right)
        ) {
          context.report({
            node: node.right,
            messageId: 'noLiterals',
          });
        }

        if (
          isNumberOrStringLiteral(node.left) &&
          isNodeEnumIdentifier(node.right)
        ) {
          context.report({
            node: node.left,
            messageId: 'noLiterals',
          });
        }
      },
      VariableDeclarator(node): void {
        if (
          isNodeEnumIdentifier(node.id) &&
          node.init &&
          isNumberOrStringLiteral(node.init)
        ) {
          context.report({
            node: node.init,
            messageId: 'noLiterals',
          });
        }
      },
      CallExpression(node): void {
        const enumParams = getEnumParams(node.callee);

        for (const enumParamIndex of enumParams.values()) {
          const argument = node.arguments[enumParamIndex];

          if (isNumberOrStringLiteral(argument)) {
            context.report({
              messageId: 'noLiterals',
              node: argument,
            });
          }
        }

        // for (const [index, argument] of node.arguments.entries()) {
        //   if (!enumParams.has(index)) continue;

        //   if (isNumberOrStringLiteral(argument)) {
        //     context.report({
        //       messageId: 'noLiterals',
        //       node: argument,
        //     });
        //   }
        // }
      },
    };
  },
});
