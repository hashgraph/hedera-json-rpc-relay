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