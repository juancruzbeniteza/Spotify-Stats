import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";
import { format } from 'date-fns';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const API_BASE = "http://localhost:5000";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [fileData, setFileData] = useState(null);
  const [stats, setStats] = useState([]);
  const [dailyRecords, setDailyRecords] = useState([]);
  const [dailyTimeMs, setDailyTimeMs] = useState(0);
  const [dateInput, setDateInput] = useState({ year: "", month: "", day: "" });
  const [dailyError, setDailyError] = useState("");
  const [archives, setArchives] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [rangeStats, setRangeStats] = useState([]);
  const [totalTimeMs, setTotalTimeMs] = useState(0);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    try {
      const response = await axios.post(`${API_BASE}/login`, { email, password });
      localStorage.setItem('token', response.data.accessToken);
      setIsLoggedIn(true);
      setError("");
      fetchStats();
      fetchArchives();
    } catch (err) {
      console.error("Login error:", err);
      setError("Invalid email or password");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/register`, { email, password });
      setError("");
      alert("Registration successful! Please login.");
    } catch (err) {
      setError("Registration failed. Email may already exist.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setStats([]);
    setArchives([]);
    setDailyRecords([]);
    setRangeStats([]);
    setStartDate(null);
    setEndDate(null);
    setDateInput({ year: "", month: "", day: "" });
  };

  const fetchArchives = async () => {
    await fetchTotalTime();
    try {
      const response = await axios.get(`${API_BASE}/archives`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setArchives(response.data.archives);
    } catch (err) {
      console.error("Error fetching archives:", err);
    }
  };

  const formatTime = (ms) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const fetchTotalTime = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(`${API_BASE}/total-time`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTotalTimeMs(res.data.total_time_ms);
    } catch (error) {
      console.error("Error fetching total time:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoggedIn(false);
        return;
      }
      const res = await axios.get(API_BASE + "/stats", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data.top_artists);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchRangeStats = async () => {
    if (!startDate || !endDate) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoggedIn(false);
        return;
      }
      
      const formattedStart = format(startDate, 'yyyy-MM-dd');
      const formattedEnd = format(endDate, 'yyyy-MM-dd');
      
      const res = await axios.get(`${API_BASE}/stats/range`, {
        params: {
          start_date: formattedStart,
          end_date: formattedEnd
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setRangeStats(res.data.top_artists);
    } catch (error) {
      console.error("Error fetching range stats:", error);
    }
  };

  const handleFileChange = (e) => {
    setFileData(e.target.files[0]);
    setUploadMessage("");
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!fileData) {
      setUploadMessage("Please select a file.");
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setIsLoggedIn(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", fileData);

    try {
      let res = await axios.post(API_BASE + "/upload", formData, {
        headers: { 
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`
        }
      });
      setUploadMessage("Success! " + res.data.inserted_records + " record(s) inserted.");
      fetchStats();
      fetchArchives();
      fetchTotalTime();
    } catch (error) {
      console.error("Upload error:", error);
      setUploadMessage("File upload failed.");
    }
  };

  const handleDateChange = (e) => {
    setDateInput({ ...dateInput, [e.target.name]: e.target.value });
    setDailyError("");
  };

  const fetchDailyTime = async (dateStr) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(`${API_BASE}/daily-time`, {
        params: { year: dateInput.year, month: dateInput.month, day: dateInput.day },
        headers: { Authorization: `Bearer ${token}` }
      });
      setDailyTimeMs(res.data.total_time_ms);
    } catch (error) {
      console.error("Error fetching daily time:", error);
    }
  };

  const fetchDailyData = async (e) => {
    e.preventDefault();
    setDailyError("");
    setDailyRecords([]);
    const { year, month, day } = dateInput;
    if (!year || !month || !day) {
      setDailyError("Please fill in year, month, and day.");
      return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      setIsLoggedIn(false);
      return;
    }

    try {
      const res = await axios.get(API_BASE + "/daily", {
        params: { year: year, month: month, day: day },
        headers: { Authorization: `Bearer ${token}` }
      });
      setDailyRecords(res.data.records);
      fetchDailyTime(dateStr);
    } catch (error) {
      console.error("Error fetching daily data:", error);
      setDailyError("Error fetching daily data.");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
      fetchStats();
      fetchArchives();
    }
  }, []);

  return (
    <div className="App">
      <h1>Spotify Archive Dashboard</h1>
      {isLoggedIn && (
        <div className="total-time">
          Total Listening Time: {formatTime(totalTimeMs)}
        </div>
      )}
      {!isLoggedIn ? (
        <div className="auth-section">
          <h2>Login / Register</h2>
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
            <button type="submit">Login</button>
            <button type="button" onClick={handleRegister}>Register</button>
          </form>
          {error && <p className="error-message">{error}</p>}
        </div>
      ) : (
        <>
          <div className="user-controls">
            <button onClick={handleLogout}>Logout</button>
          </div>

          <section className="upload-section">
            <h2>Upload Your Spotify JSON Archive</h2>
            <form onSubmit={handleFileUpload}>
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                required
              />
              <button type="submit">Upload</button>
            </form>
            {uploadMessage && <p className="upload-message">{uploadMessage}</p>}
          </section>

          <section className="range-section">
            <h2>View Stats by Date Range</h2>
            <div className="date-range-picker">
              <div>
                <label>Start Date:</label>
                <DatePicker
                  selected={startDate}
                  onChange={date => setStartDate(date)}
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  maxDate={new Date()}
                />
              </div>
              <div>
                <label>End Date:</label>
                <DatePicker
                  selected={endDate}
                  onChange={date => setEndDate(date)}
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  minDate={startDate}
                  maxDate={new Date()}
                />
              </div>
              <button onClick={fetchRangeStats}>Get Range Stats</button>
            </div>
            {rangeStats.length > 0 && (
              <div className="range-stats">
                <h3>Top Artists ({format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')})</h3>
                <ul>
                  {rangeStats.map((artist, idx) => (
                    <li key={idx}>
                      {artist.artist_name}: {artist.play_count} plays
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="archives-section">
            <h2>Your Uploaded Archives</h2>
            {archives.length > 0 ? (
              <ul>
                {archives.map(archive => (
                  <li key={archive.id}>
                    {format(new Date(archive.upload_date), 'MMM dd, yyyy HH:mm')}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No archives found. Upload your Spotify data to get started.</p>
            )}
          </section>

          <section className="stats-section">
            <h2>Your Top 10 Artists</h2>
            {stats.length > 0 ? (
              <ul>
                {stats.map((artist, idx) => (
                  <li key={idx}>
                    {artist.artist_name}: {artist.play_count} plays
                  </li>
                ))}
              </ul>
            ) : (
              <p>No stats available. Try uploading data.</p>
            )}
          </section>

          <section className="daily-section">
            <h2>View Data for a Specific Day</h2>
            {dailyTimeMs > 0 && (
              <div className="daily-time">
                Daily Listening Time: {formatTime(dailyTimeMs)}
              </div>
            )}
            <form onSubmit={fetchDailyData}>
              <input
                type="number"
                name="year"
                placeholder="Year (e.g. 2023)"
                value={dateInput.year}
                onChange={handleDateChange}
                required
              />
              <input
                type="number"
                name="month"
                placeholder="Month (1-12)"
                value={dateInput.month}
                onChange={handleDateChange}
                required
              />
              <input
                type="number"
                name="day"
                placeholder="Day (1-31)"
                value={dateInput.day}
                onChange={handleDateChange}
                required
              />
              <button type="submit">Get Daily Data</button>
            </form>
            {dailyError && <p className="error-message">{dailyError}</p>}
            {dailyRecords.length > 0 ? (
              <table className="daily-table">
                <thead>
                  <tr>
                    <th>Time Played</th>
                    <th>Song</th>
                    <th>Artist</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRecords.map((record, idx) => (
                    <tr key={idx}>
                      <td>{new Date(record.played_at).toLocaleTimeString()}</td>
                      <td>{record.track_name}</td>
                      <td>{record.artist_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No records found for that day.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default App;
