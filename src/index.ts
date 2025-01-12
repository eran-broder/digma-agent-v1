import Anthropic from "@anthropic-ai/sdk";

export async function chat(apiKey: string, message: string): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  const response = await anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 1024,
    messages: [{ role: "user", content: message }],
  });

  if (response.content[0].type === "text") return response.content[0].text;
  throw new Error(`Unexpected response type ${response.content[0].type}`);
}

// Keep the hello function as a simple test
export function hello(name: string): string {
  return `Hello, ${name}!`;
}
