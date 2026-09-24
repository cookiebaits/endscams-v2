let inMemoryRecords: any[] = [];

export const noSqlDatabase = {
  getRecordsCollection() {
    return {
      find() {
        return inMemoryRecords;
      },
      findOne(predicate: (e: any) => boolean) {
        return inMemoryRecords.find(predicate);
      },
      insert(item: any) {
        inMemoryRecords.push(item);
        return item;
      },
      update(idOrPredicate: string | ((e: any) => boolean), updater: any) {
        let item: any;
        if (typeof idOrPredicate === 'function') {
          item = inMemoryRecords.find(idOrPredicate);
        } else {
          item = inMemoryRecords.find((r) => r.id === idOrPredicate || r.phone_digits === idOrPredicate || r.phone === idOrPredicate);
        }
        if (item) {
          const newData = typeof updater === 'function' ? updater(item) : updater;
          Object.assign(item, newData);
        }
        return item;
      },
      upsert(item: any) {
        const id = item.id || item.phone_digits;
        const idx = inMemoryRecords.findIndex((r) => r.id === id || r.phone_digits === id);
        if (idx >= 0) {
          inMemoryRecords[idx] = { ...inMemoryRecords[idx], ...item };
        } else {
          inMemoryRecords.push(item);
        }
        return item;
      },
    };
  },
  persist() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('esscan_threat_records_v2', JSON.stringify(inMemoryRecords));
      }
    } catch {}
  },
};
