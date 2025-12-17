// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../core/resource';
import { APIPromise } from '../core/api-promise';
import { RequestOptions } from '../internal/request-options';
import { path } from '../internal/utils/path';

export class Tests extends APIResource {
  /**
   * Triggers one-off evaluation of a specific monitoring test for a custom timestamp
   * range. This allows evaluating tests for historical data or custom time periods
   * outside the regular evaluation window schedule. It also allows overwriting the
   * existing test results.
   *
   * @example
   * ```ts
   * const response = await client.tests.evaluate(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { endTimestamp: 1700006400, startTimestamp: 1699920000 },
   * );
   * ```
   */
  evaluate(
    testID: string,
    body: TestEvaluateParams,
    options?: RequestOptions,
  ): APIPromise<TestEvaluateResponse> {
    return this._client.post(path`/tests/${testID}/evaluate`, { body, ...options });
  }
}

export interface TestEvaluateResponse {
  message: string;

  /**
   * Number of inference pipelines the test was queued for evaluation on
   */
  pipelineCount: number;

  /**
   * The end timestamp you requested (in seconds)
   */
  requestedEndTimestamp: number;

  /**
   * The start timestamp you requested (in seconds)
   */
  requestedStartTimestamp: number;

  /**
   * Array of background task information for each pipeline evaluation
   */
  tasks: Array<TestEvaluateResponse.Task>;
}

export namespace TestEvaluateResponse {
  export interface Task {
    /**
     * ID of the inference pipeline this task is for
     */
    pipelineId: string;

    /**
     * ID of the background task
     */
    taskResultId: string;

    /**
     * URL to check the status of this background task
     */
    taskResultUrl: string;
  }
}

export interface TestEvaluateParams {
  /**
   * End timestamp in seconds (Unix epoch)
   */
  endTimestamp: number;

  /**
   * Start timestamp in seconds (Unix epoch)
   */
  startTimestamp: number;

  /**
   * ID of the inference pipeline to evaluate. If not provided, all inference
   * pipelines the test applies to will be evaluated.
   */
  inferencePipelineId?: string;

  /**
   * Whether to overwrite existing test results
   */
  overwriteResults?: boolean;
}

export declare namespace Tests {
  export { type TestEvaluateResponse as TestEvaluateResponse, type TestEvaluateParams as TestEvaluateParams };
}
