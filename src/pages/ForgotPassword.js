import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ForgotPassword = () => {
    const { forgotPassword } = useAuth();
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const onSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage('');
        setError('');

        const result = await forgotPassword(email);
        if (result.success) {
            setMessage(result.message);
        } else {
            setError(result.error || 'Failed to send reset link.');
        }

        setIsSubmitting(false);
    };

    return (
        <div id="login">
            <div className="login-container">
                <div id="login-form">
                    <h1 className="text-center login-heading primary-color mb-3 fw-bold">Forgot Password</h1>
                    <form className="forms-container" onSubmit={onSubmit}>
                        <input
                            className="email"
                            type="email"
                            placeholder="Enter your account email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isSubmitting}
                            required
                        />

                        {message ? <p style={{ color: 'green' }}>{message}</p> : null}
                        {error ? <p style={{ color: 'red' }}>{error}</p> : null}

                        <input
                            type="submit"
                            className={`submit-button ${isSubmitting ? 'disabled' : ''}`}
                            value={isSubmitting ? 'Sending...' : 'Send Reset Link'}
                            disabled={isSubmitting}
                        />

                        <div className="text-center mt-3">
                            <Link to="/login">Back to Login</Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
