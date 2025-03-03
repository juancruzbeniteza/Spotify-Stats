import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Container, 
  Typography, 
  Paper, 
  List, 
  ListItem, 
  ListItemText,
  CircularProgress,
  Box
} from '@mui/material';

const GenreStats = ({ token }) => {
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGenreStats = async () => {
      try {
        const response = await axios.get('/api/genre-stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setGenres(response.data);
      } catch (error) {
        console.error('Error fetching genre stats:', error);
        setError('Failed to load genre statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchGenreStats();
  }, [token]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color="error" align="center" mt={4}>
        {error}
      </Typography>
    );
  }

  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom>
        Your Genre Preferences
      </Typography>
      <Paper elevation={3}>
        <List>
          {genres.length === 0 ? (
            <ListItem>
              <Typography variant="body1" sx={{ p: 2 }}>
                No genre data available
              </Typography>
            </ListItem>
          ) : (
            genres.map((genre, index) => (
              <ListItem key={`${genre.name}-${index}`}>
                <ListItemText 
                  primary={genre.name} 
                  secondary={`${genre.percentage.toFixed(2)}% of your listening time`} 
                />
              </ListItem>
            ))
          )}
        </List>
      </Paper>
    </Container>
  );
};

export default GenreStats;