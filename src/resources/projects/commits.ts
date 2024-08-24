// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { isRequestOptions } from '../../core';
import * as Core from '../../core';
import * as CommitsAPI from './commits';

export class Commits extends APIResource {
  /**
   * List the commits (project versions) in a project.
   */
  list(
    projectId: string,
    query?: CommitListParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CommitListResponse>;
  list(projectId: string, options?: Core.RequestOptions): Core.APIPromise<CommitListResponse>;
  list(
    projectId: string,
    query: CommitListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<CommitListResponse> {
    if (isRequestOptions(query)) {
      return this.list(projectId, {}, query);
    }
    return this._client.get(`/projects/${projectId}/versions`, { query, ...options });
  }
}

export interface CommitListResponse {
  items: Array<CommitListResponse.Item>;
}

export namespace CommitListResponse {
  export interface Item {
    /**
     * The project version (commit) id.
     */
    id: string;

    /**
     * The details of a commit (project version).
     */
    commit: Item.Commit;

    /**
     * The commit archive date.
     */
    dateArchived: string | null;

    /**
     * The project version (commit) creation date.
     */
    dateCreated: string;

    /**
     * The number of tests that are failing for the commit.
     */
    failingGoalCount: number;

    /**
     * The model id.
     */
    mlModelId: string | null;

    /**
     * The number of tests that are passing for the commit.
     */
    passingGoalCount: number;

    /**
     * The project id.
     */
    projectId: string;

    /**
     * The commit status. Initially, the commit is `queued`, then, it switches to
     * `running`. Finally, it can be `paused`, `failed`, or `completed`.
     */
    status: 'queued' | 'running' | 'paused' | 'failed' | 'completed' | 'unknown';

    /**
     * The commit status message.
     */
    statusMessage: string | null;

    /**
     * The total number of tests for the commit.
     */
    totalGoalCount: number;

    /**
     * The training dataset id.
     */
    trainingDatasetId: string | null;

    /**
     * The validation dataset id.
     */
    validationDatasetId: string | null;

    /**
     * Whether the commit is archived.
     */
    archived?: boolean | null;

    /**
     * The deployment status associated with the commit's model.
     */
    deploymentStatus?: string;

    links?: Item.Links;
  }

  export namespace Item {
    /**
     * The details of a commit (project version).
     */
    export interface Commit {
      /**
       * The commit id.
       */
      id: string;

      /**
       * The author id of the commit.
       */
      authorId: string;

      /**
       * The size of the commit bundle in bytes.
       */
      fileSize: number | null;

      /**
       * The commit message.
       */
      message: string;

      /**
       * The model id.
       */
      mlModelId: string | null;

      /**
       * The storage URI where the commit bundle is stored.
       */
      storageUri: string;

      /**
       * The training dataset id.
       */
      trainingDatasetId: string | null;

      /**
       * The validation dataset id.
       */
      validationDatasetId: string | null;

      /**
       * The commit creation date.
       */
      dateCreated?: string;

      /**
       * The ref of the corresponding git commit.
       */
      gitCommitRef?: string;

      /**
       * The SHA of the corresponding git commit.
       */
      gitCommitSha?: number;

      /**
       * The URL of the corresponding git commit.
       */
      gitCommitUrl?: string;
    }

    export interface Links {
      app: string;
    }
  }
}

export interface CommitListParams {
  /**
   * The page to return in a paginated query.
   */
  page?: number;

  /**
   * Maximum number of items to return per page.
   */
  perPage?: number;
}

export namespace Commits {
  export import CommitListResponse = CommitsAPI.CommitListResponse;
  export import CommitListParams = CommitsAPI.CommitListParams;
}
