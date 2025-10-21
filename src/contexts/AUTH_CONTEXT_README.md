# Authentication Context System

## Overview
This application now uses React Context API for authentication management instead of Redux. This provides a more centralized, efficient, and maintainable authentication system.

## Features

### ✅ Centralized Authentication State
- Single source of truth for authentication
- No more mixed Redux/localStorage approach
- Clean separation of concerns

### ✅ Automatic Token Management
- Token stored securely in context and localStorage
- Automatic token refresh before expiration
- Token expiration checking with JWT decoding

### ✅ Comprehensive Auth Methods
- **Login**: Standard email/password authentication
- **Google OAuth**: Google Sign-In integration
- **Signup**: New user registration
- **Logout**: Complete session cleanup
- **Token Refresh**: Automatic token renewal

### ✅ Protected Routes
- Easy-to-use `ProtectedRoute` component
- Automatic redirect to login for unauthenticated users
- Loading states during authentication check
- Remembers attempted route for post-login redirect

## File Structure

```
web/src/
├── contexts/
│   ├── AuthContext.js          # Main authentication context provider
│   └── AUTH_CONTEXT_README.md  # This file
├── hooks/
│   └── useAuth.js              # Custom hook to access auth context
├── api/
│   ├── api.js                  # Legacy API (backward compatibility)
│   └── apiWithAuth.js          # New API with auth context integration
├── pages/
│   ├── Login.js                # Updated to use AuthContext
│   ├── SignUp.js               # Updated to use AuthContext
│   └── Main.js                 # Updated to use AuthContext
├── components/
│   └── ProtectedRoute.js       # Updated to use AuthContext
└── App.js                      # Wrapped with AuthProvider
```

## Usage

### 1. Using Authentication in Components

```javascript
import { useAuth } from '../hooks/useAuth';

function MyComponent() {
    const { 
        user,           // Current user data
        token,          // Access token
        isAuthenticated,// Boolean authentication status
        loading,        // Loading state
        authError,      // Any authentication errors
        login,          // Login function
        logout,         // Logout function
        signup,         // Signup function
        googleLogin,    // Google OAuth login
        updateUser,     // Update user data
        checkAuth,      // Check if authenticated
        clearError      // Clear error messages
    } = useAuth();

    // Use auth methods and state...
}
```

### 2. Login Example

```javascript
import { useAuth } from '../hooks/useAuth';

function LoginComponent() {
    const { login, authError, isAuthenticated } = useAuth();
    const [credentials, setCredentials] = useState({ email: '', password: '' });

    const handleLogin = async (e) => {
        e.preventDefault();
        const result = await login(credentials);
        
        if (result.success) {
            // Redirect or show success
        } else {
            // Handle error: result.error
        }
    };

    return (
        // Your login form JSX
    );
}
```

### 3. Protected Routes

```javascript
import ProtectedRoute from '../components/ProtectedRoute';

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            
            {/* Protected routes */}
            <Route path="/dashboard" element={
                <ProtectedRoute>
                    <Dashboard />
                </ProtectedRoute>
            } />
        </Routes>
    );
}
```

### 4. Logout

```javascript
import { useAuth } from '../hooks/useAuth';

function LogoutButton() {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return <button onClick={handleLogout}>Logout</button>;
}
```

### 5. Google OAuth Login

```javascript
import { useAuth } from '../hooks/useAuth';

function GoogleLoginComponent() {
    const { googleLogin } = useAuth();

    const handleGoogleSignIn = async (googleResponse) => {
        const { credential } = googleResponse;
        const payload = JSON.parse(atob(credential.split('.')[1]));
        
        const googleData = {
            googleId: payload.sub,
            email: payload.email,
            name: payload.name,
            photo: payload.picture,
            familyName: payload.family_name,
            givenName: payload.given_name,
            idToken: credential
        };

        const result = await googleLogin(googleData);
        
        if (result.success) {
            // Successfully logged in
        }
    };

    return (
        // Your Google Sign-In button
    );
}
```

## AuthContext API Reference

### State Properties

| Property | Type | Description |
|----------|------|-------------|
| `user` | Object \| null | Current authenticated user data |
| `token` | String \| null | JWT access token |
| `refreshToken` | String \| null | JWT refresh token |
| `isAuthenticated` | Boolean | Whether user is authenticated |
| `loading` | Boolean | Loading state during auth operations |
| `authError` | String \| null | Any authentication error message |

### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `login` | `credentials: { email, password }` | `Promise<{ success, data?, error? }>` | Authenticate user with credentials |
| `googleLogin` | `googleData: Object` | `Promise<{ success, data?, error? }>` | Authenticate with Google OAuth |
| `signup` | `signupData: Object` | `Promise<{ success, data?, error? }>` | Register new user |
| `logout` | - | `void` | Log out user and clear session |
| `updateUser` | `userData: Object` | `{ success, error? }` | Update user profile data |
| `getToken` | - | `String \| null` | Get current access token |
| `checkAuth` | - | `Boolean` | Check if user is authenticated |
| `clearError` | - | `void` | Clear authentication errors |
| `refreshToken` | - | `Promise<void>` | Manually refresh access token |

## Token Refresh Strategy

The AuthContext automatically manages token refresh:

1. **On Mount**: Checks if stored token is valid
2. **Scheduled Refresh**: Automatically refreshes token 5 minutes before expiration
3. **On Demand**: Refresh can be triggered manually if needed
4. **Failure Handling**: Automatically logs out user if refresh fails

## Migration from Redux

### Before (Redux)
```javascript
// In component
import { useDispatch, useSelector } from 'react-redux';
import { setLogin, logOut } from '../services/actions/authActions';

const dispatch = useDispatch();
const { token } = useSelector(state => state.auth);

// Login
dispatch(setLogin(token));

// Logout
dispatch(logOut());
```

### After (Context)
```javascript
// In component
import { useAuth } from '../hooks/useAuth';

const { token, login, logout, isAuthenticated } = useAuth();

// Login
await login(credentials);

// Logout
logout();
```

## Security Features

1. **JWT Token Management**: Automatic token expiration checking
2. **Secure Storage**: Tokens stored in localStorage with context management
3. **Token Refresh**: Automatic refresh before expiration
4. **Session Cleanup**: Complete cleanup on logout
5. **Protected Routes**: Automatic redirect for unauthenticated access
6. **Error Handling**: Comprehensive error handling for all auth operations

## Best Practices

1. ✅ Always use `useAuth` hook to access authentication
2. ✅ Wrap protected routes with `ProtectedRoute` component
3. ✅ Handle loading states during authentication operations
4. ✅ Clear errors when user makes corrections
5. ✅ Use `checkAuth()` to verify authentication status
6. ✅ Always call `logout()` before manual navigation to login

## Troubleshooting

### Issue: "useAuth must be used within an AuthProvider"
**Solution**: Ensure your component tree is wrapped with `<AuthProvider>` in App.js

### Issue: Token expired but not logging out
**Solution**: The system automatically handles this. Check browser console for errors.

### Issue: Login successful but not redirecting
**Solution**: Ensure you're checking `result.success` and handling navigation properly

### Issue: User data not available immediately
**Solution**: Use the `loading` state to show a loading indicator while auth initializes

## Example: Complete Login Page

```javascript
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Login() {
    const { login, isAuthenticated, authError, clearError, loading } = useAuth();
    const navigate = useNavigate();
    const [credentials, setCredentials] = useState({ email: '', password: '' });
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/');
        }
    }, [isAuthenticated, navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCredentials(prev => ({ ...prev, [name]: value }));
        
        // Clear errors
        if (localError || authError) {
            setLocalError('');
            clearError();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const result = await login(credentials);
        
        if (!result.success) {
            setLocalError(result.error);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                name="email"
                type="email"
                value={credentials.email}
                onChange={handleChange}
                placeholder="Email"
                disabled={loading}
            />
            <input
                name="password"
                type="password"
                value={credentials.password}
                onChange={handleChange}
                placeholder="Password"
                disabled={loading}
            />
            {(localError || authError) && (
                <p style={{ color: 'red' }}>{localError || authError}</p>
            )}
            <button type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
            </button>
        </form>
    );
}

export default Login;
```

## Support

For questions or issues with the authentication system, refer to:
- `web/src/contexts/AuthContext.js` - Main implementation
- `web/src/hooks/useAuth.js` - Hook implementation
- `web/src/components/ProtectedRoute.js` - Route protection

