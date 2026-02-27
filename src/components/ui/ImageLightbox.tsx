"use client";
import { X, ZoomIn, ZoomOut, Download } from "lucide-react";
import styles from "./ImageLightbox.module.css";
import { useState, useEffect } from "react";

interface ImageLightboxProps {
    src: string;
    alt?: string;
    onClose: () => void;
}

export const ImageLightbox = ({ src, alt = "Image", onClose }: ImageLightboxProps) => {
    const [scale, setScale] = useState(1);

    // Close on escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.toolbar} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setScale(s => s + 0.25)} title="Zoom In"><ZoomIn size={20} /></button>
                <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} title="Zoom Out"><ZoomOut size={20} /></button>
                <a href={src} target="_blank" rel="noopener noreferrer" download title="Download"><Download size={20} /></a>
                <button onClick={onClose} title="Close"><X size={24} /></button>
            </div>
            <div className={styles.imageContainer} onClick={(e) => {
                e.stopPropagation();
                setScale(s => s === 1 ? 2 : 1);
            }}>
                <img
                    src={src}
                    alt={alt}
                    style={{ transform: `scale(${scale})` }}
                    className={styles.image}
                />
            </div>
        </div>
    );
};
