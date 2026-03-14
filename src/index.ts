import { createMcpServer } from "./mcp/server.js";

async function main(): Promise<void> {
  const server = createMcpServer();
  await server.start();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
