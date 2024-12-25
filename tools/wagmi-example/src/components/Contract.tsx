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

import {useDeploy, useReadGreet, useWriteGreet,} from "../hooks/use-deploy.ts";
import {useState} from "react";
import {useAccount} from "wagmi";

export function Contract() {
  const {status} = useAccount()

  const {deployContract, contractAddress, isDeployed} = useDeploy();
  const {data, status: greetStatusView, refetch} = useReadGreet(contractAddress)
  const {status: setGreetStatus, setGreeting} = useWriteGreet(contractAddress, refetch)

  const [greetingInput, setGreetingInput] = useState("")

  return status === "connected" ? (
    <div>
      <h2>Deploy greeter contract</h2>
      {!isDeployed ? (
        <div>
          <button onClick={deployContract}>Deploy</button>
        </div>
      ) : (
        <p>Your contract is deployed on address: {contractAddress}</p>
      )}

      {isDeployed && (
        <div>
          <p>Current greet: {JSON.stringify(data)}</p>
          <p>Get greet status: {greetStatusView}</p>
          <hr/>
          <div className="flex">
            <input type="text" value={greetingInput} onChange={(e) => setGreetingInput(e.target.value)}/>
            <button onClick={() => setGreeting(greetingInput)}>Call contract</button>
          </div>
          <p>Send transaction status: {setGreetStatus}</p>
        </div>
      )}
    </div>
  ) : null;
}
