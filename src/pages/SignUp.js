import React, { Fragment, useState, useCallback, useEffect, useRef } from "react";
import $ from 'jquery'
import api from "../api/api";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { setLogin } from "../services/actions/authActions";
import PasswordChecklist from "react-password-checklist"
import isValidEmail from "../utils/isValidEmail";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';

let SignUP = () => {

    let { token } = useSelector(state => state.auth)
    let pass = useRef(null)
    let cnfmPass = useRef(null)
    const [selectedDate, setSelectedDate] = useState(null);

    useEffect(() => {
        if (token) navigate('/')
    }, [token])
    let navigate = useNavigate()
    let closeSignup = (e) => {
        return navigate('/login')
    }

    let dispatch = useDispatch();


    let [inputs, setInputs] = useState({
        password: '',
        confirmPassword: '',
        firstName: '',
        email: '',
        gender: '',
        surname: ''
    })

    let handleChange = e => {
        let name = e.currentTarget.name;
        let value = e.currentTarget.value;

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
    let [error, setError] = useState({})

    let handleSubmit = useCallback(async (e) => {

        try {

            api.post('/auth/signup', inputs).then(res => {

                if (res.status === 201) {
                    $('#signup-form input').val("");
                    $('.signup-container').fadeOut('fast');

                    let userData = JSON.stringify(res.data);
                    localStorage.setItem('user', userData)

                    dispatch(setLogin(res.data.accessToken))

                    window.location.reload()
                } else {
                    setError(res.data)
                }
            })

        } catch (e) {
            console.log(e)
        }
    },[inputs])

    let handlePortfolioClick = useCallback(e => {
        navigate('/portfolio')
    },[])


    return (
        <Fragment>
            <div className="signup-container">

                <div id="signup-form">
                    <h1 className="text-center login-heading primary-color mb-3 fw-bold">ICS - Signup</h1>

                    <div className="forms-container">
                        <div className="full-name">
                            <input onChange={handleChange} name="firstName" className="first-name field" type="text" placeholder="First Name" />
                            <input name="surname" onChange={handleChange} className="surname field" type="text" placeholder="Surame" />

                        </div>
                        <div className="form-group">
                            <input onChange={handleChange} name="email" className="email field" type="text" placeholder="Email address or phone number" />
                            <div className="invalid-feedback pb-2 fw-bold">
                                Please provide a valid email.
                            </div>
                        </div>

                        <input onChange={handleChange} ref={pass} name="password" type="password" className="password field" placeholder="Password" />
                        <div className="input-group">
                            <input onChange={handleChange} ref={cnfmPass} name="confirmPassword" type="password" className="confirm-password field" placeholder="Confirm Password" />

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
                            
                        />


                        <div className="gender-container">
                            <div className="field-title">Gender</div>
                            <div className="radio-container">
                                <label htmlFor="genderMale">Male</label>
                                <input onFocus={handleChange} type="radio" id="genderMale" name="gender" value="male"></input>
                                <label htmlFor="genderFemale">Female</label>
                                <input onFocus={handleChange} type="radio" name="gender" id="genderFemale" value="female"></input>
                                <label htmlFor="genderCustom">Custom</label>
                                <input onFocus={handleChange} type="radio" name="gender" id="genderCustom" value="custom"></input>
                            </div>
                        </div>
                        <p style={{ color: 'red' }}>{error.message}</p>

                        <input onClick={handleSubmit} type="submit" className="submit-button field" value="Sign UP" />


                    </div>

                    <div onClick={closeSignup} className="login-button">
                        <i className="fa fa-arrow-alt-circle-left"></i> Login
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

export default SignUP;