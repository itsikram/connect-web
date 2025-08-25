import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import reportWebVitals from './reportWebVitals';
import {Provider} from 'react-redux'
import store from './store';

import * as serviceWorkerRegistration from './serviceWorkerRegistration'; // ✅


serviceWorkerRegistration.register({
  onSuccess: (registration) => {
    console.log('Service Worker registered successfully:', registration);
  },
  // onUpdate: (registration) => {
  //   console.log('New content is available; please refresh.');
  //   // Optionally show a prompt or reload:
  //   if (window.confirm('New version available. Reload now?')) {
  //     window.location.reload();
  //   }
  // }
});

if ('serviceWorker' in navigator) {
  console.log("'serviceWorker' in navigator")
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js');
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
      <App />
    </Provider>
  </React.StrictMode>
);


// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

