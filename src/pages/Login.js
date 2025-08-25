import React, { Fragment, useState } from "react";
import SignUP from "./SignUp";
import $ from 'jquery'
import api from '../api/api'
import { useDispatch, useSelector } from 'react-redux'
import { useCallback } from "react";
import { setLogin } from "../services/actions/authActions";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useJwt } from "react-jwt";
let Login = (props) => {

    let navigate = useNavigate();

    const user = localStorage.getItem("user") || '{}';
    const userJson = JSON.parse(user);
    //   const { isExpired } = useJwt();

    useEffect(() => {
        // alert('ie'+isExpired)
        if (userJson.accessToken) navigate('/')
    }, [userJson])
    let showSignup = (e) => {
        return navigate('/signup')

    }

    let [inputs, setInputs] = useState({})
    let handleChange = (e) => {
        let name = e.target.name;
        let value = e.target.value;

        setInputs(values => {
            return {
                ...values,
                [name]: value
            }
        })

    }

    let [error, setError] = useState({})

    let handleSubmit = useCallback(async (e) => {
        try {
            let res = await api.post('auth/login', inputs)

            if (res.status === 202) {
                let userData = JSON.stringify(res.data);
                localStorage.setItem('user', userData)
                // dispatch(setLogin(res.data.accessToken))
                window.location.reload()


                // setTimeout(() => {
                //     // navigate('/')
                // }, 1000)

            } else {
                // alert(res.data.message)
                setError({ message: res.data.message })
            }

        } catch (error) {
            console.log(error)
        }
    }, [inputs])

    let handlePortfolioClick = useCallback(e => {
        navigate('/portfolio')
    }, [])


    return (
        <Fragment>
            <div id="login">
                <div className="login-container">
                    <div className="logo-container text-center">
                        <img src="https://programmerikram.com/wp-content/uploads/2025/05/ics_logo_out_transparent.png" alt="Connect Logo" />
                    </div>
                    <div id="login-form">
                        <h1 className="text-center login-heading primary-color mb-3 fw-bold">Connect - Login</h1>

                        <div className="forms-container">
                            <input onChange={handleChange} className="email" name="email" type="text" placeholder="Email address or phone number" />
                            <input onChange={handleChange} type="password" name="password" className="password" placeholder="Password" />
                            <p id="loginErrorMsg" style={{ color: 'red' }}>{error.message}</p>
                            <input type="submit" onClick={handleSubmit} className="submit-button" value="Login" />
                            <span className="forgot-password">
                                Forgotten password?
                            </span>

                        </div>

                        <div onClick={showSignup} className="create-account-button">
                            Create new account <i className="fa fa-arrow-alt-circle-right"></i>
                        </div>
                    </div>
                </div>

                <div className="text-center">
                    <div onClick={handlePortfolioClick.bind(this)} className="btn btn-primary mt-2 text-center">
                        View Ikram's Portfolio <i className="fa fa-arrow-alt-circle-right"></i>

                    </div>
                </div>

            </div>
        </Fragment>
    )
}

export default Login;