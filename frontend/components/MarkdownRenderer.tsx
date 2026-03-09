/**
 * Markdown renderer component.
 *
 * Renders markdown content using react-markdown with proper styling
 * for images, headings, lists, and other elements. Used to display
 * documentation content in the Docs page.
 *
 * Exports: MarkdownRenderer component
 */

import React from "react";
import ReactMarkdown from "react-markdown";

export interface MarkdownRendererProps {
  /** Markdown content to render */
  content: string;
  /** Optional CSS class name */
  className?: string;
}

const markdownStyles: React.CSSProperties = {
  lineHeight: "1.7",
  fontSize: "0.95rem",
  color: "#334155",
};

const headingStyles: React.CSSProperties = {
  marginTop: "1.5rem",
  marginBottom: "0.75rem",
  fontWeight: "600",
  color: "#1e293b",
};

const paragraphStyles: React.CSSProperties = {
  marginTop: "0.75rem",
  marginBottom: "0.75rem",
};

const listStyles: React.CSSProperties = {
  paddingLeft: "1.5rem",
  marginTop: "0.5rem",
  marginBottom: "0.5rem",
};

const listItemStyles: React.CSSProperties = {
  marginTop: "0.25rem",
  marginBottom: "0.25rem",
};

const linkStyles: React.CSSProperties = {
  color: "#3b82f6",
  textDecoration: "underline",
};

const codeStyles: React.CSSProperties = {
  backgroundColor: "#f1f5f9",
  padding: "0.125rem 0.375rem",
  borderRadius: "0.25rem",
  fontFamily: "monospace",
  fontSize: "0.875em",
};

const preStyles: React.CSSProperties = {
  backgroundColor: "#1e293b",
  color: "#e2e8f0",
  padding: "1rem",
  borderRadius: "0.5rem",
  overflowX: "auto",
  marginTop: "1rem",
  marginBottom: "1rem",
};

const blockquoteStyles: React.CSSProperties = {
  borderLeft: "4px solid #cbd5e1",
  paddingLeft: "1rem",
  fontStyle: "italic",
  color: "#64748b",
  marginTop: "1rem",
  marginBottom: "1rem",
};

const imageStyles: React.CSSProperties = {
  maxWidth: "100%",
  height: "auto",
  borderRadius: "0.5rem",
  marginTop: "1rem",
  marginBottom: "1rem",
  border: "1px solid #e2e8f0",
};

const tableStyles: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: "1rem",
  marginBottom: "1rem",
};

const tableCellStyles: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  padding: "0.5rem 0.75rem",
  textAlign: "left",
};

/**
 * MarkdownRenderer component for displaying markdown content
 */
export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`markdown-renderer ${className}`} style={markdownStyles}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 style={{ ...headingStyles, fontSize: "1.875rem" }}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ ...headingStyles, fontSize: "1.5rem" }}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ ...headingStyles, fontSize: "1.25rem" }}>{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 style={{ ...headingStyles, fontSize: "1.125rem" }}>{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 style={{ ...headingStyles, fontSize: "1rem" }}>{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 style={{ ...headingStyles, fontSize: "0.875rem" }}>{children}</h6>
          ),
          p: ({ children }) => (
            <p style={paragraphStyles}>{children}</p>
          ),
          ul: ({ children }) => (
            <ul style={{ ...listStyles, listStyleType: "disc" }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ ...listStyles, listStyleType: "decimal" }}>{children}</ol>
          ),
          li: ({ children }) => (
            <li style={listItemStyles}>{children}</li>
          ),
          a: ({ href, children }) => (
            <a href={href} style={linkStyles} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          code: ({ inline, children }) => {
            if (inline) {
              return <code style={codeStyles}>{children}</code>;
            }
            return <code style={{ ...codeStyles, backgroundColor: "transparent", color: "inherit" }}>{children}</code>;
          },
          pre: ({ children }) => (
            <pre style={preStyles}>{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote style={blockquoteStyles}>{children}</blockquote>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt || ""} style={imageStyles} loading="lazy" />
          ),
          table: ({ children }) => (
            <table style={tableStyles}>{children}</table>
          ),
          thead: ({ children }) => (
            <thead style={{ backgroundColor: "#f8fafc" }}>{children}</thead>
          ),
          th: ({ children }) => (
            <th style={{ ...tableCellStyles, fontWeight: "600" }}>{children}</th>
          ),
          td: ({ children }) => (
            <td style={tableCellStyles}>{children}</td>
          ),
          hr: () => (
            <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "1.5rem 0" }} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
