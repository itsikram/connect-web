import React, { useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import api from '../../api/api';


const AccountSetting = () => {
    let myProfile = useSelector(state => state.profile)
    let [data, setData] = useState({ userEmail: myProfile?.user && myProfile.user.email })
    let [editEmail, setEditEmail] = useState(false)
    let handleInputChange = useCallback(async (e) => {
        let name = e.target.id;
        let value = e.target.value
        setData({
            ...data,
            [name]: value
        })
    },[])

    let handleSubmit = useCallback(async (e) => {
        e.preventDefault();



        if (data.userEmail != myProfile?.user.email) {

            let emailChangeRes = await api.post('auth/changeEmail', {
                email: data.userEmail
            })

            if (emailChangeRes.status == 200) {
                let updatedUser = JSON.stringify(emailChangeRes.data);
                localStorage.setItem('user', updatedUser)
                return window.location.reload()

            }

        }


        if (data.confirmPassword && data.confirmPassword.length < 2) return;

        if (data.newPassword !== data.confirmPassword) {
            return alert('Your New password and Confirm Password is not same')
        }

        let res = await api.post('auth/changePass', data)

        if (res.status == 400) {
            return alert('Your Current password is invalid')
        }

        if (res.status == 200) {
            let updatedUser = JSON.stringify(res.data);
            localStorage.setItem('user', updatedUser)
            window.location.reload()
        }
    },[data])

    let deleteAccount = useCallback(async (e) => {
        e.preventDefault();
        let userData = JSON.parse(localStorage.getItem('user'))
        let deletedAccountRes = await api.post('auth/delete', { userData: userData })
        if (deletedAccountRes.status == 200) {
            localStorage.removeItem('user')
            alert(deletedAccountRes.data.message)
            window.location.reload();
        }
    },[myProfile])

    let handleEditEmailClick = useCallback((e) => {
        e.preventDefault();
        setEditEmail(!editEmail)
    },[editEmail])

    return (
        <>
            <div className='profile-setting'>
                <div className='setting-field-container'>
                    <h3 className='text-center'>Account Settings</h3>

                    <form>
                        <h3 className='fs-4'>Change Password</h3>
                        <div className="form-group mb-2">
                            <label for="userEmail">Email</label>
                            <div className='input-group'>
                                <input onChange={handleInputChange.bind(this)} type="email" className="form-control" id="userEmail" disabled={!editEmail && true} value={editEmail ? data.userEmail : myProfile?.user  && myProfile?.user.email} placeholder="Email" />

                                <div className='input-group-append'>
                                    <button onClick={handleEditEmailClick.bind(this)} className='btn btn-danger'><i className='fas fa-pen'></i></button>
                                </div>
                            </div>
                        </div>
                        <div className="form-group mb-2">
                            <label for="currentPassword">Current Password</label>
                            <input onChange={handleInputChange.bind(this)} type="password" className="form-control" id="currentPassword" placeholder="Current Password" />
                        </div>
                        <div className="form-group mb-2">
                            <label for="newPassword">New Password</label>
                            <input onChange={handleInputChange.bind(this)} type="password" className="form-control" id="newPassword" placeholder="New Password" />
                        </div>
                        <div className="form-group mb-2">
                            <label for="confirmPassword">Confirm Password</label>
                            <input onChange={handleInputChange.bind(this)} type="password" className="form-control" id="confirmPassword" placeholder="Confirm Password" />
                        </div>

                        <button type="submit" onClick={handleSubmit.bind(this)} className="btn btn-primary">Save Settings</button>
                        <br />

                        <button onClick={deleteAccount.bind(this)} className='btn btn-danger mt-3'>Delete My Account</button>

                    </form>
                </div>
            </div>
        </>
    );
}

export default AccountSetting;
