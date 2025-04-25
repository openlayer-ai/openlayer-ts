// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Openlayer from 'openlayer';
import { Response } from 'node-fetch';

const client = new Openlayer({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource tests', () => {
  test('create: only required params', async () => {
    const responsePromise = client.projects.tests.create('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      description: 'This test checks for duplicate rows in the dataset.',
      name: 'No duplicate rows',
      subtype: 'duplicateRowCount',
      thresholds: [{}],
      type: 'integrity',
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
    const response = await client.projects.tests.create('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      description: 'This test checks for duplicate rows in the dataset.',
      name: 'No duplicate rows',
      subtype: 'duplicateRowCount',
      thresholds: [
        {
          insightName: 'duplicateRowCount',
          insightParameters: [{ name: 'column_name', value: 'Age' }],
          measurement: 'duplicateRowCount',
          operator: '<=',
          thresholdMode: 'automatic',
          value: 0,
        },
      ],
      type: 'integrity',
      archived: false,
      delayWindow: 0,
      evaluationWindow: 3600,
      usesMlModel: false,
      usesProductionData: false,
      usesReferenceDataset: false,
      usesTrainingDataset: false,
      usesValidationDataset: true,
    });
  });

  test('update: only required params', async () => {
    const responsePromise = client.projects.tests.update('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      payloads: [{ id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' }],
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
    const response = await client.projects.tests.update('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
      payloads: [
        {
          id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
          archived: false,
          description: 'This test checks for duplicate rows in the dataset.',
          name: 'No duplicate rows',
          suggested: false,
          thresholds: [
            {
              insightName: 'duplicateRowCount',
              insightParameters: [{ name: 'column_name', value: 'Age' }],
              measurement: 'duplicateRowCount',
              operator: '<=',
              thresholdMode: 'automatic',
              value: 0,
            },
          ],
        },
      ],
    });
  });

  test('list', async () => {
    const responsePromise = client.projects.tests.list('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('list: request options instead of params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.projects.tests.list('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', {
        path: '/_stainless_unknown_path',
      }),
    ).rejects.toThrow(Openlayer.NotFoundError);
  });

  test('list: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.projects.tests.list(
        '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
        {
          includeArchived: true,
          originVersionId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          page: 1,
          perPage: 1,
          suggested: true,
          type: 'integrity',
          usesProductionData: true,
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Openlayer.NotFoundError);
  });
});
