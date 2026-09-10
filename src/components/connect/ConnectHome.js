import React,{Fragment} from "react";
import ConnectRequests from "./ConnectRequests";
import ConnectsSuggest from "./ConnectSuggest";

let ConnectHome = () => {
    return (
        <Fragment>
            <ConnectRequests/>
            <ConnectsSuggest/>
        </Fragment>
    )
}


export default ConnectHome;