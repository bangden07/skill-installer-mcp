# Sprint Tahap 2 — Host Registration (10 Days)

Sprint ini dirancang untuk menghasilkan Tahap 2: Host Registration & Config Management.

## Sprint Goal

Menyelesaikan host registration layer agar:
- MCP server bisa didaftarkan ke agent config secara otomatis
- bundled MCP dari skills bisa diaktifkan
- config bisa di-rollback jika bermasalah
- audit config status tersedia

## Scope

In scope:
- host adapter layer (6 agents)
- config backup store
- register/unregister/rollback/audit tools
- bundled MCP activation
- JSONC support (VS Code)
- registry caching

Out of scope:
- remote MCP servers (SSE/WebSocket)
- OAuth flow
- enterprise policy
- multi-user approval

## Day-by-Day Plan

## D01
Target:
- define host config types dan schemas
- implement config backup store

Deliverables:
- `src/domain/host-types.ts`
- `src/schema/host-tools.ts`
- `src/state/config-backup-store.ts`

Definition of done:
- types stabil
- backup store bisa create/read/rotate backups
- unit tests awal

## D02
Target:
- implement `BaseHostAdapter`

Deliverables:
- `src/adapters/hosts/base.ts`

Definition of done:
- shared config read/write/backup/rollback jalan
- atomic write untuk config
- file locking via LockStore
- unit tests

## D03
Target:
- implement Cursor dan Claude Desktop host adapters

Deliverables:
- `src/adapters/hosts/cursor.ts`
- `src/adapters/hosts/claude-desktop.ts`

Definition of done:
- detect config file per platform
- read/parse config
- add/remove MCP server entry
- backup before write
- integration tests

## D04
Target:
- implement OpenCode dan Windsurf host adapters

Deliverables:
- `src/adapters/hosts/opencode-host.ts`
- `src/adapters/hosts/windsurf-host.ts`

Definition of done:
- detect dan manage config per agent
- integration tests

## D05
Target:
- implement JSONC utility
- implement VS Code host adapter

Deliverables:
- `src/utils/jsonc.ts`
- `src/adapters/hosts/vscode.ts`

Definition of done:
- JSONC parse/write preserves comments
- VS Code settings.json bisa dimodifikasi
- integration tests

## D06
Target:
- implement Amp host adapter
- implement host adapter registry

Deliverables:
- `src/adapters/hosts/amp-host.ts`
- `src/adapters/hosts/registry.ts`

Definition of done:
- semua 6 host adapters tersedia di registry
- integration tests mencakup semua adapters

## D07
Target:
- implement register dan unregister core logic

Deliverables:
- `src/installer/host/register-host.ts`
- `src/installer/host/unregister-host.ts`

Definition of done:
- register flow: detect -> read -> backup -> merge -> write -> validate
- unregister flow: read -> backup -> remove -> write -> validate
- dry-run support
- flow tests

## D08
Target:
- implement rollback dan audit core logic
- implement bundled MCP activation

Deliverables:
- `src/installer/host/rollback-config.ts`
- `src/installer/host/activate-bundled-mcp.ts`

Definition of done:
- rollback dari backup terbaru jalan
- audit cross-reference config files + manifest
- bundled MCP baca `mcp.json` dari installed skills
- flow tests

## D09
Target:
- register semua MCP tool handlers
- implement registry caching

Deliverables:
- `src/mcp/tools/register-mcp-host.ts`
- `src/mcp/tools/unregister-mcp-host.ts`
- `src/mcp/tools/rollback-mcp-config.ts`
- `src/mcp/tools/audit-mcp-config.ts`
- `src/mcp/tools/activate-bundled-mcp.ts`
- `src/registry/cache.ts`

Definition of done:
- 5 new MCP tools registered dan callable
- registry caching reduces duplicate API calls
- handler tests

## D10
Target:
- integration tests end-to-end
- smoke tests
- docs update
- final cleanup

Deliverables:
- `src/adapters/hosts/host-integration.test.ts`
- `src/installer/host/host-flow.test.ts`
- `src/mcp/tools/host-handlers.test.ts`
- update README.md with new tools
- update planning docs

Definition of done:
- semua tests pass
- smoke test register + unregister + rollback jalan
- README mencakup 15 tools (10 skill + 5 host)
- planning docs updated

## Priority Rules

Jika waktu mepet, prioritas tertinggi:
1. BaseHostAdapter + config backup
2. Cursor + Claude Desktop adapters (paling banyak dipakai)
3. register + unregister core
4. rollback
5. MCP tool handlers

Jika perlu dipotong, tunda:
- VS Code JSONC support (bisa pakai JSON saja dulu)
- Amp host adapter
- registry caching
- audit tool
- bundled MCP activation
- self-registration wizard

## End-of-Sprint Exit Criteria

Tahap 2 dianggap cukup berhasil jika:
- user bisa register MCP server ke minimal 3 agent tanpa edit config manual
- backup selalu tersedia sebelum config change
- rollback berfungsi
- audit memberikan gambaran status registrasi
- tidak ada data loss pada config file user
- smoke test register + unregister + rollback pass
