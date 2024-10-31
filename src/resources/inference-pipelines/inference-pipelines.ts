// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { isRequestOptions } from '../../core';
import * as Core from '../../core';
import * as DataAPI from './data';
import { Data, DataStreamParams, DataStreamResponse } from './data';
import * as RowsAPI from './rows';
import { RowUpdateParams, RowUpdateResponse, Rows } from './rows';
import * as TestResultsAPI from './test-results';
import { TestResultListParams, TestResultListResponse, TestResults } from './test-results';

export class InferencePipelines extends APIResource {
  data: DataAPI.Data = new DataAPI.Data(this._client);
  rows: RowsAPI.Rows = new RowsAPI.Rows(this._client);
  testResults: TestResultsAPI.TestResults = new TestResultsAPI.TestResults(this._client);

  /**
   * Retrieve inference pipeline.
   */
  retrieve(
    inferencePipelineId: string,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InferencePipelineRetrieveResponse> {
    return this._client.get(`/inference-pipelines/${inferencePipelineId}`, options);
  }

  /**
   * Update inference pipeline.
   */
  update(
    inferencePipelineId: string,
    body?: InferencePipelineUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InferencePipelineUpdateResponse>;
  update(
    inferencePipelineId: string,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InferencePipelineUpdateResponse>;
  update(
    inferencePipelineId: string,
    body: InferencePipelineUpdateParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<InferencePipelineUpdateResponse> {
    if (isRequestOptions(body)) {
      return this.update(inferencePipelineId, {}, body);
    }
    return this._client.put(`/inference-pipelines/${inferencePipelineId}`, { body, ...options });
  }

  /**
   * Delete inference pipeline.
   */
  delete(inferencePipelineId: string, options?: Core.RequestOptions): Core.APIPromise<void> {
    return this._client.delete(`/inference-pipelines/${inferencePipelineId}`, {
      ...options,
      headers: { Accept: '*/*', ...options?.headers },
    });
  }
}

export interface InferencePipelineRetrieveResponse {
  /**
   * The inference pipeline id.
   */
  id: string;

  /**
   * The creation date.
   */
  dateCreated: string;

  /**
   * The last test evaluation date.
   */
  dateLastEvaluated: string | null;

  /**
   * The last data sample received date.
   */
  dateLastSampleReceived: string | null;

  /**
   * The next test evaluation date.
   */
  dateOfNextEvaluation: string | null;

  /**
   * The last updated date.
   */
  dateUpdated: string;

  /**
   * The inference pipeline description.
   */
  description: string | null;

  /**
   * The number of tests failing.
   */
  failingGoalCount: number;

  links: InferencePipelineRetrieveResponse.Links;

  /**
   * The inference pipeline name.
   */
  name: string;

  /**
   * The number of tests passing.
   */
  passingGoalCount: number;

  /**
   * The project id.
   */
  projectId: string;

  /**
   * The status of test evaluation for the inference pipeline.
   */
  status: 'queued' | 'running' | 'paused' | 'failed' | 'completed' | 'unknown';

  /**
   * The status message of test evaluation for the inference pipeline.
   */
  statusMessage: string | null;

  /**
   * The total number of tests.
   */
  totalGoalCount: number;
}

export namespace InferencePipelineRetrieveResponse {
  export interface Links {
    app: string;
  }
}

export interface InferencePipelineUpdateResponse {
  /**
   * The inference pipeline id.
   */
  id: string;

  /**
   * The creation date.
   */
  dateCreated: string;

  /**
   * The last test evaluation date.
   */
  dateLastEvaluated: string | null;

  /**
   * The last data sample received date.
   */
  dateLastSampleReceived: string | null;

  /**
   * The next test evaluation date.
   */
  dateOfNextEvaluation: string | null;

  /**
   * The last updated date.
   */
  dateUpdated: string;

  /**
   * The inference pipeline description.
   */
  description: string | null;

  /**
   * The number of tests failing.
   */
  failingGoalCount: number;

  links: InferencePipelineUpdateResponse.Links;

  /**
   * The inference pipeline name.
   */
  name: string;

  /**
   * The number of tests passing.
   */
  passingGoalCount: number;

  /**
   * The project id.
   */
  projectId: string;

  /**
   * The status of test evaluation for the inference pipeline.
   */
  status: 'queued' | 'running' | 'paused' | 'failed' | 'completed' | 'unknown';

  /**
   * The status message of test evaluation for the inference pipeline.
   */
  statusMessage: string | null;

  /**
   * The total number of tests.
   */
  totalGoalCount: number;
}

export namespace InferencePipelineUpdateResponse {
  export interface Links {
    app: string;
  }
}

export interface InferencePipelineUpdateParams {
  /**
   * The inference pipeline description.
   */
  description?: string | null;

  /**
   * The inference pipeline name.
   */
  name?: string;

  /**
   * The storage uri of your reference dataset. We recommend using the Python SDK or
   * the UI to handle your reference dataset updates.
   */
  referenceDatasetUri?: string | null;
}

InferencePipelines.Data = Data;
InferencePipelines.Rows = Rows;
InferencePipelines.TestResults = TestResults;

export declare namespace InferencePipelines {
  export {
    type InferencePipelineRetrieveResponse as InferencePipelineRetrieveResponse,
    type InferencePipelineUpdateResponse as InferencePipelineUpdateResponse,
    type InferencePipelineUpdateParams as InferencePipelineUpdateParams,
  };

  export {
    Data as Data,
    type DataStreamResponse as DataStreamResponse,
    type DataStreamParams as DataStreamParams,
  };

  export {
    Rows as Rows,
    type RowUpdateResponse as RowUpdateResponse,
    type RowUpdateParams as RowUpdateParams,
  };

  export {
    TestResults as TestResults,
    type TestResultListResponse as TestResultListResponse,
    type TestResultListParams as TestResultListParams,
  };
}
