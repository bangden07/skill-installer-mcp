# Agent Workflow Guide

Dokumen ini adalah acuan utama untuk agent yang bekerja di workspace ini.

## Primary Rule

- Jangan mengarang arsitektur, scope, atau workflow baru.
- Selalu kembali ke folder `planning/` sebagai source of truth sebelum membuat perubahan penting.

## Planning Source Of Truth

Urutan referensi utama:

1. `planning/README.md`
2. `planning/prd-mvp.md`
3. `planning/architecture.md`
4. `planning/compatibility-matrix.md`
5. `planning/backlog.md`
6. `planning/sprint-14-days.md`
7. `planning/decisions.md`
8. `planning/risks.md`

Jika ada kebingungan, konflik, atau kekosongan informasi:
- jangan langsung berasumsi besar
- cek dulu file planning yang relevan
- pilih solusi paling konservatif dan konsisten dengan planning yang ada

## Current Product Scope

Project ini adalah MCP server untuk `skill installation` lintas agent.

Tahap 1 hanya mencakup:
- discovery
- recommendation
- dry-run planning
- install
- verify
- sync
- update
- remove
- doctor

Tahap 1 tidak mencakup:
- MCP host registration
- edit config host seperti Cursor/VS Code/Claude
- OAuth host setup
- enterprise policy workflow

## Current Technical Decisions

- package manager: `pnpm`
- language: `TypeScript`
- schema source of truth: `Zod`
- canonical project skill path: `.agents/skills/`
- canonical global skill path: `~/.agents/skills/`
- runtime project state: `.skill-installer/state/`
- runtime global state: `~/.config/skill-installer/state/`
- arsitektur: `canonical core + per-agent adapters`
- planning docs disimpan lokal di folder `planning/`

## Agent Working Rules

### Before Coding
- baca `planning/README.md`
- baca file planning yang relevan dengan task
- cocokkan task dengan `planning/backlog.md` dan `planning/sprint-14-days.md`

### During Coding
- jangan menambah scope Tahap 2
- jangan membuat struktur baru yang bertentangan dengan `planning/architecture.md`
- utamakan perubahan kecil, jelas, dan konsisten dengan module boundaries yang sudah direncanakan
- jangan memindahkan source of truth dari planning ke tempat lain

### If You Need To Deviate
Jika implementasi perlu menyimpang dari planning:
- pilih deviasi sekecil mungkin
- update dokumentasi yang relevan, minimal `planning/decisions.md`
- jika perubahan memengaruhi urutan kerja, update `planning/backlog.md`
- jika perubahan memengaruhi risiko, update `planning/risks.md`

### Daily Discipline
Jika pekerjaan hari itu cukup substansial:
- update `planning/daily/` untuk progres harian
- gunakan template yang ada jika perlu

## Implementation Priorities

Urutan eksekusi utama:

1. Foundation
2. Skill Parsing and State
3. Base Adapter
4. First 3 adapters: Cursor, OpenCode, Codex
5. Installer core: plan + install
6. Remaining adapters: Claude Code, Windsurf, Amp
7. Sync + remove + doctor
8. Registry
9. Analyzer + recommendation
10. MCP tools
11. Tests and docs

## Guardrails For Agents

- Jangan menghapus atau mengganti keputusan yang sudah dikunci tanpa alasan teknis yang jelas.
- Jangan memperkenalkan dependency besar baru tanpa kebutuhan nyata.
- Jangan membuat code path khusus host registration pada Tahap 1.
- Jangan menganggap semua agent memiliki behavior yang sama; cek `planning/compatibility-matrix.md`.
- Jangan menjadikan adapter target sebagai source of truth; canonical store tetap utama.

## When Unsure

Gunakan urutan ini:

1. cek planning
2. cek code yang sudah ada
3. pilih solusi paling sederhana yang sesuai planning
4. dokumentasikan perubahan penting

## Definition Of Good Change

Perubahan dianggap baik jika:
- sesuai scope Tahap 1
- konsisten dengan planning
- tidak menambah kompleksitas yang tidak perlu
- memperjelas fondasi untuk langkah berikutnya
- tidak membuat agent berikutnya kehilangan konteks
