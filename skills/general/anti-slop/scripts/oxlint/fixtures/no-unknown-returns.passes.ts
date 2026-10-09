export function decode(raw: string): Payload { return schema.parse(JSON.parse(raw)); }
export const load = (): Thing => fetchThing();
function inner(): number { return 1; }
function generic<Unknown>(): Unknown { throw new Error(); }
function localPromise() { type Promise<T> = { value: T }; function narrow(): Promise<unknown> { throw new Error(); } }
