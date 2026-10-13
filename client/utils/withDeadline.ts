import { API_TIMEOUT_MS } from "@/constants/appConfig";

/** Bounds the caller's wait; persistence queues retain ownership of late writes. */
export function withDeadline<T>(
  operation: Promise<T>,
  message: string,
  milliseconds = API_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export const STORAGE_TIMEOUT_MS = 10_000;
