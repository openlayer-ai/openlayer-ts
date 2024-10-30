// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Openlayer from 'openlayer';
import { Response } from 'node-fetch';

const client = new Openlayer({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource commits', () => {
  test('create: only required params', async () => {
    const responsePromise = client.commits.create('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      commit: { message: 'Updated the prompt.' },
      storageUri: 's3://...',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('create: required and optional params', async () => {
    const response = await client.commits.create('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      commit: { message: 'Updated the prompt.' },
      storageUri: 's3://...',
      archived: false,
      deploymentStatus: 'Deployed',
    });
  });
});
