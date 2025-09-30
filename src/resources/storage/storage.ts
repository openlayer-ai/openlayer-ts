// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as PresignedURLAPI from './presigned-url';
import { PresignedURL, PresignedURLCreateParams, PresignedURLCreateResponse } from './presigned-url';

export class Storage extends APIResource {
  presignedURL: PresignedURLAPI.PresignedURL = new PresignedURLAPI.PresignedURL(this._client);
}

Storage.PresignedURL = PresignedURL;

export declare namespace Storage {
  export {
    PresignedURL as PresignedURL,
    type PresignedURLCreateResponse as PresignedURLCreateResponse,
    type PresignedURLCreateParams as PresignedURLCreateParams,
  };
}
