# Planning Index

Folder `planning/` adalah source of truth internal untuk perencanaan project ini.

Sebelum agent mulai bekerja atau membuat perubahan penting, baca juga `AGENTS.md` sebagai guardrail workflow utama.

## Project Overview

Project ini adalah MCP server untuk membantu vibecoder menemukan, merekomendasikan, dan meng-install agent skills lintas tools secara lebih otomatis.

Fokus Tahap 1:
- skill discovery
- skill recommendation
- dry-run install plan
- skill installation
- verify
- sync
- update
- remove
- doctor

Di luar scope Tahap 1:
- registrasi MCP server ke host seperti Cursor, VS Code, Claude
- OAuth/config automation untuk host
- enterprise policy management

## Current Product Direction

Produk diposisikan sebagai:
- universal skill installer via MCP
- cross-agent skill adapter layer
- open-skill compatible system

Format inti skill:
- `SKILL.md`
- mengikuti Agent Skills ecosystem

Canonical source of truth:
- project: `.agents/skills/`
- global: `~/.agents/skills/`

Runtime state:
- project: `.skill-installer/state/`
- global: `~/.config/skill-installer/state/`

## MVP Targets

Target agent Tahap 1:
- Cursor
- OpenCode
- Codex
- Claude Code
- Windsurf
- Amp

## Planning Files

- `prd-mvp.md` - definisi scope MVP
- `architecture.md` - desain arsitektur modul, store, adapter, flow
- `compatibility-matrix.md` - support matrix per agent
- `backlog.md` - backlog implementasi per modul/file
- `sprint-14-days.md` - rencana eksekusi 14 hari
- `decisions.md` - keputusan arsitektur penting
- `risks.md` - risiko dan mitigasi
- `daily/` - log harian pengerjaan
- `weekly/` - ringkasan mingguan sprint

## Working Rules

- `planning/README.md` adalah index utama
- `AGENTS.md` adalah guardrail utama untuk workflow agent
- `planning/backlog.md` adalah daftar kerja utama
- `planning/sprint-14-days.md` adalah urutan eksekusi
- `planning/decisions.md` menyimpan keputusan penting
- task harian dicatat singkat di `planning/daily/`
- nama file pakai English
- isi dokumen pakai Bahasa Indonesia dengan istilah teknis tetap English

## Current Decisions

- fokus Tahap 1 hanya pada skill installation
- gunakan `canonical core + per-agent adapters`
- `GitHub Projects` dan `Notion` belum dijadikan source of truth utama
- semua planning sementara disimpan di folder `planning/`

## Next Immediate Files

1. `planning/backlog.md`
2. `planning/sprint-14-days.md`
3. `planning/prd-mvp.md`
4. `planning/architecture.md`
5. `planning/compatibility-matrix.md`
