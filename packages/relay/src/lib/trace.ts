// SPDX-License-Identifier: Apache-2.0

import { Trace } from '../index';

/**
 * Implementation of the Trace interface.
 * All trace_* methods are not yet implemented and will return NOT_YET_IMPLEMENTED error.
 * This class is intentionally empty as all trace_* methods are handled by the regex pattern
 * in the server, which returns NOT_YET_IMPLEMENTED.
 */
export class TraceImpl implements Trace {
  /**
   * Constructor for TraceImpl.
   * No initialization needed as there are no supported methods.
   */
  constructor() {
    // No initialization needed
  }
}
