export function merge(target: object, source: object) { return { ...target, ...source }; }
export const apply = (patch: object) => patch;
function third(name: string, bag: object) { return bag; }
type Broad = object; function aliased(input: Broad) {}
type Identity<T = object> = T; function defaulted(input: Identity) {}
interface Contract { method(input: object): void }
