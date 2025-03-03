import React from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import BarChartIcon from '@mui/icons-material/BarChart';
import TimelineIcon from '@mui/icons-material/Timeline';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

const Navbar = ({ onLogout }) => {
  const location = useLocation();

  const navItems = [
    { label: 'Home', path: '/', icon: <HomeIcon /> },
    { label: 'Stats', path: '/stats', icon: <BarChartIcon /> },
    { label: 'Analysis', path: '/analysis', icon: <TimelineIcon /> },
    { label: 'Profile', path: '/profile', icon: <AccountCircleIcon /> },
  ];

  return (
    <AppBar position="static" sx={{ bgcolor: '#1DB954' }}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Spotify Stats
        </Typography>
        <Box sx={{ display: 'flex' }}>
          {navItems.map((item) => (
            <Button
              key={item.path}
              component={RouterLink}
              to={item.path}
              sx={{
                color: 'white',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
                ...(location.pathname === item.path && {
                  bgcolor: 'rgba(0, 0, 0, 0.1)',
                }),
              }}
              startIcon={item.icon}
            >
              {item.label}
            </Button>
          ))}
          <Button
            color="inherit"
            onClick={onLogout}
            sx={{
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
            }}
          >
            Logout
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
