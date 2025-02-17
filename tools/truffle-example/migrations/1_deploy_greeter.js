// SPDX-License-Identifier: Apache-2.0

const Greeter = artifacts.require('Greeter');

module.exports = function (deployer) {
  deployer.deploy(Greeter, 'initial_msg');
};
