import React, {Fragment, useEffect, useState} from "react";




let Groups = () => {

    // useEffect(()=> {
    //
    //     socket.on('receive_message',(data) => {
    //         console.log(data.message)
    //     })
    // },[socket])
    
    // const [username,setUsername] = useState("")
    // const [room,setRoom] = useState("")

    // const [input,setInput] = useState("")


    // let joinRoom = () => {

    //     if(username !== "" && room !== ""){
    //         socket.emit('join_room',room)
    //     }
    // }
    // let sendMessage = async(e) => {
    //     socket.emit('send_message',{message: input})
    // }


    return (
        <Fragment>
            {/* <div>
                <input placeholder="Username" type="text" onKeyUp={(e)=>{
                    setUsername(e.target.value)
                }
                } name="userName"/><br/>
                <input type="text" placeholder="Room Id" onKeyUp={(e)=> {
                    setRoom(e.target.value)
                }
                } name="message_field"/><br/>
                <input type="submit" onClick={joinRoom}/>
            </div>
            <div style={{display: "none"}} className="messages">
                <h3>all messages</h3>
                <ul>
                    <li> one </li>
                    <li> one </li>

                    <li> one </li>

                </ul>
            </div>

            <Chat room={room} socket={socket} username={username}></Chat> */}
        </Fragment>
    )
}

export default Groups;