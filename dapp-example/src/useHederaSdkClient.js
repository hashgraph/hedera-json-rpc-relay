import React from "react";
import ethCrypto from 'eth-crypto';
import { PublicKey } from "@hashgraph/sdk";

const useHederaSdk = () => {

    const recoveredPublicKeyToAccountId = (publicKey) => {
        const compressed = ethCrypto.publicKey.compress(publicKey.startsWith('0x') ? publicKey.substring(2) : publicKey);
        const accountId = PublicKey.fromString(compressed).toAccountId(0, 0);

        return accountId;
    }

    return {
        recoveredPublicKeyToAccountId
    }
}

export default useHederaSdk;