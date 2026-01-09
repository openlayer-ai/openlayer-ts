// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../core/resource';
import { APIPromise } from '../core/api-promise';
import { RequestOptions } from '../internal/request-options';
import { path } from '../internal/utils/path';

export class Tests extends APIResource {
  /**
   * Triggers one-off evaluation of a specific monitoring test for a custom timestamp
   * range. This allows evaluating tests for historical data or custom time periods
   * outside the regular evaluation window schedule. It also allows overwriting the
   * existing test results.
   *
   * @example
   * ```ts
   * const response = await client.tests.evaluate(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { endTimestamp: 1700006400, startTimestamp: 1699920000 },
   * );
   * ```
   */
  evaluate(
    testID: string,
    body: TestEvaluateParams,
    options?: RequestOptions,
  ): APIPromise<TestEvaluateResponse> {
    return this._client.post(path`/tests/${testID}/evaluate`, { body, ...options });
  }

  /**
   * List the test results for a test.
   *
   * @example
   * ```ts
   * const response = await client.tests.listResults(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  listResults(
    testID: string,
    query: TestListResultsParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<TestListResultsResponse> {
    return this._client.get(path`/tests/${testID}/results`, { query, ...options });
  }
}

export interface TestEvaluateResponse {
  message: string;

  /**
   * Number of inference pipelines the test was queued for evaluation on
   */
  pipelineCount: number;

  /**
   * The end timestamp you requested (in seconds)
   */
  requestedEndTimestamp: number;

  /**
   * The start timestamp you requested (in seconds)
   */
  requestedStartTimestamp: number;

  /**
   * Array of background task information for each pipeline evaluation
   */
  tasks: Array<TestEvaluateResponse.Task>;
}

export namespace TestEvaluateResponse {
  export interface Task {
    /**
     * ID of the inference pipeline this task is for
     */
    pipelineId: string;

    /**
     * ID of the background task
     */
    taskResultId: string;

    /**
     * URL to check the status of this background task
     */
    taskResultUrl: string;
  }
}

export interface TestListResultsResponse {
  items: Array<TestListResultsResponse.Item>;

  lastUnskippedResult?: TestListResultsResponse.LastUnskippedResult | null;
}

export namespace TestListResultsResponse {
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

    expectedValues?: Array<Item.ExpectedValue>;

    goal?: Item.Goal;

    /**
     * The test id.
     */
    goalId?: string | null;

    /**
     * The URL to the rows of the test result.
     */
    rows?: string;

    /**
     * The body of the rows request.
     */
    rowsBody?: Item.RowsBody | null;
  }

  export namespace Item {
    export interface ExpectedValue {
      /**
       * the lower threshold for the expected value
       */
      lowerThreshold?: number | null;

      /**
       * One of the `measurement` values in the test's thresholds
       */
      measurement?: string;

      /**
       * The upper threshold for the expected value
       */
      upperThreshold?: number | null;
    }

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
        insightName?:
          | 'characterLength'
          | 'classImbalance'
          | 'expectColumnAToBeInColumnB'
          | 'columnAverage'
          | 'columnDrift'
          | 'columnValuesMatch'
          | 'confidenceDistribution'
          | 'conflictingLabelRowCount'
          | 'containsPii'
          | 'containsValidUrl'
          | 'correlatedFeatures'
          | 'customMetric'
          | 'duplicateRowCount'
          | 'emptyFeatures'
          | 'featureDrift'
          | 'featureProfile'
          | 'greatExpectations'
          | 'groupByColumnStatsCheck'
          | 'illFormedRowCount'
          | 'isCode'
          | 'isJson'
          | 'llmRubricV2'
          | 'labelDrift'
          | 'metrics'
          | 'newCategories'
          | 'newLabels'
          | 'nullRowCount'
          | 'ppScore'
          | 'quasiConstantFeatures'
          | 'sentenceLength'
          | 'sizeRatio'
          | 'specialCharacters'
          | 'stringValidation'
          | 'trainValLeakageRowCount';

        /**
         * The insight parameters. Required only for some test subtypes. For example, for
         * tests that require a column name, the insight parameters will be [{'name':
         * 'column_name', 'value': 'Age'}]
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

    /**
     * The body of the rows request.
     */
    export interface RowsBody {
      columnFilters?: Array<
        RowsBody.SetColumnFilter | RowsBody.NumericColumnFilter | RowsBody.StringColumnFilter
      > | null;

      excludeRowIdList?: Array<number> | null;

      notSearchQueryAnd?: Array<string> | null;

      notSearchQueryOr?: Array<string> | null;

      rowIdList?: Array<number> | null;

      searchQueryAnd?: Array<string> | null;

      searchQueryOr?: Array<string> | null;
    }

    export namespace RowsBody {
      export interface SetColumnFilter {
        /**
         * The name of the column.
         */
        measurement: string;

        operator: 'contains_none' | 'contains_any' | 'contains_all' | 'one_of' | 'none_of';

        value: Array<string | number>;
      }

      export interface NumericColumnFilter {
        /**
         * The name of the column.
         */
        measurement: string;

        operator: '>' | '>=' | 'is' | '<' | '<=' | '!=';

        value: number | null;
      }

      export interface StringColumnFilter {
        /**
         * The name of the column.
         */
        measurement: string;

        operator: 'is' | '!=';

        value: string | boolean;
      }
    }
  }

  export interface LastUnskippedResult {
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

    expectedValues?: Array<LastUnskippedResult.ExpectedValue>;

    goal?: LastUnskippedResult.Goal;

    /**
     * The test id.
     */
    goalId?: string | null;

    /**
     * The URL to the rows of the test result.
     */
    rows?: string;

    /**
     * The body of the rows request.
     */
    rowsBody?: LastUnskippedResult.RowsBody | null;
  }

  export namespace LastUnskippedResult {
    export interface ExpectedValue {
      /**
       * the lower threshold for the expected value
       */
      lowerThreshold?: number | null;

      /**
       * One of the `measurement` values in the test's thresholds
       */
      measurement?: string;

      /**
       * The upper threshold for the expected value
       */
      upperThreshold?: number | null;
    }

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
        insightName?:
          | 'characterLength'
          | 'classImbalance'
          | 'expectColumnAToBeInColumnB'
          | 'columnAverage'
          | 'columnDrift'
          | 'columnValuesMatch'
          | 'confidenceDistribution'
          | 'conflictingLabelRowCount'
          | 'containsPii'
          | 'containsValidUrl'
          | 'correlatedFeatures'
          | 'customMetric'
          | 'duplicateRowCount'
          | 'emptyFeatures'
          | 'featureDrift'
          | 'featureProfile'
          | 'greatExpectations'
          | 'groupByColumnStatsCheck'
          | 'illFormedRowCount'
          | 'isCode'
          | 'isJson'
          | 'llmRubricV2'
          | 'labelDrift'
          | 'metrics'
          | 'newCategories'
          | 'newLabels'
          | 'nullRowCount'
          | 'ppScore'
          | 'quasiConstantFeatures'
          | 'sentenceLength'
          | 'sizeRatio'
          | 'specialCharacters'
          | 'stringValidation'
          | 'trainValLeakageRowCount';

        /**
         * The insight parameters. Required only for some test subtypes. For example, for
         * tests that require a column name, the insight parameters will be [{'name':
         * 'column_name', 'value': 'Age'}]
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

    /**
     * The body of the rows request.
     */
    export interface RowsBody {
      columnFilters?: Array<
        RowsBody.SetColumnFilter | RowsBody.NumericColumnFilter | RowsBody.StringColumnFilter
      > | null;

      excludeRowIdList?: Array<number> | null;

      notSearchQueryAnd?: Array<string> | null;

      notSearchQueryOr?: Array<string> | null;

      rowIdList?: Array<number> | null;

      searchQueryAnd?: Array<string> | null;

      searchQueryOr?: Array<string> | null;
    }

    export namespace RowsBody {
      export interface SetColumnFilter {
        /**
         * The name of the column.
         */
        measurement: string;

        operator: 'contains_none' | 'contains_any' | 'contains_all' | 'one_of' | 'none_of';

        value: Array<string | number>;
      }

      export interface NumericColumnFilter {
        /**
         * The name of the column.
         */
        measurement: string;

        operator: '>' | '>=' | 'is' | '<' | '<=' | '!=';

        value: number | null;
      }

      export interface StringColumnFilter {
        /**
         * The name of the column.
         */
        measurement: string;

        operator: 'is' | '!=';

        value: string | boolean;
      }
    }
  }
}

export interface TestEvaluateParams {
  /**
   * End timestamp in seconds (Unix epoch)
   */
  endTimestamp: number;

  /**
   * Start timestamp in seconds (Unix epoch)
   */
  startTimestamp: number;

  /**
   * ID of the inference pipeline to evaluate. If not provided, all inference
   * pipelines the test applies to will be evaluated.
   */
  inferencePipelineId?: string;

  /**
   * Whether to overwrite existing test results
   */
  overwriteResults?: boolean;
}

export interface TestListResultsParams {
  /**
   * Filter for results that use data starting before the end timestamp.
   */
  endTimestamp?: number;

  /**
   * Include the insights linked to each test result
   */
  includeInsights?: boolean;

  /**
   * Retrive test results for a specific inference pipeline.
   */
  inferencePipelineId?: string | null;

  /**
   * The page to return in a paginated query.
   */
  page?: number;

  /**
   * Maximum number of items to return per page.
   */
  perPage?: number;

  /**
   * Retrive test results for a specific project version.
   */
  projectVersionId?: string | null;

  /**
   * Filter for results that use data ending after the start timestamp.
   */
  startTimestamp?: number;

  /**
   * Filter by status(es).
   */
  status?: Array<string>;
}

export declare namespace Tests {
  export {
    type TestEvaluateResponse as TestEvaluateResponse,
    type TestListResultsResponse as TestListResultsResponse,
    type TestEvaluateParams as TestEvaluateParams,
    type TestListResultsParams as TestListResultsParams,
  };
}
