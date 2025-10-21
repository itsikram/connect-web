import React,{useEffect,useState} from 'react';
import { Container,Row,Col } from 'react-bootstrap';
import LeftSidebar from '../../partials/sidebar/Ls';
import { Outlet } from 'react-router-dom';

const PostContainer = ({ children }) => {
    let [match, setMatch] = useState(window.matchMedia('(max-width: 768px)').matches)

    useEffect(() => {
        // window width 
        window.matchMedia("(max-width:768px)").addEventListener('change', (e) => {
            setMatch(e.matches)
        })
    }, [])

    return (
        <div>
            <Container fluid>
                <Row>
                    <Col md="3">
                        {!match && <LeftSidebar />}
                    </Col>

                    <Col md="6">
                        <div id="post-container">

                            {children}

                        </div>

                    </Col>


                    <Col md="3">

                    </Col>

                </Row>

            </Container>
        </div>
    );
}

export default PostContainer;
