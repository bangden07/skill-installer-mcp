# Compatibility Matrix

Dokumen ini merangkum strategi compatibility Tahap 1 untuk agent yang didukung.

## Compatibility Strategy

Prinsip utama:
- canonical source of truth tetap di `.agents/skills`
- adapter target hanya deployment surface
- project scope mengutamakan direct canonical access jika agent mendukung
- global scope lebih sering memakai native path export melalui symlink
- copy dipakai sebagai fallback jika symlink tidak layak

## Canonical Paths

### Project
- `.agents/skills/<skill-name>/`

### Global
- `~/.agents/skills/<skill-name>/`

## Support Tier Summary

### Tier A
Target MVP utama:
- Cursor
- OpenCode
- Codex
- Claude Code
- Windsurf
- Amp

## Matrix

| Agent | Project Scope | Global Scope | Direct | Symlink | Copy | Native Path | Notes |
|---|---|---:|---:|---:|---:|---|---|
| Cursor | yes | yes | yes | yes | yes | `~/.cursor/skills/` | project scope pakai canonical direct |
| OpenCode | yes | yes | yes | yes | yes | `~/.config/opencode/skills/` | scan `.agents/skills` dan path compatible lain |
| Codex | yes | yes | yes | yes | yes | `~/.codex/skills/` | project repo discovery kuat di `.agents/skills` |
| Claude Code | yes | yes | no | yes | yes | `.claude/skills/`, `~/.claude/skills/` | native export lebih aman untuk reliability |
| Windsurf | yes | yes | yes | yes | yes | `~/.codeium/windsurf/skills/` | project direct, global native export |
| Amp | yes | yes | yes | yes | yes | `~/.config/agents/skills/` | preserve `mcp.json`, tapi belum register host |

## Adapter Strategy Per Agent

## Cursor
Project:
- pakai canonical direct:
  - `.agents/skills/<name>/`

Global:
- canonical tetap di `~/.agents/skills/<name>/`
- optional native export ke:
  - `~/.cursor/skills/<name>/`

Mode default:
- project: `direct`
- global: `symlink`

Verify strategy:
- project: canonical exists + `SKILL.md` valid
- global: target native valid jika dipasang

## OpenCode
Project:
- pakai canonical direct

Global:
- native export ke:
  - `~/.config/opencode/skills/<name>/`

Mode default:
- project: `direct`
- global: `symlink`

Verify strategy:
- project: canonical valid
- global: native target valid

Catatan:
- OpenCode mengenali `.agents/skills`
- frontmatter asing aman diabaikan

## Codex
Project:
- pakai canonical direct

Global:
- native export ke:
  - `~/.codex/skills/<name>/`

Mode default:
- project: `direct`
- global: `symlink`

Verify strategy:
- project: canonical valid
- global: native target valid jika dipasang

Catatan:
- repo discovery berjalan dari cwd sampai repo root

## Claude Code
Project:
- native export ke:
  - `.claude/skills/<name>/`

Global:
- native export ke:
  - `~/.claude/skills/<name>/`

Mode default:
- project: `symlink`
- global: `symlink`

Fallback:
- `copy`

Verify strategy:
- target `.claude/skills` ada
- `SKILL.md` valid
- symlink menunjuk ke canonical

Catatan:
- ini agent yang paling aman memakai native export untuk MVP

## Windsurf
Project:
- pakai canonical direct

Global:
- native export ke:
  - `~/.codeium/windsurf/skills/<name>/`

Mode default:
- project: `direct`
- global: `symlink`

Verify strategy:
- project: canonical valid
- global: native target valid

Catatan:
- Windsurf juga mendukung path native `.windsurf/skills`, tapi canonical direct dipilih untuk project scope MVP

## Amp
Project:
- pakai canonical direct

Global:
- native export ke:
  - `~/.config/agents/skills/<name>/`

Mode default:
- project: `direct`
- global: `symlink`

Verify strategy:
- project: canonical valid
- global: target native valid

Catatan:
- jika skill memiliki `mcp.json`, beri warning info
- Tahap 1 hanya preserve file, belum registrasi host

## Verify Rules V1

Verify minimum:
- folder target ada
- `SKILL.md` ada
- frontmatter `name` dan `description` valid
- jika mode `symlink`, link harus menunjuk ke canonical
- jika mode `copy`, isi target tidak boleh drift terlalu jauh dari canonical
- jika mode `direct`, canonical skill harus valid

## Fallback Rules

Mode resolution:
- `auto` -> `direct` jika didukung dan cocok
- jika direct tidak cocok -> `symlink`
- jika symlink tidak layak -> `copy`

Copy fallback wajib didukung untuk:
- Windows environment tertentu
- user tanpa symlink privilege
- runtime yang membatasi link creation

## Warning Codes

Warning/issue codes yang relevan untuk compatibility:

- `COPY_FALLBACK_USED`
- `BROKEN_SYMLINK`
- `TARGET_MISSING`
- `INVALID_SKILL_FILE`
- `NONPORTABLE_SKILL_FEATURE`
- `MANUAL_RUNTIME_VALIDATION_RECOMMENDED`
- `BUNDLED_MCP_PRESENT`

## Known Limitations

- dokumentasi agent bisa berubah
- behavior runtime bisa sedikit berbeda antar versi
- global path native tidak selalu wajib, tapi dipakai untuk reliability
- feature portability antar agent belum 100%
- bundled MCP tidak diaktifkan otomatis pada Tahap 1

## Current Recommendation

Urutan implementasi adapter:
1. Cursor
2. OpenCode
3. Codex
4. Claude Code
5. Windsurf
6. Amp

Alasan:
- 3 pertama paling lurus untuk direct canonical flow
- sisanya menutup variasi native export dan compatibility nuance
