// src/interfaces/general.interface.ts
export interface RetryConfigInterface {
    maxRetries: number;
    initialDelay: number;
    factor: number;
    maxDelay: number;
}
