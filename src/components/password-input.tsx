import React, { useState, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./password-input.module.css";

type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const toggleVisibility = () => {
      setShowPassword((prev) => !prev);
    };

    return (
      <div className={styles.wrapper}>
        <input
          {...props}
          ref={ref}
          type={showPassword ? "text" : "password"}
          className={`${className || ""} ${styles.input}`}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={toggleVisibility}
          onMouseDown={(e) => e.preventDefault()}
          className={styles.toggleButton}
          disabled={disabled}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          tabIndex={0}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
