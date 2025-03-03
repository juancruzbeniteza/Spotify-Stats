import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Typography, Button, Box, List, ListItem, ListItemText, Paper, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { format } from 'date-fns';

const Profile = ({ token, onLogout }) => {
  const [userData, setUserData] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axios.get('/user', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUserData(response.data);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Failed to load user data');
      }
    };

    const fetchUploadedFiles = async () => {
      try {
        const response = await axios.get('/uploaded-files', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUploadedFiles(response.data);
      } catch (error) {
        console.error('Error fetching uploaded files:', error);
        setError('Failed to load uploaded files');
      }
    };

    Promise.all([fetchUserData(), fetchUploadedFiles()])
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, [token]);

  const handleClearData = async () => {
    try {
      await axios.delete('/clear-data', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUploadedFiles([]);
      setOpenDialog(false);
      // You might want to refresh other stats or data here
    } catch (error) {
      console.error('Error clearing data:', error);
      setError('Failed to clear data. Please try again.');
    }
  };

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4, bgcolor: 'background.paper' }}>
        <Typography variant="h4" gutterBottom>
          Your Profile
        </Typography>
        {userData && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6">Email: {userData.email}</Typography>
            <Typography variant="body1">Member since: {format(new Date(userData.createdAt), 'MMMM d, yyyy')}</Typography>
          </Box>
        )}
        <Typography variant="h5" gutterBottom>
          Uploaded Files
        </Typography>
        <List>
          {uploadedFiles.map((file) => (
            <ListItem key={file.id}>
              <ListItemText
                primary={file.filename}
                secondary={`Uploaded on ${format(new Date(file.uploadDate), 'MMMM d, yyyy')}`}
              />
            </ListItem>
          ))}
        </List>
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
          <Button variant="contained" color="primary" onClick={onLogout}>
            Logout
          </Button>
          <Button variant="outlined" color="error" onClick={() => setOpenDialog(true)}>
            Clear All Data
          </Button>
        </Box>
      </Paper>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Clear All Data?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            This action will permanently delete all your uploaded files and stored data. This cannot be undone. Are you sure you want to proceed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleClearData} color="error" autoFocus>
            Clear All Data
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Profile;
