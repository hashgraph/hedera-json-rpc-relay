/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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

import ws from 'k6/ws';

const errorField = 'error';
const resultField = 'result';

const isDebugMode = __ENV['DEBUG_MODE'] === 'true';

let requestId = 1;

function getPayLoad(methodName, paramInput = []) {
  return JSON.stringify({
    id: requestId++,
    jsonrpc: '2.0',
    method: methodName,
    params: paramInput,
  });
}

function connectToWebSocket(url, methodName, params = []) {
  return ws.connect(url, {}, (socket) => {
    socket.on('open', () => {
      const message = getPayLoad(methodName, params);
      if (isDebugMode) {
        console.log('Connected, sending request: ' + message);
      }
      socket.send(message);

      socket.on('message', (message) => {
        if (isDebugMode) {
          console.log('Received response: ' + message);
        }
        socket.close();
      });
    });

    socket.on('close', function () {
      if (isDebugMode) {
        console.log('Disconnected');
      }
    });

    socket.on('error', (e) => {
      if (isDebugMode) {
        console.error('Received WebSocketError:', e);
      }
    });
  });
}

function isNonErrorResponse(response) {
  try {
    if (response.status !== 200) {
      return false;
    }
    const body = JSON.parse(response.body);
    return body.hasOwnProperty(resultField) && !body.hasOwnProperty(errorField);
  } catch (e) {
    return false;
  }
}

function isErrorResponse(response) {
  try {
    if (response.status === 200) {
      return false;
    }
    const body = JSON.parse(response.body);
    return body.hasOwnProperty(errorField) && !body.hasOwnProperty(resultField);
  } catch (e) {
    return false;
  }
}

export { connectToWebSocket, isNonErrorResponse, isErrorResponse };
