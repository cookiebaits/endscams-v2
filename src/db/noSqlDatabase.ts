// deno-lint-ignore-file no-explicit-any
export const noSqlDatabase = {
  getRecordsCollection() {
    return {
      findOne(_fn: (e: any) => boolean): any {
        return null;
      },
      insert(_record: any): void {},
      update(_id: string, _record: any): void {},
    };
  },
  persist(): void {},
};
