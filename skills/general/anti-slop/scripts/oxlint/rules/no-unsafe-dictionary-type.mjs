/*
 * MIT License
 *
 * Copyright (c) 2026 Shannon Duncan, shannon@iammrduncan.com. Aliases: shadowcodex, iamMrDuncan
 *
 * ========================================================================
 * Upstream Components Copyright Notices
 * ========================================================================
 * Copyright (c) 2026 Dillon Mulroy
 *
 * ========================================================================
 * License Text
 * ========================================================================
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * A dictionary with an unconstrained value type checks the key and gives up on the value.
 *
 * Covers both spellings: `Record<string, any>` and an index signature whose
 * value is a top type.
 */

import { advice, typeReferenceName } from "../shared.mjs";

import { createTypeAliasEnvironment, resolvedTypeMatches, hasVisibleTypeBinding }
  from "../helpers/type-alias-resolution.mjs";

export default {
  meta: { docs: { description: "Disallow dictionaries whose value type asserts nothing." } },
  create(context) {
    let environment;
    const containsAny = (type, matches) => {
      if (type.type === "TSAnyKeyword") return true;
      if (type.type === "TSParenthesizedType") return matches(type.typeAnnotation);
      return (type.type === "TSUnionType" || type.type === "TSIntersectionType") &&
        type.types.some((member) => matches(member));
    };
    const match = (type, kind) => resolvedTypeMatches(type, environment, (resolved, matches) => {
      if (resolved.type === "TSParenthesizedType") return matches(resolved.typeAnnotation);
      if (resolved.type === "TSUnionType") return resolved.types.some(matches);
      if (kind === "key") {
        return ["TSStringKeyword", "TSNumberKeyword", "TSSymbolKeyword"].includes(resolved.type) ||
          (typeReferenceName(resolved) === "PropertyKey" &&
           !hasVisibleTypeBinding("PropertyKey", resolved, environment));
      }
      // A constrained intersection retains its contract; any still absorbs it.
      if (resolved.type === "TSIntersectionType") {
        return resolved.types.some((member) => matches(member, containsAny)) ||
          resolved.types.every(matches);
      }
      return resolved.type === "TSUnknownKeyword" || resolved.type === "TSAnyKeyword";
    });
    const report = (node) =>
      context.report({
        node,
        message: advice(
          "This dictionary constrains the key and gives up on the value.",
          "name the value type, or use a discriminated union if the values genuinely differ.",
          "do not swap `any` for `unknown` and call it fixed — both discard the value contract.",
        ),
      });

    return {
      Program(node) {
        environment = createTypeAliasEnvironment(node, context.sourceCode.visitorKeys);
      },
      TSTypeReference(node) {
        if (typeReferenceName(node) !== "Record" || hasVisibleTypeBinding("Record", node, environment)) return;
        const args = node.typeArguments || node.typeParameters;
        const params = args && args.params;
        if (!params || params.length !== 2) return;
        if (match(params[0], "key") && match(params[1], "value")) report(node);
      },
      TSIndexSignature(node) {
        const key = node.parameters && node.parameters[0];
        const keyType = key && key.typeAnnotation && key.typeAnnotation.typeAnnotation;
        const valueType = node.typeAnnotation && node.typeAnnotation.typeAnnotation;
        if (!keyType || !valueType) return;
        if (match(keyType, "key") && match(valueType, "value")) report(node);
      },
    };
  },
};
