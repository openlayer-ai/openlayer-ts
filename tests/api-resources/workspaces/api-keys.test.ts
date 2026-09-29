// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Openlayer from 'openlayer';

const client = new Openlayer({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource apiKeys', () => {
  test('create', async () => {
    const responsePromise = client.workspaces.apiKeys.create('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('create: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.workspaces.apiKeys.create(
        '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
        { expiresAt: '2027-01-01T00:00:00Z', name: 'Secret Key' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Openlayer.NotFoundError);
  });

  test('retrieve: only required params', async () => {
    const responsePromise = client.workspaces.apiKeys.retrieve('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      workspaceId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('retrieve: required and optional params', async () => {
    const response = await client.workspaces.apiKeys.retrieve('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      workspaceId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
    });
  });

  test('update: only required params', async () => {
    const responsePromise = client.workspaces.apiKeys.update('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      workspaceId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('update: required and optional params', async () => {
    const response = await client.workspaces.apiKeys.update('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      workspaceId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
      name: 'Secret Key',
    });
  });

  test('list', async () => {
    const responsePromise = client.workspaces.apiKeys.list('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('delete: only required params', async () => {
    const responsePromise = client.workspaces.apiKeys.delete('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      workspaceId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('delete: required and optional params', async () => {
    const response = await client.workspaces.apiKeys.delete('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      workspaceId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
    });
  });

  test('rotate: only required params', async () => {
    const responsePromise = client.workspaces.apiKeys.rotate('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      workspaceId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('rotate: required and optional params', async () => {
    const response = await client.workspaces.apiKeys.rotate('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      workspaceId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
      expiresAt: '2027-01-01T00:00:00Z',
      gracePeriodHours: 24,
    });
  });
});
