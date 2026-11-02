/**
 * @trpc-mcp/ai-sdk
 *
 * Turn a tRPC router into a Vercel AI SDK `ToolSet`. Every execute goes
 * through the tRPC caller, so middleware, auth, and validation behave
 * exactly as for human clients.
 */

export { toAiSdkTools } from "./to-ai-sdk-tools.js";
export type { AiSdkToolsOptions } from "./to-ai-sdk-tools.js";
