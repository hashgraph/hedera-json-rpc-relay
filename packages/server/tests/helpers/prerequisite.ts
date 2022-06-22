import app from '../../src/server';
import shell from 'shelljs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const USE_LOCAL_NODE = process.env.LOCAL_NODE || 'true';
const LOCAL_RELAY_URL = 'http://localhost:7546';
const RELAY_URL = process.env.E2E_RELAY_HOST || LOCAL_RELAY_URL;

(function () {
  // if (USE_LOCAL_NODE) {
  //   process.env['NETWORK_NODE_IMAGE_TAG'] = '0.26.2';
  //   process.env['HAVEGED_IMAGE_TAG'] = '0.26.2';
  //   process.env['MIRROR_IMAGE_TAG'] = '0.58.0';
  //   console.log(`Docker container versions, services: ${process.env['NETWORK_NODE_IMAGE_TAG']}, mirror: ${process.env['MIRROR_IMAGE_TAG']}`);

  //   // start local-node
  //   console.log('Start local node');
  //   shell.exec('npx hedera-local restart');
  //   console.log('Hedera Hashgraph local node env started');
  // }

  if (RELAY_URL === LOCAL_RELAY_URL) {
    console.log(`Start relay on port ${process.env.SERVER_PORT}`);
    app.listen({ port: process.env.SERVER_PORT });
  }

  shell.exec(`cd ${process.cwd()} && xvfb-run -a --server-args="-screen 0 1280x1024x24" npm run only-tests --prefix ./dapp-example/`)
})();
