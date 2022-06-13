# Transferring Hbar Using the Hedera JSON-RPC Relay

For illustration purposes, Metamask is used but this guide should be applicable to any JSON-RPC enabled wallet.

## Add Hedera Network to Metamask

1. Open Metamask and click on the circle in the upper right corner
2. Select `Settings`->`Networks`->`Add Network`
3. Populate `Network Name` as desired
4. Fill in `New RPC URL` for the relay you are connecting to
5. Enter proper `Chain ID`, ensure no error message is seen and that the id matches
6. Fill in a `Currency Symbol`

The panel should be populated similar to the following:

![Network Panel](images/networkPanel.png)

## Create Necessary Accounts

### Fund Creation Account
In order to get started you will need to have created a Hedera account with sufficient balance to pay for the following transactions.

### Create Aliased Hedera Accounts for hbar Transfer
Aliased accounts matching the private keys will need to be created in order to properly sign transactions. 

You can create an aliased account by executing [account-alias-ecdsa.js](examples/account-alias-ecdsa.js). You will need to setup your `docs/examples/.env` file with you account id and private key. It is not recommended to run this on mainnet as this will print private keys to the command line. This is for demonstration purposes only.

Record the raw private keys that are printed to the command line.

### Create Aliased Hedera Accounts for Custom Token Transfer
Aliased accounts containing tokens and matching the private keys will need to be created in order to properly sign transactions.

You can create two aliased accounts with token balances by executing [token-transfer-setup.js](examples/token-transfer-setup.js). You will need to setup your `docs/examples/.env` file with you account id and private key. It is not recommended to run this on mainnet as this will print private keys to the command line. This is for demonstration purposes only.

Record the raw private keys that are printed to the command line as well as the Ethereum Token Address.

## Import Account into Metamask

Repeat this process for every account you wish to import:

1. Copy the raw private key of an account to be imported
2. Click on the circle in the upper right corner
3. Select `Import Account`

![Import Account Button](images/importAccountButton.png)

4. Paste your private key into the field and click `Import`

![Import Account Panel](images/importAccountPanel.png)

5. Verify that the balance loads successfully

![Imported Account](images/importedAccount.png)

## Transfer Process

### Send Hbar
1. Open the receiving account in metamask and copy the address using the button below the account nickname
2. Go to the sending account and click `Send`
3. Paste the address into the `Send to` bar

![Send Address](images/sendAddress.png)

4. Enter in a valid amount to send to the account into the `Amount` field and click `Next`

![Send Populate](images/sendPopulate.png)

5. Click `Confirm` on the next panel after the gas values populate

![Send Confirm](images/sendConfirm.png)

6. Transaction will transition to pending

![Send Pending](images/sendPending.png)

7. Wait a few seconds for the transaction to confirm and the balance should decrease

![Send Settled](images/sendSettled.png)

8. Verify the updated balance in the receiving account.

![Send Received](images/sendReceived.png)

### Send Tokens

#### Import Token into Metamask Account
1. Select `Assets` for the account with token you have previously imported

![Assets Menu](images/assetsMenu.png)

2. Click `Import tokens`
3. Copy Ethereum Token Address from account
4. Paste into `Token Contract Address`

![Import Token Address](images/importTokenAddress.png)

5. `Token Symbol` and `Token Decimal` should autopopulate from the network

![Import Token Details](images/importTokenDetails.png)

6. Click `Add Custom Token`
7. The balance should update for the token, then select `Import Tokens`

![Import Tokens](images/ImportTokens.png)

#### Transfer Tokens Between Accounts
1. Open the receiving account in metamask and copy the address using the button below the account nickname
2. Go to the sending account and click `Send`

![Send Button](images/sendButton.png)

3. Paste the address into the `Send to` bar

![Send Address](images/sendAddress.png)

4. Under `Asset` select the desired token. For the Demo this is `D`

![Select Asset](images/selectAsset.png)

5. Enter a valid amount to send to the account into the `Amount` field and click `Next`

![Send Asset Populate](images/sendAssetPopulate.png)

5. Click `Confirm` on the next panel after the gas values populate

![Send Asset Confirm](images/sendAssetConfirm.png)

6. Transaction will transition to pending

![Send Asset Pending](images/sendAssetPending.png)

7. Wait a few seconds for the transaction to confirm

![Send Asset Settled](images/sendAssetSettled.png)

8. Verify the balance has decreased by the expected amount of the asset previously selected

![Send Asset Decrease](images/sendAssetDecrease.png)

9. Verify the updated balance in the receiving account.

![Send Asset Received](images/sendAssetReceived.png)

