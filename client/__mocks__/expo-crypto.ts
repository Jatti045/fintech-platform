import { randomBytes, randomUUID as nodeRandomUUID } from "node:crypto";
export const getRandomBytesAsync = jest.fn(async (count: number) => new Uint8Array(randomBytes(count)));
export const randomUUID = nodeRandomUUID;
