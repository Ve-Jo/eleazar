async function getFromCache(_key: string): Promise<null> {
  return null;
}

async function setCache(
  _key: string,
  _value: unknown,
  _ttl: number | null = null
): Promise<boolean> {
  return true;
}

async function invalidateCache(_keys: string[]): Promise<boolean> {
  return true;
}

async function deleteFromCache(_key: string): Promise<boolean> {
  return true;
}

export { getFromCache, setCache, invalidateCache, deleteFromCache };
