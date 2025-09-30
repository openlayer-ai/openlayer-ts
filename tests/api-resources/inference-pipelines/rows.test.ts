// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Openlayer from 'openlayer';

const client = new Openlayer({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource rows', () => {
  test('update: only required params', async () => {
    const responsePromise = client.inferencePipelines.rows.update('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      inferenceId: 'inferenceId',
      row: {},
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
    const response = await client.inferencePipelines.rows.update('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      inferenceId: 'inferenceId',
      row: {},
      config: {
        groundTruthColumnName: 'ground_truth',
        humanFeedbackColumnName: 'human_feedback',
        inferenceIdColumnName: 'id',
        latencyColumnName: 'latency',
        timestampColumnName: 'timestamp',
      },
    });
  });
});
