import React,{Fragment} from "react";
import FriendRequests from "./FriendRequests";
import FriendsSuggest from "./FriendSuggest";

let FriendHome = () => {
    return (
        <Fragment>
            <FriendRequests/>
            <FriendsSuggest/>
        </Fragment>
    )
}


export default FriendHome;