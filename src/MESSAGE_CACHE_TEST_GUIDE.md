# Message and Contact Caching - Test Guide

## Quick Test Scenarios

### Test 1: Contact List Cache Loading
**Objective**: Verify contacts load from cache on mount

**Steps:**
1. Open Message page in browser
2. Watch browser DevTools → Application → LocalStorage
3. Open browser console and run:
   ```javascript
   ContactCacheManager.getStats()
   ```
4. Close Message page
5. Reopen Message page within 30 minutes
6. Console output should show: `📦 Loaded contacts from cache: X`

**Expected Result:**
- Contacts list appears immediately without loading skeleton
- Console shows cache hit message
- Cache timestamp recent (within 30 minutes)

**Pass/Fail**: ✅ If contacts appear instantly, ❌ If loading skeleton shows

---

### Test 2: Contact Cache Expiration
**Objective**: Verify cache expires after 30 minutes

**Steps:**
1. Open Message page
2. Note the contact cache timestamp:
   ```javascript
   localStorage.getItem('message_contacts_timestamp')
   ```
3. Simulate 30+ minute expiry:
   ```javascript
   const oldTime = Date.now() - (31 * 60 * 1000);
   localStorage.setItem('message_contacts_timestamp', oldTime.toString());
   ```
4. Refresh page
5. Check if loading skeleton appears (indicates cache miss)

**Expected Result:**
- Loading skeleton shows while API fetches fresh contacts
- Console shows: `📦 Contact cache expired, clearing`
- New cache timestamp stored after fetch

**Pass/Fail**: ✅ If loading skeleton appears, ❌ If cached contacts show immediately

---

### Test 3: Message Cache on Chat Open
**Objective**: Verify messages load from cache when opening conversation

**Steps:**
1. Open Message page
2. Click on a contact to open a conversation
3. Watch console for cache load:
   ```javascript
   // Console should show:
   📦 Loaded messages from cache: X
   ```
4. Messages should appear immediately
5. Check message cache:
   ```javascript
   const userId = profile._id; // from Redux
   const friendId = params.profile; // from URL
   MessageCacheManager.getStats(userId, friendId)
   ```

**Expected Result:**
- Messages appear instantly without loading skeleton
- Console shows cache hit
- Stats show message count and cache age

**Pass/Fail**: ✅ If messages appear instantly, ❌ If loading skeleton shows

---

### Test 4: New Messages Notification
**Objective**: Verify notification when new messages arrive in API fetch

**Steps:**
1. Open a conversation
2. Let the chat load from cache
3. Send a message to yourself or have friend send one
4. Close and reopen the chat within 30 minutes
5. Watch for notification banner:
   - "🆕 New Messages! 1 new message available"
6. Banner should auto-dismiss after 5 seconds

**Expected Result:**
- Notification appears when new messages detected
- Shows correct count of new messages
- Notification dismisses automatically
- New messages visible in chat

**Pass/Fail**: ✅ If notification appears and auto-dismisses, ❌ If no notification

---

### Test 5: Multiple Conversations Cache
**Objective**: Verify each conversation has independent cache

**Steps:**
1. Open conversation with Friend A
2. Load messages from cache (or API)
3. Check cache:
   ```javascript
   const userId = profile._id;
   MessageCacheManager.getStats(userId, friendAId)
   ```
4. Switch to conversation with Friend B
5. Check this conversation's cache:
   ```javascript
   MessageCacheManager.getStats(userId, friendBId)
   ```
6. Each should have different timestamps/counts

**Expected Result:**
- Each conversation has separate cache entry
- Different cache keys for different friends
- Stats show independent data per conversation

**Pass/Fail**: ✅ If caches are independent, ❌ If same cache used

---

### Test 6: Contact List API Skip
**Objective**: Verify valid cache prevents API call

**Steps:**
1. Open DevTools → Network tab
2. Open Message page (should call `/message/chatList`)
3. Wait 5 seconds (let cache fill)
4. Close Message page
5. Reopen Message page immediately (within 30 min)
6. Watch Network tab
7. `/message/chatList` should NOT appear (cache used instead)
8. Console should show: `📦 Using cached contacts, skipping API fetch`

**Expected Result:**
- No API call made for contacts
- Console shows skip message
- Contacts load instantly from cache

**Pass/Fail**: ✅ If no API call and skip message shown, ❌ If API call made

---

### Test 7: Cache Clear Functionality
**Objective**: Verify manual cache clearing works

**Steps:**
1. Open Message page (caches contacts)
2. Clear contact cache:
   ```javascript
   ContactCacheManager.clearCache()
   ```
3. Console should show: `🗑️ All contact caches cleared`
4. Verify it's cleared:
   ```javascript
   ContactCacheManager.getCachedContacts() // Should return null
   localStorage.getItem('cached_message_contacts') // Should be null
   ```
5. Refresh page
6. Loading skeleton should appear while API fetches

**Expected Result:**
- Cache cleared successfully
- localStorage keys removed
- Next visit triggers API call
- Loading skeleton visible

**Pass/Fail**: ✅ If cache cleared and API called, ❌ If cache persists

---

### Test 8: Offline Fallback
**Objective**: Verify cached data shows when offline

**Steps:**
1. Open Message page (populate cache)
2. DevTools → Network → Throttling: "Offline"
3. Close Message page
4. Reopen Message page
5. Contacts should still display from cache
6. No API error should break the UI

**Expected Result:**
- Cached contacts visible
- No network error shown
- UI functional with cached data

**Pass/Fail**: ✅ If cached data shows offline, ❌ If UI breaks

---

### Test 9: Cache Storage Size
**Objective**: Monitor cache storage usage

**Steps:**
1. Open Message page
2. Check storage stats:
   ```javascript
   const contacts = localStorage.getItem('cached_message_contacts');
   const size = new Blob([contacts]).size;
   console.log('Contact cache size:', size, 'bytes');
   
   // Check all message caches
   let totalSize = 0;
   Object.keys(localStorage).forEach(key => {
     if (key.startsWith('cached_messages_')) {
       totalSize += new Blob([localStorage.getItem(key)]).size;
     }
   });
   console.log('Total message cache size:', totalSize, 'bytes');
   ```
3. Size should be reasonable (< 500KB total)

**Expected Result:**
- Contact cache: 50-200KB (typical)
- Message caches: 20-50KB per conversation
- Total: Under 500KB

**Pass/Fail**: ✅ If sizes reasonable, ❌ If excessively large

---

### Test 10: Notification Dismissal
**Objective**: Verify notification can be dismissed manually

**Steps:**
1. Open conversation
2. Load messages from cache
3. Simulate new messages in cache (if notification appears)
4. Click the "X" button on notification
5. Notification should disappear immediately

**Expected Result:**
- Manual dismiss works
- Notification gone
- No auto-dismiss needed if manually closed

**Pass/Fail**: ✅ If manual dismiss works, ❌ If button doesn't work

---

## Automated Test Commands

### Run in Browser Console

```javascript
// Test 1: Check all cache status
console.log('=== CACHE STATUS ===');
console.log('Contacts:', ContactCacheManager.getStats());
console.log('Profile ID:', profile._id);
console.log('Friend ID:', params.profile);
console.log('Messages:', MessageCacheManager.getStats(profile._id, params.profile));

// Test 2: Verify cache keys exist
console.log('=== LOCALSTORAGE KEYS ===');
console.log('Contact cache exists:', !!localStorage.getItem('cached_message_contacts'));
console.log('Contact timestamp exists:', !!localStorage.getItem('message_contacts_timestamp'));
console.log('Message cache exists:', !!localStorage.getItem(`cached_messages_${profile._id}_${params.profile}`));

// Test 3: Check cache validity
console.log('=== CACHE VALIDITY ===');
console.log('Contact cache valid:', ContactCacheManager.isCacheValid());
console.log('Message cache valid:', MessageCacheManager.isCacheValid(profile._id, params.profile));

// Test 4: Simulate cache expiry
console.log('=== SIMULATING EXPIRY ===');
const oldTime = Date.now() - (31 * 60 * 1000);
localStorage.setItem('message_contacts_timestamp', oldTime.toString());
console.log('Set contacts timestamp to 31 min ago');
console.log('Now isCacheValid() should return false:', !ContactCacheManager.isCacheValid());

// Test 5: Clear and verify
console.log('=== CLEARING CACHE ===');
ContactCacheManager.clearCache();
MessageCacheManager.clearAllMessageCache();
console.log('All