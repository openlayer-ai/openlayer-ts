// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Openlayer from 'openlayer';

const client = new Openlayer({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource sections', () => {
  test('listRules: only required params', async () => {
    const responsePromise = client.governance.frameworks.sections.listRules(
      '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
      { frameworkId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' },
    );
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('listRules: required and optional params', async () => {
    const response = await client.governance.frameworks.sections.listRules(
      '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
      {
        frameworkId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
        includeResults: true,
        includeSubsectionRules: true,
        page: 1,
        perPage: 1,
        projectId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
        status: 'passing',
      },
    );
  });
});
