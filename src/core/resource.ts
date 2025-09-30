// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import type { Openlayer } from '../client';

export abstract class APIResource {
  protected _client: Openlayer;

  constructor(client: Openlayer) {
    this._client = client;
  }
}
