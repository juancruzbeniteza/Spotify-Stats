import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";
import FileUpload from "./components/FileUpload";
import StatsDisplay from "./components/StatsDisplay";
import { format } from 'date-fns';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const API_BASE = "http://localhost:5000";

// Configure axios
const configureAxios = () => {
  // Set defaults
  axios.defaults.withCredentials = true;
  axios.defaults.baseURL = API_BASE;

  // Request interceptor
  axios.interceptors.request.use(
    config => {
      // Log request details
      console.log('Making request:', {
        url: config.url,
        method: config.method,
        data: config.data instanceof FormData ? 'FormData' : config.data
      });

      // Don't set Content-Type for FormData
      if (!(config.data instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json';
      }

      // Add Authorization header if token exists
      const token = localStorage.getItem('token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
        console.log('Using token:', token.substring(0, 10) + '...');
      }

      return config;
    },
    error => {
      console.error('Request error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor
  axios.interceptors.response.use(
    response => {
      // Log response details
      console.log('Received response:', {
        url: response.config.url,
        status: response.status,
        data: response.data
      });
      return response;
    },
    error => {
      // Log error details
      console.error('Response error:', {
        config: error.config,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });

      if (error.response) {
        // Handle authentication errors
        if (error.response.status === 401 || error.response.status === 403) {
          console.log('Auth error, clearing token');
          localStorage.removeItem('token');
          window.location.reload();
        }
      }

      return Promise.reject(error);
    }
  );
};

// Initialize axios configuration
configureAxios();

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [fileData, setFileData] = useState(null);
  const [totalTimeMs, setTotalTimeMs] = useState(0);
  const [token, setToken] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const formatTime = (ms) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const fetchTotalTime = async () => {
    try {
      const res = await axios.get('/total-time');
      setTotalTimeMs(res.data.total_time_ms);
    } catch (error) {
      console.error("Error fetching total time:", error);
      setTotalTimeMs(0);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); // Clear any previous errors

    // Validate required fields
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const { data } = await axios.post('/login', { email, password });
      if (data.accessToken) {
        localStorage.setItem('token', data.accessToken);
        setToken(data.accessToken);
        setIsLoggedIn(true);
        setEmail("");
        setPassword("");
        fetchTotalTime();
      }
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage = error.response?.data?.error || "Login failed.";
      
      if (errorMessage.includes("Invalid credentials")) {
        setError("Invalid email or password. Please try again.");
      } else if (errorMessage.includes("not found")) {
        setError("Email not found. Please register first.");
      } else {
        setError(`${errorMessage} Please try again.`);
      }
      
      setPassword(""); // Clear password on failed login
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterError(""); // Clear any previous errors

    // Validate email and password
    if (!registerEmail || !registerPassword) {
      setRegisterError("Email and password are required.");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registerEmail)) {
      setRegisterError("Please enter a valid email address.");
      return;
    }

    // Password strength validation
    if (registerPassword.length < 8) {
      setRegisterError("Password must be at least 8 characters long.");
      return;
    }

    setIsRegistering(true);
    try {
      // Attempt registration
      const { data } = await axios.post('/register', { 
        email: registerEmail, 
        password: registerPassword 
      });

      if (data.id) {
        try {
          // Registration successful, attempt login
          const loginResponse = await axios.post('/login', { 
            email: registerEmail, 
            password: registerPassword 
          });

          if (loginResponse.data.accessToken) {
            localStorage.setItem('token', loginResponse.data.accessToken);
            setToken(loginResponse.data.accessToken);
            setIsLoggedIn(true);
            setShowRegister(false);
            setRegisterEmail("");
            setRegisterPassword("");
            fetchTotalTime();
          }
        } catch (loginError) {
          console.error("Auto-login error:", loginError);
          setRegisterError("Registration successful but login failed. Please try logging in manually.");
        }
      }
    } catch (error) {
      console.error("Registration error:", error);
      const errorMessage = error.response?.data?.error || "Registration failed.";
      if (errorMessage.includes("Email already exists")) {
        setRegisterError("This email is already registered. Please try logging in instead.");
      } else {
        setRegisterError(`${errorMessage} Please try again.`);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setIsLoggedIn(false);
    setTotalTimeMs(0);
    setFileData(null);
    setUploadMessage('');
  };

  const switchToRegister = () => {
    setShowRegister(true);
    setError("");
    setEmail("");
    setPassword("");
  };

  const switchToLogin = () => {
    setShowRegister(false);
    setRegisterError("");
    setRegisterEmail("");
    setRegisterPassword("");
  };

  // Check for stored token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          setToken(storedToken);
          setIsLoggedIn(true);
          await fetchTotalTime();
        } catch (error) {
          console.error('Auth check failed:', error);
          handleLogout();
        }
      }
      setIsLoading(false);
    };
    
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="App">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <h1>Spotify Stats Dashboard</h1>
      {isLoggedIn && (
        <div className="total-time">
          Total Listening Time: {formatTime(totalTimeMs)}
        </div>
      )}
      {!isLoggedIn ? (
        <div className="auth-container">
          <h2>Login / Register</h2>
          {!showRegister ? (
            <div className="login-form">
              <form onSubmit={handleLogin}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="submit" 
                  disabled={isLoggingIn}
                  className={isLoggingIn ? 'loading' : ''}
                >
                  {isLoggingIn ? 'Logging in...' : 'Login'}
                </button>
                {error && <p className="error-message">{error}</p>}
              </form>
              <button 
                className="register-button"
                onClick={switchToRegister}
              >
                Create Account
              </button>
            </div>
          ) : (
            <div className="register-form">
              <h2>Create Account</h2>
              <form onSubmit={handleRegister}>
                <input
                  type="email"
                  placeholder="Email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  required
                />
                <button 
                  type="submit"
                  disabled={isRegistering}
                  className={isRegistering ? 'loading' : ''}
                >
                  {isRegistering ? 'Creating Account...' : 'Register'}
                </button>
                {registerError && <p className="error-message">{registerError}</p>}
              </form>
              <button 
                className="back-button"
                onClick={switchToLogin}
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="user-controls">
            <button onClick={handleLogout}>Logout</button>
          </div>

          <FileUpload 
            token={token} 
            onUploadSuccess={() => {
              window.location.reload();
            }} 
          />
          <StatsDisplay token={token} />
        </>
      )}
    </div>
  );
}

export default App;
