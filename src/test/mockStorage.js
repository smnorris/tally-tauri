import { vi } from "vitest";

let store = {};

export function resetMockStorage() {
  store = {};
}

// Mirrors the public contract of ../storage.js (readTable/writeTable/readRaw)
// but backed by an in-memory object instead of Tauri's invoke(). JSON
// round-tripping catches accidental non-serializable values, same as the
// real file-backed storage would.

export const readTable = vi.fn(async (name) => {
  return store[name] !== undefined ? JSON.parse(JSON.stringify(store[name])) : [];
});

export const readRaw = vi.fn(async (name) => {
  return store[name] !== undefined ? JSON.parse(JSON.stringify(store[name])) : null;
});

export const writeTable = vi.fn(async (name, value) => {
  store[name] = JSON.parse(JSON.stringify(value));
});
