import React,{Fragment,useEffect} from "react";
import CreatePost from "./post/CreatePost";

let MegaMC = ({children,style,className}) => {
    
    return (
        <Fragment>
            <div style={{zIndex: '999',position:'absolute',boxShadow:'1px #888',display: 'none',padding: '10px',...style}} className={className}>
                {children}
            </div>
        </Fragment>
    )

}

export default MegaMC;