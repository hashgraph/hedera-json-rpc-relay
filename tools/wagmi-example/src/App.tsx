// SPDX-License-Identifier: Apache-2.0

import {Profile} from "./components/Profile.tsx";
import {Contract} from "./components/Contract.tsx";

function App() {
  return (
    <>
      {/*This part covers account handling*/}
      <Profile/>
      {/*Deploy and interact with contract*/}
      <Contract/>
    </>
  )
}

export default App
