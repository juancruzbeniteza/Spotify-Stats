const axios = require('axios');

const loginUser = async (email, password) => {
  try {
    const response = await axios.post('http://localhost:5000/login', {
      email,
      password
    });
    console.log('Login successful:', response.data);
  } catch (error) {
    console.error('Error during login:', error.response ? error.response.data : error.message);
  }
};

// Test the login
loginUser('testuser@example.com', 'testpassword123');
