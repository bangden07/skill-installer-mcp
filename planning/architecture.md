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
