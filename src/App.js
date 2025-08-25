import React, { Fragment, useEffect } from 'react';
import Main from './pages/Main';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './assets/fontawesome/css/all.min.css';
import './assets/css/style.scss';
import process from 'process';
import { useDispatch } from 'react-redux';
import { setLogin } from './services/actions/authActions';
import { useJwt } from 'react-jwt';

window.process = process;

function App() {
  const dispatch = useDispatch();
  const user = localStorage.getItem("user") || '{}';
  const userJson = JSON.parse(user);
  const { isExpired } = useJwt(userJson.accessToken || null);

  useEffect(() => {
    if (userJson.accessToken) {
      dispatch(setLogin(userJson.accessToken));
    }

    if (isExpired) {
      dispatch(setLogin(undefined));
    }
  }, [dispatch, isExpired]);

  return (
    <Fragment>
      <Main />
    </Fragment>
  );
}

export default App;
