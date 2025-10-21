# Authentication Context - Quick Start Guide

## 🚀 5-Minute Quick Start

### 1. Basic Usage

```javascript
import { useAuth } from '../hooks/useAuth';

function MyComponent() {
    const { user, isAuthenticated, login, logout } = useAuth();
    
    if (!isAuthenticated) {
        return <div>Please log in</div>;
    }
    
    return (
        <div>
            <h1>Welcome, {user.name}!</h1>
            <button onClick={logout}>Logout</button>
        </div>
    );
}
```

### 2. Login Form

```javascript
import { useAuth } from '../hooks/useAuth';
import { useState } from 'react';

function LoginForm() {
    const { login, authError, clearError } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        
        const result = await login({ email, password });
        
        if (result.success) {
            // Redirect will happen automatically
            window.location.reload();
        }
        
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit}>
            <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
            />
            <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
            />
            {authError && <p style={{color: 'red'}}>{authError}</p>}
            <button type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
            </button>
        </form>
    );
}
```

### 3. Protected Route

```javascript
import ProtectedRoute from '../components/ProtectedRoute';

// In your router
<Route path="/dashboard" element={
    <ProtectedRoute>
        <Dashboard />
    </ProtectedRoute>
} />
```

### 4. Check Auth Status

```javascript
import { useAuth } from '../hooks/useAuth';

function Header() {
    const { isAuthenticated, user } = useAuth();
    
    return (
        <header>
            {isAuthenticated ? (
                <div>Welcome, {user?.name}</div>
            ) : (
                <Link to="/login">Login</Link>
            )}
        </header>
    );
}
```

### 5. Logout Button

```javascript
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

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

## 📋 Available Properties

```javascript
const {
    // State
    user,              // Current user object
    token,             // JWT access token
    isAuthenticated,   // true/false
    loading,           // true during auth operations
    authError,         // Error message (if any)
    
    // Methods
    login,             // async (credentials) => Promise
    googleLogin,       // async (googleData) => Promise
    signup,            // async (signupData) => Promise
    logout,            // () => void
    updateUser,        // (userData) => Object
    checkAuth,         // () => boolean
    clearError,        // () => void
    getToken,          // () => string|null
} = useAuth();
```

## 🔑 Common Patterns

### Pattern 1: Conditional Rendering
```javascript
const { isAuthenticated, loading } = useAuth();

if (loading) return <Spinner />;
if (!isAuthenticated) return <LoginPrompt />;
return <MainContent />;
```

### Pattern 2: Redirect After Login
```javascript
const { login, isAuthenticated } = useAuth();
const navigate = useNavigate();

useEffect(() => {
    if (isAuthenticated) {
        navigate('/dashboard');
    }
}, [isAuthenticated, navigate]);
```

### Pattern 3: Show User Info
```javascript
const { user } = useAuth();

<div>
    <img src={user?.profilePic} alt={user?.name} />
    <span>{user?.email}</span>
</div>
```

### Pattern 4: Handle Auth Errors
```javascript
const { login, authError, clearError } = useAuth();

const handleLogin = async () => {
    clearError(); // Clear previous errors
    const result = await login(credentials);
    
    if (!result.success) {
        alert(result.error);
    }
};
```

### Pattern 5: Loading State
```javascript
const { loading } = useAuth();

<button disabled={loading}>
    {loading ? 'Processing...' : 'Submit'}
</button>
```

## 🎯 Real-World Examples

### Complete Login Page
```javascript
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Login() {
    const { login, isAuthenticated, authError, clearError } = useAuth();
    const navigate = useNavigate();
    const [credentials, setCredentials] = useState({ 
        email: '', 
        password: '' 
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) navigate('/');
    }, [isAuthenticated, navigate]);

    const handleChange = (e) => {
        setCredentials({
            ...credentials,
            [e.target.name]: e.target.value
        });
        clearError(); // Clear errors as user types
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        const result = await login(credentials);
        
        if (result.success) {
            window.location.reload(); // Refresh to load user data
        }
        
        setIsSubmitting(false);
    };

    return (
        <div className="login-container">
            <h1>Login</h1>
            <form onSubmit={handleSubmit}>
                <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    value={credentials.email}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    required
                />
                <input
                    name="password"
                    type="password"
                    placeholder="Password"
                    value={credentials.password}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    required
                />
                {authError && (
                    <div className="error">{authError}</div>
                )}
                <button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Logging in...' : 'Login'}
                </button>
            </form>
        </div>
    );
}

export default Login;
```

### Dashboard with User Info
```javascript
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

function Dashboard() {
    const { user, isAuthenticated, logout, loading } = useAuth();
    const navigate = useNavigate();

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" />;
    }

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="dashboard">
            <header>
                <h1>Dashboard</h1>
                <div className="user-info">
                    <img src={user?.profilePic} alt={user?.name} />
                    <span>{user?.name}</span>
                    <button onClick={handleLogout}>Logout</button>
                </div>
            </header>
            <main>
                <h2>Welcome back, {user?.firstName}!</h2>
                <p>Email: {user?.email}</p>
                <p>Profile ID: {user?.profile}</p>
            </main>
        </div>
    );
}

export default Dashboard;
```

## ⚠️ Common Mistakes

### ❌ Don't: Access localStorage directly
```javascript
// Bad
const user = JSON.parse(localStorage.getItem('user'));
```

### ✅ Do: Use the auth context
```javascript
// Good
const { user } = useAuth();
```

---

### ❌ Don't: Manually manage tokens
```javascript
// Bad
const token = localStorage.getItem('token');
```

### ✅ Do: Use getToken from context
```javascript
// Good
const { getToken } = useAuth();
const token = getToken();
```

---

### ❌ Don't: Forget to handle loading states
```javascript
// Bad
const { user } = useAuth();
return <div>{user.name}</div>; // Might be null!
```

### ✅ Do: Check loading and auth status
```javascript
// Good
const { user, loading, isAuthenticated } = useAuth();
if (loading) return <Spinner />;
if (!isAuthenticated) return <Login />;
return <div>{user.name}</div>;
```

---

### ❌ Don't: Use useAuth outside AuthProvider
```javascript
// Bad - in a component outside AuthProvider
const { user } = useAuth(); // Will throw error!
```

### ✅ Do: Ensure AuthProvider wraps your app
```javascript
// Good - in App.js
<AuthProvider>
    <YourApp />
</AuthProvider>
```

## 🆘 Troubleshooting

### Issue: "useAuth must be used within an AuthProvider"
**Fix**: Wrap your app with `<AuthProvider>` in App.js

### Issue: User data is null
**Fix**: Check `loading` state before accessing user data

### Issue: Not redirecting after login
**Fix**: Use `window.location.reload()` or check redirect logic

### Issue: Token expired error
**Fix**: The system handles this automatically, but check console for errors

## 📚 Learn More

- **Full Documentation**: `AUTH_CONTEXT_README.md`
- **Implementation**: `web/src/contexts/AuthContext.js`
- **Examples**: `web/src/pages/Login.js`, `web/src/pages/SignUp.js`

## 💡 Tips

1. Always check `loading` before rendering auth-dependent content
2. Use `clearError()` when user starts typing to clear error messages
3. The context automatically handles token refresh
4. Use `ProtectedRoute` for any route that requires authentication
5. Call `logout()` before navigating to the login page

---

**That's it!** You're ready to use the new authentication system. 🎉

