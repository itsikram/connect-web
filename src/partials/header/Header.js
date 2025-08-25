import React, { Fragment, useState, useEffect, useRef } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { Link, Outlet, NavLink, useParams, useLocation } from 'react-router-dom';
import MegaMC from "../../components/MegaMC";
import HeaderLeft from "./HeaderLeft";
import HeaderNav from "./HeaderNav";
import HeaderRight from "./HeaderRight";
import Ls from "../sidebar/Ls";
import $ from 'jquery'
import { setHeaderHeight } from "../../services/actions/optionAction.js";
import { useDispatch, useSelector } from "react-redux";

const Header = () => {
    const dispatch = useDispatch();
    let localtion = useLocation();
    let myProfile = useSelector(state => state.profile)
    let params = useParams();
    let headerRef = useRef(null);
    const [height, setHeight] = useState(null);

    const hrProps = { dispatch, useSelector }


    useEffect(() => {
        dispatch(setHeaderHeight(height))

    }, [height, dispatch])

    let [match, setMatch] = useState(window.matchMedia('(max-width: 768px)').matches)

    useEffect(() => {
        $(window).on('scroll', (e) => {
            if (window.pageYOffset > 100) {
                $('#header').addClass('sticky-header')
                let headerHeight = $('#header').height()
                $('#main-container').css('padding-top', headerHeight)

            } else {
                $('#header').removeClass('sticky-header')
                $('#main-container').css('padding-top', 0)
            }
        })
        if (headerRef.current) {
            setHeight(headerRef.current?.offsetHeight)
        }
        window.matchMedia("(max-width:768px)").addEventListener('change', (e) => {
            setMatch(e.matches)
        })
    }, [])


    return (
        <Fragment>
            <header ref={headerRef} className="header" id="header">
                <Container className="header-container" fluid="xxl">
                    <Row>
                        <Col className="d-flex align-items-center">
                            <HeaderLeft />
                        </Col>
                        {!match && <>
                            <Col className="header-middle" md={6} xs={2}>

                                <HeaderNav />
                            </Col>
                        </>}


                        <Col className="header-right d-flex justify-content-end align-items-center" >
                            <HeaderRight {...hrProps} />
                        </Col>
                    </Row>
                </Container>
            </header>
            <Outlet />
        </Fragment>


    )
}

export default Header;