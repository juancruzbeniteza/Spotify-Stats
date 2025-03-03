import React, { useState } from 'react';
import axios from 'axios';
import { 
  Container, 
  Typography, 
  Paper, 
  Grid, 
  TextField,
  Button,
  Box,
  CircularProgress,
  Card,
  CardContent,
  Alert
} from '@mui/material';

const DataAnalysis = ({ token }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setError('End date must be after start date');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.get('/analyze', {
        params: {
          startDate: startDate,
          endDate: endDate
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setResults(response.data);
    } catch (error) {
      console.error('Error analyzing data:', error);
      setError('Failed to analyze data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ms) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const getDayName = (dayNumber) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber];
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4, bgcolor: 'background.paper' }}>
        <Typography variant="h4" gutterBottom align="center">
          Data Analysis
        </Typography>
        
        <Box sx={{ mb: 4 }}>
          <Typography variant="body1" gutterBottom align="center">
            Select a time period to analyze your listening habits
          </Typography>
        </Box>

        <Grid container spacing={3} justifyContent="center" sx={{ mb: 4 }}>
          <Grid item xs={12} sm={4}>
            <TextField
              type="date"
              label="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              fullWidth
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              type="date"
              label="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              fullWidth
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              variant="contained"
              onClick={handleAnalyze}
              disabled={loading || !startDate || !endDate}
              fullWidth
              sx={{ height: '56px' }}
            >
              {loading ? <CircularProgress size={24} /> : 'Analyze'}
            </Button>
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        {results && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Listening Overview
                  </Typography>
                  <Typography variant="body1">
                    Total Time: {formatTime(results.total_time)}
                  </Typography>
                  <Typography variant="body1">
                    Total Plays: {results.total_plays}
                  </Typography>
                  <Typography variant="body1">
                    Unique Artists: {results.unique_artists}
                  </Typography>
                  <Typography variant="body1">
                    Unique Tracks: {results.unique_tracks}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top Stats
                  </Typography>
                  <Typography variant="body1">
                    Most Active Day: {getDayName(results.most_active_day)}
                  </Typography>
                  <Typography variant="body1">
                    Top Artist: {results.top_artist}
                  </Typography>
                  <Typography variant="body1">
                    Top Track: {results.top_track}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {results.genre_distribution && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Genre Distribution
                    </Typography>
                    <Grid container spacing={2}>
                      {Object.entries(results.genre_distribution)
                        .sort(([, a], [, b]) => b - a)
                        .map(([genre, percentage]) => (
                          <Grid item xs={6} sm={4} md={3} key={genre}>
                            <Typography variant="body1">
                              {genre}: {(percentage * 100).toFixed(1)}%
                            </Typography>
                          </Grid>
                        ))}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        )}
      </Paper>
    </Container>
  );
};

export default DataAnalysis;
