// SPDX-License-Identifier: Apache-2.0

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
