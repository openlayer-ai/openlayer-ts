// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as TestResultsAPI from './test-results';
import { TestResultListParams, TestResultListResponse, TestResults } from './test-results';

export class Commits extends APIResource {
  testResults: TestResultsAPI.TestResults = new TestResultsAPI.TestResults(this._client);
}

Commits.TestResults = TestResults;

export declare namespace Commits {
  export {
    TestResults as TestResults,
    type TestResultListResponse as TestResultListResponse,
    type TestResultListParams as TestResultListParams,
  };
}
