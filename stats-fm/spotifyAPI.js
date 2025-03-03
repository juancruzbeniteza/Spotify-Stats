const axios = require('axios');
const qs = require('querystring');

class SpotifyAPI {
    constructor() {
        this.clientId = 'f78b03a512e2455fa9f3ffa4b344b1c9';
        this.clientSecret = '38d65e7b121e473894806512647ca224';
        this.redirectUri = 'http://localhost:5000/callback';
        this.accessTokens = new Map(); // Store tokens per user
    }

    getAuthUrl() {
        const scope = 'user-read-currently-playing user-read-playback-state';
        return 'https://accounts.spotify.com/authorize?' +
            qs.stringify({
                response_type: 'code',
                client_id: this.clientId,
                scope: scope,
                redirect_uri: this.redirectUri
            });
    }

    async getAccessToken(code) {
        try {
            const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
            const response = await axios({
                method: 'post',
                url: 'https://accounts.spotify.com/api/token',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: qs.stringify({
                    code: code,
                    redirect_uri: this.redirectUri,
                    grant_type: 'authorization_code'
                })
            });

            return {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresIn: response.data.expires_in
            };
        } catch (error) {
            console.error('Error getting access token:', error);
            throw error;
        }
    }

    async refreshAccessToken(refreshToken) {
        try {
            const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
            const response = await axios({
                method: 'post',
                url: 'https://accounts.spotify.com/api/token',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: qs.stringify({
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token'
                })
            });

            return {
                accessToken: response.data.access_token,
                expiresIn: response.data.expires_in
            };
        } catch (error) {
            console.error('Error refreshing token:', error);
            throw error;
        }
    }

    async getCurrentPlayback(userId, userToken) {
        try {
            const response = await axios({
                method: 'get',
                url: 'https://api.spotify.com/v1/me/player/currently-playing',
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            });

            if (response.status === 204) {
                return null; // No track currently playing
            }

            const track = response.data;
            return {
                user_id: userId,
                track_name: track.item.name,
                artist_name: track.item.artists[0].name,
                album_name: track.item.album.name,
                played_at: new Date().toISOString(),
                duration_ms: track.item.duration_ms,
                platform: 'Spotify',
                spotify_track_uri: track.item.uri,
                master_metadata_track_name: track.item.name,
                master_metadata_album_artist_name: track.item.artists[0].name,
                master_metadata_album_album_name: track.item.album.name,
                shuffle: track.shuffle_state || false,
                offline: false,
                incognito_mode: false
            };
        } catch (error) {
            console.error('Error fetching current playback:', error);
            return null;
        }
    }
}

module.exports = new SpotifyAPI();
