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
    // set env variables for docker images until local-node is updated
    process.env['NETWORK_NODE_IMAGE_TAG'] = '0.30.0-alpha.0';
    process.env['HAVEGED_IMAGE_TAG'] = '0.30.0-alpha.0';
    process.env['MIRROR_IMAGE_TAG'] = '0.64.3';
  
    console.log(`Docker container versions, services: ${process.env['NETWORK_NODE_IMAGE_TAG']}, mirror: ${process.env['MIRROR_IMAGE_TAG']}`);
  
    // start local-node
    //This is temporary solution
    console.log('Installing local node...');
    shell.exec(`npm install @hashgraph/hedera-local && hedera stop`);
  
    console.log('Start local node');
    shell.exec(`hedera start -d`);
    console.log('Hedera Hashgraph local node env started');
  }

  if (RELAY_URL === LOCAL_RELAY_URL) {
    shell.exec('docker stop json-rpc-relay');
    console.log(`Start relay on port ${process.env.SERVER_PORT}`);
    app.listen({ port: process.env.SERVER_PORT });
  }
})();