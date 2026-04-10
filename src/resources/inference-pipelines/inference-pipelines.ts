// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as DataAPI from './data';
import { Data, DataStreamParams, DataStreamResponse } from './data';
import * as RowsAPI from './rows';
import {
  RowDeleteParams,
  RowListParams,
  RowListResponse,
  RowRetrieveParams,
  RowRetrieveResponse,
  RowUpdateParams,
  RowUpdateResponse,
  Rows,
} from './rows';
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

  /**
   * Get aggregated session data for an inference pipeline with pagination and
   * metadata.
   *
   * Returns a list of sessions for the inference pipeline, including activity
   * statistics such as record counts, token usage, cost, latency, and the first and
   * last records.
   *
   * @example
   * ```ts
   * const response =
   *   await client.inferencePipelines.retrieveSessions(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   );
   * ```
   */
  retrieveSessions(
    inferencePipelineID: string,
    params: InferencePipelineRetrieveSessionsParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<InferencePipelineRetrieveSessionsResponse> {
    const { asc, page, perPage, sortColumn, ...body } = params ?? {};
    return this._client.post(path`/inference-pipelines/${inferencePipelineID}/sessions`, {
      query: { asc, page, perPage, sortColumn },
      body,
      ...options,
    });
  }

  /**
   * Get aggregated user data for an inference pipeline with pagination and metadata.
   *
   * Returns a list of users who have interacted with the inference pipeline,
   * including their activity statistics such as session counts, record counts, token
   * usage, and costs.
   *
   * @example
   * ```ts
   * const response =
   *   await client.inferencePipelines.retrieveUsers(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   );
   * ```
   */
  retrieveUsers(
    inferencePipelineID: string,
    params: InferencePipelineRetrieveUsersParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<InferencePipelineRetrieveUsersResponse> {
    const { asc, page, perPage, sortColumn, ...body } = params ?? {};
    return this._client.post(path`/inference-pipelines/${inferencePipelineID}/users`, {
      query: { asc, page, perPage, sortColumn },
      body,
      ...options,
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
    | InferencePipelineRetrieveResponse.BigQueryDataBackend
    | InferencePipelineRetrieveResponse.DefaultDataBackend
    | InferencePipelineRetrieveResponse.SnowflakeDataBackend
    | InferencePipelineRetrieveResponse.DatabricksDtlDataBackend
    | InferencePipelineRetrieveResponse.RedshiftDataBackend
    | InferencePipelineRetrieveResponse.PostgresDataBackend
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

  export interface BigQueryDataBackend {
    backendType: 'bigquery';

    bigqueryConnectionId: string | null;

    datasetId: string;

    projectId: string;

    tableId: string | null;

    partitionType?: 'DAY' | 'MONTH' | 'YEAR' | null;
  }

  export interface DefaultDataBackend {
    backendType: 'default';
  }

  export interface SnowflakeDataBackend {
    backendType: 'snowflake';

    database: string;

    schema: string;

    snowflakeConnectionId: string | null;

    table: string | null;
  }

  export interface DatabricksDtlDataBackend {
    backendType: 'databricks_dtl';

    databricksDtlConnectionId: string | null;

    tableId: string | null;
  }

  export interface RedshiftDataBackend {
    backendType: 'redshift';

    redshiftConnectionId: string | null;

    schemaName: string;

    tableName: string;
  }

  export interface PostgresDataBackend {
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
    | InferencePipelineUpdateResponse.BigQueryDataBackend
    | InferencePipelineUpdateResponse.DefaultDataBackend
    | InferencePipelineUpdateResponse.SnowflakeDataBackend
    | InferencePipelineUpdateResponse.DatabricksDtlDataBackend
    | InferencePipelineUpdateResponse.RedshiftDataBackend
    | InferencePipelineUpdateResponse.PostgresDataBackend
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

  export interface BigQueryDataBackend {
    backendType: 'bigquery';

    bigqueryConnectionId: string | null;

    datasetId: string;

    projectId: string;

    tableId: string | null;

    partitionType?: 'DAY' | 'MONTH' | 'YEAR' | null;
  }

  export interface DefaultDataBackend {
    backendType: 'default';
  }

  export interface SnowflakeDataBackend {
    backendType: 'snowflake';

    database: string;

    schema: string;

    snowflakeConnectionId: string | null;

    table: string | null;
  }

  export interface DatabricksDtlDataBackend {
    backendType: 'databricks_dtl';

    databricksDtlConnectionId: string | null;

    tableId: string | null;
  }

  export interface RedshiftDataBackend {
    backendType: 'redshift';

    redshiftConnectionId: string | null;

    schemaName: string;

    tableName: string;
  }

  export interface PostgresDataBackend {
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

export interface InferencePipelineRetrieveSessionsResponse {
  /**
   * Array of session aggregation data
   */
  items: Array<InferencePipelineRetrieveSessionsResponse.Item>;
}

export namespace InferencePipelineRetrieveSessionsResponse {
  export interface Item {
    /**
     * The unique session identifier
     */
    id: string;

    /**
     * Total cost for the session
     */
    cost: number;

    /**
     * Latest/most recent timestamp in the session
     */
    dateCreated: string;

    /**
     * Timestamp of the first request in the session
     */
    dateOfFirstRecord: string;

    /**
     * Timestamp of the last request in the session
     */
    dateOfLastRecord: string;

    /**
     * Duration between first and last request (in milliseconds)
     */
    duration: number;

    /**
     * The complete first record in the session
     */
    firstRecord: { [key: string]: unknown };

    /**
     * The complete last record in the session
     */
    lastRecord: { [key: string]: unknown };

    /**
     * Total latency for the session (in milliseconds)
     */
    latency: number;

    /**
     * Total number of records/traces in the session
     */
    records: number;

    /**
     * Total token count for the session
     */
    tokens: number;

    /**
     * List of unique user IDs that participated in this session
     */
    userIds: Array<string>;
  }
}

export interface InferencePipelineRetrieveUsersResponse {
  /**
   * Array of user aggregation data
   */
  items: Array<InferencePipelineRetrieveUsersResponse.Item>;
}

export namespace InferencePipelineRetrieveUsersResponse {
  export interface Item {
    /**
     * The unique user identifier
     */
    id: string;

    /**
     * Total cost for this user
     */
    cost: number;

    /**
     * Timestamp of the user's first event/trace
     */
    dateOfFirstRecord: string;

    /**
     * Timestamp of the user's last event/trace
     */
    dateOfLastRecord: string;

    /**
     * Total number of traces/rows for this user
     */
    records: number;

    /**
     * Count of unique sessions for this user
     */
    sessions: number;

    /**
     * Total token count for this user
     */
    tokens: number;
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

export interface InferencePipelineRetrieveSessionsParams {
  /**
   * Query param: Whether or not to sort on the sortColumn in ascending order.
   */
  asc?: boolean;

  /**
   * Query param: The page to return in a paginated query.
   */
  page?: number;

  /**
   * Query param: Maximum number of items to return per page.
   */
  perPage?: number;

  /**
   * Query param: Name of the column to sort on
   */
  sortColumn?: string;

  /**
   * Body param
   */
  columnFilters?: Array<
    | InferencePipelineRetrieveSessionsParams.SetColumnFilter
    | InferencePipelineRetrieveSessionsParams.NumericColumnFilter
    | InferencePipelineRetrieveSessionsParams.StringColumnFilter
  > | null;

  /**
   * Body param
   */
  excludeRowIdList?: Array<number> | null;

  /**
   * Body param
   */
  notSearchQueryAnd?: Array<string> | null;

  /**
   * Body param
   */
  notSearchQueryOr?: Array<string> | null;

  /**
   * Body param
   */
  rowIdList?: Array<number> | null;

  /**
   * Body param
   */
  searchQueryAnd?: Array<string> | null;

  /**
   * Body param
   */
  searchQueryOr?: Array<string> | null;
}

export namespace InferencePipelineRetrieveSessionsParams {
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

export interface InferencePipelineRetrieveUsersParams {
  /**
   * Query param: Whether or not to sort on the sortColumn in ascending order.
   */
  asc?: boolean;

  /**
   * Query param: The page to return in a paginated query.
   */
  page?: number;

  /**
   * Query param: Maximum number of items to return per page.
   */
  perPage?: number;

  /**
   * Query param: Name of the column to sort on
   */
  sortColumn?: string;

  /**
   * Body param
   */
  columnFilters?: Array<
    | InferencePipelineRetrieveUsersParams.SetColumnFilter
    | InferencePipelineRetrieveUsersParams.NumericColumnFilter
    | InferencePipelineRetrieveUsersParams.StringColumnFilter
  > | null;

  /**
   * Body param
   */
  excludeRowIdList?: Array<number> | null;

  /**
   * Body param
   */
  notSearchQueryAnd?: Array<string> | null;

  /**
   * Body param
   */
  notSearchQueryOr?: Array<string> | null;

  /**
   * Body param
   */
  rowIdList?: Array<number> | null;

  /**
   * Body param
   */
  searchQueryAnd?: Array<string> | null;

  /**
   * Body param
   */
  searchQueryOr?: Array<string> | null;
}

export namespace InferencePipelineRetrieveUsersParams {
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

InferencePipelines.Data = Data;
InferencePipelines.Rows = Rows;
InferencePipelines.TestResults = TestResults;

export declare namespace InferencePipelines {
  export {
    type InferencePipelineRetrieveResponse as InferencePipelineRetrieveResponse,
    type InferencePipelineUpdateResponse as InferencePipelineUpdateResponse,
    type InferencePipelineRetrieveSessionsResponse as InferencePipelineRetrieveSessionsResponse,
    type InferencePipelineRetrieveUsersResponse as InferencePipelineRetrieveUsersResponse,
    type InferencePipelineRetrieveParams as InferencePipelineRetrieveParams,
    type InferencePipelineUpdateParams as InferencePipelineUpdateParams,
    type InferencePipelineRetrieveSessionsParams as InferencePipelineRetrieveSessionsParams,
    type InferencePipelineRetrieveUsersParams as InferencePipelineRetrieveUsersParams,
  };

  export {
    Data as Data,
    type DataStreamResponse as DataStreamResponse,
    type DataStreamParams as DataStreamParams,
  };

  export {
    Rows as Rows,
    type RowRetrieveResponse as RowRetrieveResponse,
    type RowUpdateResponse as RowUpdateResponse,
    type RowListResponse as RowListResponse,
    type RowRetrieveParams as RowRetrieveParams,
    type RowUpdateParams as RowUpdateParams,
    type RowListParams as RowListParams,
    type RowDeleteParams as RowDeleteParams,
  };

  export {
    TestResults as TestResults,
    type TestResultListResponse as TestResultListResponse,
    type TestResultListParams as TestResultListParams,
  };
}
