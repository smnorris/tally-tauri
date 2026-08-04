use std::fs;
use std::path::PathBuf;
use tauri::Manager;

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
fn read_json(app: tauri::AppHandle, name: String) -> Result<String, String> {
    let path = data_dir(&app)?.join(format!("{name}.json"));
    if !path.exists() {
        return Ok("null".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_json(app: tauri::AppHandle, name: String, contents: String) -> Result<(), String> {
    let path = data_dir(&app)?.join(format!("{name}.json"));
    fs::write(&path, contents).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_json, write_json])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
