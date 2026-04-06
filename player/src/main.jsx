import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/* Sin StrictMode: en desarrollo el doble montaje abre/cierra MQTT y ves "Cliente desconectado" en el broker. */
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
