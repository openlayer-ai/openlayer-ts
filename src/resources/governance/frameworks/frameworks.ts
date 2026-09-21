// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as DocumentsAPI from './documents';
import {
  DocumentListParams,
  DocumentListResponse,
  DocumentRetrieveParams,
  DocumentRetrieveResponse,
  Documents,
} from './documents';
import * as SectionsAPI from './sections';
import { SectionListRulesParams, SectionListRulesResponse, Sections } from './sections';
import * as SubsectionsAPI from './subsections';
import { SubsectionListRulesParams, SubsectionListRulesResponse, Subsections } from './subsections';
import { APIPromise } from '../../../core/api-promise';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class Frameworks extends APIResource {
  documents: DocumentsAPI.Documents = new DocumentsAPI.Documents(this._client);
  sections: SectionsAPI.Sections = new SectionsAPI.Sections(this._client);
  subsections: SubsectionsAPI.Subsections = new SubsectionsAPI.Subsections(this._client);

  /**
   * Create a custom governance framework in a workspace.
   *
   * Use this to track compliance against an internal policy, or against a standard
   * Openlayer does not ship as a built-in framework. A new framework starts with no
   * rules -- add them from the Openlayer app, or map an existing rule to it.
   *
   * A framework is created disabled unless you pass `enabled: true`. While it is
   * disabled its rules are not evaluated and do not count towards compliance.
   *
   * @example
   * ```ts
   * const framework = await client.governance.frameworks.create(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { name: 'EU AI Act' },
   * );
   * ```
   */
  create(
    workspaceID: string,
    body: FrameworkCreateParams,
    options?: RequestOptions,
  ): APIPromise<FrameworkCreateResponse> {
    return this._client.post(path`/workspaces/${workspaceID}/frameworks`, { body, ...options });
  }

  /**
   * Retrieve a governance framework by its id.
   *
   * @example
   * ```ts
   * const framework =
   *   await client.governance.frameworks.retrieve(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   );
   * ```
   */
  retrieve(frameworkID: string, options?: RequestOptions): APIPromise<FrameworkRetrieveResponse> {
    return this._client.get(path`/frameworks/${frameworkID}`, options);
  }

  /**
   * Update a governance framework.
   *
   * The most common use is activating or deactivating a framework for the workspace
   * by setting `enabled`. Rules of a disabled framework are not evaluated and do not
   * count towards compliance.
   *
   * Frameworks that ship with Openlayer report `immutable: true`. For those, only
   * `enabled`, `tags`, and `projectSelector` can be changed -- their name and
   * definition are managed by Openlayer.
   *
   * Only the fields you send are changed.
   *
   * @example
   * ```ts
   * const framework = await client.governance.frameworks.update(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  update(
    frameworkID: string,
    body: FrameworkUpdateParams,
    options?: RequestOptions,
  ): APIPromise<FrameworkUpdateResponse> {
    return this._client.put(path`/frameworks/${frameworkID}`, { body, ...options });
  }

  /**
   * List the governance frameworks in a workspace.
   *
   * A framework is a set of rules -- drawn from a regulation, a standard, or your
   * own internal policy -- that Openlayer tracks compliance against. Use this
   * endpoint to find the framework you want to report on, then read its rules and
   * rule results.
   *
   * @example
   * ```ts
   * const frameworks = await client.governance.frameworks.list(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  list(
    workspaceID: string,
    query: FrameworkListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<FrameworkListResponse> {
    return this._client.get(path`/workspaces/${workspaceID}/frameworks`, { query, ...options });
  }

  /**
   * Export a framework's evidence and progress as an audit-ready zip archive.
   *
   * The archive holds every evidence file uploaded against the framework's
   * evidence-based rules, a markdown report of the framework's progress and the
   * status of all its rules (broken down by documentation section when the framework
   * has documents), and CSV manifests of rules and evidence with SHA-256 checksums.
   *
   * Send `projectId` to export one project's compliance with the framework. Omit it
   * for the workspace-wide view across every project in the framework, including
   * workspace-scoped rules.
   *
   * The export runs as a background task, so this returns `202` immediately. To
   * collect the archive:
   *
   * 1. Poll `GET /background-tasks/{taskId}` with the returned `taskResultId` until
   *    `complete` is `true`.
   * 2. Read `outputs.storageUri` off that task.
   * 3. Exchange it for a download link at
   *    `GET /storage/presigned-url?storageUri=<uri>`.
   *
   * Rate limited to 2 requests per minute per framework. Asking for an export while
   * an identical one is still queued returns that task rather than starting a second
   * one.
   *
   * @example
   * ```ts
   * const response = await client.governance.frameworks.export(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  export(
    frameworkID: string,
    body: FrameworkExportParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<FrameworkExportResponse> {
    return this._client.post(path`/frameworks/${frameworkID}/export`, { body, ...options });
  }

  /**
   * Get a compliance roll-up for a framework, one row per project it applies to.
   *
   * Each row counts the project's rule results by status, so you can report on where
   * a framework is complete and where it is not without fetching every individual
   * rule result.
   *
   * @example
   * ```ts
   * const response =
   *   await client.governance.frameworks.listProjectRuleStats(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   );
   * ```
   */
  listProjectRuleStats(
    frameworkID: string,
    query: FrameworkListProjectRuleStatsParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<FrameworkListProjectRuleStatsResponse> {
    return this._client.get(path`/frameworks/${frameworkID}/project-rule-stats`, { query, ...options });
  }

  /**
   * List the projects a framework applies to.
   *
   * Which projects a framework covers is determined by its `projectSelector`. A
   * framework with an empty selector applies to every project in the workspace.
   *
   * @example
   * ```ts
   * const response =
   *   await client.governance.frameworks.listProjects(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   );
   * ```
   */
  listProjects(
    frameworkID: string,
    query: FrameworkListProjectsParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<FrameworkListProjectsResponse> {
    return this._client.get(path`/frameworks/${frameworkID}/projects`, { query, ...options });
  }

  /**
   * List the rules that belong to a framework.
   *
   * To read the compliance status of these rules, use
   * [List rule results](/api-reference/rest/governance/list-rule-results) with the
   * `frameworkId` filter, or fetch the results of an individual rule.
   *
   * @example
   * ```ts
   * const response =
   *   await client.governance.frameworks.listRules(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   );
   * ```
   */
  listRules(
    frameworkID: string,
    query: FrameworkListRulesParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<FrameworkListRulesResponse> {
    return this._client.get(path`/frameworks/${frameworkID}/rules`, { query, ...options });
  }
}

export interface FrameworkCreateResponse {
  /**
   * The framework id.
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
   * Whether the framework is active. Rules of a disabled framework are not evaluated
   * and do not count towards compliance.
   */
  enabled: boolean;

  /**
   * The framework name.
   */
  name: string;

  /**
   * Free-form labels on the framework.
   */
  tags: Array<string>;

  /**
   * The id of the workspace the framework belongs to.
   */
  workspaceId: string;

  /**
   * The icon shown for the framework.
   */
  avatar?: FrameworkCreateResponse.Avatar | null;

  /**
   * Identifies a framework that ships with Openlayer, for example `eu_ai_act`,
   * `iso_42001`, `nist_ai_rmf`, or `traiga`. `null` for frameworks you create
   * yourself.
   */
  builtInSlug?: string | null;

  /**
   * The user who created the framework. `null` for built-in frameworks.
   */
  creatorId?: string | null;

  /**
   * A short description of the framework.
   */
  description?: string | null;

  /**
   * A longer, rich-text description, as a TipTap JSON document.
   */
  extendedDescription?: { [key: string]: unknown } | null;

  /**
   * A link to the external standard or regulation the framework is based on.
   */
  href?: string | null;

  /**
   * Whether the framework definition is managed by Openlayer and cannot be edited.
   */
  immutable?: boolean;

  /**
   * Determines which projects the framework applies to. An empty or `null` `match`
   * array applies the framework to every project in the workspace.
   */
  projectSelector?: FrameworkCreateResponse.ProjectSelector | null;

  /**
   * Compliance roll-up for the framework. Present only on
   * `GET /workspaces/{workspaceId}/frameworks` when the request sets
   * `includeRuleStats=true`.
   */
  ruleStats?: FrameworkCreateResponse.RuleStats;
}

export namespace FrameworkCreateResponse {
  /**
   * The icon shown for the framework.
   */
  export interface Avatar {
    type: 'emoji' | 'imageUrl' | 'builtinImage';

    value: string;
  }

  /**
   * Determines which projects the framework applies to. An empty or `null` `match`
   * array applies the framework to every project in the workspace.
   */
  export interface ProjectSelector {
    /**
     * Match criteria, ANDed together.
     */
    match?: Array<ProjectSelector.Match> | null;
  }

  export namespace ProjectSelector {
    export interface Match {
      /**
       * The project property to match against.
       */
      property: 'taskType' | 'riskLevel' | 'riskTotalScore' | 'name' | 'ownerId' | 'modelTypes';

      /**
       * The value to match against. Pass an array to match any of several values, or
       * `null` to match projects where the property is unset. Omit it for `exists` and
       * `notExists`.
       */
      value: unknown;

      /**
       * How to compare the project property with `value`. One of `equals`, `notEquals`,
       * `contains`, `notContains`, `startsWith`, `endsWith`, `in`, `notIn`,
       * `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`,
       * `equalsIgnoreCase`, `containsIgnoreCase`, `matches`, `exists`, or `notExists`.
       */
      operator?: string;
    }
  }

  /**
   * Compliance roll-up for the framework. Present only on
   * `GET /workspaces/{workspaceId}/frameworks` when the request sets
   * `includeRuleStats=true`.
   */
  export interface RuleStats {
    /**
     * How many of the framework's projects fall into each completion band, where a
     * project's completion is the share of its rule results that are passing or
     * skipped. Projects with no evaluated results count as `low`.
     *
     * Zeroed when the request carries `projectId`: the bands compare a framework's
     * projects against each other, which says nothing about a single project.
     */
    projectCompletion: RuleStats.ProjectCompletion;

    /**
     * Rule result counts by status for this framework, matching what
     * `/workspaces/{workspaceId}/rule-stats?frameworkId=<id>` reports. Narrowed to a
     * single project when the request also carries `projectId`.
     */
    ruleResults: RuleStats.RuleResults;
  }

  export namespace RuleStats {
    /**
     * How many of the framework's projects fall into each completion band, where a
     * project's completion is the share of its rule results that are passing or
     * skipped. Projects with no evaluated results count as `low`.
     *
     * Zeroed when the request carries `projectId`: the bands compare a framework's
     * projects against each other, which says nothing about a single project.
     */
    export interface ProjectCompletion {
      /**
       * Projects at 80% completion or above.
       */
      high: number;

      /**
       * Projects below 20% completion.
       */
      low: number;

      /**
       * Projects at or above 20% but below 80% completion.
       */
      mid: number;
    }

    /**
     * Rule result counts by status for this framework, matching what
     * `/workspaces/{workspaceId}/rule-stats?frameworkId=<id>` reports. Narrowed to a
     * single project when the request also carries `projectId`.
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
    }
  }
}

export interface FrameworkRetrieveResponse {
  /**
   * The framework id.
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
   * Whether the framework is active. Rules of a disabled framework are not evaluated
   * and do not count towards compliance.
   */
  enabled: boolean;

  /**
   * The framework name.
   */
  name: string;

  /**
   * Free-form labels on the framework.
   */
  tags: Array<string>;

  /**
   * The id of the workspace the framework belongs to.
   */
  workspaceId: string;

  /**
   * The icon shown for the framework.
   */
  avatar?: FrameworkRetrieveResponse.Avatar | null;

  /**
   * Identifies a framework that ships with Openlayer, for example `eu_ai_act`,
   * `iso_42001`, `nist_ai_rmf`, or `traiga`. `null` for frameworks you create
   * yourself.
   */
  builtInSlug?: string | null;

  /**
   * The user who created the framework. `null` for built-in frameworks.
   */
  creatorId?: string | null;

  /**
   * A short description of the framework.
   */
  description?: string | null;

  /**
   * A longer, rich-text description, as a TipTap JSON document.
   */
  extendedDescription?: { [key: string]: unknown } | null;

  /**
   * A link to the external standard or regulation the framework is based on.
   */
  href?: string | null;

  /**
   * Whether the framework definition is managed by Openlayer and cannot be edited.
   */
  immutable?: boolean;

  /**
   * Determines which projects the framework applies to. An empty or `null` `match`
   * array applies the framework to every project in the workspace.
   */
  projectSelector?: FrameworkRetrieveResponse.ProjectSelector | null;

  /**
   * Compliance roll-up for the framework. Present only on
   * `GET /workspaces/{workspaceId}/frameworks` when the request sets
   * `includeRuleStats=true`.
   */
  ruleStats?: FrameworkRetrieveResponse.RuleStats;
}

export namespace FrameworkRetrieveResponse {
  /**
   * The icon shown for the framework.
   */
  export interface Avatar {
    type: 'emoji' | 'imageUrl' | 'builtinImage';

    value: string;
  }

  /**
   * Determines which projects the framework applies to. An empty or `null` `match`
   * array applies the framework to every project in the workspace.
   */
  export interface ProjectSelector {
    /**
     * Match criteria, ANDed together.
     */
    match?: Array<ProjectSelector.Match> | null;
  }

  export namespace ProjectSelector {
    export interface Match {
      /**
       * The project property to match against.
       */
      property: 'taskType' | 'riskLevel' | 'riskTotalScore' | 'name' | 'ownerId' | 'modelTypes';

      /**
       * The value to match against. Pass an array to match any of several values, or
       * `null` to match projects where the property is unset. Omit it for `exists` and
       * `notExists`.
       */
      value: unknown;

      /**
       * How to compare the project property with `value`. One of `equals`, `notEquals`,
       * `contains`, `notContains`, `startsWith`, `endsWith`, `in`, `notIn`,
       * `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`,
       * `equalsIgnoreCase`, `containsIgnoreCase`, `matches`, `exists`, or `notExists`.
       */
      operator?: string;
    }
  }

  /**
   * Compliance roll-up for the framework. Present only on
   * `GET /workspaces/{workspaceId}/frameworks` when the request sets
   * `includeRuleStats=true`.
   */
  export interface RuleStats {
    /**
     * How many of the framework's projects fall into each completion band, where a
     * project's completion is the share of its rule results that are passing or
     * skipped. Projects with no evaluated results count as `low`.
     *
     * Zeroed when the request carries `projectId`: the bands compare a framework's
     * projects against each other, which says nothing about a single project.
     */
    projectCompletion: RuleStats.ProjectCompletion;

    /**
     * Rule result counts by status for this framework, matching what
     * `/workspaces/{workspaceId}/rule-stats?frameworkId=<id>` reports. Narrowed to a
     * single project when the request also carries `projectId`.
     */
    ruleResults: RuleStats.RuleResults;
  }

  export namespace RuleStats {
    /**
     * How many of the framework's projects fall into each completion band, where a
     * project's completion is the share of its rule results that are passing or
     * skipped. Projects with no evaluated results count as `low`.
     *
     * Zeroed when the request carries `projectId`: the bands compare a framework's
     * projects against each other, which says nothing about a single project.
     */
    export interface ProjectCompletion {
      /**
       * Projects at 80% completion or above.
       */
      high: number;

      /**
       * Projects below 20% completion.
       */
      low: number;

      /**
       * Projects at or above 20% but below 80% completion.
       */
      mid: number;
    }

    /**
     * Rule result counts by status for this framework, matching what
     * `/workspaces/{workspaceId}/rule-stats?frameworkId=<id>` reports. Narrowed to a
     * single project when the request also carries `projectId`.
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
    }
  }
}

export interface FrameworkUpdateResponse {
  /**
   * The framework id.
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
   * Whether the framework is active. Rules of a disabled framework are not evaluated
   * and do not count towards compliance.
   */
  enabled: boolean;

  /**
   * The framework name.
   */
  name: string;

  /**
   * Free-form labels on the framework.
   */
  tags: Array<string>;

  /**
   * The id of the workspace the framework belongs to.
   */
  workspaceId: string;

  /**
   * The icon shown for the framework.
   */
  avatar?: FrameworkUpdateResponse.Avatar | null;

  /**
   * Identifies a framework that ships with Openlayer, for example `eu_ai_act`,
   * `iso_42001`, `nist_ai_rmf`, or `traiga`. `null` for frameworks you create
   * yourself.
   */
  builtInSlug?: string | null;

  /**
   * The user who created the framework. `null` for built-in frameworks.
   */
  creatorId?: string | null;

  /**
   * A short description of the framework.
   */
  description?: string | null;

  /**
   * A longer, rich-text description, as a TipTap JSON document.
   */
  extendedDescription?: { [key: string]: unknown } | null;

  /**
   * A link to the external standard or regulation the framework is based on.
   */
  href?: string | null;

  /**
   * Whether the framework definition is managed by Openlayer and cannot be edited.
   */
  immutable?: boolean;

  /**
   * Determines which projects the framework applies to. An empty or `null` `match`
   * array applies the framework to every project in the workspace.
   */
  projectSelector?: FrameworkUpdateResponse.ProjectSelector | null;

  /**
   * Compliance roll-up for the framework. Present only on
   * `GET /workspaces/{workspaceId}/frameworks` when the request sets
   * `includeRuleStats=true`.
   */
  ruleStats?: FrameworkUpdateResponse.RuleStats;
}

export namespace FrameworkUpdateResponse {
  /**
   * The icon shown for the framework.
   */
  export interface Avatar {
    type: 'emoji' | 'imageUrl' | 'builtinImage';

    value: string;
  }

  /**
   * Determines which projects the framework applies to. An empty or `null` `match`
   * array applies the framework to every project in the workspace.
   */
  export interface ProjectSelector {
    /**
     * Match criteria, ANDed together.
     */
    match?: Array<ProjectSelector.Match> | null;
  }

  export namespace ProjectSelector {
    export interface Match {
      /**
       * The project property to match against.
       */
      property: 'taskType' | 'riskLevel' | 'riskTotalScore' | 'name' | 'ownerId' | 'modelTypes';

      /**
       * The value to match against. Pass an array to match any of several values, or
       * `null` to match projects where the property is unset. Omit it for `exists` and
       * `notExists`.
       */
      value: unknown;

      /**
       * How to compare the project property with `value`. One of `equals`, `notEquals`,
       * `contains`, `notContains`, `startsWith`, `endsWith`, `in`, `notIn`,
       * `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`,
       * `equalsIgnoreCase`, `containsIgnoreCase`, `matches`, `exists`, or `notExists`.
       */
      operator?: string;
    }
  }

  /**
   * Compliance roll-up for the framework. Present only on
   * `GET /workspaces/{workspaceId}/frameworks` when the request sets
   * `includeRuleStats=true`.
   */
  export interface RuleStats {
    /**
     * How many of the framework's projects fall into each completion band, where a
     * project's completion is the share of its rule results that are passing or
     * skipped. Projects with no evaluated results count as `low`.
     *
     * Zeroed when the request carries `projectId`: the bands compare a framework's
     * projects against each other, which says nothing about a single project.
     */
    projectCompletion: RuleStats.ProjectCompletion;

    /**
     * Rule result counts by status for this framework, matching what
     * `/workspaces/{workspaceId}/rule-stats?frameworkId=<id>` reports. Narrowed to a
     * single project when the request also carries `projectId`.
     */
    ruleResults: RuleStats.RuleResults;
  }

  export namespace RuleStats {
    /**
     * How many of the framework's projects fall into each completion band, where a
     * project's completion is the share of its rule results that are passing or
     * skipped. Projects with no evaluated results count as `low`.
     *
     * Zeroed when the request carries `projectId`: the bands compare a framework's
     * projects against each other, which says nothing about a single project.
     */
    export interface ProjectCompletion {
      /**
       * Projects at 80% completion or above.
       */
      high: number;

      /**
       * Projects below 20% completion.
       */
      low: number;

      /**
       * Projects at or above 20% but below 80% completion.
       */
      mid: number;
    }

    /**
     * Rule result counts by status for this framework, matching what
     * `/workspaces/{workspaceId}/rule-stats?frameworkId=<id>` reports. Narrowed to a
     * single project when the request also carries `projectId`.
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
    }
  }
}

export interface FrameworkListResponse {
  items: Array<FrameworkListResponse.Item>;
}

export namespace FrameworkListResponse {
  export interface Item {
    /**
     * The framework id.
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
     * Whether the framework is active. Rules of a disabled framework are not evaluated
     * and do not count towards compliance.
     */
    enabled: boolean;

    /**
     * The framework name.
     */
    name: string;

    /**
     * Free-form labels on the framework.
     */
    tags: Array<string>;

    /**
     * The id of the workspace the framework belongs to.
     */
    workspaceId: string;

    /**
     * The icon shown for the framework.
     */
    avatar?: Item.Avatar | null;

    /**
     * Identifies a framework that ships with Openlayer, for example `eu_ai_act`,
     * `iso_42001`, `nist_ai_rmf`, or `traiga`. `null` for frameworks you create
     * yourself.
     */
    builtInSlug?: string | null;

    /**
     * The user who created the framework. `null` for built-in frameworks.
     */
    creatorId?: string | null;

    /**
     * A short description of the framework.
     */
    description?: string | null;

    /**
     * A longer, rich-text description, as a TipTap JSON document.
     */
    extendedDescription?: { [key: string]: unknown } | null;

    /**
     * A link to the external standard or regulation the framework is based on.
     */
    href?: string | null;

    /**
     * Whether the framework definition is managed by Openlayer and cannot be edited.
     */
    immutable?: boolean;

    /**
     * Determines which projects the framework applies to. An empty or `null` `match`
     * array applies the framework to every project in the workspace.
     */
    projectSelector?: Item.ProjectSelector | null;

    /**
     * Compliance roll-up for the framework. Present only on
     * `GET /workspaces/{workspaceId}/frameworks` when the request sets
     * `includeRuleStats=true`.
     */
    ruleStats?: Item.RuleStats;
  }

  export namespace Item {
    /**
     * The icon shown for the framework.
     */
    export interface Avatar {
      type: 'emoji' | 'imageUrl' | 'builtinImage';

      value: string;
    }

    /**
     * Determines which projects the framework applies to. An empty or `null` `match`
     * array applies the framework to every project in the workspace.
     */
    export interface ProjectSelector {
      /**
       * Match criteria, ANDed together.
       */
      match?: Array<ProjectSelector.Match> | null;
    }

    export namespace ProjectSelector {
      export interface Match {
        /**
         * The project property to match against.
         */
        property: 'taskType' | 'riskLevel' | 'riskTotalScore' | 'name' | 'ownerId' | 'modelTypes';

        /**
         * The value to match against. Pass an array to match any of several values, or
         * `null` to match projects where the property is unset. Omit it for `exists` and
         * `notExists`.
         */
        value: unknown;

        /**
         * How to compare the project property with `value`. One of `equals`, `notEquals`,
         * `contains`, `notContains`, `startsWith`, `endsWith`, `in`, `notIn`,
         * `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`,
         * `equalsIgnoreCase`, `containsIgnoreCase`, `matches`, `exists`, or `notExists`.
         */
        operator?: string;
      }
    }

    /**
     * Compliance roll-up for the framework. Present only on
     * `GET /workspaces/{workspaceId}/frameworks` when the request sets
     * `includeRuleStats=true`.
     */
    export interface RuleStats {
      /**
       * How many of the framework's projects fall into each completion band, where a
       * project's completion is the share of its rule results that are passing or
       * skipped. Projects with no evaluated results count as `low`.
       *
       * Zeroed when the request carries `projectId`: the bands compare a framework's
       * projects against each other, which says nothing about a single project.
       */
      projectCompletion: RuleStats.ProjectCompletion;

      /**
       * Rule result counts by status for this framework, matching what
       * `/workspaces/{workspaceId}/rule-stats?frameworkId=<id>` reports. Narrowed to a
       * single project when the request also carries `projectId`.
       */
      ruleResults: RuleStats.RuleResults;
    }

    export namespace RuleStats {
      /**
       * How many of the framework's projects fall into each completion band, where a
       * project's completion is the share of its rule results that are passing or
       * skipped. Projects with no evaluated results count as `low`.
       *
       * Zeroed when the request carries `projectId`: the bands compare a framework's
       * projects against each other, which says nothing about a single project.
       */
      export interface ProjectCompletion {
        /**
         * Projects at 80% completion or above.
         */
        high: number;

        /**
         * Projects below 20% completion.
         */
        low: number;

        /**
         * Projects at or above 20% but below 80% completion.
         */
        mid: number;
      }

      /**
       * Rule result counts by status for this framework, matching what
       * `/workspaces/{workspaceId}/rule-stats?frameworkId=<id>` reports. Narrowed to a
       * single project when the request also carries `projectId`.
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
      }
    }
  }
}

export interface FrameworkExportResponse {
  /**
   * The background task id, for `GET /background-tasks/{taskId}`.
   */
  taskResultId: string;

  /**
   * The path to poll for this export's status and result. Already `/v1`-prefixed, so
   * it is relative to the API host rather than to the `/v1` base url -- or just pass
   * `taskResultId` to `GET /background-tasks/{taskId}`.
   */
  taskResultUrl: string;
}

export interface FrameworkListProjectRuleStatsResponse {
  items: Array<FrameworkListProjectRuleStatsResponse.Item>;
}

export namespace FrameworkListProjectRuleStatsResponse {
  export interface Item {
    /**
     * The project id.
     */
    projectId: string;

    /**
     * The project name.
     */
    projectName: string;

    /**
     * The project's task type.
     */
    taskType: string;

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

    /**
     * The same counts, broken down by the type of the rule each result belongs to.
     */
    byRuleType?: Item.ByRuleType;
  }

  export namespace Item {
    /**
     * The same counts, broken down by the type of the rule each result belongs to.
     */
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
}

export interface FrameworkListProjectsResponse {
  items: Array<FrameworkListProjectsResponse.Item>;
}

export namespace FrameworkListProjectsResponse {
  export interface Item {
    /**
     * The project id.
     */
    id: string;

    /**
     * The project creator id.
     */
    creatorId: string | null;

    /**
     * The project creation date.
     */
    dateCreated: string;

    /**
     * The project last updated date.
     */
    dateUpdated: string;

    /**
     * The number of tests in the development mode of the project.
     */
    developmentGoalCount: number;

    /**
     * The total number of tests in the project.
     */
    goalCount: number;

    /**
     * The number of inference pipelines in the project.
     */
    inferencePipelineCount: number;

    /**
     * Links to the project.
     */
    links: Item.Links;

    /**
     * The number of tests in the monitoring mode of the project.
     */
    monitoringGoalCount: number;

    /**
     * The project name.
     */
    name: string;

    /**
     * The source of the project.
     */
    source: 'web' | 'api' | null;

    /**
     * The task type of the project.
     */
    taskType: 'llm-base' | 'tabular-classification' | 'tabular-regression' | 'text-classification';

    /**
     * The number of versions (commits) in the project.
     */
    versionCount: number;

    /**
     * The workspace id.
     */
    workspaceId: string | null;

    /**
     * Number of days to retain monitoring data for this project. Null means data is
     * retained indefinitely.
     */
    dataRetentionDays?: number | null;

    /**
     * The project description.
     */
    description?: string | null;

    gitRepo?: Item.GitRepo | null;

    /**
     * Who developed the model used in this project.
     */
    modelDeveloper?: string | null;

    /**
     * The kinds of model used in this project.
     */
    modelTypes?: Array<string> | null;

    /**
     * What the system in this project is intended to do.
     */
    purpose?: string | null;
  }

  export namespace Item {
    /**
     * Links to the project.
     */
    export interface Links {
      app: string;
    }

    export interface GitRepo {
      id: string;

      dateConnected: string;

      dateUpdated: string;

      gitAccountId: string;

      gitId: number;

      name: string;

      private: boolean;

      projectId: string;

      slug: string;

      url: string;

      branch?: string;

      rootDir?: string;
    }
  }
}

export interface FrameworkListRulesResponse {
  items: Array<FrameworkListRulesResponse.Item>;
}

export namespace FrameworkListRulesResponse {
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

export interface FrameworkCreateParams {
  /**
   * The framework name.
   */
  name: string;

  /**
   * A short description of the framework.
   */
  description?: string | null;

  /**
   * Whether the framework is active. Rules of a disabled framework are not evaluated
   * and do not count towards compliance.
   */
  enabled?: boolean;

  /**
   * Determines which projects the framework applies to. An empty or `null` `match`
   * array applies the framework to every project in the workspace.
   */
  projectSelector?: FrameworkCreateParams.ProjectSelector | null;

  /**
   * Free-form labels on the framework.
   */
  tags?: Array<string>;
}

export namespace FrameworkCreateParams {
  /**
   * Determines which projects the framework applies to. An empty or `null` `match`
   * array applies the framework to every project in the workspace.
   */
  export interface ProjectSelector {
    /**
     * Match criteria, ANDed together.
     */
    match?: Array<ProjectSelector.Match> | null;
  }

  export namespace ProjectSelector {
    export interface Match {
      /**
       * The project property to match against.
       */
      property: 'taskType' | 'riskLevel' | 'riskTotalScore' | 'name' | 'ownerId' | 'modelTypes';

      /**
       * The value to match against. Pass an array to match any of several values, or
       * `null` to match projects where the property is unset. Omit it for `exists` and
       * `notExists`.
       */
      value: unknown;

      /**
       * How to compare the project property with `value`. One of `equals`, `notEquals`,
       * `contains`, `notContains`, `startsWith`, `endsWith`, `in`, `notIn`,
       * `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`,
       * `equalsIgnoreCase`, `containsIgnoreCase`, `matches`, `exists`, or `notExists`.
       */
      operator?: string;
    }
  }
}

export interface FrameworkUpdateParams {
  /**
   * The icon shown for the framework.
   */
  avatar?: FrameworkUpdateParams.Avatar | null;

  /**
   * A short description of the framework.
   */
  description?: string | null;

  /**
   * Whether the framework is active. Rules of a disabled framework are not evaluated
   * and do not count towards compliance.
   */
  enabled?: boolean;

  /**
   * A longer, rich-text description, as a TipTap JSON document.
   */
  extendedDescription?: { [key: string]: unknown } | null;

  /**
   * A link to the external standard or regulation the framework is based on.
   */
  href?: string | null;

  /**
   * The framework name.
   */
  name?: string;

  /**
   * Determines which projects the framework applies to. An empty or `null` `match`
   * array applies the framework to every project in the workspace.
   */
  projectSelector?: FrameworkUpdateParams.ProjectSelector | null;

  /**
   * Free-form labels on the framework.
   */
  tags?: Array<string>;
}

export namespace FrameworkUpdateParams {
  /**
   * The icon shown for the framework.
   */
  export interface Avatar {
    type: 'emoji' | 'imageUrl' | 'builtinImage';

    value: string;
  }

  /**
   * Determines which projects the framework applies to. An empty or `null` `match`
   * array applies the framework to every project in the workspace.
   */
  export interface ProjectSelector {
    /**
     * Match criteria, ANDed together.
     */
    match?: Array<ProjectSelector.Match> | null;
  }

  export namespace ProjectSelector {
    export interface Match {
      /**
       * The project property to match against.
       */
      property: 'taskType' | 'riskLevel' | 'riskTotalScore' | 'name' | 'ownerId' | 'modelTypes';

      /**
       * The value to match against. Pass an array to match any of several values, or
       * `null` to match projects where the property is unset. Omit it for `exists` and
       * `notExists`.
       */
      value: unknown;

      /**
       * How to compare the project property with `value`. One of `equals`, `notEquals`,
       * `contains`, `notContains`, `startsWith`, `endsWith`, `in`, `notIn`,
       * `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`,
       * `equalsIgnoreCase`, `containsIgnoreCase`, `matches`, `exists`, or `notExists`.
       */
      operator?: string;
    }
  }
}

export interface FrameworkListParams {
  /**
   * Whether to sort in ascending order.
   */
  asc?: boolean;

  /**
   * How to compare each framework's completion percentage with `completionValue`.
   * Must be sent together with `completionValue`.
   */
  completionOperator?: 'is' | '>' | '>=' | '<' | '<=' | '!=';

  /**
   * The completion percentage to compare against, from 0 to 100.
   */
  completionValue?: number;

  /**
   * Only include frameworks that are enabled (or disabled).
   */
  enabled?: boolean;

  /**
   * Whether to include a `ruleStats` object on each framework, with its rule result
   * status counts and its per-project completion buckets. Computed over the returned
   * page only.
   */
  includeRuleStats?: boolean;

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
   * Filter by a free-text search over names and descriptions.
   */
  searchQuery?: string;

  /**
   * The column to sort on.
   */
  sortColumn?:
    | 'name'
    | 'enabled'
    | 'dateCreated'
    | 'dateUpdated'
    | 'overallCompletion'
    | 'projectCompletionBuckets';

  /**
   * Only include frameworks carrying all of these tags.
   */
  tags?: Array<string>;
}

export interface FrameworkExportParams {
  /**
   * Scope the export to this project. It must belong to the framework.
   */
  projectId?: string | null;
}

export interface FrameworkListProjectRuleStatsParams {
  /**
   * Whether to sort in ascending order.
   */
  asc?: boolean;

  /**
   * The page to return in a paginated query.
   */
  page?: number;

  /**
   * Maximum number of items to return per page.
   */
  perPage?: number;

  /**
   * The column to sort on.
   */
  sortColumn?:
    | 'projectName'
    | 'total'
    | 'overallCompletion'
    | 'totalPassing'
    | 'totalFailing'
    | 'totalSkipped'
    | 'totalRunning'
    | 'totalError'
    | 'totalPending'
    | 'totalDueSoon';
}

export interface FrameworkListProjectsParams {
  /**
   * The page to return in a paginated query.
   */
  page?: number;

  /**
   * Maximum number of items to return per page.
   */
  perPage?: number;
}

export interface FrameworkListRulesParams {
  /**
   * The page to return in a paginated query.
   */
  page?: number;

  /**
   * Maximum number of items to return per page.
   */
  perPage?: number;
}

Frameworks.Documents = Documents;
Frameworks.Sections = Sections;
Frameworks.Subsections = Subsections;

export declare namespace Frameworks {
  export {
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
    Documents as Documents,
    type DocumentRetrieveResponse as DocumentRetrieveResponse,
    type DocumentListResponse as DocumentListResponse,
    type DocumentRetrieveParams as DocumentRetrieveParams,
    type DocumentListParams as DocumentListParams,
  };

  export {
    Sections as Sections,
    type SectionListRulesResponse as SectionListRulesResponse,
    type SectionListRulesParams as SectionListRulesParams,
  };

  export {
    Subsections as Subsections,
    type SubsectionListRulesResponse as SubsectionListRulesResponse,
    type SubsectionListRulesParams as SubsectionListRulesParams,
  };
}
