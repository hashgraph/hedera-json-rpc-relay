// SPDX-License-Identifier: Apache-2.0

export type IMethodValidation = {
  [index: number]: IMethodParamSchema;
};

export type IMethodParamSchema = {
  type: string;
  required?: boolean;
};
