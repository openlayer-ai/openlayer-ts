// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Openlayer from 'openlayer';
import { Response } from 'node-fetch';

const client = new Openlayer({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource data', () => {
  test('stream: only required params', async () => {
    const responsePromise = client.inferencePipelines.data.stream('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      config: { outputColumnName: 'output' },
      rows: [{ user_query: 'bar', output: 'bar', tokens: 'bar', cost: 'bar', timestamp: 'bar' }],
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('stream: required and optional params', async () => {
    const response = await client.inferencePipelines.data.stream('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      config: {
        outputColumnName: 'output',
        contextColumnName: 'context',
        costColumnName: 'cost',
        groundTruthColumnName: 'ground_truth',
        inferenceIdColumnName: 'id',
        inputVariableNames: ['user_query'],
        latencyColumnName: 'latency',
        metadata: {},
        numOfTokenColumnName: 'tokens',
        prompt: [{ content: '{{ user_query }}', role: 'user' }],
        questionColumnName: 'question',
        timestampColumnName: 'timestamp',
      },
      rows: [{ user_query: 'bar', output: 'bar', tokens: 'bar', cost: 'bar', timestamp: 'bar' }],
    });
  });
});
