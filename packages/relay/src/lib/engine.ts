// SPDX-License-Identifier: Apache-2.0

import { Engine } from '../index';

/**
 * Implementation of the Engine interface.
 * All engine_* methods are unsupported and will return UNSUPPORTED_METHOD error.
 * This class is intentionally empty as all engine_* methods are handled by the regex pattern
 * in the server, which returns UNSUPPORTED_METHOD.
 */
export class EngineImpl implements Engine {
  /**
   * Constructor for EngineImpl.
   * No initialization needed as there are no supported methods.
   */
  constructor() {
    // No initialization needed
  }
}
