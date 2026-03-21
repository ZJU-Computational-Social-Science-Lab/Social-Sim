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

  return (
    <div className="ss-product-page ss-product-page--docs ss-docs-page">
      <TitleCard title={t("pages.docsPage.documentation")} />

      <div className="ss-docs-page__layout">
        <DocsSidebar currentDoc={currentDoc} onDocChange={setCurrentDoc} />

        <div className="ss-docs-page__content scroll-panel">
          <div className="ss-docs-page__surface">
            <MarkdownRenderer content={markdownContent} className="ss-doc-markdown" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocsPage;
