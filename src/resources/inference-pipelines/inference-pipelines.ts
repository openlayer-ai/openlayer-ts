// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as DataAPI from './data';
import { Data, DataStreamParams, DataStreamResponse } from './data';
import * as RowsAPI from './rows';
import { RowUpdateParams, RowUpdateResponse, Rows } from './rows';
import * as TestResultsAPI from './test-results';
import { TestResultListParams, TestResultListResponse, TestResults } from './test-results';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class InferencePipelines extends APIResource {
  data: DataAPI.Data = new DataAPI.Data(this._client);
  rows: RowsAPI.Rows = new RowsAPI.Rows(this._client);
  testResults: TestResultsAPI.TestResults = new TestResultsAPI.TestResults(this._client);

  /**
   * Retrieve inference pipeline.
   *
   * @example
   * ```ts
   * const inferencePipeline =
   *   await client.inferencePipelines.retrieve(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   );
   * ```
   */
  retrieve(
    inferencePipelineID: string,
    query: InferencePipelineRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<InferencePipelineRetrieveResponse> {
    return this._client.get(path`/inference-pipelines/${inferencePipelineID}`, { query, ...options });
  }

  /**
   * Update inference pipeline.
   *
   * @example
   * ```ts
   * const inferencePipeline =
   *   await client.inferencePipelines.update(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   );
   * ```
   */
  update(
    inferencePipelineID: string,
    body: InferencePipelineUpdateParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<InferencePipelineUpdateResponse> {
    return this._client.put(path`/inference-pipelines/${inferencePipelineID}`, { body, ...options });
  }

  /**
   * Delete inference pipeline.
   *
   * @example
   * ```ts
   * await client.inferencePipelines.delete(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  delete(inferencePipelineID: string, options?: RequestOptions): APIPromise<void> {
    return this._client.delete(path`/inference-pipelines/${inferencePipelineID}`, {
      ...options,
      headers: buildHeaders([{ Accept: '*/*' }, options?.headers]),
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

  dataBackend?:
    | InferencePipelineRetrieveResponse.UnionMember0
    | InferencePipelineRetrieveResponse.BackendType
    | InferencePipelineRetrieveResponse.UnionMember2
    | InferencePipelineRetrieveResponse.UnionMember3
    | InferencePipelineRetrieveResponse.UnionMember4
    | InferencePipelineRetrieveResponse.UnionMember5
    | null;

  /**
   * The last time the data was polled.
   */
  dateLastPolled?: string | null;

  project?: InferencePipelineRetrieveResponse.Project | null;

  /**
   * The total number of records in the data backend.
   */
  totalRecordsCount?: number | null;

  workspace?: InferencePipelineRetrieveResponse.Workspace | null;

  /**
   * The workspace id.
   */
  workspaceId?: string;
}

export namespace InferencePipelineRetrieveResponse {
  export interface Links {
    app: string;
  }

  export interface UnionMember0 {
    backendType: 'bigquery';

    bigqueryConnectionId: string | null;

    datasetId: string;

    projectId: string;

    tableId: string | null;

    partitionType?: 'DAY' | 'MONTH' | 'YEAR' | null;
  }

  export interface BackendType {
    backendType: 'default';
  }

  export interface UnionMember2 {
    backendType: 'snowflake';

    database: string;

    schema: string;

    snowflakeConnectionId: string | null;

    table: string | null;
  }

  export interface UnionMember3 {
    backendType: 'databricks_dtl';

    databricksDtlConnectionId: string | null;

    tableId: string | null;
  }

  export interface UnionMember4 {
    backendType: 'redshift';

    redshiftConnectionId: string | null;

    schemaName: string;

    tableName: string;
  }

  export interface UnionMember5 {
    backendType: 'postgres';

    database: string;

    postgresConnectionId: string | null;

    schema: string;

    table: string | null;
  }

  export interface Project {
    /**
     * The project id.
     */
    id: string;

    /**
     * The project creator id.
     */
    creatorId: string | null;

    /**
     * The project creation date.
     */
    dateCreated: string;

    /**
     * The project last updated date.
     */
    dateUpdated: string;

    /**
     * The number of tests in the development mode of the project.
     */
    developmentGoalCount: number;

    /**
     * The total number of tests in the project.
     */
    goalCount: number;

    /**
     * The number of inference pipelines in the project.
     */
    inferencePipelineCount: number;

    /**
     * Links to the project.
     */
    links: Project.Links;

    /**
     * The number of tests in the monitoring mode of the project.
     */
    monitoringGoalCount: number;

    /**
     * The project name.
     */
    name: string;

    /**
     * The source of the project.
     */
    source: 'web' | 'api' | 'null' | null;

    /**
     * The task type of the project.
     */
    taskType: 'llm-base' | 'tabular-classification' | 'tabular-regression' | 'text-classification';

    /**
     * The number of versions (commits) in the project.
     */
    versionCount: number;

    /**
     * The workspace id.
     */
    workspaceId: string | null;

    /**
     * The project description.
     */
    description?: string | null;

    gitRepo?: Project.GitRepo | null;
  }

  export namespace Project {
    /**
     * Links to the project.
     */
    export interface Links {
      app: string;
    }

    export interface GitRepo {
      id: string;

      dateConnected: string;

      dateUpdated: string;

      gitAccountId: string;

      gitId: number;

      name: string;

      private: boolean;

      projectId: string;

      slug: string;

      url: string;

      branch?: string;

      rootDir?: string;
    }
  }

  export interface Workspace {
    /**
     * The workspace id.
     */
    id: string;

    /**
     * The workspace creator id.
     */
    creatorId: string | null;

    /**
     * The workspace creation date.
     */
    dateCreated: string;

    /**
     * The workspace last updated date.
     */
    dateUpdated: string;

    /**
     * The number of invites in the workspace.
     */
    inviteCount: number;

    /**
     * The number of members in the workspace.
     */
    memberCount: number;

    /**
     * The workspace name.
     */
    name: string;

    /**
     * The end date of the current billing period.
     */
    periodEndDate: string | null;

    /**
     * The start date of the current billing period.
     */
    periodStartDate: string | null;

    /**
     * The number of projects in the workspace.
     */
    projectCount: number;

    /**
     * The workspace slug.
     */
    slug: string;

    status:
      | 'active'
      | 'past_due'
      | 'unpaid'
      | 'canceled'
      | 'incomplete'
      | 'incomplete_expired'
      | 'trialing'
      | 'paused';

    monthlyUsage?: Array<Workspace.MonthlyUsage>;

    /**
     * Whether the workspace only allows SAML authentication.
     */
    samlOnlyAccess?: boolean;

    wildcardDomains?: Array<string>;
  }

  export namespace Workspace {
    export interface MonthlyUsage {
      executionTimeMs?: number | null;

      monthYear?: string;

      predictionCount?: number;
    }
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

  dataBackend?:
    | InferencePipelineUpdateResponse.UnionMember0
    | InferencePipelineUpdateResponse.BackendType
    | InferencePipelineUpdateResponse.UnionMember2
    | InferencePipelineUpdateResponse.UnionMember3
    | InferencePipelineUpdateResponse.UnionMember4
    | InferencePipelineUpdateResponse.UnionMember5
    | null;

  /**
   * The last time the data was polled.
   */
  dateLastPolled?: string | null;

  project?: InferencePipelineUpdateResponse.Project | null;

  /**
   * The total number of records in the data backend.
   */
  totalRecordsCount?: number | null;

  workspace?: InferencePipelineUpdateResponse.Workspace | null;

  /**
   * The workspace id.
   */
  workspaceId?: string;
}

export namespace InferencePipelineUpdateResponse {
  export interface Links {
    app: string;
  }

  export interface UnionMember0 {
    backendType: 'bigquery';

    bigqueryConnectionId: string | null;

    datasetId: string;

    projectId: string;

    tableId: string | null;

    partitionType?: 'DAY' | 'MONTH' | 'YEAR' | null;
  }

  export interface BackendType {
    backendType: 'default';
  }

  export interface UnionMember2 {
    backendType: 'snowflake';

    database: string;

    schema: string;

    snowflakeConnectionId: string | null;

    table: string | null;
  }

  export interface UnionMember3 {
    backendType: 'databricks_dtl';

    databricksDtlConnectionId: string | null;

    tableId: string | null;
  }

  export interface UnionMember4 {
    backendType: 'redshift';

    redshiftConnectionId: string | null;

    schemaName: string;

    tableName: string;
  }

  export interface UnionMember5 {
    backendType: 'postgres';

    database: string;

    postgresConnectionId: string | null;

    schema: string;

    table: string | null;
  }

  export interface Project {
    /**
     * The project id.
     */
    id: string;

    /**
     * The project creator id.
     */
    creatorId: string | null;

    /**
     * The project creation date.
     */
    dateCreated: string;

    /**
     * The project last updated date.
     */
    dateUpdated: string;

    /**
     * The number of tests in the development mode of the project.
     */
    developmentGoalCount: number;

    /**
     * The total number of tests in the project.
     */
    goalCount: number;

    /**
     * The number of inference pipelines in the project.
     */
    inferencePipelineCount: number;

    /**
     * Links to the project.
     */
    links: Project.Links;

    /**
     * The number of tests in the monitoring mode of the project.
     */
    monitoringGoalCount: number;

    /**
     * The project name.
     */
    name: string;

    /**
     * The source of the project.
     */
    source: 'web' | 'api' | 'null' | null;

    /**
     * The task type of the project.
     */
    taskType: 'llm-base' | 'tabular-classification' | 'tabular-regression' | 'text-classification';

    /**
     * The number of versions (commits) in the project.
     */
    versionCount: number;

    /**
     * The workspace id.
     */
    workspaceId: string | null;

    /**
     * The project description.
     */
    description?: string | null;

    gitRepo?: Project.GitRepo | null;
  }

  export namespace Project {
    /**
     * Links to the project.
     */
    export interface Links {
      app: string;
    }

    export interface GitRepo {
      id: string;

      dateConnected: string;

      dateUpdated: string;

      gitAccountId: string;

      gitId: number;

      name: string;

      private: boolean;

      projectId: string;

      slug: string;

      url: string;

      branch?: string;

      rootDir?: string;
    }
  }

  export interface Workspace {
    /**
     * The workspace id.
     */
    id: string;

    /**
     * The workspace creator id.
     */
    creatorId: string | null;

    /**
     * The workspace creation date.
     */
    dateCreated: string;

    /**
     * The workspace last updated date.
     */
    dateUpdated: string;

    /**
     * The number of invites in the workspace.
     */
    inviteCount: number;

    /**
     * The number of members in the workspace.
     */
    memberCount: number;

    /**
     * The workspace name.
     */
    name: string;

    /**
     * The end date of the current billing period.
     */
    periodEndDate: string | null;

    /**
     * The start date of the current billing period.
     */
    periodStartDate: string | null;

    /**
     * The number of projects in the workspace.
     */
    projectCount: number;

    /**
     * The workspace slug.
     */
    slug: string;

    status:
      | 'active'
      | 'past_due'
      | 'unpaid'
      | 'canceled'
      | 'incomplete'
      | 'incomplete_expired'
      | 'trialing'
      | 'paused';

    monthlyUsage?: Array<Workspace.MonthlyUsage>;

    /**
     * Whether the workspace only allows SAML authentication.
     */
    samlOnlyAccess?: boolean;

    wildcardDomains?: Array<string>;
  }

  export namespace Workspace {
    export interface MonthlyUsage {
      executionTimeMs?: number | null;

      monthYear?: string;

      predictionCount?: number;
    }
  }
}

export interface InferencePipelineRetrieveParams {
  /**
   * Expand specific nested objects.
   */
  expand?: Array<'project' | 'workspace'>;
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
    type InferencePipelineRetrieveParams as InferencePipelineRetrieveParams,
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
