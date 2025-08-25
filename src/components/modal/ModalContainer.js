import React,{Fragment,useState,useEffect} from "react";
import Modal from "react-modal";
import $ from 'jquery'

Modal.setAppElement('#root')

let ModalContainer = ({children,title,style,isOpen,onRequestClose,id,onClose},props) => {

let subtitle = title || 'Modal'


const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = (e) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
};

var isMobile = useMediaQuery("(max-width: 768px)");


  const customStyles = {
    content: {
      top: '50%',
      left: '50%',
      right: 'auto',
      bottom: 'auto',
      marginRight: '-50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'rgb(36,37,38)',
      zIndex: '99',
      maxHeight: '100%',
      ...style,
      width: isMobile ? '95%' : '600px',
    },
    overlay: {
      backgroundColor: "rgba(0,0,0,0.8)",
      zIndex: '999'
    }
  };

  let closeModal  = (e) => {
    let target = e.currentTarget
  }

 

  return (
        <div>
          <Modal
            shouldCloseOnOverlayClick={true}
            shouldCloseOnEsc ={true}
            style={customStyles} 
            isOpen={isOpen}
            onRequestClose={onRequestClose}
            id = {id || "profile-modal"}
          >
            {children}
          </Modal>
        </div>
      );
}

export default ModalContainer