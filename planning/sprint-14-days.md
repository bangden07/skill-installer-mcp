# Sprint 14 Days

Sprint ini dirancang untuk menghasilkan MVP Tahap 1 yang fokus pada skill installation.

## Sprint Goal

Menyelesaikan MVP internal untuk:
- plan skill install
- install skill ke canonical store
- deploy ke target agents
- verify
- sync
- remove
- doctor
- expose via MCP tools

## Scope

In scope:
- canonical store
- manifest/runtime state
- 6 agent adapters
- installer core
- registry basic
- MCP tools
- testing dasar

Out of scope:
- MCP host registration
- host config automation
- enterprise features
- advanced security workflow
- full production hardening

## Day-by-Day Plan

## D01
Target:
- setup project skeleton
- setup MCP server skeleton
- setup folder structure

Deliverables:
- `src/index.ts`
- `src/mcp/server.ts`
- `src/config/paths.ts`
- base folder structure

Definition of done:
- project compile
- MCP bootstrap file ada
- struktur project stabil

## D02
Target:
- define domain types
- define shared errors
- define shared schemas

Deliverables:
- `src/domain/types.ts`
- `src/domain/errors.ts`
- `src/schema/common.ts`

Definition of done:
- type inti stabil
- error code dasar tersedia
- schema common tervalidasi

## D03
Target:
- implement tool schemas
- implement core utilities

Deliverables:
- `src/schema/tools.ts`
- `src/schema/json-schema.ts`
- `src/utils/fs.ts`
- `src/utils/hash.ts`
- `src/utils/platform.ts`
- `src/utils/time.ts`

Definition of done:
- semua tool schema sudah ada
- utility dasar siap dipakai layer lain

## D04
Target:
- implement skill parser
- implement validation
- implement feature detection

Deliverables:
- `src/skill-parser/parse-skill.ts`
- `src/skill-parser/validate-skill.ts`
- `src/skill-parser/feature-detect.ts`

Definition of done:
- valid skill bisa diparse
- invalid skill ditolak dengan jelas
- feature flags skill bisa dideteksi

## D05
Target:
- implement canonical store

Deliverables:
- `src/state/canonical-store.ts`

Definition of done:
- skill bisa di-install ke canonical path
- update pakai staging dir + atomic replace
- load/remove canonical skill jalan

## D06
Target:
- implement manifest and planning state

Deliverables:
- `src/state/manifest-store.ts`
- `src/state/plan-store.ts`
- `src/state/lock-store.ts`

Definition of done:
- manifest bisa load/save/upsert
- plan fingerprint bisa disimpan
- write lock tersedia

## D07
Target:
- implement `BaseAgentAdapter`

Deliverables:
- `src/adapters/agents/base.ts`
- `src/adapters/agents/_shared.ts`

Definition of done:
- mode resolution jalan
- apply/verify/sync/remove tersedia
- base test awal tersedia

## D08
Target:
- implement 3 adapter pertama

Deliverables:
- `src/adapters/agents/cursor.ts`
- `src/adapters/agents/opencode.ts`
- `src/adapters/agents/codex.ts`
- `src/adapters/agents/registry.ts`

Definition of done:
- Cursor, OpenCode, Codex bisa resolve/apply/verify
- test integration awal lulus

## D09
Target:
- implement 3 adapter berikutnya

Deliverables:
- `src/adapters/agents/claude-code.ts`
- `src/adapters/agents/windsurf.ts`
- `src/adapters/agents/amp.ts`

Definition of done:
- Claude Code, Windsurf, Amp bisa resolve/apply/verify
- `mcp.json` warning untuk Amp tersedia

## D10
Target:
- implement installer plan dan install flow

Deliverables:
- `src/installer/core/helpers.ts`
- `src/installer/core/plan-skill-install.ts`
- `src/installer/core/install-skills.ts`

Definition of done:
- `plan -> install -> verify -> manifest update` jalan end-to-end

## D11
Target:
- implement repair and diagnostics flow

Deliverables:
- `src/installer/core/sync-skills.ts`
- `src/installer/core/remove-skills.ts`
- `src/installer/core/doctor-skills.ts`

Definition of done:
- broken target bisa disync
- target bisa dihapus
- doctor bisa mendeteksi masalah utama

## D12
Target:
- implement update flow dan source basic

Deliverables:
- `src/installer/core/update-skills.ts`
- `src/registry/local-source.ts`
- `src/registry/git-source.ts`
- `src/registry/normalize.ts`
- `src/registry/resolver.ts`

Definition of done:
- local source jalan
- git source minimal jalan
- update canonical dan reapply target dasar jalan

## D13
Target:
- implement `skills.sh` source
- implement analyzer and recommendation basics

Deliverables:
- `src/registry/skills-sh.ts`
- `src/project-analyzer/analyze-project.ts`
- `src/project-analyzer/detect-frameworks.ts`
- `src/project-analyzer/detect-signals.ts`
- `src/project-analyzer/detect-agents.ts`
- `src/recommender/rules-engine.ts`
- `src/recommender/recommend-skills.ts`
- optional: `src/recommender/openrouter-reranker.ts`

Definition of done:
- recommendation rules-based sudah ada
- analyzer dasar jalan
- OpenRouter reranker optional di balik feature flag

## D14
Target:
- register MCP tools
- smoke test end-to-end
- rapikan docs inti

Deliverables:
- `src/mcp/register-tools.ts`
- `src/mcp/tools/*`
- smoke tests
- update planning docs

Definition of done:
- tool MCP utama bisa dipanggil
- minimal 1 flow project scope lulus
- minimal 1 flow global scope lulus
- support matrix dan limitation awal tercatat

## Priority Rules

Jika waktu mepet, prioritas tertinggi:
1. canonical store
2. manifest store
3. base adapter
4. first 3 adapters
5. `plan_skill_install`
6. `install_skills`
7. `doctor_skills`
8. `sync_skills`

Jika perlu dipotong, tunda:
- OpenRouter reranker
- analyzer yang lebih cerdas
- advanced registry caching
- extra polish docs

## End-of-Sprint Exit Criteria

MVP dianggap cukup berhasil jika:
- 6 adapter v1 sudah tersedia
- install canonical stabil
- `plan/install/sync/remove/doctor` tersedia
- tool MCP utama bisa dipakai
- ada smoke test untuk project dan global scope
- limitation dan support matrix terdokumentasi
