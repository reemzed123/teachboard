// בלי חלון שורת פקודה ב-Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    teachboard_lib::run()
}
