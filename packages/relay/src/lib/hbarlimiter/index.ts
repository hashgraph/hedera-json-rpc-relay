/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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
import dotenv from 'dotenv';
import findConfig from 'find-config';

export default class HbarLimit {
    private remainingBudget: number;
    private total: number;
    private duration: number;
    private reset: number;

    constructor(currentDateNow: number) {
        dotenv.config({ path: findConfig('.env') || '' });
        
        this.total = parseInt(process.env.HBAR_RATE_LIMIT_TINYBAR!);
        this.remainingBudget = this.total;
        this.duration = parseInt(process.env.HBAR_RATE_LIMIT_DURATION!);
        this.reset = currentDateNow + this.duration;
    }
    
    /**
     * Decides whether we should limit expenses, based on remaining budget.
     */
    shouldLimit(currentDateNow: number): boolean {
        if (this.shouldResetLimiter(currentDateNow)){
            this.resetLimiter(currentDateNow);
        }
        return this.remainingBudget <= 0 ? true : false;
    }

    /**
     * Add expense to the remaining budget.
     */
    addExpense(cost: number, currentDateNow: number) {
        if (this.shouldResetLimiter(currentDateNow)){
            this.resetLimiter(currentDateNow);
        }
        this.remainingBudget -= cost;
    }

    /**
     * Decides whether it should reset budget and timer.
     */
    private shouldResetLimiter(currentDateNow: number): boolean {
        return this.reset < currentDateNow ? true : false;
    }

    /**
     * Reset budget to the total allowed and reset timer to current time plus duration.
     */
    private resetLimiter(currentDateNow: number) {
        this.reset = currentDateNow + this.duration;
        this.remainingBudget = this.total;
    }
  }
  