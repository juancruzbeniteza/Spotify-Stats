const axios = require('axios');

const registerUser = async (email, password) => {
  try {
    const response = await axios.post('http://localhost:5000/register', {
      email,
      password
    });
    console.log('Registration successful:', response.data);
  } catch (error) {
    console.error('Error during registration:', error.response ? error.response.data : error.message);
  }
};

// Test the registration
registerUser('testuser@example.com', 'testpassword123');
