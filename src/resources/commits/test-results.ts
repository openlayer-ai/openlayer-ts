// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { isRequestOptions } from '../../core';
import * as Core from '../../core';

export class TestResults extends APIResource {
  /**
   * List the test results for a project commit (project version).
   */
  list(
    projectVersionId: string,
    query?: TestResultListParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TestResultListResponse>;
  list(projectVersionId: string, options?: Core.RequestOptions): Core.APIPromise<TestResultListResponse>;
  list(
    projectVersionId: string,
    query: TestResultListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<TestResultListResponse> {
    if (isRequestOptions(query)) {
      return this.list(projectVersionId, {}, query);
    }
    return this._client.get(`/versions/${projectVersionId}/results`, { query, ...options });
  }
}

export interface TestResultListResponse {
  items: Array<TestResultListResponse.Item>;
}

export namespace TestResultListResponse {
  export interface Item {
    /**
     * Project version (commit) id.
     */
    id: string;

    /**
     * The creation date.
     */
    dateCreated: string;

    /**
     * The data end date.
     */
    dateDataEnds: string | null;

    /**
     * The data start date.
     */
    dateDataStarts: string | null;

    /**
     * The last updated date.
     */
    dateUpdated: string;

    /**
     * The inference pipeline id.
     */
    inferencePipelineId: string | null;

    /**
     * The project version (commit) id.
     */
    projectVersionId: string | null;

    /**
     * The status of the test.
     */
    status: 'running' | 'passing' | 'failing' | 'skipped' | 'error';

    /**
     * The status message.
     */
    statusMessage: string | null;

    goal?: Item.Goal;

    /**
     * The test id.
     */
    goalId?: string | null;
  }

  export namespace Item {
    export interface Goal {
      /**
       * The test id.
       */
      id: string;

      /**
       * The number of comments on the test.
       */
      commentCount: number;

      /**
       * The test creator id.
       */
      creatorId: string | null;

      /**
       * The date the test was archived.
       */
      dateArchived: string | null;

      /**
       * The creation date.
       */
      dateCreated: string;

      /**
       * The last updated date.
       */
      dateUpdated: string;

      /**
       * The test description.
       */
      description: unknown | null;

      /**
       * The test name.
       */
      name: string;

      /**
       * The test number.
       */
      number: number;

      /**
       * The project version (commit) id where the test was created.
       */
      originProjectVersionId: string | null;

      /**
       * The test subtype.
       */
      subtype: string;

      /**
       * Whether the test is suggested or user-created.
       */
      suggested: boolean;

      thresholds: Array<Goal.Threshold>;

      /**
       * The test type.
       */
      type: string;

      /**
       * Whether the test is archived.
       */
      archived?: boolean;

      /**
       * The delay window in seconds. Only applies to tests that use production data.
       */
      delayWindow?: number | null;

      /**
       * The evaluation window in seconds. Only applies to tests that use production
       * data.
       */
      evaluationWindow?: number | null;

      /**
       * Whether the test uses an ML model.
       */
      usesMlModel?: boolean;

      /**
       * Whether the test uses production data (monitoring mode only).
       */
      usesProductionData?: boolean;

      /**
       * Whether the test uses a reference dataset (monitoring mode only).
       */
      usesReferenceDataset?: boolean;

      /**
       * Whether the test uses a training dataset.
       */
      usesTrainingDataset?: boolean;

      /**
       * Whether the test uses a validation dataset.
       */
      usesValidationDataset?: boolean;
    }

    export namespace Goal {
      export interface Threshold {
        /**
         * The insight name to be evaluated.
         */
        insightName?: string;

        insightParameters?: Array<unknown>;

        /**
         * The measurement to be evaluated.
         */
        measurement?: string;

        /**
         * The operator to be used for the evaluation.
         */
        operator?: string;

        /**
         * The value to be compared.
         */
        value?: number | boolean | string | Array<string>;
      }
    }
  }
}

export interface TestResultListParams {
  /**
   * Include archived goals.
   */
  includeArchived?: boolean;

  /**
   * The page to return in a paginated query.
   */
  page?: number;

  /**
   * Maximum number of items to return per page.
   */
  perPage?: number;

  /**
   * Filter list of test results by status. Available statuses are `running`,
   * `passing`, `failing`, `skipped`, and `error`.
   */
  status?: 'running' | 'passing' | 'failing' | 'skipped' | 'error';

  /**
   * Filter objects by test type. Available types are `integrity`, `consistency`,
   * `performance`, `fairness`, and `robustness`.
   */
  type?: 'integrity' | 'consistency' | 'performance' | 'fairness' | 'robustness';
}

export declare namespace TestResults {
  export {
    type TestResultListResponse as TestResultListResponse,
    type TestResultListParams as TestResultListParams,
  };
}
