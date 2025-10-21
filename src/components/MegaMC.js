import React,{Fragment} from "react";

const MegaMC = ({children,style,className}) => {
    
    return (
        <Fragment>
            <div style={{zIndex: '1002',position:'absolute',boxShadow:'1px #888',display: 'none',padding: '10px',...style}} className={className}>
                {children}
            </div>
        </Fragment>
    )

}

export default MegaMC;