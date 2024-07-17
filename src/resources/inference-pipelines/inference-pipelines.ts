// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as DataAPI from './data';
import * as RowsAPI from './rows';
import * as TestResultsAPI from './test-results';

export class InferencePipelines extends APIResource {
  data: DataAPI.Data = new DataAPI.Data(this._client);
  rows: RowsAPI.Rows = new RowsAPI.Rows(this._client);
  testResults: TestResultsAPI.TestResults = new TestResultsAPI.TestResults(this._client);
}

export namespace InferencePipelines {
  export import Data = DataAPI.Data;
  export import DataStreamResponse = DataAPI.DataStreamResponse;
  export import DataStreamParams = DataAPI.DataStreamParams;
  export import Rows = RowsAPI.Rows;
  export import RowStreamResponse = RowsAPI.RowStreamResponse;
  export import RowStreamParams = RowsAPI.RowStreamParams;
  export import TestResults = TestResultsAPI.TestResults;
  export import TestResultListResponse = TestResultsAPI.TestResultListResponse;
  export import TestResultListParams = TestResultsAPI.TestResultListParams;
}
