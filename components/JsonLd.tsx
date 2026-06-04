import React from 'react';

/**
 * Server-rendered JSON-LD structured data block.
 * Renders into the SSR HTML so crawlers see it without executing JS.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
    return (
        <script
            type="application/ld+json"
            // schema.org payloads are built server-side from our own data, not user input.
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    );
}
