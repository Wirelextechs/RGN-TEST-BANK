"use client";

import React, { useEffect } from 'react';
import styles from './Modal.module.css';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = '800px'
}) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div 
                className={styles.modal} 
                style={{ maxWidth }} 
                onClick={(e) => e.stopPropagation()}
            >
                <header className={styles.header}>
                    {title && <h3 className={styles.title}>{title}</h3>}
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </header>
                <div className={styles.content}>
                    {children}
                </div>
            </div>
        </div>
    );
};
