const { getRedis } = require('../config/redis');

const TTL = parseInt(process.env.CACHE_TTL_SECONDS || '60', 10);

/**
 * Key scheme:
 *   tasks:assignee:<assigneeId>:<queryHash>   — cached task list
 *   tasks:org:<org>:*                          — all tasks for an org (for ADMIN/MANAGER invalidation)
 *
 * For MEMBER queries the assignee is always req.user._id, so the key is tight.
 * For ADMIN/MANAGER queries the assignee may be a filter param or absent — we
 * use the org-level pattern on invalidation to be safe.
 */

const buildKey = (assigneeId, query) => {
  const { page = 1, limit = 20, status = '', priority = '' } = query;
  return `tasks:assignee:${assigneeId}:${status}:${priority}:p${page}:l${limit}`;
};

const buildOrgPattern = (org) => `tasks:org:${org}:*`;

// Encode org into a separate index key so we can do pattern invalidation
// without a KEYS scan on production (KEYS blocks the event loop).
// We maintain a Redis Set per org that holds all live cache keys for that org.
const orgSetKey = (org) => `tasks:org:${org}:__keys__`;

const get = async (key) => {
  try {
    const redis = getRedis();
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null; // cache miss on error — never block the request
  }
};

const set = async (key, data, org) => {
  try {
    const redis = getRedis();
    await redis.setex(key, TTL, JSON.stringify(data));
    // Track key in the org set (set TTL slightly longer so it outlives the key)
    await redis.sadd(orgSetKey(org), key);
    await redis.expire(orgSetKey(org), TTL + 10);
  } catch {
    // silent — caching is best-effort
  }
};

/**
 * Invalidate all cached task lists that could be affected by a task mutation.
 *
 * Strategy:
 * - If the task has an assignee → delete their specific cache keys.
 * - Always delete the org-level set entries so ADMIN/MANAGER list caches
 *   (which may not be keyed to a single assignee) are also cleared.
 */
const invalidate = async (assigneeId, org) => {
  try {
    const redis = getRedis();
    const pipeline = redis.pipeline();

    // Invalidate by assignee prefix (catches all page/filter combos for that user)
    if (assigneeId) {
      const assigneePattern = `tasks:assignee:${assigneeId}:*`;
      const keys = await redis.keys(assigneePattern);
      if (keys.length) pipeline.del(...keys);
    }

    // Invalidate all keys tracked in the org set (covers ADMIN/MANAGER list caches)
    const orgKeys = await redis.smembers(orgSetKey(org));
    if (orgKeys.length) pipeline.del(...orgKeys);
    pipeline.del(orgSetKey(org));

    await pipeline.exec();
  } catch {
    // silent
  }
};

module.exports = { buildKey, get, set, invalidate };
