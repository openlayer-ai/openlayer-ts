# Openlayer TypeScript API Library

[![NPM version](<https://img.shields.io/npm/v/openlayer.svg?label=npm%20(stable)>)](https://npmjs.org/package/openlayer) ![npm bundle size](https://img.shields.io/bundlephobia/minzip/openlayer)

This library provides convenient access to the Openlayer REST API from server-side TypeScript or JavaScript.

The REST API documentation can be found on [openlayer.com](https://openlayer.com/docs/api-reference/rest/overview). The full API of this library can be found in [api.md](api.md).

It is generated with [Stainless](https://www.stainless.com/).

## Installation

```sh
npm install openlayer
```

## Usage

The full API of this library can be found in [api.md](api.md).

<!-- prettier-ignore -->
```js
import Openlayer from 'openlayer';

const client = new Openlayer({
  apiKey: process.env['OPENLAYER_API_KEY'], // This is the default and can be omitted
});

const response = await client.inferencePipelines.data.stream(
  '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
  {
    config: {
      inputVariableNames: ['user_query'],
      outputColumnName: 'output',
      numOfTokenColumnName: 'tokens',
      costColumnName: 'cost',
      timestampColumnName: 'timestamp',
    },
    rows: [
      {
        user_query: 'what is the meaning of life?',
        output: '42',
        tokens: 7,
        cost: 0.02,
        timestamp: 1610000000,
      },
    ],
  },
);

console.log(response.success);
```

### Request & Response types

This library includes TypeScript definitions for all request params and response fields. You may import and use them like so:

<!-- prettier-ignore -->
```ts
import Openlayer from 'openlayer';

const client = new Openlayer({
  apiKey: process.env['OPENLAYER_API_KEY'], // This is the default and can be omitted
});

const params: Openlayer.InferencePipelines.DataStreamParams = {
  config: {
    inputVariableNames: ['user_query'],
    outputColumnName: 'output',
    numOfTokenColumnName: 'tokens',
    costColumnName: 'cost',
    timestampColumnName: 'timestamp',
  },
  rows: [
    {
      user_query: 'what is the meaning of life?',
      output: '42',
      tokens: 7,
      cost: 0.02,
      timestamp: 1610000000,
    },
  ],
};
const response: Openlayer.InferencePipelines.DataStreamResponse =
  await client.inferencePipelines.data.stream('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', params);
```

Documentation for each method, request param, and response field are available in docstrings and will appear on hover in most modern editors.

## Handling errors

When the library is unable to connect to the API,
or if the API returns a non-success status code (i.e., 4xx or 5xx response),
a subclass of `APIError` will be thrown:

<!-- prettier-ignore -->
```ts
const response = await client.inferencePipelines.data
  .stream('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
    config: {
      inputVariableNames: ['user_query'],
      outputColumnName: 'output',
      numOfTokenColumnName: 'tokens',
      costColumnName: 'cost',
      timestampColumnName: 'timestamp',
    },
    rows: [
      {
        user_query: 'what is the meaning of life?',
        output: '42',
        tokens: 7,
        cost: 0.02,
        timestamp: 1610000000,
      },
    ],
  })
  .catch(async (err) => {
    if (err instanceof Openlayer.APIError) {
      console.log(err.status); // 400
      console.log(err.name); // BadRequestError
      console.log(err.headers); // {server: 'nginx', ...}
    } else {
      throw err;
    }
  });
```

Error codes are as follows:

| Status Code | Error Type                 |
| ----------- | -------------------------- |
| 400         | `BadRequestError`          |
| 401         | `AuthenticationError`      |
| 403         | `PermissionDeniedError`    |
| 404         | `NotFoundError`            |
| 422         | `UnprocessableEntityError` |
| 429         | `RateLimitError`           |
| >=500       | `InternalServerError`      |
| N/A         | `APIConnectionError`       |

### Retries

Certain errors will be automatically retried 2 times by default, with a short exponential backoff.
Connection errors (for example, due to a network connectivity problem), 408 Request Timeout, 409 Conflict,
429 Rate Limit, and >=500 Internal errors will all be retried by default.

You can use the `maxRetries` option to configure or disable this:

<!-- prettier-ignore -->
```js
// Configure the default for all requests:
const client = new Openlayer({
  maxRetries: 0, // default is 2
});

// Or, configure per-request:
await client.inferencePipelines.data.stream('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
  config: {
  inputVariableNames: ['user_query'],
  outputColumnName: 'output',
  numOfTokenColumnName: 'tokens',
  costColumnName: 'cost',
  timestampColumnName: 'timestamp',
},
  rows: [{
  user_query: 'what is the meaning of life?',
  output: '42',
  tokens: 7,
  cost: 0.02,
  timestamp: 1610000000,
}],
}, {
  maxRetries: 5,
});
```

### Timeouts

Requests time out after 1 minute by default. You can configure this with a `timeout` option:

<!-- prettier-ignore -->
```ts
// Configure the default for all requests:
const client = new Openlayer({
  timeout: 20 * 1000, // 20 seconds (default is 1 minute)
});

// Override per-request:
await client.inferencePipelines.data.stream('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
  config: {
  inputVariableNames: ['user_query'],
  outputColumnName: 'output',
  numOfTokenColumnName: 'tokens',
  costColumnName: 'cost',
  timestampColumnName: 'timestamp',
},
  rows: [{
  user_query: 'what is the meaning of life?',
  output: '42',
  tokens: 7,
  cost: 0.02,
  timestamp: 1610000000,
}],
}, {
  timeout: 5 * 1000,
});
```

On timeout, an `APIConnectionTimeoutError` is thrown.

Note that requests which time out will be [retried twice by default](#retries).

## Advanced Usage

### Accessing raw Response data (e.g., headers)

The "raw" `Response` returned by `fetch()` can be accessed through the `.asResponse()` method on the `APIPromise` type that all methods return.
This method returns as soon as the headers for a successful response are received and does not consume the response body, so you are free to write custom parsing or streaming logic.

You can also use the `.withResponse()` method to get the raw `Response` along with the parsed data.
Unlike `.asResponse()` this method consumes the body, returning once it is parsed.

<!-- prettier-ignore -->
```ts
const client = new Openlayer();

const response = await client.inferencePipelines.data
  .stream('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
    config: {
      inputVariableNames: ['user_query'],
      outputColumnName: 'output',
      numOfTokenColumnName: 'tokens',
      costColumnName: 'cost',
      timestampColumnName: 'timestamp',
    },
    rows: [
      {
        user_query: 'what is the meaning of life?',
        output: '42',
        tokens: 7,
        cost: 0.02,
        timestamp: 1610000000,
      },
    ],
  })
  .asResponse();
console.log(response.headers.get('X-My-Header'));
console.log(response.statusText); // access the underlying Response object

const { data: response, response: raw } = await client.inferencePipelines.data
  .stream('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
    config: {
      inputVariableNames: ['user_query'],
      outputColumnName: 'output',
      numOfTokenColumnName: 'tokens',
      costColumnName: 'cost',
      timestampColumnName: 'timestamp',
    },
    rows: [
      {
        user_query: 'what is the meaning of life?',
        output: '42',
        tokens: 7,
        cost: 0.02,
        timestamp: 1610000000,
      },
    ],
  })
  .withResponse();
console.log(raw.headers.get('X-My-Header'));
console.log(response.success);
```

### Logging

> [!IMPORTANT]
> All log messages are intended for debugging only. The format and content of log messages
> may change between releases.

#### Log levels

The log level can be configured in two ways:

1. Via the `OPENLAYER_LOG` environment variable
2. Using the `logLevel` client option (overrides the environment variable if set)

```ts
import Openlayer from 'openlayer';

const client = new Openlayer({
  logLevel: 'debug', // Show all log messages
});
```

Available log levels, from most to least verbose:

- `'debug'` - Show debug messages, info, warnings, and errors
- `'info'` - Show info messages, warnings, and errors
- `'warn'` - Show warnings and errors (default)
- `'error'` - Show only errors
- `'off'` - Disable all logging

At the `'debug'` level, all HTTP requests and responses are logged, including headers and bodies.
Some authentication-related headers are redacted, but sensitive data in request and response bodies
may still be visible.

#### Custom logger

By default, this library logs to `globalThis.console`. You can also provide a custom logger.
Most logging libraries are supported, including [pino](https://www.npmjs.com/package/pino), [winston](https://www.npmjs.com/package/winston), [bunyan](https://www.npmjs.com/package/bunyan), [consola](https://www.npmjs.com/package/consola), [signale](https://www.npmjs.com/package/signale), and [@std/log](https://jsr.io/@std/log). If your logger doesn't work, please open an issue.

When providing a custom logger, the `logLevel` option still controls which messages are emitted, messages
below the configured level will not be sent to your logger.

```ts
import Openlayer from 'openlayer';
import pino from 'pino';

const logger = pino();

const client = new Openlayer({
  logger: logger.child({ name: 'Openlayer' }),
  logLevel: 'debug', // Send all messages to pino, allowing it to filter
});
```

### Making custom/undocumented requests

This library is typed for convenient access to the documented API. If you need to access undocumented
endpoints, params, or response properties, the library can still be used.

#### Undocumented endpoints

To make requests to undocumented endpoints, you can use `client.get`, `client.post`, and other HTTP verbs.
Options on the client, such as retries, will be respected when making these requests.

```ts
await client.post('/some/path', {
  body: { some_prop: 'foo' },
  query: { some_query_arg: 'bar' },
});
```

#### Undocumented request params

To make requests using undocumented parameters, you may use `// @ts-expect-error` on the undocumented
parameter. This library doesn't validate at runtime that the request matches the type, so any extra values you
send will be sent as-is.

```ts
client.inferencePipelines.data.stream({
  // ...
  // @ts-expect-error baz is not yet public
  baz: 'undocumented option',
});
```

For requests with the `GET` verb, any extra params will be in the query, all other requests will send the
extra param in the body.

If you want to explicitly send an extra argument, you can do so with the `query`, `body`, and `headers` request
options.

#### Undocumented response properties

To access undocumented response properties, you may access the response object with `// @ts-expect-error` on
the response object, or cast the response object to the requisite type. Like the request params, we do not
validate or strip extra properties from the response from the API.

### Customizing the fetch client

By default, this library expects a global `fetch` function is defined.

If you want to use a different `fetch` function, you can either polyfill the global:

```ts
import fetch from 'my-fetch';

globalThis.fetch = fetch;
```

Or pass it to the client:

```ts
import Openlayer from 'openlayer';
import fetch from 'my-fetch';

const client = new Openlayer({ fetch });
```

### Fetch options

If you want to set custom `fetch` options without overriding the `fetch` function, you can provide a `fetchOptions` object when instantiating the client or making a request. (Request-specific options override client options.)

```ts
import Openlayer from 'openlayer';

const client = new Openlayer({
  fetchOptions: {
    // `RequestInit` options
  },
});
```

#### Configuring proxies

To modify proxy behavior, you can provide custom `fetchOptions` that add runtime-specific proxy
options to requests:

<img src="https://raw.githubusercontent.com/stainless-api/sdk-assets/refs/heads/main/node.svg" align="top" width="18" height="21"> **Node** <sup>[[docs](https://github.com/nodejs/undici/blob/main/docs/docs/api/ProxyAgent.md#example---proxyagent-with-fetch)]</sup>

```ts
import Openlayer from 'openlayer';
import * as undici from 'undici';

const proxyAgent = new undici.ProxyAgent('http://localhost:8888');
const client = new Openlayer({
  fetchOptions: {
    dispatcher: proxyAgent,
  },
});
```

<img src="https://raw.githubusercontent.com/stainless-api/sdk-assets/refs/heads/main/bun.svg" align="top" width="18" height="21"> **Bun** <sup>[[docs](https://bun.sh/guides/http/proxy)]</sup>

```ts
import Openlayer from 'openlayer';

const client = new Openlayer({
  fetchOptions: {
    proxy: 'http://localhost:8888',
  },
});
```

<img src="https://raw.githubusercontent.com/stainless-api/sdk-assets/refs/heads/main/deno.svg" align="top" width="18" height="21"> **Deno** <sup>[[docs](https://docs.deno.com/api/deno/~/Deno.createHttpClient)]</sup>

```ts
import Openlayer from 'npm:openlayer';

const httpClient = Deno.createHttpClient({ proxy: { url: 'http://localhost:8888' } });
const client = new Openlayer({
  fetchOptions: {
    client: httpClient,
  },
});
```

## Mastra

Send Mastra agent, workflow, model, and tool traces to Openlayer.

### Installation

```sh
npm install openlayer @mastra/core @mastra/observability @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-proto
```

`@mastra/observability` is required to configure any custom exporter, Openlayer included, but is
not a peer dependency of `openlayer` itself — it's a Mastra requirement, not an Openlayer one.
`@mastra/core`, `@mastra/otel-exporter`, and `@opentelemetry/exporter-trace-otlp-proto` are all
declared as **optional** peer dependencies of `openlayer`, so none of the three is pulled in for
consumers who do not use Mastra.

### Configuration

Set `OPENLAYER_API_KEY` and `OPENLAYER_INFERENCE_PIPELINE_ID`, then add the exporter. A third,
optional variable, `OPENLAYER_OTEL_ENDPOINT`, overrides the OTLP endpoint the exporter posts
to — it defaults to `https://api.openlayer.com/v1/otel/v1/traces` when unset:

```ts
import { Mastra } from '@mastra/core';
import { Observability } from '@mastra/observability';
import { OpenlayerExporter } from 'openlayer/lib/integrations/mastra';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      openlayer: {
        serviceName: 'my-service',
        exporters: [new OpenlayerExporter()],
      },
    },
  }),
});
```

Every value can also be passed explicitly, which takes precedence over the environment:

```ts
new OpenlayerExporter({
  apiKey: process.env.OPENLAYER_API_KEY,
  inferencePipelineId: process.env.OPENLAYER_INFERENCE_PIPELINE_ID,
  projectName: 'my-service',
  endpoint: 'https://api.openlayer.com/v1/otel/v1/traces',
  headers: { 'x-custom-header': 'value' },
  batchSize: 512,
  timeout: 30000,
  logLevel: 'debug',
});
```

If credentials are missing the exporter disables itself and logs the reason — it never throws.

### Session and user attribution

Metadata named `sessionId` (or `threadId`) and `userId` is lifted onto the trace, so rows are
grouped by session and user in Openlayer:

```ts
await agent.generate('What is the weather in Lisbon?', {
  tracingOptions: { metadata: { sessionId: 'session-123', userId: 'user-456' } },
});
```

Any other metadata is preserved on the step as-is.

### Composing with other exporters

Mastra takes a list, so Openlayer sits alongside anything else:

```ts
exporters: [new OpenlayerExporter(), new ArizeExporter()],
```

### Filtering spans

There are two layers, and they do different jobs:

- **`excludeSpanTypes`** on the Mastra config drops spans before _any_ exporter sees them. Use
  this to filter for every exporter at once.
- **`dropSpanTypes`** on `OpenlayerExporter` changes only what Openlayer receives. It defaults
  to `[SpanType.MODEL_CHUNK]`, because Mastra emits one span per streaming chunk and an
  unfiltered streamed reply would become hundreds of steps. Pass `[]` to export everything.

  **`dropSpanTypes` never reparents children.** It is a public knob, and dropping a span type
  that has descendants — `WORKFLOW_STEP`, for example — silently loses that entire subtree, not
  just the dropped span itself. `MODEL_CHUNK`, the default, is safe from this precisely because
  chunk spans are leaves with nothing under them to lose.

  `SpanType.MODEL_STEP` is the case that was actually measured: it was a large share of a
  trace's steps (4 of 7 in a single one-tool-call turn) and was considered for the default drop
  list, but a live run confirmed that dropping it silently lost the nested tool-call step rather
  than hoisting it to the surviving `MODEL_GENERATION` ancestor. It is deliberately **not** in
  the default list for that reason, and the same caution applies to any span type you add to
  `dropSpanTypes` yourself: check what it parents before dropping it.

### Troubleshooting

**Nothing arrives at all.** The exporter disabled itself because credentials were missing. Look
for `[OpenlayerExporter] Missing required configuration` in the logs at startup.

**Rows arrive with empty output.** Something stripped the `mastra.*.input` / `.output` span
attributes before the exporter ran — check any `customSpanFormatter` or span output processor
in your observability config. Openlayer builds a row's input and output from the root span, and
the exporter recovers them from those attributes.

**Hundreds of steps in one trace.** `dropSpanTypes` was overridden and `MODEL_CHUNK` is no
longer filtered. Restore the default or add `SpanType.MODEL_CHUNK` back.

**OpenInference attributes are not read.** Openlayer's OTLP ingest maps the GenAI semantic
conventions; OpenInference `input.value` / `output.value` produce empty rows. This exporter
targets gen_ai deliberately — no configuration will change that.

**Running `mastraExporter.live.test.ts` live needs `--experimental-vm-modules`.** The suite
itself loads and skips cleanly under a plain `npx jest` run with no credentials — `@ai-sdk/openai`
is ESM-only, but the live test imports it lazily inside the test body, which `it.skip` never
executes. The flag is only required to actually run the live assertions once credentials are
set: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/integrations/mastraExporter.live.test.ts`
— see that file's header comment for why.

## Frequently Asked Questions

## Semantic versioning

This package generally follows [SemVer](https://semver.org/spec/v2.0.0.html) conventions, though certain backwards-incompatible changes may be released as minor versions:

1. Changes that only affect static types, without breaking runtime behavior.
2. Changes to library internals which are technically public but not intended or documented for external use. _(Please open a GitHub issue to let us know if you are relying on such internals.)_
3. Changes that we do not expect to impact the vast majority of users in practice.

We take backwards-compatibility seriously and work hard to ensure you can rely on a smooth upgrade experience.

We are keen for your feedback; please open an [issue](https://www.github.com/openlayer-ai/openlayer-ts/issues) with questions, bugs, or suggestions.

## Requirements

TypeScript >= 4.9 is supported.

The following runtimes are supported:

- Web browsers (Up-to-date Chrome, Firefox, Safari, Edge, and more)
- Node.js 20 LTS or later ([non-EOL](https://endoflife.date/nodejs)) versions.
- Deno v1.28.0 or higher.
- Bun 1.0 or later.
- Cloudflare Workers.
- Vercel Edge Runtime.
- Jest 28 or greater with the `"node"` environment (`"jsdom"` is not supported at this time).
- Nitro v2.6 or greater.

Note that React Native is not supported at this time.

If you are interested in other runtime environments, please open or upvote an issue on GitHub.

## Contributing

See [the contributing documentation](./CONTRIBUTING.md).
