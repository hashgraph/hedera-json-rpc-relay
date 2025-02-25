// SPDX-License-Identifier: Apache-2.0

const defineWeb3Routes = function (app, relay, logAndHandleResponse) {
  /**
   * Returns the current version of the chain client.
   *
   * @returns string
   */
  app.useRpc('web3_clientVersion', async () => {
    return logAndHandleResponse('web3_clientVersion', [], () => relay.web3().clientVersion());
  });

  /**
   * Returns the current version of the chain client.
   *
   * @returns string
   */
  app.useRpc('web3_client_version', async () => {
    return logAndHandleResponse('web3_client_version', [], () => relay.web3().clientVersion());
  });

  /**
   * Returns Keccak-256 (not the standardized SHA3-256) hash of the given data.
   *
   * @returns hex
   */
  app.useRpc('web3_sha3', async (params: any) => {
    return logAndHandleResponse('web3_sha3', params, () => relay.web3().sha3(params?.[0]));
  });
};

export { defineWeb3Routes };
