# skill-installer-mcp

MCP server for universal cross-agent skill installation. Discover, recommend, install, sync, update, and manage agent skills across Cursor, Claude Code, OpenCode, Codex, Windsurf, and Amp.

## Why

Agent skills are scattered across many sources, install paths differ per tool, and there's no unified way to manage them. `skill-installer-mcp` solves this by providing a single MCP server that:

- Analyzes your project context (languages, frameworks, signals)
- Recommends relevant skills with reasons and compatibility info
- Creates dry-run install plans before making changes
- Installs skills to a canonical store, then distributes to your agents via adapters
- Maintains state for sync, update, and removal

Ask your agent to install the right skills for your project and the server handles the rest.

## Quick Start

### Run with npx (no install)

```bash
npx skill-installer-mcp
```

### Install globally

```bash
npm install -g skill-installer-mcp
skill-installer-mcp
```

### MCP Configuration

Add to your agent's MCP config:

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "skill-installer": {
      "command": "npx",
      "args": ["skill-installer-mcp"]
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "skill-installer": {
      "command": "npx",
      "args": ["skill-installer-mcp"]
    }
  }
}
```

**OpenCode** (`opencode.json`):
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

### Optional: OpenRouter Reranking

For AI-powered reranking of skill recommendations, set the `OPENROUTER_API_KEY` environment variable:

```bash
OPENROUTER_API_KEY=sk-or-... npx skill-installer-mcp
```

Or add it to your MCP config:
```json
{
  "mcpServers": {
    "skill-installer": {
      "command": "npx",
      "args": ["skill-installer-mcp"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-..."
      }
    }
  }
}
```

## Tools

The server exposes 10 MCP tools:

### `analyze_project`

Analyze project context to detect languages, frameworks, and signals.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `workspacePath` | string | no | Project root path (defaults to cwd) |
| `includeAgents` | boolean | no | Detect installed agents |
| `includeFiles` | boolean | no | Include manifest file list |

### `recommend_skills`

Get skill recommendations based on project analysis and a stated goal.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `goal` | string | **yes** | What you want to accomplish |
| `workspacePath` | string | no | Project root path |
| `agents` | AgentId[] | no | Filter to specific agents |
| `topK` | integer | no | Max results (1-20) |
| `includeInstalled` | boolean | no | Include already-installed skills |
| `sources` | string[] | no | Filter sources: `skills.sh`, `git`, `local` |
| `useRerank` | boolean | no | Use OpenRouter AI reranking |

### `plan_skill_install`

Create a dry-run install plan without making any changes.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `skills` | SkillSelector[] | **yes** | Skills to plan (see selector syntax) |
| `workspacePath` | string | no | Project root path |
| `agents` | AgentId[] | no | Target agents |
| `scope` | string | no | `project` or `global` |
| `mode` | string | no | `auto`, `symlink`, or `copy` |
| `allowCopyFallback` | boolean | no | Fall back to copy if symlink fails |

Returns: plan fingerprint, canonical actions, per-agent target actions, summary.

### `install_skills`

Install skills to canonical store and deploy to target agents.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `skills` | SkillSelector[] | **yes** | Skills to install |
| `workspacePath` | string | no | Project root path |
| `agents` | AgentId[] | no | Target agents |
| `scope` | string | no | `project` or `global` |
| `mode` | string | no | `auto`, `symlink`, or `copy` |
| `allowCopyFallback` | boolean | no | Fall back to copy if symlink fails |
| `expectedPlanFingerprint` | string | no | Validate against a prior plan |

### `list_installed_skills`

List skills currently installed in the canonical store and their agent targets.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `workspacePath` | string | no | Project root path |
| `scope` | string | no | `project`, `global`, or `all` |
| `agents` | AgentId[] | no | Filter to specific agents |
| `includeBroken` | boolean | no | Include broken targets |

### `sync_skills`

Verify and repair skill targets across agents.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `skills` | string[] | no | Skill names to sync (all if omitted) |
| `workspacePath` | string | no | Project root path |
| `scope` | string | no | `project`, `global`, or `all` |
| `agents` | AgentId[] | no | Filter to specific agents |
| `repairBroken` | boolean | no | Auto-repair broken targets |

### `update_skills`

Update tracked skills from their original sources.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `skills` | string[] | no | Skill names to update (all if omitted) |
| `workspacePath` | string | no | Project root path |
| `scope` | string | no | `project`, `global`, or `all` |
| `agents` | AgentId[] | no | Filter to specific agents |
| `reapplyTargets` | boolean | no | Re-deploy to agent targets after update |

### `remove_skills`

Remove skills from agent targets and optionally from canonical store.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `skills` | string[] | **yes** | Skill names to remove |
| `workspacePath` | string | no | Project root path |
| `scope` | string | no | `project`, `global`, or `all` |
| `agents` | AgentId[] | no | Filter to specific agents |
| `purgeCanonical` | boolean | no | Also remove from canonical store |

### `doctor_skills`

Diagnose issues with installed skills and suggest fixes.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `workspacePath` | string | no | Project root path |
| `scope` | string | no | `project`, `global`, or `all` |
| `agents` | AgentId[] | no | Filter to specific agents |
| `deep` | boolean | no | Run deep validation checks |

### `list_supported_agents`

List all supported agents and their capabilities.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `includeDetection` | boolean | no | Include detection info |

## Supported Agents

| Agent | ID | Project Scope | Global Scope | Symlink | Copy | Direct | Allowed Tools |
|---|---|---|---|---|---|---|---|
| Cursor | `cursor` | yes | yes | yes | yes | yes | yes |
| Claude Code | `claude-code` | yes | yes | yes | yes | no | yes |
| OpenCode | `opencode` | yes | yes | yes | yes | yes | no |
| Codex | `codex` | yes | yes | yes | yes | yes | no |
| Windsurf | `windsurf` | yes | yes | yes | yes | yes | no |
| Amp | `amp` | yes | yes | yes | yes | yes | no |

All agents are tier-a and support both project and global skill scopes.

## Skill Selector Syntax

Skills are referenced using selectors that resolve to one of three source types:

| Pattern | Example | Source |
|---|---|---|
| Local path | `./my-skills/typescript` | local |
| Git URL | `https://github.com/owner/repo.git` | git |
| Git URL with ref | `https://github.com/owner/repo.git#main` | git |
| skills.sh prefix | `skills.sh:owner/repo` | skills.sh |
| 2-segment slash | `owner/repo` | skills.sh |
| 3-segment slash | `owner/repo/skill` | skills.sh |

Examples:
```
# Install from skills.sh
anthropics/skills/frontend-design
vercel-labs/skills/find-skills

# Install from git
https://github.com/myorg/my-skill.git

# Install from local directory
./local-skills/my-custom-skill
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  MCP Layer                       │
│        (tools, Zod validation, routing)          │
├──────────┬──────────┬──────────┬────────────────┤
│ Installer│ Analyzer │Recommender│   Registry     │
│  Core    │          │           │                │
├──────────┴──────────┴──────────┴────────────────┤
│              Adapter Layer                       │
│  cursor │ claude │ opencode │ codex │ wind │ amp │
├─────────────────────────────────────────────────┤
│         Canonical Store + State                  │
│    (.agents/skills/ + .skill-installer/state/)   │
└─────────────────────────────────────────────────┘
```

**Canonical First** -- all skills are installed to a canonical store (`.agents/skills/`) before being deployed to individual agents via adapters.

**Install Modes:**
- `direct` -- agent reads the canonical path directly (no copy or link needed)
- `symlink` -- symlink from agent's native path to canonical directory
- `copy` -- full copy to agent's native path (fallback when symlink unavailable)

**Storage Paths:**
| Location | Project | Global |
|---|---|---|
| Canonical skills | `.agents/skills/` | `~/.agents/skills/` |
| Runtime state | `.skill-installer/state/` | `~/.config/skill-installer/state/` |

## Recommendation Engine

The built-in rules engine includes 31 rules covering:

- **Languages:** TypeScript, Python, Go, Rust, Java, Ruby, PHP, C#, Elixir
- **Frontend:** React, Next.js, Vue, Svelte, Angular, Astro
- **Backend:** API development, GraphQL
- **Quality:** Testing, E2E testing, code quality, performance, accessibility, security
- **DevOps:** Docker, CI/CD, deployment
- **Patterns:** Monorepo, AI/ML, MCP development, Tailwind, documentation

Rules match against project context (detected languages, frameworks, signals, project kinds) and the user's stated goal. Optional OpenRouter reranking uses AI to improve result relevance.

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests (150+ tests)
pnpm test

# Type check
pnpm typecheck

# Run dev server
pnpm dev

# Smoke tests
pnpm smoke:local
pnpm smoke:remote
```

### Project Structure

```
src/
├── domain/          # Types, errors
├── config/          # Path configuration
├── schema/          # Zod schemas, JSON schema conversion
├── utils/           # FS, hash, platform utilities
├── skill-parser/    # SKILL.md parsing and validation
├── state/           # Canonical store, manifest, plan, lock
├── adapters/agents/ # Per-agent adapters (cursor, claude-code, etc.)
├── registry/        # Skill resolution (local, git, skills.sh)
├── installer/core/  # Plan, install, sync, update, remove, doctor
├── project-analyzer/# Framework, signal, agent detection
├── recommender/     # Rules engine, recommendations, reranker
├── mcp/             # MCP server, tool registration, handlers
└── scripts/         # Smoke test scripts
```

## Requirements

- Node.js >= 20.0.0

## License

MIT
