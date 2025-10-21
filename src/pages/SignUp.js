import React, { Fragment, useState, useCallback, useEffect, useRef } from "react";
import $ from 'jquery'
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from "react-router-dom";
import PasswordChecklist from "react-password-checklist"
import isValidEmail from "../utils/isValidEmail";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';

let SignUP = () => {

    const { signup, googleLogin, isAuthenticated, authError, clearError } = useAuth();
    let pass = useRef(null)
    let cnfmPass = useRef(null)
    const [selectedDate, setSelectedDate] = useState(null);
    let navigate = useNavigate();

    useEffect(() => {
        // Redirect if already authenticated
        if (isAuthenticated) {
            navigate('/');
        }
    }, [isAuthenticated, navigate]);
    
    let closeSignup = (e) => {
        return navigate('/login')
    }

    let [inputs, setInputs] = useState({
        password: '',
        confirmPassword: '',
        firstName: '',
        email: '',
        gender: '',
        surname: ''
    })
    let [isSigningUp, setIsSigningUp] = useState(false)
    let [isGoogleSigningUp, setIsGoogleSigningUp] = useState(false)
    let [error, setError] = useState({})

    let handleChange = e => {
        let name = e.currentTarget.name;
        let value = e.currentTarget.value;

        // Clear errors when user types
        if (error.message || authError) {
            setError({});
            clearError();
        }

        if (name == 'email') {
            if (isValidEmail(value)) {
                e.target.classList.remove('is-invalid')
            } else {
                e.target.classList.add('is-invalid')

            }
        }
        if (name == 'confirmPassword') {
            if (inputs.password === value) {
                e.target.classList.remove('is-invalid')
            } else {
                e.target.classList.add('is-invalid')

            }
        }

        console.log({
            ...inputs,
            [name]: value
        })

        setInputs(values => {
            return {
                ...values,
                [name]: value
            }
        })
    }

    let handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setIsSigningUp(true);
        setError({});
        clearError();

        try {
            const result = await signup(inputs);

            if (result.success) {
                $('#signup-form input').val("");
                $('.signup-container').fadeOut('fast');
                
                // Successfully signed up
                // Navigate to home page
                navigate('/');
            } else {
                setError({ message: result.error });
            }
        } catch (e) {
            console.error('Signup error:', e);
            setError({ message: 'An unexpected error occurred. Please try again.' });
        } finally {
            setIsSigningUp(false);
        }
    }, [inputs, signup, clearError, navigate])

    let handlePortfolioClick = useCallback(e => {
        navigate('/portfolio')
    },[])

    // Google OAuth functionality
    const handleGoogleSignIn = useCallback(async (response) => {
        console.log('Google sign-in response:', response);
        setIsGoogleSigningUp(true);
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
                // Clear form
                $('#signup-form input').val("");
                $('.signup-container').fadeOut('fast');
                
                // Successfully signed up
                // Navigate to home page
                navigate('/');
            } else {
                setError({ message: result.error });
            }
        } catch (error) {
            console.error('Google sign-in error:', error);
            setError({ message: 'Google sign-in failed. Please try again.' });
        } finally {
            setIsGoogleSigningUp(false);
        }
    }, [googleLogin, clearError]);

    // Make handleGoogleSignIn globally accessible for Google OAuth
    useEffect(() => {
        window.handleGoogleSignIn = handleGoogleSignIn;
        
        return () => {
            delete window.handleGoogleSignIn;
        };
    }, [handleGoogleSignIn]);

    // Load Google Identity Services script
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);

        script.onload = () => {
            if (window.google) {
                try {
                    const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
                    if (!googleClientId) {
                        console.error('REACT_APP_GOOGLE_CLIENT_ID is not set. Skipping Google Identity initialization.');
                        return;
                    }
                    window.google.accounts.id.initialize({
                        client_id: googleClientId,
                        callback: 'handleGoogleSignIn',
                        auto_select: false,
                        cancel_on_tap_outside: true
                    });
                    console.log('Google Identity Services initialized successfully');
                } catch (error) {
                    console.error('Error initializing Google Identity Services:', error);
                }
            }
        };

        script.onerror = () => {
            console.error('Failed to load Google Identity Services script');
        };

        return () => {
            // Cleanup
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, []);


    return (
        <Fragment>
            <div className="signup-container">

                <div id="signup-form">
                    <h1 className="text-center login-heading primary-color mb-3 fw-bold">ICS - Signup</h1>

                    <div className="forms-container">
                        <div className="full-name">
                            <input onChange={handleChange} name="firstName" className="first-name field" type="text" placeholder="First Name" disabled={isSigningUp || isGoogleSigningUp} />
                            <input name="surname" onChange={handleChange} className="surname field" type="text" placeholder="Surame" disabled={isSigningUp || isGoogleSigningUp} />

                        </div>
                        <div className="form-group">
                            <input onChange={handleChange} name="email" className="email field" type="text" placeholder="Email address or phone number" disabled={isSigningUp || isGoogleSigningUp} />
                            <div className="invalid-feedback pb-2 fw-bold">
                                Please provide a valid email.
                            </div>
                        </div>

                        <input onChange={handleChange} ref={pass} name="password" type="password" className="password field" placeholder="Password" disabled={isSigningUp || isGoogleSigningUp} />
                        <div className="input-group">
                            <input onChange={handleChange} ref={cnfmPass} name="confirmPassword" type="password" className="confirm-password field" placeholder="Confirm Password" disabled={isSigningUp || isGoogleSigningUp} />

                            <div className="invalid-feedback pb-2 fw-bold">
                                Please Match Password With Confirm Password.
                            </div>
                        </div>

                        {
                            inputs.password.length > 0 && <>
                                <PasswordChecklist
                                    rules={["minLength", "specialChar", "number", "capital"]}
                                    minLength={6}
                                    value={inputs.password}
                                    onChange={(isValid) => {

                                        if (pass.current.value.length > 0) {
                                            if (isValid) {
                                                pass.current.classList.remove('is-invalid')

                                            } else {
                                                pass.current.classList.add('is-invalid')

                                            }
                                        }

                                    }}
                                    className="my-3"
                                />
                            </>
                        }

                        {/* <input onChange={handleChange} name="DOB" className="dob field" type="text" placeholder="DD/MM/YYYY" /> */}
                        <DatePicker
                            selected={new Date()}
                            onChange={date => {

                                let dobDate = format(date, 'dd/MM/yyyy')
                                console.log({...inputs, DOB: dobDate})
                                setInputs({...inputs, DOB: dobDate})
                            
                            }}
                            dateFormat="dd/MM/yyyy"
                            placeholderText="Select a date"
                            name="DOB"
                            className="field w-100"
                            disabled={isSigningUp || isGoogleSigningUp}
                            
                        />


                        <div className="gender-container">
                            <div className="field-title">Gender</div>
                            <div className="radio-container">
                                <label htmlFor="genderMale">Male</label>
                                <input onFocus={handleChange} type="radio" id="genderMale" name="gender" value="male" disabled={isSigningUp || isGoogleSigningUp}></input>
                                <label htmlFor="genderFemale">Female</label>
                                <input onFocus={handleChange} type="radio" name="gender" id="genderFemale" value="female" disabled={isSigningUp || isGoogleSigningUp}></input>
                                <label htmlFor="genderCustom">Custom</label>
                                <input onFocus={handleChange} type="radio" name="gender" id="genderCustom" value="custom" disabled={isSigningUp || isGoogleSigningUp}></input>
                            </div>
                        </div>
                        <p style={{ color: 'red' }}>{error.message || authError}</p>

                        <input 
                            onClick={handleSubmit} 
                            type="submit" 
                            className={`submit-button field ${isSigningUp ? 'disabled' : ''}`} 
                            value={isSigningUp ? "Signing up..." : "Sign UP"}
                            disabled={isSigningUp || isGoogleSigningUp}
                            style={{ opacity: isSigningUp || isGoogleSigningUp ? 0.6 : 1, cursor: isSigningUp || isGoogleSigningUp ? 'not-allowed' : 'pointer' }}
                        />

                        {/* Divider */}
                        <div className="divider-container my-3">
                            <div className="divider-line"></div>
                            <span className="divider-text">OR</span>
                            <div className="divider-line"></div>
                        </div>

                        {/* Google Sign In Button */}
                        <div id="g_id_onload"
                             data-client_id={process.env.REACT_APP_GOOGLE_CLIENT_ID || ''}
                             data-callback="handleGoogleSignIn"
                             data-auto_prompt="false">
                        </div>
                        <div 
                            className={`g_id_signin ${isGoogleSigningUp ? 'disabled' : ''}`}
                            data-type="standard"
                            data-size="large"
                            data-theme="outline"
                            data-text={isGoogleSigningUp ? "Signing up..." : "sign_in_with"}
                            data-shape="rectangular"
                            data-logo_alignment="left"
                            style={{ opacity: isGoogleSigningUp ? 0.6 : 1, cursor: isGoogleSigningUp ? 'not-allowed' : 'pointer' }}
                        >
                        </div>
                        
                        {/* Alternative Google Button */}
                        <button 
                            type="button"
                            className={`google-signin-btn field ${isGoogleSigningUp ? 'disabled' : ''}`}
                            onClick={() => {
                                if (isGoogleSigningUp) return;
                                console.log('Manual Google sign-in clicked');
                                if (window.google) {
                                    window.google.accounts.id.prompt();
                                } else {
                                    console.error('Google Identity Services not loaded');
                                }
                            }}
                            disabled={isGoogleSigningUp}
                            style={{
                                width: '100%',
                                height: '50px',
                                border: '1px solid #29B1A9',
                                borderRadius: '10px',
                                backgroundColor: '#fff',
                                color: '#333',
                                fontSize: '16px',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: isGoogleSigningUp ? 'not-allowed' : 'pointer',
                                marginTop: '10px',
                                opacity: isGoogleSigningUp ? 0.6 : 1
                            }}
                        >
                            <i className={isGoogleSigningUp ? "fas fa-spinner fa-spin" : "fab fa-google"} style={{ marginRight: '10px', color: '#4285F4' }}></i>
                            {isGoogleSigningUp ? "Signing up..." : "Continue with Google"}
                        </button>

                    </div>

                    <div onClick={closeSignup} className="login-button">
                        <i className="fa fa-arrow-alt-circle-left"></i> Login
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

export default SignUP;