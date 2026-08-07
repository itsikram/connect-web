import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/api';
import { useSelector, useDispatch } from 'react-redux';
import { getProfileSuccess } from '../../services/actions/profileActions';
import { showProfileUpdateToast } from '../../utils/toastUtils';
import { Link } from 'react-router-dom';
import { loadSettings } from '../../services/actions/settingsActions';

const ProfileSetting = () => {
    let myProfile = useSelector(state => state.profile)
    let oldSettings = useSelector(state => state.setting)
    let dispatch = useDispatch()

    let [settings, setSetings] = useState({
        firstName: '',
        surname: '',
        nickname: '',
        username: '',
        workPlaces: [{}],
        schools: [{}],
        displayName: '',
        presentAddress: '',
        permanentAddress: ''
    })
    let [isSaving, setIsSaving] = useState(false)

    useEffect(() => {

        if (!myProfile?.user) return;
        setSetings({
            firstName: myProfile.user.firstName || '',
            surname: myProfile.user.surname || '',
            nickname: myProfile.nickname || '',
            username: myProfile.username || '',
            displayName: myProfile.displayName || '',
            presentAddress: myProfile.presentAddress || '',
            permanentAddress: myProfile.permanentAddress || ''
        })

    }, [myProfile])

    let handleInputChange = useCallback((e) => {
        setSetings((prev) => ({
            ...prev,
            [e.target.name]: e.target.value
        }))
    }, [])

    let handleSubmitSettings = useCallback(async (e) => {
        e.preventDefault();
        setIsSaving(true)
        try {
            let res = await api.post('/profile/update', settings)
            if (res.status === 200) {
                dispatch(getProfileSuccess(res.data))

                // if (settings?.workPlaces.length > 0) {
                //     let settingRes = await api.post('setting/update', { ...oldSettings, ...settings })
                //     dispatch(loadSettings(settingRes.data))
                // }
                showProfileUpdateToast(
                    'Your Profile Updated Successfully',
                    myProfile.fullName,
                    myProfile.profilePic,
                    ''
                );
            }
        } catch (error) {
            console.log('Error updating profile:', error)
        } finally {
            setIsSaving(false)
        }
    },[settings])
    const [workPlaces, setWorkPlaces] = useState([{}]);
    const [schools, setSchools] = useState([{}]);

    useEffect(() => {
        setWorkPlaces(myProfile?.workPlaces || [{}])
        setSchools(myProfile?.schools || [{}])
    }, [myProfile])


    // handle schools


    const handleDynamicSclDegChange = (index, event) => {
        let newSchools = [...schools];
        let currentIndex = event.currentTarget.dataset.index

        newSchools[currentIndex] = {
            degree: event.target.value,
            name: schools[currentIndex].name
        };
        setSchools(newSchools);
        let allSettings = {
            ...settings,
            schools: newSchools.filter((school, index) => school.name !== '' || school.degree !== '')
        }
        setSetings(allSettings)
    };

    const handleDynamicSclNameChange = (index, event) => {
        let newSchools = [...schools];
        let currentIndex = event.currentTarget.dataset.index

        newSchools[currentIndex] = {
            degree: schools[currentIndex].degree,
            name: event.target.value
        };

        setSchools(newSchools);
        let allSettings = {
            ...settings,
            schools: newSchools.filter((school, index) => school.name !== '' || school.degree !== '')
        }

        setSetings(allSettings)
    };

    const handleAddDynamicSchool = (e) => {
        e.preventDefault()
        setSchools([...schools, {
            name: '',
            degree: ''
        }]);
    };

    // handle workspaces

    const handleDynamicWpDesChange = (index, event) => {
        const newWorkPlaces = [...workPlaces];
        let currentIndex = event.currentTarget.dataset.index

        newWorkPlaces[currentIndex] = {
            designation: event.target.value,
            name: workPlaces[currentIndex].name
        };
        setWorkPlaces(newWorkPlaces);
        let allSettings = {
            ...settings,
            workPlaces: newWorkPlaces.filter((workplace, index) => workplace.name !== '' || workplace.designation !== '')
        }
        setSetings(allSettings)
    };

    const handleDynamicWpNameChange = (index, event) => {
        const newWorkPlaces = [...workPlaces];
        let currentIndex = event.currentTarget.dataset.index

        newWorkPlaces[currentIndex] = {
            name: event.target.value,
            designation: workPlaces[currentIndex].designation
        };
        setWorkPlaces(newWorkPlaces);
        let allSettings = {
            ...settings,
            workPlaces: newWorkPlaces.filter((workplace, index) => workplace.name !== '' || workplace.designation !== '')
        }

        setSetings(allSettings)
    };

    const handleAddDynamicWorkplace = (e) => {
        e.preventDefault()
        setWorkPlaces([...workPlaces, {
            name: '',
            designation: ''
        }]);
    };


    return (
        <>
            <div className='profile-setting'>
                <div className='setting-field-container'>
                    <h3>Profile Settings</h3>
                    <p className="setting-section-desc">Update how your name and details appear on Connect.</p>
                    <form>
                        <div className="form-group mb-2">
                            <label htmlFor="firstName">First Name</label>
                            <input type="text" onChange={handleInputChange.bind(this)} className="form-control" id="firstName" value={settings.firstName || ''} name='firstName' placeholder="Enter first name" />
                        </div>
                        <div className="form-group mb-2">
                            <label htmlFor="surname">Surname</label>
                            <input type="text" onChange={handleInputChange.bind(this)} className="form-control" value={settings.surname || ''} id="surname" name='surname' placeholder="Enter Last Name" />
                        </div>
                        <div className="form-group mb-2">
                            <label htmlFor="username">Username</label>

                            <div className='input-group'>
                                <div className='input-group-prepend'>
                                    <span className='input-group-text'>@</span>
                                </div>
                                <input type="text" className="form-control" value={settings.username || ''} name='username' onChange={handleInputChange.bind(this)} id="username" aria-describedby="emailHelp" placeholder="Enter Username" />


                            </div>
                        </div>
                        <div className="form-group mb-2">
                            <label htmlFor="nickname">Nickname</label>

                            <input type="text" onChange={handleInputChange.bind(this)} value={settings.nickname || ''} className="form-control" id="nickname" name='nickname' placeholder="Enter Nickname" />

                        </div>
                        <div className="form-group mb-2">
                            <label htmlFor="displayName">Display Name</label>

                            <input type="text" onChange={handleInputChange.bind(this)} value={settings.displayName || ''} className="form-control" id="displayName" name='displayName' placeholder="Enter Display Name" />

                        </div>

                        <div className="form-group mb-2">
                            <label htmlFor="presentAddress">Present Address</label>

                            <div className='input-group'>
                                <div className='input-group-prepend'>
                                    <span className='input-group-text py-3'><i className='fas fa-home'></i></span>
                                </div>
                                <input type="text" value={settings.presentAddress || ''} onChange={handleInputChange.bind(this)} className="form-control" id="presentAddress" name='presentAddress' placeholder="Enter Present Address" />


                            </div>


                        </div>
                        <div className="form-group mb-2">
                            <label htmlFor="permanentAddress">Permanent Address</label>

                            <div className='input-group'>
                                <div className='input-group-prepend'>
                                    <span className='input-group-text py-3'> <i className='fa fa-globe'></i></span>
                                </div>
                                <input value={settings.permanentAddress || ''} type="text" onChange={handleInputChange.bind(this)} className="form-control" id="permanentAddress" name='permanentAddress' placeholder="Enter Permanent Address" />

                            </div>

                        </div>

                        <hr />

                        <div className='multiple-input-container schools-container my-3 p-3'>
                            <h4 className='text-center'>Your Schools</h4>
                            {schools.map((school, index) => (
                                <div key={index} className='row border border-secondary border-round my-2'>
                                    <div className='col'>
                                        <div key={index} className='form-group mb-2'>
                                            <label className='form-label'>Degree</label>
                                            <div className='input-group'>
                                                <div className='input-group-prepend'>
                                                    <span className='input-group-text py-3'>
                                                        <i className="fas fa-graduation-cap"></i>
                                                    </span>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={school.degree || ''}
                                                    onChange={(e) => handleDynamicSclDegChange(index, e)}
                                                    placeholder={`Your Degree`}
                                                    className='form-control'
                                                    name="degree"
                                                    data-index={index}
                                                />
                                            </div>

                                        </div>
                                    </div>

                                    <div className='col'>
                                        <div key={index} className='form-group mb-2'>
                                            <label className='form-label'>SChool Name</label>
                                            <div className='input-group'>
                                                <div className='input-group-prepend'>
                                                    <span className='input-group-text py-3'>
                                                        <i className="fas fa-graduation-cap"></i>
                                                    </span>

                                                </div>
                                                <input
                                                    type="text"
                                                    value={school.name || ''}
                                                    onChange={(e) => handleDynamicSclNameChange(index, e)}
                                                    placeholder={`School Name`}
                                                    className='form-control'
                                                    name="name"
                                                    data-index={index}

                                                />
                                            </div>

                                        </div>
                                    </div>
                                </div>


                            ))}
                            <button className='btn btn-secondary' onClick={handleAddDynamicSchool.bind(this)}>{`${schools.length > 0 ? 'Add Another School' : 'Add School'}`}</button>
                        </div>
                        <hr/>

                        <div className='multiple-input-container workplaces-container my-3 p-3'>
                            <h4 className='text-center'>Your Workplaces</h4>
                            {workPlaces.map((workplace, index) => (
                                <div key={index} className='row border border-secondary border-round my-2'>
                                    <div className='col'>
                                        <div key={index} className='form-group mb-2'>
                                            <label className='form-label'>Designation</label>
                                            <div className='input-group'>
                                                <div className='input-group-prepend'>
                                                    <span className='input-group-text py-3'>
                                                        <i className="fas fa-briefcase"></i>
                                                    </span>

                                                </div>
                                                <input
                                                    type="text"
                                                    value={workplace.designation || ''}
                                                    onChange={(e) => handleDynamicWpDesChange(index, e)}
                                                    placeholder={`Your Designation`}
                                                    className='form-control'
                                                    name="designation"
                                                    data-index={index}
                                                />
                                            </div>

                                        </div>
                                    </div>

                                    <div className='col'>
                                        <div key={index} className='form-group mb-2'>
                                            <label className='form-label'>Company Name</label>
                                            <div className='input-group'>
                                                <div className='input-group-prepend'>
                                                    <span className='input-group-text py-3'>
                                                        <i className="fas fa-briefcase"></i>
                                                    </span>

                                                </div>
                                                <input
                                                    type="text"
                                                    value={workplace.name || ''}
                                                    onChange={(e) => handleDynamicWpNameChange(index, e)}
                                                    placeholder={`Workplace Name`}
                                                    className='form-control'
                                                    name="name"
                                                    data-index={index}

                                                />
                                            </div>

                                        </div>
                                    </div>
                                </div>


                            ))}
                            <button className='btn btn-secondary' onClick={handleAddDynamicWorkplace.bind(this)}>{`${workPlaces.length > 0 ? 'Add Another Workplace' : 'Add Workplace'}`}</button>
                        </div>

                        <button 
                            type="submit" 
                            onClick={handleSubmitSettings.bind(this)} 
                            className={`btn btn-primary ${isSaving ? 'disabled' : ''}`}
                            disabled={isSaving}
                            style={{ opacity: isSaving ? 0.6 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
                        >
                            {isSaving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}

export default ProfileSetting;
