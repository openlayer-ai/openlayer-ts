# Migration guide

This guide outlines the changes and steps needed to migrate your codebase to the latest version of the Openlayer TypeScript SDK.

The main changes are that the SDK now relies on the [builtin Web fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) instead of `node-fetch` and has zero dependencies.

## Migration CLI

Most programs will only need minimal changes, but to assist there is a migration tool that will automatically update your code for the new version.
To use it, upgrade the `openlayer` package, then run `./node_modules/.bin/openlayer migrate ./your/src/folders` to update your code.
To preview the changes without writing them to disk, run the tool with `--dry`.

## Environment requirements

The minimum supported runtime and tooling versions are now:

- Node.js 20 LTS (Most recent non-EOL Node version)
- TypeScript 4.9
- Jest 28

## Breaking changes

### Web types for `withResponse`, `asResponse`, and `APIError.headers`

Because we now use the builtin Web fetch API on all platforms, if you wrote code that used `withResponse` or `asResponse` and then accessed `node-fetch`-specific properties on the result, you will need to switch to standardized alternatives.
For example, `body` is now a [Web `ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) rather than a [node `Readable`](https://nodejs.org/api/stream.html#readable-streams).

```ts
// Before:
const res = await client.example.retrieve('string/with/slash').asResponse();
res.body.pipe(process.stdout);

// After:
import { Readable } from 'node:stream';
const res = await client.example.retrieve('string/with/slash').asResponse();
Readable.fromWeb(res.body).pipe(process.stdout);
```

Additionally, the `headers` property on `APIError` objects is now an instance of the Web [Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers) class. It was previously defined as `Record<string, string | null | undefined>`.

### URI encoded path parameters

Path params are now properly encoded by default. If you were manually encoding path parameters before giving them to the SDK, you must now stop doing that and pass the
param without any encoding applied.

For example:

```diff
- client.example.retrieve(encodeURIComponent('string/with/slash'))
+ client.example.retrieve('string/with/slash') // retrieves /example/string%2Fwith%2Fslash
```

Previously without the `encodeURIComponent()` call we would have used the path `/example/string/with/slash`; now we'll use `/example/string%2Fwith%2Fslash`.

### Removed request options overloads

When making requests with no required body, query or header parameters, you must now explicitly pass `null`, `undefined` or an empty object `{}` to the params argument in order to customise request options.

```diff
client.example.list();
client.example.list({}, { headers: { ... } });
client.example.list(null, { headers: { ... } });
client.example.list(undefined, { headers: { ... } });
- client.example.list({ headers: { ... } });
+ client.example.list({}, { headers: { ... } });
```

This affects the following methods:

- `client.projects.list()`
- `client.projects.commits.list()`
- `client.projects.inferencePipelines.list()`
- `client.projects.tests.list()`
- `client.workspaces.update()`
- `client.workspaces.invites.create()`
- `client.workspaces.invites.list()`
- `client.workspaces.apiKeys.create()`
- `client.commits.testResults.list()`
- `client.inferencePipelines.retrieve()`
- `client.inferencePipelines.update()`
- `client.inferencePipelines.retrieveUsers()`
- `client.inferencePipelines.testResults.list()`
- `client.tests.listResults()`

### Removed `httpAgent` in favor of `fetchOptions`

The `httpAgent` client option has been removed in favor of a [platform-specific `fetchOptions` property](https://github.com/openlayer-ai/openlayer-ts#fetch-options).
This change was made as `httpAgent` relied on `node:http` agents which are not supported by any runtime's builtin fetch implementation.

If you were using `httpAgent` for proxy support, check out the [new proxy documentation](https://github.com/openlayer-ai/openlayer-ts#configuring-proxies).

Before:

```ts
import Openlayer from 'openlayer';
import http from 'http';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Configure the default for all requests:
const client = new Openlayer({
  httpAgent: new HttpsProxyAgent(process.env.PROXY_URL),
});
```

After:

```ts
import Openlayer from 'openlayer';
import * as undici from 'undici';

const proxyAgent = new undici.ProxyAgent(process.env.PROXY_URL);
const client = new Openlayer({
  fetchOptions: {
    dispatcher: proxyAgent,
  },
});
```

### Changed exports

#### Refactor of `openlayer/core`, `error`, `pagination`, `resource` and `uploads`

Much of the `openlayer/core` file was intended to be internal-only but it was publicly accessible, as such it has been refactored and split up into internal and public files, with public-facing code moved to a new `core` folder and internal code moving to the private `internal` folder.

At the same time, we moved some public-facing files which were previously at the top level into `core` to make the file structure cleaner and more clear:

```typescript
// Before
import 'openlayer/error';
import 'openlayer/pagination';
import 'openlayer/resource';
import 'openlayer/uploads';

// After
import 'openlayer/core/error';
import 'openlayer/core/pagination';
import 'openlayer/core/resource';
import 'openlayer/core/uploads';
```

If you were relying on anything that was only exported from `openlayer/core` and is also not accessible anywhere else, please open an issue and we'll consider adding it to the public API.

#### Resource classes

Previously under certain circumstances it was possible to import resource classes like `Projects` directly from the root of the package. This was never valid at the type level and only worked in CommonJS files.
Now you must always either reference them as static class properties or import them directly from the files in which they are defined.

```typescript
// Before
const { Projects } = require('openlayer');

// After
const { Openlayer } = require('openlayer');
Openlayer.Projects; // or import directly from openlayer/resources/projects/projects
```

#### Cleaned up `uploads` exports

As part of the `core` refactor, `openlayer/uploads` was moved to `openlayer/core/uploads`
and the following exports were removed, as they were not intended to be a part of the public API:

- `fileFromPath`
- `BlobPart`
- `BlobLike`
- `FileLike`
- `ResponseLike`
- `isResponseLike`
- `isBlobLike`
- `isFileLike`
- `isUploadable`
- `isMultipartBody`
- `maybeMultipartFormRequestOptions`
- `multipartFormRequestOptions`
- `createForm`

Note that `Uploadable` & `toFile` **are** still exported:

```typescript
import { type Uploadable, toFile } from 'openlayer/core/uploads';
```

#### `APIClient`

The `APIClient` base client class has been removed as it is no longer needed. If you were importing this class then you must now import the main client class:

```typescript
// Before
import { APIClient } from 'openlayer/core';

// After
import { Openlayer } from 'openlayer';
```

### File handling

The deprecated `fileFromPath` helper has been removed in favor of native Node.js streams:

```ts
// Before
Openlayer.fileFromPath('path/to/file');

// After
import fs from 'fs';
fs.createReadStream('path/to/file');
```

Note that this function previously only worked on Node.js. If you're using Bun, you can use [`Bun.file`](https://bun.sh/docs/api/file-io) instead.

### Shims removal

Previously you could configure the types that the SDK used like this:

```ts
// Tell TypeScript and the package to use the global Web fetch instead of node-fetch.
import 'openlayer/shims/web';
import Openlayer from 'openlayer';
```

The `openlayer/shims` imports have been removed. Your global types must now be [correctly configured](#minimum-types-requirements).

### `openlayer/src` directory removed

Previously IDEs may have auto-completed imports from the `openlayer/src` directory, however this
directory was only included for an improved go-to-definition experience and should not have been used at runtime.

If you have any `openlayer/src/*` imports, you will need to replace them with `openlayer/*`.

```ts
// Before
import Openlayer from 'openlayer/src';

// After
import Openlayer from 'openlayer';
```

## TypeScript troubleshooting

When referencing the library after updating, you may encounter new type errors related to JS features like private properties or fetch classes like Request, Response, and Headers.
To resolve these issues, configure your tsconfig.json and install the appropriate `@types` packages for your runtime environment using the guidelines below:

### Browsers

`tsconfig.json`

```jsonc
{
  "target": "ES2018", // note: we recommend ES2020 or higher
  "lib": ["DOM", "DOM.Iterable", "ES2018"]
}
```

### Node.js

`tsconfig.json`

```jsonc
{
  "target": "ES2018" // note: we recommend ES2020 or higher
}
```

`package.json`

```json
{
  "devDependencies": {
    "@types/node": ">= 20"
  }
}
```

### Cloudflare Workers

`tsconfig.json`

```jsonc
{
  "target": "ES2018", // note: we recommend ES2020 or higher
  "lib": ["ES2020"], // <- needed by @cloudflare/workers-types
  "types": ["@cloudflare/workers-types"]
}
```

`package.json`

```json
{
  "devDependencies": {
    "@cloudflare/workers-types": ">= 0.20221111.0"
  }
}
```

### Bun

`tsconfig.json`

```jsonc
{
  "target": "ES2018" // note: we recommend ES2020 or higher
}
```

`package.json`

```json
{
  "devDependencies": {
    "@types/bun": ">= 1.2.0"
  }
}
```
