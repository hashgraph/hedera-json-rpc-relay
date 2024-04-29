import { ethers } from 'ethers';
import RelayClient from '../clients/relayClient';
import { numberTo0x } from '@hashgraph/json-rpc-relay/src/formatters';
import pino from 'pino';
import app from '../../dist/server';

const logger = pino({}).child({});
const RELAY_URL = process.env.E2E_RELAY_HOST || 'http://localhost:7546';

describe('HTS Token Transfer from EOA Directly To HTS@0x167', function () {
  this.timeout(240 * 1000); // 240 seconds
  let relay;

  before(async () => {
    relay = new RelayClient(RELAY_URL, logger.child({ name: `relay-test-client` }));

    app.listen({ port: '7546' });
  });

  it('TransferToken EOA -> HTS', async function () {
    const privateKey = 'EOA_PRIVATE_KEY';
    const wallet = new ethers.Wallet(privateKey);

    const HTSPrecompiledAddress = '0x0000000000000000000000000000000000000167';

    const senderAddress = 'SENDER_ADDRESS'.replace('0x', '');
    const receiverAddress = 'RECEIVER_ADDRESS'.replace('0x', '');
    const tokenAddress = 'TOKEN_ADDRESS'.replace('0x', '');

    const data = `0xeca36917000000000000000000000000${tokenAddress}000000000000000000000000${senderAddress}000000000000000000000000${receiverAddress}000000000000000000000000000000000000000000000000000000000000000a`;

    const transaction = {
      gasLimit: numberTo0x(1_000_000),
      to: HTSPrecompiledAddress,
      nonce: await relay.getAccountNonce(wallet.address),
      gasPrice: await relay.gasPrice(),
      data,
    };

    const signedTx = await wallet.signTransaction(transaction);
    const transactionHash = await relay.sendRawTransaction(signedTx);
    console.log(`Transaction is available at: https://hashscan.io/previewnet/transaction/${transactionHash}`);
  });
});
