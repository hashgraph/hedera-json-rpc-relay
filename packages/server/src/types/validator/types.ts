// SPDX-License-Identifier: Apache-2.0

export type ITypeValidation = {
  test: (param: any) => boolean;
  error: string;
};
