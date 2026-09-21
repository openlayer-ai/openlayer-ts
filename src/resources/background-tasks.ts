// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../core/resource';
import { APIPromise } from '../core/api-promise';
import { RequestOptions } from '../internal/request-options';
import { path } from '../internal/utils/path';

export class BackgroundTasks extends APIResource {
  /**
   * Retrieve a background task's status, progress and results.
   *
   * Endpoints that cannot answer within one request queue a task and hand back its
   * id -- for example `POST /frameworks/{frameworkId}/export`. Poll this endpoint
   * until `complete` is `true`, then read what the task produced from `outputs`.
   */
  retrieve(taskID: string, options?: RequestOptions): APIPromise<BackgroundTaskRetrieveResponse> {
    return this._client.get(path`/background-tasks/${taskID}`, options);
  }
}

export interface BackgroundTaskRetrieveResponse {
  /**
   * The background task id.
   */
  id: string;

  /**
   * Whether the task has finished. Check this before reading `outputs`.
   */
  complete: boolean;

  /**
   * When the task was queued.
   */
  dateCreated: string;

  /**
   * When the task last reported progress.
   */
  dateUpdated: string;

  /**
   * The task's internal name, including the arguments it was queued with.
   */
  name: string;

  /**
   * How far along the task is, from 0 to 100.
   */
  progress: number;

  /**
   * Why the task failed, or `null` if it has not failed.
   */
  error?: string | null;

  /**
   * Whatever the task produced, keyed by name. `null` until the task completes. A
   * framework export returns `storageUri` -- pass it to `GET /storage/presigned-url`
   * to download the archive -- along with `filename`, `controlCount`,
   * `evidenceCount` and `missingEvidenceCount`.
   */
  outputs?: unknown | null;
}

export declare namespace BackgroundTasks {
  export { type BackgroundTaskRetrieveResponse as BackgroundTaskRetrieveResponse };
}
