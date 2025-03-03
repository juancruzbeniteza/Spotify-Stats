import React, { useState } from 'react';
import axios from 'axios';
import { Button, Typography, Box, LinearProgress } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

const FileUpload = ({ token, onUploadSuccess }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleFileSelect = (event) => {
    setSelectedFiles(Array.from(event.target.files));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadStatus('Please select files to upload.');
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await axios.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      setUploadStatus('Files uploaded successfully!');
      setSelectedFiles([]);
      setUploadProgress(0);

      if (onUploadSuccess) {
        onUploadSuccess(response.data);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('Upload failed. Please try again.');
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <input
        accept=".json"
        style={{ display: 'none' }}
        id="raised-button-file"
        multiple
        type="file"
        onChange={handleFileSelect}
      />
      <label htmlFor="raised-button-file">
        <Button variant="contained" component="span" startIcon={<CloudUploadIcon />}>
          Select Files
        </Button>
      </label>
      
      {selectedFiles.length > 0 && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {selectedFiles.length} file(s) selected
        </Typography>
      )}
      
      <Button
        variant="contained"
        color="primary"
        onClick={handleUpload}
        disabled={selectedFiles.length === 0}
        sx={{ mt: 2 }}
      >
        Upload
      </Button>
      
      {uploadProgress > 0 && (
        <Box sx={{ width: '100%', mt: 2 }}>
          <LinearProgress variant="determinate" value={uploadProgress} />
        </Box>
      )}
      
      {uploadStatus && (
        <Typography 
          variant="body2" 
          color={uploadStatus.includes('success') ? 'success.main' : 'error.main'}
          sx={{ mt: 2 }}
        >
          {uploadStatus}
        </Typography>
      )}
    </Box>
  );
};

export default FileUpload;
