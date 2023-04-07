import app from '../../src/server';
import shell from 'shelljs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const USE_LOCAL_NODE = process.env.LOCAL_NODE || 'true';
const LOCAL_RELAY_URL = 'http://localhost:7546';
const RELAY_URL = process.env.E2E_RELAY_HOST || LOCAL_RELAY_URL;

(function () {
  if (USE_LOCAL_NODE) {
    process.env['NETWORK_NODE_IMAGE_TAG'] = '0.37.0-alpha.0';
    process.env['HAVEGED_IMAGE_TAG'] = '0.37.0-alpha.0';
    process.env['MIRROR_IMAGE_TAG'] = '0.78.0-beta1';

    console.log(`Docker container versions, services: ${process.env['NETWORK_NODE_IMAGE_TAG']}, mirror: ${process.env['MIRROR_IMAGE_TAG']}`);

    console.log('Installing local node...');
    shell.exec(`npm install @hashgraph/hedera-local -g`);

    console.log('Starting local node...');
    shell.exec(`hedera start -d`);
    console.log('Hedera Hashgraph local node env started');
  }

  if (RELAY_URL === LOCAL_RELAY_URL) {
    shell.exec('docker stop json-rpc-relay');
    console.log(`Start relay on port ${process.env.SERVER_PORT}`);
    app.listen({ port: process.env.SERVER_PORT });
  }
})();
