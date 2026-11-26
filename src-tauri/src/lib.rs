// TeachBoard כתוכנת Windows: חלון שמציג את אותה תוכנה כמו בדפדפן (WebView2).
// הקוד כאן מינימלי בכוונה: הכול רץ בתוך החלון, והשיעורים נשמרים במחשב כמו בגרסת הדפדפן.
//
// יכולת נוספת אחת: פתיחת קובץ ‎.board בלחיצה כפולה ב-Windows.
// Windows מעביר את נתיב הקובץ בהפעלה; התוכנה קוראת רק אותו, ורק אם הוא קובץ ‎.board בגודל סביר.
// התוכן נבדק בתוך התוכנה בדיוק כמו קובץ שנפתח מהתפריט (לא מריצים שום קוד מקובץ).

use std::path::PathBuf;

/// גודל מקסימלי לקובץ שנפתח מ-Windows (כמו בגרסת הדפדפן)
const MAX_FILE_BYTES: u64 = 300 * 1024 * 1024;

struct LaunchFile(Option<PathBuf>);

fn launch_path() -> Option<PathBuf> {
    let arg = std::env::args_os().nth(1)?;
    let path = PathBuf::from(arg);
    let ext = path.extension()?.to_string_lossy().to_lowercase();
    if ext != "board" {
        return None;
    }
    let meta = std::fs::metadata(&path).ok()?;
    if !meta.is_file() || meta.len() > MAX_FILE_BYTES {
        return None;
    }
    Some(path)
}

/// שם הקובץ שאיתו הופעלה התוכנה (אם יש)
#[tauri::command]
fn launch_file_name(state: tauri::State<LaunchFile>) -> Option<String> {
    state
        .0
        .as_ref()
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().into_owned())
}

/// תוכן הקובץ שאיתו הופעלה התוכנה (בתים)
#[tauri::command]
fn launch_file_bytes(state: tauri::State<LaunchFile>) -> Result<tauri::ipc::Response, String> {
    let path = state.0.as_ref().ok_or("no file")?;
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(LaunchFile(launch_path()))
        .invoke_handler(tauri::generate_handler![launch_file_name, launch_file_bytes])
        .run(tauri::generate_context!())
        .expect("error while running TeachBoard");
}
