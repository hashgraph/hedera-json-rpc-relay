/*-
 *
 * Hedera JSON RPC Relay - Wagmi Example
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import {useAccountBalance} from "../hooks/use-balance.ts";
import {useAccount, useConnect, useDisconnect} from "wagmi";

export function Profile() {
  const {status, address} = useAccount()
  const {disconnect} = useDisconnect()
  const {balance} = useAccountBalance();
  const {connectors, connect, status: statusWalletConnect, error: walletError} = useConnect()

  const isLoading = statusWalletConnect === "pending" || status === "connecting" || status === "reconnecting";

  return (
    <div>
      {isLoading && (
        <div>
          <p>Loading...</p>
        </div>
      )}

      {
        status === "connected" && (
          <div>
            <h2>Account</h2>

            <div>
              <p>status: {status}</p>
              <p>addresses: {address ?? ""}</p>
              <p>balance: {balance}</p>
            </div>

            <button type="button" onClick={() => disconnect()}>
              Disconnect
            </button>
          </div>
        )
      }

      {status === 'disconnected' && (
        <div>
          <h2>Connect your account</h2>
          <div style={{display: 'flex', gap: '0.5rem'}}>
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => connect({connector})}
                type="button"
              >
                {connector.name}
              </button>
            ))}
          </div>
          <div>{walletError?.message}</div>
        </div>
      )}
    </div>
  )
}
