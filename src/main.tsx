import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import { createServices } from './services'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App services={createServices()} />
  </React.StrictMode>,
)
