import { spawnSync, execSync } from 'child_process';

function stopNodes() {
  execSync('yarn graph-local-clean');
  execSync('npx hedera stop');
}

stopNodes();
