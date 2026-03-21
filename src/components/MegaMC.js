import React,{Fragment} from "react";

const MegaMC = ({children,style,className,...rest}) => {
    
    return (
        <Fragment>
            <div style={{zIndex: '1002',position:'absolute',boxShadow:'1px #888',display: 'none',padding: '10px',...style}} className={className} {...rest}>
                {children}
            </div>
        </Fragment>
    )

}

export default MegaMC;