// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class TestResults extends APIResource {
  /**
   * List the test results for a project commit (project version).
   */
  list(
    projectVersionID: string,
    query: TestResultListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<TestResultListResponse> {
    return this._client.get(path`/versions/${projectVersionID}/results`, { query, ...options });
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
}

export interface TestResultListParams {
  /**
   * Filter for archived tests.
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
