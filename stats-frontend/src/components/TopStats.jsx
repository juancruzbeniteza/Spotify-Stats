import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Typography, Tabs, Tab, Box } from '@mui/material';

const TopStats = ({ token }) => {
  const [value, setValue] = useState(0);
  const [topArtists, setTopArtists] = useState([]);
  const [topSongs, setTopSongs] = useState([]);
  const [topAlbums, setTopAlbums] = useState([]);

  useEffect(() => {
    const fetchTopStats = async () => {
      try {
        const [artistsResponse, songsResponse, albumsResponse] = await Promise.all([
          axios.get('/api/top-artists', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('/api/top-songs', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('/api/top-albums', { headers: { Authorization: `Bearer ${token}` } })
        ]);

        setTopArtists(artistsResponse.data);
        setTopSongs(songsResponse.data);
        setTopAlbums(albumsResponse.data);
      } catch (error) {
        console.error('Error fetching top stats:', error);
      }
    };

    fetchTopStats();
  }, [token]);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  const TabPanel = (props) => {
    const { children, value, index, ...other } = props;

    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`simple-tabpanel-${index}`}
        aria-labelledby={`simple-tab-${index}`}
        {...other}
      >
        {value === index && (
          <Box sx={{ p: 3 }}>
            <Typography>{children}</Typography>
          </Box>
        )}
      </div>
    );
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom>
        Your Top Stats
      </Typography>
      <Tabs value={value} onChange={handleChange} centered>
        <Tab label="Top Artists" />
        <Tab label="Top Songs" />
        <Tab label="Top Albums" />
      </Tabs>
      <TabPanel value={value} index={0}>
        <ul>
          {topArtists.map((artist, index) => (
            <li key={index}>{artist.name} - {artist.playCount} plays</li>
          ))}
        </ul>
      </TabPanel>
      <TabPanel value={value} index={1}>
        <ul>
          {topSongs.map((song, index) => (
            <li key={index}>{song.name} by {song.artist} - {song.playCount} plays</li>
          ))}
        </ul>
      </TabPanel>
      <TabPanel value={value} index={2}>
        <ul>
          {topAlbums.map((album, index) => (
            <li key={index}>{album.name} by {album.artist} - {album.playCount} plays</li>
          ))}
        </ul>
      </TabPanel>
    </Container>
  );
};

export default TopStats;
