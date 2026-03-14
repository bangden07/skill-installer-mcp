# PRD MVP

## Title

Skill Installer MCP - MVP Tahap 1

## Ringkasan

Project ini adalah MCP server yang membantu vibecoder menemukan, merekomendasikan, dan meng-install agent skills lintas tools tanpa harus install satu per satu secara manual.

Tahap 1 fokus hanya pada skill installation. Registrasi MCP server ke host seperti Cursor, VS Code, atau Claude akan dikerjakan pada tahap berikutnya setelah fondasi skill installation stabil.

## Problem Statement

Saat ini user yang ingin memakai agent skills sering menghadapi beberapa masalah:

- skill tersebar di banyak source
- user tidak tahu skill mana yang paling cocok untuk project mereka
- format dan path instalasi berbeda antar agent
- proses install, update, sync, dan remove masih manual
- pengalaman lintas tool tidak konsisten

Akibatnya, user harus melakukan banyak setup manual dan sulit membangun workflow yang portable antar IDE, chat agent, dan CLI.

## Product Goal

Menyediakan satu MCP server yang dapat:

- menganalisis konteks project
- merekomendasikan skill yang relevan
- membuat dry-run install plan
- meng-install skill ke canonical store
- mendistribusikan skill ke agent yang didukung lewat adapter
- memverifikasi, menyinkronkan, menghapus, dan meng-update skill

## Target Users

- solo vibecoder yang memakai lebih dari satu coding agent
- developer yang berpindah antar IDE/CLI/chat agent
- tim kecil yang ingin standardisasi workflow skill di project
- user yang ingin setup cepat tanpa install skill satu per satu

## MVP Scope

Fitur yang masuk Tahap 1:

- skill discovery dari source yang didukung
- project analysis dasar
- recommendation rules-based
- dry-run install planning
- canonical skill installation
- per-agent adapter deployment
- verify
- sync
- update
- remove
- doctor
- MCP tool interface untuk operasi di atas

## Non-Goals

Fitur yang tidak masuk Tahap 1:

- registrasi MCP server ke host
- auto-edit host config seperti `mcp.json`, Cursor config, atau VS Code config
- OAuth flow untuk MCP host registration
- enterprise policy management
- auto-run scripts berbahaya dari dalam skill
- production-grade marketplace publishing
- advanced cloud sync

## Canonical Product Decisions

- format inti skill mengikuti Agent Skills ecosystem
- canonical project store: `.agents/skills/`
- canonical global store: `~/.agents/skills/`
- runtime state project: `.skill-installer/state/`
- runtime state global: `~/.config/skill-installer/state/`
- arsitektur memakai `canonical core + per-agent adapters`
- source of truth planning disimpan di folder `planning/`

## Supported Agents for MVP

Target agent Tahap 1:

- Cursor
- OpenCode
- Codex
- Claude Code
- Windsurf
- Amp

## Value Proposition

User cukup meminta agent untuk membantu meng-install skill yang cocok untuk project-nya, lalu MCP akan:

- memilih skill relevan
- menunjukkan install plan
- memasang ke lokasi yang sesuai
- menjaga state agar bisa disinkronkan dan di-update

Tujuannya adalah mengurangi friction setup dan membuat skill usage lebih portable antar agent.

## Core User Flows

### Flow 1 - Recommendation
User meminta skill yang cocok untuk project tertentu.

Contoh:
- "Install skill yang cocok untuk project web profesional"
- "Cari skill yang cocok untuk workflow React + Tailwind + design polish"

Sistem:
- membaca konteks project
- memilih kandidat skill
- memberi rekomendasi + alasan + compatibility info

### Flow 2 - Dry Run
User meminta rencana install sebelum apply.

Sistem:
- menampilkan canonical install target
- menampilkan target per agent
- menampilkan mode install: direct / symlink / copy
- menampilkan warning compatibility jika ada

### Flow 3 - Install
User menjalankan install.

Sistem:
- fetch skill source
- install/update canonical store
- apply ke target agent via adapter
- verify hasil
- update manifest

### Flow 4 - Maintenance
User meminta:
- list installed skills
- sync
- update
- remove
- doctor

Sistem menggunakan manifest + filesystem untuk menjaga integritas install.

## Functional Requirements

Sistem harus bisa:

- mendeteksi project context dasar
- menerima skill selector dari user atau recommendation engine
- resolve source skill dari local, git, dan `skills.sh`
- meng-install skill ke canonical store
- meng-deploy skill ke agent target
- melakukan verify hasil install
- menyimpan runtime manifest
- melakukan sync jika target rusak
- melakukan remove target dan optional purge canonical
- melakukan update dari source yang sudah terlacak
- menampilkan compatibility/warning yang jelas

## Non-Functional Requirements

Sistem harus:

- idempotent untuk operasi install
- aman terhadap partial failure
- mendukung Windows, macOS, Linux
- menangani fallback symlink ke copy
- menggunakan atomic write untuk store penting
- punya error code yang konsisten
- tidak menjadikan adapter target sebagai source of truth

## Success Metrics

MVP dianggap berhasil jika:

- user bisa install skill berguna dalam waktu singkat
- install berhasil stabil di 6 agent awal
- dry-run sesuai dengan hasil apply aktual
- broken target bisa diperbaiki dengan `sync`
- compatibility warning cukup jelas
- recommendation dasar terasa relevan untuk beberapa use case umum

## Risks

Risiko utama:

- symlink bermasalah di Windows
- perbedaan behavior real agent vs dokumentasi
- source registry berubah
- skill metadata kurang rapi
- drift antara manifest dan filesystem

Mitigasi detail ada di `planning/risks.md`.

## Future Direction

Tahap 2 setelah MVP stabil:

- MCP host registration
- host adapter layer
- rollback config
- approval-aware registration
- integrasi lebih dalam dengan tool-specific config

## Current Status

Status saat ini:
- scope MVP sudah dikunci
- arsitektur dasar sudah ditentukan
- support matrix awal sudah dirumuskan
- planning akan dipakai sebagai source of truth sebelum coding
