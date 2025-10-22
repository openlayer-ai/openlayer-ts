// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class InferencePipelines extends APIResource {
  /**
   * Create an inference pipeline in a project.
   *
   * @example
   * ```ts
   * const inferencePipeline =
   *   await client.projects.inferencePipelines.create(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     {
   *       description: 'This pipeline is used for production.',
   *       name: 'production',
   *     },
   *   );
   * ```
   */
  create(
    projectID: string,
    body: InferencePipelineCreateParams,
    options?: RequestOptions,
  ): APIPromise<InferencePipelineCreateResponse> {
    return this._client.post(path`/projects/${projectID}/inference-pipelines`, { body, ...options });
  }

  /**
   * List the inference pipelines in a project.
   *
   * @example
   * ```ts
   * const inferencePipelines =
   *   await client.projects.inferencePipelines.list(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   );
   * ```
   */
  list(
    projectID: string,
    query: InferencePipelineListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<InferencePipelineListResponse> {
    return this._client.get(path`/projects/${projectID}/inference-pipelines`, { query, ...options });
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

  dataBackend?:
    | InferencePipelineCreateResponse.UnionMember0
    | InferencePipelineCreateResponse.BackendType
    | InferencePipelineCreateResponse.UnionMember2
    | InferencePipelineCreateResponse.UnionMember3
    | InferencePipelineCreateResponse.UnionMember4
    | InferencePipelineCreateResponse.UnionMember5
    | null;

  /**
   * The last time the data was polled.
   */
  dateLastPolled?: string | null;

  project?: InferencePipelineCreateResponse.Project | null;

  /**
   * The total number of records in the data backend.
   */
  totalRecordsCount?: number | null;

  workspace?: InferencePipelineCreateResponse.Workspace | null;

  /**
   * The workspace id.
   */
  workspaceId?: string;
}

export namespace InferencePipelineCreateResponse {
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

export interface InferencePipelineListResponse {
  items: Array<InferencePipelineListResponse.Item>;
}

export namespace InferencePipelineListResponse {
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

    dataBackend?:
      | Item.UnionMember0
      | Item.BackendType
      | Item.UnionMember2
      | Item.UnionMember3
      | Item.UnionMember4
      | Item.UnionMember5
      | null;

    /**
     * The last time the data was polled.
     */
    dateLastPolled?: string | null;

    project?: Item.Project | null;

    /**
     * The total number of records in the data backend.
     */
    totalRecordsCount?: number | null;

    workspace?: Item.Workspace | null;

    /**
     * The workspace id.
     */
    workspaceId?: string;
  }

  export namespace Item {
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

  dataBackend?:
    | InferencePipelineCreateParams.UnionMember0
    | InferencePipelineCreateParams.BackendType
    | InferencePipelineCreateParams.UnionMember2
    | InferencePipelineCreateParams.UnionMember3
    | InferencePipelineCreateParams.UnionMember4
    | InferencePipelineCreateParams.UnionMember5
    | null;

  project?: InferencePipelineCreateParams.Project | null;

  workspace?: InferencePipelineCreateParams.Workspace | null;
}

export namespace InferencePipelineCreateParams {
  export interface UnionMember0 {
    backendType: 'bigquery';

    bigqueryConnectionId: string | null;

    config: UnionMember0.Config;

    datasetId: string;

    projectId: string;

    tableId: string | null;

    partitionType?: 'DAY' | 'MONTH' | 'YEAR' | null;
  }

  export namespace UnionMember0 {
    export interface Config {
      /**
       * Name of the column with the ground truths.
       */
      groundTruthColumnName?: string | null;

      /**
       * Name of the column with human feedback.
       */
      humanFeedbackColumnName?: string | null;

      /**
       * Name of the column with the inference ids. This is useful if you want to update
       * rows at a later point in time. If not provided, a unique id is generated by
       * Openlayer.
       */
      inferenceIdColumnName?: string | null;

      /**
       * Name of the column with the latencies.
       */
      latencyColumnName?: string | null;

      /**
       * Name of the column with the timestamps. Timestamps must be in UNIX sec format.
       * If not provided, the upload timestamp is used.
       */
      timestampColumnName?: string | null;
    }
  }

  export interface BackendType {
    backendType: 'default';
  }

  export interface UnionMember2 {
    backendType: 'snowflake';

    config: UnionMember2.Config;

    database: string;

    schema: string;

    snowflakeConnectionId: string | null;

    table: string | null;
  }

  export namespace UnionMember2 {
    export interface Config {
      /**
       * Name of the column with the ground truths.
       */
      groundTruthColumnName?: string | null;

      /**
       * Name of the column with human feedback.
       */
      humanFeedbackColumnName?: string | null;

      /**
       * Name of the column with the inference ids. This is useful if you want to update
       * rows at a later point in time. If not provided, a unique id is generated by
       * Openlayer.
       */
      inferenceIdColumnName?: string | null;

      /**
       * Name of the column with the latencies.
       */
      latencyColumnName?: string | null;

      /**
       * Name of the column with the timestamps. Timestamps must be in UNIX sec format.
       * If not provided, the upload timestamp is used.
       */
      timestampColumnName?: string | null;
    }
  }

  export interface UnionMember3 {
    backendType: 'databricks_dtl';

    config: UnionMember3.Config;

    databricksDtlConnectionId: string | null;

    tableId: string | null;
  }

  export namespace UnionMember3 {
    export interface Config {
      /**
       * Name of the column with the ground truths.
       */
      groundTruthColumnName?: string | null;

      /**
       * Name of the column with human feedback.
       */
      humanFeedbackColumnName?: string | null;

      /**
       * Name of the column with the inference ids. This is useful if you want to update
       * rows at a later point in time. If not provided, a unique id is generated by
       * Openlayer.
       */
      inferenceIdColumnName?: string | null;

      /**
       * Name of the column with the latencies.
       */
      latencyColumnName?: string | null;

      /**
       * Name of the column with the timestamps. Timestamps must be in UNIX sec format.
       * If not provided, the upload timestamp is used.
       */
      timestampColumnName?: string | null;
    }
  }

  export interface UnionMember4 {
    backendType: 'redshift';

    config: UnionMember4.Config;

    redshiftConnectionId: string | null;

    schemaName: string;

    tableName: string;
  }

  export namespace UnionMember4 {
    export interface Config {
      /**
       * Name of the column with the ground truths.
       */
      groundTruthColumnName?: string | null;

      /**
       * Name of the column with human feedback.
       */
      humanFeedbackColumnName?: string | null;

      /**
       * Name of the column with the inference ids. This is useful if you want to update
       * rows at a later point in time. If not provided, a unique id is generated by
       * Openlayer.
       */
      inferenceIdColumnName?: string | null;

      /**
       * Name of the column with the latencies.
       */
      latencyColumnName?: string | null;

      /**
       * Name of the column with the timestamps. Timestamps must be in UNIX sec format.
       * If not provided, the upload timestamp is used.
       */
      timestampColumnName?: string | null;
    }
  }

  export interface UnionMember5 {
    backendType: 'postgres';

    config: UnionMember5.Config;

    database: string;

    postgresConnectionId: string | null;

    schema: string;

    table: string | null;
  }

  export namespace UnionMember5 {
    export interface Config {
      /**
       * Name of the column with the ground truths.
       */
      groundTruthColumnName?: string | null;

      /**
       * Name of the column with human feedback.
       */
      humanFeedbackColumnName?: string | null;

      /**
       * Name of the column with the inference ids. This is useful if you want to update
       * rows at a later point in time. If not provided, a unique id is generated by
       * Openlayer.
       */
      inferenceIdColumnName?: string | null;

      /**
       * Name of the column with the latencies.
       */
      latencyColumnName?: string | null;

      /**
       * Name of the column with the timestamps. Timestamps must be in UNIX sec format.
       * If not provided, the upload timestamp is used.
       */
      timestampColumnName?: string | null;
    }
  }

  export interface Project {
    /**
     * The project name.
     */
    name: string;

    /**
     * The task type of the project.
     */
    taskType: 'llm-base' | 'tabular-classification' | 'tabular-regression' | 'text-classification';

    /**
     * The project description.
     */
    description?: string | null;
  }

  export interface Workspace {
    /**
     * The workspace name.
     */
    name: string;

    /**
     * The workspace slug.
     */
    slug: string;

    /**
     * The workspace invite code.
     */
    inviteCode?: string;

    /**
     * Whether the workspace only allows SAML authentication.
     */
    samlOnlyAccess?: boolean;

    wildcardDomains?: Array<string>;
  }
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

export declare namespace InferencePipelines {
  export {
    type InferencePipelineCreateResponse as InferencePipelineCreateResponse,
    type InferencePipelineListResponse as InferencePipelineListResponse,
    type InferencePipelineCreateParams as InferencePipelineCreateParams,
    type InferencePipelineListParams as InferencePipelineListParams,
  };
}
