# Decisions

Dokumen ini mencatat keputusan arsitektur dan produk yang sudah dikunci untuk Tahap 1.

## Status Legend

- `Accepted` - sudah diputuskan dan dipakai
- `Proposed` - masih usulan
- `Deprecated` - sudah tidak dipakai

---

## DEC-001 - Fokus Tahap 1 hanya pada skill installation

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Tahap 1 hanya fokus pada:
- discovery
- recommendation
- dry-run
- install
- verify
- sync
- update
- remove
- doctor

Tahap 1 belum mencakup:
- MCP host registration
- host config automation
- OAuth setup
- rollback config host

### Rationale
Skill installation adalah value tercepat dengan kompleksitas yang masih terkendali.
Jika langsung menggabungkan host registration, debugging akan jauh lebih sulit karena problem bisa datang dari banyak layer sekaligus.

### Impact
- scope MVP lebih realistis
- delivery lebih cepat
- fondasi Tahap 2 bisa dibangun di atas core yang stabil

---

## DEC-002 - Canonical store menggunakan `.agents/skills`

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Canonical source of truth untuk isi skill adalah:
- project: `.agents/skills/`
- global: `~/.agents/skills/`

### Rationale
Path ini paling portable untuk cross-agent compatibility dan paling cocok dijadikan shared canonical layer.

### Impact
- adapter target tidak menjadi source of truth
- update dan sync lebih mudah
- mempermudah ekspansi lintas agent

---

## DEC-003 - Runtime state dipisah dari canonical content

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Isi skill disimpan di canonical store.
Runtime state installer disimpan terpisah di:
- project: `.skill-installer/state/`
- global: `~/.config/skill-installer/state/`

### Rationale
Memisahkan content dan runtime metadata membuat maintenance lebih aman dan lebih bersih.

### Impact
- manifest tidak mengotori folder skill
- `doctor`, `sync`, dan `update` lebih mudah
- migrasi state lebih aman

---

## DEC-004 - Arsitektur memakai `canonical core + per-agent adapters`

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Sistem dibangun dengan:
- canonical core
- agent adapter registry
- installer orchestration
- MCP wrapper

### Rationale
Perbedaan utama antar tool ada di deployment target dan capability, bukan di authoring format skill.

### Impact
- adapter jadi tipis
- behavior install lebih konsisten
- penambahan agent baru lebih mudah

---

## DEC-005 - `BaseAgentAdapter` memegang shared behavior

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
`BaseAgentAdapter` menangani:
- mode resolution
- apply install
- verify
- sync
- remove

Adapter konkret hanya menangani:
- `detect`
- `getCapabilities`
- `resolveNativeTarget`

### Rationale
Mayoritas logic adapter sebenarnya shared.
Yang berbeda hanya path dan capability.

### Impact
- code duplication berkurang
- testing lebih fokus
- behavior antar adapter lebih seragam

---

## DEC-006 - Install mode default adalah `auto`

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Mode user-facing:
- `auto`
- `symlink`
- `copy`

Resolver internal dapat menghasilkan:
- `direct`
- `symlink`
- `copy`

Mode `auto` diprioritaskan sebagai default.

### Rationale
User tidak perlu tahu detail implementasi target agent.
System yang memilih mode terbaik.

### Impact
- UX lebih sederhana
- fallback lebih mudah
- installer lebih fleksibel

---

## DEC-007 - Fallback dari symlink ke copy wajib tersedia

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Jika symlink tidak didukung atau gagal dipakai, installer boleh fallback ke `copy` dengan warning yang jelas.

### Rationale
Ini penting terutama untuk Windows dan environment yang membatasi symlink.

### Impact
- compatibility lebih luas
- install success rate lebih tinggi
- perlu status/warning yang transparan

---

## DEC-008 - Project scope mengutamakan canonical direct access jika didukung

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Untuk agent yang mendukung `.agents/skills`, project scope akan memakai `direct` daripada membuat terlalu banyak native export.

### Rationale
Ini menjaga project scope tetap simpel dan minim side effects.

### Impact
- lebih sedikit target deployment
- lebih sedikit drift
- Claude Code jadi pengecualian yang tetap memakai native export

---

## DEC-009 - Global scope boleh memakai native export melalui adapter

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Untuk global scope, adapter boleh membuat target native path per agent melalui `symlink` atau `copy`.

### Rationale
Behavior global antar agent lebih heterogen daripada project scope, sehingga native export lebih aman untuk reliability.

### Impact
- global support lebih kuat
- manifest harus melacak target native global
- adapter global behavior jadi lebih penting

---

## DEC-010 - `GitHub Projects` dan `Notion` bukan source of truth awal

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Planning awal disimpan di folder `planning/` di workspace, bukan di GitHub Projects atau Notion.

### Rationale
Mengurangi setup overhead, lebih portable lintas IDE/agent, dan semua konteks tetap lokal di workspace.

### Impact
- planning lebih fleksibel
- mudah dipakai lintas tool
- nanti bisa dimigrasi ke tool eksternal jika diperlukan

---

## DEC-011 - Planning file names memakai English, isi memakai Bahasa Indonesia

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Nama file planning tetap English, isi dokumen menggunakan Bahasa Indonesia dengan istilah teknis tetap English.

### Rationale
Lebih nyaman untuk owner project, tetap natural untuk coding agents.

### Impact
- dokumentasi konsisten
- mudah dibaca manusia dan agent

---

## DEC-012 - Recommendation engine memakai hybrid approach

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Recommendation memakai:
- rules-based matching
- metadata matching
- optional OpenRouter reranking

### Rationale
AI-only matching kurang stabil dan lebih mahal.
Hybrid approach lebih praktis untuk MVP.

### Impact
- recommendation tetap berguna walau tanpa OpenRouter API
- OpenRouter bisa jadi enhancement, bukan dependency wajib

---

## DEC-013 - `mcp.json` di dalam skill dipreserve, tapi tidak diaktifkan otomatis

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Jika skill memiliki `mcp.json`, file itu tetap dipertahankan di canonical skill, tetapi Tahap 1 tidak akan melakukan auto-registration ke host.

### Rationale
Tahap 1 fokus ke skill installation, bukan host registration.

### Impact
- kompatibilitas skill tetap terjaga
- scope MVP tetap aman
- Tahap 2 bisa memanfaatkan file yang sama

---

## DEC-014 - `doctor_skills` hanya diagnosis, bukan auto-fix

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
`doctor_skills` hanya membaca dan melaporkan masalah. Perbaikan dilakukan oleh `sync_skills`, `remove_skills`, atau `update_skills`.

### Rationale
Memisahkan diagnosis dan mutation membuat behavior tool lebih jelas dan aman.

### Impact
- tool contract lebih bersih
- debugging lebih mudah
- side effects lebih terkendali

---

## DEC-015 - MCP server menggunakan `@modelcontextprotocol/sdk`

- Status: `accepted`
- Date: 2026-03-15

### Context
MCP server awalnya hanya berupa placeholder bootstrap yang mencetak daftar tools ke stdout. Untuk production readiness, server harus berkomunikasi melalui JSON-RPC over stdio sesuai MCP protocol specification.

### Decision
Menggunakan `@modelcontextprotocol/sdk` (v1.27.1) dengan `McpServer` class dan `StdioServerTransport`. Semua 10 tools didaftarkan via `server.tool()` dengan Zod schema shapes dari `src/schema/tools.ts`. Handler results dibungkus sebagai `CallToolResult` dengan `content: [{ type: "text", text: JSON.stringify(result) }]`.

### Rationale
- official SDK dari MCP specification team
- handles JSON-RPC framing, capability negotiation, dan tool schema exposure otomatis
- Zod schemas yang sudah ada bisa langsung dipakai sebagai input schema

### Impact
- server sekarang bisa dipakai langsung sebagai MCP server oleh host seperti Cursor, Claude Desktop, dll.
- `@modelcontextprotocol/sdk` menjadi runtime dependency

---

## DEC-016 - Reranker menggunakan OpenRouter (bukan Groq)

- Status: `accepted`
- Date: 2026-03-15

### Context
Planning awal menyebutkan Groq sebagai LLM provider untuk reranker. Setelah evaluasi, OpenRouter dipilih karena menyediakan akses ke banyak model melalui satu API, memberi fleksibilitas lebih.

### Decision
Reranker menggunakan OpenRouter Chat Completion API (`/v1/chat/completions`). API key dibaca dari env var `OPENROUTER_API_KEY`. Default model: `openai/gpt-4o-mini`. Model bisa dioverride via `OPENROUTER_MODEL` env var. Reranker aktif jika `useRerank: true` pada input `recommend_skills`.

### Rationale
- satu API key untuk akses banyak model (GPT-4o-mini, Claude, Gemini, dll.)
- user bisa pilih model sesuai budget dan kebutuhan
- fallback behavior: jika tidak ada API key atau API gagal, rules-based ranking tetap digunakan
- tidak ada vendor lock-in ke satu LLM provider

### Impact
- env var berubah dari `GROQ_API_KEY` ke `OPENROUTER_API_KEY`
- schema field berubah dari `useGroqRerank` ke `useRerank`
- file berubah dari `groq-reranker.ts` ke `openrouter-reranker.ts`

---

## DEC-017 - Multi-skill repo resolution untuk skills.sh

- Status: `accepted`
- Date: 2026-03-15

### Context
Banyak skill di ekosistem skills.sh disimpan dalam multi-skill repos (contoh: `anthropics/skills`, `obra/superpowers`, `vercel-labs/skills`). Skill tidak berada di root repo, tapi di subdirektori `skills/{skill-name}/SKILL.md`. CLI resmi `npx skills` menangani ini dengan cloning repo lalu scanning. Kita perlu solusi yang bekerja tanpa clone.

### Decision
Implementasi `resolveSkillPrefix()` — fungsi multi-candidate probe yang mencari lokasi aktual skill di repo GitHub via API:

1. Coba `{skillPath}/SKILL.md` (direct path)
2. Coba `skills/{skillPath}/SKILL.md` (pola paling umum)
3. Coba pattern lain: `.agents/skills/{skillPath}/`, `.claude/skills/{skillPath}/`, dll.
4. Fallback: scan repo tree via GitHub Trees API

Selector 3-segment `owner/repo/skill` sekarang diterima oleh resolver dan di-parse sebagai `{ owner, repo, skillPath }`. `detectDefaultBranchForSkill()` probe branch `main` dan `master` secara efisien.

### Rationale
- tidak perlu clone repo (lebih cepat, lebih ringan)
- kompatibel dengan semua layout repo yang diketahui di ekosistem skills.sh
- probe sequential lebih efisien daripada full tree scan untuk kasus umum
- fallback tree scan menangani layout non-standar

### Impact
- 3-segment selectors sekarang didukung (`anthropics/skills/frontend-design`)
- `parseSkillsShLocator` mengembalikan `{ owner, repo, skillPath? }` (breaking change internal)
- `fetchMetadataOnly` dan `fetchFullSkill` menggunakan `resolveSkillPrefix` sebelum fetch
- `fetchRepoTree` sekarang scoped ke resolved prefix

---

## Open Decisions

Belum final dan bisa diputuskan nanti:
- nama final produk
- apakah state store awal memakai JSON saja atau langsung SQLite
- apakah global native export untuk beberapa agent akan selalu dibuat atau optional

---

# Decisions Tahap 2

## DEC-018 - Host adapter layer terpisah dari skill adapter layer

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Host config management menggunakan layer adapter terpisah (`src/adapters/hosts/`) yang tidak mengganggu skill adapter (`src/adapters/agents/`).

### Rationale
Skill adapters menangani file content deployment. Host adapters menangani config file management. Kedua concern ini berbeda dan coupling-nya rendah. Memisahkan keduanya menjaga Tahap 1 tetap stabil saat Tahap 2 dibangun.

### Impact
- Tahap 1 tidak perlu dimodifikasi
- host adapter bisa dikembangkan paralel
- testing per layer lebih fokus

---

## DEC-019 - Backup wajib sebelum setiap config write

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Setiap operasi yang menulis config file agent WAJIB membuat backup terlebih dahulu. Backup disimpan di runtime state dir dan dirotasi (max 5 per agent per scope).

### Rationale
Config file agent adalah milik user. Kehilangan config bisa sangat disruptif. Backup murah (config files kecil) dan memberikan safety net yang kuat.

### Impact
- setiap write sedikit lebih lambat (backup + validate)
- disk usage minimal (config files < 10KB)
- rollback selalu tersedia

---

## DEC-020 - Config entry marking via manifest store, bukan inline field

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Untuk melacak MCP server mana yang didaftarkan oleh skill-installer, gunakan manifest store sebagai tracker, bukan inline field `_managedBy` di config file.

### Rationale
- beberapa agent mungkin reject unknown fields
- manifest store sudah tersedia dan proven
- tidak mengotori config user
- audit bisa cross-reference manifest dengan config

### Impact
- manifest store perlu schema update untuk host registrations
- audit perlu baca manifest + config file untuk matching
- jika manifest hilang, tracking hilang (acceptable risk)

---

## DEC-021 - JSONC handling diputuskan saat implementasi

- Status: `Proposed`
- Date: `2026-03-15`

### Decision
Pendekatan JSONC (untuk VS Code settings.json) belum final. Dua opsi:
1. Gunakan `jsonc-parser` package (Microsoft official)
2. Implementasi targeted edit (find key, insert/remove, tanpa full re-parse)

### Rationale
Keduanya punya trade-off. `jsonc-parser` lebih robust tapi menambah dependency. Targeted edit lebih ringan tapi lebih fragile.

### Impact
- decision ini bisa ditunda sampai VS Code host adapter mulai diimplementasi
- jika `jsonc-parser` dipilih, tambah ke dependencies

---

## DEC-022 - Tahap 2 hanya mendukung local stdio MCP servers

- Status: `Accepted`
- Date: `2026-03-15`

### Decision
Tahap 2 hanya mendaftarkan MCP server yang dijalankan secara lokal via stdio (`command` + `args`). Remote MCP servers (SSE, WebSocket) tidak didukung.

### Rationale
- majority use case MCP saat ini adalah local stdio
- remote server membutuhkan auth/networking handling yang kompleks
- scope manageable untuk Tahap 2

### Impact
- beberapa advanced use case belum terlayani
- bisa di-extend di Tahap 3 jika diperlukan
