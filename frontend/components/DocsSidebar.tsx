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

/**
 * DocsSidebar component for documentation navigation
 */
export function DocsSidebar({ currentDoc, onDocChange, className = "" }: DocsSidebarProps) {
  const { t } = useTranslation();

  const docItems: DocItem[] = [
    { id: "tutorial", translationKey: "pages.docsPage.tutorial" },
  ];

  return (
    <aside className={`docs-sidebar ${className}`.trim()}>
      <div className="docs-sidebar__title">{t("pages.docsPage.documents")}</div>
      <ul className="docs-sidebar__list">
        {docItems.map((item) => {
          const isActive = currentDoc === item.id;
          return (
            <li
              key={item.id}
              onClick={() => onDocChange(item.id)}
              className={`docs-sidebar__item ${isActive ? "is-active" : ""}`}
            >
              {t(item.translationKey)}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export default DocsSidebar;
