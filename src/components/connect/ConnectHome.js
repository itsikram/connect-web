import React,{Fragment} from "react";
import ConnectRequests from "./ConnectRequests";
import ConnectsSuggest from "./ConnectSuggest";
import ConnectSentRequests from "./ConnectSentRequests";

let ConnectHome = () => {
    return (
        <Fragment>
            <ConnectRequests/>
            <ConnectSentRequests/>
            <ConnectsSuggest/>
        </Fragment>
    )
}


export default ConnectHome;