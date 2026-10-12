
export class ObjectRepository<T extends { id: string }> {
  private items: Map<string, T>;

  constructor() {
    this.items = new Map();
  }

  upsertById(id: string, item: T): void {
    this.items.set(id, item);
  }

  deleteById(id: string): boolean {
    return this.items.delete(id);
  }

  getById(id: string): T | undefined {
    return this.items.get(id);
  }

  count(): number {
    return this.items.size;
  }

  all(): T[] {
    return Array.from(this.items.values());
  }
}
