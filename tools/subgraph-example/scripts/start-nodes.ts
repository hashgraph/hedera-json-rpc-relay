import { spawnSync, execSync } from 'child_process';

function startNodes() {
  console.log("Starting local hedera node");

  const cmdHedera = spawnSync('npx', ['hedera', 'restart', '--detached'], {stdio: 'inherit'});

  if (cmdHedera.status !== 0) {
    console.log(`Local node exited with status ${cmdHedera.status}`)
    process.exit(1);
  }

  console.log("Starting local graph-node");

  const cmdGraph = spawnSync('yarn', ['graph-local', '--detach'], {stdio: 'inherit'});
  if (cmdGraph.status !== 0) {
    console.log(`Local node exited with status ${cmdGraph.status}`)
    process.exit(1);
  }
}

startNodes()
