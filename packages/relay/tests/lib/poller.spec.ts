/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
import { EthImpl } from '../../src/lib/eth';
import { expect } from 'chai';
import pino from 'pino';
import { Poller } from '../../src/lib/poller';
import sinon from 'sinon';

const logger = pino();

describe('Polling', async function() {
    this.timeout(20000);

    const ARRAY_OF_LOGS = 'Called notifySubscriber with an array of log data!';
    const FETCHING_DATA = 'Poller: Fetching data for {"event":"logs","filters":{"address":"0x23f5e49569A835d7bf9AefD30e4f60CdD570f225","topics":["0xc8b501cbd8e69c98c535894661d25839eb035b096adfde2bba416f04cc7ce987"]}}';
    const logs = '[{"address":"0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69","blockHash":"0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b","blockNumber":"0x3","data":"0x","logIndex":"0x0","removed":false,"topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000000000000000000000000000000000000000000000","0x000000000000000000000000000000000000000000000000000000000208fa13","0x0000000000000000000000000000000000000000000000000000000000000005"],"transactionHash":"0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392","transactionIndex":"0x1"},{"address":"0x0000000000000000000000000000000002131952","blockHash":"0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b","blockNumber":"0x3","data":"0x","logIndex":"0x1","removed":false,"topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000000000000000000000000000000000000000000000","0x000000000000000000000000000000000000000000000000000000000208fa13","0x0000000000000000000000000000000000000000000000000000000000000005"],"transactionHash":"0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392","transactionIndex":"0x1"},{"address":"0x0000000000000000000000000000000002131953","blockHash":"0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b","blockNumber":"0x4","data":"0x","logIndex":"0x0","removed":false,"topics":[],"transactionHash":"0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6393","transactionIndex":"0x1"},{"address":"0x0000000000000000000000000000000002131954","blockHash":"0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b","blockNumber":"0x5","data":"0x","logIndex":"0x0","removed":false,"topics":[],"transactionHash":"0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6394","transactionIndex":"0x1"}]';
    const logsArray = new Array([
        [{"address":"0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69","blockHash":"0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b","blockNumber":"0x3","data":"0x","logIndex":"0x0","removed":false,"topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000000000000000000000000000000000000000000000","0x000000000000000000000000000000000000000000000000000000000208fa13","0x0000000000000000000000000000000000000000000000000000000000000005"],"transactionHash":"0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392","transactionIndex":"0x1"},{"address":"0x0000000000000000000000000000000002131952","blockHash":"0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b","blockNumber":"0x3","data":"0x","logIndex":"0x1","removed":false,"topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000000000000000000000000000000000000000000000","0x000000000000000000000000000000000000000000000000000000000208fa13","0x0000000000000000000000000000000000000000000000000000000000000005"],"transactionHash":"0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392","transactionIndex":"0x1"},{"address":"0x0000000000000000000000000000000002131953","blockHash":"0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b","blockNumber":"0x4","data":"0x","logIndex":"0x0","removed":false,"topics":[],"transactionHash":"0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6393","transactionIndex":"0x1"},{"address":"0x0000000000000000000000000000000002131954","blockHash":"0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b","blockNumber":"0x5","data":"0x","logIndex":"0x0","removed":false,"topics":[],"transactionHash":"0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6394","transactionIndex":"0x1"}],
        [{"address":"0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69","blockHash":"0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b","blockNumber":"0x3","data":"0x","logIndex":"0x0","removed":false,"topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000000000000000000000000000000000000000000000","0x000000000000000000000000000000000000000000000000000000000208fa13","0x0000000000000000000000000000000000000000000000000000000000000005"],"transactionHash":"0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392","transactionIndex":"0x1"},{"address":"0x0000000000000000000000000000000002131952","blockHash":"0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b","blockNumber":"0x3","data":"0x","logIndex":"0x1","removed":false,"topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000000000000000000000000000000000000000000000","0x000000000000000000000000000000000000000000000000000000000208fa13","0x0000000000000000000000000000000000000000000000000000000000000005"],"transactionHash":"0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392","transactionIndex":"0x1"},{"address":"0x0000000000000000000000000000000002131953","blockHash":"0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b","blockNumber":"0x4","data":"0x","logIndex":"0x0","removed":false,"topics":[],"transactionHash":"0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6393","transactionIndex":"0x1"},{"address":"0x0000000000000000000000000000000002131954","blockHash":"0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b","blockNumber":"0x5","data":"0x","logIndex":"0x0","removed":false,"topics":[],"transactionHash":"0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6394","transactionIndex":"0x1"}] 
    ]);
    const SINGLE_LINE = 'Called notifySubscriber with single line of log data!';
    const tag = '{"event":"logs","filters":{"address":"0x23f5e49569A835d7bf9AefD30e4f60CdD570f225","topics":["0xc8b501cbd8e69c98c535894661d25839eb035b096adfde2bba416f04cc7ce987"]}}';

    let ethImplStub: EthImpl;
    let poller: Poller; 
    let sandbox;

    this.beforeEach(() => {
 
        ethImplStub = sinon.createStubInstance(EthImpl);
        ethImplStub.blockNumber.returns('0x1b177b');
        ethImplStub.getLogs.returns(logs);

        poller = new Poller(ethImplStub, logger);
        
        sandbox = sinon.createSandbox();

    });

    this.afterEach(() => {
        sandbox.restore();
    });


    describe('Poller', () => {

        it('should start polling', async() => {
            ethImplStub.blockNumber.returns('0x1b177b');
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            const notifySubscriber = (tag, logs) =>{};
            ethImplStub.getLogs.returns(logs);
            const loggerSpy = sandbox.spy(logger, 'info');

            expect(poller.hasPoll(tag)).to.be.false;
            await poller.add(tag, notifySubscriber);
            expect(poller.hasPoll(tag)).to.be.true;

            expect(loggerSpy.calledTwice).to.be.true;
            expect(loggerSpy.getCall(0).args[0]).to.equal('Poller: Polling for {"event":"logs","filters":{"address":"0x23f5e49569A835d7bf9AefD30e4f60CdD570f225","topics":["0xc8b501cbd8e69c98c535894661d25839eb035b096adfde2bba416f04cc7ce987"]}}');
            expect(loggerSpy.getCall(1).args[0]).to.equal('Poller: Starting polling');            
        });

        it('should stop polling', () => {
            const loggerSpy = sandbox.spy(logger, 'info');            
            poller.remove(tag);
            
            expect(poller.isPolling()).to.be.false;
            expect(loggerSpy.getCall(0).args[0]).to.equal('Poller: No longer polling for {"event":"logs","filters":{"address":"0x23f5e49569A835d7bf9AefD30e4f60CdD570f225","topics":["0xc8b501cbd8e69c98c535894661d25839eb035b096adfde2bba416f04cc7ce987"]}}');
            expect(loggerSpy.getCall(1).args[0]).to.equal('Poller: No active polls.');
            expect(loggerSpy.getCall(2).args[0]).to.equal('Poller: Stopping polling');     
        });

        it('should poll single line of log data', async () => {
            const notifySubscriber = (tag, logs) =>{
                logger.debug(SINGLE_LINE);
                return;
            };

            ethImplStub.getLogs.returns(logs);
        
            poller.add(tag, notifySubscriber);   
            const loggerSpy = sandbox.spy(logger, 'debug');
            const poll = async() => {
                poller.poll();
            
                expect(loggerSpy.callCount).to.equal(1);
                expect(loggerSpy.getCall(0).args[0]).to.equal(FETCHING_DATA);
            };

            await poll();    
            expect(loggerSpy.getCall(1).args[0]).to.equal(SINGLE_LINE);
        });


        it('should poll an array of log data', async () => {

            const notifySubscriber = (tag, logsArray) =>{
                logger.debug(ARRAY_OF_LOGS);
                return;
            };

            ethImplStub.getLogs.returns(logsArray);
        
            poller.add(tag, notifySubscriber);   
            const loggerSpy = sandbox.spy(logger, 'debug');
            const poll = async() => {
                poller.poll();
            
                expect(loggerSpy.callCount).to.equal(1);
                expect(loggerSpy.getCall(0).args[0]).to.equal(FETCHING_DATA);                
            };

            await poll();   
            expect(loggerSpy.getCall(1).args[0]).to.equal(ARRAY_OF_LOGS);
        });
    });
});