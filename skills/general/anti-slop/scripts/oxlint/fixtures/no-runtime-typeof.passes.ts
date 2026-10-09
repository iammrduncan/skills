function isString(v: unknown): v is string { return typeof v === "string"; }
function handle(v: Command) { return v.kind === "send" ? 1 : 0; }
export function third(y: Payload) { return y.body; }
if (typeof window === "undefined") {}
if ("undefined" != typeof Worker) {}
export function exists(y: unknown) { return typeof y !== "undefined"; }
