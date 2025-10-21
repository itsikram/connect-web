import React, { Fragment, useState, useEffect, useRef } from "react";
import { Container, Col, Row } from 'react-bootstrap';
import StoryLists from "./StoryLists";
import api from "../../api/api";
import $ from 'jquery'
import { useParams, useNavigate, Outlet } from "react-router-dom";

let StoryContainer = ({children}) => {

    let { storyId } = useParams();
    // setting state to store posts data
    let [stories, setStories] = useState([])
    let storyContainer = useRef()
    let [match, setMatch] = useState(window.matchMedia('(max-width: 768px)').matches)
    const navigate = useNavigate();
    useEffect(() => {
        // window width 
        window.matchMedia("(max-width:768px)").addEventListener('change', (e) => {
            setMatch(e.matches)
        })

        api.get('/story/').then(res => {
            if (res.status === 200) {
                console.log('stories',res.data)
                // [...res.data].forEach(story => {
                //     console.log(story)
                //     if(story?.author == null) {
                //         alert(storyId)
                //     }
                // })
                setStories(res.data)
            }
        })


    }, [storyId])

    function handleNextClick(e) {
        const currentIndex = stories.findIndex(story => story?._id === storyId)
        const nextStoryId = stories[currentIndex + 1]?._id || stories[currentIndex]._id;
        navigate('/story/'+nextStoryId)

    }

    function handlePrevClick(e) {
        const currentIndex = stories.findIndex(story => story?._id === storyId)
        const prevStoryId = stories[currentIndex - 1]?._id || stories[currentIndex]._id;
        navigate('/story/'+prevStoryId)
        storyContainer.current.scrollBy({ left: 300, behavior: 'smooth' })
    }

    return (
        <Fragment>
            <Container fluid className="story-container py-3">
                <Row>
                    <Col md="3">
                        {!match && <StoryLists stories={stories}></StoryLists>}
                    </Col>

                    <Col md="6">

                        <div ref={storyContainer} className="story-content-container">


                            {storyId ?
                                
                                    <>
                                        {children}
                                        <div className="nf-story-arrow-left" onClick={handlePrevClick.bind(this)} >
                                            <i className="fa fa-chevron-left"></i>
                                        </div>
                                        <div className="nf-story-arrow-right" onClick={handleNextClick.bind(this)} >
                                            <i className="fa fa-chevron-right"></i>
                                        </div>
                                    </>
                                
                                : <p className="text-center fs-4">Select a story owner from left</p>}

                        </div>


                    </Col>
                    <Col md="3"><Outlet></Outlet></Col>

                </Row>
                {/* <Outlet></Outlet> */}
            </Container>

        </Fragment>
    )

}

export default StoryContainer;

