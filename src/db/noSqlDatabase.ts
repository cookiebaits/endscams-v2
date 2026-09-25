/**
 * Fast client-side in-memory and local database cache
 */
import { ScamPhoneRecord } from '../types';

class Collection<T extends { id: string }> {
  private items: Map<string, T> = new Map();

  constructor(initialItems: T[] = []) {
    initialItems.forEach((item) => this.items.set(item.id, item));
  }

  find(predicate?: (item: T) => boolean): T[] {
    const all = Array.from(this.items.values());
    return predicate ? all.filter(predicate) : all;
  }

  findOne(predicate: (item: T) => boolean): T | undefined {
    for (const item of this.items.values()) {
      if (predicate(item)) return item;
    }
    return undefined;
  }

  insert(item: T): T {
    this.items.set(item.id, item);
    return item;
  }

  update(id: string, updates: Partial<T>): T | undefined {
    const existing = this.items.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.items.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }

  clear() {
    this.items.clear();
  }
}

class NoSqlDatabase {
  private recordsCol: Collection<ScamPhoneRecord>;

  constructor() {
    this.recordsCol = new Collection<ScamPhoneRecord>();
  }

  getRecordsCollection(): Collection<ScamPhoneRecord> {
    return this.recordsCol;
  }

  persist() {
    if (typeof window === 'undefined') return;
    try {
      const records = this.recordsCol.find();
      localStorage.setItem('endscams_nosql_cache', JSON.stringify(records));
    } catch {}
  }
}

export const noSqlDatabase = new NoSqlDatabase();
