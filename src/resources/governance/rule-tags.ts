// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class RuleTags extends APIResource {
  /**
   * List the rule tags in a workspace.
   *
   * Tags group rules across frameworks, for example by team or by control family.
   * Use the ids returned here with the `tags` filter on
   * [List rules](/api-reference/rest/governance/list-rules).
   *
   * @example
   * ```ts
   * const ruleTags = await client.governance.ruleTags.list(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  list(
    workspaceID: string,
    query: RuleTagListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<RuleTagListResponse> {
    return this._client.get(path`/workspaces/${workspaceID}/rule-tags`, { query, ...options });
  }
}

export interface RuleTagListResponse {
  items: Array<RuleTagListResponse.Item>;
}

export namespace RuleTagListResponse {
  export interface Item {
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

export interface RuleTagListParams {
  /**
   * The page to return in a paginated query.
   */
  page?: number;

  /**
   * Maximum number of items to return per page.
   */
  perPage?: number;
}

export declare namespace RuleTags {
  export { type RuleTagListResponse as RuleTagListResponse, type RuleTagListParams as RuleTagListParams };
}
