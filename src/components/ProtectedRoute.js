import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useJwt } from 'react-jwt'
import { useNavigate, useLocation } from 'react-router-dom';

const user = localStorage.getItem("user") || '{}';
const userJson = JSON.parse(user);


const ProtectedRoute = ({ children }) => {
    let auth = useSelector(state => state.auth)
    let navigate = useNavigate()
    let location = useLocation()

    const { isExpired } = useJwt(auth?.token || userJson.accessToken) || false

    useEffect(() => {
        if (isExpired) {
            navigate('/login')
        }




    }, [userJson, location, isExpired])


    useEffect(() => {
        if (auth?.token) {

            if (!auth.token) navigate('/login')


        }
    }, [auth])

    // useEffect(() => {

    //     i
    //     if (!token) {
    //         navigate('/login')
    //     }
    // }, [token])
    return (
        <>
            {children}
        </>
    );
}

export default ProtectedRoute;

