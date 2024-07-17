// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Openlayer from 'openlayer';
import { Response } from 'node-fetch';

const openlayer = new Openlayer({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource rows', () => {
  test('stream: only required params', async () => {
    const responsePromise = openlayer.inferencePipelines.rows.stream('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
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

  test('stream: required and optional params', async () => {
    const response = await openlayer.inferencePipelines.rows.stream('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      inferenceId: 'inferenceId',
      row: {},
      config: {
        inferenceIdColumnName: 'id',
        latencyColumnName: 'latency',
        timestampColumnName: 'timestamp',
        groundTruthColumnName: 'ground_truth',
        humanFeedbackColumnName: 'human_feedback',
      },
    });
  });
});
