import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, Button, Box, Paper, Grid, TextField } from '@mui/material';
import FileUpload from './FileUpload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import { API_BASE } from './config';
const Home = ({ isLoggedIn, token, onLogin }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const success = await onLogin(email, password);
      if (success) {
        navigate('/stats');
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSpotifyConnect = async () => {
    try {
      const response = await fetch(`${API_BASE}/spotify/auth`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error('Error connecting to Spotify:', error);
    }
  };

  if (!isLoggedIn) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper' }}>
          <Typography variant="h4" gutterBottom>
            Welcome to Spotify Stats
          </Typography>
          <Typography variant="body1" sx={{ mb: 4 }}>
            Analyze your Spotify listening history and discover insights about your music preferences.
          </Typography>
          
          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              error={!!error}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              error={!!error}
            />
            {error && (
              <Typography color="error" sx={{ mt: 1 }}>
                {error}
              </Typography>
            )}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{ mt: 3 }}
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Grid container spacing={4}>
        {/* Welcome Section */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper' }}>
            <Typography variant="h4" gutterBottom>
              Welcome to Your Music Dashboard
            </Typography>
            <Typography variant="body1">
              Connect your Spotify account or upload your listening history to get started.
            </Typography>
          </Paper>
        </Grid>

        {/* Connect & Upload Section */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 4, height: '100%', bgcolor: 'background.paper' }}>
            <Typography variant="h5" gutterBottom>
              Connect with Spotify
            </Typography>
            <Typography variant="body1" sx={{ mb: 3 }}>
              Link your Spotify account to analyze your current listening habits.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<MusicNoteIcon />}
              onClick={handleSpotifyConnect}
              fullWidth
              sx={{ mb: 2 }}
            >
              Connect Spotify Account
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 4, height: '100%', bgcolor: 'background.paper' }}>
            <Typography variant="h5" gutterBottom>
              Upload History
            </Typography>
            <Typography variant="body1" sx={{ mb: 3 }}>
              Upload your Spotify data files to analyze your listening history.
            </Typography>
            <FileUpload token={token} />
          </Paper>
        </Grid>

        {/* Features Section */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 4, bgcolor: 'background.paper' }}>
            <Typography variant="h5" gutterBottom align="center">
              Features
            </Typography>
            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <QueryStatsIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="h6">Detailed Analytics</Typography>
                  <Typography variant="body2">
                    View your top artists, songs, and listening patterns
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <CloudUploadIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="h6">Easy Upload</Typography>
                  <Typography variant="body2">
                    Simply upload your Spotify data files to get started
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <MusicNoteIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="h6">Music Insights</Typography>
                  <Typography variant="body2">
                    Discover patterns in your music preferences
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Home;
