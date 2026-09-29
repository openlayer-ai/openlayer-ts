// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class RuleResults extends APIResource {
  /**
   * Retrieve a rule result.
   *
   * @example
   * ```ts
   * const ruleResult =
   *   await client.governance.ruleResults.retrieve(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   );
   * ```
   */
  retrieve(ruleResultID: string, options?: RequestOptions): APIPromise<RuleResultRetrieveResponse> {
    return this._client.get(path`/rule-results/${ruleResultID}`, options);
  }

  /**
   * Update a rule result.
   *
   * @example
   * ```ts
   * const ruleResult =
   *   await client.governance.ruleResults.update(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   );
   * ```
   */
  update(
    ruleResultID: string,
    body: RuleResultUpdateParams,
    options?: RequestOptions,
  ): APIPromise<RuleResultUpdateResponse> {
    return this._client.patch(path`/rule-results/${ruleResultID}`, { body, ...options });
  }

  /**
   * List the rule results in a workspace.
   *
   * @example
   * ```ts
   * const ruleResults =
   *   await client.governance.ruleResults.list(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   );
   * ```
   */
  list(
    workspaceID: string,
    query: RuleResultListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<RuleResultListResponse> {
    return this._client.get(path`/workspaces/${workspaceID}/rule-results`, { query, ...options });
  }

  /**
   * Attach evidence to a rule result.
   *
   * @example
   * ```ts
   * const response =
   *   await client.governance.ruleResults.createEvidence(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   );
   * ```
   */
  createEvidence(
    ruleResultID: string,
    body: RuleResultCreateEvidenceParams,
    options?: RequestOptions,
  ): APIPromise<RuleResultCreateEvidenceResponse> {
    return this._client.post(path`/rule-results/${ruleResultID}/evidence`, { body, ...options });
  }

  /**
   * List the evidence attached to a rule result.
   *
   * @example
   * ```ts
   * const response =
   *   await client.governance.ruleResults.listEvidence(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   );
   * ```
   */
  listEvidence(
    ruleResultID: string,
    query: RuleResultListEvidenceParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<RuleResultListEvidenceResponse> {
    return this._client.get(path`/rule-results/${ruleResultID}/evidence`, { query, ...options });
  }
}

/**
 * The compliance status of one rule for one entity: a project for project-scoped
 * rules, or the workspace for workspace-scoped rules.
 */
export interface RuleResultRetrieveResponse {
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
   * Whether this result is excluded from compliance calculations. Excludes just this
   * result, without deactivating the rule everywhere.
   */
  deactivated: boolean;

  /**
   * The rule this result belongs to.
   */
  ruleId: string;

  /**
   * The compliance status of the rule for this entity. Computed by Openlayer and
   * can't be set directly.
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
  blockedBy?: Array<RuleResultRetrieveResponse.BlockedBy>;

  /**
   * Rule results that this one blocks.
   */
  blocking?: Array<RuleResultRetrieveResponse.Blocking>;

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
   * Why the result was excluded. Required when setting `deactivated` to `true`.
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

export namespace RuleResultRetrieveResponse {
  export interface BlockedBy {
    id?: string;

    /**
     * The compliance status of the rule for this entity. Computed by Openlayer and
     * can't be set directly.
     */
    status?: 'running' | 'passing' | 'failing' | 'skipped' | 'error' | 'pending' | 'due_soon';
  }

  export interface Blocking {
    id?: string;

    /**
     * The compliance status of the rule for this entity. Computed by Openlayer and
     * can't be set directly.
     */
    status?: 'running' | 'passing' | 'failing' | 'skipped' | 'error' | 'pending' | 'due_soon';
  }
}

/**
 * The compliance status of one rule for one entity: a project for project-scoped
 * rules, or the workspace for workspace-scoped rules.
 */
export interface RuleResultUpdateResponse {
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
   * Whether this result is excluded from compliance calculations. Excludes just this
   * result, without deactivating the rule everywhere.
   */
  deactivated: boolean;

  /**
   * The rule this result belongs to.
   */
  ruleId: string;

  /**
   * The compliance status of the rule for this entity. Computed by Openlayer and
   * can't be set directly.
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
  blockedBy?: Array<RuleResultUpdateResponse.BlockedBy>;

  /**
   * Rule results that this one blocks.
   */
  blocking?: Array<RuleResultUpdateResponse.Blocking>;

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
   * Why the result was excluded. Required when setting `deactivated` to `true`.
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

export namespace RuleResultUpdateResponse {
  export interface BlockedBy {
    id?: string;

    /**
     * The compliance status of the rule for this entity. Computed by Openlayer and
     * can't be set directly.
     */
    status?: 'running' | 'passing' | 'failing' | 'skipped' | 'error' | 'pending' | 'due_soon';
  }

  export interface Blocking {
    id?: string;

    /**
     * The compliance status of the rule for this entity. Computed by Openlayer and
     * can't be set directly.
     */
    status?: 'running' | 'passing' | 'failing' | 'skipped' | 'error' | 'pending' | 'due_soon';
  }
}

export interface RuleResultListResponse {
  items: Array<RuleResultListResponse.Item>;
}

export namespace RuleResultListResponse {
  /**
   * The compliance status of one rule for one entity: a project for project-scoped
   * rules, or the workspace for workspace-scoped rules.
   */
  export interface Item {
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
     * Whether this result is excluded from compliance calculations. Excludes just this
     * result, without deactivating the rule everywhere.
     */
    deactivated: boolean;

    /**
     * The rule this result belongs to.
     */
    ruleId: string;

    /**
     * The compliance status of the rule for this entity. Computed by Openlayer and
     * can't be set directly.
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
    blockedBy?: Array<Item.BlockedBy>;

    /**
     * Rule results that this one blocks.
     */
    blocking?: Array<Item.Blocking>;

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
     * Why the result was excluded. Required when setting `deactivated` to `true`.
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

  export namespace Item {
    export interface BlockedBy {
      id?: string;

      /**
       * The compliance status of the rule for this entity. Computed by Openlayer and
       * can't be set directly.
       */
      status?: 'running' | 'passing' | 'failing' | 'skipped' | 'error' | 'pending' | 'due_soon';
    }

    export interface Blocking {
      id?: string;

      /**
       * The compliance status of the rule for this entity. Computed by Openlayer and
       * can't be set directly.
       */
      status?: 'running' | 'passing' | 'failing' | 'skipped' | 'error' | 'pending' | 'due_soon';
    }
  }
}

/**
 * Evidence attached to a rule result to satisfy an evidence rule. Which field
 * holds it depends on the rule's `evidenceType`: `storageUri` for a document,
 * `text` for a written statement, or `url` for a link.
 */
export interface RuleResultCreateEvidenceResponse {
  /**
   * The evidence id.
   */
  id: string;

  /**
   * The user who attached the evidence.
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
   * A description of what the evidence shows.
   */
  description?: string | null;

  /**
   * The evidence name.
   */
  name?: string | null;

  /**
   * Where the uploaded file is stored. Set when the rule's `evidenceType` is
   * `document`. Upload the file first with `POST /storage/presigned-url` and send
   * the storage URI it returns.
   */
  storageUri?: string | null;

  /**
   * The evidence text. Set when the rule's `evidenceType` is `text`.
   */
  text?: string | null;

  /**
   * A link to the evidence. Set when the rule's `evidenceType` is `url`.
   */
  url?: string | null;
}

export interface RuleResultListEvidenceResponse {
  items: Array<RuleResultListEvidenceResponse.Item>;
}

export namespace RuleResultListEvidenceResponse {
  /**
   * Evidence attached to a rule result to satisfy an evidence rule. Which field
   * holds it depends on the rule's `evidenceType`: `storageUri` for a document,
   * `text` for a written statement, or `url` for a link.
   */
  export interface Item {
    /**
     * The evidence id.
     */
    id: string;

    /**
     * The user who attached the evidence.
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
     * A description of what the evidence shows.
     */
    description?: string | null;

    /**
     * The evidence name.
     */
    name?: string | null;

    /**
     * Where the uploaded file is stored. Set when the rule's `evidenceType` is
     * `document`. Upload the file first with `POST /storage/presigned-url` and send
     * the storage URI it returns.
     */
    storageUri?: string | null;

    /**
     * The evidence text. Set when the rule's `evidenceType` is `text`.
     */
    text?: string | null;

    /**
     * A link to the evidence. Set when the rule's `evidenceType` is `url`.
     */
    url?: string | null;
  }
}

export interface RuleResultUpdateParams {
  /**
   * The user responsible for this result.
   */
  assigneeId?: string | null;

  /**
   * Rule results that must pass before this one can be satisfied.
   */
  blockedBy?: Array<RuleResultUpdateParams.BlockedBy>;

  /**
   * Rule results that this one blocks.
   */
  blocking?: Array<RuleResultUpdateParams.Blocking>;

  /**
   * Whether this result is excluded from compliance calculations. Excludes just this
   * result, without deactivating the rule everywhere.
   */
  deactivated?: boolean;

  /**
   * Why the result was excluded. Required when setting `deactivated` to `true`.
   */
  deactivatedReason?: string | null;
}

export namespace RuleResultUpdateParams {
  export interface BlockedBy {
    id?: string;

    /**
     * The compliance status of the rule for this entity. Computed by Openlayer and
     * can't be set directly.
     */
    status?: 'running' | 'passing' | 'failing' | 'skipped' | 'error' | 'pending' | 'due_soon';
  }

  export interface Blocking {
    id?: string;

    /**
     * The compliance status of the rule for this entity. Computed by Openlayer and
     * can't be set directly.
     */
    status?: 'running' | 'passing' | 'failing' | 'skipped' | 'error' | 'pending' | 'due_soon';
  }
}

export interface RuleResultListParams {
  /**
   * Only include items belonging to at least one enabled framework.
   */
  enabledFrameworkOnly?: boolean;

  /**
   * Only include items belonging to this framework.
   */
  frameworkId?: string;

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
   * Only include results of this rule.
   */
  ruleId?: string;

  /**
   * Only include rules with this scope.
   */
  scope?: 'project' | 'workspace';

  /**
   * Filter by a free-text search over names and descriptions.
   */
  searchQuery?: string;

  /**
   * Only include items whose rule result has this compliance status.
   */
  status?: 'running' | 'passing' | 'failing' | 'skipped' | 'error' | 'pending' | 'due_soon';

  /**
   * Only include rules of this type.
   */
  type?: 'platform' | 'evidence';
}

export interface RuleResultCreateEvidenceParams {
  /**
   * A description of what the evidence shows.
   */
  description?: string | null;

  /**
   * The evidence name.
   */
  name?: string | null;

  /**
   * Where the uploaded file is stored. Set when the rule's `evidenceType` is
   * `document`. Upload the file first with `POST /storage/presigned-url` and send
   * the storage URI it returns.
   */
  storageUri?: string | null;

  /**
   * The evidence text. Set when the rule's `evidenceType` is `text`.
   */
  text?: string | null;

  /**
   * A link to the evidence. Set when the rule's `evidenceType` is `url`.
   */
  url?: string | null;
}

export interface RuleResultListEvidenceParams {
  /**
   * The page to return in a paginated query.
   */
  page?: number;

  /**
   * Maximum number of items to return per page.
   */
  perPage?: number;
}

export declare namespace RuleResults {
  export {
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
}
