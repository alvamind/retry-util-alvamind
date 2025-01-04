// retry.test.ts
import { expect, test, mock } from "bun:test";
import { RetryUtil } from "../src/index";
import { RetryConfigInterface } from "../src/interfaces/general.interface";

const defaultConfig: RetryConfigInterface = {
  maxRetries: 3,
  initialDelay: 100,
  factor: 2,
  maxDelay: 1000,
};

test("should succeed on first attempt", async () => {
  const operation = () => Promise.resolve("success");
  const result = await RetryUtil.withRetry(operation, defaultConfig);
  expect(result).toBe("success");
});

test("should succeed after one retry", async () => {
  let attempts = 0;
  const operation = () => {
    if (attempts++ === 0) {
      throw new Error("First attempt failed");
    }
    return Promise.resolve("success");
  };
  const result = await RetryUtil.withRetry(operation, defaultConfig);
  expect(result).toBe("success");
});

test("should fail after max retries", async () => {
  const operation = () => Promise.reject(new Error("Operation failed"));
  await expect(RetryUtil.withRetry(operation, defaultConfig)).rejects.toThrow(
    "Operation failed"
  );
});

test("should respect maxDelay configuration", async () => {
  const config: RetryConfigInterface = {
    ...defaultConfig,
    maxDelay: 200,
  };
  let attempts = 0;
  const operation = () => {
    attempts++;
    return Promise.reject(new Error("Operation failed"));
  };

  const start = Date.now();
  await expect(RetryUtil.withRetry(operation, config)).rejects.toThrow();
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(1000); // Should be less than sum of max delays
});

test("should call onRetry callback for each retry", async () => {
  const onRetry = mock((attempt: number, error: Error) => { });
  const operation = () => Promise.reject(new Error("Operation failed"));

  await expect(RetryUtil.withRetry(operation, defaultConfig, onRetry)).rejects.toThrow();
  expect(onRetry).toHaveBeenCalledTimes(defaultConfig.maxRetries);
});

test("should handle zero retries configuration", async () => {
  const config: RetryConfigInterface = {
    ...defaultConfig,
    maxRetries: 0,
  };
  const operation = () => Promise.reject(new Error("Operation failed"));
  await expect(RetryUtil.withRetry(operation, config)).rejects.toThrow();
});

test("should handle async operations with varying delays", async () => {
  let attempts = 0;
  const operation = async () => {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 50));
    if (attempts < 2) throw new Error("Not ready");
    return "success";
  };

  const result = await RetryUtil.withRetry(operation, defaultConfig);
  expect(result).toBe("success");
  expect(attempts).toBe(2);
});

test("should apply exponential backoff", async () => {
  const timestamps: number[] = [];
  const operation = () => {
    timestamps.push(Date.now());
    return Promise.reject(new Error("Operation failed"));
  };

  await expect(RetryUtil.withRetry(operation, defaultConfig)).rejects.toThrow();

  for (let i = 1; i < timestamps.length; i++) {
    const diff = timestamps[i] - timestamps[i - 1];
    expect(diff).toBeGreaterThan(defaultConfig.initialDelay * Math.pow(defaultConfig.factor, i - 1) - 50);
  }
});

test("should handle non-Error throws", async () => {
  const operation = () => Promise.reject("string error");
  await expect(RetryUtil.withRetry(operation, defaultConfig)).rejects.toThrow();
});

test("should preserve error instance type", async () => {
  class CustomError extends Error {
    constructor() {
      super("Custom error");
      this.name = "CustomError";
    }
  }

  const operation = () => Promise.reject(new CustomError());
  try {
    await RetryUtil.withRetry(operation, defaultConfig);
  } catch (error) {
    expect(error).toBeInstanceOf(CustomError);
  }
});
