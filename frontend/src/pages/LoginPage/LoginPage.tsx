import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';
import CustomInput from '../../components/CustomInput/CustomInput';
import Logo from '../../assets/CCSLogo.png';
import { apiRequest } from '../../services/apiClient';
import type { LoginResponse } from '../../types/login.types';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    try {
      setIsFetching(true);
      setError('');

      const user = await apiRequest<LoginResponse>('/login', {
        method: 'POST',
        body: { username, password },
      });

      localStorage.setItem('user', JSON.stringify(user));
      navigate('/dashboard');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login failed';
      setError(message);
    } finally {
      setIsFetching(false);
    }
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
