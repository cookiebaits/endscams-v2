/**
 * Built-in Lightweight Document NoSQL Database Engine
 *
 * Designed for zero-configuration, cross-platform portability.
 * Automatically bundles records directly within the codebase so that when
 * the code is exported (ZIP / Git), all threat data seamlessly transfers
 * to other websites, servers, or static deployments.
 */

import { ScamPhoneRecord } from '../types';
import databaseSeed from '../data/database_seed.json';

export interface NoSqlDocument {
  id?: string;
  [key: string]: any;
}

export type QueryFilter<T> = Partial<T> | ((doc: T) => boolean);

export class NoSqlCollection<T extends NoSqlDocument> {
  private name: string;
  private documents: Map<string, T> = new Map();
  private onMutate?: () => void;

  constructor(name: string, initialDocs: T[] = [], onMutate?: () => void) {
    this.name = name;
    this.onMutate = onMutate;
    for (const doc of initialDocs) {
      const key = doc.id || (doc as any)._id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      this.documents.set(key, { ...doc, id: key });
    }
  }

  public getName(): string {
    return this.name;
  }

  public getAll(): T[] {
    return Array.from(this.documents.values());
  }

  public count(filter?: QueryFilter<T>): number {
    if (!filter) return this.documents.size;
    return this.find(filter).length;
  }

  public find(filter?: QueryFilter<T>): T[] {
    const all = Array.from(this.documents.values());
    if (!filter) return all;

    if (typeof filter === 'function') {
      return all.filter(filter);
    }

    // Match exact properties
    return all.filter((doc) => {
      for (const [k, v] of Object.entries(filter)) {
        if (v !== undefined && (doc as any)[k] !== v) {
          return false;
        }
      }
      return true;
    });
  }

  public findOne(filter: QueryFilter<T>): T | null {
    const results = this.find(filter);
    return results.length > 0 ? results[0] : null;
  }

  public insertOne(doc: T): T {
    const key = doc.id || (doc as any)._id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newDoc = { ...doc, id: key };
    this.documents.set(key, newDoc);
    if (this.onMutate) this.onMutate();
    return newDoc;
  }

  public insert(doc: T): T {
    return this.insertOne(doc);
  }

  public insertMany(docs: T[]): T[] {
    const inserted: T[] = [];
    for (const doc of docs) {
      const key = doc.id || (doc as any)._id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const newDoc = { ...doc, id: key };
      this.documents.set(key, newDoc);
      inserted.push(newDoc);
    }
    if (this.onMutate) this.onMutate();
    return inserted;
  }

  public update(id: string, updates: Partial<T>): boolean {
    return this.updateOne((doc) => doc.id === id || (doc as any)._id === id, updates);
  }

  public updateOne(filter: QueryFilter<T>, updates: Partial<T>): boolean {
    const target = this.findOne(filter);
    if (!target) return false;

    const key = target.id || (target as any)._id;
    if (!key) return false;

    const updated = { ...target, ...updates, id: key };
    this.documents.set(key, updated);
    if (this.onMutate) this.onMutate();
    return true;
  }

  public upsert(doc: T, keyField: keyof T = 'id'): T {
    const targetKeyVal = doc[keyField];
    const existing = targetKeyVal ? this.findOne({ [keyField]: targetKeyVal } as any) : null;

    if (existing) {
      const key = existing.id || (existing as any)._id;
      const updated = { ...existing, ...doc, id: key };
      this.documents.set(key, updated);
      if (this.onMutate) this.onMutate();
      return updated;
    } else {
      return this.insertOne(doc);
    }
  }

  public deleteOne(filter: QueryFilter<T>): boolean {
    const target = this.findOne(filter);
    if (!target) return false;
    const key = target.id || (target as any)._id;
    if (!key) return false;
    const deleted = this.documents.delete(key);
    if (deleted && this.onMutate) this.onMutate();
    return deleted;
  }

  public deleteMany(filter: QueryFilter<T>): number {
    const targets = this.find(filter);
    let count = 0;
    for (const target of targets) {
      const key = target.id || (target as any)._id;
      if (key && this.documents.delete(key)) {
        count++;
      }
    }
    if (count > 0 && this.onMutate) this.onMutate();
    return count;
  }

  public clear(): void {
    this.documents.clear();
    if (this.onMutate) this.onMutate();
  }
}

export class BuiltinNoSqlDatabase {
  private collections: Map<string, NoSqlCollection<any>> = new Map();
  private storageKey = 'endscam_builtin_nosql_db_v1';
  private isBrowser: boolean;

  constructor() {
    this.isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    this.initDatabase();
  }

  private initDatabase() {
    let initialRecords: ScamPhoneRecord[] = [];

    // 1. Try to load from browser LocalStorage if available
    if (this.isBrowser) {
      try {
        const cached = window.localStorage.getItem(this.storageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.records) && parsed.records.length > 0) {
            initialRecords = parsed.records;
          }
        }
      } catch (err) {
        console.warn('[NoSql DB] Error reading local storage:', err);
      }
    }

    // 2. If empty, seed from the built-in database seed bundled in the source code
    if (initialRecords.length === 0 && Array.isArray(databaseSeed) && databaseSeed.length > 0) {
      initialRecords = databaseSeed as ScamPhoneRecord[];
    }

    // Deduplicate records by unique id and normalized phone digits
    const seenIds = new Set<string>();
    const seenPhones = new Set<string>();
    const cleanInitial: ScamPhoneRecord[] = [];
    for (const r of initialRecords) {
      const id = r.id;
      const cleanPhone = (r.cleanPhone || r.phone || '').replace(/\D/g, '');
      if ((id && seenIds.has(id)) || (cleanPhone && seenPhones.has(cleanPhone))) {
        continue;
      }
      if (id) seenIds.add(id);
      if (cleanPhone) seenPhones.add(cleanPhone);
      cleanInitial.push({
        ...r,
        cleanPhone: cleanPhone || r.cleanPhone,
      });
    }
    initialRecords = cleanInitial;

    // If loaded from browser LocalStorage, persist the cleaned version immediately to purge legacy duplicate keys
    if (this.isBrowser && initialRecords.length > 0) {
      try {
        window.localStorage.setItem(this.storageKey, JSON.stringify({ records: initialRecords }));
      } catch {}
    }

    // Initialize collections
    const recordsCol = new NoSqlCollection<ScamPhoneRecord>(
      'scam_records',
      initialRecords,
      () => this.persist()
    );
    this.collections.set('scam_records', recordsCol);

    const metaCol = new NoSqlCollection<any>(
      'metadata',
      [
        {
          id: 'db_info',
          engine: 'BuiltinNoSqlDocumentStore',
          version: '1.0.0',
          portable: true,
          bundledSeedCount: Array.isArray(databaseSeed) ? databaseSeed.length : 0,
          lastSync: new Date().toISOString(),
        },
      ],
      () => this.persist()
    );
    this.collections.set('metadata', metaCol);
  }

  public collection<T extends NoSqlDocument>(name: string): NoSqlCollection<T> {
    if (!this.collections.has(name)) {
      const newCol = new NoSqlCollection<T>(name, [], () => this.persist());
      this.collections.set(name, newCol);
    }
    return this.collections.get(name)! as NoSqlCollection<T>;
  }

  public getRecordsCollection(): NoSqlCollection<ScamPhoneRecord> {
    return this.collection<ScamPhoneRecord>('scam_records');
  }

  public persist(): void {
    if (this.isBrowser) {
      try {
        const dump = this.exportDump();
        window.localStorage.setItem(this.storageKey, JSON.stringify(dump));
      } catch (err) {
        console.warn('[NoSql DB] Failed to persist to localStorage:', err);
      }
    }
  }

  public exportDump(): {
    version: string;
    engine: string;
    exportedAt: string;
    records: ScamPhoneRecord[];
    metadata: any;
  } {
    const records = this.getRecordsCollection().getAll();
    const meta = this.collection('metadata').getAll();
    return {
      version: '1.0.0',
      engine: 'BuiltinNoSqlDocumentStore',
      exportedAt: new Date().toISOString(),
      records,
      metadata: meta,
    };
  }

  public importDump(dump: any): boolean {
    if (!dump || !Array.isArray(dump.records)) return false;
    const recordsCol = this.getRecordsCollection();
    recordsCol.clear();
    recordsCol.insertMany(dump.records);
    this.persist();
    return true;
  }

  public getStatus() {
    const recordsCol = this.getRecordsCollection();
    const totalDocs = recordsCol.count();
    const activeDocs = recordsCol.count((r) => !r.isNumberDown);
    const downDocs = recordsCol.count((r) => Boolean(r.isNumberDown));

    return {
      engine: 'Built-in NoSQL Document Store (Zero-Config Embedded)',
      version: '1.0.0',
      isPortable: true,
      codebaseSeedFile: 'src/data/database_seed.json',
      totalRecords: totalDocs,
      activeRecords: activeDocs,
      downRecords: downDocs,
      bundledSeedCount: Array.isArray(databaseSeed) ? databaseSeed.length : 0,
      storageType: this.isBrowser ? 'Browser LocalStorage + Bundled JSON' : 'Filesystem JSON + Codebase Seed',
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Export singleton instance for app-wide use
export const noSqlDatabase = new BuiltinNoSqlDatabase();
