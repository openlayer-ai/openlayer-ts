// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Openlayer from 'openlayer';
import { Response } from 'node-fetch';

const openlayer = new Openlayer({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource projects', () => {
  test('create: only required params', async () => {
    const responsePromise = openlayer.projects.create({ name: 'My Project', taskType: 'llm-base' });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  test('create: required and optional params', async () => {
    const response = await openlayer.projects.create({
      name: 'My Project',
      taskType: 'llm-base',
      description: 'My project description.',
      gitRepo: {
        gitId: 0,
        branch: 'string',
        rootDir: 'string',
        gitAccountId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
      },
      slackChannelId: 'C01B2PZQX1Z',
      slackChannelName: '#my-project',
      slackChannelNotificationsEnabled: true,
    });
  });

  test('list', async () => {
    const responsePromise = openlayer.projects.list();
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
    await expect(openlayer.projects.list({ path: '/_stainless_unknown_path' })).rejects.toThrow(
      Openlayer.NotFoundError,
    );
  });

  test('list: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      openlayer.projects.list(
        { name: 'string', page: 1, perPage: 1, taskType: 'llm-base' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Openlayer.NotFoundError);
  });
});
