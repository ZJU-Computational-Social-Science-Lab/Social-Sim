import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { createProvider as apiCreateProvider, listProviders, testProvider as apiTestProvider, updateProvider, deleteProvider as apiDeleteProvider, activateProvider as apiActivateProvider, type Provider } from "../services/providers";
import { listSearchProviders, createSearchProvider, updateSearchProvider, type SearchProvider } from "../services/searchProviders";
import { listUploads, deleteUpload, findOrphans, type UploadedFile } from "../services/uploads";
import { useAuthStore } from "../store/auth";
import { useTranslation } from "react-i18next";
import { TitleCard } from "../components/TitleCard";
import { AppSelect } from "../components/AppSelect";
import { Link2Icon, TrashIcon, FilePlusIcon, StarIcon, StarFilledIcon, EyeOpenIcon, EyeClosedIcon } from "@radix-ui/react-icons";

type Tab = "profile" | "security" | "providers_llm" | "providers_search" | "files";

const TAB_PATHS: Record<Tab, string> = {
  profile: "/settings/profile",
  security: "/settings/security",
  providers_llm: "/settings/providers",
  providers_search: "/settings/search",
  files: "/settings/files",
};

function getTabFromPath(pathname: string): Tab {
  if (pathname.startsWith("/settings/security")) return "security";
  if (pathname.startsWith("/settings/providers")) return "providers_llm";
  if (pathname.startsWith("/settings/search")) return "providers_search";
  if (pathname.startsWith("/settings/files")) return "files";
  return "profile";
}

// Helper to get capability rows with translations
const getCapabilityRows = (t: (key: string) => string) => [
  {
    model: "gpt-4o-mini",
    context: "128k",
    input: "$0.15 / 1M",
    output: "$0.60 / 1M",
    modalities: "Text, Image",
    note: "settings.providers.modelNote.goodDefault",
  },
  {
    model: "gpt-4o",
    context: "128k",
    input: "$5.00 / 1M",
    output: "$15.00 / 1M",
    modalities: "Text, Image, Audio",
    note: "settings.providers.modelNote.fastLongContext",
  },
  {
    model: "gemini-1.5-flash",
    context: "1M",
    input: "$0.35 / 1M",
    output: "$1.05 / 1M",
    modalities: "Text, Image, Audio",
    note: "settings.providers.modelNote.fastLongContext",
  },
  {
    model: "gemini-1.5-pro",
    context: "2M",
    input: "$3.50 / 1M",
    output: "$10.50 / 1M",
    modalities: "Text, Image, Audio",
    note: "settings.providers.modelNote.goodDefault",
  },
];

// Provider type comes from ../api/providers

export function SettingsPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // Format file size helper
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}${t('settings.files.byte')}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}${t('settings.files.kb')}`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}${t('settings.files.mb')}`;
  };

  // Format date helper
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString();
  };
  const routeTab = getTabFromPath(location.pathname);
  const [activeTab, setActiveTab] = useState<Tab>(routeTab);
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const queryClient = useQueryClient();
  const [testHints, setTestHints] = useState<Record<number, { ok: boolean; msg: string }>>({});
  const [testingId, setTestingId] = useState<number | null>(null);


  const providersQuery = useQuery({
    queryKey: ["providers"],
    enabled: activeTab === "providers_llm",
    queryFn: () => listProviders(),
  });

  const searchProvidersQuery = useQuery({
    queryKey: ["searchProviders"],
    enabled: activeTab === "providers_search",
    queryFn: () => listSearchProviders(),
  });

  const filesQuery = useQuery({
    queryKey: ["uploads"],
    enabled: activeTab === "files",
    queryFn: () => listUploads(),
  });

  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => deleteUpload(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
    },
  });

  const [orphanResult, setOrphanResult] = useState<{ orphaned: string[]; total: number } | null>(null);
  const [findingOrphans, setFindingOrphans] = useState(false);

  const searchProvider = useMemo(() => {
    const items = searchProvidersQuery.data || [];
    return items[0] || null;
  }, [searchProvidersQuery.data]);

  const [providerDraft, setProviderDraft] = useState({
    name: "",
    provider: "openai",
    model: "gpt-4",
    base_url: "https://api.openai.com/v1",
    api_key: "",
  });
  const [keyVisible, setKeyVisible] = useState(false);

  const [searchDraft, setSearchDraft] = useState({
    provider: "ddg",
    base_url: "",
    api_key: "",
    config: { region: "", safesearch: "moderate" } as Record<string, any>,
  });

  useEffect(() => {
    setActiveTab(routeTab);
  }, [routeTab]);

  useEffect(() => {
    if (!searchProvider) return;
    setSearchDraft({
      provider: searchProvider.provider || "ddg",
      base_url: String(searchProvider.base_url || ""),
      api_key: "",
      config: (searchProvider as any).config || {},
    });
  }, [searchProvider]);

  const changeTab = (tab: Tab) => {
    setActiveTab(tab);
    navigate(TAB_PATHS[tab]);
  };

  const createProvider = useMutation({
    mutationFn: async () =>
      apiCreateProvider({
        name: providerDraft.name,
        provider: providerDraft.provider,
        model: providerDraft.model,
        base_url: providerDraft.base_url,
        api_key: providerDraft.api_key,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      setProviderDraft({ name: "", provider: "openai", model: "gpt-4", base_url: "https://api.openai.com/v1", api_key: "" });
      setKeyVisible(false);
    },
  });

  const upsertSearch = useMutation({
    mutationFn: async () => {
      if (searchProvider) {
        return updateSearchProvider(searchProvider.id, {
          provider: searchDraft.provider,
          base_url: searchDraft.base_url || null,
          api_key: searchDraft.api_key || null,
          config: searchDraft.config,
        });
      }
      return createSearchProvider({
        provider: searchDraft.provider,
        base_url: searchDraft.base_url || "",
        api_key: searchDraft.api_key || "",
        config: searchDraft.config,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["searchProviders"] });
    },
  });

  const testProvider = useMutation({
    mutationFn: async (providerId: number) => apiTestProvider(providerId),
    onMutate: (providerId: number) => {
      setTestingId(providerId);
    },
    onSuccess: (_data, providerId) => {
      setTestHints((prev) => ({ ...prev, [providerId]: { ok: true, msg: t('settings.providers.testOk') || 'OK' } }));
      setTimeout(() => {
        setTestHints((prev) => {
          const copy = { ...prev } as Record<number, { ok: boolean; msg: string }>;
          delete copy[providerId];
          return copy;
        });
      }, 3000);
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (_err, providerId) => {
      setTestHints((prev) => ({ ...prev, [providerId]: { ok: false, msg: t('settings.providers.testFail') || 'Failed' } }));
      setTimeout(() => {
        setTestHints((prev) => {
          const copy = { ...prev } as Record<number, { ok: boolean; msg: string }>;
          delete copy[providerId];
          return copy;
        });
      }, 3000);
    },
    onSettled: () => {
      setTestingId(null);
    },
  });

  const activateProvider = useMutation({
    mutationFn: async (providerId: number) => apiActivateProvider(providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
  });

  const deleteProvider = useMutation({
    mutationFn: async (providerId: number) => apiDeleteProvider(providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
  });

  const handleCreateProvider = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createProvider.mutate();
  };

  const providers = providersQuery.data ?? [];
  const activeProvider = providers.find((provider) => provider.is_active) || null;
  const uploadedFiles = filesQuery.data ?? [];
  const totalUploadedSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);

  const tabContent = useMemo(() => {
    if (activeTab === "profile") {
      return (
        <div className="settings-content">
          <div className="settings-overview-grid">
            <div className="settings-metric-card">
              <div className="page-hero__eyebrow w-fit">Identity</div>
              <div className="text-lg font-semibold text-[var(--sim-text-strong)]">{String(user?.full_name || user?.username || "-")}</div>
              <div className="text-sm text-[var(--sim-text-muted)]">{String(user?.email ?? "")}</div>
            </div>
            <div className="settings-metric-card">
              <div className="page-hero__eyebrow w-fit">Workspace</div>
              <div className="text-lg font-semibold text-[var(--sim-text-strong)]">
                {String(user?.organization || "Personal workspace")}
              </div>
              <div className="text-sm text-[var(--sim-text-muted)]">
                Keep this section in sync with the backend identity record used across simulations and saved archives.
              </div>
            </div>
          </div>

          <section className="settings-section-card">
            <div className="settings-section-card__header">
              <div>
                <div className="page-hero__eyebrow w-fit">{t('settings.tabs.profile')}</div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--sim-text-strong)]">Account details</h2>
              </div>
            </div>
            <div className="settings-list">
              <div className="settings-list-item">
                <span className="text-sm text-[var(--sim-text-soft)]">{t('settings.profile.email')}</span>
                <span className="text-sm font-medium text-[var(--sim-text-strong)]">{String(user?.email ?? "-")}</span>
              </div>
              <div className="settings-list-item">
                <span className="text-sm text-[var(--sim-text-soft)]">{t('settings.profile.username')}</span>
                <span className="text-sm font-medium text-[var(--sim-text-strong)]">{String(user?.username ?? "-")}</span>
              </div>
              <div className="settings-list-item">
                <span className="text-sm text-[var(--sim-text-soft)]">{t('settings.profile.fullName')}</span>
                <span className="text-sm font-medium text-[var(--sim-text-strong)]">{String(user?.full_name ?? "-")}</span>
              </div>
              <div className="settings-list-item">
                <span className="text-sm text-[var(--sim-text-soft)]">{t('settings.profile.organization')}</span>
                <span className="text-sm font-medium text-[var(--sim-text-strong)]">{String(user?.organization ?? "-")}</span>
              </div>
            </div>
          </section>
        </div>
      );
    }

    if (activeTab === "security") {
      return (
        <div className="settings-content">
          <div className="settings-overview-grid">
            <div className="settings-metric-card">
              <div className="page-hero__eyebrow w-fit">Session</div>
              <div className="text-lg font-semibold text-[var(--sim-text-strong)]">Browser authenticated</div>
              <div className="text-sm text-[var(--sim-text-muted)]">
                This workspace keeps your local session active for dashboard, creation studio, and runtime collaboration.
              </div>
            </div>
            <div className="settings-metric-card">
              <div className="page-hero__eyebrow w-fit">Protection</div>
              <div className="text-lg font-semibold text-[var(--sim-text-strong)]">Manual sign-out controls</div>
              <div className="text-sm text-[var(--sim-text-muted)]">{t('settings.security.placeholder')}</div>
            </div>
          </div>

          <section className="settings-section-card">
            <div className="settings-section-card__header">
              <div>
                <div className="page-hero__eyebrow w-fit">{t('settings.tabs.security')}</div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--sim-text-strong)]">Session controls</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--sim-text-muted)]">{t('settings.security.placeholder')}</p>
              </div>
            </div>
            <div className="rounded-[20px] border border-[rgba(196,107,114,0.18)] bg-[rgba(196,107,114,0.08)] p-4 text-sm leading-6 text-[var(--sim-text)]">
              Use this if you need to immediately clear the current browser session and disconnect any authenticated workflow.
            </div>
            <button type="button" className="button-danger w-fit" onClick={() => clearSession()}>
              {t('settings.security.signoutAll')}
            </button>
          </section>
        </div>
      );
    }

    if (activeTab === "providers_llm") {
      return (
        <div className="settings-content">
          <div className="settings-overview-grid">
            <div className="settings-metric-card">
              <div className="page-hero__eyebrow w-fit">Active provider</div>
              <div className="text-lg font-semibold text-[var(--sim-text-strong)]">{activeProvider?.name || "-"}</div>
              <div className="text-sm text-[var(--sim-text-muted)]">
                {activeProvider ? `${activeProvider.provider} · ${activeProvider.model}` : t('settings.providers.none')}
              </div>
            </div>
            <div className="settings-metric-card">
              <div className="page-hero__eyebrow w-fit">Registry</div>
              <div className="text-lg font-semibold text-[var(--sim-text-strong)]">{providers.length} configured</div>
              <div className="text-sm text-[var(--sim-text-muted)]">
                Test, activate, and rotate models without changing the experiment payload schema.
              </div>
            </div>
          </div>

          <section className="settings-section-card">
            <div className="settings-section-card__header">
              <div>
                <div className="page-hero__eyebrow w-fit">{t('settings.providers.title')}</div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--sim-text-strong)]">Provider registry</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--sim-text-muted)]">
                  {t('settings.providers.current', { name: activeProvider?.name || '-' })}
                </p>
              </div>
            </div>

            {providersQuery.isLoading && <div className="text-sm text-[var(--sim-text-muted)]">{t('settings.providers.loading')}</div>}
            {providersQuery.error && <div className="text-sm text-[var(--sim-danger)]">{t('settings.providers.error')}</div>}

            {!providersQuery.isLoading && providers.length === 0 && (
              <div className="studio-empty-state">
                <div className="text-sm font-semibold text-[var(--sim-text-strong)]">{t('settings.providers.none')}</div>
                <p className="max-w-md text-sm leading-6 text-[var(--sim-text-muted)]">
                  Add at least one LLM provider to unlock connected-mode generation and model-specific agent assignment.
                </p>
              </div>
            )}

            {providers.length > 0 && (
              <div>
                {providers.map((provider) => {
                  const active = provider.is_active;
                  return (
                    <div key={provider.id} className="settings-provider-row">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-[var(--sim-text-strong)]">{provider.name}</div>
                        <div className="mt-1 text-sm text-[var(--sim-text-muted)]">
                          {provider.provider} · {provider.model} · {provider.base_url || '-'}
                        </div>
                        <div className="settings-provider-row__meta">
                          {active && <span className="status-pill">{t('settings.providers.activeTag') || 'Active'}</span>}
                          {provider.is_default && <span className="status-pill">Default</span>}
                          {testHints[provider.id] && (
                            <span className="status-pill">
                              {testHints[provider.id].ok ? 'Healthy' : 'Needs attention'} · {testHints[provider.id].msg}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="settings-provider-row__actions">
                        <button
                          type="button"
                          className="icon-button square"
                          title={t('settings.providers.test')}
                          aria-label={t('settings.providers.test')}
                          onClick={() => testProvider.mutate(provider.id)}
                          disabled={testingId !== null}
                        >
                          {testingId === provider.id ? <span className="spinner" aria-hidden /> : <Link2Icon />}
                        </button>
                        <button
                          type="button"
                          className="icon-button square"
                          title={active ? (t('settings.providers.activeTag') || 'Active') : (t('settings.providers.makeActive') || 'Use')}
                          aria-label={active ? (t('settings.providers.activeTag') || 'Active') : (t('settings.providers.makeActive') || 'Use')}
                          onClick={() => !active && activateProvider.mutate(provider.id)}
                          disabled={active || activateProvider.isPending}
                        >
                          {active ? <StarFilledIcon /> : <StarIcon />}
                        </button>
                        <button
                          type="button"
                          className="icon-button square"
                          title={t('saved.delete')}
                          aria-label={t('saved.delete')}
                          onClick={() => {
                            if (active) {
                              const msg = t('settings.providers.deleteActiveConfirm') || 'This provider is active. Delete anyway?';
                              if (!window.confirm(msg)) return;
                            }
                            deleteProvider.mutate(provider.id);
                          }}
                          disabled={deleteProvider.isPending}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="settings-section-card">
            <div className="settings-section-card__header">
              <div>
                <div className="page-hero__eyebrow w-fit">{t('settings.providers.add')}</div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--sim-text-strong)]">Add a provider</h2>
              </div>
            </div>
            <form onSubmit={handleCreateProvider} className="settings-form-grid two">
              <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                {t('settings.providers.fields.label')}
                <input
                  className="input small"
                  required
                  value={providerDraft.name}
                  onChange={(event) => setProviderDraft((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                {t('settings.providers.fields.provider')}
                <AppSelect
                  value={providerDraft.provider}
                  options={[
                    { value: 'openai', label: t('settings.providers.type.openai') },
                    { value: 'gemini', label: t('settings.providers.type.gemini') },
                  ]}
                  onChange={(val) =>
                    setProviderDraft((prev) => ({
                      ...prev,
                      provider: val,
                      base_url: val === 'openai' ? 'https://api.openai.com/v1' : '',
                    }))
                  }
                  size="small"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                {t('settings.providers.fields.model')}
                <input
                  className="input small"
                  required
                  value={providerDraft.model}
                  onChange={(event) => setProviderDraft((prev) => ({ ...prev, model: event.target.value }))}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                {t('settings.providers.fields.baseUrl')}
                <input
                  className="input small"
                  required
                  value={providerDraft.base_url}
                  onChange={(event) => setProviderDraft((prev) => ({ ...prev, base_url: event.target.value }))}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)] md:col-span-2">
                {t('settings.providers.fields.apiKey')}
                <div className="flex items-center gap-3">
                  <input
                    required
                    type={keyVisible ? "text" : "password"}
                    className="input small"
                    value={providerDraft.api_key}
                    onChange={(event) => setProviderDraft((prev) => ({ ...prev, api_key: event.target.value }))}
                  />
                  <button
                    type="button"
                    className="icon-button square"
                    title={keyVisible ? (t('common.hide') || 'Hide') : (t('common.show') || 'Show')}
                    aria-label={keyVisible ? (t('common.hide') || 'Hide') : (t('common.show') || 'Show')}
                    onClick={() => setKeyVisible((prev) => !prev)}
                  >
                    {keyVisible ? <EyeClosedIcon /> : <EyeOpenIcon />}
                  </button>
                </div>
              </label>
              {createProvider.error && (
                <div className="md:col-span-2 text-sm text-[var(--sim-danger)]">
                  {t('settings.providers.createFailed') || 'Failed to add provider.'}
                </div>
              )}
              <div className="md:col-span-2 flex items-center gap-3">
                <button type="submit" className="button" disabled={createProvider.isPending}>
                  {createProvider.isPending ? <span className="spinner" aria-hidden /> : <FilePlusIcon />}
                  {t('settings.providers.save')}
                </button>
                <span className="settings-inline-note">Credentials stay bound to the existing provider API contract.</span>
              </div>
            </form>
          </section>

          <section className="settings-section-card">
            <div className="settings-section-card__header">
              <div>
                <div className="page-hero__eyebrow w-fit">{t('settings.providers.capabilities.title')}</div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--sim-text-strong)]">Model guide</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--sim-text-muted)]">
                  {t('settings.providers.capabilities.hint')}
                </p>
              </div>
            </div>
            <div className="settings-list">
              {getCapabilityRows(t).map((row) => (
                <div key={row.model} className="settings-list-item">
                  <div>
                    <div className="text-base font-semibold text-[var(--sim-text-strong)]">{row.model}</div>
                    <div className="mt-1 text-sm text-[var(--sim-text-muted)]">
                      {t('settings.providers.capabilities.modalities')}: {row.modalities}
                    </div>
                    <div className="mt-2 text-sm text-[var(--sim-text-soft)]">
                      {t('settings.providers.capabilities.note')}: {t(row.note)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="status-pill">{t('settings.providers.capabilities.context')}: {row.context}</span>
                    <span className="status-pill">{t('settings.providers.capabilities.input')}: {row.input}</span>
                    <span className="status-pill">{t('settings.providers.capabilities.output')}: {row.output}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="settings-inline-note">{t('settings.providers.capabilities.disclaimer')}</div>
          </section>
        </div>
      );
    }

    if (activeTab === "providers_search") {
      return (
        <div className="settings-content">
          <div className="settings-overview-grid">
            <div className="settings-metric-card">
              <div className="page-hero__eyebrow w-fit">Active engine</div>
              <div className="text-lg font-semibold text-[var(--sim-text-strong)]">{searchProvider?.provider || "-"}</div>
              <div className="text-sm text-[var(--sim-text-muted)]">{searchProvider?.base_url || "Local/default settings"}</div>
            </div>
            <div className="settings-metric-card">
              <div className="page-hero__eyebrow w-fit">Research flow</div>
              <div className="text-lg font-semibold text-[var(--sim-text-strong)]">Prompt-time retrieval</div>
              <div className="text-sm text-[var(--sim-text-muted)]">
                Tune search behavior without changing the simulation runtime or file schema.
              </div>
            </div>
          </div>

          <section className="settings-section-card">
            <div className="settings-section-card__header">
              <div>
                <div className="page-hero__eyebrow w-fit">{t('settings.providers.searchTab') || 'Search providers'}</div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--sim-text-strong)]">{t('settings.providers.setSearchProvider')}</h2>
              </div>
            </div>

            <div className="settings-form-grid two">
              <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                {t('settings.providers.fields.provider')}
                <AppSelect
                  value={searchDraft.provider}
                  options={[
                    { value: "ddg", label: t('settings.providers.searchEngine.ddg') },
                    { value: "serpapi", label: t('settings.providers.searchEngine.serpapi') },
                    { value: "serper", label: t('settings.providers.searchEngine.serper') },
                    { value: "tavily", label: t('settings.providers.searchEngine.tavily') },
                    { value: "mock", label: "Mock" },
                  ]}
                  onChange={(val) => setSearchDraft((p) => ({ ...p, provider: val }))}
                  size="small"
                />
              </label>

              {(searchDraft.provider === "serpapi" || searchDraft.provider === "serper" || searchDraft.provider === "tavily") && (
                <>
                  <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                    {t('settings.providers.fields.baseUrl')}
                    <input className="input small" value={searchDraft.base_url} onChange={(e) => setSearchDraft((p) => ({ ...p, base_url: e.target.value }))} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                    {t('settings.providers.fields.apiKey')}
                    <input className="input small" value={searchDraft.api_key} onChange={(e) => setSearchDraft((p) => ({ ...p, api_key: e.target.value }))} />
                  </label>
                </>
              )}

              {searchDraft.provider === "ddg" && (
                <>
                  <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                    {t('settings.providers.search.region')}
                    <input
                      className="input small"
                      value={String((searchDraft.config as any).region || "")}
                      onChange={(e) => setSearchDraft((p) => ({ ...p, config: { ...(p.config || {}), region: e.target.value } }))}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                    {t('settings.providers.search.safeSearch')}
                    <input
                      className="input small"
                      value={String((searchDraft.config as any).safesearch || "moderate")}
                      onChange={(e) => setSearchDraft((p) => ({ ...p, config: { ...(p.config || {}), safesearch: e.target.value } }))}
                    />
                  </label>
                </>
              )}

              {searchDraft.provider === "tavily" && (
                <>
                  <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                    {t('settings.providers.search.searchDepth')}
                    <AppSelect
                      value={String((searchDraft.config as any).search_depth || "basic")}
                      options={[
                        { value: "basic", label: "basic" },
                        { value: "advanced", label: "advanced" },
                      ]}
                      onChange={(val) => setSearchDraft((p) => ({ ...p, config: { ...(p.config || {}), search_depth: val } }))}
                      size="small"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                    {t('settings.providers.search.includeAnswer')}
                    <div className="settings-list-item">
                      <span className="text-sm text-[var(--sim-text-muted)]">Include direct answer extraction</span>
                      <input
                        type="checkbox"
                        checked={Boolean((searchDraft.config as any).include_answer || false)}
                        onChange={(e) => setSearchDraft((p) => ({ ...p, config: { ...(p.config || {}), include_answer: e.target.checked } }))}
                      />
                    </div>
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                    {t('settings.providers.search.topic')}
                    <input
                      className="input small"
                      value={String((searchDraft.config as any).topic || "")}
                      onChange={(e) => setSearchDraft((p) => ({ ...p, config: { ...(p.config || {}), topic: e.target.value } }))}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                    {t('settings.providers.search.days')}
                    <input
                      className="input small"
                      type="number"
                      min={1}
                      value={Number((searchDraft.config as any).days || 7)}
                      onChange={(e) => setSearchDraft((p) => ({ ...p, config: { ...(p.config || {}), days: Number(e.target.value || 0) } }))}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                    {t('settings.providers.search.includeDomains')}
                    <input
                      className="input small"
                      value={String((searchDraft.config as any).include_domains || "")}
                      onChange={(e) => setSearchDraft((p) => ({ ...p, config: { ...(p.config || {}), include_domains: e.target.value } }))}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                    {t('settings.providers.search.excludeDomains')}
                    <input
                      className="input small"
                      value={String((searchDraft.config as any).exclude_domains || "")}
                      onChange={(e) => setSearchDraft((p) => ({ ...p, config: { ...(p.config || {}), exclude_domains: e.target.value } }))}
                    />
                  </label>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="button" onClick={() => upsertSearch.mutate()} disabled={upsertSearch.isPending}>
                {upsertSearch.isPending ? <span className="spinner" aria-hidden /> : <FilePlusIcon />}
                {t('settings.providers.save')}
              </button>
              {searchProvider && (
                <span className="settings-inline-note">
                  {t('settings.providers.search.active')}: {searchProvider.provider}
                </span>
              )}
            </div>
          </section>
        </div>
      );
    }

    if (activeTab === "files") {
      return (
        <div className="settings-content">
          <div className="settings-overview-grid">
            <div className="settings-metric-card">
              <div className="page-hero__eyebrow w-fit">Archive</div>
              <div className="text-lg font-semibold text-[var(--sim-text-strong)]">{uploadedFiles.length} files</div>
              <div className="text-sm text-[var(--sim-text-muted)]">{formatSize(totalUploadedSize)}</div>
            </div>
            <div className="settings-metric-card">
              <div className="page-hero__eyebrow w-fit">Integrity</div>
              <div className="text-lg font-semibold text-[var(--sim-text-strong)]">
                {orphanResult ? orphanResult.orphaned.length : 0} orphan candidates
              </div>
              <div className="text-sm text-[var(--sim-text-muted)]">{t('settings.files.description')}</div>
            </div>
          </div>

          <section className="settings-section-card">
            <div className="settings-section-card__header">
              <div>
                <div className="page-hero__eyebrow w-fit">{t('settings.files.title')}</div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--sim-text-strong)]">File archive</h2>
              </div>
            </div>

            {filesQuery.isLoading && <div className="text-sm text-[var(--sim-text-muted)]">{t('settings.files.loading')}</div>}
            {filesQuery.error && <div className="text-sm text-[var(--sim-danger)]">{t('settings.files.error')}</div>}

            {uploadedFiles.length > 0 && (
              <div className="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>{t('settings.files.table.filename')}</th>
                      <th>{t('settings.files.table.type')}</th>
                      <th>{t('settings.files.table.size')}</th>
                      <th>{t('settings.files.table.created')}</th>
                      <th style={{ textAlign: 'right' }}>{t('settings.files.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedFiles.map((file) => (
                      <tr key={file.id}>
                        <td>
                          <span title={file.filename}>{file.filename}</span>
                        </td>
                        <td>
                          <span className="status-pill">{String(file.type || '-').toUpperCase()}</span>
                        </td>
                        <td>{formatSize(file.size)}</td>
                        <td className="text-[var(--sim-text-muted)]">{formatDate(file.created)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="icon-button square"
                            title={t('settings.files.delete')}
                            aria-label={t('settings.files.delete')}
                            onClick={() => {
                              if (window.confirm(t('settings.files.deleteConfirm'))) {
                                deleteFile.mutate(file.id);
                              }
                            }}
                            disabled={deleteFile.isPending}
                          >
                            <TrashIcon />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!filesQuery.isLoading && uploadedFiles.length === 0 && (
              <div className="studio-empty-state">
                <div className="text-sm font-semibold text-[var(--sim-text-strong)]">{t('settings.files.empty')}</div>
                <p className="max-w-md text-sm leading-6 text-[var(--sim-text-muted)]">
                  Uploaded archives and imported assets will appear here once the file workflow is used.
                </p>
              </div>
            )}
          </section>

          <section className="settings-section-card">
            <div className="settings-section-card__header">
              <div>
                <div className="page-hero__eyebrow w-fit">Maintenance</div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--sim-text-strong)]">Integrity checks</h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="button"
                onClick={async () => {
                  setFindingOrphans(true);
                  try {
                    const result = await findOrphans();
                    setOrphanResult(result);
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setFindingOrphans(false);
                  }
                }}
                disabled={findingOrphans}
              >
                {findingOrphans ? '...' : t('settings.files.findOrphans')}
              </button>
              {orphanResult && (
                <span className="settings-inline-note">
                  {orphanResult.orphaned.length > 0
                    ? t('settings.files.orphansFound', { count: orphanResult.orphaned.length })
                    : t('settings.files.noOrphans')}
                </span>
              )}
            </div>
          </section>
        </div>
      );
    }

    return null;
  }, [
    activeTab,
    user,
    clearSession,
    providers,
    activeProvider,
    providersQuery.isLoading,
    providersQuery.error,
    providerDraft,
    createProvider.error,
    createProvider.isPending,
    testHints,
    testingId,
    activateProvider.isPending,
    deleteProvider.isPending,
    keyVisible,
    searchProvider,
    searchDraft,
    upsertSearch.isPending,
    uploadedFiles,
    totalUploadedSize,
    filesQuery.isLoading,
    filesQuery.error,
    deleteFile.isPending,
    orphanResult,
    findingOrphans,
    t,
    formatSize,
    formatDate,
  ]);

  return (
    <div className="settings-shell">
      <TitleCard
        eyebrow="Workspace controls"
        title={t('settings.title')}
        subtitle="Manage identity, security, providers, search, and file storage inside one calmer settings surface."
      />
      <div className="tab-layout">
        <aside className="settings-section-card settings-sidebar-card">
          <div className="panel-subtitle" style={{ marginBottom: "0.5rem" }}>
            Product settings
          </div>
          <nav className="tab-nav">
            <button type="button" className={`tab-button ${activeTab === "profile" ? "active" : ""}`} onClick={() => changeTab("profile")}>
              {t('settings.tabs.profile')}
            </button>
            <button type="button" className={`tab-button ${activeTab === "security" ? "active" : ""}`} onClick={() => changeTab("security")}>
              {t('settings.tabs.security')}
            </button>
            <button type="button" className={`tab-button ${activeTab === "providers_llm" ? "active" : ""}`} onClick={() => changeTab("providers_llm")}>
              {t('settings.tabs.llmProviders') || t('settings.providers.llmTab')}
            </button>
            <button type="button" className={`tab-button ${activeTab === "providers_search" ? "active" : ""}`} onClick={() => changeTab("providers_search")}>
              {t('settings.tabs.searchProviders') || t('settings.providers.searchTab')}
            </button>
            <button type="button" className={`tab-button ${activeTab === "files" ? "active" : ""}`} onClick={() => changeTab("files")}>
              {t('settings.tabs.files')}
            </button>
          </nav>
        </aside>
        <section className="settings-content">{tabContent}</section>
      </div>
    </div>
  );
}

// (Radix-based AppSelect replaces local FancySelect)
