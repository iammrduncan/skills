export function merge(target: Config, source: Partial<Config>) { return { ...target, ...source }; }
export const apply = (patch: Patch) => patch;
function third(name: string, bag: Bag) { return bag; }
type Broad = object; function generic<Broad>(input: Broad) {}
function nested() { type Broad = { id: string }; function narrow(input: Broad) {} }
type Recursive = Recursive; function recursive(input: Recursive) {}
