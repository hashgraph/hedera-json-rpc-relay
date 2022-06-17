let addressSpan = document.getElementById('publicKey');
let walletField = document.getElementById('wallet');
let contractField = document.getElementById('contract');
let msgHashField = document.getElementById('msgHash')
let signatureField = document.getElementById('signature')
let extractedAddressField = document.getElementById('extractedAddress')
let validatesField = document.getElementById('validates')

let currentAccount = "";


function handleAccountsChanged(accounts) {
    console.log(JSON.stringify(accounts))
    if (accounts.length === 0) {
        // MetaMask is locked or the user has not connected any accounts
        console.log('Please connect to MetaMask.');
    } else if (accounts[0] !== currentAccount) {
        currentAccount = accounts[0];
        walletField.value = currentAccount;
        // Do any other work!
    }
}

function connect() {
    ethereum
        .request({method: 'eth_requestAccounts'})
        .then(handleAccountsChanged)
        .catch((err) => {
            if (err.code === 4001) {
                // EIP-1193 userRejectedRequest error
                // If this happens, the user rejected the connection request.
                console.log('Please connect to MetaMask.');
            } else {
                console.error(err);
            }
        });
}


function signMessage() {
    const message = "My ethereum address is " + currentAccount + "\nThe time is " + new Date().toLocaleString();

    ethereum.sendAsync(
        {
            method: "personal_sign",
            params: [message, currentAccount],
            from: currentAccount
        },
        function (err, result) {
            if (err) {
                return console.error(err);
            } else {
                console.log("Success");
                console.log(JSON.stringify(result));
            }
            const signature = result.result.substring(2);
            const r = signature.substring(0, 64);
            const s = signature.substring(64, 128);
            const v = parseInt(signature.substring(128, 130), 16);
            // The signature is now comprised of r, s, and v.
            console.log(r, s, v)
            signatureField.value = signature

            const msgHash = keccak256("\x19Ethereum Signed Message:\n" + message.length + message).toString("hex")
            console.log(Secp256k1.uint256(msgHash, 16))
            msgHashField.value = msgHash

            const key = Secp256k1.ecrecover(v, Secp256k1.uint256(r, 16), Secp256k1.uint256(s, 16), msgHash);
            console.log(JSON.stringify(key))
        }
    );
}

function verifyMessage() {
    let verifyData = "0x77d32e94" +
        msgHashField.value +
        "00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000041" +
        signatureField.value +
        "00000000000000000000000000000000000000000000000000000000000000";
    console.log(verifyData);
    ethereum.sendAsync(
        {
            method: "eth_call",
            params: 
                [{
                    from: currentAccount,
                    to: contractField.value, 
                    gas: "0x40000",
                    data: verifyData                    
                }, "latest"]
        },
        function (err, result) {
            if (err) {
                return console.error(err);
            } else {
                console.log("Success");
                console.log(JSON.stringify(result));
            }
            extractedAddressField.value = "0x" + result.result.substring(26);
        }
    );
    // ethereum.sendAsync(
    //     {
    //         method: "eth_sendTransaction",
    //         params:
    //             [{
    //                 from: currentAccount,
    //                 to: contractField.value,
    //                 gas: "0x40000",
    //                 data: verifyData
    //             }, "latest"]
    //     },
    //     function (err, result) {
    //         if (err) {
    //             return console.error(err);
    //         } else {
    //             console.log("Success");
    //             console.log(JSON.stringify(result));
    //         }
    //         validatesField.value = "0x" + result.result;
    //     }
    // );
    
}
