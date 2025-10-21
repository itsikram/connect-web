import React from 'react';

const NotificationSetting = () => {
    return (
        <>
            <div className='message-setting'>
                <div className='setting-field-container'>
                    <h3 className='text-center'>Notification Settings</h3>
                    <form>
                        <div className="form-check form-switch my-3">
                            <input type="checkbox" className="form-check-input" id="friendRewReceived" />
                            <label className="form-check-label" for="friendRewReceived">Friends Request Received</label>
                            <br />
                            <small id="friendRewReceived" className="form-text text-muted">We Will sent you notification for each new Friends Request Received</small>
                        </div>
                        <div className="form-check form-switch my-3">
                            <input type="checkbox" className="form-check-input" id="friendRewAccepted" />
                            <label className="form-check-label" for="friendRewAccepted">Friends Request Accpeted</label>
                            <br />
                            <small id="ifriendRewAcceptedHelp" className="form-text text-muted">We Will sent you notification for each new Friends Request Accpeted</small>
                        </div>
                        <div className="form-check form-switch my-3">
                            <input type="checkbox" className="form-check-input" id="newMessageReceived" />
                            <label className="form-check-label" for="newMessageReceived">New Message Received</label>
                            <br />
                            <small id="isNotificationHelp" className="form-text text-muted">We Will sent you notification for each Message Received</small>
                        </div>
                        <div className="form-check form-switch my-3">
                            <input type="checkbox" className="form-check-input" id="newFriendPost" />
                            <label className="form-check-label" for="newFriendPost">New Frieds's Post</label>
                            <br />
                            <small id="isNotificationHelp" className="form-text text-muted">We Will sent you notification for each Frieds's new Post</small>
                        </div>
                        <div className="form-check form-switch my-3">
                            <input type="checkbox" className="form-check-input" id="newFriendStory" />
                            <label className="form-check-label" for="newFriendStory">New Frieds's Story</label>
                            <br />
                            <small id="isNotificationHelp" className="form-text text-muted">We Will sent you notification for each Frieds's new Story</small>
                        </div>
                        <div className="form-check form-switch my-3">
                            <input type="checkbox" className="form-check-input" id="newFriendWatch" />
                            <label className="form-check-label" for="newFriendWatch">New Frieds's Watch</label>
                            <br />
                            <small id="newFriendWatchHelp" className="form-text text-muted">We Will sent you notification for each Frieds's new Watch</small>
                        </div>

                        <hr/>

                        <h4 className='text-center'>Email Notifications</h4>

                        <div className="form-check form-switch my-3">
                            <input type="checkbox" className="form-check-input" id="friendRewReceivedEmail" />
                            <label className="form-check-label" for="friendRewReceivedEmail">Friends Request Received</label>
                            <br />
                            <small id="friendRewReceivedEmail" className="form-text text-muted">We Will sent you notification for each new Friends Request Received</small>
                        </div>
                        <div className="form-check form-switch my-3">
                            <input type="checkbox" className="form-check-input" id="friendRewAcceptedEmail" />
                            <label className="form-check-label" for="friendRewAcceptedEmail">Friends Request Accpeted</label>
                            <br />
                            <small id="ifriendRewAcceptedEmailHelp" className="form-text text-muted">We Will sent you notification for each new Friends Request Accpeted</small>
                        </div>
                        <div className="form-check form-switch my-3">
                            <input type="checkbox" className="form-check-input" id="newMessageReceivedEmail" />
                            <label className="form-check-label" for="newMessageReceivedEmail">New Message Received</label>
                            <br />
                            <small id="isNotificationEmailHelp" className="form-text text-muted">We Will sent you notification for each Message Received</small>
                        </div>
                        <div className="form-check form-switch my-3">
                            <input type="checkbox" className="form-check-input" id="newFriendPostEmail" />
                            <label className="form-check-label" for="newFriendPostEmail">New Frieds's Post</label>
                            <br />
                            <small id="newFriendPostEmailHelp" className="form-text text-muted">We Will sent you notification for each Frieds's new Post</small>
                        </div>
                        <div className="form-check form-switch my-3">
                            <input type="checkbox" className="form-check-input" id="newFriendStoryEmail" />
                            <label className="form-check-label" for="newFriendStoryEmail">New Frieds's Story</label>
                            <br />
                            <small id="isNotificationHelp" className="form-text text-muted">We Will sent you notification for each Frieds's new Story</small>
                        </div>
                        <div className="form-check form-switch my-3">
                            <input type="checkbox" className="form-check-input" id="newFriendWatchEmail" />
                            <label className="form-check-label" for="newFriendWatchEmail">New Frieds's Watch</label>
                            <br />
                            <small id="newFriendWatchHelp" className="form-text text-muted">We Will sent you notification for each Frieds's new Watch</small>
                        </div>

                        <button type="submit" className="btn btn-primary">Save Settings</button>
                    </form>
                </div>
            </div>
        </>
    );
}

export default NotificationSetting;
