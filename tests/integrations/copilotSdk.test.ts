/**
 * Unit tests for the GitHub Copilot SDK integration.
 *
 * The fixtures are real captured sessions (trimmed of base64 blobs and the 24KB
 * CLI system prompt), converted to the camelCase shape the TypeScript binding
 * delivers. They exercise the actual wire format rather than an assumption.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  CopilotTraceCollector,
  ROOT_STEP_NAME,
  composeHandlers,
  openlayerEventHandler,
  meteredCostUsd,
  providerForModel,
  traceCopilotOn,
  untraceCopilot,
  usageDetails,
} from '../../src/lib/integrations/copilotSdk';
import { getCurrentTrace } from '../../src/lib/tracing/tracer';

const FIXTURES = path.join(__dirname, 'fixtures', 'copilotSdk');

function loadFixture(name: string): any[] {
  return fs
    .readFileSync(path.join(FIXTURES, name), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function runFixture(name: string): any {
  const collector = new CopilotTraceCollector();
  for (const event of loadFixture(name)) {
    collector.handle(event);
  }
  const trace = getCurrentTrace();
  if (!trace) throw new Error('no trace was produced');
  return trace.toJSON()[0];
}

function find(steps: any[], predicate: (s: any) => boolean): any {
  for (const step of steps) {
    if (predicate(step)) return step;
    const found = find(step.steps || [], predicate);
    if (found) return found;
  }
  return null;
}

function walkNames(step: any): string[] {
  return [step.name, ...(step.steps || []).flatMap(walkNames)];
}

describe('Copilot SDK integration', () => {
  describe('provider mapping', () => {
    it('maps from the model prefix and never labels it "github"', () => {
      // Verified against llm-costs.openlayer.com: anthropic/claude-haiku-4.5 and
      // openai/gpt-5.4 resolve; github/* returns "No cost data found".
      expect(providerForModel('claude-haiku-4.5')).toBe('anthropic');
      expect(providerForModel('gpt-5.4')).toBe('openai');
      expect(providerForModel('o3-mini')).toBe('openai');
      expect(providerForModel('gemini-2.5-pro')).toBe('google');
      // Unknown prefixes omit provider rather than guess -- unpriced beats wrong.
      expect(providerForModel('some-future-model')).toBeUndefined();
      expect(providerForModel('')).toBeUndefined();
      expect(providerForModel(undefined)).toBeUndefined();
    });
  });

  describe('token partition', () => {
    it('subtracts cache categories so the partition does not overlap', () => {
      // Observed live: inputTokens=12509 already contains cacheWriteTokens=12499,
      // and Copilot's own _token_details reported an input count of 10.
      const details = usageDetails({
        inputTokens: 12509,
        outputTokens: 224,
        cacheWriteTokens: 12499,
        cacheReadTokens: 0,
        reasoningTokens: 143,
      });
      expect(details['input_tokens']).toBe(10);
      expect(details['output_tokens']).toBe(224);
      expect(details['cache_creation_tokens']).toBe(12499);
      expect(details['cached_tokens']).toBeUndefined();
      // reasoning stays folded into output_tokens, matching langchainCallback
      expect(details['reasoning_tokens']).toBeUndefined();
    });

    it('handles cache reads and stays exact', () => {
      const details = usageDetails({
        inputTokens: 12754,
        outputTokens: 122,
        cacheWriteTokens: 249,
        cacheReadTokens: 12499,
      });
      expect(details['input_tokens']).toBe(6);
      expect(details['cached_tokens']).toBe(12499);
      expect(details['cache_creation_tokens']).toBe(249);
      const total = Object.values(details).reduce((a, b) => a + b, 0);
      expect(total).toBe(12754 + 122);
    });
  });

  describe('trace shape', () => {
    it('emits chat steps with tokens and a priced provider', () => {
      const root = runFixture('session_basic.jsonl');
      const chats = root.steps.filter((s: any) => s.type === 'chat_completion');
      expect(chats).toHaveLength(3);
      for (const chat of chats) {
        expect(chat.model).toBe('claude-haiku-4.5');
        expect(chat.provider).toBe('anthropic');
        expect(chat.usageDetails['output_tokens']).toBeGreaterThan(0);
        // Copilot's premium-request figure must NOT be published as cost;
        // leaving it unset lets Openlayer price from provider+model.
        expect(chat.cost).toBeNull();
        expect(chat.metadata['copilot_premium_requests']).toBe(0.33);
      }
    });

    it('sets the root output to the final assistant message', () => {
      // Openlayer builds a row's output from the root step; an empty root
      // silently produces an unusable row.
      const root = runFixture('session_tools_subagent.jsonl');
      expect(root.type).toBe('agent');
      expect(root.name).toBe(ROOT_STEP_NAME);
      expect(typeof root.output).toBe('string');
      expect(root.output).toContain('Lisbon');
      expect(root.inputs.prompt).toMatch(/^Do these three things/);
    });

    it('keeps concurrent tool calls as siblings rather than nesting them', () => {
      // Three tool.execution_start fire before any completion and the
      // completions arrive out of order; a step-stack design would nest them.
      const root = runFixture('session_tools_subagent.jsonl');
      const topLevelNames = root.steps.map((s: any) => s.name);
      expect(topLevelNames).toContain('bash');
      expect(topLevelNames).toContain('get_weather');
    });

    it('nests a subagent dispatch as an AGENT step with its own work inside', () => {
      const root = runFixture('session_tools_subagent.jsonl');
      const subagent = find(
        root.steps,
        (s: any) => s.type === 'agent' && s.name.toLowerCase().includes('explore'),
      );
      expect(subagent).not.toBeNull();
      expect(subagent.steps.some((s: any) => s.type === 'chat_completion')).toBe(true);
      expect(subagent.steps.some((s: any) => s.name === 'view')).toBe(true);
    });

    it('captures tool arguments and failures', () => {
      const root = runFixture('session_basic.jsonl');
      const bash = find(root.steps, (s: any) => s.name === 'bash');
      expect(bash).not.toBeNull();
      expect(bash.inputs.command).toBe('ls -lhS');
      // this fixture's bash call was permission-denied
      expect(bash.metadata.success).toBe(false);
      expect(JSON.stringify(bash.metadata.error).toLowerCase()).toContain('denied');
    });

    it('never creates a step from a delta event', () => {
      const root = runFixture('session_basic.jsonl');
      expect(walkNames(root).some((n) => n.includes('delta'))).toBe(false);
    });

    it('records the Copilot session id for session grouping', () => {
      const root = runFixture('session_basic.jsonl');
      expect(root.metadata['copilot_session_id']).toBeTruthy();
    });
  });

  describe('handler composition', () => {
    it('still delivers every event to a user-supplied handler', () => {
      const seen: any[] = [];
      const composed = composeHandlers((e: any) => seen.push(e), openlayerEventHandler());
      composed({ type: 'session.start', data: { sessionId: 's1' } });
      expect(seen).toHaveLength(1);
    });

    it('survives a throwing user handler', () => {
      const composed = composeHandlers(() => {
        throw new Error('customer bug');
      }, openlayerEventHandler());
      expect(() => composed({ type: 'session.start', data: { sessionId: 's1' } })).not.toThrow();
    });

    it('never throws on a malformed event', () => {
      const collector = new CopilotTraceCollector();
      for (const junk of [null, undefined, {}, { type: 'user.message' }, 42]) {
        expect(() => collector.handle(junk)).not.toThrow();
      }
    });
  });

  describe('traceCopilot patching', () => {
    // The one-line entry point the docs lead with. Driven through an explicit
    // class seam so the tests need not have @github/copilot-sdk installed.
    class FakeClient {
      static lastOnEvent: ((e: any) => void) | undefined;
      declare disconnect: () => Promise<void>;
      async createSession(config: any = {}): Promise<any> {
        FakeClient.lastOnEvent = config.onEvent;
        return { disconnect: async () => undefined };
      }
    }

    let original: any;
    beforeEach(() => {
      original = FakeClient.prototype.createSession;
      FakeClient.lastOnEvent = undefined;
    });
    afterEach(() => {
      untraceCopilot();
      FakeClient.prototype.createSession = original;
    });

    it('patches createSession and is idempotent', async () => {
      traceCopilotOn(FakeClient);
      const patchedOnce = FakeClient.prototype.createSession;
      expect(patchedOnce).not.toBe(original);
      traceCopilotOn(FakeClient);
      expect(FakeClient.prototype.createSession).toBe(patchedOnce);
    });

    it('preserves a user-supplied onEvent', async () => {
      const seen: any[] = [];
      traceCopilotOn(FakeClient);
      await new FakeClient().createSession({ onEvent: (e: any) => seen.push(e) });

      const composed = FakeClient.lastOnEvent!;
      expect(composed).toBeDefined();
      composed({ type: 'session.start', data: { sessionId: 's1' } });
      expect(seen).toHaveLength(1);
    });

    it('traces sessions created after patching', async () => {
      traceCopilotOn(FakeClient);
      await new FakeClient().createSession();
      const handler = FakeClient.lastOnEvent!;
      for (const event of loadFixture('session_basic.jsonl')) handler(event);

      const root = getCurrentTrace()!.toJSON()[0] as any;
      expect(root.name).toBe(ROOT_STEP_NAME);
    });

    it('untraceCopilot restores the original', () => {
      traceCopilotOn(FakeClient);
      untraceCopilot();
      expect(FakeClient.prototype.createSession).toBe(original);
    });
  });

  describe('flush', () => {
    it('publishes an interaction that never went idle', () => {
      // A session torn down mid-flight must not silently drop its buffer.
      const collector = new CopilotTraceCollector();
      for (const event of loadFixture('session_basic.jsonl')) {
        const t = typeof event.type === 'string' ? event.type : '';
        if (t === 'session.idle' || t === 'session.shutdown') continue;
        collector.handle(event);
      }
      expect(collector.builtCount).toBe(0);
      collector.flush();
      expect(collector.builtCount).toBe(1);
    });

    it('does not double-publish after a normal idle', () => {
      const collector = new CopilotTraceCollector();
      for (const event of loadFixture('session_basic.jsonl')) collector.handle(event);
      expect(collector.builtCount).toBe(1);
      collector.flush();
      expect(collector.builtCount).toBe(1);
    });

    it('is exposed on the event handler', () => {
      const handler = openlayerEventHandler();
      expect(typeof handler.flush).toBe('function');
      expect(handler.collector).toBeInstanceOf(CopilotTraceCollector);
    });
  });

  describe('metered cost', () => {
    // GitHub meters each call in AIU; its per-token rates for claude-haiku-4.5
    // are Anthropic's list prices scaled by exactly 100, so total_nano_aiu/1e11
    // reproduces the priced cost to 12 decimal places.
    it('converts total_nano_aiu to USD', () => {
      const usage = { copilotUsage: { totalNanoAiu: 1675375000.0 } };
      expect(meteredCostUsd(usage)).toBeCloseTo(0.01675375, 9);
    });

    it('is undefined without AIU data', () => {
      expect(meteredCostUsd({})).toBeUndefined();
      expect(meteredCostUsd({ copilotUsage: {} })).toBeUndefined();
      expect(meteredCostUsd({ copilotUsage: { totalNanoAiu: 0 } })).toBeUndefined();
    });

    it('records the metered figure but lets Openlayer price a known provider', () => {
      const root = runFixture('session_basic.jsonl');
      const chat = root.steps[0];
      expect(chat.provider).toBe('anthropic');
      expect(chat.cost).toBeNull();
      expect(chat.metadata['copilot_metered_cost_usd']).toBeCloseTo(0.01675375, 9);
    });

    it('falls back to the metered cost for an unmapped model', () => {
      // A model we have no prefix for must land priced, not at $0.
      const events = loadFixture('session_basic.jsonl');
      for (const event of events) {
        if (event.data && 'model' in event.data) event.data.model = 'some-future-model-9';
      }
      const collector = new CopilotTraceCollector();
      for (const event of events) collector.handle(event);

      const chat = (getCurrentTrace()!.toJSON()[0] as any).steps[0];
      expect(chat.provider).toBeNull();
      expect(chat.cost).toBeCloseTo(0.01675375, 9);
    });
  });

  describe('metered cost, live shapes', () => {
    it('reads copilot_usage when it is a class instance, not a plain object', () => {
      class CopilotUsage {
        constructor(public totalNanoAiu: number) {}
      }
      expect(meteredCostUsd({ copilotUsage: new CopilotUsage(1675375000.0) })).toBeCloseTo(0.01675375, 9);
    });

    it('holds for a second vendor', () => {
      // Verified live on gpt-5-mini: GitHub bills 25/200/2.5 AIU per 1M
      // input/output/cache-read -- OpenAI's $0.25/$2.00/$0.025 list prices.
      const expected = 449 * 0.25e-6 + 9216 * 0.025e-6 + 107 * 2.0e-6;
      expect(meteredCostUsd({ copilotUsage: { totalNanoAiu: 55665000.0 } })).toBeCloseTo(expected, 9);
    });
  });

  describe('double-tracing guard', () => {
    // Mixing traceCopilot() with an explicit openlayerEventHandler() must not
    // publish the interaction twice. Both are documented entry points, so a
    // reader following the quickstart and then the "trace specific sessions"
    // snippet ends up with both active on the same session.
    class GuardClient {
      static lastOnEvent: ((e: any) => void) | undefined;
      async createSession(config: any = {}): Promise<any> {
        GuardClient.lastOnEvent = config.onEvent;
        return { disconnect: async () => undefined };
      }
    }

    afterEach(() => untraceCopilot());

    it('defers to a caller-supplied Openlayer handler', async () => {
      traceCopilotOn(GuardClient);
      const mine = openlayerEventHandler();
      await new GuardClient().createSession({ onEvent: mine });
      // The patch must hand back the caller's handler untouched, not a
      // composition wrapping a second collector.
      expect(GuardClient.lastOnEvent).toBe(mine);

      for (const event of loadFixture('session_basic.jsonl')) GuardClient.lastOnEvent!(event);
      expect(mine.collector.builtCount).toBe(1);
    });

    it('still wraps a non-Openlayer handler', async () => {
      traceCopilotOn(GuardClient);
      const userHandler = jest.fn();
      await new GuardClient().createSession({ onEvent: userHandler });
      expect(GuardClient.lastOnEvent).not.toBe(userHandler);
      GuardClient.lastOnEvent!({ type: 'session.start', data: { sessionId: 's1' } });
      expect(userHandler).toHaveBeenCalledTimes(1);
    });
  });
});
