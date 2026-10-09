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
 * A type assertion claims the compiler is wrong, with nothing recorded about why.
 *
 * The rule never forbids asserting. It requires the reason, because an assertion
 * nobody can evaluate is one nobody will ever remove. `as const` is exempt: it
 * narrows rather than claiming.
 */

import { advice, unwrapType } from "../shared.mjs";

const MINIMUM_WORDS = 3;

const isConstAssertion = (type) => {
  const t = unwrapType(type);
  return !!t && t.type === "TSTypeReference" && t.typeName && t.typeName.name === "const";
};

export default {
  meta: { docs: { description: "Require a comment explaining each type assertion." } },
  create(context) {
    const source = context.sourceCode;
    const ownerKinds = new Set([
      "ExpressionStatement", "PropertyDefinition", "ReturnStatement",
      "ThrowStatement", "VariableDeclaration",
    ]);
    const explains = (comment, assertion) => {
      // Oxlint also returns the previous statement's trailing comments here.
      // Those explain that statement, not the next assertion.
      let statement = assertion;
      while (statement.parent && !ownerKinds.has(statement.type) &&
             statement.parent.type !== "Program") statement = statement.parent;
      const text = source.getText();
      const lineStart = text.lastIndexOf("\n", comment.start - 1) + 1;
      if (comment.start < statement.start &&
          text.slice(lineStart, comment.start).trim().length > 0) return false;
      const words = comment.value.replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/).filter((word) => word.length > 1);
      return comment.end <= assertion.typeAnnotation.start && words.length >= MINIMUM_WORDS;
    };
    const explained = (assertion) => {
      if (assertion.type === "TSAsExpression" &&
          source.getCommentsAfter(assertion.expression).some((comment) =>
            comment.start >= assertion.expression.end && explains(comment, assertion))) return true;
      let owner = assertion;
      while (owner && owner.type !== "Program") {
        if (source.getCommentsBefore(owner).some((comment) => explains(comment, assertion))) return true;
        if (ownerKinds.has(owner.type)) {
          const parent = owner.parent;
          return parent?.type === "ExportNamedDeclaration" &&
            source.getCommentsBefore(parent).some((comment) => explains(comment, assertion));
        }
        owner = owner.parent;
      }
      return false;
    };
    const check = (node) => {
      if (isConstAssertion(node.typeAnnotation) || explained(node)) return;
      context.report({
        node,
        message: advice(
          "This assertion claims the compiler is wrong and records nothing about why.",
          `put a comment above it saying what you know that the compiler does not, in at least ${MINIMUM_WORDS} words.`,
          "do not delete the assertion and widen the declared type instead — that spreads the claim rather than documenting it.",
        ),
      });
    };
    return { TSAsExpression: check, TSTypeAssertion: check };
  },
};
