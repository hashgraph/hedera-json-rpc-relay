import {
  AccountId,
  AccountInfoQuery,
  AccountUpdateTransaction,
  Client,
  ContractId,
  KeyList,
  PrivateKey,
} from '@hashgraph/sdk';
import { ethers, network } from 'hardhat';

export const getSignerCompressedPublicKey = (index = 0, asBuffer = true, prune0x = true) => {
  const wallet = new ethers.Wallet((network.config.accounts as any)[0]);

  const compressedPubKey = new ethers.utils.SigningKey(wallet.privateKey);

  const cpk = prune0x ? compressedPubKey.compressedPublicKey.replace('0x', '') : compressedPubKey.compressedPublicKey;

  return asBuffer ? Buffer.from(cpk, 'hex') : cpk;
};

export const updateAccountKeysViaHapi = async (contractAddresses: any, ecdsaPrivateKeys: any = []) => {
  const clientGenesis = createSDKClient();

  if (!ecdsaPrivateKeys.length) {
    ecdsaPrivateKeys = await getHardhatSignersPrivateKeys(false);
  }

  for (const privateKey of ecdsaPrivateKeys) {
    const pkSigner = PrivateKey.fromStringECDSA(privateKey.replace('0x', ''));
    const accountId = await getAccountId(pkSigner.publicKey.toEvmAddress(), clientGenesis);
    const clientSigner = createSDKClient(accountId, pkSigner);

    const keyList = new KeyList(
      [pkSigner.publicKey, ...contractAddresses.map((address: any) => ContractId.fromEvmAddress(0, 0, address))],
      1,
    );

    await (
      await new AccountUpdateTransaction()
        .setAccountId(accountId)
        .setKey(keyList)
        .freezeWith(clientSigner)
        .sign(pkSigner)
    ).execute(clientSigner);
  }
};

// @notice only applicable for Hedera networks
export const createSDKClient = (operatorId?: any, operatorKey?: any) => {
  const hederaNetwork: any = {};
  hederaNetwork[(network.config as any).sdkClient.networkNodeUrl] = AccountId.fromString(
    (network.config as any).sdkClient.nodeId,
  );

  const { mirrorNode } = (network.config as any).sdkClient;

  operatorId = operatorId || (network.config as any).sdkClient.operatorId;
  operatorKey = operatorKey || (network.config as any).sdkClient.operatorKey;

  const client = Client.forNetwork(hederaNetwork).setMirrorNetwork(mirrorNode).setOperator(operatorId, operatorKey);

  return client;
};

export const getHardhatSignersPrivateKeys = async (add0xPrefix = true) => {
  return (network.config.accounts as any).map((pk: any) => (add0xPrefix ? pk : pk.replace('0x', '')));
};

export const getAccountId = async (evmAddress: any, client: any) => {
  const query = new AccountInfoQuery().setAccountId(AccountId.fromEvmAddress(0, 0, evmAddress));

  const accountInfo = await query.execute(client);
  return accountInfo.accountId.toString();
};
