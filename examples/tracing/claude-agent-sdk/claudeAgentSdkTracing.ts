/**
 * Openlayer tracing example for the Claude Agent SDK (TypeScript).
 *
 * Run with:
 *   npx tsx examples/tracing/claude-agent-sdk/claudeAgentSdkTracing.ts
 *
 * Prereqs (export as env vars):
 *   ANTHROPIC_API_KEY               — your Anthropic API key
 *   OPENLAYER_API_KEY               — your Openlayer ingest key
 *   OPENLAYER_INFERENCE_PIPELINE_ID — destination pipeline ID
 *
 * Install the optional peer (if you haven't already):
 *   npm install @anthropic-ai/claude-agent-sdk@^0.2.111
 */

// ---------------------------------------------------------------------------
// Option A — drop-in import (recommended). Replace
//
//   import { query } from "@anthropic-ai/claude-agent-sdk";
//
// with the Openlayer subpath:
import { query } from 'openlayer/lib/integrations/claudeAgentSdk';

// ---------------------------------------------------------------------------
// Option B — one-shot runtime patch (uncomment to use this style instead):
// import { query } from "@anthropic-ai/claude-agent-sdk";
// import { traceClaudeAgentSdk } from "openlayer/lib/integrations/claudeAgentSdk";
// traceClaudeAgentSdk({
//   inferencePipelineId: process.env.OPENLAYER_INFERENCE_PIPELINE_ID,
//   truncateToolOutputChars: 8192,
//   captureThinking: true,
//   redactMcpEnv: true,
// });

async function simpleQuery() {
  console.log('\n=== Scenario 1: code search with built-in tools ===\n');
  for await (const message of query({
    prompt: "What does the function summarizePrompt do in src/lib/integrations/claudeAgentSdk.ts? Answer in one sentence.",
    options: {
      model: 'claude-haiku-4-5',
      allowedTools: ['Read', 'Glob', 'Grep'],
    },
  })) {
    if (message.type === 'assistant') {
      const text = message.message?.content
        ?.filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('');
      if (text) console.log('[assistant]', text);
    } else if (message.type === 'result') {
      console.log('\n[result]', { cost: message.total_cost_usd, turns: message.num_turns });
    }
  }
}

async function subagentExample() {
  console.log('\n=== Scenario 2: dispatch a code-review subagent ===\n');
  // ``agents`` registers a subagent under the SDK's built-in ``Agent`` tool.
  // The wrapper picks up the subagent's assistant turns and tool calls and
  // nests them under the spawning Agent ``ToolStep`` automatically (via
  // ``parent_tool_use_id``).
  for await (const message of query({
    prompt: "Dispatch the code-reviewer subagent to review src/lib/integrations/claudeAgentSdk.ts and report back in one sentence.",
    options: {
      model: 'claude-haiku-4-5',
      allowedTools: ['Read', 'Agent'],
      agents: {
        'code-reviewer': {
          description: 'Reviews a code file for clarity, correctness, and style.',
          prompt:
            'You are a senior code reviewer. Inspect the file under review and call out one ' +
            'observation. Be concise — one paragraph.',
          tools: ['Read'],
        },
      },
    } as any,
  })) {
    if (message.type === 'result') {
      console.log('[result]', { cost: message.total_cost_usd, turns: message.num_turns });
    }
  }
}

async function main() {
  if (!process.env['ANTHROPIC_API_KEY']) {
    console.error('Set ANTHROPIC_API_KEY before running this example.');
    process.exit(1);
  }
  if (!process.env['OPENLAYER_INFERENCE_PIPELINE_ID']) {
    console.warn(
      'OPENLAYER_INFERENCE_PIPELINE_ID is not set — the trace will be built but not published.',
    );
  }

  await simpleQuery();
  await subagentExample();

  console.log('\nDone. Open your Openlayer dashboard to view the traces.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
