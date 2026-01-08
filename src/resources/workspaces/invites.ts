// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Invites extends APIResource {
  /**
   * Invite users to a workspace.
   *
   * @example
   * ```ts
   * const invite = await client.workspaces.invites.create(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  create(
    workspaceID: string,
    body: InviteCreateParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<InviteCreateResponse> {
    return this._client.post(path`/workspaces/${workspaceID}/invites`, { body, ...options });
  }

  /**
   * Retrieve a list of invites in a workspace.
   *
   * @example
   * ```ts
   * const invites = await client.workspaces.invites.list(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  list(
    workspaceID: string,
    query: InviteListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<InviteListResponse> {
    return this._client.get(path`/workspaces/${workspaceID}/invites`, { query, ...options });
  }
}

export interface InviteCreateResponse {
  items: Array<InviteCreateResponse.Item>;
}

export namespace InviteCreateResponse {
  export interface Item {
    /**
     * The invite id.
     */
    id: string;

    creator: Item.Creator;

    /**
     * The invite creation date.
     */
    dateCreated: string;

    /**
     * The invite email.
     */
    email: string;

    /**
     * The invite role.
     */
    role: 'ADMIN' | 'MEMBER' | 'VIEWER';

    /**
     * The invite status.
     */
    status: 'accepted' | 'pending';

    workspace: Item.Workspace;
  }

  export namespace Item {
    export interface Creator {
      /**
       * The invite creator id.
       */
      id?: string;

      /**
       * The invite creator name.
       */
      name?: string | null;

      /**
       * The invite creator username.
       */
      username?: string | null;
    }

    export interface Workspace {
      id: string;

      dateCreated: string;

      memberCount: number;

      name: string;

      slug: string;
    }
  }
}

export interface InviteListResponse {
  items: Array<InviteListResponse.Item>;
}

export namespace InviteListResponse {
  export interface Item {
    /**
     * The invite id.
     */
    id: string;

    creator: Item.Creator;

    /**
     * The invite creation date.
     */
    dateCreated: string;

    /**
     * The invite email.
     */
    email: string;

    /**
     * The invite role.
     */
    role: 'ADMIN' | 'MEMBER' | 'VIEWER';

    /**
     * The invite status.
     */
    status: 'accepted' | 'pending';

    workspace: Item.Workspace;
  }

  export namespace Item {
    export interface Creator {
      /**
       * The invite creator id.
       */
      id?: string;

      /**
       * The invite creator name.
       */
      name?: string | null;

      /**
       * The invite creator username.
       */
      username?: string | null;
    }

    export interface Workspace {
      id: string;

      dateCreated: string;

      memberCount: number;

      name: string;

      slug: string;
    }
  }
}

export interface InviteCreateParams {
  emails?: Array<string>;

  /**
   * The member role.
   */
  role?: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export interface InviteListParams {
  /**
   * The page to return in a paginated query.
   */
  page?: number;

  /**
   * Maximum number of items to return per page.
   */
  perPage?: number;
}

export declare namespace Invites {
  export {
    type InviteCreateResponse as InviteCreateResponse,
    type InviteListResponse as InviteListResponse,
    type InviteCreateParams as InviteCreateParams,
    type InviteListParams as InviteListParams,
  };
}
