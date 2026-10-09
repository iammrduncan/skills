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

function isNode(value) {
    return (typeof value === "object" &&
        value !== null &&
        "type" in value &&
        typeof value.type === "string");
}
function collectInferTypeParameterNames(node, visitorKeys, names) {
    if (node.type === "TSInferType")
        names.add(node.typeParameter.name.name);
    const record = node;
    for (const key of visitorKeys[node.type] ?? []) {
        const value = record[key];
        if (isNode(value)) {
            collectInferTypeParameterNames(value, visitorKeys, names);
            continue;
        }
        if (!Array.isArray(value))
            continue;
        for (const child of value) {
            if (isNode(child))
                collectInferTypeParameterNames(child, visitorKeys, names);
        }
    }
}
/** Collect type binders that are in scope at a node and can shadow module aliases. */
export function lexicalTypeParameterNames(node, visitorKeys) {
    const names = new Set();
    let descendant = node;
    let current = node;
    while (current !== null && current.type !== "Program") {
        if ("typeParameters" in current) {
            for (const parameter of current.typeParameters?.params ?? []) {
                names.add(parameter.name.name);
            }
        }
        if (current.type === "TSMappedType" &&
            (descendant === current.nameType || descendant === current.typeAnnotation)) {
            names.add(current.key.name);
        }
        if (current.type === "TSConditionalType" && descendant === current.trueType) {
            collectInferTypeParameterNames(current.extendsType, visitorKeys, names);
        }
        descendant = current;
        current = current.parent;
    }
    return names;
}
