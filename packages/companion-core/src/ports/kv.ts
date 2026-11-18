/** 键值存储插口：冷静窗、快变量 JSON 等可由宿主 SQLite/内存实现。 */

export type KvStore = {
  get(key: string): string;
  set(key: string, value: string): void;
};

export function createMemoryKv(initial: Record<string, string> = {}): KvStore {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get(key) {
      return map.get(key) ?? "";
    },
    set(key, value) {
      map.set(key, value);
    },
  };
}
