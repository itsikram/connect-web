import React, { Fragment, useState, useEffect, useRef } from "react";
import { Container, Col, Row } from 'react-bootstrap';
import StoryContainer from "../components/story/StoryContainer";
import StoryLists from "../components/story/StoryLists";
import SingleStory from "../components/story/SingleStory";
import api from "../api/api";
import $ from 'jquery'
import { useParams, useNavigate, Outlet } from "react-router-dom";

let Story = () => {

    // let { storyId } = useParams();
    // // setting state to store posts data
    // let [stories, setStories] = useState([])

    // useEffect(() => {
    //     // window width 

    //     api.get('/story/').then(res => {
    //         if (res.status === 200) {
    //             setStories(res.data)
    //         }
    //     })


    // }, [storyId])


    return (
        <Fragment>
           <StoryContainer></StoryContainer>

        </Fragment>
    )

}

export default Story;

