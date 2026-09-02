import React, { Fragment, useState, useCallback, useEffect, useRef } from "react";
import SignUP from "./SignUp";
import $ from 'jquery'
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from "react-router-dom";
import config from '../config/config.json';
import FaceCapture from "../components/face/FaceCapture";
let Login = (props) => {

    let navigate = useNavigate();
    const { login, faceLogin, googleLogin, isAuthenticated, authError, clearError } = useAuth();

    useEffect(() => {
        // Redirect if already authenticated
        if (isAuthenticated) {
            navigate('/');
        }
    }, [isAuthenticated, navigate]);
    
    let showSignup = (e) => {
        return navigate('/signup')
    }

    let [inputs, setInputs] = useState({})
    let [isLoggingIn, setIsLoggingIn] = useState(false)
    let [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false)
    let [showFaceLogin, setShowFaceLogin] = useState(false)
    const googleButtonRef = useRef(null)
    let [error, setError] = useState({})

    const handleFaceCapture = useCallback(async (frames) => {
        setError({});
        clearError();
        const result = await faceLogin(frames);
        if (result.success) {
            navigate('/');
        } else {
            setError({ message: result.error });
        }
    }, [clearError, faceLogin, navigate]);
    
    let handleChange = (e) => {
        let name = e.target.name;
        let value = e.target.value;

        // Clear errors when user types
        if (error.message || authError) {
            setError({});
            clearError();
        }

        setInputs(values => {
            return {
                ...values,
                [name]: value
            }
        })
    }

    let handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setIsLoggingIn(true);
        setError({});
        clearError();

        try {
            console.log('🔐 Attempting login...');
            const result = await login(inputs);

            console.log('🔐 Login result:',result, { success: result.success, hasData: !!result.data });

            if (result.success) {
                // Successfully logged in
                console.log('✅ Login successful, navigating to home...');
                console.log('🔐 Login result data:', result.data);

                if(result.data.accessToken) {
                    // User data is already stored by AuthContext, but ensure it's there
                    const { setUserInStorage } = require('../utils/storageUtils');
                    setUserInStorage(result.data);
                }

                
                // Small delay to ensure localStorage is synced
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Verify token is in storage before navigation
                const { getUserFromStorage } = require('../utils/storageUtils');
                const storedUser = getUserFromStorage();
                if (storedUser) {
                    console.log('✅ Token verified in storage before navigation:', !!storedUser.accessToken);
                } else {
                    console.warn('⚠️ No user in storage after login!');
                }
                
                // Navigate to home page
                navigate('/');
            } else {
                setError({ message: result.error });
            }
        } catch (error) {
            console.error('❌ Login error:', error);
            setError({ message: 'An unexpected error occurred. Please try again.' });
        } finally {
            setIsLoggingIn(false);
        }
    }, [inputs, login, clearError, navigate])

    let handlePortfolioClick = useCallback(e => {
        navigate('/portfolio')
    }, [])

    // Google OAuth functionality
    const handleGoogleSignIn = useCallback(async (response) => {
        console.log('Google sign-in response:', response);
        setIsGoogleSigningIn(true);
        setError({});
        clearError();
        
        try {
            const { credential } = response;
            
            if (!credential) {
                throw new Error('No credential received from Google');
            }
            
            // Decode the JWT token to get user info
            const payload = JSON.parse(atob(credential.split('.')[1]));
            console.log('Decoded Google payload:', payload);
            
            const { sub: googleId, email, name, picture, given_name, family_name } = payload;

            const googleData = {
                googleId,
                email,
                name,
                photo: picture,
                familyName: family_name,
                givenName: given_name,
                idToken: credential
            };

            console.log('Sending Google data to server:', googleData);

            const result = await googleLogin(googleData);

            if (result.success) {
                // Successfully logged in
                // Navigate to home page
                navigate('/');
            } else {
                setError({ message: result.error });
            }
        } catch (error) {
            console.error('Google sign-in error:', error);
            setError({ message: 'Google sign-in failed. Please try again.' });
        } finally {
            setIsGoogleSigningIn(false);
        }
    }, [googleLogin, clearError]);

    // Make handleGoogleSignIn globally accessible for Google OAuth
    useEffect(() => {
        window.handleGoogleSignIn = handleGoogleSignIn;
        
        return () => {
            delete window.handleGoogleSignIn;
        };
    }, [handleGoogleSignIn]);

    // Load Google Identity Services script and render the button programmatically
    useEffect(() => {
        const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
        const initializeAndRender = () => {
            if (!window.google || !googleButtonRef.current) return;
            try {
                if (!googleClientId) {
                    console.error('REACT_APP_GOOGLE_CLIENT_ID is not set. Skipping Google Identity initialization.');
                    return;
                }
                window.google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: window.handleGoogleSignIn || handleGoogleSignIn,
                    auto_select: false,
                    cancel_on_tap_outside: true
                });

                // Ensure fresh render each time
                googleButtonRef.current.innerHTML = '';
                window.google.accounts.id.renderButton(googleButtonRef.current, {
                    type: 'standard',
                    size: 'large',
                    theme: 'outline',
                    text: isGoogleSigningIn ? 'continue_with' : 'signin_with',
                    shape: 'rectangular',
                    logo_alignment: 'left'
                });
                window.google.accounts.id.prompt();

                console.log('Google Identity Services initialized and button rendered');
            } catch (error) {
                console.error('Error initializing/rendering Google Identity Services:', error);
            }
        };

        if (window.google && window.google.accounts) {
            initializeAndRender();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = initializeAndRender;
        script.onerror = () => console.error('Failed to load Google Identity Services script');
        document.body.appendChild(script);

        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, [handleGoogleSignIn, isGoogleSigningIn]);


    return (
        <Fragment>
            <div id="login">
                <div className="login-container">
                    <div className="logo-container text-center">
                        <img src={config?.logo} alt="Connect Logo" />
                    </div>
                    <div id="login-form">
                        <h1 className="text-center login-heading primary-color mb-3 fw-bold">Connect - Login</h1>

                        <div className="forms-container">
                            <input onChange={handleChange} className="email" name="email" type="text" placeholder="Email address or phone number" disabled={isLoggingIn || isGoogleSigningIn} />
                            <input onChange={handleChange} type="password" name="password" className="password" placeholder="Password" disabled={isLoggingIn || isGoogleSigningIn} />
                            <p id="loginErrorMsg" style={{ color: 'red' }}>{error.message || authError}</p>
                            <input 
                                type="submit" 
                                onClick={handleSubmit} 
                                className={`submit-button ${isLoggingIn ? 'disabled' : ''}`} 
                                value={isLoggingIn ? "Logging in..." : "Login"}
                                disabled={isLoggingIn || isGoogleSigningIn}
                                style={{ opacity: isLoggingIn || isGoogleSigningIn ? 0.6 : 1, cursor: isLoggingIn || isGoogleSigningIn ? 'not-allowed' : 'pointer' }}
                            />
                            <span className="forgot-password" onClick={() => navigate('/forgot-password')} style={{ cursor: 'pointer' }}>
                                Forgotten password?
                            </span>

                            {/* Divider */}
                            <div className="divider-container my-3">
                                <div className="divider-line"></div>
                                <span className="divider-text">OR</span>
                                <div className="divider-line"></div>
                            </div>

                            {/* Google Sign In Button (rendered via GIS) */}
                            <div ref={googleButtonRef} style={{ display: 'inline-block' }} />

                            <button
                                type="button"
                                className="btn btn-outline-secondary mt-3"
                                onClick={() => setShowFaceLogin((value) => !value)}
                                disabled={isLoggingIn || isGoogleSigningIn}
                            >
                                <i className="fas fa-camera me-2"></i>
                                {showFaceLogin ? "Hide face login" : "Log in with Face"}
                            </button>
                            {showFaceLogin && (
                                <div className="mt-3">
                                    <FaceCapture onCapture={handleFaceCapture} disabled={isLoggingIn || isGoogleSigningIn} />
                                </div>
                            )}


                        </div>

                        <div onClick={showSignup} className="create-account-button">
                            Create new account <i className="fa fa-arrow-alt-circle-right"></i>
                        </div>
                    </div>
                </div>

                <div className="text-center">
                    <div onClick={handlePortfolioClick.bind(this)} className="btn btn-primary mt-2 text-center">
                        View Ikram&apos;s Portfolio <i className="fa fa-arrow-alt-circle-right"></i>

                    </div>
                </div>

            </div>
        </Fragment>
    )
}

export default Login;