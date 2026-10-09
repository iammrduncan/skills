export function handle(event: DomainEvent) { return event; }
export const run = (input: Command) => input;
function third(a: string, b: Payload) { return b; }
function isText(value: unknown): value is string { return true; }
function enrich(cause: unknown) {}
