import React, { useState, useRef } from 'react';
import axios from 'axios';
import '../App.css';

const API_BASE = "http://localhost:5000";

const FileUpload = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [cancelTokenSource, setCancelTokenSource] = useState(null);
  const fileInputRef = useRef(null);

  const validateFiles = (files) => {
    if (!files || files.length === 0) {
      return { valid: false, error: 'Please select at least one file' };
    }

    if (files.length > 10) {
      return { valid: false, error: 'Maximum 10 files allowed' };
    }

    const invalidFiles = Array.from(files).filter(f => !f.name.toLowerCase().endsWith('.json'));
    if (invalidFiles.length > 0) {
      return {
        valid: false,
        error: `Invalid file type(s): ${invalidFiles.map(f => f.name).join(', ')}. Please select only JSON files.`
      };
    }

    const oversizedFiles = Array.from(files).filter(f => f.size > 50 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      return {
        valid: false,
        error: `Files too large: ${oversizedFiles.map(f => f.name).join(', ')}. Maximum size is 50MB per file.`
      };
    }

    return { valid: true };
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    setError('');

    const validation = validateFiles(files);
    if (!validation.valid) {
      setError(validation.error);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const fileList = Array.from(files).map(f => ({
      file: f,
      name: f.name,
      size: f.size
    }));

    console.log('Selected files:', fileList.map(f => ({
      name: f.name,
      size: `${(f.size / (1024 * 1024)).toFixed(2)}MB`
    })));

    setUploadProgress(0);
    setSelectedFiles(fileList);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setError('Please select at least one file');
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach(fileInfo => {
      formData.append('files', fileInfo.file);
    });

    setUploading(true);
    setError('');
    setUploadProgress(0);

    const cancelToken = axios.CancelToken.source();
    setCancelTokenSource(cancelToken);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token missing. Please log in again.');
        return;
      }

      console.log('Starting upload...');
      
      const response = await axios.post(`${API_BASE}/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        cancelToken: cancelToken.token,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
        timeout: 300000 // 5 minute timeout
      });
      
      if (response.data.warnings && response.data.warnings.length > 0) {
        setError(response.data.warnings.join('\n'));
      } else {
        setSelectedFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (onUploadSuccess) {
          onUploadSuccess(response.data);
        }
      }
    } catch (error) {
      console.error('Upload error:', {
        error,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });

      if (axios.isCancel(error)) {
        setError('Upload was cancelled');
      } else if (error.code === 'ECONNABORTED') {
        setError('Upload timed out. Please try again with a smaller file or check your connection.');
      } else {
        const { error: errorMessage, details, help } = error.response?.data || {};
        const errorParts = [];
        
        if (errorMessage) errorParts.push(errorMessage);
        if (details) errorParts.push(details);
        if (help) errorParts.push(help);
        
        setError(
          errorParts.length > 0
            ? errorParts.join('\n')
            : 'Upload failed. Please ensure your JSON file is properly formatted and try again.'
        );
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setCancelTokenSource(null);
    }
  };

  return (
    <div className="upload-section">
      <h2>Upload Spotify Data</h2>
      <p className="upload-description">
        Upload your Spotify streaming history to see your listening stats. You can download your data from
        Spotify's Privacy Settings.
      </p>
      <div className="file-format-info">
        <p>File requirements:</p>
        <ul>
          <li>Must be a JSON file containing an array of listening history entries</li>
          <li>Each entry must have:</li>
          <ul>
            <li>ts (timestamp)</li>
            <li>master_metadata_track_name (song name)</li>
            <li>master_metadata_album_artist_name (artist name)</li>
          </ul>
          <li>Maximum file size: 50MB</li>
        </ul>
      </div>
      <form onSubmit={handleUpload}>
        <div className="file-input-wrapper">
          <div className="file-input-container">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept=".json"
              multiple
              className="file-input"
              id="file-input"
            />
            <label htmlFor="file-input" className="file-input-label">
              {selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : 'Choose Spotify Data Files'}
            </label>
          </div>
          <div className="file-status">
            {selectedFiles.length > 0 && (
              <div className="selected-files">
                {selectedFiles.map((fileInfo, i) => (
                  <div key={i} className="selected-file">
                    <span className="file-name">{fileInfo.name}</span>
                    <span className="file-size">({(fileInfo.size / (1024 * 1024)).toFixed(1)} MB)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="upload-controls">
          {!uploading ? (
            <button 
              type="submit" 
              disabled={selectedFiles.length === 0}
              className="upload-button"
            >
              Upload
            </button>
          ) : (
            <div className="upload-actions">
              <button 
                type="button"
                className="upload-button uploading"
                disabled
              >
                Uploading... {uploadProgress}%
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={() => cancelTokenSource?.cancel('Upload cancelled by user')}
              >
                Cancel
              </button>
            </div>
          )}
          {uploading && (
            <div className="progress-bar">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      </form>
      {error && (
        <div className="error-message">
          {error.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
