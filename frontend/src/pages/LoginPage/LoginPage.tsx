import React, { useState } from 'react';
import './LoginPage.css';
import CustomInput from '../../components/CustomInput/CustomInput';
import Logo from '../../assets/CCSLogo.png';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const isFetching = false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    setError('');
    // TODO: call login API
  };

  return (
    <div className="wrapper">
      <div className="container">
        <div className="logoBox">
          <img src={Logo} alt="Logo" />
        </div>
        <h3 className='loginTitle'> Project Management <br /> Application  for CCS Projects</h3>

        <div className="loginBox">
          <div className="p"><strong>Enter your registration data</strong></div>

          <form onSubmit={handleSubmit}>
            <CustomInput
              value={username}
              onChange={setUsername}
              label="Username"
              required
            />

            <CustomInput
              value={password}
              onChange={setPassword}
              label="Password"
              type="password"
              required
            />

            <button type="submit" disabled={isFetching} className="btn">
              Log In
            </button>
          </form>

          <div className={`error ${error ? 'active' : ''}`}>{error}</div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
