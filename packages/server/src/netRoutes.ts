// SPDX-License-Identifier: Apache-2.0

const defineNetRoutes = function (app, relay, logAndHandleResponse) {
  /**
   * Returns true if client is actively listening for network connections.
   *
   * @returns false
   */
  app.useRpc('net_listening', async () => {
    return logAndHandleResponse('net_listening', [], () => '' + relay.net().listening());
  });

  /**
   *  Returns the current network id.
   *
   *  @returns id
   */
  app.useRpc('net_version', async () => {
    return logAndHandleResponse('net_version', [], () => relay.net().version());
  });
};

export { defineNetRoutes };
