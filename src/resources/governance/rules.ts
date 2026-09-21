// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Rules extends APIResource {
  /**
   * Create a governance rule in a workspace.
   *
   * A rule is one requirement. Its `type` decides how it is satisfied, and the two
   * types accept different fields:
   *
   * - `platform` rules are evaluated automatically from the state of your workspace.
   *   Set `automationType` to the signal to check. Their `scope` must be `project`,
   *   and `evidenceType` and `renewalCadenceDays` must be omitted or `null`.
   * - `evidence` rules are satisfied by attaching evidence. Set `evidenceType` to
   *   the kind of evidence that satisfies them. `automationType` and
   *   `automationParams` must be omitted or `null`.
   *
   * A new rule belongs to no framework. Map it to one from the Openlayer app.
   *
   * @example
   * ```ts
   * const rule = await client.governance.rules.create(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   {
   *     name: 'Monitoring enabled',
   *     scope: 'project',
   *     type: 'platform',
   *   },
   * );
   * ```
   */
  create(
    workspaceID: string,
    body: RuleCreateParams,
    options?: RequestOptions,
  ): APIPromise<RuleCreateResponse> {
    return this._client.post(path`/workspaces/${workspaceID}/rules`, { body, ...options });
  }

  /**
   * Retrieve a governance rule by its id, including the frameworks it belongs to and
   * its tags.
   *
   * @example
   * ```ts
   * const rule = await client.governance.rules.retrieve(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  retrieve(ruleID: string, options?: RequestOptions): APIPromise<RuleRetrieveResponse> {
    return this._client.get(path`/rules/${ruleID}`, options);
  }

  /**
   * Update a governance rule. Only the fields you send are changed.
   *
   * Rules that ship with Openlayer report `immutable: true` and cannot be edited.
   *
   * A rule's `scope`, `type`, `evidenceType`, and automation are fixed once it
   * exists -- create a new rule instead of converting one.
   *
   * @example
   * ```ts
   * const rule = await client.governance.rules.update(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  update(ruleID: string, body: RuleUpdateParams, options?: RequestOptions): APIPromise<RuleUpdateResponse> {
    return this._client.put(path`/rules/${ruleID}`, { body, ...options });
  }

  /**
   * List the governance rules in a workspace.
   *
   * A rule is a single requirement Openlayer tracks. `platform` rules are evaluated
   * automatically from the state of your workspace; `evidence` rules are satisfied
   * by attaching evidence. A rule can belong to several frameworks at once, and
   * rules that belong to none are returned too unless you pass
   * `includeUnframed=false`.
   *
   * Pass `includeResults=true` to get each rule's compliance results inline instead
   * of fetching them separately.
   *
   * @example
   * ```ts
   * const rules = await client.governance.rules.list(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  list(
    workspaceID: string,
    query: RuleListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<RuleListResponse> {
    return this._client.get(path`/workspaces/${workspaceID}/rules`, { query, ...options });
  }

  /**
   * Delete a governance rule and its rule results.
   *
   * Only rules you created can be deleted. Rules that ship with Openlayer report
   * `immutable: true` and cannot be deleted -- exclude one from compliance by
   * setting `deactivated` with `PUT /rules/{ruleId}` instead.
   *
   * @example
   * ```ts
   * await client.governance.rules.delete(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  delete(ruleID: string, options?: RequestOptions): APIPromise<void> {
    return this._client.delete(path`/rules/${ruleID}`, {
      ...options,
      headers: buildHeaders([{ Accept: '*/*' }, options?.headers]),
    });
  }
}

export interface RuleCreateResponse {
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
  frameworks?: Array<RuleCreateResponse.Framework>;

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
  results?: Array<RuleCreateResponse.Result>;

  /**
   * Pass-rate counts across all of the rule's entities, independent of any status
   * filter applied to the request.
   */
  resultsSummary?: RuleCreateResponse.ResultsSummary | null;

  /**
   * The rule tags associated with the rule.
   */
  tags?: Array<RuleCreateResponse.Tag> | null;
}

export namespace RuleCreateResponse {
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

export interface RuleRetrieveResponse {
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
  frameworks?: Array<RuleRetrieveResponse.Framework>;

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
  results?: Array<RuleRetrieveResponse.Result>;

  /**
   * Pass-rate counts across all of the rule's entities, independent of any status
   * filter applied to the request.
   */
  resultsSummary?: RuleRetrieveResponse.ResultsSummary | null;

  /**
   * The rule tags associated with the rule.
   */
  tags?: Array<RuleRetrieveResponse.Tag> | null;
}

export namespace RuleRetrieveResponse {
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

export interface RuleUpdateResponse {
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
  frameworks?: Array<RuleUpdateResponse.Framework>;

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
  results?: Array<RuleUpdateResponse.Result>;

  /**
   * Pass-rate counts across all of the rule's entities, independent of any status
   * filter applied to the request.
   */
  resultsSummary?: RuleUpdateResponse.ResultsSummary | null;

  /**
   * The rule tags associated with the rule.
   */
  tags?: Array<RuleUpdateResponse.Tag> | null;
}

export namespace RuleUpdateResponse {
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

export interface RuleListResponse {
  items: Array<RuleListResponse.Item>;
}

export namespace RuleListResponse {
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

export interface RuleCreateParams {
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
   * How often evidence must be renewed, in days. Once evidence is older than this,
   * the rule result becomes `due_soon` and then `failing`.
   */
  renewalCadenceDays?: number | null;

  /**
   * The ids of the rule tags to associate with the rule. Replaces the rule's tags.
   * Read them back from `tags`, and list the tags available in the workspace with
   * `GET /workspaces/{workspaceId}/rule-tags`.
   */
  tagIds?: Array<string> | null;
}

export interface RuleUpdateParams {
  /**
   * The user responsible for satisfying the rule.
   */
  assigneeId?: string | null;

  /**
   * Whether the rule is excluded from compliance calculations.
   */
  deactivated?: boolean;

  /**
   * What the rule requires.
   */
  description?: string | null;

  /**
   * The rule name.
   */
  name?: string;

  /**
   * How often evidence must be renewed, in days. Once evidence is older than this,
   * the rule result becomes `due_soon` and then `failing`.
   */
  renewalCadenceDays?: number | null;

  /**
   * The ids of the rule tags to associate with the rule. Replaces the rule's tags.
   * Read them back from `tags`, and list the tags available in the workspace with
   * `GET /workspaces/{workspaceId}/rule-tags`.
   */
  tagIds?: Array<string> | null;
}

export interface RuleListParams {
  /**
   * Whether to sort in ascending order.
   */
  asc?: boolean;

  /**
   * Only include rules assigned to this user.
   */
  assigneeId?: string;

  /**
   * Only include rules that are deactivated (or active).
   */
  deactivated?: boolean;

  /**
   * Only include items belonging to at least one enabled framework.
   */
  enabledFrameworkOnly?: boolean;

  /**
   * Only include items belonging to this framework.
   */
  frameworkId?: string;

  /**
   * Only include rules in one bucket of the compliance workflow. `open` covers rules
   * that still need attention, `done` covers rules that are fully satisfied, and
   * `excluded` covers rules that have been deactivated.
   */
  group?: 'open' | 'excluded' | 'done';

  /**
   * Whether to include each rule's results inline, in a `results` array.
   */
  includeResults?: boolean;

  /**
   * Whether to include rules that are not part of any framework.
   */
  includeUnframed?: boolean;

  /**
   * The page to return in a paginated query.
   */
  page?: number;

  /**
   * Maximum number of items to return per page.
   */
  perPage?: number;

  /**
   * Only include items that apply to this project.
   */
  projectId?: string;

  /**
   * Only include rules with this scope.
   */
  scope?: 'project' | 'workspace';

  /**
   * Filter by a free-text search over names and descriptions.
   */
  searchQuery?: string;

  /**
   * The field to sort on.
   */
  sortBy?: 'name' | 'status' | 'frameworks' | 'scope' | 'dateCreated';

  /**
   * Only include items whose rule result has this compliance status.
   */
  status?: 'running' | 'passing' | 'failing' | 'skipped' | 'error' | 'pending' | 'due_soon';

  /**
   * Only include rules carrying all of these rule tags. Pass tag ids, which you can
   * look up with [List rule tags](/api-reference/rest/governance/list-rule-tags).
   */
  tags?: Array<string>;

  /**
   * Only include rules of this type.
   */
  type?: 'platform' | 'evidence';
}

export declare namespace Rules {
  export {
    type RuleCreateResponse as RuleCreateResponse,
    type RuleRetrieveResponse as RuleRetrieveResponse,
    type RuleUpdateResponse as RuleUpdateResponse,
    type RuleListResponse as RuleListResponse,
    type RuleCreateParams as RuleCreateParams,
    type RuleUpdateParams as RuleUpdateParams,
    type RuleListParams as RuleListParams,
  };
}
