/**
 * Documentation sidebar component.
 *
 * Provides navigation for the documentation page with a list of
 * available documents. Uses i18n for all labels and highlights
 * the currently active document.
 *
 * Exports: DocsSidebar component
 */

import React from "react";
import { useTranslation } from "react-i18next";

export interface DocItem {
  id: string;
  translationKey: string;
}

export interface DocsSidebarProps {
  /** Currently selected document ID */
  currentDoc: string;
  /** Callback when document selection changes */
  onDocChange: (docId: string) => void;
  /** Optional CSS class name */
  className?: string;
}

const sidebarStyles: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "0.5rem",
  padding: "1rem",
  minWidth: "200px",
};

const titleStyles: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: "600",
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "0.75rem",
};

const listStyles: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
};

const getItemStyles = (isActive: boolean): React.CSSProperties => ({
  padding: "0.625rem 0.75rem",
  marginBottom: "0.25rem",
  borderRadius: "0.375rem",
  cursor: "pointer",
  transition: "all 0.15s ease",
  fontSize: "0.9375rem",
  backgroundColor: isActive ? "#3b82f6" : "transparent",
  color: isActive ? "#ffffff" : "#475569",
  fontWeight: isActive ? "500" : "400",
});

/**
 * DocsSidebar component for documentation navigation
 */
export function DocsSidebar({ currentDoc, onDocChange, className = "" }: DocsSidebarProps) {
  const { t } = useTranslation();

  const docItems: DocItem[] = [
    { id: "tutorial", translationKey: "pages.docsPage.tutorial" },
  ];

  return (
    <div className={`docs-sidebar ${className}`} style={sidebarStyles}>
      <div style={titleStyles}>{t("pages.docsPage.documents")}</div>
      <ul style={listStyles}>
        {docItems.map((item) => {
          const isActive = currentDoc === item.id;
          return (
            <li
              key={item.id}
              onClick={() => onDocChange(item.id)}
              style={getItemStyles(isActive)}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "#e2e8f0";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              {t(item.translationKey)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default DocsSidebar;
