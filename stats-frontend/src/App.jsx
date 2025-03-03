import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, CircularProgress, Box } from '@mui/material';
import "./App.css";

// Components
import Navbar from "./components/Navbar";
import Home from "./components/Home";
import StatsDisplay from "./components/StatsDisplay";
import DataAnalysis from "./components/DataAnalysis";
import Profile from "./components/Profile";

const API_BASE = "http://localhost:5000";

// Configure axios defaults
axios.defaults.baseURL = API_BASE;
axios.defaults.withCredentials = true;

// Create theme
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1DB954',
    },
    secondary: {
      main: '#535353',
    },
    background: {
      default: '#121212',
      paper: '#181818',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          // Set default auth header
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          // Verify token with backend
          await axios.get('/verify-token');
          
          setToken(storedToken);
          setIsLoggedIn(true);
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogin = async (email, password) => {
    try {
      const response = await axios.post('/login', { email, password });
      const { accessToken } = response.data;
      
      localStorage.setItem('token', accessToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      
      setToken(accessToken);
      setIsLoggedIn(true);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setIsLoggedIn(false);
  };

  if (isLoading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '100vh',
          bgcolor: 'background.default'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }
}

export default App;
