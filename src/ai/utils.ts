import { Draft, produce } from "immer";

export function omitKey<T extends object, K extends keyof T>(
  obj: T,
  key: K
): Omit<T, K> {
  return produce(obj, (draft: Draft<T>) => {
    delete (draft as any)[key];
  });
}

export function ensure<T>(value: T | undefined | null, message?: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Value for [${message}] is undefined or null`);
  }

  return value;
}
