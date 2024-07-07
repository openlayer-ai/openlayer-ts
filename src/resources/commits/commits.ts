// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as TestResultsAPI from './test-results';

export class Commits extends APIResource {
  testResults: TestResultsAPI.TestResults = new TestResultsAPI.TestResults(this._client);
}

export namespace Commits {
  export import TestResults = TestResultsAPI.TestResults;
  export import TestResultListResponse = TestResultsAPI.TestResultListResponse;
  export import TestResultListParams = TestResultsAPI.TestResultListParams;
}
