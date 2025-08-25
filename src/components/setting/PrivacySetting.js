import React from 'react';

const PrivacySetting = () => {
    return (
        <>
            <div className='profile-setting'>
                <div className='setting-field-container'>
                    <h3 className='text-center'>Privacy Settings</h3>
                    <form>

                        <div className="form-group mb-2">
                            <label for="username">Who Can See you Posts?</label>
                            <select className='form-control'>
                                <option  value='om'>Only Me</option>
                                <option value='fof'>Friend of Friends</option>
                                <option value='public'>Public</option>
                            </select>
                        </div>
                        <div className="form-group mb-2">
                            <label for="username">Who Can Sent you Friend Request?</label>
                            <select className='form-control'>
                                <option  value='om'>Only Me</option>
                                <option value='fof'>Friend of Friends</option>
                                <option value='public'>Public</option>
                            </select>
                        </div>
                        <div className="form-group mb-2">
                            <label for="username">Who Can Post on your Timeline?</label>
                            <select className='form-control'>
                                <option  value='om'>Only Me</option>
                                <option value='fof'>Friend of Friends</option>
                                <option value='public'>Public</option>
                            </select>
                        </div>



                        <button type="submit" className="btn btn-primary">Save Settings</button>
                    </form>
                </div>
            </div>
        </>
    );
}

export default PrivacySetting;
