import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createStaticTool } from "./tool.js";
import { zutils } from "./zodUtils.js";
import { ToolUseBlock } from "@anthropic-ai/sdk/resources/index.mjs";

export async function zeroShotRunner<T>(body: {
  apiKey: string;
  system: string;
  message: string;
  resultSchema: z.Schema<T>;
  model?: string;
  temperature?: number;
}): Promise<T> {
  const client = new Anthropic({ apiKey: body.apiKey });

  const tool = createStaticTool({
    name: "resultTool",
    argumentSchema: body.resultSchema,
    description: "Call this tool with the result",
    resultSchema: z.void(),
    execute: async (result) => {
      throw new Error("The result tool should not be called");
    },
  });

  const asAnthropicTool: Anthropic.Tool = {
    name: tool.name(),
    description: tool.description(),
    input_schema: zutils.zodToJson(
      tool.argumentSchema()
    ) as Anthropic.Tool["input_schema"],
  };

  const claudeParam: Anthropic.MessageCreateParamsNonStreaming = {
    tool_choice: {
      type: "tool",
      disable_parallel_tool_use: true,
      name: "resultTool",
    },
    tools: [asAnthropicTool],
    messages: [{ role: "user", content: body.message }],
    system: body.system,
    temperature: body.temperature ?? 0,
    model: body.model ?? "claude-3-5-sonnet-20241022",
    max_tokens: 8192,
  };

  const result = await client.messages.create(claudeParam);
  if (result.stop_reason !== "tool_use") {
    throw new Error("Tool use was not the stop reason");
  }
  if (result.content[0].type !== "tool_use") {
    throw new Error("Tool use was not the first message");
  }
  const asToolUse = result.content[0] as ToolUseBlock;
  const resultValue = body.resultSchema.parse(asToolUse.input);
  return resultValue;
}
