import React from 'react';

export function ReadingProgressBar({ progress }) {
    return (
        <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-transparent">
            <div
                className="h-full bg-primary transition-all duration-150 ease-out"
                style={{ width: `${progress}%`, backgroundColor: 'hsl(var(--reader-progress))' }}
            />
        </div>
    );
}
