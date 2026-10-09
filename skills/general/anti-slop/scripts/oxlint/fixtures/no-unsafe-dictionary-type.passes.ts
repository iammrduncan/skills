const cache: Record<string, CacheEntry> = {};
interface Bag { [key: string]: string }
type Tight = Record<UserId, User>;
type Constrained = Record<string, unknown & { id: string }>;
function localRecord() { type Record<K, V> = { value: V }; type Narrow = Record<string, unknown>; }
function generic<PropertyKey>() { type Narrow = Record<PropertyKey, unknown>; }
