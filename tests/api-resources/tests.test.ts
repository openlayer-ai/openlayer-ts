// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Openlayer from 'openlayer';

const client = new Openlayer({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource tests', () => {
  test('evaluate: only required params', async () => {
    const responsePromise = client.tests.evaluate('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      endTimestamp: 1700006400,
      startTimestamp: 1699920000,
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('evaluate: required and optional params', async () => {
    const response = await client.tests.evaluate('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      endTimestamp: 1700006400,
      startTimestamp: 1699920000,
      inferencePipelineId: '123e4567-e89b-12d3-a456-426614174000',
      overwriteResults: false,
    });
  });

  test('listResults', async () => {
    const responsePromise = client.tests.listResults('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('listResults: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.tests.listResults(
        '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
        {
          endTimestamp: 0,
          includeInsights: true,
          inferencePipelineId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
          page: 1,
          perPage: 1,
          projectVersionId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
          startTimestamp: 0,
          status: ['string'],
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Openlayer.NotFoundError);
  });
});
