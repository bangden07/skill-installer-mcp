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

## Current Status

- **Tahap 1: COMPLETE** — skill installation MVP fully delivered
- **Tahap 2: PLANNING** — host registration & config management

## Planning Files

### Tahap 1 (Complete)
- `prd-mvp.md` - definisi scope MVP Tahap 1
- `architecture.md` - desain arsitektur (termasuk Tahap 2 extension)
- `compatibility-matrix.md` - support matrix per agent
- `backlog.md` - backlog Tahap 1 (all complete) + Tahap 2
- `sprint-14-days.md` - rencana eksekusi Tahap 1
- `decisions.md` - keputusan arsitektur (DEC-001 s/d DEC-022)
- `risks.md` - risiko dan mitigasi (RISK-001 s/d RISK-021)
- `daily/` - log harian pengerjaan
- `weekly/` - ringkasan mingguan sprint

### Tahap 2 (Planning)
- `prd-tahap2.md` - definisi scope Tahap 2: Host Registration
- `sprint-tahap2.md` - rencana eksekusi 10 hari
- backlog Tahap 2 ada di bagian bawah `backlog.md`
- risiko Tahap 2 ada di bagian bawah `risks.md`
- decisions Tahap 2 ada di bagian bawah `decisions.md`
- architecture Tahap 2 ada di bagian bawah `architecture.md`

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

Untuk Tahap 2:
1. `planning/prd-tahap2.md`
2. `planning/sprint-tahap2.md`
3. `planning/backlog.md` (bagian Tahap 2)
4. `planning/architecture.md` (bagian Tahap 2)
5. `planning/decisions.md` (DEC-018 s/d DEC-022)
