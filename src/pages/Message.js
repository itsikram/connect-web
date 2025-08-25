import React, { Fragment, useEffect,useState } from 'react'
import { Container, Row, Col } from "react-bootstrap";
import MessageList from "../components/Message/MessageList";
import MessageBody from '../components/Message/MessageBody';
import MessageOptions from '../components/Message/MessageOptions.';

const Message = (props) => {

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

    return (
        <Fragment>
            <div id={"message"}>
                <Container fluid>
                    <Row style={{ minHeight: '400px' }}>
                        {!isMobile &&
                        <Col md="3">
                            <MessageList></MessageList>
                        </Col>}
                        <Col md="6">
                            <MessageBody cameraVideoRef={props.cameraVideoRef}>

                            </MessageBody>
                        </Col>
                        {!isMobile &&

                        <Col md="3">
                            <MessageOptions></MessageOptions>
                        </Col>}
                    </Row>
                </Container>
            </div>
        </Fragment>
    )
}


export default Message