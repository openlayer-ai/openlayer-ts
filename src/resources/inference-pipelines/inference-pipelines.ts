// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as DataAPI from './data';
import * as TestResultsAPI from './test-results';

export class InferencePipelines extends APIResource {
  data: DataAPI.Data = new DataAPI.Data(this._client);
  testResults: TestResultsAPI.TestResults = new TestResultsAPI.TestResults(this._client);
}

export namespace InferencePipelines {
  export import Data = DataAPI.Data;
  export import TestResults = TestResultsAPI.TestResults;
}
