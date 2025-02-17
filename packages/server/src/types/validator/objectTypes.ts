// SPDX-License-Identifier: Apache-2.0

export type IObjectSchema = {
  name: string;
  properties: {
    [key: string]: IObjectParamSchema;
  };
  failOnEmpty?: boolean;
  failOnUnexpectedParams?: boolean;
  deleteUnknownProperties?: boolean;
};

export type IObjectParamSchema = {
  type: string;
  nullable: boolean;
  required?: boolean;
};

export interface IObjectValidation<T extends object = any> {
  get object(): T;
  validate(): boolean;
  name(): string;
  checkForUnexpectedParams(): void;
  deleteUnknownProperties(): void;
}
