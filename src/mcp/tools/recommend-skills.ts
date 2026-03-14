import { toErrorItem } from "../../domain/errors.js";
import { RecommendSkillsInputSchema } from "../../schema/tools.js";
import { buildExecutionContext } from "../../installer/core/helpers.js";
import { recommendSkills } from "../../recommender/recommend-skills.js";

export async function handleRecommendSkills(rawInput?: unknown) {
  try {
    const input = RecommendSkillsInputSchema.parse(rawInput ?? {});
    const ctx = buildExecutionContext({
      workspacePath: input.workspacePath,
    });

    const result = await recommendSkills(
      {
        goal: input.goal,
        workspacePath: input.workspacePath,
        agents: input.agents,
        topK: input.topK,
        includeInstalled: input.includeInstalled,
        sources: input.sources,
        useRerank: input.useRerank,
      },
      ctx,
    );

    return {
      status: "success" as const,
      data: {
        goal: result.goal,
        analyzedContext: result.analyzedContext,
        recommendations: result.recommendations,
      },
    };
  } catch (error) {
    return {
      status: "error" as const,
      error: toErrorItem(error, "UNKNOWN_ERROR", "Failed to recommend skills."),
    };
  }
}
