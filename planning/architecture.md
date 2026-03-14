# Architecture

## Overview

Arsitektur project ini memakai pola:

- `canonical core + per-agent adapters`

Artinya:
- semua skill disimpan dalam satu canonical format dan canonical location
- adapter hanya bertugas mengekspos skill itu ke target agent
- MCP layer hanya menjadi interface, bukan pusat business logic

## Core Principles

### Canonical First
Semua skill harus masuk ke canonical store dulu sebelum dipasang ke target agent.

Canonical store:
- project: `.agents/skills/`
- global: `~/.agents/skills/`

### Adapter as Deployment Layer
Adapter bukan source of truth. Adapter hanya:
- menentukan target path
- menentukan install mode
- apply
- verify
- sync
- remove

### Runtime State Separate from Content
Isi skill disimpan di canonical store.
Runtime state disimpan terpisah agar maintenance lebih aman.

Runtime state:
- project: `.skill-installer/state/`
- global: `~/.config/skill-installer/state/`

### MCP as Orchestration Interface
MCP tools hanya membungkus core service.
Business logic utama harus hidup di layer installer/recommender/analyzer.

## High-Level Architecture

### 1. Registry Layer
Tugas:
- menerima selector skill
- resolve source skill dari:
  - local path
  - git source
  - `skills.sh`
- fetch metadata atau full skill content

Module:
- `src/registry/local-source.ts`
- `src/registry/git-source.ts`
- `src/registry/skills-sh.ts`
- `src/registry/normalize.ts`
- `src/registry/resolver.ts`

### 2. Skill Parser Layer
Tugas:
- parse `SKILL.md`
- validasi frontmatter
- validasi struktur skill
- deteksi feature bundle

Module:
- `src/skill-parser/parse-skill.ts`
- `src/skill-parser/validate-skill.ts`
- `src/skill-parser/feature-detect.ts`

### 3. Canonical Store Layer
Tugas:
- menentukan canonical path
- install/update skill via staging dir
- menghitung hash skill
- load installed skill record
- remove canonical skill

Module:
- `src/state/canonical-store.ts`

### 4. Runtime State Layer
Tugas:
- menyimpan manifest skill install
- menyimpan target agent deployment state
- menyimpan plan fingerprint
- lock operasi write

Module:
- `src/state/manifest-store.ts`
- `src/state/plan-store.ts`
- `src/state/lock-store.ts`

### 5. Adapter Layer
Tugas:
- deteksi target agent
- expose capability
- resolve target path
- apply install
- verify
- sync
- remove

Module:
- `src/adapters/agents/base.ts`
- `src/adapters/agents/*.ts`

### 6. Installer Core Layer
Tugas:
- orchestrate plan
- install canonical
- apply adapters
- verify result
- update state
- sync/update/remove/doctor

Module:
- `src/installer/core/*.ts`

### 7. Project Analyzer Layer
Tugas:
- membaca sinyal project
- deteksi framework dan language
- deteksi agent yang tersedia

Module:
- `src/project-analyzer/*.ts`

### 8. Recommendation Layer
Tugas:
- memilih skill kandidat
- rules-based ranking
- optional OpenRouter reranking

Module:
- `src/recommender/*.ts`

### 9. MCP Layer
Tugas:
- menerima request dari host MCP
- parse input dengan Zod
- panggil core service
- kembalikan output sesuai schema

Module:
- `src/mcp/*.ts`

## Runtime Directories

### Project Scope
- canonical skills: `.agents/skills/`
- runtime state: `.skill-installer/state/`
- plan cache: `.skill-installer/state/plans/`
- locks: `.skill-installer/locks/`

### Global Scope
- canonical skills: `~/.agents/skills/`
- runtime state: `~/.config/skill-installer/state/`
- plan cache: `~/.config/skill-installer/state/plans/`
- locks: `~/.config/skill-installer/locks/`

## Main Data Models

### SkillRecord
Representasi internal skill yang sudah diparse dan siap di-install.

Fields utama:
- `name`
- `manifest`
- `source`
- `canonicalDir`
- `canonicalSkillFile`
- `contentHash`
- `features`

### ManifestDocument
Runtime index untuk skill yang terlacak.

Berisi:
- metadata manifest
- daftar skill
- canonical hash/path
- target entries
- status target
- timestamps

### AgentCapabilities
Menjelaskan kemampuan adapter target.

Fields penting:
- `supportsProjectScope`
- `supportsGlobalScope`
- `supportsDirect`
- `supportsSymlink`
- `supportsCopy`
- `supportsBundledMcpConfig`
- `requiresExtraConfig`

## Canonical Store Design

Canonical store adalah source of truth isi skill.

Rules:
- install harus lewat `staging -> atomic rename`
- update harus berbasis hash comparison
- load harus membaca dari filesystem actual
- remove canonical hanya dilakukan jika explicit purge

Keuntungan:
- adapter target tidak perlu jadi sumber isi skill
- update dan repair lebih mudah
- integrity checking lebih sederhana

## Manifest Store Design

Manifest store adalah source of truth runtime relationship.

Rules:
- simpan path portable
- project path relatif ke workspace root
- global path gunakan `~/...` jika memungkinkan
- write harus atomic
- migration mechanism harus ada sejak awal

Manifest tidak boleh dipakai sebagai pengganti filesystem validation.

## Adapter Architecture

### Base Adapter
`BaseAgentAdapter` memegang shared behavior:
- resolve mode
- apply install
- verify install
- sync broken target
- remove target

### Concrete Adapters
Adapter konkret hanya mengurus:
- `detect`
- `getCapabilities`
- `resolveNativeTarget`

Target agent MVP:
- Cursor
- OpenCode
- Codex
- Claude Code
- Windsurf
- Amp

## Install Modes

### direct
Dipakai jika target agent bisa membaca canonical path langsung.

### symlink
Dipakai jika agent butuh path native tapi environment mendukung symlink.

### copy
Dipakai jika:
- user force `copy`
- symlink tidak layak
- fallback diperlukan

## Core Flows

### Plan Flow
1. resolve skill selector
2. fetch metadata
3. parse skill
4. pilih agents
5. minta tiap adapter membuat plan
6. simpan plan fingerprint

### Install Flow
1. acquire lock
2. validate expected plan
3. fetch full skill
4. install/update canonical store
5. apply adapter target
6. verify target
7. persist manifest
8. release lock

### Sync Flow
1. baca manifest
2. load canonical skill
3. verify target
4. repair jika rusak
5. update manifest status

### Update Flow
1. baca tracked source
2. fetch latest skill
3. compare hash/revision
4. update canonical
5. reapply targets
6. update manifest

### Remove Flow
1. baca manifest
2. remove target adapter
3. update manifest
4. optional purge canonical

### Doctor Flow
1. audit canonical existence
2. audit target status
3. audit manifest mismatch
4. hasilkan issue list + suggested action

## Error Handling Strategy

- gunakan typed error code
- target failure tidak otomatis rollback canonical pada MVP
- hasil operasi write boleh `partial`
- setiap target error harus dikembalikan dengan:
  - `skillName`
  - `agentId`
  - `code`
  - `message`

## Security Position for MVP

Tahap 1 belum fokus ke advanced security automation, tetapi baseline rules tetap ada:

- validasi `SKILL.md`
- simpan source provenance
- tandai skill yang memiliki `scripts/`
- preserve `mcp.json` tapi jangan auto-register host
- jangan jalankan bundled script otomatis

## Why This Architecture

Arsitektur ini dipilih karena:

- portable lintas agent
- memisahkan content dari runtime state
- mudah diextend ke Tahap 2
- cocok untuk MCP-based orchestration
- meminimalkan coupling ke tool tertentu

## Phase 2 Readiness

Tahap 2 akan menambahkan:
- host adapter layer
- MCP host registration
- host config planning/apply/verify/rollback

Karena `skill adapters` dan `host adapters` dipisah, Tahap 2 bisa ditambahkan tanpa membongkar fondasi Tahap 1.

---

# Architecture Tahap 2 — Host Registration

## Overview

Tahap 2 menambahkan **Host Adapter Layer** yang sejajar dengan Skill Adapter Layer. Host adapters bertanggung jawab atas config file management per agent, bukan isi skill.

```
┌─────────────────────────────────────────────────────────┐
│                      MCP Layer                          │
│  (10 skill tools + 5 host tools, Zod, routing)          │
├────────────┬──────────┬──────────┬──────────────────────┤
│  Installer │ Installer│ Analyzer │   Registry           │
│  Core      │ Host     │          │   (+ cache)          │
├────────────┴──────────┴──────────┴──────────────────────┤
│         Skill Adapter Layer (Tahap 1)                    │
│  cursor │ claude │ opencode │ codex │ windsurf │ amp     │
├─────────────────────────────────────────────────────────┤
│         Host Adapter Layer (Tahap 2)                     │
│  cursor │ claude-desktop │ vscode │ opencode │ wind │amp │
├─────────────────────────────────────────────────────────┤
│      Canonical Store + State + Config Backup Store       │
└─────────────────────────────────────────────────────────┘
```

## New Architecture Layers (Tahap 2)

### 10. Host Adapter Layer
Tugas:
- mendeteksi config file host agent
- membaca dan parse config
- membuat backup sebelum write
- menambahkan/menghapus entry MCP server
- memvalidasi config setelah write
- melakukan rollback dari backup

Module:
- `src/adapters/hosts/base.ts`
- `src/adapters/hosts/cursor.ts`
- `src/adapters/hosts/claude-desktop.ts`
- `src/adapters/hosts/vscode.ts`
- `src/adapters/hosts/opencode-host.ts`
- `src/adapters/hosts/windsurf-host.ts`
- `src/adapters/hosts/amp-host.ts`
- `src/adapters/hosts/registry.ts`

### 11. Config Backup Store
Tugas:
- menyimpan backup config sebelum modifikasi
- melacak backup history per agent
- mendukung rollback ke backup terakhir
- rotasi backup lama

Module:
- `src/state/config-backup-store.ts`

### 12. Host Registration Core
Tugas:
- orchestrate register/unregister flow
- menangani bundled MCP activation
- menangani rollback
- audit config status

Module:
- `src/installer/host/register-host.ts`
- `src/installer/host/unregister-host.ts`
- `src/installer/host/rollback-config.ts`
- `src/installer/host/activate-bundled-mcp.ts`

## Host Config Locations

### Per Agent

| Agent | Config File | Format | Project Location | Global Location |
|---|---|---|---|---|
| Cursor | `mcp.json` | JSON | `.cursor/mcp.json` | `~/.cursor/mcp.json` |
| Claude Desktop | `claude_desktop_config.json` | JSON | N/A | platform app data |
| VS Code | `settings.json` | JSONC | `.vscode/settings.json` | user settings dir |
| OpenCode | `opencode.json` | JSON | `./opencode.json` | N/A |
| Windsurf | `mcp_config.json` | JSON | N/A | `~/.codeium/windsurf/mcp_config.json` |
| Amp | config dir | JSON | N/A | `~/.config/amp/` |

### Platform-Specific Paths (Claude Desktop)

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

### Platform-Specific Paths (VS Code)

- macOS: `~/Library/Application Support/Code/User/settings.json`
- Windows: `%APPDATA%/Code/User/settings.json`
- Linux: `~/.config/Code/User/settings.json`

## Config Backup Strategy

Rules:
- backup WAJIB sebelum setiap write
- backup disimpan di runtime state dir: `.skill-installer/state/backups/`
- backup file name: `{agent}-{scope}-{timestamp}.json`
- max backup per agent: 5 (configurable)
- rollback selalu menggunakan backup terbaru
- backup juga menyimpan metadata: `{ agentId, scope, timestamp, reason }`

Backup dir:
- project: `.skill-installer/state/backups/`
- global: `~/.config/skill-installer/state/backups/`

## Host Registration Flow

### Register Flow
1. detect config file location
2. read current config
3. create backup
4. merge new MCP server entry
5. write config atomically
6. validate written config
7. return result + backup path

### Unregister Flow
1. read current config
2. create backup
3. remove MCP server entry
4. write config atomically
5. validate written config

### Rollback Flow
1. read latest backup for agent/scope
2. validate backup integrity
3. create backup of current (pre-rollback)
4. restore from backup
5. validate restored config

### Audit Flow
1. iterate all agents
2. detect config files
3. parse each config
4. list registered MCP servers
5. flag servers managed by skill-installer
6. report issues (missing files, invalid format, etc.)

## JSONC Handling

VS Code `settings.json` uses JSONC (JSON with Comments). Requirements:
- parse JSONC correctly (strip comments for data, preserve for write)
- preserve existing comments when modifying
- preserve indentation and formatting
- minimal diff on write

Options:
- use `jsonc-parser` package (Microsoft's official parser)
- or implement minimal JSONC read/write utility

Decision: TBD (lihat `planning/decisions.md`)

## MCP Server Entry Format

### Standard format (Cursor, Claude Desktop, Windsurf)
```json
{
  "mcpServers": {
    "skill-installer": {
      "command": "npx",
      "args": ["skill-installer-mcp"],
      "env": {}
    }
  }
}
```

### OpenCode format
```json
{
  "mcp": {
    "skill-installer": {
      "command": "npx",
      "args": ["skill-installer-mcp"]
    }
  }
}
```

### VS Code format
```jsonc
{
  "mcp": {
    "servers": {
      "skill-installer": {
        "command": "npx",
        "args": ["skill-installer-mcp"]
      }
    }
  }
}
```

## Installer Marker

Untuk membedakan entry yang didaftarkan oleh skill-installer vs manual, tambahkan metadata:

```json
{
  "mcpServers": {
    "skill-installer": {
      "command": "npx",
      "args": ["skill-installer-mcp"],
      "_managedBy": "skill-installer-mcp"
    }
  }
}
```

Catatan: marker `_managedBy` mungkin tidak didukung semua agent. Jika agent reject unknown fields, gunakan tracking via manifest store saja.

## Error Codes (Tahap 2)

Kode error tambahan:
- `CONFIG_NOT_FOUND` — config file tidak ditemukan
- `CONFIG_PARSE_ERROR` — config file invalid
- `CONFIG_WRITE_ERROR` — gagal write config
- `BACKUP_FAILED` — gagal membuat backup
- `ROLLBACK_FAILED` — gagal rollback
- `SERVER_ALREADY_REGISTERED` — MCP server sudah terdaftar
- `SERVER_NOT_FOUND` — MCP server tidak ditemukan di config
- `BUNDLED_MCP_MISSING` — skill tidak memiliki mcp.json
