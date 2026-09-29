// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';

export class PresignedURL extends APIResource {
  /**
   * Get a presigned url to upload a file.
   */
  create(params: PresignedURLCreateParams, options?: RequestOptions): APIPromise<PresignedURLCreateResponse> {
    const { objectName } = params;
    return this._client.post('/storage/presigned-url', { query: { objectName }, ...options });
  }

  /**
   * Get a short-lived download url for a stored object.
   */
  retrieve(
    query: PresignedURLRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<PresignedURLRetrieveResponse> {
    return this._client.get('/storage/presigned-url', { query, ...options });
  }
}

export interface PresignedURLCreateResponse {
  /**
   * The storage URI to send back to the backend after the upload was completed.
   */
  storageUri: string;

  /**
   * The presigned url.
   */
  url: string;

  /**
   * Fields to include in the body of the upload. Only needed by s3
   */
  fields?: unknown;
}

export interface PresignedURLRetrieveResponse {
  /**
   * The presigned url. Short-lived -- download promptly.
   */
  url: string;
}

export interface PresignedURLCreateParams {
  /**
   * The name of the object.
   */
  objectName: string;
}

export interface PresignedURLRetrieveParams {
  /**
   * The object's storage uri, for example `outputs.storageUri` from a framework
   * export's background task.
   */
  storageUri: string;
}

export declare namespace PresignedURL {
  export {
    type PresignedURLCreateResponse as PresignedURLCreateResponse,
    type PresignedURLRetrieveResponse as PresignedURLRetrieveResponse,
    type PresignedURLCreateParams as PresignedURLCreateParams,
    type PresignedURLRetrieveParams as PresignedURLRetrieveParams,
  };
}
