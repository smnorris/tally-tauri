import { invoke } from "@tauri-apps/api/core";

export async function readTable(name) {
  const raw = await invoke("read_json", { name });
  const parsed = JSON.parse(raw);
  return parsed === null ? [] : parsed;
}

export async function writeTable(name, value) {
  await invoke("write_json", { name, contents: JSON.stringify(value) });
}
