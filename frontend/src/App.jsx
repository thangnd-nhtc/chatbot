import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ChatView from './pages/ChatView';
import AdminView from './pages/AdminView';
import LoginView from './pages/LoginView';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<ChatView />} />
          <Route path="/admin" element={<AdminView />} />
          <Route path="/login" element={<LoginView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
