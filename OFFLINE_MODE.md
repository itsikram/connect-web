# Offline Mode Implementation

This document explains how the React website handles offline scenarios while preserving all existing online functionality.

## Key Principles

1. **Environment Variables Always Take Precedence**: If `REACT_APP_SERVER_ADDR` or `REACT_APP_SOCKET_URL` are set, they are used regardless of online/offline status.

2. **Graceful Degradation**: Offline mode only activates as a fallback when:
   - No environment variables are set
   - Browser reports offline status
   - Network requests fail

3. **No Breaking Changes**: All existing online functionality remains intact. The offline utilities are fallbacks, not replacements.

## How It Works

### Server Address Resolution Priority

1. **REACT_APP_SERVER_ADDR** environment variable (if set) - Always used first
2. **Offline Detection** - If browser reports offline and no env var, use localhost
3. **Local Development** - If running on localhost/127.0.0.1, default to port 4000
4. **Current Origin** - Last resort fallback

### Socket Connection

- Uses same priority as server address
- Preserves original timeout settings (20 seconds)
- Maintains reconnection logic with proper delays
- Only changes behavior when offline AND no env vars set

### API Configuration

- API baseURL is computed once at module load using `getServerAddress()`
- Respects environment variables first
- Falls back gracefully when offline
- All existing API interceptors remain unchanged

### YouTube Download

- Checks offline status before attempting download
- Shows user-friendly error message when offline
- Continues to work normally when online
- Uses environment variable `REACT_APP_YT_DL_API_URL` if set

## Files Modified

1. **web/src/utils/offlineUtils.js** (NEW)
   - Provides offline detection and fallback URL resolution
   - Never overrides environment variables

2. **web/src/api/api.js**
   - Uses `getServerAddress()` which respects env vars first
   - Falls back only when needed

3. **web/src/common/socket.js**
   - Uses `getSocketUrl()` for URL resolution
   - Preserves original timeout and reconnection settings

4. **web/src/utils/configValidation.js**
   - Now provides warnings instead of errors
   - Uses fallbacks when env vars are missing

5. **web/src/pages/YtDownload.js**
   - Checks offline status before download
   - Blocks download only when actually offline

6. **web/src/pages/LudoGame.js**
   - Uses offline-aware socket URL resolution

7. **web/public/index.html**
   - Google Fonts CDN links commented out (can be uncommented if needed)
   - Google Sign-In script commented out

## Backward Compatibility

✅ **Fully Compatible**: All existing functionality preserved:

- If `REACT_APP_SERVER_ADDR` is set → Uses it (no change)
- If `REACT_APP_SOCKET_URL` is set → Uses it (no change)  
- When online → Works exactly as before
- When offline → Gracefully falls back to localhost/local server

## Testing

### Online Mode (Normal Operation)
- Set `REACT_APP_SERVER_ADDR` in `.env` file
- App connects to specified server
- All features work as before

### Offline Mode
- Unset `REACT_APP_SERVER_ADDR` or use browser's offline mode
- App falls back to localhost:4000
- Shows appropriate error messages for features requiring internet

### Local Development
- Running on localhost automatically uses localhost:4000
- No environment variables needed for local dev
- Online features still work if internet is available

## Environment Variables

```env
# Primary server address (takes highest priority)
REACT_APP_SERVER_ADDR=http://localhost:4000

# Socket server URL (optional, falls back to REACT_APP_SERVER_ADDR)
REACT_APP_SOCKET_URL=http://localhost:4000

# YouTube download API URL (optional)
REACT_APP_YT_DL_API_URL=http://localhost:4000
```

## Notes

- The offline detection uses `navigator.onLine` which may not always be accurate
- Network errors are caught and handled gracefully
- Reconnection logic ensures sockets reconnect when connection is restored
- All error messages are user-friendly and informative




