import { randomBytes } from "node:crypto";
export const getRandomBytesAsync = jest.fn(async (count: number) => new Uint8Array(randomBytes(count)));
