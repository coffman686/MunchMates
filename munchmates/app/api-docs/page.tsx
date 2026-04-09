// app/api-docs/page.tsx
// Renders the interactive Swagger UI for Munch Mates API documentation
// Visit http://localhost:3000/api-docs to view

"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
    return (
        <div style={{ background: "#fff", minHeight: "100vh" }}>
            <SwaggerUI url="/api/docs" />
        </div>
    );
}