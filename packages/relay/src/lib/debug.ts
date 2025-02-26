// SPDX-License-Identifier: Apache-2.0

import { Debug } from '../index';

/**
 * Implementation of the Debug interface.
 * All debug_* methods are not yet implemented and will return NOT_YET_IMPLEMENTED error.
 * This class is intentionally empty as all debug_* methods are handled by the regex pattern
 * in the server, which returns NOT_YET_IMPLEMENTED.
 */
export class DebugImpl implements Debug {
  /**
   * Constructor for DebugImpl.
   * No initialization needed as there are no supported methods.
   */
  constructor() {
    // No initialization needed
  }
}
