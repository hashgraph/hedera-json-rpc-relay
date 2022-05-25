<div align="center">

# Hedera JSON RPC Relay

[![Tests](https://github.com/hashgraph/hedera-json-rpc-relay/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/hashgraph/hedera-json-rpc-relay/actions/workflows/test.yml)

</div>

## Overview

Implementation of an Ethereum JSON RPC APIs for Hedera Hashgraph. Utilises both Hedera Consensus Nodes and Mirror nodes
to support RPC queries as defined in
the [JSON RPC Specification](https://playground.open-rpc.org/?schemaUrl=https://raw.githubusercontent.com/ethereum/eth1.0-apis/assembled-spec/openrpc.json&uiSchema%5BappBar%5D%5Bui:splitView%5D=true&uiSchema%5BappBar%5D%5Bui:input%5D=false&uiSchema%5BappBar%5D%5Bui:examplesDropdown%5D=false)

## Building

### Pre-requirements

You must have installed 
- [node (version 16)](https://nodejs.org/en/about/)
- [npm](https://www.npmjs.com/)
- [pnpm](https://pnpm.io/)
- [Docker](https://docs.docker.com/engine/reference/commandline/docker/)

We also recommend installing the "prettier" plugin in IntelliJ.

### Steps

From the root of the project workspace:

1. Run `npm install`. This will create and populate `node_modules`.
2. Run `npm run setup`. This will link the `node_modules` to the packages, and the packages together.
3. Run `npm run build`. This will clean and compile the relay library and the server.
4. Run `npm run start`. This will start the server on port `7546`.

Alternatively, after `npm run setup`, from within the IDE, you should see the `Start Relay Microservice`
run configuration. You should be able to just run that configuration, and it should start the server on port `7546`.

## Deployment

The Relay supports Docker image building and Docker Compose container management using the provided [Dockerfile](Dockerfile) and [docker-compose](docker-compose.yml) files.

### Image Build (optional)
A new docker image may be created from a local copy of the repo.
Run the following command, substituting `<owner>` as desired

```shell
docker build -t <owner>/hedera-json-rpc-relay .
```

After building, the image may be tagged by running the following command, substituting `<version>` as desired

```shell
docker tag <owner>/hedera-json-rpc-relay:latest hedera-json-rpc-relay:<version>
```

### Configuration

The relay application currently utilizes [dotenv](https://github.com/motdotla/dotenv) to manage configurations.
Key values are pulled from a `.env` file and reference as `process.env.<KEY>` in the application.

To modify the default values
1. Rename [.env.example file](.env.example) to `.env`
2. Populate the expected fields
3. Update the `relay` service volumes section in the [docker-compose](docker-compose.yml) file from `./.env.sample:/home/node/app/.env.sample` to `./.env:/home/node/app/.env`

Custom values provided will now be incorporated on startup of the relay

### Starting

To start the relay, a docker container may be created using the following command
```shell
docker compose up -d
```

By default the relay will be made accessible on port `7546`
A quick tests can be performed to verify the container is up and running

From a command prompt/terminal run the command
```shell
curl -X POST -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":"2","method":"eth_chainId","params":[null]}' http://localhost:7546
```

The expected response should be `{"result":"0x12a","jsonrpc":"2.0","id":"2"}`
Where the `result` value matches the .env `CHAIN_ID` configuration value or the current deault value of `298`

### Helm Chart

In this repo there is a `helm-chart` directory that contains the configurations to deploy Hedera's json-rpc relay to a K8s cluster.
To get started install the helm chart:
```
helm install hedera-json-rpc-relay ./helm-chart --debug
```

To see the values that have been deployed:
```
helm show values hedera-json-rpc-relay
```
Deploy an installation with custom values file:
```
helm install custom-hedera-json-rpc-relay -f path/to/values/file.yaml ./helm-chart --debug
```
#### Deploy Helm Chart locally on minikube
1.  Minikube must be running and the set context
2. GHCR.io requires authorization to pull the image.  This auth will require a Github PAT to be generated
  * Acquire PAT, username, and, (primary) email address from Github.
  * Manually create a secret on kubernetes with the following command.  The $ must be replaced
    ```
    kubectl create secret docker-registry ghcr-registry-auth \
    --docker-server=https://ghcr.io \
    --docker-username=$GH_USERNAME \
    --docker-password=$GH_PAT \
    --docker-email=$GH_EMAIL
    ```
3. Deploy this helm-chart with the addtion [environment/minikube.yaml](environment/minikube.yaml) file
```
helm upgrade -f environments/minkube.yaml jrpc-test ./ 
```
4. Port forward the pod IP to localhost
```
kubectl port-forward $POD_NAME 7546:7546
```


## Support

If you have a question on how to use the product, please see our
[support guide](https://github.com/hashgraph/.github/blob/main/SUPPORT.md).

## Contributing

Contributions are welcome. Please see the
[contributing guide](https://github.com/hashgraph/.github/blob/main/CONTRIBUTING.md)
to see how you can get involved.

## Code of Conduct

This project is governed by the
[Contributor Covenant Code of Conduct](https://github.com/hashgraph/.github/blob/main/CODE_OF_CONDUCT.md). By
participating, you are expected to uphold this code of conduct. Please report unacceptable behavior
to [oss@hedera.com](mailto:oss@hedera.com).

## License

[Apache License 2.0](LICENSE)
