// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { isRequestOptions } from '../../core';
import * as Core from '../../core';
import * as InferencePipelinesAPI from './inference-pipelines';
import * as DataAPI from './data';
import * as RowsAPI from './rows';
import * as TestResultsAPI from './test-results';

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

export namespace InferencePipelines {
  export import InferencePipelineRetrieveResponse = InferencePipelinesAPI.InferencePipelineRetrieveResponse;
  export import InferencePipelineUpdateResponse = InferencePipelinesAPI.InferencePipelineUpdateResponse;
  export import InferencePipelineUpdateParams = InferencePipelinesAPI.InferencePipelineUpdateParams;
  export import Data = DataAPI.Data;
  export import DataStreamResponse = DataAPI.DataStreamResponse;
  export import DataStreamParams = DataAPI.DataStreamParams;
  export import Rows = RowsAPI.Rows;
  export import RowUpdateResponse = RowsAPI.RowUpdateResponse;
  export import RowUpdateParams = RowsAPI.RowUpdateParams;
  export import TestResults = TestResultsAPI.TestResults;
  export import TestResultListResponse = TestResultsAPI.TestResultListResponse;
  export import TestResultListParams = TestResultsAPI.TestResultListParams;
}
