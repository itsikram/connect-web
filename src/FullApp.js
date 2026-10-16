import "./rtc/agoraInit";
import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter as BR } from 'react-router-dom';
import App from './App';
import store from './store';

// The whole app (feed, chat, calls, games...). Loaded as its own chunk so
// logged-out visitors on public pages never download it; see index.js.
const FullApp = () => (
  <Provider store={store}>
    <BR future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <App />
    </BR>
  </Provider>
);

export default FullApp;
