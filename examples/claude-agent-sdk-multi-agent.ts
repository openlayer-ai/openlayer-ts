import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { query } from 'openlayer/lib/integrations/claudeAgentSdk';
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// First, make sure you export your:
// - ANTHROPIC_API_KEY
// - OPENLAYER_API_KEY
// - OPENLAYER_INFERENCE_PIPELINE_ID
// as environment variables.
//
// Then run with: npx tsx examples/claude-agent-sdk-multi-agent.ts
//
// This example exercises every step type the Openlayer Claude Agent SDK
// wrapper captures — AGENT, CHAT_COMPLETION, TOOL — at depth. It builds a
// "codebase analyzer" agent that:
//   1. calls an in-process MCP tool (`count_files`) to inventory a directory,
//   2. uses Glob + Read to look up one file, and
//   3. dispatches two subagents (`code-reviewer` and `summary-writer`) to
//      produce a final markdown report.
//
// The resulting trace tree has:
//   AGENT  Claude Agent SDK query
//   |- CHAT_COMPLETION  assistant turn N
//   |- TOOL             mcp__file-stats__count_files
//   |- TOOL             Glob
//   |- AGENT            Agent: code-reviewer
//   |   |- CHAT_COMPLETION  (subagent turns)
//   |   `- TOOL             Read
//   `- AGENT            Agent: summary-writer
//       `- CHAT_COMPLETION

const countFiles = tool(
  'count_files',
  'Count files in a directory grouped by extension',
  { directory: z.string().describe('Absolute path to the directory to analyze') },
  async (args) => {
    const dir = path.resolve(args.directory);
    let stat;
    try {
      stat = await fs.stat(dir);
    } catch {
      return { content: [{ type: 'text', text: `No such directory: ${dir}` }], isError: true };
    }
    if (!stat.isDirectory()) {
      return { content: [{ type: 'text', text: `Not a directory: ${dir}` }], isError: true };
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

async function main() {
  const targetDir = path.resolve(__dirname, '../src/lib/integrations');

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
    console.log(`(SDK raised after result: ${(err as Error).message})`);
  }

  if (result) {
    console.log('\n=== FINAL ===\n');
    console.log(result.result ?? '(no result)');
    console.log(
      `\nturns=${result.num_turns} cost=$${(result.total_cost_usd ?? 0).toFixed(4)} session=${
        result.session_id
      }`,
    );
  }

  // The Openlayer publish is fire-and-forget by design; give it a beat to
  // flush before the process exits.
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

main().catch(console.error);
