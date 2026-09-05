'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  color?: string; // Optional course accent dot
}

interface CustomDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonStyle?: React.CSSProperties;
  menuWidth?: string | number;
  align?: 'left' | 'right';
}

export function CustomDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  className = '',
  buttonStyle = {},
  menuWidth,
  align = 'left',
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`custom-dropdown-container ${className}`}
      style={{ position: 'relative', display: 'inline-block', width: buttonStyle.width ? buttonStyle.width : 'auto' }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          width: '100%',
          background: 'var(--color-bg)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-panel)',
          padding: '10px 14px',
          color: selectedOption ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          fontFamily: 'inherit',
          fontSize: '13px',
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 0.15s var(--ease-out), background-color 0.15s var(--ease-out)',
          ...buttonStyle,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-text-muted)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-hairline)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          {selectedOption?.color && (
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: selectedOption.color,
                flexShrink: 0,
              }}
            />
          )}
          {selectedOption?.icon && (
            <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {selectedOption.icon}
            </span>
          )}
          <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          size={14}
          color="var(--color-text-muted)"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.18s var(--ease-out)',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            [align]: 0,
            zIndex: 60,
            minWidth: menuWidth || '100%',
            width: menuWidth || '100%',
            maxHeight: '260px',
            overflowY: 'auto',
            background: 'var(--color-panel)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-panel)',
            padding: '6px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45), 0 0 1px rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            animation: 'dropdown-pop-in 0.15s var(--ease-out)',
          }}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'calc(var(--radius-panel) - 4px)',
                  background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  border: 'none',
                  color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.12s var(--ease-out), color 0.12s var(--ease-out)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = isSelected
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'transparent';
                  (e.currentTarget as HTMLElement).style.color = isSelected
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-muted)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  {option.color && (
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: option.color,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {option.icon && (
                    <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      {option.icon}
                    </span>
                  )}
                  <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {option.label}
                  </span>
                </div>

                {isSelected && (
                  <Check size={14} color="var(--color-course-1)" style={{ flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
