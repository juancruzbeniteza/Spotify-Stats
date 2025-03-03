import React from 'react';
import { format } from 'date-fns';
import 'bootstrap/dist/css/bootstrap.min.css';



const FileDisplay = ({ data }) => {
  return (
    <div className="file-display">
      <h2 className="text-center">Uploaded Track Information</h2>
      <table className="table table-striped table-hover">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Platform</th>
            <th>Track Name</th>
            <th>Artist Name</th>
            <th>Duration (ms)</th>
            <th>Country</th>
            <th>IP Address</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index}>
              <td>{format(new Date(item.ts), 'MMM d, yyyy HH:mm:ss')}</td>
              <td>{item.platform}</td>
              <td>{item.master_metadata_track_name}</td>
              <td>{item.master_metadata_album_artist_name}</td>
              <td>{item.ms_played}</td>
              <td>{item.conn_country}</td>
              <td>{item.ip_addr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};


export default FileDisplay;
