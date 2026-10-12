
export default function makeOrderedDictionary<T>(idGetter: (item: T) => string) {
  const dict = new Map<string, T>();

  return {
    upsert: (item: T, mode: 'append' | 'prepend' = 'append') => {
      const id = idGetter(item);
      dict.set(id, item);
    },
    get: (id: string) => dict.get(id),
    delete: (id: string) => dict.delete(id),
    clear: () => dict.clear(),
    array: () => Array.from(dict.values()),
    filter: (predicate: (item: T) => boolean) => {
      const filtered = Array.from(dict.values()).filter(predicate);
      return {
        all: () => filtered
      };
    },
    updateAssign: (id: string, update: Partial<T>) => {
      const item = dict.get(id);
      if (item) {
        Object.assign(item, update);
        return true;
      }
      return false;
    }
  };
}
