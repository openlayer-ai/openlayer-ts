// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as PresignedURLAPI from './presigned-url';

export class Storage extends APIResource {
  presignedURL: PresignedURLAPI.PresignedURL = new PresignedURLAPI.PresignedURL(this._client);
}

export namespace Storage {
  export import PresignedURL = PresignedURLAPI.PresignedURL;
  export import PresignedURLCreateResponse = PresignedURLAPI.PresignedURLCreateResponse;
  export import PresignedURLCreateParams = PresignedURLAPI.PresignedURLCreateParams;
}
