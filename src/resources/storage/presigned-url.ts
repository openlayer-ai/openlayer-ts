// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as PresignedURLAPI from './presigned-url';

export class PresignedURL extends APIResource {
  /**
   * Retrieve a presigned url to post storage artifacts.
   */
  create(
    params: PresignedURLCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PresignedURLCreateResponse> {
    const { objectName } = params;
    return this._client.post('/storage/presigned-url', { query: { objectName }, ...options });
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

export interface PresignedURLCreateParams {
  /**
   * The name of the object.
   */
  objectName: string;
}

export namespace PresignedURL {
  export import PresignedURLCreateResponse = PresignedURLAPI.PresignedURLCreateResponse;
  export import PresignedURLCreateParams = PresignedURLAPI.PresignedURLCreateParams;
}
