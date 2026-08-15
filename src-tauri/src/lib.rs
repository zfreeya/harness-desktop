use std::net::TcpStream;
use std::process::{Command, Stdio};
use std::time::Duration;

use tauri::Manager;

/// 用户提供的 DeepSeek API Key（构建时打入二进制；本地单机 .app 分发）
const DS_KEY: &str = "sk-0e97dc151b75440f8e08e5defb555b28";

fn port_open(port: u16) -> bool {
    let addr = format!("127.0.0.1:{port}");
    match addr.parse() {
        Ok(a) => TcpStream::connect_timeout(&a, Duration::from_millis(300)).is_ok(),
        Err(_) => false,
    }
}

/// 以孤儿进程方式拉起服务（App 退出后仍常驻，与 launchd 服务互斥检测端口避免重复启动）
fn spawn_service(node: &str, cwd: &str, args: &[&str], envs: &[(&str, &str)]) {
    let mut cmd = Command::new(node);
    cmd.args(args).current_dir(cwd).envs(envs.iter().copied());
    #[cfg(target_os = "macos")]
    {
        cmd.stdout(Stdio::null()).stderr(Stdio::null());
    }
    if let Ok(child) = cmd.spawn() {
        // 放弃句柄：子进程成为孤儿常驻，App 退出不影响服务
        drop(child);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let res = app.path().resource_dir()?;
            let support = app.path().app_data_dir()?;
            let logs = support.join("logs");
            std::fs::create_dir_all(&logs).ok();
            let home = std::env::var("HOME").unwrap_or_default();

            // 配置模板 → 用户目录实际配置（含 Key 与可写路径）
            let gw_tpl = std::fs::read_to_string(res.join("resources/config/tdai-gateway.tpl.yaml")).unwrap_or_default();
            let px_tpl = std::fs::read_to_string(res.join("resources/config/proxy-config.tpl.yaml")).unwrap_or_default();
            let gw = gw_tpl.replace("__HOME__", &home).replace("__DS_KEY__", DS_KEY);
            let px = px_tpl.replace("__HOME__", &home).replace("__DS_KEY__", DS_KEY);
            std::fs::write(support.join("tdai-gateway.yaml"), gw).ok();
            std::fs::write(support.join("proxy-config.yaml"), px).ok();

            let node = res.join("resources/node/bin/node");
            let core_dir = res.join("resources/memory-core");
            let proxy_dir = res.join("resources/memory-proxy");
            let gw_cfg = support.join("tdai-gateway.yaml").to_string_lossy().to_string();
            let px_cfg = support.join("proxy-config.yaml").to_string_lossy().to_string();

            // MemoryCore 网关 :8420
            if !port_open(8420) {
                if let (Some(n), Some(c)) = (node.to_str(), core_dir.to_str()) {
                    spawn_service(
                        n, c,
                        &["--import", "tsx", "src/gateway/server.ts"],
                        &[
                            ("TDAI_GATEWAY_CONFIG", gw_cfg.as_str()),
                            ("TDAI_GATEWAY_HOST", "127.0.0.1"),
                            ("TDAI_GATEWAY_PORT", "8420"),
                            ("TDAI_LLM_API_KEY", DS_KEY),
                        ],
                    );
                }
            }
            // MemoryProxy :8096（LLM 转发 + 记忆注入层）
            if !port_open(8096) {
                if let (Some(n), Some(p)) = (node.to_str(), proxy_dir.to_str()) {
                    spawn_service(n, p, &["--import", "tsx/esm", "src/index.ts", "--config", px_cfg.as_str()], &[]);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
