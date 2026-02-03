import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Formats message text to render Markdown-style links.
 * Converts [Link Title](url) patterns into clickable anchor tags or React Router Links.
 * Automatically detects internal links (starting with / or matching the app domain)
 * to use SPA navigation instead of full page reloads/new tabs.
 * 
 * @param {string} text - The raw message text
 * @returns {Array<React.ReactNode>} - Array of React nodes (text and links)
 */
export const formatMessageWithLinks = (text) => {
    if (!text) return null;

    // Split by the markdown link pattern: [Title](URL)
    const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);

    // Helper to check if a URL is internal
    const getInternalPath = (url) => {
        try {
            // Already relative
            if (url.startsWith('/')) return url;

            // Check against current origin (e.g. localhost or current domain)
            const currentOrigin = window.location.origin;
            if (url.startsWith(currentOrigin)) {
                return url.replace(currentOrigin, '');
            }

            // Check against production domains (allows pasting prod links while testing locally)
            const prodDomains = ['https://www.sabor-dlv.ru', 'https://sabor-dlv.ru'];
            for (const domain of prodDomains) {
                if (url.startsWith(domain)) {
                    return url.replace(domain, '');
                }
            }

            return null;
        } catch (e) {
            return null;
        }
    };

    return parts.map((part, index) => {
        // Check if this part is a link
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

        if (linkMatch) {
            const [_, title, rawUrl] = linkMatch;
            const url = rawUrl.trim();
            const internalPath = getInternalPath(url);

            // Internal link -> Use <Link> for SPA navigation (no new tab, working back button)
            if (internalPath) {
                return (
                    <Link
                        key={index}
                        to={internalPath}
                        className="text-primary hover:underline font-medium cursor-pointer"
                        onClick={(e) => {
                            // Stop propagation to prevent closing the notification panel immediately if handled elsewhere
                            e.stopPropagation();
                            // In case we want to auto-close parent panels, we might need a custom event or context,
                            // but standard behavior is usually to just navigate.
                        }}
                    >
                        {title}
                    </Link>
                );
            }

            // External link -> Use <a> with target="_blank"
            return (
                <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                >
                    {title}
                </a>
            );
        }

        // Return regular text
        return part;
    });
};
