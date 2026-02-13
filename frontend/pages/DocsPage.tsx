// frontend/pages/DocsPage.tsx
/**
 * Documentation page component.
 *
 * Displays documentation content with a sidebar navigation and
 * markdown rendering. Supports multiple languages and loads
 * markdown content dynamically based on current language.
 *
 * Exports: DocsPage component
 */

import React, { useState, useMemo } from "react";
import { TitleCard } from "../components/TitleCard";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { DocsSidebar } from "../components/DocsSidebar";
import { useTranslation } from "react-i18next";

// Import markdown files
import tutorialZh from "../docs/tutorial-zh.md?raw";
import tutorialEn from "../docs/tutorial-en.md?raw";

export function DocsPage() {
  const { t, i18n } = useTranslation();
  const [currentDoc, setCurrentDoc] = useState<string>("tutorial");

  // Get markdown content based on current language and selected document
  const markdownContent = useMemo(() => {
    const lang = i18n.language;
    const docKey = currentDoc;

    if (docKey === "tutorial") {
      return lang === "zh" || lang.startsWith("zh") ? tutorialZh : tutorialEn;
    }
    return "";
  }, [currentDoc, i18n.language]);

  const containerStyles: React.CSSProperties = {
    display: "flex",
    gap: "1.5rem",
    height: "100%",
  };

  const sidebarWrapperStyles: React.CSSProperties = {
    flexShrink: 0,
  };

  const contentStyles: React.CSSProperties = {
    flex: 1,
    overflow: "auto",
    padding: "0.5rem",
  };

  return (
    <div
      style={{
        height: "100%",
        overflow: "hidden",
        padding: "1rem 1.5rem",
        boxSizing: "border-box",
      }}
    >
      <TitleCard title={t("pages.docsPage.documentation")} />

      <div style={containerStyles}>
        <div style={sidebarWrapperStyles}>
          <DocsSidebar currentDoc={currentDoc} onDocChange={setCurrentDoc} />
        </div>

        <div style={contentStyles}>
          <MarkdownRenderer content={markdownContent} />
        </div>
      </div>
    </div>
  );
}

export default DocsPage;
