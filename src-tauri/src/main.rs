// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Manager is crucial for get_webview_window, AppHandle for commands.
use tauri::{AppHandle, Manager}; 
use std::{fs, path::PathBuf};
// Removed the PathExt import to fix E0432/E0433 errors.
use chrono::Utc; 
use log::error; 

// Structure for the data we will save
#[derive(serde::Serialize, serde::Deserialize)]
struct AuthData {
    user_id: String,
    auth_token: String,
    timestamp: i64, 
}

// Helper to get the path to our data file
fn get_auth_file_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {}", e))?;

    // Ensure the directory exists
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    Ok(app_dir.join("offline_auth.json")) // Our data file
}

// 1. COMMAND: Save the authentication data
#[tauri::command]
fn save_offline_auth(app_handle: AppHandle, user_id: String, auth_token: String) -> Result<(), String> {
    let file_path = get_auth_file_path(&app_handle)?;
    let data = AuthData {
        user_id,
        auth_token,
        timestamp: Utc::now().timestamp(), 
    };
    
    let json_data = serde_json::to_string(&data).map_err(|e| {
        error!("Failed to serialize data: {}", e);
        format!("Failed to serialize data: {}", e)
    })?;
    
    fs::write(file_path, json_data).map_err(|e| {
        error!("Failed to write file: {}", e);
        format!("Failed to write file: {}", e)
    })?;
    Ok(())
}

// 2. COMMAND: Load the authentication data
#[tauri::command]
fn load_offline_auth(app_handle: AppHandle) -> Result<AuthData, String> {
    let file_path = get_auth_file_path(&app_handle)?; // file_path is owned here

    if !file_path.exists() {
        return Err("No offline login data found.".to_string());
    }

    // FIX E0382: Pass a reference (&file_path) so ownership is not moved.
    let json_data = fs::read_to_string(&file_path).map_err(|e| {
        error!("Failed to read file: {}", e);
        format!("Failed to read file: {}", e)
    })?;
    let data: AuthData = serde_json::from_str(&json_data).map_err(|e| {
        error!("Failed to parse data: {}", e);
        format!("Failed to parse data: {}", e)
    })?;

    // Basic offline validity check (30 days limit)
    let thirty_days_in_seconds = 30 * 24 * 60 * 60;
    if Utc::now().timestamp() - data.timestamp > thirty_days_in_seconds {
        // Now file_path is still available because we only borrowed it above.
        if let Err(e) = fs::remove_file(&file_path) { 
            error!("Failed to remove expired offline token file: {}", e);
        }
        return Err("Offline token expired. Must log in online.".to_string());
    }

    Ok(data)
}


// --- GLOBAL FRONTEND CONSTANTS (Consolidated logic) ---
const APP_ID: &str = "inventoryplus-app-desktop-v1";
const FIREBASE_CONFIG_JSON: &str = r#"{
    "apiKey": "AIzaSyC0Umv5ZJwCaTjFp2yK6OiUeVve8RHqbz8",
    "authDomain": "inventoryplus-a2439.firebaseapp.com",
    "projectId": "inventoryplus-a2439",
    "storageBucket": "inventoryplus-a2439.firebasestorage.app",
    "messagingSenderId": "654840001369",
    "appId": "1:654840001369:web:21627f25806cc8a4059248"
}"#;
const INITIAL_AUTH_TOKEN: &str = ""; 
// ---------------------------------

fn main() {
    tauri::Builder::default()
        // Register FS Plugin and Log Plugin
        .plugin(tauri_plugin_fs::init())   
        .plugin(tauri_plugin_log::Builder::new().build()) 
        
        // Setup hook for injecting variables
        .setup(|app| {
            // get_webview_window is now correctly in scope.
            let window = app.get_webview_window("main").unwrap();
            
            // 1. Inject __app_id
            let app_id_script = format!("const __app_id = '{}';", APP_ID);
            window.eval(&app_id_script)?;

            // 2. Inject __firebase_config
            let firebase_config_script = format!("const __firebase_config = '{}';", FIREBASE_CONFIG_JSON.replace('\n', "").replace('\r', "").replace('\'', "\\'"));
            window.eval(&firebase_config_script)?;

            // 3. Inject __initial_auth_token
            let auth_token_script = format!("const __initial_auth_token = '{}';", INITIAL_AUTH_TOKEN);
            window.eval(&auth_token_script)?;
            
            println!("Tauri Setup: Injected global configuration variables successfully.");
            
            Ok(())
        })
        
        // Register the command handlers
        .invoke_handler(tauri::generate_handler![save_offline_auth, load_offline_auth])
        
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}