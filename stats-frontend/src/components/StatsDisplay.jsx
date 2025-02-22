import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import '../App.css';

const API_BASE = "http://localhost:5000";

const StatsDisplay = ({ token }) => {
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

  const fetchStats = async () => {
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

      setTotalTime(timeResponse.data.total_time_ms || 0);
      setArchives(archivesResponse.data.archives || []);
      setStats(statsResponse.data || {});
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError(error.response?.data?.error || 'Failed to load your stats');
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to clear all your data? This action cannot be undone.')) {
      return;
    }

    setClearing(true);
    try {
      await axios.delete(`${API_BASE}/clear-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reset all states
      setTotalTime(0);
      setArchives([]);
      setStats({
        topArtists: [],
        topTracks: [],
        topAlbums: [],
        platformStats: [],
        listeningPatterns: []
      });
    } catch (error) {
      console.error('Error clearing data:', error);
      setError('Failed to clear data. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [token]);

  const formatTime = (ms) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatPercentage = (ratio) => {
    return `${(ratio * 100).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="stats-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading your stats...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-container">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={fetchStats} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-container">
      <div className="total-time-section">
        <div className="total-time-header">
          <h2>Total Listening Time</h2>
          <button 
            onClick={handleClearData}
            className="clear-data-button"
            disabled={clearing}
          >
            {clearing ? 'Clearing...' : 'Clear All Data'}
          </button>
        </div>
        <p className="time-display">{formatTime(totalTime)}</p>
      </div>

      <div className="top-artists-section">
        <h2>Your Top Artists</h2>
        {stats.topArtists?.length === 0 ? (
          <p>No listening data available yet.</p>
        ) : (
          <ul className="top-artists-list">
            {stats.topArtists?.map((artist, index) => (
              <li key={index} className="artist-item">
                <span className="artist-rank">{index + 1}</span>
                <div className="artist-info">
                  <span className="artist-name">{artist.artist_name}</span>
                  <span className="artist-details">
                    {artist.play_count} plays • {formatTime(artist.total_time)}
                  </span>
                  <span className="artist-albums">
                    {artist.albums?.split(',').length || 0} albums • {artist.platforms_used} platforms
                  </span>
                  <span className="artist-stats">
                    Skipped: {artist.skipped_count} times • Shuffle plays: {artist.shuffle_count}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="top-tracks-section">
        <h2>Your Top Tracks</h2>
        {stats.topTracks?.length === 0 ? (
          <p>No track data available yet.</p>
        ) : (
          <ul className="top-tracks-list">
            {stats.topTracks?.map((track, index) => (
              <li key={index} className="track-item">
                <span className="track-rank">{index + 1}</span>
                <div className="track-info">
                  <span className="track-name">{track.track_name}</span>
                  <span className="track-artist">{track.artist_name}</span>
                  <span className="track-details">
                    {track.play_count} plays • {formatTime(track.total_time)}
                  </span>
                  <span className="track-stats">
                    {track.platforms_used} platforms • Skipped: {track.skipped_count} times
                    • Shuffle: {track.shuffle_count} plays
                  </span>
                  <span className="track-countries">
                    Played in: {track.countries_played?.split(',').length || 0} countries
                  </span>
                  {track.spotify_track_uri && (
                    <a 
                      href={`https://open.spotify.com/track/${track.spotify_track_uri.split(':')[2]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="spotify-link"
                    >
                      Open in Spotify
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="platform-stats-section">
        <h2>Listening Platforms</h2>
        {stats.platformStats?.length === 0 ? (
          <p>No platform data available yet.</p>
        ) : (
          <ul className="platform-stats-list">
            {stats.platformStats?.map((platform, index) => (
              <li key={index} className="platform-item">
                <span className="platform-name">{platform.platform}</span>
                <div className="platform-stats">
                  <span className="platform-plays">{platform.play_count} plays</span>
                  <span className="platform-tracks">
                    {platform.unique_tracks} tracks • {platform.unique_artists} artists
                  </span>
                  <span className="platform-time">{formatTime(platform.total_time)}</span>
                  <span className="platform-stats">
                    Skipped: {platform.skipped_count} • Shuffle: {platform.shuffle_count}
                  </span>
                  <span className="platform-countries">
                    Used in {platform.countries_count} countries
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="listening-patterns-section">
        <h2>Listening Patterns</h2>
        {stats.listeningPatterns?.length === 0 ? (
          <p>No pattern data available yet.</p>
        ) : (
          <div className="patterns-grid">
            {stats.listeningPatterns?.map((pattern) => (
              <div key={pattern.hour} className="hour-stats">
                <span className="hour">{pattern.hour}:00</span>
                <div className="hour-details">
                  <span className="play-count">{pattern.play_count} plays</span>
                  <span className="shuffle-ratio">
                    Shuffle: {formatPercentage(pattern.shuffle_ratio)}
                  </span>
                  <span className="skip-ratio">
                    Skipped: {formatPercentage(pattern.skip_ratio)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="archives-section">
        <h2>Your Uploads</h2>
        {archives.length === 0 ? (
          <p>No archives uploaded yet. Start by uploading your Spotify data!</p>
        ) : (
          <ul className="archives-list">
            {archives.map((archive) => (
              <li key={archive.id} className="archive-item">
                <span className="archive-name">
                  {archive.file_path.split('/').pop()}
                </span>
                <span className="archive-date">
                  {format(new Date(archive.upload_date), 'MMM d, yyyy')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default StatsDisplay;
