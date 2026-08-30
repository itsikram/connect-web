import React, { Fragment, useState, useEffect, useRef } from "react";
import { Container, Row, Col } from "react-bootstrap";
import {
  Link,
  Outlet,
  NavLink,
  useParams,
  useLocation,
} from "react-router-dom";
import MegaMC from "../../components/MegaMC";
import HeaderLeft from "./HeaderLeft";
import HeaderNav from "./HeaderNav";
import HeaderRight from "./HeaderRight";
import Ls from "../sidebar/Ls";
import { setHeaderHeight } from "../../services/actions/optionAction.js";
import { useDispatch, useSelector } from "react-redux";

const Header = ({ pendingLudoInvites = [], pendingChessInvites = [], onAIAgentOpen }) => {
  const dispatch = useDispatch();
  let localtion = useLocation();
  let myProfile = useSelector((state) => state.profile);
  let params = useParams();
  let headerRef = useRef(null);
  const [height, setHeight] = useState(null);

  const hrProps = { dispatch, useSelector, pendingLudoInvites, pendingChessInvites };

  useEffect(() => {
    dispatch(setHeaderHeight(height));
    if (height != null) {
      document.documentElement.style.setProperty(
        "--site-header-height",
        `${Math.ceil(height)}px`,
      );
    }
  }, [height, dispatch]);

  let [match, setMatch] = useState(
    window.matchMedia("(max-width: 768px)").matches,
  );

  useEffect(() => {
    const headerEl = headerRef.current;
    const mainEl = document.getElementById("main-container");
    let ticking = false;

    const applyStuckState = () => {
      ticking = false;
      const shouldStick = window.scrollY > 80;
      if (headerEl) {
        headerEl.classList.toggle("sticky-header", shouldStick);
      }
      if (mainEl) {
        mainEl.classList.toggle("header-stuck", shouldStick);
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(applyStuckState);
    };

    if (headerEl) {
      setHeight(headerEl.offsetHeight);
    }
    applyStuckState();
    window.addEventListener("scroll", onScroll, { passive: true });

    const media = window.matchMedia("(max-width:768px)");
    const onMedia = (e) => setMatch(e.matches);
    media.addEventListener("change", onMedia);

    return () => {
      window.removeEventListener("scroll", onScroll);
      media.removeEventListener("change", onMedia);
    };
  }, []);

  return (
    <Fragment>
      <header ref={headerRef} className="header" id="header">
        <Container className="header-container" fluid="xxl">
          <Row>
            <Col className="d-flex align-items-center">
              <HeaderLeft onAIAgentOpen={onAIAgentOpen} />
            </Col>
            {!match && (
              <>
                <Col className="header-middle" md={6} xs={2}>
                  <HeaderNav />
                </Col>
              </>
            )}

            <Col className="header-right d-flex justify-content-end align-items-center">
              <HeaderRight {...hrProps} />
            </Col>
          </Row>
        </Container>
      </header>
      <Outlet />
    </Fragment>
  );
};

export default Header;
