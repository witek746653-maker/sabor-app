import React from 'react';

export function ArticleSkeleton() {
    return (
        <div className="px-4 md:px-6 lg:px-8 max-w-reader mx-auto pt-8 animate-pulse">
            {/* Title skeleton */}
            <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-lg w-3/4 mb-4" />

            {/* Meta skeleton */}
            <div className="flex gap-2 mb-8">
                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-24" />
                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-24" />
            </div>

            {/* Content paragraphs */}
            <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="space-y-2">
                        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full" />
                        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full" />
                        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-5/6" />
                    </div>
                ))}
            </div>
        </div>
    );
}
