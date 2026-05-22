import { query } from 'openlayer/lib/integrations/claudeAgentSdk';

// First, make sure you export your:
// - ANTHROPIC_API_KEY
// - OPENLAYER_API_KEY
// - OPENLAYER_INFERENCE_PIPELINE_ID
// as environment variables.
//
// Then run with: npx tsx examples/claude-agent-sdk-tracing.ts
//
// This example covers two scenarios:
//   1. A simple `query()` using built-in tools (Read / Glob / Grep).
//   2. A `query()` that dispatches a code-reviewer subagent. The wrapper
//      surfaces the subagent dispatch as an AGENT step and nests the
//      subagent's chats / tool calls inside that boundary via the SDK's
//      `parent_tool_use_id`.
//
// `query` imported from 'openlayer/lib/integrations/claudeAgentSdk' has the
// same signature as `@anthropic-ai/claude-agent-sdk`'s `query`, just
// auto-traced. The alternative is `traceClaudeAgentSdk()` which monkey-patches
// the underlying SDK at runtime — see the README for that style.

async function simpleQuery() {
  console.log('\n=== Scenario 1: code search with built-in tools ===\n');
  for await (const message of query({
    prompt:
      'What does the function summarizePrompt do in src/lib/integrations/claudeAgentSdk.ts? Answer in one sentence.',
    options: {
      model: 'claude-haiku-4-5',
      allowedTools: ['Read', 'Glob', 'Grep'],
    },
  })) {
    if (message.type === 'result') {
      console.log('[result]', { cost: message.total_cost_usd, turns: message.num_turns });
    }
  }
}

async function subagentExample() {
  console.log('\n=== Scenario 2: dispatch a code-review subagent ===\n');
  for await (const message of query({
    prompt:
      'Dispatch the code-reviewer subagent to review src/lib/integrations/claudeAgentSdk.ts and report back in one sentence.',
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
  await simpleQuery();
  await subagentExample();
  console.log('\nDone. Open your Openlayer dashboard to view the traces.\n');
}

main().catch(console.error);
