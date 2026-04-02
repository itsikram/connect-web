import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { resetPassword } = useAuth();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const onSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage('');
        setError('');

        const result = await resetPassword(token, password, confirmPassword);
        if (result.success) {
            setMessage(result.message);
            setTimeout(() => navigate('/login'), 1200);
        } else {
            setError(result.error || 'Failed to reset password.');
        }

        setIsSubmitting(false);
    };

    return (
        <div id="login">
            <div className="login-container">
                <div id="login-form">
                    <h1 className="text-center login-heading primary-color mb-3 fw-bold">Reset Password</h1>
                    <form className="forms-container" onSubmit={onSubmit}>
                        <input
                            type="password"
                            className="password"
                            placeholder="New password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isSubmitting}
                            required
                        />
                        <input
                            type="password"
                            className="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isSubmitting}
                            required
                        />

                        {message ? <p style={{ color: 'green' }}>{message}</p> : null}
                        {error ? <p style={{ color: 'red' }}>{error}</p> : null}

                        <input
                            type="submit"
                            className={`submit-button ${isSubmitting ? 'disabled' : ''}`}
                            value={isSubmitting ? 'Resetting...' : 'Reset Password'}
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

export default ResetPassword;
