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

/** Return whether a type is or contains TypeScript's absorbing unknown top type. */
export function containsUnknownType(type) {
    if (type.type === "TSUnknownKeyword")
        return true;
    if (type.type === "TSParenthesizedType")
        return containsUnknownType(type.typeAnnotation);
    return type.type === "TSUnionType" && type.types.some(containsUnknownType);
}
/** Return the TypeScript annotation attached to a function parameter or its wrapped binding. */
export function functionParameterTypeAnnotation(parameter) {
    if (parameter.type === "TSParameterProperty") {
        return functionParameterTypeAnnotation(parameter.parameter);
    }
    if (parameter.type === "RestElement") {
        return parameter.typeAnnotation ?? functionParameterTypeAnnotation(parameter.argument);
    }
    if (parameter.type === "AssignmentPattern") {
        return parameter.typeAnnotation ?? functionParameterTypeAnnotation(parameter.left);
    }
    return parameter.typeAnnotation;
}
/** Return only a function parameter's local binding, excluding its annotation and default value. */
export function functionParameterBindingName(parameter, sourceCode) {
    if (parameter.type === "TSParameterProperty") {
        return functionParameterBindingName(parameter.parameter, sourceCode);
    }
    if (parameter.type === "AssignmentPattern") {
        return functionParameterBindingName(parameter.left, sourceCode);
    }
    if (parameter.type === "RestElement") {
        return functionParameterBindingName(parameter.argument, sourceCode);
    }
    if (parameter.type === "Identifier")
        return parameter.name;
    const sourceText = sourceCode.getText(parameter);
    const annotationStart = parameter.typeAnnotation?.start;
    return annotationStart === undefined
        ? sourceText
        : sourceText.slice(0, annotationStart - parameter.start).trimEnd();
}
