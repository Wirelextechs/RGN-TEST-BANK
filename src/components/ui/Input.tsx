import React from 'react';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    icon,
    className = '',
    ...props
}) => {
    return (
        <div className={`${styles.container} ${className}`}>
            {label && <label className={styles.label}>{label}</label>}
            <div className={styles.inputWrapper}>
                {icon && <div className={styles.icon}>{icon}</div>}
                <input
                    className={`${styles.input} ${error ? styles.inputError : ''} ${icon ? styles.hasIcon : ''}`}
                    {...props}
                />
            </div>
            {error && <span className={styles.errorText}>{error}</span>}
        </div>
    );
};
