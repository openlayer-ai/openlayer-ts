// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { isRequestOptions } from '../../core';
import * as Core from '../../core';
import * as InferencePipelinesAPI from './inference-pipelines';

export class InferencePipelines extends APIResource {
  /**
   * Create an inference pipeline under a project.
   */
  create(
    id: string,
    body: InferencePipelineCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InferencePipelineCreateResponse> {
    return this._client.post(`/projects/${id}/inference-pipelines`, { body, ...options });
  }

  /**
   * List the inference pipelines in a project.
   */
  list(
    id: string,
    query?: InferencePipelineListParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InferencePipelineListResponse>;
  list(id: string, options?: Core.RequestOptions): Core.APIPromise<InferencePipelineListResponse>;
  list(
    id: string,
    query: InferencePipelineListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<InferencePipelineListResponse> {
    if (isRequestOptions(query)) {
      return this.list(id, {}, query);
    }
    return this._client.get(`/projects/${id}/inference-pipelines`, { query, ...options });
  }
}

export interface InferencePipelineCreateResponse {
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

  links: InferencePipelineCreateResponse.Links;

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

  /**
   * The storage type.
   */
  storageType?: 'local' | 's3' | 'gcs' | 'azure';
}

export namespace InferencePipelineCreateResponse {
  export interface Links {
    app: string;
  }
}

export interface InferencePipelineListResponse {
  _meta: InferencePipelineListResponse._Meta;

  items: Array<InferencePipelineListResponse.Item>;
}

export namespace InferencePipelineListResponse {
  export interface _Meta {
    /**
     * The current page.
     */
    page: number;

    /**
     * The number of items per page.
     */
    perPage: number;

    /**
     * The total number of items.
     */
    totalItems: number;

    /**
     * The total number of pages.
     */
    totalPages: number;
  }

  export interface Item {
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

    links: Item.Links;

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

    /**
     * The storage type.
     */
    storageType?: 'local' | 's3' | 'gcs' | 'azure';
  }

  export namespace Item {
    export interface Links {
      app: string;
    }
  }
}

export interface InferencePipelineCreateParams {
  /**
   * The inference pipeline description.
   */
  description: string | null;

  /**
   * The inference pipeline name.
   */
  name: string;

  /**
   * The reference dataset URI.
   */
  referenceDatasetUri?: string | null;

  /**
   * The storage type.
   */
  storageType?: 'local' | 's3' | 'gcs' | 'azure';
}

export interface InferencePipelineListParams {
  /**
   * Filter list of items by name.
   */
  name?: string;

  /**
   * The page to return in a paginated query.
   */
  page?: number;

  /**
   * Maximum number of items to return per page.
   */
  perPage?: number;
}

export namespace InferencePipelines {
  export import InferencePipelineCreateResponse = InferencePipelinesAPI.InferencePipelineCreateResponse;
  export import InferencePipelineListResponse = InferencePipelinesAPI.InferencePipelineListResponse;
  export import InferencePipelineCreateParams = InferencePipelinesAPI.InferencePipelineCreateParams;
  export import InferencePipelineListParams = InferencePipelinesAPI.InferencePipelineListParams;
}
