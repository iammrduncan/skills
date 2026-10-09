type Payload = { id: string };
type Loose = Record<string, string>;
export type Envelope = { body: Payload };
type Recursive = Recursive;
type Constrained = unknown & { id: string };
function generic<Unknown>() { type Narrow = Unknown; }
