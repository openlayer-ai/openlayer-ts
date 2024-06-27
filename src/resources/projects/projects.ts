// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { isRequestOptions } from '../../core';
import * as Core from '../../core';
import * as ProjectsAPI from './projects';
import * as CommitsAPI from './commits';
import * as InferencePipelinesAPI from './inference-pipelines';

export class Projects extends APIResource {
  commits: CommitsAPI.Commits = new CommitsAPI.Commits(this._client);
  inferencePipelines: InferencePipelinesAPI.InferencePipelines = new InferencePipelinesAPI.InferencePipelines(
    this._client,
  );

  /**
   * List the projects in a user's workspace.
   */
  list(query?: ProjectListParams, options?: Core.RequestOptions): Core.APIPromise<ProjectListResponse>;
  list(options?: Core.RequestOptions): Core.APIPromise<ProjectListResponse>;
  list(
    query: ProjectListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<ProjectListResponse> {
    if (isRequestOptions(query)) {
      return this.list({}, query);
    }
    return this._client.get('/projects', { query, ...options });
  }
}

export interface ProjectListResponse {
  _meta: ProjectListResponse._Meta;

  items: Array<ProjectListResponse.Item>;
}

export namespace ProjectListResponse {
  export interface _Meta {
    /**
     * The current page.
     */
    page: number;

    /**
     * The number of items per page.
     */
    perPage: number;

    /**
     * The total number of items.
     */
    totalItems: number;

    /**
     * The total number of pages.
     */
    totalPages: number;
  }

  export interface Item {
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
    links: Item.Links;

    /**
     * The number of tests in the monitoring mode of the project.
     */
    monitoringGoalCount: number;

    /**
     * The project name.
     */
    name: string;

    /**
     * Whether the project is a sample project or a user-created project.
     */
    sample: boolean;

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

    gitRepo?: Item.GitRepo | null;

    /**
     * The slack channel id connected to the project.
     */
    slackChannelId?: string | null;

    /**
     * The slack channel connected to the project.
     */
    slackChannelName?: string | null;

    /**
     * Whether slack channel notifications are enabled for the project.
     */
    slackChannelNotificationsEnabled?: boolean;

    /**
     * The number of unread notifications in the project.
     */
    unreadNotificationCount?: number;
  }

  export namespace Item {
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
}

export interface ProjectListParams {
  /**
   * Filter list of items by project name.
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

  /**
   * Filter list of items by task type.
   */
  taskType?: 'llm-base' | 'tabular-classification' | 'tabular-regression' | 'text-classification';
}

export namespace Projects {
  export import ProjectListResponse = ProjectsAPI.ProjectListResponse;
  export import ProjectListParams = ProjectsAPI.ProjectListParams;
  export import Commits = CommitsAPI.Commits;
  export import CommitListResponse = CommitsAPI.CommitListResponse;
  export import CommitListParams = CommitsAPI.CommitListParams;
  export import InferencePipelines = InferencePipelinesAPI.InferencePipelines;
  export import InferencePipelineListResponse = InferencePipelinesAPI.InferencePipelineListResponse;
  export import InferencePipelineListParams = InferencePipelinesAPI.InferencePipelineListParams;
}
