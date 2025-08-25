import React, { Fragment, useEffect, useState } from 'react';
import UserPP from '../UserPP';
import $ from 'jquery'
import {io} from 'socket.io-client'
import { useParams } from 'react-router-dom';
import api from '../../api/api';

const URL = serverConfig
const socket = io.connect(URL)


const ChatBox = (props) => {

    let friendProfile = props.profileData

    useEffect(function (param) {  })

    // handle new messag state
    const [newMessage, setNewMessage] = useState("")



    // handle new message focus

    let newMessageFocus = (e) => {
        let targetNode = e.currentTarget
        let value = e.target.value

        $(targetNode).parents('.new-message-input-container').siblings('.message-action-button-container').addClass('message-focus')

    }


    //handle new message blur

    let newMessageBlur = async(e) => {
        let targetNode = e.currentTarget
        let value = e.target.value
        if( value.length < 1) {
            $(targetNode).parents('.new-message-input-container').siblings('.message-action-button-container').removeClass('message-focus')
        }

    }

    // handle new message on change 

    let newMessageChange = async(e) => {
        let value = e.target.value;
        if(e.which === 13){
            $(e.currentTarget).val('')
        }
        setNewMessage(value)
    }

    // handle on click send button 

    let sendButtonClick = async(e) => {
    }


    // handle socket emit
        
    const [username,setUsername] = useState("")
    const [room,setRoom] = useState("")

    const [input,setInput] = useState("")


    let joinRoom = () => {

        if(username !== "" && room !== ""){
            socket.emit('join_room',room)
        }
    }
    let sendMessage = async(e) => {
        socket.emit('send_message',{message: input})
    }

    return (
        <Fragment>
            <div id="chatBox">
                <div className='chat-header'>
                    <div className='chat-header-user'>
                        <div className='chat-header-profilePic'>
                            <UserPP profilePic={`${friendProfile.profilePic}`} profile={friendProfile._id} active></UserPP>
                        </div>
                        <div className='chat-header-user-info'>
                            <h4 className='chat-header-username'> {`${friendProfile.user && friendProfile.user.firstName} ${friendProfile.user && friendProfile.user.surname}`}</h4>
                            <span className='chat-header-active-status'>Active Now</span>
                        </div>
                    </div>


                    <div className='chat-header-action'>
                        <div className='chat-header-action-btn-container'>
                            <div className='call-button action-button'>
                                <i className="fas fa-phone-alt"></i>
                            </div>
                            <div className='video-call-button action-button'>
                                <i className="fas fa-video"></i>
                            </div>
                            <div className='info-button action-button'>
                                <i className="fas fa-info-circle"></i>
                            </div>
                        </div>
                    </div>

            </div>
            <div> 
                <div className='chat-body'>
                    <div className='chat-message-list'> 
                        <div className='chat-message-container message-sent'>

                            <div className='chat-message-profilePic'>
                                <UserPP profile={friendProfile._id}></UserPP>    
                            </div>
                        <div className='chat-message'> Message Receive </div>
                            <div className='chat-message-options'>
                                <div className='chat-message-options-button reply'> 
                                    <i className="fas fa-reply"></i>
                                </div>
                                <div className='chat-message-options-button reply'> 
                                    <i className="fas fa-ellipsis-v"></i>
                                </div>
                            </div>
                            {/* <div className='chat-message-seen-status'>
                                Seen
                            </div> */}
                        </div>


                        <div className='chat-message-container message-receive'>
                            <div className='chat-message-options'>
                                    <div className='chat-message-options-button reply'> 
                                        <i className="fas fa-reply"></i>
                                    </div>
                                    <div className='chat-message-options-button reply'> 
                                        <i className="fas fa-ellipsis-v"></i>
                                    </div>
                                </div>
                            <div className='chat-message'> Message Receive </div>

                                <div className='chat-message-seen-status'>
                                    Seen
                                </div>
                        </div>


                        <div className='chat-message-container message-sent'>

                        <div className='chat-message-profilePic'>
                            <UserPP profile={friendProfile._id}></UserPP>    
                        </div>
                        <div className='chat-message'> Message Receive </div>
                        <div className='chat-message-options'>
                            <div className='chat-message-options-button reply'> 
                                <i className="fas fa-reply"></i>
                            </div>
                            <div className='chat-message-options-button reply'> 
                                <i className="fas fa-ellipsis-v"></i>
                            </div>
                        </div>
                        <div className='chat-message-seen-status'>
                            Seen
                        </div>
                        </div>


                        <div className='chat-message-container message-receive'>
                        <div className='chat-message-options'>
                                    <div className='chat-message-options-button reply'> 
                                        <i className="fas fa-reply"></i>
                                    </div>
                                    <div className='chat-message-options-button reply'> 
                                        <i className="fas fa-ellipsis-v"></i>
                                    </div>
                                </div>
                            <div className='chat-message'> Message Receive </div>

                                <div className='chat-message-seen-status'>
                                    Seen
                                </div>
                        </div>

 

                    </div>
                </div>

            </div>

            <div className="chat-footer">
                <div className="new-message-container">

                    <div className='chat-new-attachment'>
                        <div className='chat-atachment-button-container'>

                        <div className='chat-attachment-button'>
                            <i className="fas fa-plus-circle"></i>
                            </div>

                            <div className='chat-attachment-button'>
                            <i className="fas fa-images"></i>
                        </div>

                        <div className='chat-attachment-button'>
                                <i className="fas fa-microphone"></i>
                        </div>
                        </div>


                    </div>
                    <div className='new-message-form'>
                        <div className='new-message-input-container'>
                            <input placeholder='Send Message....' onFocus={newMessageFocus} onKeyUp={newMessageChange} onBlur={newMessageBlur} className='new-message-input'/>
                        </div>
                        <div className='message-action-button-container'>
                            <div onClick={sendButtonClick} className='message-action-button send-message'>
                                <i className="fas fa-paper-plane"></i>
                            </div>
                            <div onClick={likeButtonClick} className='message-action-button send-like'>
                                <i className="fas fa-thumbs-up"></i>
                            </div>

                        </div>
                    </div>

                </div>

            </div>
            </div>
        </Fragment>
    );
}

export default ChatBox;
