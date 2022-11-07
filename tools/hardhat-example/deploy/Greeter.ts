import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFunction: DeployFunction = async function ({ deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const deployResult = await deploy("Greeter", {
    from: deployer,
    deterministicDeployment: false,
    args: ["hello world"],
    gasLimit: 4_000_000,
  });

  console.log("Greeter deployed to:", deployResult.address);
};

export default deployFunction;

deployFunction.tags = ["Greeter"];
