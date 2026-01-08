// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class APIKeys extends APIResource {
  /**
   * Create a new API key in a workspace.
   *
   * @example
   * ```ts
   * const apiKey = await client.workspaces.apiKeys.create(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  create(
    workspaceID: string,
    body: APIKeyCreateParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<APIKeyCreateResponse> {
    return this._client.post(path`/workspaces/${workspaceID}/api-keys`, { body, ...options });
  }
}

export interface APIKeyCreateResponse {
  /**
   * The API key id.
   */
  id: string;

  /**
   * The API key creation date.
   */
  dateCreated: string;

  /**
   * The API key last use date.
   */
  dateLastUsed: string | null;

  /**
   * The API key last update date.
   */
  dateUpdated: string;

  /**
   * The API key value.
   */
  secureKey: string;

  /**
   * The API key name.
   */
  name?: string | null;
}

export interface APIKeyCreateParams {
  /**
   * The API key name.
   */
  name?: string | null;
}

export declare namespace APIKeys {
  export { type APIKeyCreateResponse as APIKeyCreateResponse, type APIKeyCreateParams as APIKeyCreateParams };
}
