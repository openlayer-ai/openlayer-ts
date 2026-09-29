// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class APIKeys extends APIResource {
  /**
   * Create a new API key in a workspace. The full secret is returned in `secret`,
   * only in this response. Optionally set `expiresAt`. When you authenticate with an
   * API key that expires, the new key can't outlive it: omit `expiresAt` to inherit
   * that expiry, and a later expiry (or `null`) is rejected with 400.
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

  /**
   * Retrieve one of your API keys, with its lifecycle status. The secret is never
   * returned; `secureKey` is an obfuscated hint.
   *
   * @example
   * ```ts
   * const apiKey = await client.workspaces.apiKeys.retrieve(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { workspaceId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' },
   * );
   * ```
   */
  retrieve(
    apiKeyID: string,
    params: APIKeyRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<APIKeyRetrieveResponse> {
    const { workspaceId } = params;
    return this._client.get(path`/workspaces/${workspaceId}/api-keys/${apiKeyID}`, options);
  }

  /**
   * Rename one of your API keys. A key's expiry can't be updated; rotate the key
   * with a new `expiresAt` instead, so extending a key's life always issues a new
   * secret.
   *
   * @example
   * ```ts
   * const apiKey = await client.workspaces.apiKeys.update(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { workspaceId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' },
   * );
   * ```
   */
  update(
    apiKeyID: string,
    params: APIKeyUpdateParams,
    options?: RequestOptions,
  ): APIPromise<APIKeyUpdateResponse> {
    const { workspaceId, ...body } = params;
    return this._client.put(path`/workspaces/${workspaceId}/api-keys/${apiKeyID}`, { body, ...options });
  }

  /**
   * List the API keys you own in a workspace, with their lifecycle status. Secrets
   * are never returned; `secureKey` is an obfuscated hint.
   *
   * @example
   * ```ts
   * const apiKeys = await client.workspaces.apiKeys.list(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   * );
   * ```
   */
  list(workspaceID: string, options?: RequestOptions): APIPromise<APIKeyListResponse> {
    return this._client.get(path`/workspaces/${workspaceID}/api-keys`, options);
  }

  /**
   * Delete one of your API keys. Every secret for the key stops working immediately,
   * including a previous secret still in its rotation grace period.
   *
   * @example
   * ```ts
   * await client.workspaces.apiKeys.delete(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { workspaceId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' },
   * );
   * ```
   */
  delete(apiKeyID: string, params: APIKeyDeleteParams, options?: RequestOptions): APIPromise<void> {
    const { workspaceId } = params;
    return this._client.delete(path`/workspaces/${workspaceId}/api-keys/${apiKeyID}`, {
      ...options,
      headers: buildHeaders([{ Accept: '*/*' }, options?.headers]),
    });
  }

  /**
   * Replace an API key's secret now. The new secret is returned in `secret`, only in
   * this response. Send `expiresAt` to change the key's expiry (`null` for never);
   * omit it to keep the current one. The previous secret keeps authenticating for
   * `gracePeriodHours` (default 0, so it stops working immediately), and never past
   * `expiresAt`. The key keeps its id and name. Expired keys cannot be rotated. Only
   * one previous secret is kept, so rotating again during a grace period retires the
   * older one immediately.
   *
   * @example
   * ```ts
   * const response = await client.workspaces.apiKeys.rotate(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { workspaceId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' },
   * );
   * ```
   */
  rotate(
    apiKeyID: string,
    params: APIKeyRotateParams,
    options?: RequestOptions,
  ): APIPromise<APIKeyRotateResponse> {
    const { workspaceId, ...body } = params;
    return this._client.post(path`/workspaces/${workspaceId}/api-keys/${apiKeyID}/rotate`, {
      body,
      ...options,
    });
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
   * An obfuscated hint of the API key value. When a key is created or rotated this
   * also holds the full secret, for backward compatibility; prefer `secret`.
   */
  secureKey: string;

  /**
   * The key's lifecycle state. `active`: the current secret authenticates.
   * `rotating`: the key was rotated and the previous secret still authenticates
   * until `previousKeyExpiresAt`. `expired`: `expiresAt` has passed and no secret
   * authenticates.
   */
  status: 'active' | 'rotating' | 'expired';

  /**
   * When the key stops authenticating. `null` means the key never expires. Set when
   * the key is created or rotated, and must be in the future. When the request is
   * authenticated with an API key that expires, the result can't be later than that
   * key's expiry.
   */
  expiresAt?: string | null;

  /**
   * When the key was last rotated.
   */
  lastRotatedAt?: string | null;

  /**
   * The API key name.
   */
  name?: string | null;

  /**
   * While `status` is `rotating`, when the previous secret stops authenticating.
   */
  previousKeyExpiresAt?: string | null;

  /**
   * The full API key. Only present in the response that creates or rotates the key,
   * and never shown again.
   */
  secret?: string;
}

export interface APIKeyRetrieveResponse {
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
   * An obfuscated hint of the API key value. When a key is created or rotated this
   * also holds the full secret, for backward compatibility; prefer `secret`.
   */
  secureKey: string;

  /**
   * The key's lifecycle state. `active`: the current secret authenticates.
   * `rotating`: the key was rotated and the previous secret still authenticates
   * until `previousKeyExpiresAt`. `expired`: `expiresAt` has passed and no secret
   * authenticates.
   */
  status: 'active' | 'rotating' | 'expired';

  /**
   * When the key stops authenticating. `null` means the key never expires. Set when
   * the key is created or rotated, and must be in the future. When the request is
   * authenticated with an API key that expires, the result can't be later than that
   * key's expiry.
   */
  expiresAt?: string | null;

  /**
   * When the key was last rotated.
   */
  lastRotatedAt?: string | null;

  /**
   * The API key name.
   */
  name?: string | null;

  /**
   * While `status` is `rotating`, when the previous secret stops authenticating.
   */
  previousKeyExpiresAt?: string | null;

  /**
   * The full API key. Only present in the response that creates or rotates the key,
   * and never shown again.
   */
  secret?: string;
}

export interface APIKeyUpdateResponse {
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
   * An obfuscated hint of the API key value. When a key is created or rotated this
   * also holds the full secret, for backward compatibility; prefer `secret`.
   */
  secureKey: string;

  /**
   * The key's lifecycle state. `active`: the current secret authenticates.
   * `rotating`: the key was rotated and the previous secret still authenticates
   * until `previousKeyExpiresAt`. `expired`: `expiresAt` has passed and no secret
   * authenticates.
   */
  status: 'active' | 'rotating' | 'expired';

  /**
   * When the key stops authenticating. `null` means the key never expires. Set when
   * the key is created or rotated, and must be in the future. When the request is
   * authenticated with an API key that expires, the result can't be later than that
   * key's expiry.
   */
  expiresAt?: string | null;

  /**
   * When the key was last rotated.
   */
  lastRotatedAt?: string | null;

  /**
   * The API key name.
   */
  name?: string | null;

  /**
   * While `status` is `rotating`, when the previous secret stops authenticating.
   */
  previousKeyExpiresAt?: string | null;

  /**
   * The full API key. Only present in the response that creates or rotates the key,
   * and never shown again.
   */
  secret?: string;
}

export type APIKeyListResponse = Array<APIKeyListResponse.APIKeyListResponseItem>;

export namespace APIKeyListResponse {
  export interface APIKeyListResponseItem {
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
     * An obfuscated hint of the API key value. When a key is created or rotated this
     * also holds the full secret, for backward compatibility; prefer `secret`.
     */
    secureKey: string;

    /**
     * The key's lifecycle state. `active`: the current secret authenticates.
     * `rotating`: the key was rotated and the previous secret still authenticates
     * until `previousKeyExpiresAt`. `expired`: `expiresAt` has passed and no secret
     * authenticates.
     */
    status: 'active' | 'rotating' | 'expired';

    /**
     * When the key stops authenticating. `null` means the key never expires. Set when
     * the key is created or rotated, and must be in the future. When the request is
     * authenticated with an API key that expires, the result can't be later than that
     * key's expiry.
     */
    expiresAt?: string | null;

    /**
     * When the key was last rotated.
     */
    lastRotatedAt?: string | null;

    /**
     * The API key name.
     */
    name?: string | null;

    /**
     * While `status` is `rotating`, when the previous secret stops authenticating.
     */
    previousKeyExpiresAt?: string | null;

    /**
     * The full API key. Only present in the response that creates or rotates the key,
     * and never shown again.
     */
    secret?: string;
  }
}

export interface APIKeyRotateResponse {
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
   * An obfuscated hint of the API key value. When a key is created or rotated this
   * also holds the full secret, for backward compatibility; prefer `secret`.
   */
  secureKey: string;

  /**
   * The key's lifecycle state. `active`: the current secret authenticates.
   * `rotating`: the key was rotated and the previous secret still authenticates
   * until `previousKeyExpiresAt`. `expired`: `expiresAt` has passed and no secret
   * authenticates.
   */
  status: 'active' | 'rotating' | 'expired';

  /**
   * When the key stops authenticating. `null` means the key never expires. Set when
   * the key is created or rotated, and must be in the future. When the request is
   * authenticated with an API key that expires, the result can't be later than that
   * key's expiry.
   */
  expiresAt?: string | null;

  /**
   * When the key was last rotated.
   */
  lastRotatedAt?: string | null;

  /**
   * The API key name.
   */
  name?: string | null;

  /**
   * While `status` is `rotating`, when the previous secret stops authenticating.
   */
  previousKeyExpiresAt?: string | null;

  /**
   * The full API key. Only present in the response that creates or rotates the key,
   * and never shown again.
   */
  secret?: string;
}

export interface APIKeyCreateParams {
  /**
   * When the key stops authenticating. `null` means the key never expires. Set when
   * the key is created or rotated, and must be in the future. When the request is
   * authenticated with an API key that expires, the result can't be later than that
   * key's expiry.
   */
  expiresAt?: string | null;

  /**
   * The API key name.
   */
  name?: string | null;
}

export interface APIKeyRetrieveParams {
  /**
   * The workspace id.
   */
  workspaceId: string;
}

export interface APIKeyUpdateParams {
  /**
   * Path param: The workspace id.
   */
  workspaceId: string;

  /**
   * Body param: The API key name.
   */
  name?: string | null;
}

export interface APIKeyDeleteParams {
  /**
   * The workspace id.
   */
  workspaceId: string;
}

export interface APIKeyRotateParams {
  /**
   * Path param: The workspace id.
   */
  workspaceId: string;

  /**
   * Body param: When the key stops authenticating. `null` means the key never
   * expires. Set when the key is created or rotated, and must be in the future. When
   * the request is authenticated with an API key that expires, the result can't be
   * later than that key's expiry.
   */
  expiresAt?: string | null;

  /**
   * Body param: Hours the previous secret keeps authenticating.
   */
  gracePeriodHours?: number;
}

export declare namespace APIKeys {
  export {
    type APIKeyCreateResponse as APIKeyCreateResponse,
    type APIKeyRetrieveResponse as APIKeyRetrieveResponse,
    type APIKeyUpdateResponse as APIKeyUpdateResponse,
    type APIKeyListResponse as APIKeyListResponse,
    type APIKeyRotateResponse as APIKeyRotateResponse,
    type APIKeyCreateParams as APIKeyCreateParams,
    type APIKeyRetrieveParams as APIKeyRetrieveParams,
    type APIKeyUpdateParams as APIKeyUpdateParams,
    type APIKeyDeleteParams as APIKeyDeleteParams,
    type APIKeyRotateParams as APIKeyRotateParams,
  };
}
