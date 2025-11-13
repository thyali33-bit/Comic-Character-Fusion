
import React from 'react';

const RotateIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        xmlns="http://www.w.org/2000/svg"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 15l-2 5L8 9l9 4-5 2zm0 0l5 5M7.188 8.188A9 9 0 1121 12h-3"
        />
    </svg>
);

export default RotateIcon;
