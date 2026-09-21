// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class RuleStats extends APIResource {
  /**
   * Get a compliance roll-up for a workspace: how many rules exist, and how many of
   * their results are passing, failing, pending, or due for renewal.
   *
   * Counts respect the filters you pass, so `frameworkId` gives you a single
   * framework's overall compliance and `projectId` gives you a single project's.
   *
   * @example
   * ```ts
   * const ruleStat = await client.governance.ruleStats.retrieve(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  retrieve(
    workspaceID: string,
    query: RuleStatRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<RuleStatRetrieveResponse> {
    return this._client.get(path`/workspaces/${workspaceID}/rule-stats`, { query, ...options });
  }
}

export interface RuleStatRetrieveResponse {
  /**
   * Counts of rule results, after any filters in the request, with breakdowns by the
   * type and scope of the rule each result belongs to.
   */
  ruleResults: RuleStatRetrieveResponse.RuleResults;

  /**
   * Counts of the rules themselves, after any filters in the request.
   */
  rules: RuleStatRetrieveResponse.Rules;
}

export namespace RuleStatRetrieveResponse {
  /**
   * Counts of rule results, after any filters in the request, with breakdowns by the
   * type and scope of the rule each result belongs to.
   */
  export interface RuleResults {
    /**
     * The total number of rule results.
     */
    total: number;

    /**
     * The number of rule results whose evidence is about to expire.
     */
    totalDueSoon: number;

    /**
     * The number of rule results that errored during evaluation.
     */
    totalError: number;

    /**
     * The number of failing rule results.
     */
    totalFailing: number;

    /**
     * The number of passing rule results.
     */
    totalPassing: number;

    /**
     * The number of rule results that have not been satisfied yet.
     */
    totalPending: number;

    /**
     * The number of rule results currently being evaluated.
     */
    totalRunning: number;

    /**
     * The number of skipped rule results.
     */
    totalSkipped: number;

    byRuleScope?: RuleResults.ByRuleScope;

    byRuleType?: RuleResults.ByRuleType;
  }

  export namespace RuleResults {
    export interface ByRuleScope {
      project?: ByRuleScope.Project;

      workspace?: ByRuleScope.Workspace;
    }

    export namespace ByRuleScope {
      export interface Project {
        /**
         * The total number of rule results.
         */
        total: number;

        /**
         * The number of rule results whose evidence is about to expire.
         */
        totalDueSoon: number;

        /**
         * The number of rule results that errored during evaluation.
         */
        totalError: number;

        /**
         * The number of failing rule results.
         */
        totalFailing: number;

        /**
         * The number of passing rule results.
         */
        totalPassing: number;

        /**
         * The number of rule results that have not been satisfied yet.
         */
        totalPending: number;

        /**
         * The number of rule results currently being evaluated.
         */
        totalRunning: number;

        /**
         * The number of skipped rule results.
         */
        totalSkipped: number;
      }

      export interface Workspace {
        /**
         * The total number of rule results.
         */
        total: number;

        /**
         * The number of rule results whose evidence is about to expire.
         */
        totalDueSoon: number;

        /**
         * The number of rule results that errored during evaluation.
         */
        totalError: number;

        /**
         * The number of failing rule results.
         */
        totalFailing: number;

        /**
         * The number of passing rule results.
         */
        totalPassing: number;

        /**
         * The number of rule results that have not been satisfied yet.
         */
        totalPending: number;

        /**
         * The number of rule results currently being evaluated.
         */
        totalRunning: number;

        /**
         * The number of skipped rule results.
         */
        totalSkipped: number;
      }
    }

    export interface ByRuleType {
      evidence?: ByRuleType.Evidence;

      platform?: ByRuleType.Platform;
    }

    export namespace ByRuleType {
      export interface Evidence {
        /**
         * The total number of rule results.
         */
        total: number;

        /**
         * The number of rule results whose evidence is about to expire.
         */
        totalDueSoon: number;

        /**
         * The number of rule results that errored during evaluation.
         */
        totalError: number;

        /**
         * The number of failing rule results.
         */
        totalFailing: number;

        /**
         * The number of passing rule results.
         */
        totalPassing: number;

        /**
         * The number of rule results that have not been satisfied yet.
         */
        totalPending: number;

        /**
         * The number of rule results currently being evaluated.
         */
        totalRunning: number;

        /**
         * The number of skipped rule results.
         */
        totalSkipped: number;
      }

      export interface Platform {
        /**
         * The total number of rule results.
         */
        total: number;

        /**
         * The number of rule results whose evidence is about to expire.
         */
        totalDueSoon: number;

        /**
         * The number of rule results that errored during evaluation.
         */
        totalError: number;

        /**
         * The number of failing rule results.
         */
        totalFailing: number;

        /**
         * The number of passing rule results.
         */
        totalPassing: number;

        /**
         * The number of rule results that have not been satisfied yet.
         */
        totalPending: number;

        /**
         * The number of rule results currently being evaluated.
         */
        totalRunning: number;

        /**
         * The number of skipped rule results.
         */
        totalSkipped: number;
      }
    }
  }

  /**
   * Counts of the rules themselves, after any filters in the request.
   */
  export interface Rules {
    /**
     * Rule counts by scope.
     */
    byScope?: Rules.ByScope;

    /**
     * Rule counts by type.
     */
    byType?: Rules.ByType;

    /**
     * The total number of rules.
     */
    total?: number;
  }

  export namespace Rules {
    /**
     * Rule counts by scope.
     */
    export interface ByScope {
      project?: number;

      workspace?: number;
    }

    /**
     * Rule counts by type.
     */
    export interface ByType {
      evidence?: number;

      platform?: number;
    }
  }
}

export interface RuleStatRetrieveParams {
  /**
   * Only include items belonging to this framework.
   */
  frameworkId?: string;

  /**
   * Only include items that apply to this project.
   */
  projectId?: string;
}

export declare namespace RuleStats {
  export {
    type RuleStatRetrieveResponse as RuleStatRetrieveResponse,
    type RuleStatRetrieveParams as RuleStatRetrieveParams,
  };
}
