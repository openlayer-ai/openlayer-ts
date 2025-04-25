// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { isRequestOptions } from '../../core';
import * as Core from '../../core';

export class TestResults extends APIResource {
  /**
   * List the latest test results for an inference pipeline.
   */
  list(
    inferencePipelineId: string,
    query?: TestResultListParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TestResultListResponse>;
  list(inferencePipelineId: string, options?: Core.RequestOptions): Core.APIPromise<TestResultListResponse>;
  list(
    inferencePipelineId: string,
    query: TestResultListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<TestResultListResponse> {
    if (isRequestOptions(query)) {
      return this.list(inferencePipelineId, {}, query);
    }
    return this._client.get(`/inference-pipelines/${inferencePipelineId}/results`, { query, ...options });
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
      subtype:
        | 'anomalousColumnCount'
        | 'characterLength'
        | 'classImbalanceRatio'
        | 'expectColumnAToBeInColumnB'
        | 'columnAverage'
        | 'columnDrift'
        | 'columnStatistic'
        | 'columnValuesMatch'
        | 'conflictingLabelRowCount'
        | 'containsPii'
        | 'containsValidUrl'
        | 'correlatedFeatureCount'
        | 'customMetricThreshold'
        | 'duplicateRowCount'
        | 'emptyFeature'
        | 'emptyFeatureCount'
        | 'driftedFeatureCount'
        | 'featureMissingValues'
        | 'featureValueValidation'
        | 'greatExpectations'
        | 'groupByColumnStatsCheck'
        | 'illFormedRowCount'
        | 'isCode'
        | 'isJson'
        | 'llmRubricThresholdV2'
        | 'labelDrift'
        | 'metricThreshold'
        | 'newCategoryCount'
        | 'newLabelCount'
        | 'nullRowCount'
        | 'rowCount'
        | 'ppScoreValueValidation'
        | 'quasiConstantFeature'
        | 'quasiConstantFeatureCount'
        | 'sqlQuery'
        | 'dtypeValidation'
        | 'sentenceLength'
        | 'sizeRatio'
        | 'specialCharactersRatio'
        | 'stringValidation'
        | 'trainValLeakageRowCount';

      /**
       * Whether the test is suggested or user-created.
       */
      suggested: boolean;

      thresholds: Array<Goal.Threshold>;

      /**
       * The test type.
       */
      type: 'integrity' | 'consistency' | 'performance';

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

        /**
         * The insight parameters. Required only for some test subtypes.
         */
        insightParameters?: Array<Threshold.InsightParameter> | null;

        /**
         * The measurement to be evaluated.
         */
        measurement?: string;

        /**
         * The operator to be used for the evaluation.
         */
        operator?: 'is' | '>' | '>=' | '<' | '<=' | '!=';

        /**
         * Whether to use automatic anomaly detection or manual thresholds
         */
        thresholdMode?: 'automatic' | 'manual';

        /**
         * The value to be compared.
         */
        value?: number | boolean | string | Array<string>;
      }

      export namespace Threshold {
        export interface InsightParameter {
          /**
           * The name of the insight filter.
           */
          name: string;

          value: unknown;
        }
      }
    }
  }
}

export interface TestResultListParams {
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
