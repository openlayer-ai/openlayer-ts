// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import { APIPromise } from '../../../core/api-promise';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class Subsections extends APIResource {
  /**
   * List the rules mapped to a subsection of a framework document.
   *
   * A subsection is usually the level at which a standard states an individual
   * requirement, so this is the endpoint to use when you want to show which rules
   * cover a specific clause.
   *
   * @example
   * ```ts
   * const response =
   *   await client.governance.frameworks.subsections.listRules(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     { frameworkId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' },
   *   );
   * ```
   */
  listRules(
    subsectionID: string,
    params: SubsectionListRulesParams,
    options?: RequestOptions,
  ): APIPromise<SubsectionListRulesResponse> {
    const { frameworkId, ...query } = params;
    return this._client.get(path`/frameworks/${frameworkId}/subsections/${subsectionID}/rules`, {
      query,
      ...options,
    });
  }
}

export interface SubsectionListRulesResponse {
  items: Array<SubsectionListRulesResponse.Item>;
}

export namespace SubsectionListRulesResponse {
  export interface Item {
    /**
     * The rule id.
     */
    id: string;

    /**
     * The creation date.
     */
    dateCreated: string;

    /**
     * The last update date.
     */
    dateUpdated: string;

    /**
     * The rule name.
     */
    name: string;

    /**
     * Whether the rule is evaluated once for the whole workspace, or once per project
     * the rule's frameworks apply to.
     */
    scope: 'project' | 'workspace';

    /**
     * `platform` rules are evaluated automatically from the state of your Openlayer
     * workspace. `evidence` rules are satisfied by attaching evidence.
     */
    type: 'platform' | 'evidence';

    /**
     * The id of the workspace the rule belongs to.
     */
    workspaceId: string;

    /**
     * The user responsible for satisfying the rule.
     */
    assigneeId?: string | null;

    /**
     * Configuration for the platform check, when the automation takes parameters.
     */
    automationParams?: { [key: string]: unknown } | null;

    /**
     * Which workspace signal a platform rule checks, for example
     * `monitoring_mode_enabled`, `test_setup`, or `project_owner_set`. `null` for
     * evidence rules.
     */
    automationType?: string | null;

    /**
     * Whether the rule is excluded from compliance calculations.
     */
    deactivated?: boolean;

    /**
     * What the rule requires.
     */
    description?: string | null;

    /**
     * The kind of evidence that satisfies the rule. `null` for platform rules.
     */
    evidenceType?: 'document' | 'text' | 'url' | 'categoryValue' | null;

    /**
     * The frameworks that include this rule.
     */
    frameworks?: Array<Item.Framework>;

    /**
     * Whether the rule is managed by Openlayer and cannot be edited.
     */
    immutable?: boolean;

    /**
     * How often evidence must be renewed, in days. Once evidence is older than this,
     * the rule result becomes `due_soon` and then `failing`.
     */
    renewalCadenceDays?: number | null;

    /**
     * The rule's results, one per entity the rule is evaluated against. Only returned
     * when `includeResults` is `true`.
     */
    results?: Array<Item.Result>;

    /**
     * Pass-rate counts across all of the rule's entities, independent of any status
     * filter applied to the request.
     */
    resultsSummary?: Item.ResultsSummary | null;

    /**
     * The rule tags associated with the rule.
     */
    tags?: Array<Item.Tag> | null;
  }

  export namespace Item {
    export interface Framework {
      /**
       * The framework id.
       */
      id: string;

      /**
       * The icon shown for the framework.
       */
      avatar: Framework.Avatar | null;

      /**
       * Identifies a framework that ships with Openlayer, for example `eu_ai_act`,
       * `iso_42001`, `nist_ai_rmf`, or `traiga`. `null` for frameworks you create
       * yourself.
       */
      builtInSlug: string | null;

      /**
       * Whether the framework is active. Rules of a disabled framework are not evaluated
       * and do not count towards compliance.
       */
      enabled: boolean;

      /**
       * The framework name.
       */
      name: string;
    }

    export namespace Framework {
      /**
       * The icon shown for the framework.
       */
      export interface Avatar {
        type: 'emoji' | 'imageUrl' | 'builtinImage';

        value: string;
      }
    }

    export interface Result {
      /**
       * The rule result id.
       */
      id: string;

      /**
       * The creation date.
       */
      dateCreated: string;

      /**
       * The last update date.
       */
      dateUpdated: string;

      /**
       * Whether this result is excluded from compliance calculations.
       */
      deactivated: boolean;

      /**
       * The rule this result belongs to.
       */
      ruleId: string;

      /**
       * The compliance status of the rule for this entity.
       */
      status: 'running' | 'passing' | 'failing' | 'skipped' | 'error' | 'pending' | 'due_soon';

      /**
       * The id of the workspace the rule result belongs to.
       */
      workspaceId: string;

      /**
       * The user responsible for this result.
       */
      assigneeId?: string | null;

      /**
       * Rule results that must pass before this one can be satisfied.
       */
      blockedBy?: Array<Result.BlockedBy>;

      /**
       * Rule results that this one blocks.
       */
      blocking?: Array<Result.Blocking>;

      /**
       * When the rule was last evaluated. Platform rules only.
       */
      dateLastEvaluated?: string | null;

      /**
       * When the most recent piece of evidence was attached. Evidence rules only.
       */
      dateOfLatestEvidence?: string | null;

      /**
       * When the rule will next be evaluated. Platform rules only.
       */
      dateOfNextEvaluation?: string | null;

      /**
       * When the evidence must be renewed. Evidence rules with a renewal cadence only.
       */
      dateOfRenewal?: string | null;

      /**
       * Why the result was excluded.
       */
      deactivatedReason?: string | null;

      /**
       * The project this result was evaluated for. `null` for workspace-scoped rules.
       */
      projectId?: string | null;

      /**
       * A human-readable explanation of the status.
       */
      statusMessage?: string | null;
    }

    export namespace Result {
      export interface BlockedBy {
        id?: string;

        /**
         * The compliance status of the rule for this entity.
         */
        status?: 'running' | 'passing' | 'failing' | 'skipped' | 'error' | 'pending' | 'due_soon';
      }

      export interface Blocking {
        id?: string;

        /**
         * The compliance status of the rule for this entity.
         */
        status?: 'running' | 'passing' | 'failing' | 'skipped' | 'error' | 'pending' | 'due_soon';
      }
    }

    /**
     * Pass-rate counts across all of the rule's entities, independent of any status
     * filter applied to the request.
     */
    export interface ResultsSummary {
      passing?: number;

      total?: number;
    }

    export interface Tag {
      /**
       * The rule tag id.
       */
      id: string;

      /**
       * The user who created the tag. `null` for tags that ship with Openlayer.
       */
      creatorId: string | null;

      /**
       * The creation date.
       */
      dateCreated: string;

      /**
       * The last update date.
       */
      dateUpdated: string;

      /**
       * Whether the tag is managed by Openlayer and cannot be edited or deleted.
       */
      immutable: boolean;

      /**
       * The tag name.
       */
      name: string;

      /**
       * The id of the workspace the tag belongs to.
       */
      workspaceId: string;

      /**
       * The color the tag is displayed with.
       */
      color?: string | null;
    }
  }
}

export interface SubsectionListRulesParams {
  /**
   * Path param: The framework id.
   */
  frameworkId: string;

  /**
   * Query param: Whether to include each rule's results inline, in a `results`
   * array.
   */
  includeResults?: boolean;

  /**
   * Query param: The page to return in a paginated query.
   */
  page?: number;

  /**
   * Query param: Maximum number of items to return per page.
   */
  perPage?: number;

  /**
   * Query param: Only include items that apply to this project.
   */
  projectId?: string;

  /**
   * Query param: Only include items whose rule result has this compliance status.
   */
  status?: 'running' | 'passing' | 'failing' | 'skipped' | 'error' | 'pending' | 'due_soon';
}

export declare namespace Subsections {
  export {
    type SubsectionListRulesResponse as SubsectionListRulesResponse,
    type SubsectionListRulesParams as SubsectionListRulesParams,
  };
}
