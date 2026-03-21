import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  BookOpen,
  Bot,
  Brain,
  ChevronDown,
  ChevronUp,
  Edit3,
  File as FileIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useSimulationStore } from "../store";
import { Agent, KnowledgeItem, LogEntry } from "../types";
import { deleteAgentDocument, DocumentInfo, listAgentDocuments, uploadAgentDocument } from "../services/simulations";
import { MultimodalInput } from "./MultimodalInput";

type AgentActivity = {
  content: string;
  round: number | null;
};

const renderProfileHtml = (text: string) => {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escaped = escape(text || "");
  const withImages = escaped.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
    const safeAlt = escape(alt || "image");
    const safeUrl = url.replace(/"/g, "&quot;");
    return `<img src="${safeUrl}" alt="${safeAlt}" class="inline-block max-h-32 rounded border border-slate-200 mr-2 mb-2" />`;
  });
  return withImages.replace(/\n/g, "<br />");
};

const getModelBadgeStyle = (provider: string) => {
  switch (provider.toLowerCase()) {
    case "openai":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "anthropic":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "google":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const summarizeActivity = (content: string) => String(content || "").replace(/\s+/g, " ").trim().slice(0, 120);

const buildActivityMap = (logs: LogEntry[], agents: Agent[]) => {
  const agentIds = new Set(agents.map((agent) => agent.id));
  const agentNames = new Map(agents.map((agent) => [agent.name, agent.id]));
  const latestByAgent = new Map<string, AgentActivity>();
  let activeAgentId: string | null = null;

  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const entry = logs[index];
    const resolvedAgentId =
      (entry.agentId && agentIds.has(entry.agentId) && entry.agentId) ||
      agentNames.get(entry.agentId || "") ||
      null;

    if (!resolvedAgentId) {
      continue;
    }

    if (!latestByAgent.has(resolvedAgentId)) {
      latestByAgent.set(resolvedAgentId, {
        content: summarizeActivity(entry.content),
        round: Number.isFinite(entry.round) ? entry.round : null,
      });
    }

    if (!activeAgentId) {
      activeAgentId = resolvedAgentId;
    }
  }

  return { activeAgentId, latestByAgent };
};

const MetricPill: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="ss-inset flex min-w-[84px] flex-col gap-1 px-3 py-2">
    <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--ss-workspace-muted)]">{label}</span>
    <span className="text-sm font-semibold text-[var(--ss-workspace-heading)]">{value}</span>
  </div>
);

const SectionToggle: React.FC<{
  label: string;
  icon: React.ReactNode;
  count: number;
  open: boolean;
  onToggle: () => void;
}> = ({ label, icon, count, open, onToggle }) => (
  <button
    onClick={onToggle}
    className="flex w-full items-center justify-between rounded-2xl border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)] px-4 py-3 text-left transition-colors hover:border-[var(--ss-workspace-border-strong)]"
  >
    <div className="flex items-center gap-2 text-sm font-medium text-[var(--ss-workspace-heading)]">
      {icon}
      <span>{label}</span>
      <span className="rounded-full border border-[var(--ss-workspace-border)] bg-black/10 px-2 py-0.5 text-[11px] text-[var(--ss-workspace-muted)]">{count}</span>
    </div>
    {open ? <ChevronUp size={16} className="text-[var(--ss-workspace-muted)]" /> : <ChevronDown size={16} className="text-[var(--ss-workspace-muted)]" />}
  </button>
);

const AgentCard: React.FC<{ agent: Agent; isActive: boolean; latestActivity?: AgentActivity }> = ({
  agent,
  isActive,
  latestActivity,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState(agent.profile);
  const [isPropsOpen, setIsPropsOpen] = useState(true);
  const [isKBOpen, setIsKBOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isAddingKB, setIsAddingKB] = useState(false);
  const [newKbTitle, setNewKbTitle] = useState("");
  const [newKbContent, setNewKbContent] = useState("");
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateAgentProfile = useSimulationStore((state) => state.updateAgentProfile);
  const addKnowledgeToAgent = useSimulationStore((state) => state.addKnowledgeToAgent);
  const removeKnowledgeFromAgent = useSimulationStore((state) => state.removeKnowledgeFromAgent);
  const simulationId = useSimulationStore((state) => state.currentSimulation?.id);
  const selectedNodeId = useSimulationStore((state) => state.selectedNodeId);

  useEffect(() => {
    setProfileDraft(agent.profile);
  }, [agent.profile]);

  const loadDocuments = useCallback(async () => {
    if (!simulationId) {
      setDocuments([]);
      return;
    }
    const docs = await listAgentDocuments(simulationId, agent.name, selectedNodeId ?? undefined);
    setDocuments(docs);
  }, [agent.name, selectedNodeId, simulationId]);

  useEffect(() => {
    if (simulationId) {
      void loadDocuments();
    }
  }, [loadDocuments, simulationId]);

  const handleFileUpload = async (file: File) => {
    if (!simulationId) {
      setUploadError(t("components.agentPanel.noSimulationId"));
      return;
    }

    const allowedTypes = [".pdf", ".txt", ".docx", ".md"];
    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!allowedTypes.includes(ext)) {
      setUploadError(t("components.agentPanel.invalidFileType", { types: allowedTypes.join(", ") }));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError(t("components.agentPanel.fileTooLarge"));
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      await uploadAgentDocument(simulationId, agent.name, file);
      await loadDocuments();
    } catch (error: any) {
      setUploadError(error.message || t("components.agentPanel.uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  const visibleProperties = Object.entries(agent.properties || {}).filter(
    ([key]) => !["emotion_enabled", "archetype_id", "demographic_attributes", "internal", "_internal", "avatarUrl"].includes(key)
  );

  return (
    <article className={`ss-agent-card overflow-hidden transition-all duration-300 ${isActive ? "is-active" : ""}`}>
      <div className="px-4 py-4">
        <div className="flex items-start gap-3">
          <img
            src={agent.avatarUrl}
            alt={agent.name}
            className={`h-12 w-12 rounded-2xl border object-cover ${isActive ? "border-sky-300 shadow-lg shadow-sky-100" : "border-slate-200"}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-[var(--ss-workspace-heading)]">{agent.name}</h3>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${isActive ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}>
                {isActive ? t("components.agentPanel.activeNow") : t("components.agentPanel.idle")}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${getModelBadgeStyle(agent.llmConfig?.provider || "default")}`}>
                <Bot size={11} />
                <span className="font-mono">{agent.llmConfig?.model || t("components.agentPanel.auto")}</span>
              </span>
            </div>

            <div className="mt-2 grid gap-2 text-sm text-[var(--ss-workspace-muted)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="lab-label">{t("components.agentPanel.roleLine")}</span>
                <span>{agent.role || "-"}</span>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <span className="lab-label">{t("components.agentPanel.profileLine")}</span>
                <span className="line-clamp-2 flex-1">{agent.profile || t("components.agentPanel.noProfile")}</span>
              </div>
              <div className="rounded-2xl border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface)] px-3 py-2">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--ss-workspace-muted)]">
                  <span>{t("components.agentPanel.lastAction")}</span>
                  {latestActivity?.round != null && <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] text-[var(--ss-workspace-muted)]">R{latestActivity.round}</span>}
                </div>
                <p className="mt-1 text-sm leading-6 text-[var(--ss-workspace-text)]">{latestActivity?.content || t("components.agentPanel.noRecentActivity")}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <MetricPill label={t("components.agentPanel.liveState")} value={visibleProperties.length} />
          <MetricPill label={t("components.agentPanel.knowledgeSummary")} value={agent.knowledgeBase.length} />
          <MetricPill label={t("components.agentPanel.documentsSummary")} value={documents.length} />
          <MetricPill label={t("components.agentPanel.memorySummary")} value={agent.memory.length} />
          <button onClick={() => setIsExpanded((value) => !value)} className="ss-button-secondary ml-auto inline-flex items-center gap-2 self-stretch px-4 py-2 text-sm">
            {isExpanded ? t("components.agentPanel.collapse") : t("components.agentPanel.expand")}
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 border-t border-[var(--ss-workspace-border)] bg-black/5 px-4 py-4">
          <div className="ss-inset p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="lab-label">{t("components.agentPanel.profileLine")}</div>
              {!isProfileEditing && (
                <button onClick={() => setIsProfileEditing(true)} className="ss-icon-button square" title={t("components.agentPanel.editProfile")}>
                  <Edit3 size={14} />
                </button>
              )}
            </div>
            {isProfileEditing ? (
              <div className="space-y-3">
                <textarea
                  value={profileDraft}
                  onChange={(event) => setProfileDraft(event.target.value)}
                  className="ss-input min-h-[112px] w-full rounded-2xl px-3 py-3 text-sm"
                  placeholder={t("components.agentPanel.profilePlaceholder")}
                />
                <MultimodalInput
                  helperText={t("components.agentPanel.uploadHelperText")}
                  onInsert={(url) => setProfileDraft((previous) => `${previous}${previous ? "\n" : ""}![image](${url})`)}
                />
                <div className="flex gap-2">
                  <button onClick={() => { updateAgentProfile(agent.id, profileDraft); setIsProfileEditing(false); }} className="ss-button inline-flex flex-1 items-center justify-center gap-2">
                    <Save size={14} />
                    {t("components.agentPanel.saveProfile")}
                  </button>
                  <button onClick={() => { setProfileDraft(agent.profile); setIsProfileEditing(false); }} className="ss-button-secondary inline-flex flex-1 items-center justify-center gap-2">
                    <X size={14} />
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="markdown-body text-sm leading-7 text-[var(--ss-workspace-text)]" dangerouslySetInnerHTML={{ __html: renderProfileHtml(agent.profile || t("components.agentPanel.noProfile")) }} />
            )}
          </div>

          <SectionToggle label={t("components.agentPanel.currentAttributes")} icon={<Activity size={16} className="text-slate-500" />} count={visibleProperties.length} open={isPropsOpen} onToggle={() => setIsPropsOpen((value) => !value)} />
          {isPropsOpen && (
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleProperties.map(([key, value]) => (
                <div key={key} className="ss-inset px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ss-workspace-muted)]">{key}</div>
                  <div className="mt-2 break-words font-mono text-sm text-[var(--ss-workspace-text)]">{String(value)}</div>
                </div>
              ))}
              {visibleProperties.length === 0 && <div className="rounded-2xl border border-dashed border-[var(--ss-workspace-border)] px-4 py-5 text-sm text-[var(--ss-workspace-muted)]">{t("components.agentPanel.noCustomAttributes")}</div>}
            </div>
          )}

          <SectionToggle label={t("components.agentPanel.knowledgeBase")} icon={<BookOpen size={16} className="text-slate-500" />} count={agent.knowledgeBase.length} open={isKBOpen} onToggle={() => setIsKBOpen((value) => !value)} />
          {isKBOpen && (
            <div className="space-y-3">
              {agent.knowledgeBase.map((item) => (
                <div key={item.id} className="ss-inset p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[var(--ss-workspace-heading)]">{item.title}</div>
                      <p className="mt-2 text-sm leading-6 text-[var(--ss-workspace-text)]">{item.content}</p>
                    </div>
                    <button onClick={() => removeKnowledgeFromAgent(agent.id, item.id)} className="ss-icon-button square" title={t("components.agentPanel.delete")}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {agent.knowledgeBase.length === 0 && !isAddingKB && <div className="rounded-2xl border border-dashed border-[var(--ss-workspace-border)] px-4 py-5 text-sm text-[var(--ss-workspace-muted)]">{t("components.agentPanel.noKnowledgeDocs")}</div>}
              {isAddingKB ? (
                <div className="ss-inset p-3 space-y-2">
                  <input type="text" placeholder={t("components.agentPanel.titlePlaceholder")} value={newKbTitle} onChange={(event) => setNewKbTitle(event.target.value)} className="ss-input w-full rounded-2xl px-3 py-2 text-sm" />
                  <textarea placeholder={t("components.agentPanel.knowledgeContent")} value={newKbContent} onChange={(event) => setNewKbContent(event.target.value)} className="ss-input h-20 w-full rounded-2xl px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => { if (!newKbTitle.trim() || !newKbContent.trim()) return; const item: KnowledgeItem = { id: `kb-${Date.now()}`, title: newKbTitle, type: "text", content: newKbContent, enabled: true, timestamp: new Date().toISOString() }; addKnowledgeToAgent(agent.id, item); setNewKbTitle(""); setNewKbContent(""); setIsAddingKB(false); }} className="ss-button flex-1">
                      {t("components.agentPanel.save")}
                    </button>
                    <button onClick={() => setIsAddingKB(false)} className="ss-button-secondary flex-1">
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setIsAddingKB(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--ss-workspace-border)] px-4 py-3 text-sm text-[var(--ss-workspace-muted)] transition-colors hover:border-[var(--ss-workspace-border-strong)] hover:text-[var(--ss-workspace-heading)]">
                  <Plus size={14} />
                  {t("components.agentPanel.addKnowledge")}
                </button>
              )}
            </div>
          )}

          <SectionToggle label={t("components.agentPanel.documentKnowledgeBase")} icon={<Upload size={16} className="text-slate-500" />} count={documents.length} open={isDocsOpen} onToggle={() => { const next = !isDocsOpen; setIsDocsOpen(next); if (next) { void loadDocuments(); } }} />
          {isDocsOpen && (
            <div className="space-y-3">
              <div
                className={`rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${isDragging ? "border-[var(--ss-workspace-border-strong)] bg-[var(--ss-workspace-surface)]" : "border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface)] hover:border-[var(--ss-workspace-border-strong)]"} ${isUploading ? "cursor-wait opacity-60" : "cursor-pointer"}`}
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
                onDrop={(event) => { event.preventDefault(); setIsDragging(false); const files = event.dataTransfer.files; if (files.length > 0) { void handleFileUpload(files[0]); } }}
                onClick={() => !isUploading && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.docx,.md"
                  onChange={(event) => {
                    const files = event.target.files;
                    if (files && files.length > 0) {
                      void handleFileUpload(files[0]);
                    }
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="hidden"
                  disabled={isUploading}
                />
                {isUploading ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                    <Loader2 size={16} className="animate-spin" />
                    <span>{t("components.agentPanel.uploading")}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload size={18} className="mx-auto text-[var(--ss-workspace-muted)]" />
                    <p className="text-sm text-[var(--ss-workspace-text)]">{t("components.agentPanel.dragDropUpload")}</p>
                    <p className="text-xs text-[var(--ss-workspace-muted)]">{t("components.agentPanel.supportedFormats")}</p>
                  </div>
                )}
              </div>
              {uploadError && <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{uploadError}</div>}
              {documents.length === 0 && !isUploading && <div className="rounded-2xl border border-dashed border-[var(--ss-workspace-border)] px-4 py-5 text-sm text-[var(--ss-workspace-muted)]">{t("components.agentPanel.noUploadedDocs")}</div>}
              {documents.map((document) => (
                <div key={document.id} className="ss-inset p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-[var(--ss-workspace-heading)]">
                        <FileIcon size={14} className="text-sky-600" />
                        <span className="truncate">{document.filename}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--ss-workspace-muted)]">
                        <span>{formatFileSize(document.file_size)}</span>
                        <span>{document.chunks_count} {t("components.agentPanel.textChunks")}</span>
                        <span>{new Date(document.uploaded_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button onClick={() => void deleteAgentDocument(simulationId!, agent.name, document.id).then(loadDocuments)} className="ss-icon-button square" title={t("components.agentPanel.delete")}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <SectionToggle label={t("components.agentPanel.shortTermMemory")} icon={<Brain size={16} className="text-slate-500" />} count={agent.memory.length} open={isMemoryOpen} onToggle={() => setIsMemoryOpen((value) => !value)} />
          {isMemoryOpen && (
            <div className="space-y-2">
              {agent.memory.length === 0 && <div className="rounded-2xl border border-dashed border-[var(--ss-workspace-border)] px-4 py-5 text-sm text-[var(--ss-workspace-muted)]">{t("components.agentPanel.noRecentActivity")}</div>}
              {agent.memory.map((memory) => (
                <div key={memory.id} className="ss-inset px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-[var(--ss-workspace-muted)]">
                    <span>{memory.type}</span>
                    <span className="font-mono normal-case tracking-normal">{memory.timestamp}</span>
                  </div>
                  <p className={`mt-2 text-sm leading-6 ${memory.type === "thought" ? "italic text-[var(--ss-workspace-muted)]" : "text-[var(--ss-workspace-text)]"}`}>{memory.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
};

export const AgentPanel: React.FC = () => {
  const { t } = useTranslation();
  const agents = useSimulationStore((state) => state.agents);
  const logs = useSimulationStore((state) => state.logs);
  const [focusActive, setFocusActive] = useState(false);

  const { activeAgentId, latestByAgent } = useMemo(() => buildActivityMap(logs, agents), [agents, logs]);
  const visibleAgents = focusActive && activeAgentId ? agents.filter((agent) => agent.id === activeAgentId) : agents;

  if (agents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="max-w-xs space-y-2">
          <div className="lab-label">{t("components.sidebar.agents")}</div>
          <p className="text-sm leading-7 text-[var(--ss-workspace-muted)]">{t("components.agentPanel.noAgents")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ss-agent-panel flex h-full flex-col">
      <div className="border-b border-[var(--ss-workspace-border)] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="kicker">{t("components.sidebar.agents")}</div>
            <p className="mt-2 text-sm leading-6 text-[var(--ss-workspace-muted)]">{t("components.sidebar.overviewHint")}</p>
          </div>
          <button
            onClick={() => setFocusActive((value) => !value)}
            className={`rounded-full border px-3 py-2 text-sm transition-colors ${focusActive ? "border-[rgba(47,128,237,0.24)] bg-[rgba(47,128,237,0.14)] text-[var(--ss-workspace-heading)]" : "border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface)] text-[var(--ss-workspace-muted)] hover:text-[var(--ss-workspace-heading)]"}`}
          >
            {focusActive ? t("components.agentPanel.showAllAgents") : t("components.agentPanel.focusActive")}
          </button>
        </div>
        {focusActive && !activeAgentId && <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{t("components.agentPanel.activeFocusEmpty")}</div>}
      </div>

      <div className="ss-agent-panel__body lab-scroll flex-1 space-y-3">
        {visibleAgents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} isActive={agent.id === activeAgentId} latestActivity={latestByAgent.get(agent.id)} />
        ))}
      </div>
    </div>
  );
};
