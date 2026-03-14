import path from "node:path";
import type { SkillFeatures } from "../domain/types.js";
import { listRelativeFiles } from "../utils/fs.js";

export async function detectSkillFeatures(
  skillDir: string,
): Promise<SkillFeatures> {
  const relativeFiles = await listRelativeFiles(skillDir);

  const normalized = relativeFiles.map((file) => file.split(path.sep).join("/"));

  const hasScripts = normalized.some(
    (file) => file === "scripts" || file.startsWith("scripts/"),
  );

  const hasReferences = normalized.some(
    (file) => file === "references" || file.startsWith("references/"),
  );

  const hasAssets = normalized.some(
    (file) => file === "assets" || file.startsWith("assets/"),
  );

  const hasMcpConfig = normalized.includes("mcp.json");

  return {
    hasScripts,
    hasReferences,
    hasAssets,
    hasMcpConfig,
    nonPortableFields: [],
  };
}
