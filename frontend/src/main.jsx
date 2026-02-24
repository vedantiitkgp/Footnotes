import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/globals.css';
import './styles/themes.css';

// Apply saved theme before first paint to avoid flash
const _t = localStorage.getItem('memoir-theme');
if (_t && _t !== 'noir') document.documentElement.setAttribute('data-theme', _t);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
