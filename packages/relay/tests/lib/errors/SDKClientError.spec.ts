// SPDX-License-Identifier: Apache-2.0

import { Status } from '@hashgraph/sdk';
import { expect } from 'chai';

import { SDKClientError } from '../../../src/lib/errors/SDKClientError'; // Update the path to point to the SDKClientError file

describe('SDKClientError', () => {
  it('should set status to Unknown if status is not provided in error', () => {
    const error = new SDKClientError({ message: 'Unknown error' });
    expect(error.status).to.equal(Status.Unknown);
    expect(error.isValidNetworkError()).to.be.false;
  });

  it('should set status and validNetworkError if status is provided in error', () => {
    const error = new SDKClientError({ status: Status.InvalidAccountId, message: 'INVALID_ACCOUNT_ID' });
    expect(error.status).to.equal(Status.InvalidAccountId);
    expect(error.isValidNetworkError()).to.be.true;
  });

  it('should return the correct status code', () => {
    const error = new SDKClientError({ status: Status.InvalidAccountId, message: 'INVALID_ACCOUNT_ID' });
    expect(error.statusCode).to.equal(Status.InvalidAccountId._code);
  });

  it('should correctly identify invalid account ID', () => {
    const error = new SDKClientError({ status: Status.InvalidAccountId, message: 'INVALID_ACCOUNT_ID' });
    expect(error.isInvalidAccountId()).to.be.true;
  });

  it('should correctly identify invalid contract ID by status code', () => {
    const error = new SDKClientError({ status: Status.InvalidContractId, message: 'INVALID_CONTRACT_ID' });
    expect(error.isInvalidContractId()).to.be.true;
  });

  it('should correctly identify invalid contract ID by message', () => {
    const error = new SDKClientError({ status: Status.Unknown, message: 'INVALID_CONTRACT_ID' });
    console.log(Status.InvalidContractId.toString());
    expect(error.isInvalidContractId()).to.be.true;
  });

  it('should correctly identify contract deletion', () => {
    const error = new SDKClientError({ status: Status.ContractDeleted, message: 'Contract deleted' });
    expect(error.isContractDeleted()).to.be.true;
  });

  it('should correctly identify insufficient transaction fee', () => {
    const error = new SDKClientError({ status: Status.InsufficientTxFee, message: 'Insufficient transaction fee' });
    expect(error.isInsufficientTxFee()).to.be.true;
  });

  it('should correctly identify contract revert execution', () => {
    const error = new SDKClientError({ status: Status.ContractRevertExecuted, message: 'Contract revert executed' });
    expect(error.isContractRevertExecuted()).to.be.true;
  });

  it('should correctly identify timeout exceeded', () => {
    const error = new SDKClientError({ status: Status.Unknown, message: 'timeout exceeded' });
    expect(error.isTimeoutExceeded()).to.be.true;
  });

  it('should correctly identify connection dropped', () => {
    const error = new SDKClientError({ status: Status.Unknown, message: 'Connection dropped' });
    expect(error.isConnectionDropped()).to.be.true;
  });

  it('should correctly identify gRPC timeout', () => {
    const error = new SDKClientError({ status: Status.InvalidTransactionId, message: 'gRPC timeout' });
    expect(error.isGrpcTimeout()).to.be.true;
  });

  it('should not identify gRPC timeout when the status code is different', () => {
    const error = new SDKClientError({ status: Status.InvalidAccountId, message: 'Not a gRPC timeout' });
    expect(error.isGrpcTimeout()).to.be.false;
  });

  it('should handle cases where status is undefined', () => {
    const error = new SDKClientError({ message: 'Some error without status' });
    expect(error.status).to.equal(Status.Unknown);
    expect(error.isValidNetworkError()).to.be.false;
  });

  it('should correctly handle an error without a status field', () => {
    const error = new SDKClientError({ message: 'Generic error' });
    expect(error.status).to.equal(Status.Unknown);
    expect(error.isValidNetworkError()).to.be.false;
  });

  it('should correctly handle a valid network error with a status field', () => {
    const error = new SDKClientError({ status: Status.InsufficientTxFee, message: 'Insufficient fee' });
    expect(error.isValidNetworkError()).to.be.true;
    expect(error.status).to.equal(Status.InsufficientTxFee);
  });

  it('should correctly handle an invalid status code in the error object', () => {
    const invalidStatus = { _code: 9999 };
    const error = new SDKClientError({ status: invalidStatus, message: 'Invalid status code' });
    expect(error.statusCode).to.equal(invalidStatus._code);
    expect(error.isValidNetworkError()).to.be.true;
  });

  it('should be able to get nodeAccountId', () => {
    const nodeId = '0.0.3';
    const error = new SDKClientError({}, undefined, undefined, nodeId);
    expect(error.nodeAccountId).to.equal(nodeId);
  });
});
