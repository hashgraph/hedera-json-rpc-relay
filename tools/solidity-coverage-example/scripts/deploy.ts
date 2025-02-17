// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'hardhat';

async function main() {
  const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  const unlockTime = currentTimestampInSeconds + 60;

  const lockedAmount = ethers.parseEther('0.001');

  const lock = await ethers.deployContract('Lock', [unlockTime], {
    value: lockedAmount,
  });
  const tokenService = await ethers.deployContract('TokenSend');

  await lock.waitForDeployment();
  await tokenService.waitForDeployment();

  console.log(
    `Lock with ${ethers.formatEther(lockedAmount)}ETH and unlock timestamp ${unlockTime} deployed to ${lock.target}`,
  );
  console.log(`TokenSend deployed to ${tokenService.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
