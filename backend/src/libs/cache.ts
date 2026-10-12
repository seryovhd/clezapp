import Redis from "ioredis";
import { REDIS_URI_CONNECTION } from "../config/redis";
import * as crypto from "crypto";

const redis = new Redis(REDIS_URI_CONNECTION);

function encryptParams(params: any) {
  const str = JSON.stringify(params);
  return crypto.createHash("sha256").update(str).digest("base64");
}

export function setFromParams(
  key: string,
  params: any,
  value: string,
  option?: "EX" | "PX" | "NX" | "XX",
  optionValue?: number
) {
  const finalKey = `${key}:${encryptParams(params)}`;
  return set(finalKey, value, option, optionValue);
}

export function getFromParams(key: string, params: any) {
  const finalKey = `${key}:${encryptParams(params)}`;
  return get(finalKey);
}

export function delFromParams(key: string, params: any) {
  const finalKey = `${key}:${encryptParams(params)}`;
  return del(finalKey);
}

export function set(
  key: string,
  value: string,
  option?: "EX" | "PX" | "NX" | "XX",
  optionValue?: number
) {
  const args: (string | number)[] = [key, value];
  if (option && optionValue !== undefined) {
    args.push(option, optionValue);
  } else if (option) {
    args.push(option);
  }

  // @ts-ignore: los tipos de ioredis no cubren todos los casos posibles
  return redis.set(...args);
}

export function get(key: string) {
  return redis.get(key);
}

export function getKeys(pattern: string) {
  return redis.keys(pattern);
}

export function del(key: string) {
  return redis.del(key);
}

export async function delFromPattern(pattern: string) {
  const all = await getKeys(pattern);
  for (let item of all) {
    await del(item);
  }
}

export const cacheLayer = {
  set,
  setFromParams,
  get,
  getFromParams,
  getKeys,
  del,
  delFromParams,
  delFromPattern
};
