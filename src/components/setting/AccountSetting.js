import React, { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../../api/api';
import { showSuccessToast, showErrorToast } from '../../utils/toastUtils';

const AccountSetting = () => {
    const myProfile = useSelector((state) => state.profile);
    const [data, setData] = useState({
        userEmail: myProfile?.user?.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [editEmail, setEditEmail] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleInputChange = useCallback((e) => {
        const { id, value } = e.target;
        setData((prev) => ({ ...prev, [id]: value }));
    }, []);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            if (data.userEmail && data.userEmail !== myProfile?.user?.email) {
                const emailChangeRes = await api.post('auth/changeEmail', {
                    email: data.userEmail,
                });

                if (emailChangeRes.status === 200) {
                    localStorage.setItem('user', JSON.stringify(emailChangeRes.data));
                    showSuccessToast('Email updated successfully');
                    window.location.reload();
                    return;
                }
            }

            if (!data.newPassword && !data.confirmPassword && !data.currentPassword) {
                return;
            }

            if (!data.currentPassword || !data.newPassword || !data.confirmPassword) {
                showErrorToast('Please fill in all password fields');
                return;
            }

            if (data.newPassword.length < 6) {
                showErrorToast('New password must be at least 6 characters');
                return;
            }

            if (data.newPassword !== data.confirmPassword) {
                showErrorToast('Your new password and confirm password do not match');
                return;
            }

            const res = await api.post('auth/changePass', data);

            if (res.status === 400) {
                showErrorToast('Your current password is invalid');
                return;
            }

            if (res.status === 200 || res.status === 202) {
                localStorage.setItem('user', JSON.stringify(res.data));
                showSuccessToast('Password updated successfully');
                setData((prev) => ({
                    ...prev,
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                }));
            }
        } catch (error) {
            console.error('Account settings error:', error);
            showErrorToast(error?.response?.data?.message || 'Failed to update account settings');
        } finally {
            setIsSaving(false);
        }
    }, [data, myProfile?.user?.email]);

    const deleteAccount = useCallback(async (e) => {
        e.preventDefault();
        const confirmed = window.confirm(
            'Delete your account permanently? This cannot be undone.'
        );
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            const deletedAccountRes = await api.post('auth/delete');
            if (deletedAccountRes.status === 200) {
                localStorage.removeItem('user');
                showSuccessToast(deletedAccountRes.data.message || 'Account deleted');
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Delete account error:', error);
            showErrorToast(error?.response?.data?.message || 'Failed to delete account');
        } finally {
            setIsDeleting(false);
        }
    }, []);

    const handleEditEmailClick = useCallback((e) => {
        e.preventDefault();
        setEditEmail((prev) => !prev);
    }, []);

    return (
        <div className="profile-setting">
            <div className="setting-field-container">
                <h3>Account Settings</h3>
                <p className="setting-section-desc">Manage your email and password.</p>

                <form onSubmit={handleSubmit}>
                    <h3 className="fs-4">Change Password</h3>
                    <div className="form-group mb-2">
                        <label htmlFor="userEmail">Email</label>
                        <div className="input-group">
                            <input
                                onChange={handleInputChange}
                                type="email"
                                className="form-control"
                                id="userEmail"
                                disabled={!editEmail}
                                value={editEmail ? data.userEmail : (myProfile?.user?.email || '')}
                                placeholder="Email"
                            />
                            <div className="input-group-append">
                                <button type="button" onClick={handleEditEmailClick} className="btn btn-danger">
                                    <i className="fas fa-pen" aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="form-group mb-2">
                        <label htmlFor="currentPassword">Current Password</label>
                        <input
                            onChange={handleInputChange}
                            type="password"
                            className="form-control"
                            id="currentPassword"
                            value={data.currentPassword}
                            placeholder="Current Password"
                        />
                    </div>
                    <div className="form-group mb-2">
                        <label htmlFor="newPassword">New Password</label>
                        <input
                            onChange={handleInputChange}
                            type="password"
                            className="form-control"
                            id="newPassword"
                            value={data.newPassword}
                            placeholder="New Password"
                        />
                    </div>
                    <div className="form-group mb-2">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input
                            onChange={handleInputChange}
                            type="password"
                            className="form-control"
                            id="confirmPassword"
                            value={data.confirmPassword}
                            placeholder="Confirm Password"
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save Settings'}
                    </button>
                    <br />

                    <button
                        type="button"
                        onClick={deleteAccount}
                        className="btn btn-danger mt-3"
                        disabled={isDeleting}
                    >
                        {isDeleting ? 'Deleting…' : 'Delete My Account'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AccountSetting;
