// https://www.jsonrpc.org/specification

// Base interface for all messages from the client to the server. A Notification message does not define an id.
// Such messages will get no response from the server.
export interface Notify {
    jsonrpc: "2.0";
    method: string;
    params?: Record<string, unknown> | Array<Record<string, unknown>>;
}

// A subtype of Notify that includes an id. This id will be included in responses from the server.
export interface Request extends Notify {
    id?: string|number;
}

export interface Error {
    code: number;
    message: string;
    data?: unknown;
}

export interface Response<T> {
    id?: string|number;
    jsonrpc: "2.0";
    result?: T;
    error?: Error;
}

const PARSE_ERROR:Error = {
    code: -32700,
    message: "Parse error"
}

const INVALID_REQUEST:Error = {
    code: -32600,
    message: "Invalid Request"
}

export const METHOD_NOT_FOUND:Error = {
    code: -32601,
    message: "Method not found"
}

const INVALID_PARAMS:Error = {
    code: -32602,
    message: "Invalid params"
}

const INTERNAL_ERROR:Error = {
    code: -32603,
    message: "Internal error"
}

const SERVER_ERROR:Error = {
    code: -32000, // -32000 to -32099. Reserved for app.
    message: "Server error"
}


