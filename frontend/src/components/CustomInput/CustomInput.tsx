import { useState } from 'react';
import './CustomInput.css';
import type { CustomInputProps } from '../../types/components.types';

const CustomInput = ({ label, required = false, type = 'text', value, onChange }: CustomInputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const inputType = type === 'password' && showPassword ? 'text' : type;

  const togglePassword = () => setShowPassword(!showPassword);

  return (
    <div className="inputBox">
      <div className={`floatingLabelInput ${isFocused || value ? 'focused' : ''}`}>
        <input
          required={required}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder=" "
          className={`input ${isFocused ? 'hidePlaceholder' : ''}`}
        />
        {type === 'password' && (
          <button type="button" className="togglePasswordButton" onClick={togglePassword}>
            {showPassword 
            ? <span className="gg-icon">visibility_off</span> 
            : <span className="gg-icon">visibility</span>}
          </button>
        )}
        <label className={`label ${value || isFocused ? 'filled' : ''}`}>{label}</label>
      </div>
    </div>
  );
};

export default CustomInput;
