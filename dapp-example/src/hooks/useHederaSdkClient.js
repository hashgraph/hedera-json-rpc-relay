import React from "react";
import { ethers } from 'ethers';
import { PublicKey, Client, TransferTransaction, Hbar, AccountId, AccountInfoQuery } from "@hashgraph/sdk";

const client = Client.forTestnet();

const useHederaSdk = () => {

    const recoveredPublicKeyToAccountId = (publicKey) => {
        const compressed = ethers.utils.computePublicKey(ethers.utils.arrayify(publicKey), true);
            
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
