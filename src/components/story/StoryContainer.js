import React, { Fragment, useState, useEffect, useRef } from "react";
import { Container, Col, Row } from 'react-bootstrap';
import StoryLists from "./StoryLists";
import api from "../../api/api";
import { useParams, useNavigate, Outlet } from "react-router-dom";

let StoryContainer = ({ children, sidebar }) => {
    let { storyId } = useParams();
    let [stories, setStories] = useState([])
    let storyContainer = useRef()
    let [match, setMatch] = useState(window.matchMedia('(max-width: 768px)').matches)
    const navigate = useNavigate();
    const hasSidebar = Boolean(sidebar);

    useEffect(() => {
        window.matchMedia("(max-width:768px)").addEventListener('change', (e) => {
            setMatch(e.matches)
        })

        api.get('/story/').then(res => {
            if (res.status === 200) {
                setStories(res.data)
            }
        })
    }, [storyId])

    function handleNextClick() {
        const currentIndex = stories.findIndex(story => story?._id === storyId)
        const nextStoryId = stories[currentIndex + 1]?._id || stories[currentIndex]._id;
        navigate('/story/' + nextStoryId)
    }

    function handlePrevClick() {
        const currentIndex = stories.findIndex(story => story?._id === storyId)
        const prevStoryId = stories[currentIndex - 1]?._id || stories[currentIndex]._id;
        navigate('/story/' + prevStoryId)
        storyContainer.current?.scrollBy({ left: 300, behavior: 'smooth' })
    }

    return (
        <Fragment>
            <Container fluid className={`story-container py-3 ${hasSidebar ? 'has-story-sidebar' : ''}`}>
                <Row className={hasSidebar ? 'story-layout-row' : ''}>
                    <Col lg="3" className={hasSidebar ? 'd-none d-lg-block' : undefined}>
                        {!match && <StoryLists stories={stories}></StoryLists>}
                    </Col>

                    <Col lg={hasSidebar ? 5 : 6} md={hasSidebar ? 7 : 6} xs="12">
                        <div ref={storyContainer} className="story-content-container">
                            {storyId ?
                                <>
                                    {children}
                                    <div className="nf-story-arrow-left" onClick={handlePrevClick}>
                                        <i className="fa fa-chevron-left"></i>
                                    </div>
                                    <div className="nf-story-arrow-right" onClick={handleNextClick}>
                                        <i className="fa fa-chevron-right"></i>
                                    </div>
                                </>
                                : <p className="text-center fs-4">Select a story owner from left</p>}
                        </div>
                    </Col>

                    {hasSidebar ? (
                        <Col lg="4" md="5" xs="12" className="story-engagement-col">
                            {sidebar}
                        </Col>
                    ) : (
                        <Col md="3"><Outlet></Outlet></Col>
                    )}
                </Row>
            </Container>
        </Fragment>
    )
}

export default StoryContainer;
