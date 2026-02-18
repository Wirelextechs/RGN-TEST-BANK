import React from 'react';
import styles from './Card.module.css';

interface CardProps {
    children: React.ReactNode;
    title?: string;
    className?: string;
    glass?: boolean;
    animate?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    title,
    className = '',
    glass = false,
    animate = true
}) => {
    return (
        <div className={`
      ${styles.card} 
      ${glass ? 'glass' : ''} 
      ${animate ? 'animate-scale-in' : ''} 
      ${className}
    `}>
            {title && <div className={styles.header}><h3 className={styles.title}>{title}</h3></div>}
            <div className={styles.content}>
                {children}
            </div>
        </div>
    );
};
