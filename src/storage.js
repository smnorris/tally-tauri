import { invoke } from "@tauri-apps/api/core";

export async function readTable(name) {
  const raw = await invoke("read_json", { name });
  const parsed = JSON.parse(raw);
  return parsed === null ? [] : parsed;
}

// Unlike readTable, this does NOT collapse "file doesn't exist" (null) into [].
// Used where the caller needs to distinguish "never saved" from "saved as empty".
export async function readRaw(name) {
  const raw = await invoke("read_json", { name });
  return JSON.parse(raw);
}

export async function writeTable(name, value) {
  await invoke("write_json", { name, contents: JSON.stringify(value) });
}
