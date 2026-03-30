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

/**
 * MarkdownRenderer component for displaying markdown content
 */
export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`markdown-renderer doc-body ss-doc-markdown ${className}`.trim()}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="ss-doc-markdown__h1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="ss-doc-markdown__h2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="ss-doc-markdown__h3">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="ss-doc-markdown__h4">{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="ss-doc-markdown__h5">{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="ss-doc-markdown__h6">{children}</h6>
          ),
          p: ({ children }) => (
            <p className="ss-doc-markdown__p">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="ss-doc-markdown__list ss-doc-markdown__list--disc">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="ss-doc-markdown__list ss-doc-markdown__list--decimal">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="ss-doc-markdown__item">{children}</li>
          ),
          a: ({ href, children }) => (
            <a href={href} className="ss-doc-markdown__link" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          code: ({ inline, children }) => {
            if (inline) {
              return <code className="ss-doc-markdown__code">{children}</code>;
            }
            return <code className="ss-doc-markdown__pre-code">{children}</code>;
          },
          pre: ({ children }) => (
            <pre className="ss-doc-markdown__pre">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="ss-doc-markdown__blockquote">{children}</blockquote>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt || ""} className="ss-doc-markdown__image" loading="lazy" />
          ),
          table: ({ children }) => (
            <table className="ss-doc-markdown__table">{children}</table>
          ),
          thead: ({ children }) => (
            <thead className="ss-doc-markdown__thead">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="ss-doc-markdown__cell ss-doc-markdown__cell--head">{children}</th>
          ),
          td: ({ children }) => (
            <td className="ss-doc-markdown__cell">{children}</td>
          ),
          hr: () => (
            <hr className="ss-doc-markdown__hr" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
