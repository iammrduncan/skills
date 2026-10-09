const cache: Record<string, any> = {};
interface Bag { [key: string]: unknown }
type Loose = Record<string, unknown>;
type Key = string | "id"; type Value = unknown; type Aliased = Record<Key, Value>;
type Absorbed = Record<string, any & { id: string }>;
