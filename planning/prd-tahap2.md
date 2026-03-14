# PRD Tahap 2 — Host Registration & Config Management

## Title

Skill Installer MCP - Tahap 2: Host Registration

## Ringkasan

Tahap 2 menambahkan kemampuan untuk mendaftarkan MCP server ke host agent secara otomatis. Setelah Tahap 1 menyelesaikan skill installation, user masih harus menambahkan MCP server ke config agent secara manual. Tahap 2 menghilangkan friction itu.

Selain host registration untuk server ini sendiri, Tahap 2 juga mengaktifkan bundled MCP config dari skill yang memiliki `mcp.json`.

## Problem Statement

Setelah skill ter-install, user masih menghadapi masalah:

- harus menambahkan `skill-installer-mcp` ke config agent secara manual
- config format berbeda antar agent (Cursor `mcp.json`, Claude Desktop `claude_desktop_config.json`, VS Code `settings.json`, dll.)
- jika skill memiliki `mcp.json` bawaan, server-server tambahan itu juga harus didaftarkan manual
- tidak ada mekanisme rollback jika config berubah dan menyebabkan masalah
- user tidak tahu apakah registrasi berhasil atau config valid

## Product Goal

Menyediakan tools tambahan di MCP server yang dapat:

- mendeteksi config file host agent yang tersedia
- membuat dry-run plan untuk perubahan config
- menerapkan perubahan config secara aman (dengan backup)
- memverifikasi registrasi berhasil
- melakukan rollback jika diperlukan
- mengaktifkan bundled MCP dari skill yang sudah ter-install

## Target Users

Sama dengan Tahap 1, ditambah:

- user yang ingin zero-friction onboarding MCP server
- user yang menggunakan skill dengan bundled MCP dependencies
- tim yang ingin standardisasi config MCP di seluruh project

## Tahap 2 Scope

Fitur yang masuk:

- host config discovery (detect config files per agent)
- host config planning (dry-run config changes)
- host config apply (write config with backup)
- host config verify (validate registration)
- host config rollback (undo last change)
- bundled MCP activation (register `mcp.json` dari skills)
- self-registration (register `skill-installer-mcp` sendiri)
- registry caching (reduce redundant API calls)

## Non-Goals Tahap 2

Fitur yang tidak masuk:

- OAuth flow untuk remote MCP hosts
- enterprise policy management
- multi-user config approval workflows
- advanced cloud sync
- marketplace publishing
- remote MCP server management (hanya local stdio servers)

## Supported Host Configs

| Agent | Config File | Config Format | Location |
|---|---|---|---|
| Cursor | `mcp.json` | JSON | `~/.cursor/mcp.json` (global) atau `.cursor/mcp.json` (project) |
| Claude Desktop | `claude_desktop_config.json` | JSON | platform-specific app data dir |
| VS Code (Copilot) | `settings.json` | JSONC | `.vscode/settings.json` (workspace) atau user settings |
| OpenCode | `opencode.json` | JSON | project root |
| Windsurf | `mcp_config.json` | JSON | `~/.codeium/windsurf/mcp_config.json` |
| Amp | `amp.json` / config dir | JSON | `~/.config/amp/` |

## Core User Flows

### Flow 1 - Self Registration
User meminta server mendaftarkan dirinya sendiri ke agent config.

Contoh:
- "Register skill-installer-mcp ke Cursor"
- "Setup MCP server ini di semua agent saya"

Sistem:
- deteksi config file agent
- buat plan perubahan config
- terapkan dengan backup
- verify registrasi

### Flow 2 - Bundled MCP Activation
Setelah install skill yang memiliki `mcp.json`, user meminta aktivasi.

Contoh:
- "Aktifkan MCP tools dari skill X"
- "Register semua bundled MCP dari installed skills"

Sistem:
- baca `mcp.json` dari skill yang ter-install
- resolve server command dan args
- buat plan config changes
- terapkan dengan backup

### Flow 3 - Config Rollback
Jika registrasi bermasalah, user bisa rollback.

Contoh:
- "Rollback config Cursor ke sebelumnya"
- "Undo last MCP config change"

Sistem:
- baca backup config terakhir
- restore file config
- verify restore

### Flow 4 - Config Audit
User ingin melihat status registrasi MCP di semua agent.

Contoh:
- "Cek status registrasi MCP saya"
- "List semua MCP servers yang terdaftar"

Sistem:
- baca config file per agent
- list registered servers
- tandai yang dari skill-installer vs external

## New MCP Tools (Tahap 2)

### `register_mcp_host`
Mendaftarkan MCP server ke config agent.

Input:
- `server` (object): `{ name, command, args[], env? }`
- `agents` (AgentId[], optional)
- `scope` ("project" | "global", optional)
- `dryRun` (boolean, optional)

Output:
- `planned[]`: daftar perubahan config yang akan dibuat
- `applied[]`: daftar perubahan yang berhasil diterapkan
- `backupPaths[]`: lokasi backup config
- `failed[]`: agent yang gagal

### `unregister_mcp_host`
Menghapus MCP server dari config agent.

Input:
- `serverName` (string)
- `agents` (AgentId[], optional)
- `scope` ("project" | "global", optional)

Output:
- `removed[]`: daftar registrasi yang dihapus
- `backupPaths[]`
- `failed[]`

### `activate_bundled_mcp`
Mengaktifkan bundled MCP config dari skill yang ter-install.

Input:
- `skills` (string[], optional): nama skill (all jika kosong)
- `agents` (AgentId[], optional)
- `scope` ("project" | "global", optional)
- `dryRun` (boolean, optional)

Output:
- `activated[]`: daftar server MCP yang didaftarkan
- `skipped[]`: skill tanpa mcp.json
- `backupPaths[]`
- `failed[]`

### `rollback_mcp_config`
Rollback config agent ke backup sebelumnya.

Input:
- `agents` (AgentId[], optional)
- `scope` ("project" | "global", optional)

Output:
- `restored[]`: daftar config yang di-restore
- `failed[]`

### `audit_mcp_config`
Audit status registrasi MCP di semua agent.

Input:
- `agents` (AgentId[], optional)
- `scope` ("project" | "global" | "all", optional)

Output:
- `configs[]`: daftar config file yang ditemukan
- `servers[]`: daftar MCP server terdaftar per agent
- `issues[]`: masalah yang ditemukan

## Functional Requirements

Sistem harus bisa:

- mendeteksi lokasi config file per agent/platform
- membaca dan parse config file (JSON, JSONC)
- membuat backup sebelum modifikasi
- menambahkan entry MCP server ke config
- menghapus entry MCP server dari config
- memvalidasi config setelah modifikasi
- melakukan rollback dari backup
- membaca `mcp.json` bundled di dalam skill
- menangani format config yang berbeda antar agent
- membedakan server yang didaftarkan installer vs manual

## Non-Functional Requirements

Sistem harus:

- selalu membuat backup sebelum write
- mendukung JSONC (JSON with Comments) untuk VS Code
- atomic write untuk config files
- tidak menghapus entry config yang bukan milik installer
- tidak mengubah formatting/comments di config file semaksimal mungkin
- menangani concurrent access ke config files
- idempotent untuk registrasi

## Architecture Impact

Tahap 2 menambahkan layer baru:

### Host Adapter Layer
Sejajar dengan skill adapter layer, tapi untuk config management:
- `src/adapters/hosts/base.ts` — shared config read/write/backup/rollback
- `src/adapters/hosts/cursor.ts`
- `src/adapters/hosts/claude-desktop.ts`
- `src/adapters/hosts/vscode.ts`
- `src/adapters/hosts/opencode-host.ts`
- `src/adapters/hosts/windsurf-host.ts`
- `src/adapters/hosts/amp-host.ts`

### Config State Layer
- `src/state/config-backup-store.ts` — track config backups

### New MCP Tool Handlers
- `src/mcp/tools/register-mcp-host.ts`
- `src/mcp/tools/unregister-mcp-host.ts`
- `src/mcp/tools/activate-bundled-mcp.ts`
- `src/mcp/tools/rollback-mcp-config.ts`
- `src/mcp/tools/audit-mcp-config.ts`

## Risks

Risiko tambahan Tahap 2:

- config format bisa berubah antar versi agent
- JSONC parsing dan preservation lebih kompleks daripada JSON biasa
- concurrent access ke config file dari multiple tools
- backup bisa menumpuk jika tidak di-manage
- user bisa kehilangan custom config jika write tidak hati-hati
- beberapa agent mungkin reload config hanya saat restart

Detail mitigasi di `planning/risks.md`.

## Success Metrics

Tahap 2 dianggap berhasil jika:

- user bisa mendaftarkan MCP server tanpa edit config manual
- bundled MCP dari skills bisa diaktifkan
- rollback berfungsi untuk semua agent yang didukung
- config audit memberikan gambaran jelas status registrasi
- tidak ada data loss pada config file user

## Timeline

Estimasi: 10-14 hari kerja setelah Tahap 1 stabil.

## Dependency on Tahap 1

Tahap 2 bergantung pada:
- adapter registry (reuse agent detection)
- manifest store (track bundled MCP state)
- domain types (reuse AgentId, Scope, error codes)
- MCP layer (add new tools ke existing server)

Karena skill adapter dan host adapter terpisah, Tahap 2 tidak membongkar fondasi Tahap 1.
