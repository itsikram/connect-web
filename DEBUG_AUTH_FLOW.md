# 🔍 Authentication Flow Debug Guide

## The Problem We're Seeing

After successful login, API requests fail with "jwt must be provided" even though the token was stored.

```
✅ Login Success - Token stored
... navigate to home ...
🔍 Token from localStorage: MISSING! ❌
```

## Root Cause Analysis

### The Actual Flow:

```
1. User logs in
   ↓
2. Token stored in localStorage as 'user'
   ✅ localStorage.setItem('user', JSON.stringify({accessToken: "..."}))
   ↓
3. Navigate to '/'
   ↓
4. App.js renders
   ↓
5. AuthProvider starts mounting
   ↓
6. AuthProvider.initializeAuth() starts (ASYNC!)
   - Reads from localStorage
   - Sets state (setToken, setUser, setIsAuthenticated)
   - But this takes time...
   ↓
7. MEANWHILE, Main.js (child) also mounts
   ↓
8. Main.js useEffects fire IMMEDIATELY
   - if (!profileId || !token || !isAuthenticated) return
   - At this point: token=null, isAuthenticated=false (still initializing!)
   - Should return early ✅
   ↓
9. BUT ALSO, ProtectedRoute is checking
   - isAuthenticated is still false
   - Starts redirect to /login
   ↓
10. Race condition!
    - Some API calls slip through before redirect
    - They run BEFORE token is in context
    - Interceptor reads localStorage directly
    - But finds... what?
```

## The Mystery: Why is localStorage Empty?

### Hypothesis 1: Token Never Actually Stored
**Test**: Right after login, before navigation, run:
```javascript
localStorage.getItem('user')
```

**Expected**: Should return JSON string with accessToken
**If null**: Token storage failed

### Hypothesis 2: Token Cleared on Navigation
**Test**: Add this to AuthContext logout:
```javascript
console.log('🚪 Logout called from:', new Error().stack);
```

**Expected**: Should NOT see this after login
**If you do**: Something is calling logout after login

### Hypothesis 3: Wrong Key Being Used
**Test**: Check all localStorage keys:
```javascript
Object.keys(localStorage).forEach(key => {
    console.log(key, localStorage.getItem(key));
});
```

**Expected**: Should see 'user' key with token
**If different key**: Key mismatch somewhere

### Hypothesis 4: Timing - Read Before Write Completes
**Test**: The 100ms delay should fix this
```javascript
await new Promise(resolve => setTimeout(resolve, 100));
```

**Expected**: Should work now
**If still fails**: Not a timing issue

## 🧪 Step-by-Step Testing

### Test 1: Verify Storage After Login

1. Open DevTools Console
2. Clear everything:
   ```javascript
   localStorage.clear();
   ```
3. Login with credentials
4. **IMMEDIATELY** (before any navigation) run:
   ```javascript
   const stored = localStorage.getItem('user');
   console.log('Stored value:', stored);
   console.log('Parsed:', JSON.parse(stored));
   ```

**What to look for:**
- ✅ Should see full user object with accessToken
- ❌ If null/undefined: Token never stored
- ❌ If '{}': Empty object stored
- ❌ If no accessToken: Wrong data structure

### Test 2: Verify Storage Persists

1. After login succeeds, run:
   ```javascript
   setInterval(() => {
       const user = localStorage.getItem('user');
       console.log('Still there?', !!user, user?.substring(0, 50));
   }, 500);
   ```
2. Watch console as page navigates
3. See if token disappears at any point

**What to look for:**
- ✅ Token should stay constant
- ❌ If disappears: Something is clearing it
- ❌ If changes: Something is modifying it

### Test 3: Check Interceptor Timing

Add to `web/src/api/api.js`:
```javascript
api.interceptors.request.use((config) => {
    const user = localStorage.getItem("user");
    console.log('🔍 Interceptor fired:');
    console.log('  - URL:', config.url);
    console.log('  - Has user key:', !!user);
    console.log('  - User value:', user?.substring(0, 100));
    
    if (user) {
        const parsed = JSON.parse(user);
        console.log('  - Has accessToken:', !!parsed.accessToken);
        console.log('  - Token value:', parsed.accessToken?.substring(0, 30));
    }
    
    // Rest of interceptor...
});
```

**What to look for:**
- ✅ user should be truthy
- ✅ parsed.accessToken should exist
- ❌ If either null: Token not in storage when request made

### Test 4: Check AuthContext Initialization

Add to `AuthContext.js` initializeAuth:
```javascript
const initializeAuth = useCallback(() => {
    console.log('🔄 AuthContext initializing...');
    console.log('  - localStorage user:', !!localStorage.getItem(AUTH_STORAGE_KEY));
    
    try {
        const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
        console.log('  - Stored user value:', storedUser?.substring(0, 100));
        
        if (storedUser && storedUser !== '{}') {
            const userData = JSON.parse(storedUser);
            console.log('  - Parsed user:', {
                hasAccessToken: !!userData.accessToken,
                hasProfile: !!userData.profile
            });
            // ... rest
        }
    } catch (error) {
        console.error('❌ Init error:', error);
    } finally {
        console.log('✅ AuthContext initialized');
        setLoading(false);
    }
}, []);
```

**What to look for:**
- ✅ Should see "AuthContext initializing"
- ✅ Should see token in localStorage
- ✅ Should see successful parse
- ❌ If any step fails: Problem in that step

## 🎯 Most Likely Causes

Based on the symptoms, ranked by probability:

### 1. **Race Condition** (90% likely)
Components mount and make API calls before AuthContext finishes initializing.

**Fix**: Already implemented - check for isAuthenticated before API calls

**Verify**: Should see "⏳ Waiting for auth..." logs

### 2. **Redirect Interference** (5% likely)
Protected Route redirects to login before token can be used.

**Fix**: Ensure loading state is respected

**Verify**: Should NOT see redirect while loading=true

### 3. **Storage Bug** (3% likely)
LocalStorage not working properly in browser.

**Fix**: Try sessionStorage or cookies instead

**Verify**: Test localStorage.setItem/getItem manually

### 4. **Key Mismatch** (2% likely)
Different keys used for storage and retrieval.

**Fix**: Ensure AUTH_STORAGE_KEY = 'user' everywhere

**Verify**: Search codebase for localStorage calls

## ✅ Expected Working Flow

When everything works correctly, you should see:

```
🔐 Attempting login...
📦 Login response data: {hasAccessToken: true, hasProfile: true, tokenLength: 326}
✅ Login Success - Stored in localStorage
✅ Token: eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...
✅ Can read back: true
✅ Parsed token matches: true
✅ Login successful, navigating to home...
✅ Token verified in localStorage before navigation: true

🔄 AuthContext initializing...
  - localStorage user: true
  - Stored user value: {"accessToken":"eyJhbG...
  - Parsed user: {hasAccessToken: true, hasProfile: true}
✅ AuthContext initialized

⏳ Waiting for auth... {profileId: true, token: true, isAuthenticated: true}
✅ Fetching initial data with auth

🔍 Interceptor fired:
  - URL: message/chatList
  - Has user key: true
  - Has accessToken: true
  - Token value: eyJhbGciOiJIUzI1NiIsInR5cCI6...

SUCCESS! All API calls include token.
```

## 🔧 Quick Fix to Test

Try adding this to Login.js after successful login:

```javascript
if (result.success) {
    console.log('✅ Login successful');
    
    // Force a page reload to ensure clean state
    window.location.href = '/';
    
    // OR use a longer delay
    // await new Promise(resolve => setTimeout(resolve, 500));
    // navigate('/');
}
```

## 📞 Report Back

After testing, report:
1. What does `localStorage.getItem('user')` show after login?
2. Do you see "🔄 AuthContext initializing..." in console?
3. Do you see "⏳ Waiting for auth..." or do API calls fire immediately?
4. Does Test 2 show the token disappearing?

This will tell us exactly what's happening!

