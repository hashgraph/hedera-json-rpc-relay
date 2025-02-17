// SPDX-License-Identifier: Apache-2.0

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
