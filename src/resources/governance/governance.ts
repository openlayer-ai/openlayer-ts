// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as RuleResultsAPI from './rule-results';
import {
  RuleResultCreateEvidenceParams,
  RuleResultCreateEvidenceResponse,
  RuleResultListEvidenceParams,
  RuleResultListEvidenceResponse,
  RuleResultListParams,
  RuleResultListResponse,
  RuleResultRetrieveResponse,
  RuleResultUpdateParams,
  RuleResultUpdateResponse,
  RuleResults,
} from './rule-results';
import * as RuleStatsAPI from './rule-stats';
import { RuleStatRetrieveParams, RuleStatRetrieveResponse, RuleStats } from './rule-stats';
import * as RuleTagsAPI from './rule-tags';
import { RuleTagListParams, RuleTagListResponse, RuleTags } from './rule-tags';
import * as RulesAPI from './rules';
import {
  RuleCreateParams,
  RuleCreateResponse,
  RuleListParams,
  RuleListResponse,
  RuleRetrieveResponse,
  RuleUpdateParams,
  RuleUpdateResponse,
  Rules,
} from './rules';
import * as FrameworksAPI from './frameworks/frameworks';
import {
  FrameworkCreateParams,
  FrameworkCreateResponse,
  FrameworkExportParams,
  FrameworkExportResponse,
  FrameworkListParams,
  FrameworkListProjectRuleStatsParams,
  FrameworkListProjectRuleStatsResponse,
  FrameworkListProjectsParams,
  FrameworkListProjectsResponse,
  FrameworkListResponse,
  FrameworkListRulesParams,
  FrameworkListRulesResponse,
  FrameworkRetrieveResponse,
  FrameworkUpdateParams,
  FrameworkUpdateResponse,
  Frameworks,
} from './frameworks/frameworks';

export class Governance extends APIResource {
  frameworks: FrameworksAPI.Frameworks = new FrameworksAPI.Frameworks(this._client);
  rules: RulesAPI.Rules = new RulesAPI.Rules(this._client);
  ruleResults: RuleResultsAPI.RuleResults = new RuleResultsAPI.RuleResults(this._client);
  ruleStats: RuleStatsAPI.RuleStats = new RuleStatsAPI.RuleStats(this._client);
  ruleTags: RuleTagsAPI.RuleTags = new RuleTagsAPI.RuleTags(this._client);
}

Governance.Frameworks = Frameworks;
Governance.Rules = Rules;
Governance.RuleResults = RuleResults;
Governance.RuleStats = RuleStats;
Governance.RuleTags = RuleTags;

export declare namespace Governance {
  export {
    Frameworks as Frameworks,
    type FrameworkCreateResponse as FrameworkCreateResponse,
    type FrameworkRetrieveResponse as FrameworkRetrieveResponse,
    type FrameworkUpdateResponse as FrameworkUpdateResponse,
    type FrameworkListResponse as FrameworkListResponse,
    type FrameworkExportResponse as FrameworkExportResponse,
    type FrameworkListProjectRuleStatsResponse as FrameworkListProjectRuleStatsResponse,
    type FrameworkListProjectsResponse as FrameworkListProjectsResponse,
    type FrameworkListRulesResponse as FrameworkListRulesResponse,
    type FrameworkCreateParams as FrameworkCreateParams,
    type FrameworkUpdateParams as FrameworkUpdateParams,
    type FrameworkListParams as FrameworkListParams,
    type FrameworkExportParams as FrameworkExportParams,
    type FrameworkListProjectRuleStatsParams as FrameworkListProjectRuleStatsParams,
    type FrameworkListProjectsParams as FrameworkListProjectsParams,
    type FrameworkListRulesParams as FrameworkListRulesParams,
  };

  export {
    Rules as Rules,
    type RuleCreateResponse as RuleCreateResponse,
    type RuleRetrieveResponse as RuleRetrieveResponse,
    type RuleUpdateResponse as RuleUpdateResponse,
    type RuleListResponse as RuleListResponse,
    type RuleCreateParams as RuleCreateParams,
    type RuleUpdateParams as RuleUpdateParams,
    type RuleListParams as RuleListParams,
  };

  export {
    RuleResults as RuleResults,
    type RuleResultRetrieveResponse as RuleResultRetrieveResponse,
    type RuleResultUpdateResponse as RuleResultUpdateResponse,
    type RuleResultListResponse as RuleResultListResponse,
    type RuleResultCreateEvidenceResponse as RuleResultCreateEvidenceResponse,
    type RuleResultListEvidenceResponse as RuleResultListEvidenceResponse,
    type RuleResultUpdateParams as RuleResultUpdateParams,
    type RuleResultListParams as RuleResultListParams,
    type RuleResultCreateEvidenceParams as RuleResultCreateEvidenceParams,
    type RuleResultListEvidenceParams as RuleResultListEvidenceParams,
  };

  export {
    RuleStats as RuleStats,
    type RuleStatRetrieveResponse as RuleStatRetrieveResponse,
    type RuleStatRetrieveParams as RuleStatRetrieveParams,
  };

  export {
    RuleTags as RuleTags,
    type RuleTagListResponse as RuleTagListResponse,
    type RuleTagListParams as RuleTagListParams,
  };
}
