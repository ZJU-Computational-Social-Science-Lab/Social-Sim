import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createProvider as apiCreateProvider, listProviders, testProvider as apiTestProvider, updateProvider, deleteProvider as apiDeleteProvider, activateProvider as apiActivateProvider, type Provider } from "../services/providers";
import { listSearchProviders, createSearchProvider, updateSearchProvider, type SearchProvider } from "../services/searchProviders";
import { listUploads, deleteUpload, findOrphans, type UploadedFile } from "../services/uploads";
import { useAuthStore } from "../store/auth";
import { useTranslation } from "react-i18next";
import { TitleCard } from "../components/TitleCard";
import { AppSelect } from "../components/AppSelect";
import { Link2Icon, TrashIcon, FilePlusIcon, StarIcon, StarFilledIcon, EyeOpenIcon, EyeClosedIcon } from "@radix-ui/react-icons";

type Tab = "profile" | "security" | "providers_llm" | "providers_search" | "files";

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
  const [activeTab, setActiveTab] = useState<Tab>("profile");
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
    if (!searchProvider) return;
    setSearchDraft({
      provider: searchProvider.provider || "ddg",
      base_url: String(searchProvider.base_url || ""),
      api_key: "",
      config: (searchProvider as any).config || {},
    });
  }, [searchProvider]);

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

  const tabContent = useMemo(() => {
    if (activeTab === "profile") {
      return (
        <div className="panel" style={{ gap: "0.5rem" }}>
          <div className="panel-title">{t('settings.tabs.profile')}</div>
          <div className="card">
            <div><strong>{t('settings.profile.email')}:</strong> {String(user?.email ?? "")}</div>
            <div><strong>{t('settings.profile.username')}:</strong> {String(user?.username ?? "")}</div>
            <div><strong>{t('settings.profile.fullName')}:</strong> {String(user?.full_name ?? "")}</div>
            <div><strong>{t('settings.profile.organization')}:</strong> {String(user?.organization ?? "")}</div>
          </div>
        </div>
      );
    }

    if (activeTab === "security") {
      return (
        <div className="panel" style={{ gap: "0.5rem" }}>
          <div className="panel-title">{t('settings.tabs.security')}</div>
          <div className="card">
            <p>{t('settings.security.placeholder')}</p>
            <button type="button" className="button button-danger" style={{ alignSelf: "flex-start" }} onClick={() => clearSession()}>
              {t('settings.security.signoutAll')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="panel" style={{ gap: "0.75rem" }}>
        <div className="panel-header" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div className="panel-title">{t('settings.providers.title')}</div>
          {activeTab === 'providers_llm' && (
            (() => {
              const activeProv = (providersQuery.data || []).find((p) => Boolean((p.config as any)?.active));
              const name = activeProv ? activeProv.name : '-';
              return (
                <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                  {t('settings.providers.current', { name })}
                </div>
              );
            })()
          )}
        </div>

        {/* LLM Providers: list above, add form below */}
        {activeTab === 'providers_llm' && (
          <>
            {/* List (no outer card) */}
            <div className="card" style={{ display: 'grid', gap: 0, padding: '0.2rem 0.6rem' }}>
              {providersQuery.isLoading && <div>{t('settings.providers.loading')}</div>}
              {providersQuery.error && <div style={{ color: "#f87171" }}>{t('settings.providers.error')}</div>}
              {(providersQuery.data ?? []).map((provider, idx) => {
                const active = Boolean((provider.config as any)?.active);
                return (
                  <div key={provider.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '0.5rem 0' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{provider.name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {provider.provider} · {provider.model} · {provider.base_url || '-'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      {testHints[provider.id] && (
                        <span style={{ fontSize: '0.8rem', color: testHints[provider.id].ok ? '#22c55e' : '#f87171' }}>
                          {testHints[provider.id].ok ? '✓' : '✕'} {testHints[provider.id].msg}
                        </span>
                      )}
                      <button
                        type="button"
                        className="icon-button square"
                        title={t('settings.providers.test')}
                        aria-label={t('settings.providers.test')}
                        onClick={() => testProvider.mutate(provider.id)}
                        disabled={testingId !== null}
                        style={{ borderColor: 'var(--border)', color: '#2563eb' }}
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
                        style={{ borderColor: 'var(--border)', color: '#f59e0b' }}
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
                        style={{ borderColor: 'var(--border)', color: '#ef4444' }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                    {idx < (providersQuery.data?.length || 0) - 1 && <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', margin: '0.4rem 0 0 0', opacity: 0.8 }} />}
                  </div>
                );
              })}
              {(providersQuery.data ?? []).length === 0 && <div style={{ color: "#94a3b8" }}>{t('settings.providers.none')}</div>}
            </div>

            {/* Add form */}
            <form onSubmit={handleCreateProvider} className="card" style={{ gap: "0.25rem", padding: '0.45rem 0.55rem', marginTop: '0.6rem', fontSize: '0.85rem' }}>
              <h2 style={{ margin: 0, fontSize: "0.9rem" }}>{t('settings.providers.add')}</h2>
              <label>
                {t('settings.providers.fields.label')}
                <input className="input small"
                  required
                  value={providerDraft.name}
                  onChange={(event) => setProviderDraft((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <label>
                {t('settings.providers.fields.provider')}
                <AppSelect
                  value={providerDraft.provider}
                  options={[
                    { value: 'openai', label: t('settings.providers.type.openai') },
                    { value: 'gemini', label: t('settings.providers.type.gemini') },
                  ]}
                  onChange={(val) => setProviderDraft((prev) => ({ ...prev, provider: val, base_url: val === 'openai' ? 'https://api.openai.com/v1' : '' }))}
                  size="small"
                />
              </label>
              <label>
                {t('settings.providers.fields.model')}
                <input className="input small"
                  required
                  value={providerDraft.model}
                  onChange={(event) => setProviderDraft((prev) => ({ ...prev, model: event.target.value }))}
                />
              </label>
              <label>
                {t('settings.providers.fields.baseUrl')}
                <input className="input small"
                  required
                  value={providerDraft.base_url}
                  onChange={(event) => setProviderDraft((prev) => ({ ...prev, base_url: event.target.value }))}
                />
              </label>
              <label>
                {t('settings.providers.fields.apiKey')}
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem" }}>
                  <input
                    required
                    type={keyVisible ? "text" : "password"}
                    className="input small"
                    value={providerDraft.api_key}
                    onChange={(event) => setProviderDraft((prev) => ({ ...prev, api_key: event.target.value }))}
                    style={{ flex: 1 }}
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
              {createProvider.error && <div style={{ color: "#f87171" }}>{t('settings.providers.createFailed') || 'Failed to add provider.'}</div>}
              <button
                type="submit"
                className="icon-button square"
                title={t('settings.providers.save')}
                aria-label={t('settings.providers.save')}
                disabled={createProvider.isPending}
                style={{ color: '#16a34a' }}
              >
                {createProvider.isPending ? <span className="spinner" aria-hidden /> : <FilePlusIcon />}
              </button>
            </form>

            <div className="card" style={{ padding: '0.6rem 0.7rem', display: 'grid', gap: '0.4rem' }}>
              <div className="panel-subtitle" style={{ margin: 0 }}>{t('settings.providers.capabilities.title')}</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{t('settings.providers.capabilities.hint')}</div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {getCapabilityRows(t).map((row) => (
                  <div key={row.model} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '0.6rem 0.7rem', background: 'rgba(255,255,255,0.02)', display: 'grid', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{row.model}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{t('settings.providers.capabilities.modalities')}: {row.modalities}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <span className="pill" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#1d4ed8', padding: '0.2rem 0.45rem', borderRadius: '999px', fontSize: '0.85rem' }}>
                          {t('settings.providers.capabilities.context')}: {row.context}
                        </span>
                        <span className="pill" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', padding: '0.2rem 0.45rem', borderRadius: '999px', fontSize: '0.85rem' }}>
                          {t('settings.providers.capabilities.input')}: {row.input}
                        </span>
                        <span className="pill" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#b45309', padding: '0.2rem 0.45rem', borderRadius: '999px', fontSize: '0.85rem' }}>
                          {t('settings.providers.capabilities.output')}: {row.output}
                        </span>
                      </div>
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                      {t('settings.providers.capabilities.note')}: {t(row.note)}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{t('settings.providers.capabilities.disclaimer')}</div>
            </div>
          </>
        )}

        {/* Search Providers */}
        {activeTab === 'providers_search' && (
          <>
            <div className="card" style={{ padding: '0.6rem 0.7rem', display: 'grid', gap: '0.25rem' }}>
              <div className="panel-subtitle" style={{ margin: 0 }}>{t('settings.providers.searchTab') || 'Search providers'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '0.5rem', rowGap: '0.2rem', alignItems: 'baseline', fontSize: '0.9rem', lineHeight: 1.25 }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{t('settings.providers.fields.provider')}</div>
                <div>{searchProvider ? (searchProvider.provider || '-') : '-'}</div>
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{t('settings.providers.fields.baseUrl')}</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{searchProvider ? (searchProvider.base_url || '-') : '-'}</div>
              </div>
            </div>
            <div className="card" style={{ gap: "0.3rem", padding: '0.5rem 0.6rem', fontSize: '0.85rem' }}>
              <h2 style={{ margin: 0, fontSize: "0.9rem" }}>{t('settings.providers.setSearchProvider')}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <label>
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
                    <label>
                      {t('settings.providers.fields.baseUrl')}
                      <input className="input small" value={searchDraft.base_url} onChange={(e) => setSearchDraft((p) => ({ ...p, base_url: e.target.value }))} />
                    </label>
                    <label>
                      {t('settings.providers.fields.apiKey')}
                      <input className="input small" value={searchDraft.api_key} onChange={(e) => setSearchDraft((p) => ({ ...p, api_key: e.target.value }))} />
                    </label>
                  </>
                )}
                {searchDraft.provider === "ddg" && (
                  <>
                    <label>
                      {t('settings.providers.search.region')}
                      <input className="input small" value={String((searchDraft.config as any).region || "")} onChange={(e) => setSearchDraft((p) => ({ ...p, config: { ...(p.config || {}), region: e.target.value } }))} />
                    </label>
                    <label>
                      {t('settings.providers.search.safeSearch')}
                      <input className="input small" value={String((searchDraft.config as any).safesearch || "moderate")} onChange={(e) => setSearchDraft((p) => ({ ...p, config: { ...(p.config || {}), safesearch: e.target.value } }))} />
                    </label>
                  </>
                )}
                {searchDraft.provider === "tavily" && (
                  <>
                    <label>
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
                    <label>
                      {t('settings.providers.search.includeAnswer')}
                      <input
                        type="checkbox"
                        checked={Boolean((searchDraft.config as any).include_answer || false)}
                        onChange={(e) => setSearchDraft((p) => ({ ...p, config: { ...(p.config || {}), include_answer: e.target.checked } }))}
                      />
                    </label>
                    <label>
                      {t('settings.providers.search.topic')}
                      <input
                        className="input small"
                        value={String((searchDraft.config as any).topic || "")}
                        onChange={(e) => setSearchDraft((p) => ({ ...p, config: { ...(p.config || {}), topic: e.target.value } }))}
                      />
                    </label>
                    <label>
                      {t('settings.providers.search.days')}
                      <input
                        className="input small"
                        type="number"
                        min={1}
                        value={Number((searchDraft.config as any).days || 7)}
                        onChange={(e) => setSearchDraft((p) => ({ ...p, config: { ...(p.config || {}), days: Number(e.target.value || 0) } }))}
                      />
                    </label>
                    <label>
                      {t('settings.providers.search.includeDomains')}
                      <input
                        className="input small"
                        value={String((searchDraft.config as any).include_domains || "")}
                        onChange={(e) => setSearchDraft((p) => ({ ...p, config: { ...(p.config || {}), include_domains: e.target.value } }))}
                      />
                    </label>
                    <label>
                      {t('settings.providers.search.excludeDomains')}
                      <input
                        className="input small"
                        value={String((searchDraft.config as any).exclude_domains || "")}
                        onChange={(e) => setSearchDraft((p) => ({ ...p, config: { ...(p.config || {}), exclude_domains: e.target.value } }))}
                      />
                    </label>
                  </>
                )}
                {searchDraft.provider === "mock" && (
                  <>
                    <div />
                    <div />
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button
                  type="button"
                  className="icon-button square"
                  title={t('settings.providers.save')}
                  aria-label={t('settings.providers.save')}
                  onClick={() => upsertSearch.mutate()}
                  disabled={upsertSearch.isPending}
                  style={{ color: '#16a34a' }}
                >
                  {upsertSearch.isPending ? <span className="spinner" aria-hidden /> : <FilePlusIcon />}
                </button>
                {searchProvider && (
                  <div style={{ color: "#94a3b8", lineHeight: 1 }}>
                    {t('settings.providers.search.active')}: {searchProvider.provider}
                  </div>

                )}
              </div>
            </div>
          </>)
        }

        {/* File Management Tab */}
        {activeTab === 'files' && (
          <div className="card" style={{ padding: '0.6rem 0.7rem', display: 'grid', gap: '0.4rem' }}>
            <div className="panel-subtitle" style={{ margin: 0 }}>{t('settings.files.title')}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{t('settings.files.description')}</div>

            {filesQuery.isLoading && <div>{t('settings.files.loading')}</div>}
            {filesQuery.error && <div style={{ color: "#f87171" }}>{t('settings.files.error')}</div>}

            {filesQuery.data && filesQuery.data.length > 0 && (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ background: 'rgba(0,0,0,0.02)' }}>
                    <tr>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 600 }}>{t('settings.files.table.filename')}</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 600 }}>{t('settings.files.table.type')}</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 600 }}>{t('settings.files.table.size')}</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 600 }}>{t('settings.files.table.created')}</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>{t('settings.files.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filesQuery.data.map((file) => (
                      <tr key={file.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span title={file.filename}>{file.filename}</span>
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <span style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>{file.type || '-'}</span>
                        </td>
                        <td style={{ padding: '0.5rem' }}>{formatSize(file.size)}</td>
                        <td style={{ padding: '0.5rem', color: 'var(--muted)' }}>{formatDate(file.created)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
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
                            style={{ borderColor: 'var(--border)', color: '#ef4444' }}
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

            {filesQuery.data && filesQuery.data.length === 0 && (
              <div style={{ color: "#94a3b8" }}>{t('settings.files.empty')}</div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  {orphanResult.orphaned.length > 0
                    ? t('settings.files.orphansFound', { count: orphanResult.orphaned.length })
                    : t('settings.files.noOrphans')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

    );
  }, [activeTab, user, providerDraft, providersQuery, createProvider, testProvider, clearSession, keyVisible, filesQuery, deleteFile, t, formatSize, formatDate, orphanResult, findingOrphans]);

  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <TitleCard title={t('settings.title')} />
      <div className="tab-layout">
        <nav className="tab-nav">
          <button type="button" className={`tab-button ${activeTab === "profile" ? "active" : ""}`} onClick={() => setActiveTab("profile")}>
            {t('settings.tabs.profile')}
          </button>
          <button type="button" className={`tab-button ${activeTab === "security" ? "active" : ""}`} onClick={() => setActiveTab("security")}>
            {t('settings.tabs.security')}
          </button>
          <button type="button" className={`tab-button ${activeTab === "providers_llm" ? "active" : ""}`} onClick={() => setActiveTab("providers_llm")}>
            {t('settings.tabs.llmProviders') || t('settings.providers.llmTab')}
          </button>
          <button type="button" className={`tab-button ${activeTab === "providers_search" ? "active" : ""}`} onClick={() => setActiveTab("providers_search")}>
            {t('settings.tabs.searchProviders') || t('settings.providers.searchTab')}
          </button>
          <button type="button" className={`tab-button ${activeTab === "files" ? "active" : ""}`} onClick={() => setActiveTab("files")}>
            {t('settings.tabs.files')}
          </button>
        </nav>
        <section>{tabContent}</section>
      </div>
    </div>
  );
}

// (Radix-based AppSelect replaces local FancySelect)
