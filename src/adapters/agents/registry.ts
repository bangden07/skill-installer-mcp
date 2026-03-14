import type { AgentId } from "../../domain/types.js";
import type { AgentAdapter } from "./base.js";
import { AmpAdapter } from "./amp.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { CodexAdapter } from "./codex.js";
import { CursorAdapter } from "./cursor.js";
import { OpenCodeAdapter } from "./opencode.js";
import { WindsurfAdapter } from "./windsurf.js";

export type AgentAdapterRegistry = Record<AgentId, AgentAdapter>;

export function createAdapterRegistry(): AgentAdapterRegistry {
  return {
    "claude-code": new ClaudeCodeAdapter(),
    cursor: new CursorAdapter(),
    opencode: new OpenCodeAdapter(),
    codex: new CodexAdapter(),
    windsurf: new WindsurfAdapter(),
    amp: new AmpAdapter(),
  };
}
