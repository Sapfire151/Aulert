import React from 'react';

export function GoogleIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/Google.svg"
      alt="Google"
      width={size}
      height={size}
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    />
  );
}
