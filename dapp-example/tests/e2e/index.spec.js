import 'cypress-wait-until';
import * as htsData from '../../.htsTokenAddress.json';

describe('Test Core Hedera User Scenarios', function () {
  this.timeout(180000);

  const connectToMetamask = function () {
    cy.visit('http://localhost:3000');
    cy.contains('Connect Account').click();
    cy.switchToMetamaskWindow();
    cy.acceptMetamaskAccess();
    cy.switchToCypressWindow();
  };

  it('Connects with Metamask', function () {
    connectToMetamask();

    // check the UI
    cy.get('#showAliasBtn').should('not.be.disabled');
    cy.get('#btnDeployContract').should('not.be.disabled');
    cy.get('#btnReadGreeting').should('not.be.disabled');
    cy.get('#btnUpdateGreeting').should('not.be.disabled');
  }).timeout(180000);

  it('Show alias', function () {
    // connectToMetamask();
    cy.visit('http://localhost:3000');
    cy.contains('Connect Account').click();
    cy.switchToMetamaskWindow();
    cy.acceptMetamaskAccess();
    cy.switchToCypressWindow();

    cy.get('#showAliasBtn').should('not.be.disabled').click();
    cy.confirmMetamaskSignatureRequest();
    cy.waitUntil(() => cy.get('#aliasField').invoke('text').should('have.length', 66));
  }).timeout(180000);

  it('Deploy contract', function () {
    // connectToMetamask();
    cy.visit('http://localhost:3000');
    cy.contains('Connect Account').click();
    cy.switchToMetamaskWindow();
    cy.acceptMetamaskAccess();
    cy.switchToCypressWindow();

    // deploy the contract
    cy.get('#btnDeployContract').should('not.be.disabled').click();
    cy.confirmMetamaskTransaction();
    cy.waitUntil(() => cy.get('#btnDeployContract').should('not.be.disabled'));

    // test a view call
    cy.get('#btnReadGreeting').should('not.be.disabled').click();
    cy.waitUntil(() => cy.get('#contractViewMsg').should('have.text', ' Result: initial_msg '));

    // test a update call
    cy.get('#updateGreetingText').type('updated_text');
    cy.get('#btnUpdateGreeting').should('not.be.disabled').click();
    cy.confirmMetamaskTransaction();
    cy.waitUntil(() => cy.get('#contractUpdateMsg').should('have.text', ' Updated text: updated_text '));

    // test the updated msg
    cy.get('#btnReadGreeting').should('not.be.disabled').click();
    cy.waitUntil(() => cy.get('#contractViewMsg').should('have.text', ' Result: updated_text '));
  }).timeout(180000);

  it('Transfer HTS token', function () {
    // connectToMetamask();
    cy.visit('http://localhost:3000');
    cy.contains('Connect Account').click();
    cy.switchToMetamaskWindow();
    cy.acceptMetamaskAccess();
    cy.switchToCypressWindow();

    // test the HTS transfer
    cy.get('#htsTokenAddressField').type(htsData.HTS_ADDRESS);
    cy.get('#htsReceiverAddressField').type('0x54C51b7637BF6fE9709e1e0EBc8b2Ca6a24b0f0A');
    cy.get('#htsTokenAmountField').type('1000');
    cy.get('#htsTokenTransferBtn').should('not.be.disabled').click();
    cy.confirmMetamaskTransaction();

    cy.waitUntil(() => cy.get('#htsTokenMsg').should('have.text', ' Done '));
  }).timeout(180000);

  it('Transfer HBARs', function () {
    // connectToMetamask();
    cy.visit('http://localhost:3000');
    cy.contains('Connect Account').click();
    cy.switchToMetamaskWindow();
    cy.acceptMetamaskAccess();
    cy.switchToCypressWindow();

    cy.get('#sendHbarsToField').type('0x54C51b7637BF6fE9709e1e0EBc8b2Ca6a24b0f0A');
    cy.get('#sendHbarsAmountField').type('10000000000000000');
    cy.get('#sendHbarsBtn').should('not.be.disabled').click();
    cy.confirmMetamaskTransaction();

    cy.waitUntil(() => cy.get('#sendHbarMsg').should('have.text', ' Done '));
  }).timeout(180000);
});
