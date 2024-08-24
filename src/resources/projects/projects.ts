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
   * Create a project in your workspace.
   */
  create(body: ProjectCreateParams, options?: Core.RequestOptions): Core.APIPromise<ProjectCreateResponse> {
    return this._client.post('/projects', { body, ...options });
  }

  /**
   * List your workspace's projects.
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

export interface ProjectCreateResponse {
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
  links: ProjectCreateResponse.Links;

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

  gitRepo?: ProjectCreateResponse.GitRepo | null;
}

export namespace ProjectCreateResponse {
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

export interface ProjectListResponse {
  items: Array<ProjectListResponse.Item>;
}

export namespace ProjectListResponse {
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

export interface ProjectCreateParams {
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
  export import ProjectCreateResponse = ProjectsAPI.ProjectCreateResponse;
  export import ProjectListResponse = ProjectsAPI.ProjectListResponse;
  export import ProjectCreateParams = ProjectsAPI.ProjectCreateParams;
  export import ProjectListParams = ProjectsAPI.ProjectListParams;
  export import Commits = CommitsAPI.Commits;
  export import CommitListResponse = CommitsAPI.CommitListResponse;
  export import CommitListParams = CommitsAPI.CommitListParams;
  export import InferencePipelines = InferencePipelinesAPI.InferencePipelines;
  export import InferencePipelineCreateResponse = InferencePipelinesAPI.InferencePipelineCreateResponse;
  export import InferencePipelineListResponse = InferencePipelinesAPI.InferencePipelineListResponse;
  export import InferencePipelineCreateParams = InferencePipelinesAPI.InferencePipelineCreateParams;
  export import InferencePipelineListParams = InferencePipelinesAPI.InferencePipelineListParams;
}
