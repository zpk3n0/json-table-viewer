export interface TableModel {
  columns: string[];
  rows: string[][];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringifyCell(value: unknown): string {
  if (value === undefined) {
    return '';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      Object.assign(result, flattenObject(value, path));
    } else if (Array.isArray(value) && value.every((item) => !isPlainObject(item) && !Array.isArray(item))) {
      result[path] = value.map(stringifyCell).join(', ');
    } else {
      result[path] = stringifyCell(value);
    }
  }
  return result;
}

function toModel(records: Record<string, string>[]): TableModel {
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  const rows = records.map((record) => columns.map((col) => record[col] ?? ''));
  return { columns, rows };
}

export function buildTable(data: unknown): TableModel {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { columns: [], rows: [] };
    }
    if (data.every((item) => isPlainObject(item))) {
      const records = (data as Record<string, unknown>[]).map((item) => flattenObject(item));
      return toModel(records);
    }
    return toModel(data.map((item) => ({ value: stringifyCell(item) })));
  }

  if (isPlainObject(data)) {
    const values = Object.values(data);
    const isRecordMap = values.length > 0 && values.every((v) => isPlainObject(v));
    if (isRecordMap) {
      const records = Object.entries(data).map(([key, value]) => ({
        key,
        ...flattenObject(value as Record<string, unknown>),
      }));
      return toModel(records);
    }
    return toModel([flattenObject(data)]);
  }

  return toModel([{ value: stringifyCell(data) }]);
}
