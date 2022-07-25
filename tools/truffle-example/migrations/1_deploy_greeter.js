const Greeter = artifacts.require('Greeter');

module.exports = function (deployer) {
  deployer.deploy(Greeter, 'initial_msg');
};
