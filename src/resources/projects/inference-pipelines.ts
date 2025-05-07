// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { isRequestOptions } from '../../core';
import * as Core from '../../core';

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
    projectId: string,
    body: InferencePipelineCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InferencePipelineCreateResponse> {
    return this._client.post(`/projects/${projectId}/inference-pipelines`, { body, ...options });
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
    projectId: string,
    query?: InferencePipelineListParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InferencePipelineListResponse>;
  list(projectId: string, options?: Core.RequestOptions): Core.APIPromise<InferencePipelineListResponse>;
  list(
    projectId: string,
    query: InferencePipelineListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<InferencePipelineListResponse> {
    if (isRequestOptions(query)) {
      return this.list(projectId, {}, query);
    }
    return this._client.get(`/projects/${projectId}/inference-pipelines`, { query, ...options });
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

  project?: InferencePipelineCreateResponse.Project | null;

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

    project?: Item.Project | null;

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

  project?: InferencePipelineCreateParams.Project | null;

  workspace?: InferencePipelineCreateParams.Workspace | null;
}

export namespace InferencePipelineCreateParams {
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
