import app from '../../src/server';
import shell from 'shelljs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

(function () {
  process.env['NETWORK_NODE_IMAGE_TAG'] = '0.26.2';
  process.env['HAVEGED_IMAGE_TAG'] = '0.26.2';
  process.env['MIRROR_IMAGE_TAG'] = '0.58.0';
  console.log(`Docker container versions, services: ${process.env['NETWORK_NODE_IMAGE_TAG']}, mirror: ${process.env['MIRROR_IMAGE_TAG']}`);

  // start local-node
  console.log('Start local node');
  shell.exec('npx hedera-local restart');
  console.log('Hedera Hashgraph local node env started');

  console.log(`Start relay on port ${process.env.SERVER_PORT}`);
  shell.exec('npm run start');
})();
