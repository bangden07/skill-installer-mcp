# Backlog

Backlog ini adalah daftar kerja utama untuk MVP Tahap 1.

Status:
- `[ ]` belum dikerjakan
- `[-]` sedang dikerjakan
- `[x]` selesai
- `[!]` blocked

Priority:
- `P0` wajib untuk MVP
- `P1` penting
- `P2` nice to have

## P0 - Foundation

- [x] Define domain types and shared error model
  - Area: domain
  - Files:
    - `src/domain/types.ts`
    - `src/domain/errors.ts`

- [x] Define path and runtime directory strategy
  - Area: config
  - Files:
    - `src/config/paths.ts`

- [x] Implement shared filesystem utilities
  - Area: utils
  - Files:
    - `src/utils/fs.ts`
    - `src/utils/hash.ts`
    - `src/utils/platform.ts`
    - `src/utils/time.ts`

- [x] Implement Zod schemas for common models
  - Area: schema
  - Files:
    - `src/schema/common.ts`

- [x] Implement Zod schemas for MCP tools
  - Area: schema
  - Files:
    - `src/schema/tools.ts`
    - `src/schema/json-schema.ts`

## P0 - Skill Parsing and State

- [x] Implement `SKILL.md` parser
  - Area: skill-parser
  - Files:
    - `src/skill-parser/parse-skill.ts`

- [x] Implement skill validation
  - Area: skill-parser
  - Files:
    - `src/skill-parser/validate-skill.ts`

- [x] Implement skill feature detection
  - Area: skill-parser
  - Files:
    - `src/skill-parser/feature-detect.ts`

- [x] Implement `CanonicalStore`
  - Area: state
  - Files:
    - `src/state/canonical-store.ts`

- [x] Implement `ManifestStore`
  - Area: state
  - Files:
    - `src/state/manifest-store.ts`

- [x] Implement `PlanStore` and `LockStore`
  - Area: state
  - Files:
    - `src/state/plan-store.ts`
    - `src/state/lock-store.ts`

## P0 - Adapters

- [x] Implement `BaseAgentAdapter`
  - Area: adapter
  - Files:
    - `src/adapters/agents/base.ts`
    - `src/adapters/agents/_shared.ts`

- [x] Add `CursorAdapter`
  - Area: adapter
  - Files:
    - `src/adapters/agents/cursor.ts`

- [x] Add `OpenCodeAdapter`
  - Area: adapter
  - Files:
    - `src/adapters/agents/opencode.ts`

- [x] Add `CodexAdapter`
  - Area: adapter
  - Files:
    - `src/adapters/agents/codex.ts`

- [x] Add `ClaudeCodeAdapter`
  - Area: adapter
  - Files:
    - `src/adapters/agents/claude-code.ts`

- [x] Add `WindsurfAdapter`
  - Area: adapter
  - Files:
    - `src/adapters/agents/windsurf.ts`

- [x] Add `AmpAdapter`
  - Area: adapter
  - Files:
    - `src/adapters/agents/amp.ts`

- [x] Add adapter registry
  - Area: adapter
  - Files:
    - `src/adapters/agents/registry.ts`

## P0 - Installer Core

- [x] Implement execution context and installer helpers
  - Area: installer
  - Files:
    - `src/installer/core/helpers.ts`

- [x] Implement `plan_skill_install`
  - Area: installer
  - Files:
    - `src/installer/core/plan-skill-install.ts`

- [x] Implement `install_skills`
  - Area: installer
  - Files:
    - `src/installer/core/install-skills.ts`

- [x] Implement `sync_skills`
  - Area: installer
  - Files:
    - `src/installer/core/sync-skills.ts`

- [x] Implement `remove_skills`
  - Area: installer
  - Files:
    - `src/installer/core/remove-skills.ts`

- [x] Implement `doctor_skills`
  - Area: installer
  - Files:
    - `src/installer/core/doctor-skills.ts`

## P1 - Registry and Update

- [x] Implement `update_skills`
  - Area: installer
  - Files:
    - `src/installer/core/update-skills.ts`

- [x] Implement local source resolver
  - Area: registry
  - Files:
    - `src/registry/local-source.ts`

- [x] Implement git source resolver
  - Area: registry
  - Files:
    - `src/registry/git-source.ts`

- [x] Implement `skills.sh` source resolver
  - Area: registry
  - Files:
    - `src/registry/skills-sh.ts`

- [x] Implement registry normalization and selector resolution
  - Area: registry
  - Files:
    - `src/registry/normalize.ts`
    - `src/registry/resolver.ts`

- [x] Add runtime bootstrap files for local build
  - Area: foundation
  - Files:
    - `package.json`
    - `tsconfig.json`
    - `.gitignore`

- [x] Add local smoke flow fixture and script
  - Area: validation
  - Files:
    - `fixtures/skills/hello-smoke-skill/`
    - `src/scripts/smoke-local-install.ts`

## P1 - Analyzer and Recommendation

- [x] Implement project analyzer
  - Area: analyzer
  - Files:
    - `src/project-analyzer/analyze-project.ts`
    - `src/project-analyzer/detect-frameworks.ts`
    - `src/project-analyzer/detect-signals.ts`
    - `src/project-analyzer/detect-agents.ts`

- [x] Implement rules-based recommender
  - Area: recommender
  - Files:
    - `src/recommender/rules-engine.ts`
    - `src/recommender/recommend-skills.ts`

## P2 - Optional Intelligence Layer

- [x] Implement OpenRouter reranker behind feature flag
  - Area: recommender
  - Files:
    - `src/recommender/openrouter-reranker.ts`

## P0 - MCP Tool Surface

- [x] Implement MCP server bootstrap
  - Area: mcp
  - Files:
    - `src/index.ts`
    - `src/mcp/server.ts`
    - `src/mcp/register-tools.ts`
  - Note: wired to `@modelcontextprotocol/sdk` with `McpServer` + `StdioServerTransport`

- [x] Add MCP tool handlers
  - Area: mcp
  - Files:
    - `src/mcp/tools/analyze-project.ts`
    - `src/mcp/tools/recommend-skills.ts`
    - `src/mcp/tools/plan-skill-install.ts`
    - `src/mcp/tools/install-skills.ts`
    - `src/mcp/tools/list-installed-skills.ts`
    - `src/mcp/tools/sync-skills.ts`
    - `src/mcp/tools/update-skills.ts`
    - `src/mcp/tools/remove-skills.ts`
    - `src/mcp/tools/doctor-skills.ts`
    - `src/mcp/tools/list-supported-agents.ts`

## P0 - Tests

- [x] Add initial end-to-end smoke flow for local install
  - Area: validation
  - Files:
    - `src/scripts/smoke-local-install.ts`

- [x] Add parser unit tests
  - Area: tests
  - Files:
    - `src/skill-parser/parse-skill.test.ts`

- [x] Add store unit tests
  - Area: tests
  - Files:
    - `src/state/manifest-store.test.ts`

- [x] Add `BaseAgentAdapter` unit tests
  - Area: tests
  - Files:
    - `src/adapters/agents/base.test.ts`

- [x] Add adapter integration tests
  - Area: tests
  - Files:
    - `src/adapters/agents/adapter-integration.test.ts`

- [x] Add installer flow integration tests
  - Area: tests
  - Files:
    - `src/installer/core/installer-flow.test.ts`

- [x] Add MCP tool handler tests
  - Area: tests
  - Files:
    - `src/mcp/tools/handlers.test.ts`

## P1 - Docs

- [x] Write `prd-mvp.md`
- [x] Write `architecture.md`
- [x] Write `compatibility-matrix.md`
- [x] Write `decisions.md`
- [x] Write `risks.md`

## Current Execution Order

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
