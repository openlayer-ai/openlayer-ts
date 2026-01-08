// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as APIKeysAPI from './api-keys';
import { APIKeyCreateParams, APIKeyCreateResponse, APIKeys } from './api-keys';
import * as InvitesAPI from './invites';
import {
  InviteCreateParams,
  InviteCreateResponse,
  InviteListParams,
  InviteListResponse,
  Invites,
} from './invites';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Workspaces extends APIResource {
  invites: InvitesAPI.Invites = new InvitesAPI.Invites(this._client);
  apiKeys: APIKeysAPI.APIKeys = new APIKeysAPI.APIKeys(this._client);

  /**
   * Retrieve a workspace by its ID.
   *
   * @example
   * ```ts
   * const workspace = await client.workspaces.retrieve(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  retrieve(workspaceID: string, options?: RequestOptions): APIPromise<WorkspaceRetrieveResponse> {
    return this._client.get(path`/workspaces/${workspaceID}`, options);
  }

  /**
   * Update a workspace.
   *
   * @example
   * ```ts
   * const workspace = await client.workspaces.update(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  update(
    workspaceID: string,
    body: WorkspaceUpdateParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<WorkspaceUpdateResponse> {
    return this._client.put(path`/workspaces/${workspaceID}`, { body, ...options });
  }
}

export interface WorkspaceRetrieveResponse {
  /**
   * The workspace id.
   */
  id: string;

  /**
   * The workspace creator id.
   */
  creatorId: string | null;

  /**
   * The workspace creation date.
   */
  dateCreated: string;

  /**
   * The workspace last updated date.
   */
  dateUpdated: string;

  /**
   * The number of invites in the workspace.
   */
  inviteCount: number;

  /**
   * The number of members in the workspace.
   */
  memberCount: number;

  /**
   * The workspace name.
   */
  name: string;

  /**
   * The end date of the current billing period.
   */
  periodEndDate: string | null;

  /**
   * The start date of the current billing period.
   */
  periodStartDate: string | null;

  /**
   * The number of projects in the workspace.
   */
  projectCount: number;

  /**
   * The workspace slug.
   */
  slug: string;

  status:
    | 'active'
    | 'past_due'
    | 'unpaid'
    | 'canceled'
    | 'incomplete'
    | 'incomplete_expired'
    | 'trialing'
    | 'paused';

  monthlyUsage?: Array<WorkspaceRetrieveResponse.MonthlyUsage>;

  /**
   * Whether the workspace only allows SAML authentication.
   */
  samlOnlyAccess?: boolean;

  wildcardDomains?: Array<string>;
}

export namespace WorkspaceRetrieveResponse {
  export interface MonthlyUsage {
    executionTimeMs?: number | null;

    monthYear?: string;

    predictionCount?: number;
  }
}

export interface WorkspaceUpdateResponse {
  /**
   * The workspace id.
   */
  id: string;

  /**
   * The workspace creator id.
   */
  creatorId: string | null;

  /**
   * The workspace creation date.
   */
  dateCreated: string;

  /**
   * The workspace last updated date.
   */
  dateUpdated: string;

  /**
   * The number of invites in the workspace.
   */
  inviteCount: number;

  /**
   * The number of members in the workspace.
   */
  memberCount: number;

  /**
   * The workspace name.
   */
  name: string;

  /**
   * The end date of the current billing period.
   */
  periodEndDate: string | null;

  /**
   * The start date of the current billing period.
   */
  periodStartDate: string | null;

  /**
   * The number of projects in the workspace.
   */
  projectCount: number;

  /**
   * The workspace slug.
   */
  slug: string;

  status:
    | 'active'
    | 'past_due'
    | 'unpaid'
    | 'canceled'
    | 'incomplete'
    | 'incomplete_expired'
    | 'trialing'
    | 'paused';

  monthlyUsage?: Array<WorkspaceUpdateResponse.MonthlyUsage>;

  /**
   * Whether the workspace only allows SAML authentication.
   */
  samlOnlyAccess?: boolean;

  wildcardDomains?: Array<string>;
}

export namespace WorkspaceUpdateResponse {
  export interface MonthlyUsage {
    executionTimeMs?: number | null;

    monthYear?: string;

    predictionCount?: number;
  }
}

export interface WorkspaceUpdateParams {
  /**
   * The workspace invite code.
   */
  inviteCode?: string;

  /**
   * The workspace name.
   */
  name?: string;

  /**
   * The workspace slug.
   */
  slug?: string;
}

Workspaces.Invites = Invites;
Workspaces.APIKeys = APIKeys;

export declare namespace Workspaces {
  export {
    type WorkspaceRetrieveResponse as WorkspaceRetrieveResponse,
    type WorkspaceUpdateResponse as WorkspaceUpdateResponse,
    type WorkspaceUpdateParams as WorkspaceUpdateParams,
  };

  export {
    Invites as Invites,
    type InviteCreateResponse as InviteCreateResponse,
    type InviteListResponse as InviteListResponse,
    type InviteCreateParams as InviteCreateParams,
    type InviteListParams as InviteListParams,
  };

  export {
    APIKeys as APIKeys,
    type APIKeyCreateResponse as APIKeyCreateResponse,
    type APIKeyCreateParams as APIKeyCreateParams,
  };
}
