// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { isRequestOptions } from '../../core';
import * as Core from '../../core';

export class Tests extends APIResource {
  /**
   * Create a test.
   */
  create(
    projectId: string,
    body: TestCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TestCreateResponse> {
    return this._client.post(`/projects/${projectId}/tests`, { body, ...options });
  }

  /**
   * List tests under a project.
   */
  list(
    projectId: string,
    query?: TestListParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TestListResponse>;
  list(projectId: string, options?: Core.RequestOptions): Core.APIPromise<TestListResponse>;
  list(
    projectId: string,
    query: TestListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<TestListResponse> {
    if (isRequestOptions(query)) {
      return this.list(projectId, {}, query);
    }
    return this._client.get(`/projects/${projectId}/tests`, { query, ...options });
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

export namespace TestCreateResponse {
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

  export namespace Item {
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

export namespace TestCreateParams {
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
    type TestListResponse as TestListResponse,
    type TestCreateParams as TestCreateParams,
    type TestListParams as TestListParams,
  };
}
