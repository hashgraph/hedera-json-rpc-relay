const replace = require("replace");
const yaml = require('js-yaml');
const fs = require('fs');
const {execSync} = require('child_process')

const versionRegex = /\d+\.\d+\.\d+(-\w+)?/i;
const newVersion = process.env.SEM_VER;
const isSnapshot = process.env.SNAPSHOT ? process.env.SNAPSHOT == 'true' : false;

function checkVersion(semver){

    if(semver == undefined || semver == '') {
        console.log("semver cannot be blank");
        process.exit(1);
    }

    if(semver.match(versionRegex) == undefined) {
        console.log(`semver: ${semver} must be Semantic Version <Major>.<Minnor>.<Patch>[-<type>], examples: '0.20.0', '0.20.0-rc1'`)
        process.exit(1);
    }

    return semver;
}

// check is a valid version
checkVersion(newVersion);

console.log(`Bumping version to: ${newVersion}`);
console.log(`is Snapshot: ${isSnapshot}`);
// bumping version using replace for 'packages/relay/package.json', 'packages/server/package.json', 'docs/openrpc.json'
replace({
    regex: '\"version\": \"\\d+\\.\\d+\\.\\d+(-\\w+)?\"',
    replacement: `"version": "${newVersion}"`,
    paths: ['packages/relay/package.json', 'packages/server/package.json', 'docs/openrpc.json'],
    recursive: false,
    silent: false,
});

// bump only when is not snapshot
if(!isSnapshot) {
    // bump docker-compose.js version
    const dockerComposePath = 'docker-compose.yml';
    let dockerComposeYml = yaml.load(fs.readFileSync(dockerComposePath));
    dockerComposeYml.services.relay.image = `ghcr.io/hashgraph/hedera-json-rpc-relay:${newVersion}`
    fs.writeFileSync(dockerComposePath, yaml.dump(dockerComposeYml));
    console.log(dockerComposePath);

    const majorMinorVersion = `${newVersion.split(".")[0]}.${newVersion.split(".")[1]}`;

    // also update README.md using replace
    replace({
        regex: '(\\/hashgraph\\/hedera-json-rpc-relay\\/){1}(main|(release\\/\\d+.\\d+)){1}(\\/docs\\/openrpc.json){1}',
        replacement: `/hashgraph/hedera-json-rpc-relay/release/${majorMinorVersion}/docs/openrpc.json`,
        paths: ['README.md'],
        recursive: false,
        silent: false,
    });
}

// bump helm chart versions
const helmChartPath = 'helm-chart/Chart.yaml';
let doc = yaml.load(fs.readFileSync(helmChartPath, 'utf-8'));
doc.version = newVersion;
doc.appVersion = `${newVersion}`;
fs.writeFileSync(helmChartPath, yaml.dump(doc));
console.log(helmChartPath);

// bump package-lock.json using npm itself, by running install it will update packages versions based on previous files
execSync("npm install")
console.log("package-lock.json");
console.log("All files were bumped successfully!")

