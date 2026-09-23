/**
 * Client-side NoSQL / LocalStorage persistence interface.
 */

const LOCAL_STORAGE_KEY = 'esscan_threat_records_v2';

export class RecordsCollection {
  private items: any[];
  private onPersist: () => void;

  constructor(items: any[], onPersist: () => void) {
    this.items = items;
    this.onPersist = onPersist;
  }

  public findOne(predicate: (item: any) => boolean): any | null {
    return this.items.find(predicate) || null;
  }

  public find(predicate?: (item: any) => boolean): any[] {
    if (!predicate) return this.items;
    return this.items.filter(predicate);
  }

  public update(idOrItem: any, item?: any): void {
    const targetItem = item || idOrItem;
    if (!targetItem) return;
    const targetId = typeof idOrItem === 'string' ? idOrItem : targetItem.id;
    const index = this.items.findIndex(
      (i) =>
        (targetId && i.id === targetId) ||
        (i.phone_digits && targetItem.phone_digits && i.phone_digits === targetItem.phone_digits) ||
        (i.cleanPhone && targetItem.cleanPhone && i.cleanPhone === targetItem.cleanPhone)
    );
    if (index >= 0) {
      this.items[index] = { ...this.items[index], ...targetItem };
    } else {
      this.items.push(targetItem);
    }
    this.onPersist();
  }

  public insert(item: any): void {
    if (!item) return;
    const existingIndex = this.items.findIndex((i) => i.id === item.id);
    if (existingIndex >= 0) {
      this.items[existingIndex] = item;
    } else {
      this.items.push(item);
    }
    this.onPersist();
  }

  public remove(id: string): void {
    const index = this.items.findIndex((i) => i.id === id);
    if (index >= 0) {
      this.items.splice(index, 1);
      this.onPersist();
    }
  }

  public toArray(): any[] {
    return this.items;
  }
}

class NoSqlDatabase {
  private inMemoryCollection: any[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.inMemoryCollection = parsed;
          }
        }
      } catch {}
    }
  }

  public getRecordsCollection(): RecordsCollection {
    return new RecordsCollection(this.inMemoryCollection, () => this.persist());
  }

  public setRecordsCollection(records: any[]) {
    this.inMemoryCollection = records;
  }

  public persist() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.inMemoryCollection));
      } catch {}
    }
  }
}

export const noSqlDatabase = new NoSqlDatabase();
