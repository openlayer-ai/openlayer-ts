// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Tests extends APIResource {
  /**
   * Create a test.
   *
   * @example
   * ```ts
   * const test = await client.projects.tests.create(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   {
   *     description:
   *       'This test checks for duplicate rows in the dataset.',
   *     name: 'No duplicate rows',
   *     subtype: 'duplicateRowCount',
   *     thresholds: [{}],
   *     type: 'integrity',
   *   },
   * );
   * ```
   */
  create(
    projectID: string,
    body: TestCreateParams,
    options?: RequestOptions,
  ): APIPromise<TestCreateResponse> {
    return this._client.post(path`/projects/${projectID}/tests`, { body, ...options });
  }

  /**
   * Update tests.
   *
   * @example
   * ```ts
   * const test = await client.projects.tests.update(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   {
   *     payloads: [
   *       { id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' },
   *     ],
   *   },
   * );
   * ```
   */
  update(
    projectID: string,
    body: TestUpdateParams,
    options?: RequestOptions,
  ): APIPromise<TestUpdateResponse> {
    return this._client.put(path`/projects/${projectID}/tests`, { body, ...options });
  }

  /**
   * List tests under a project.
   *
   * @example
   * ```ts
   * const tests = await client.projects.tests.list(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  list(
    projectID: string,
    query: TestListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<TestListResponse> {
    return this._client.get(path`/projects/${projectID}/tests`, { query, ...options });
  }
}

export interface TestCreateResponse {
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

  thresholds: Array<TestCreateResponse.Threshold>;

  /**
   * The test type.
   */
  type: 'integrity' | 'consistency' | 'performance';

  /**
   * Whether the test is archived.
   */
  archived?: boolean;

  /**
   * Whether to apply the test to all pipelines (data sources) or to a specific set
   * of pipelines. Only applies to tests that use production data.
   */
  defaultToAllPipelines?: boolean | null;

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
   * Array of pipelines (data sources) to which the test should not be applied. Only
   * applies to tests that use production data.
   */
  excludePipelines?: Array<string> | null;

  /**
   * Whether to include historical data in the test result. Only applies to tests
   * that use production data.
   */
  includeHistoricalData?: boolean | null;

  /**
   * Array of pipelines (data sources) to which the test should be applied. Only
   * applies to tests that use production data.
   */
  includePipelines?: Array<string> | null;

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

export namespace TestCreateResponse {
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

export interface TestUpdateResponse {
  taskResultId?: string;

  taskResultUrl?: string;
}

export interface TestListResponse {
  items: Array<TestListResponse.Item>;
}

export namespace TestListResponse {
  export interface Item {
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

    thresholds: Array<Item.Threshold>;

    /**
     * The test type.
     */
    type: 'integrity' | 'consistency' | 'performance';

    /**
     * Whether the test is archived.
     */
    archived?: boolean;

    /**
     * Whether to apply the test to all pipelines (data sources) or to a specific set
     * of pipelines. Only applies to tests that use production data.
     */
    defaultToAllPipelines?: boolean | null;

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
     * Array of pipelines (data sources) to which the test should not be applied. Only
     * applies to tests that use production data.
     */
    excludePipelines?: Array<string> | null;

    /**
     * Whether to include historical data in the test result. Only applies to tests
     * that use production data.
     */
    includeHistoricalData?: boolean | null;

    /**
     * Array of pipelines (data sources) to which the test should be applied. Only
     * applies to tests that use production data.
     */
    includePipelines?: Array<string> | null;

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

  export namespace Item {
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
}

export interface TestCreateParams {
  /**
   * The test description.
   */
  description: unknown | null;

  /**
   * The test name.
   */
  name: string;

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

  thresholds: Array<TestCreateParams.Threshold>;

  /**
   * The test type.
   */
  type: 'integrity' | 'consistency' | 'performance';

  /**
   * Whether the test is archived.
   */
  archived?: boolean;

  /**
   * Whether to apply the test to all pipelines (data sources) or to a specific set
   * of pipelines. Only applies to tests that use production data.
   */
  defaultToAllPipelines?: boolean | null;

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
   * Array of pipelines (data sources) to which the test should not be applied. Only
   * applies to tests that use production data.
   */
  excludePipelines?: Array<string> | null;

  /**
   * Whether to include historical data in the test result. Only applies to tests
   * that use production data.
   */
  includeHistoricalData?: boolean | null;

  /**
   * Array of pipelines (data sources) to which the test should be applied. Only
   * applies to tests that use production data.
   */
  includePipelines?: Array<string> | null;

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

export namespace TestCreateParams {
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

export interface TestUpdateParams {
  payloads: Array<TestUpdateParams.Payload>;
}

export namespace TestUpdateParams {
  export interface Payload {
    id: string;

    /**
     * Whether the test is archived.
     */
    archived?: boolean;

    /**
     * The test description.
     */
    description?: unknown | null;

    /**
     * The test name.
     */
    name?: string;

    suggested?: false;

    thresholds?: Array<Payload.Threshold>;
  }

  export namespace Payload {
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
}

export interface TestListParams {
  /**
   * Filter for archived tests.
   */
  includeArchived?: boolean;

  /**
   * Retrive tests created by a specific project version.
   */
  originVersionId?: string | null;

  /**
   * The page to return in a paginated query.
   */
  page?: number;

  /**
   * Maximum number of items to return per page.
   */
  perPage?: number;

  /**
   * Filter for suggested tests.
   */
  suggested?: boolean;

  /**
   * Filter objects by test type. Available types are `integrity`, `consistency`,
   * `performance`, `fairness`, and `robustness`.
   */
  type?: 'integrity' | 'consistency' | 'performance' | 'fairness' | 'robustness';

  /**
   * Retrive tests with usesProductionData (monitoring).
   */
  usesProductionData?: boolean | null;
}

export declare namespace Tests {
  export {
    type TestCreateResponse as TestCreateResponse,
    type TestUpdateResponse as TestUpdateResponse,
    type TestListResponse as TestListResponse,
    type TestCreateParams as TestCreateParams,
    type TestUpdateParams as TestUpdateParams,
    type TestListParams as TestListParams,
  };
}
