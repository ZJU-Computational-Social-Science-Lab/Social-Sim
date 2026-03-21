import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Database,
  FileStack,
  LogOut,
  Search,
  Shield,
  UserCircle2,
  WandSparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  EyeClosedIcon,
  EyeOpenIcon,
  FilePlusIcon,
  Link2Icon,
  StarFilledIcon,
  StarIcon,
  TrashIcon,
} from "@radix-ui/react-icons";

import { AppSelect } from "../components/AppSelect";
import { TitleCard } from "../components/TitleCard";
import {
  activateProvider as apiActivateProvider,
  createProvider as apiCreateProvider,
  deleteProvider as apiDeleteProvider,
  listProviders,
  testProvider as apiTestProvider,
} from "../services/providers";
import {
  createSearchProvider,
  listSearchProviders,
  updateSearchProvider,
} from "../services/searchProviders";
import { deleteUpload, findOrphans, listUploads } from "../services/uploads";
import { useAuthStore } from "../store/auth";

type Tab = "profile" | "security" | "providers_llm" | "providers_search" | "files";

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

function SettingsMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="ss-settings-metric ss-inset">
      <div className="ss-settings-metric__icon">{icon}</div>
      <div>
        <div className="ss-settings-metric__label">{label}</div>
        <strong className="ss-settings-metric__value">{value}</strong>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ss-settings-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [testHints, setTestHints] = useState<Record<number, { ok: boolean; msg: string }>>({});
  const [testingId, setTestingId] = useState<number | null>(null);
  const [orphanResult, setOrphanResult] = useState<{ orphaned: string[]; total: number } | null>(null);
  const [findingOrphans, setFindingOrphans] = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);
  const [providerDraft, setProviderDraft] = useState({
    name: "",
    provider: "openai",
    model: "gpt-4",
    base_url: "https://api.openai.com/v1",
    api_key: "",
  });
  const [searchDraft, setSearchDraft] = useState({
    provider: "ddg",
    base_url: "",
    api_key: "",
    config: { region: "", safesearch: "moderate" } as Record<string, any>,
  });

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
      setProviderDraft({
        name: "",
        provider: "openai",
        model: "gpt-4",
        base_url: "https://api.openai.com/v1",
        api_key: "",
      });
      setKeyVisible(false);
    },
  });

  const upsertSearch = useMutation({
    mutationFn: async () => {
      const searchProvider = (searchProvidersQuery.data ?? [])[0];
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
      setTestHints((prev) => ({
        ...prev,
        [providerId]: { ok: true, msg: t("settings.providers.testOk") || "OK" },
      }));
      setTimeout(() => {
        setTestHints((prev) => {
          const next = { ...prev };
          delete next[providerId];
          return next;
        });
      }, 3000);
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (_err, providerId) => {
      setTestHints((prev) => ({
        ...prev,
        [providerId]: { ok: false, msg: t("settings.providers.testFail") || "Failed" },
      }));
      setTimeout(() => {
        setTestHints((prev) => {
          const next = { ...prev };
          delete next[providerId];
          return next;
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

  const providers = providersQuery.data ?? [];
  const searchProviders = searchProvidersQuery.data ?? [];
  const uploads = filesQuery.data ?? [];
  const searchProvider = searchProviders[0] || null;
  const activeProvider = providers.find((provider) => provider.is_active);

  useEffect(() => {
    if (!searchProvider) return;
    setSearchDraft({
      provider: searchProvider.provider || "ddg",
      base_url: String(searchProvider.base_url || ""),
      api_key: "",
      config: (searchProvider as any).config || {},
    });
  }, [searchProvider]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}${t("settings.files.byte")}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}${t("settings.files.kb")}`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}${t("settings.files.mb")}`;
  };

  const formatDate = (timestamp: number): string => new Date(timestamp * 1000).toLocaleString();

  const tabItems = [
    {
      id: "profile" as const,
      title: t("settings.tabs.profile"),
      hint: "Identity and workspace ownership",
      icon: <UserCircle2 size={15} />,
    },
    {
      id: "security" as const,
      title: t("settings.tabs.security"),
      hint: "Session access and sign-out controls",
      icon: <Shield size={15} />,
    },
    {
      id: "providers_llm" as const,
      title: t("settings.tabs.llmProviders") || t("settings.providers.llmTab"),
      hint: "Language model connections",
      icon: <Bot size={15} />,
    },
    {
      id: "providers_search" as const,
      title: t("settings.tabs.searchProviders") || t("settings.providers.searchTab"),
      hint: "Search and retrieval providers",
      icon: <Search size={15} />,
    },
    {
      id: "files" as const,
      title: t("settings.tabs.files"),
      hint: "Uploads and storage hygiene",
      icon: <FileStack size={15} />,
    },
  ];

  const handleCreateProvider = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createProvider.mutate();
  };

  const renderProfile = () => (
    <div className="ss-settings-section">
      <section className="ss-settings-hero ss-surface-strong">
        <div>
          <div className="kicker">{t("settings.tabs.profile")}</div>
          <h2 className="section-title">{String(user?.full_name ?? user?.username ?? t("brand"))}</h2>
          <p className="panel-subtitle">{t("settings.subtitle")}</p>
        </div>
        <div className="ss-settings-info-grid">
          <InfoRow label={t("settings.profile.email")} value={String(user?.email ?? "—")} />
          <InfoRow label={t("settings.profile.username")} value={String(user?.username ?? "—")} />
          <InfoRow label={t("settings.profile.fullName")} value={String(user?.full_name ?? "—")} />
          <InfoRow label={t("settings.profile.organization")} value={String(user?.organization ?? "—")} />
        </div>
      </section>

      <div className="ss-settings-grid">
        <section className="card">
          <div className="panel-title">{t("settings.tabs.profile")}</div>
          <div className="panel-subtitle">
            Keep your researcher identity consistent across simulations, exports, and shared
            workspace surfaces.
          </div>
          <div className="ss-settings-info-grid">
            <InfoRow label={t("settings.profile.email")} value={String(user?.email ?? "—")} />
            <InfoRow label={t("settings.profile.username")} value={String(user?.username ?? "—")} />
            <InfoRow label={t("settings.profile.fullName")} value={String(user?.full_name ?? "—")} />
            <InfoRow label={t("settings.profile.organization")} value={String(user?.organization ?? "—")} />
          </div>
        </section>

        <section className="card">
          <div className="panel-title">{t("settings.workspaceTitle")}</div>
          <div className="panel-subtitle">{t("settings.workspaceHint")}</div>
          <div className="ss-settings-stack">
            <div className="ss-pill ss-pill--quiet">
              <Shield size={14} />
              <span>Authenticated workspace access</span>
            </div>
            <div className="ss-pill ss-pill--quiet">
              <Database size={14} />
              <span>Profile values are reused across saved simulations</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="ss-settings-grid">
      <section className="card">
        <div className="panel-title">{t("settings.security.sessionsTitle")}</div>
        <div className="panel-subtitle">{t("settings.security.placeholder")}</div>
        <button type="button" className="ss-button-danger" onClick={() => clearSession()}>
          <LogOut size={15} />
          <span>{t("settings.security.signoutAll")}</span>
        </button>
      </section>

      <section className="card">
        <div className="panel-title">{t("settings.security.controlTitle")}</div>
        <div className="panel-subtitle">{t("settings.security.controlHint")}</div>
        <div className="ss-settings-note">
          Authentication flows remain connected to the real SocialSim4 backend and token refresh
          chain.
        </div>
      </section>
    </div>
  );

  const renderProviders = () => (
    <div className="ss-settings-section">
      <div className="ss-settings-grid ss-settings-grid--split">
        <section className="card">
          <div className="panel-header">
            <div>
              <div className="panel-title">{t("settings.providers.title")}</div>
              <div className="panel-subtitle">
                {t("settings.providers.current", { name: activeProvider?.name || "—" })}
              </div>
            </div>
          </div>

          {providersQuery.isLoading ? <div>{t("settings.providers.loading")}</div> : null}
          {providersQuery.error ? <div>{t("settings.providers.error")}</div> : null}

          <div className="ss-provider-list">
            {providers.map((provider) => {
              const active = provider.is_active;
              return (
                <article key={provider.id} className="ss-provider-row ss-inset">
                  <div className="ss-provider-row__meta">
                    <div className="ss-provider-row__title">
                      <strong>{provider.name}</strong>
                      <span className={`ss-status-chip ${active ? "is-active" : ""}`}>
                        {active ? t("settings.providers.activeTag") : provider.provider}
                      </span>
                    </div>
                    <div className="panel-subtitle">
                      {provider.provider} · {provider.model} · {provider.base_url || "-"}
                    </div>
                  </div>

                  <div className="ss-provider-row__actions">
                    {testHints[provider.id] ? (
                      <span className={`ss-provider-row__hint ${testHints[provider.id].ok ? "is-ok" : "is-error"}`}>
                        {testHints[provider.id].msg}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="icon-button square"
                      title={t("settings.providers.test")}
                      aria-label={t("settings.providers.test")}
                      onClick={() => testProvider.mutate(provider.id)}
                      disabled={testingId !== null}
                    >
                      {testingId === provider.id ? <span className="spinner" aria-hidden /> : <Link2Icon />}
                    </button>
                    <button
                      type="button"
                      className="icon-button square"
                      title={active ? t("settings.providers.activeTag") : t("settings.providers.makeActive")}
                      aria-label={active ? t("settings.providers.activeTag") : t("settings.providers.makeActive")}
                      onClick={() => !active && activateProvider.mutate(provider.id)}
                      disabled={active || activateProvider.isPending}
                    >
                      {active ? <StarFilledIcon /> : <StarIcon />}
                    </button>
                    <button
                      type="button"
                      className="icon-button square"
                      title={t("saved.delete")}
                      aria-label={t("saved.delete")}
                      onClick={() => {
                        if (active) {
                          const message =
                            t("settings.providers.deleteActiveConfirm") ||
                            "This provider is active. Delete anyway?";
                          if (!window.confirm(message)) {
                            return;
                          }
                        }
                        deleteProvider.mutate(provider.id);
                      }}
                      disabled={deleteProvider.isPending}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </article>
              );
            })}

            {!providers.length && !providersQuery.isLoading ? (
              <div className="ss-empty-state ss-inset">
                <div className="panel-title">{t("settings.providers.none")}</div>
                <div className="panel-subtitle">
                  Add your first model endpoint to make this workspace operational.
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="card">
          <div className="panel-title">{t("settings.providers.capabilities.title")}</div>
          <div className="panel-subtitle">{t("settings.providers.capabilities.hint")}</div>
          <div className="ss-settings-stack">
            {getCapabilityRows(t).map((row) => (
              <div key={row.model} className="ss-capability-row ss-inset">
                <div className="ss-capability-row__head">
                  <strong>{row.model}</strong>
                  <span className="ss-pill ss-pill--quiet">
                    {t("settings.providers.capabilities.context")}: {row.context}
                  </span>
                </div>
                <div className="panel-subtitle">
                  {t("settings.providers.capabilities.modalities")}: {row.modalities}
                </div>
                <div className="ss-capability-row__metrics">
                  <span>{t("settings.providers.capabilities.input")}: {row.input}</span>
                  <span>{t("settings.providers.capabilities.output")}: {row.output}</span>
                </div>
                <div className="panel-subtitle">
                  {t("settings.providers.capabilities.note")}: {t(row.note)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="ss-settings-grid ss-settings-grid--split">
        <form onSubmit={handleCreateProvider} className="card">
          <div className="panel-title">{t("settings.providers.add")}</div>
          <div className="ss-settings-form-grid">
            <label>
              <span className="ss-form-label">{t("settings.providers.fields.label")}</span>
              <input
                required
                value={providerDraft.name}
                onChange={(event) => setProviderDraft((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <label>
              <span className="ss-form-label">{t("settings.providers.fields.provider")}</span>
              <AppSelect
                value={providerDraft.provider}
                options={[
                  { value: "openai", label: t("settings.providers.type.openai") },
                  { value: "gemini", label: t("settings.providers.type.gemini") },
                ]}
                onChange={(value) =>
                  setProviderDraft((prev) => ({
                    ...prev,
                    provider: value,
                    base_url: value === "openai" ? "https://api.openai.com/v1" : "",
                  }))
                }
              />
            </label>
            <label>
              <span className="ss-form-label">{t("settings.providers.fields.model")}</span>
              <input
                required
                value={providerDraft.model}
                onChange={(event) => setProviderDraft((prev) => ({ ...prev, model: event.target.value }))}
              />
            </label>
            <label>
              <span className="ss-form-label">{t("settings.providers.fields.baseUrl")}</span>
              <input
                required
                value={providerDraft.base_url}
                onChange={(event) => setProviderDraft((prev) => ({ ...prev, base_url: event.target.value }))}
              />
            </label>
            <label className="ss-settings-form-grid__full">
              <span className="ss-form-label">{t("settings.providers.fields.apiKey")}</span>
              <div className="ss-settings-secret-field">
                <input
                  required
                  type={keyVisible ? "text" : "password"}
                  value={providerDraft.api_key}
                  onChange={(event) => setProviderDraft((prev) => ({ ...prev, api_key: event.target.value }))}
                />
                <button
                  type="button"
                  className="icon-button square"
                  title={keyVisible ? t("common.hide") : t("common.show")}
                  aria-label={keyVisible ? t("common.hide") : t("common.show")}
                  onClick={() => setKeyVisible((prev) => !prev)}
                >
                  {keyVisible ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </button>
              </div>
            </label>
          </div>
          {createProvider.error ? (
            <div className="ss-settings-error">{t("settings.providers.createFailed")}</div>
          ) : null}
          <button type="submit" className="ss-button" disabled={createProvider.isPending}>
            {createProvider.isPending ? <span className="spinner" aria-hidden /> : <FilePlusIcon />}
            <span>{t("settings.providers.save")}</span>
          </button>
        </form>

        <section className="card">
          <div className="panel-title">{t("settings.providers.workspaceTitle")}</div>
          <div className="panel-subtitle">{t("settings.providers.workspaceHint")}</div>
          <div className="ss-settings-stack">
            <SettingsMetric
              label="Configured providers"
              value={String(providers.length)}
              icon={<Bot size={16} />}
            />
            <SettingsMetric
              label="Active endpoint"
              value={activeProvider?.name || "—"}
              icon={<WandSparkles size={16} />}
            />
          </div>
        </section>
      </div>
    </div>
  );

  const renderSearchProviders = () => (
    <div className="ss-settings-grid ss-settings-grid--split">
      <section className="card">
        <div className="panel-title">{t("settings.providers.searchTitle")}</div>
        <div className="panel-subtitle">
          Keep retrieval services aligned with the same research workspace and access model.
        </div>
        <div className="ss-settings-info-grid">
          <InfoRow label={t("settings.providers.fields.provider")} value={searchProvider?.provider || "—"} />
          <InfoRow label={t("settings.providers.fields.baseUrl")} value={searchProvider?.base_url || "—"} />
        </div>
      </section>

      <section className="card">
        <div className="panel-title">{t("settings.providers.setSearchProvider")}</div>
        <div className="ss-settings-form-grid">
          <label>
            <span className="ss-form-label">{t("settings.providers.fields.provider")}</span>
            <AppSelect
              value={searchDraft.provider}
              options={[
                { value: "ddg", label: t("settings.providers.searchEngine.ddg") },
                { value: "serpapi", label: t("settings.providers.searchEngine.serpapi") },
                { value: "serper", label: t("settings.providers.searchEngine.serper") },
                { value: "tavily", label: t("settings.providers.searchEngine.tavily") },
                { value: "mock", label: "Mock" },
              ]}
              onChange={(value) => setSearchDraft((prev) => ({ ...prev, provider: value }))}
            />
          </label>

          {(searchDraft.provider === "serpapi" ||
            searchDraft.provider === "serper" ||
            searchDraft.provider === "tavily") && (
            <>
              <label>
                <span className="ss-form-label">{t("settings.providers.fields.baseUrl")}</span>
                <input
                  value={searchDraft.base_url}
                  onChange={(event) =>
                    setSearchDraft((prev) => ({ ...prev, base_url: event.target.value }))
                  }
                />
              </label>
              <label>
                <span className="ss-form-label">{t("settings.providers.fields.apiKey")}</span>
                <input
                  value={searchDraft.api_key}
                  onChange={(event) =>
                    setSearchDraft((prev) => ({ ...prev, api_key: event.target.value }))
                  }
                />
              </label>
            </>
          )}

          {searchDraft.provider === "ddg" && (
            <>
              <label>
                <span className="ss-form-label">{t("settings.providers.search.region")}</span>
                <input
                  value={String((searchDraft.config as any).region || "")}
                  onChange={(event) =>
                    setSearchDraft((prev) => ({
                      ...prev,
                      config: { ...(prev.config || {}), region: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                <span className="ss-form-label">{t("settings.providers.search.safeSearch")}</span>
                <input
                  value={String((searchDraft.config as any).safesearch || "moderate")}
                  onChange={(event) =>
                    setSearchDraft((prev) => ({
                      ...prev,
                      config: { ...(prev.config || {}), safesearch: event.target.value },
                    }))
                  }
                />
              </label>
            </>
          )}

          {searchDraft.provider === "tavily" && (
            <>
              <label>
                <span className="ss-form-label">{t("settings.providers.search.searchDepth")}</span>
                <AppSelect
                  value={String((searchDraft.config as any).search_depth || "basic")}
                  options={[
                    { value: "basic", label: "basic" },
                    { value: "advanced", label: "advanced" },
                  ]}
                  onChange={(value) =>
                    setSearchDraft((prev) => ({
                      ...prev,
                      config: { ...(prev.config || {}), search_depth: value },
                    }))
                  }
                />
              </label>
              <label>
                <span className="ss-form-label">{t("settings.providers.search.topic")}</span>
                <input
                  value={String((searchDraft.config as any).topic || "")}
                  onChange={(event) =>
                    setSearchDraft((prev) => ({
                      ...prev,
                      config: { ...(prev.config || {}), topic: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                <span className="ss-form-label">{t("settings.providers.search.days")}</span>
                <input
                  type="number"
                  min={1}
                  value={Number((searchDraft.config as any).days || 7)}
                  onChange={(event) =>
                    setSearchDraft((prev) => ({
                      ...prev,
                      config: { ...(prev.config || {}), days: Number(event.target.value || 0) },
                    }))
                  }
                />
              </label>
              <label>
                <span className="ss-form-label">{t("settings.providers.search.includeDomains")}</span>
                <input
                  value={String((searchDraft.config as any).include_domains || "")}
                  onChange={(event) =>
                    setSearchDraft((prev) => ({
                      ...prev,
                      config: { ...(prev.config || {}), include_domains: event.target.value },
                    }))
                  }
                />
              </label>
            </>
          )}
        </div>

        <button
          type="button"
          className="ss-button"
          onClick={() => upsertSearch.mutate()}
          disabled={upsertSearch.isPending}
        >
          {upsertSearch.isPending ? <span className="spinner" aria-hidden /> : <FilePlusIcon />}
          <span>{t("settings.providers.save")}</span>
        </button>
      </section>
    </div>
  );

  const renderFiles = () => (
    <div className="ss-settings-section">
      <div className="ss-settings-grid">
        <SettingsMetric label="Files" value={String(uploads.length)} icon={<FileStack size={16} />} />
        <SettingsMetric
          label="Orphan scan"
          value={orphanResult ? String(orphanResult.orphaned.length) : "—"}
          icon={<Database size={16} />}
        />
      </div>

      <section className="card">
        <div className="panel-title">{t("settings.files.title")}</div>
        <div className="panel-subtitle">{t("settings.files.description")}</div>

        {filesQuery.isLoading ? <div>{t("settings.files.loading")}</div> : null}
        {filesQuery.error ? <div>{t("settings.files.error")}</div> : null}

        {uploads.length ? (
          <div className="ss-data-table-wrap">
            <table className="ss-data-table">
              <thead>
                <tr>
                  <th>{t("settings.files.table.filename")}</th>
                  <th>{t("settings.files.table.type")}</th>
                  <th>{t("settings.files.table.size")}</th>
                  <th>{t("settings.files.table.created")}</th>
                  <th>{t("settings.files.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((file) => (
                  <tr key={file.id}>
                    <td title={file.filename}>{file.filename}</td>
                    <td>{file.type || "-"}</td>
                    <td>{formatSize(file.size)}</td>
                    <td>{formatDate(file.created)}</td>
                    <td className="ss-data-table__actions">
                      <button
                        type="button"
                        className="icon-button square"
                        title={t("settings.files.delete")}
                        aria-label={t("settings.files.delete")}
                        onClick={() => {
                          if (window.confirm(t("settings.files.deleteConfirm"))) {
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
        ) : null}

        {!uploads.length && !filesQuery.isLoading ? (
          <div className="ss-empty-state ss-inset">
            <div className="panel-title">{t("settings.files.empty")}</div>
            <div className="panel-subtitle">
              Uploaded research files will appear here once they are attached to simulations.
            </div>
          </div>
        ) : null}
      </section>

      <section className="card">
        <div className="panel-title">{t("settings.files.maintenanceTitle")}</div>
        <div className="panel-subtitle">{t("settings.files.maintenanceHint")}</div>
        <div className="ss-settings-action-row">
          <button
            type="button"
            className="ss-button-secondary"
            onClick={async () => {
              setFindingOrphans(true);
              const result = await findOrphans();
              setOrphanResult(result);
              setFindingOrphans(false);
            }}
            disabled={findingOrphans}
          >
            {findingOrphans ? "…" : t("settings.files.findOrphans")}
          </button>
          <span className="panel-subtitle">
            {orphanResult
              ? orphanResult.orphaned.length > 0
                ? t("settings.files.orphansFound", { count: orphanResult.orphaned.length })
                : t("settings.files.noOrphans")
              : t("settings.files.noOrphans")}
          </span>
        </div>
      </section>
    </div>
  );

  const renderActiveTab = () => {
    if (activeTab === "profile") return renderProfile();
    if (activeTab === "security") return renderSecurity();
    if (activeTab === "providers_llm") return renderProviders();
    if (activeTab === "providers_search") return renderSearchProviders();
    return renderFiles();
  };

  return (
    <div className="ss-product-page ss-product-page--settings scroll-panel">
      <TitleCard title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <section className="ss-settings-overview ss-surface-muted">
        <SettingsMetric
          label={t("settings.tabs.profile")}
          value={String(user?.organization ?? "—")}
          icon={<UserCircle2 size={16} />}
        />
        <SettingsMetric
          label={t("settings.tabs.llmProviders")}
          value={String(providers.length)}
          icon={<Bot size={16} />}
        />
        <SettingsMetric
          label={t("settings.tabs.searchProviders")}
          value={searchProvider?.provider || "—"}
          icon={<Search size={16} />}
        />
        <SettingsMetric
          label={t("settings.tabs.files")}
          value={String(uploads.length)}
          icon={<FileStack size={16} />}
        />
      </section>

      <div className="tab-layout ss-settings-page__layout">
        <nav className="tab-nav ss-settings-page__nav">
          {tabItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tab-button ss-settings-page__tab ${activeTab === item.id ? "active" : ""}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="ss-settings-page__tab-icon">{item.icon}</span>
              <span className="ss-settings-page__tab-copy">
                <strong>{item.title}</strong>
                <span>{item.hint}</span>
              </span>
            </button>
          ))}
        </nav>
        <section className="ss-settings-page__content">{renderActiveTab()}</section>
      </div>
    </div>
  );
}
