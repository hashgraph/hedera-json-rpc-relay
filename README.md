# Hashio

# Building

### Pre-requirements

You must have installed node (version 16) and npm. I also recommend installing the "prettier" plugin in IntelliJ.

### Steps

From the root of the project workspace:

1. Run `npm install`. This will create and populate `node_modules`.
2. Run `npm run setup`. This will link the `node_modules` to the packages, and the packages together.
3. Run `npm run build`. This will clean and compile the bridge library and the server.
4. Run `npm run start`. This will start the server on port `7546`.

Alternatively, after `npm run setup`, from within the IDE, you should see the `Start Bridge Microservice`
run configuration. You should be able to just run that configuration, and it should start the server on port `7546`.
