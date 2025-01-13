/*-
 *
 * Hedera JSON RPC Relay - Wagmi Example
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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

import {Buffer} from 'buffer'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import {WagmiProvider} from 'wagmi'

import App from './App.tsx'
import {config} from './wagmi.ts'

import './index.css'

globalThis.Buffer = Buffer

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App/>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
