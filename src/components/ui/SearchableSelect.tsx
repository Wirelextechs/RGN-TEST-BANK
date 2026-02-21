"use client";

import React, { useState, useRef, useEffect } from 'react';
import styles from './SearchableSelect.module.css';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
    name: string;
    region?: string;
}

interface SearchableSelectProps {
    label: string;
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    error?: string;
    required?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
    label,
    options,
    value,
    onChange,
    placeholder = "Search...",
    error,
    required
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredOptions = options.filter(option =>
        option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (option.region && option.region.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionName: string) => {
        onChange(optionName);
        setIsOpen(false);
        setSearchTerm("");
    };

    return (
        <div className={styles.container} ref={containerRef}>
            <label className={styles.label}>
                {label} {required && <span className={styles.required}>*</span>}
            </label>

            <div
                className={`${styles.selectWrapper} ${isOpen ? styles.isOpen : ''} ${error ? styles.error : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className={styles.currentValue}>
                    {value || <span className={styles.placeholder}>{placeholder}</span>}
                </div>
                <ChevronDown size={18} className={styles.chevron} />
            </div>

            {isOpen && (
                <div className={styles.dropdown}>
                    <div className={styles.searchWrapper} onClick={(e) => e.stopPropagation()}>
                        <Search size={16} className={styles.searchIcon} />
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Type to filter..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className={styles.optionsList}>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option, index) => (
                                <div
                                    key={index}
                                    className={`${styles.optionItem} ${value === option.name ? styles.selected : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelect(option.name);
                                    }}
                                >
                                    <div className={styles.optionContent}>
                                        <span className={styles.optionName}>{option.name}</span>
                                        {option.region && <span className={styles.optionRegion}>{option.region}</span>}
                                    </div>
                                    {value === option.name && <Check size={16} className={styles.checkIcon} />}
                                </div>
                            ))
                        ) : (
                            <div className={styles.noResults}>No institutions found</div>
                        )}
                    </div>
                </div>
            )}

            {error && <span className={styles.errorText}>{error}</span>}
        </div>
    );
};
