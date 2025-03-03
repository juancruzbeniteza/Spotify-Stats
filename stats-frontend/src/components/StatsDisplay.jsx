import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { 
  Container, 
  Typography, 
  Tabs, 
  Tab, 
  Box, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  CircularProgress, 
  Button,
  Grid
} from '@mui/material';
import '../App.css';
import { API_BASE } from './config';


const StatsDisplay = ({ token, onRef }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [archives, setArchives] = useState([]);
  const [stats, setStats] = useState({
    topArtists: [],
    topTracks: [],
    topAlbums: [],
    platformStats: [],
    listeningPatterns: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    setError('');
    try {
      const [timeResponse, archivesResponse, statsResponse] = await Promise.all([
        axios.get(`${API_BASE}/total-time`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE}/archives`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE}/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setTotalTime(timeResponse.data.total_time_ms);
      setArchives(archivesResponse.data.archives);
      setStats(statsResponse.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError('Failed to load your stats. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchStats();
    }
    
    if (onRef) {
      onRef({ refresh: fetchStats });
    }
    return () => {
      if (onRef) {
        onRef(null);
      }
    };
  }, [token, fetchStats, onRef]);

  const handleClearData = useCallback(async () => {
    if (!window.confirm('Are you sure you want to clear all your data? This action cannot be undone.')) {
      return;
    }

    setClearing(true);
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/clear-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchStats();
    } catch (error) {
      console.error('Error clearing data:', error);
      setError('Failed to clear data. Please try again.');
    } finally {
      setClearing(false);
      setLoading(false);
    }
  }, [token, fetchStats]);

  const formatTime = (ms) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const TabPanel = ({ children, value, index }) => (
    <Box role="tabpanel" hidden={value !== index} sx={{ p: 3 }}>
      {value === index && children}
    </Box>
  );

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress sx={{ color: '#1DB954' }} />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Typography color="error" align="center" gutterBottom>
          {error}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button 
            onClick={fetchStats} 
            variant="contained" 
            sx={{ 
              bgcolor: '#1DB954',
              '&:hover': { bgcolor: '#1ed760' }
            }}
          >
            Try Again
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom align="center" sx={{ color: '#fff' }}>
        Your Spotify Stats
      </Typography>

      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        px: 2
      }}>
        <Typography variant="h6" sx={{ color: '#1DB954' }}>
          Total Listening Time: {formatTime(totalTime)}
        </Typography>
        <Box>
          <Button 
            onClick={fetchStats} 
            variant="outlined" 
            sx={{ 
              mr: 2,
              color: '#1DB954',
              borderColor: '#1DB954',
              '&:hover': {
                borderColor: '#1ed760',
                color: '#1ed760'
              }
            }}
          >
            Refresh Stats
          </Button>
          <Button 
            onClick={handleClearData} 
            variant="outlined" 
            color="error" 
            disabled={clearing}
          >
            {clearing ? 'Clearing...' : 'Clear All Data'}
          </Button>
        </Box>
      </Box>

      <Paper 
        elevation={3} 
        sx={{ 
          bgcolor: 'rgba(30, 30, 30, 0.9)',
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)} 
          centered
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              color: 'rgba(255, 255, 255, 0.7)',
              '&.Mui-selected': {
                color: '#1DB954'
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#1DB954'
            }
          }}
        >
          <Tab label="Top Artists" />
          <Tab label="Top Tracks" />
          <Tab label="Top Albums" />
          <Tab label="Platforms" />
          <Tab label="Patterns" />
          <Tab label="Uploads" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <List>
            {stats.topArtists?.map((artist, index) => (
              <ListItem 
                key={index} 
                divider 
                sx={{ 
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
                }}
              >
                <ListItemText
                  primary={
                    <Typography variant="h6" sx={{ color: '#fff' }}>
                      {index + 1}. {artist.artist_name}
                    </Typography>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        {artist.play_count} plays • {formatTime(artist.total_time)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        {artist.albums?.split(',').length || 0} albums • {artist.platforms_used} platforms
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <List>
            {stats.topTracks?.map((track, index) => (
              <ListItem 
                key={index} 
                divider
                sx={{ 
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
                }}
              >
                <ListItemText
                  primary={
                    <Typography variant="h6" sx={{ color: '#fff' }}>
                      {index + 1}. {track.track_name}
                    </Typography>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        by {track.artist_name} • {track.play_count} plays • {formatTime(track.total_time)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        {track.platforms_used} platforms • Skipped: {track.skipped_count} times
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <List>
            {stats.topAlbums?.map((album, index) => (
              <ListItem 
                key={index} 
                divider
                sx={{ 
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
                }}
              >
                <ListItemText
                  primary={
                    <Typography variant="h6" sx={{ color: '#fff' }}>
                      {index + 1}. {album.album_name}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      by {album.artist_name} • {album.play_count} plays • {formatTime(album.total_time)}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <List>
            {stats.platformStats?.map((platform, index) => (
              <ListItem 
                key={index} 
                divider
                sx={{ 
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
                }}
              >
                <ListItemText
                  primary={
                    <Typography variant="h6" sx={{ color: '#fff' }}>
                      {platform.platform}
                    </Typography>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        {platform.play_count} plays • {formatTime(platform.total_time)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        {platform.unique_tracks} tracks • {platform.unique_artists} artists
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
          <Grid container spacing={2}>
            {stats.listeningPatterns?.map((pattern) => (
              <Grid item xs={12} sm={6} md={4} key={pattern.hour}>
                <Paper 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'rgba(40, 40, 40, 0.9)',
                    '&:hover': { bgcolor: 'rgba(50, 50, 50, 0.9)' }
                  }}
                >
                  <Typography variant="h6" sx={{ color: '#fff' }}>
                    {pattern.hour}:00
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    {pattern.play_count} plays
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Shuffle: {(pattern.shuffle_ratio * 100).toFixed(1)}% • 
                    Skipped: {(pattern.skip_ratio * 100).toFixed(1)}%
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={5}>
          <List>
            {archives.map((archive) => (
              <ListItem 
                key={archive.id} 
                divider
                sx={{ 
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
                }}
              >
                <ListItemText
                  primary={
                    <Typography variant="h6" sx={{ color: '#fff' }}>
                      {archive.file_path.split('/').pop()}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      Uploaded on {format(new Date(archive.upload_date), 'MMM d, yyyy')}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default StatsDisplay;
