import PGCache from "@/database/pg_cache";

class CacheService {
  async get(key: string): Promise<any> {
    const cache = await PGCache.findOne({ where: { key } });
    return cache?.data;
  }

  async set(key: string, data: object) {
    await PGCache.upsert({ key, data });
  }
}

const cacheService = new CacheService();

async function setLastFetchForRepo(repoId: string, timestamp: Date) {
  const key = `last_fetch_for_repo_${repoId}`;
  await cacheService.set(key, { timestamp: timestamp.toISOString() });
}

async function getLastFetchForRepo(repoId: string) {
  const key = `last_fetch_for_repo_${repoId}`;
  const cache = await cacheService.get(key);

  const ts = cache?.timestamp as string;

  return ts ? new Date(ts) : null;
}

export {
  setLastFetchForRepo,
  getLastFetchForRepo,
}
