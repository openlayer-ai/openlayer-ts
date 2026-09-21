// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Openlayer from 'openlayer';

const client = new Openlayer({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource rules', () => {
  test('create: only required params', async () => {
    const responsePromise = client.governance.rules.create('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      name: 'Monitoring enabled',
      scope: 'project',
      type: 'platform',
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
    const response = await client.governance.rules.create('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      name: 'Monitoring enabled',
      scope: 'project',
      type: 'platform',
      assigneeId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
      automationParams: { foo: 'bar' },
      automationType: 'monitoring_mode_enabled',
      deactivated: true,
      description: 'Each project must have Openlayer monitoring mode enabled.',
      evidenceType: 'document',
      renewalCadenceDays: 90,
      tagIds: ['182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e'],
    });
  });

  test('retrieve', async () => {
    const responsePromise = client.governance.rules.retrieve('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('update', async () => {
    const responsePromise = client.governance.rules.update('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {});
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('list', async () => {
    const responsePromise = client.governance.rules.list('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('list: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.governance.rules.list(
        '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
        {
          asc: true,
          assigneeId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
          deactivated: true,
          enabledFrameworkOnly: true,
          frameworkId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
          group: 'open',
          includeResults: true,
          includeUnframed: true,
          page: 1,
          perPage: 1,
          projectId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
          scope: 'project',
          searchQuery: 'searchQuery',
          sortBy: 'name',
          status: 'passing',
          tags: ['182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e'],
          type: 'platform',
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Openlayer.NotFoundError);
  });

  test('delete', async () => {
    const responsePromise = client.governance.rules.delete('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });
});
