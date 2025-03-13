// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as TestResultsAPI from './test-results';
import { TestResultListParams, TestResultListResponse, TestResults } from './test-results';

export class Commits extends APIResource {
  testResults: TestResultsAPI.TestResults = new TestResultsAPI.TestResults(this._client);

  /**
   * Retrieve a project version (commit) by its id.
   */
  retrieve(projectVersionId: string, options?: Core.RequestOptions): Core.APIPromise<CommitRetrieveResponse> {
    return this._client.get(`/versions/${projectVersionId}`, options);
  }
}

export interface CommitRetrieveResponse {
  /**
   * The project version (commit) id.
   */
  id: string;

  /**
   * The details of a commit (project version).
   */
  commit: CommitRetrieveResponse.Commit;

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

  links?: CommitRetrieveResponse.Links;
}

export namespace CommitRetrieveResponse {
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

Commits.TestResults = TestResults;

export declare namespace Commits {
  export { type CommitRetrieveResponse as CommitRetrieveResponse };

  export {
    TestResults as TestResults,
    type TestResultListResponse as TestResultListResponse,
    type TestResultListParams as TestResultListParams,
  };
}
