/**
 * Multi-agent Openlayer tracing example for the Claude Agent SDK (TypeScript).
 *
 * This script builds a richer agent than the basic example: a codebase
 * analyzer that orchestrates two subagents and an in-process MCP tool. It
 * exercises every step type the Openlayer wrapper captures so the resulting
 * trace contains:
 *
 *   - Root AGENT step "Claude Agent SDK query" with system_prompt,
 *     agent_config, agents_defined, options, model, cost, tokens, rawOutput.
 *   - Per-turn CHAT_COMPLETION steps with prompt/completion tokens, thinking
 *     blocks (if any), tool_calls list, and rawOutput (full assistant
 *     message JSON).
 *   - TOOL steps for each tool call:
 *       * mcp__file-stats__count_files — with mcp_server / mcp_tool_name
 *         metadata parsed from the mcp__server__tool naming convention.
 *       * Glob / Read — the built-in file tools.
 *       * Agent (twice) — one per subagent dispatch. Each Agent ToolStep
 *         contains the subagent's nested CHAT_COMPLETION and TOOL steps,
 *         correlated via parent_tool_use_id.
 *
 * Run with:
 *   ANTHROPIC_API_KEY=...  OPENLAYER_API_KEY=...  \
 *   OPENLAYER_INFERENCE_PIPELINE_ID=...  \
 *   npx tsx examples/tracing/claude-agent-sdk/claudeAgentSdkMultiAgent.ts
 */

// Drop-in import — same shape as @anthropic-ai/claude-agent-sdk's `query`,
// auto-traced.
import { query } from 'openlayer/lib/integrations/claudeAgentSdk';

// Helpers from the underlying SDK that aren't routed through Openlayer.
// These are pure factory functions (no I/O), so importing directly is fine.
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// 1. Define a custom MCP tool: count_files
//
// Exposes an in-process function as an MCP tool. In the trace it will show
// up as a TOOL step named `mcp__file-stats__count_files` with
// `metadata.mcp_server === "file-stats"` and `metadata.mcp_tool_name === "count_files"`.
// ---------------------------------------------------------------------------

const countFiles = tool(
  'count_files',
  'Count files in a directory grouped by extension',
  // Zod schema. The SDK uses zod-to-json-schema to produce the MCP tool
  // schema the model sees.
  { directory: z.string().describe('Absolute path to the directory to analyze') },
  async (args) => {
    const dir = path.resolve(args.directory);
    let stat;
    try {
      stat = await fs.stat(dir);
    } catch {
      return {
        content: [{ type: 'text', text: `No such directory: ${dir}` }],
        isError: true,
      };
    }
    if (!stat.isDirectory()) {
      return {
        content: [{ type: 'text', text: `Not a directory: ${dir}` }],
        isError: true,
      };
    }
    const counts = new Map<string, number>();
    async function walk(d: string): Promise<void> {
      const entries = await fs.readdir(d, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) await walk(p);
        else if (e.isFile()) {
          const ext = path.extname(e.name) || '(no ext)';
          counts.set(ext, (counts.get(ext) ?? 0) + 1);
        }
      }
    }
    await walk(dir);
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    const body = sorted.map(([ext, n]) => `${ext}: ${n}`).join('\n') || '(empty)';
    return { content: [{ type: 'text', text: body }] };
  },
);

const fileStatsServer = createSdkMcpServer({
  name: 'file-stats',
  version: '1.0.0',
  tools: [countFiles],
});

// ---------------------------------------------------------------------------
// 2. Define two subagents.
//
// Subagents are registered under the SDK's built-in `Agent` tool. When the
// main agent calls Agent(name="code-reviewer", ...), the SDK runs the
// subagent in its own context and the wrapper nests every message the
// subagent emits under the spawning Agent ToolStep via `parent_tool_use_id`.
// ---------------------------------------------------------------------------

const subagents = {
  'code-reviewer': {
    description: 'Briefly reviews a code file for clarity, correctness, and style.',
    prompt:
      'You are a senior code reviewer. The user will tell you which file to inspect. ' +
      'Read that file once, then return exactly one observation about its quality ' +
      '(strength or weakness). Be specific and concise — two sentences max.',
    tools: ['Read'],
    model: 'claude-haiku-4-5',
  },
  'summary-writer': {
    description: "Writes a one-paragraph summary of an agent's findings.",
    prompt:
      'You synthesize prior agent findings into a single one-paragraph summary ' +
      '(3-5 sentences). Be specific and concise; do not invent details that ' +
      "weren't reported.",
    tools: [],
    model: 'claude-haiku-4-5',
  },
};

// ---------------------------------------------------------------------------
// 3. Run it.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!process.env['ANTHROPIC_API_KEY']) {
    console.error('Set ANTHROPIC_API_KEY before running this example.');
    process.exit(1);
  }
  if (!process.env['OPENLAYER_INFERENCE_PIPELINE_ID']) {
    console.warn(
      'OPENLAYER_INFERENCE_PIPELINE_ID is not set — the trace will be built but not published.',
    );
  }

  // Point the agent at this repo's integrations directory. Change to any
  // directory you'd like to analyze.
  const targetDir = path.resolve(__dirname, '../../../src/lib/integrations');

  const prompt = `Analyze the directory at: ${targetDir}

Follow this plan exactly:

1. Call the count_files tool with that directory to get a file-extension breakdown.
2. Use Glob to list .ts files under the directory and pick exactly ONE non-trivial file.
   Dispatch the code-reviewer subagent to review that file briefly.
3. Dispatch the summary-writer subagent to produce a one-paragraph summary of
   (a) the extension counts and (b) the code-reviewer's finding.

Output a 4-line markdown report: file counts, file reviewed, reviewer's observation,
and the summary-writer's paragraph.`;

  console.log('\n=== Multi-agent codebase analyzer ===\n');

  let result: any = null;
  try {
    for await (const message of query({
      prompt,
      options: {
        model: 'claude-haiku-4-5',
        systemPrompt:
          "You are a codebase analysis agent. Follow the user's three-step plan exactly, " +
          'in order. Be terse — the final answer should be a 4-line markdown report.',
        allowedTools: ['Glob', 'Read', 'Agent', 'mcp__file-stats__count_files'],
        mcpServers: { 'file-stats': fileStatsServer },
        agents: subagents,
        maxTurns: 15,
      } as any,
    })) {
      // Log a brief progress line so users can see the agent loop in action.
      if (message.type === 'assistant') {
        const blocks = message.message?.content ?? [];
        for (const b of blocks as any[]) {
          if (b.type === 'tool_use') console.log(`[tool] ${b.name}`);
          else if (b.type === 'text' && b.text) {
            console.log('[text]', b.text.slice(0, 120) + (b.text.length > 120 ? '…' : ''));
          }
        }
      } else if (message.type === 'result') {
        result = message;
      }
    }
  } catch (err) {
    // The SDK can raise a trailing exception after the ResultMessage; the
    // trace itself is still observed and published, so we tolerate it.
    console.log(`(SDK raised after result: ${(err as Error).message})`);
  }

  if (result) {
    console.log('\n=== FINAL ===\n');
    console.log(result.result ?? '(no result)');
    console.log(
      `\nturns=${result.num_turns} cost=$${(result.total_cost_usd ?? 0).toFixed(4)} session=${result.session_id}`,
    );
  }

  console.log('\nOpen your Openlayer dashboard to view the trace.\n');

  // The Openlayer publish is fire-and-forget by design; give it a beat to
  // flush before the process exits.
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
