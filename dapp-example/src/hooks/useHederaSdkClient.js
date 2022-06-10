import React from "react";
import ethCrypto from 'eth-crypto';
import { PublicKey, Client, TransferTransaction, Hbar, AccountId, AccountInfoQuery } from "@hashgraph/sdk";

const client = Client.forTestnet();

const useHederaSdk = () => {

    const recoveredPublicKeyToAccountId = (publicKey) => {
        const compressed = ethCrypto.publicKey.compress(publicKey.startsWith('0x') ? publicKey.substring(2) : publicKey);

        const accountId = PublicKey.fromString(compressed).toAccountId(0, 0);

        return accountId;
    }

    const transferHbarsToAccount = async (operatorId, operatorPrivateKey, amount, accountId) => {
        client.setOperator(operatorId, operatorPrivateKey);

        const transferTransaction = await new TransferTransaction()
            .addHbarTransfer(client.operatorAccountId, new Hbar(amount).negated())
            .addHbarTransfer(accountId, new Hbar(amount))
            .execute(client);

        return await transferTransaction.getReceipt(client);
    }

    const getAccountInfo = async (evmAddress) => {
        const info = await new AccountInfoQuery({ accountId: AccountId.fromEvmAddress(0, 0, evmAddress) }).execute(client);

        return info;
    }

    return {
        recoveredPublicKeyToAccountId,
        transferHbarsToAccount,
        getAccountInfo
    }
}

export default useHederaSdk;