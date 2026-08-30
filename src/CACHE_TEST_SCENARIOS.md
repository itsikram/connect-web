# Post Caching System - Test Scenarios

## Scenario 1: First Visit (Cold Start)
**Expected behavior:**
1. User visits home page for the first time
2. No posts in cache yet
3. Component shows loading skeleton while fetching from API
4. API returns 10 posts
5. Posts displayed and saved to cache with timestamp
6. Browser storage shows `cached_home_posts` and `home_posts_timestamp`

**How to verify:**
```javascript
// In browser console:
localStorage.getItem('cached_home_posts') // Should show JSON array of posts
localStorage.getItem('home_posts_timestamp') // Should show current timestamp
```

---

## Scenario 2: Return Visit (Within 30 min)
**Expected behavior:**
1. User leaves home page and returns within 30 minutes
2. Component mounts → immediately loads posts from cache
3. Shows cached posts while fetching fresh data
4. API returns posts (may have new ones)
5. If new posts exist → notification shows "🆕 New Posts! X new posts available"
6. New posts added to cache and Redux state
7. Notification auto-hides after 5 seconds

**How to verify:**
```javascript
// Open DevTools → Console to see logs:
// "📦 Loaded posts from cache: 10"
// "📦 Updated cache with fresh posts"
// "🆕 New posts detected: 2"
```

---

## Scenario 3: Stale Cache (After 30 min)
**Expected behavior:**
1. User's cache is older than 30 minutes
2. `getCachedPosts()` returns `null` (expired)
3. Component shows loading skeleton
4. Fetches fresh posts from API
5. New posts saved to cache (new timestamp)
6. No notification (first load after expiry)

**How to simulate:**
```javascript
// In browser console, set cache to old timestamp:
localStorage.setItem('home_posts_timestamp', String(Date.now() - 31*60*1000));
// Reload page - should show skeleton, not cached posts
```

---

## Scenario 4: New Posts Notification
**Expected behavior:**
1. Start with cache: posts A, B, C
2. Refresh page → loads cached A, B, C immediately
3. API returns: X (NEW), Y (NEW), A, B, C
4. Notification shows "🆕 New Posts! 2 new posts available"
5. Feed shows: X, Y, A, B, C (new first)
6. Notification dismisses automatically after 5s

**How to verify:**
- New posts appear at top of feed
- Old posts are preserved below
- No duplicate posts in feed
- Notification has close button (manual dismiss option)

---

## Scenario 5: Pagination (Scroll to bottom)
**Expected behavior:**
1. Page 1 posts loaded from cache (or API)
2. User scrolls to bottom
3. Component detects scroll and sets `loadNewPosts=true`
4. `loadData()` fetches page 2 posts (pageNumber=2)
5. **Page 2 data is NOT cached** (correct behavior)
6. Posts appended to Redux state (infinite scroll)
7. Scrolling again fetches page 3 (also not cached)

**How to verify:**
- Cache in localStorage stays same size after pagination
- Each page fetch happens fresh from API
- No cache updates in console logs for page 2+

---

## Scenario 6: Manual Refresh Button
**Expected behavior:**
1. User clicks refresh button (if exists)
2. Cache should be cleared
3. Loading skeleton shown
4. Fresh API call made for page 1
5. New posts saved to cache
6. No "new posts" notification (full refresh)

**How to verify:**
```javascript
// After refresh, check cache stats:
CacheManager.getStats()
// { cached: true, count: 10, age: 0-100ms, expiresIn: ~1800000 }
```

---

## Scenario 7: Multiple API Responses (Polling)
**Expected behavior:**
1. User leaves app idle for 5 minutes
2. Background fetch triggered (if applicable)
3. API returns posts - some duplicates, some new
4. `mergePosts()` merges without duplicates
5. Only truly new posts trigger notification
6. Cache updated with merged result

**How to verify:**
- No duplicate posts in feed
- Notification count matches new posts only
- Console shows merge operation details

---

## Scenario 8: Network Error
**Expected behavior:**
1. User navigates to home page
2. Cache exists from previous visit
3. API request fails (network error)
4. **Cached posts still visible** (graceful fallback)
5. Loading indicator stops
6. No notification shown
7. User can still browse cached posts

**How to verify:**
- Throttle network in DevTools → slow/offline
- Navigate to home page
- Cached posts visible even with network down

---

## Scenario 9: Storage Quota Exceeded
**Expected behavior:**
1. User has many cached items (storage full)
2. Cache `setCachedPosts()` fails silently
3. Error logged to console
4. API-fetched posts still display
5. App continues working without cache

**How to verify:**
- Intentionally fill localStorage:
```javascript
for (let i = 0; i < 1000; i++) {
  localStorage.setItem('test' + i, 'x'.repeat(10000));
}
// Then try refreshing home page
```
- Console should show error, but posts still load

---

## Performance Metrics

### Expected Timings:
- **Cache hit (first load)**: 0-50ms (instant)
- **API fetch**: 500-2000ms (varies by network)
- **Notification display**: <100ms after fetch complete
- **Notification auto-hide**: 5000ms ± 50ms

### Storage:
- **Per post**: ~2-3KB (depends on content)
- **Typical cache size**: 10-30KB for 10-15 posts
- **Timestamp**: 13 bytes

---

## Debug Commands

```javascript
// Check cache status:
CacheManager.getStats()
// Output: { cached: true, count: 10, age: 1234, expiresIn: 1798766, isExpired: false }

// View cached posts:
CacheManager.getCachedPosts()
// Output: [Array of 10 posts]

// Manually clear cache:
CacheManager.clearCache()

// Check time until expiry:
CacheManager.getTimeUntilExpiry()
// Output: 1798766 (ms)

// Check if cache is valid:
CacheManager.isCacheValid()
// Output: true or false
```
