import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BrainCircuit,
  Network,
  Orbit,
  PlayCircle,
  Radar,
  Sparkles,
  Users,
} from "lucide-react";

import { useAuthStore } from "../store/auth";

const HOW_IT_WORKS = [
  {
    title: "Frame a world",
    body: "Choose a social setting, define the stakes, and establish the conditions agents will inherit before the first turn.",
    icon: Orbit,
  },
  {
    title: "Shape agency",
    body: "Select action spaces, tune rules, and create agent populations with enough nuance to let alliances and fractures emerge.",
    icon: BrainCircuit,
  },
  {
    title: "Replay the system",
    body: "Inspect branching outcomes, changing ties, and the prompts that produced each move instead of staring at a black-box result.",
    icon: Radar,
  },
];

const GALLERY = [
  {
    name: "Policy cascade",
    tone: "badge",
    description: "Track how interpretation shifts across institutional tiers as a directive travels from top to bottom.",
    tags: ["hierarchy", "sequential rounds", "policy meaning"],
  },
  {
    name: "Public goods lab",
    tone: "badge-green",
    description: "See how reciprocity, free-riding, and local trust change once resources become visible and finite.",
    tags: ["game theory", "resource sharing", "collective action"],
  },
  {
    name: "Rumor network",
    tone: "badge-purple",
    description: "Model how signal quality degrades, clusters polarize, and narratives gain momentum through social edges.",
    tags: ["information diffusion", "network effects", "misalignment"],
  },
];

const VALUE_CARDS = [
  {
    title: "From prompt to provenance",
    body: "Every major decision remains inspectable: scenario state, action set, agent prompt, and network configuration all stay visible.",
  },
  {
    title: "Built for experimental rhythm",
    body: "Create a study, launch it, branch it, and compare outcomes without jumping between unrelated admin pages.",
  },
  {
    title: "Human-readable systems design",
    body: "The interface stays calm and editorial, so complex simulations feel like something you can reason about, not just configure.",
  },
];

export function LandingPage() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <div className="landing-shell">
      <section className="landing-hero">
        <div className="landing-hero__layout">
          <div className="flex flex-col gap-8">
            <div className="page-hero__eyebrow fade-in-up">
              <Sparkles className="h-3.5 w-3.5" />
              Calm tech for social experiments
            </div>

            <div className="fade-in-up" style={{ animationDelay: "80ms" }}>
              <h1 className="text-hero">
                Design worlds where
                <br />
                relationships can change.
              </h1>
              <p className="mt-6 max-w-2xl text-subtitle">
                SocialSim4 turns agent simulation into a composed product workflow:
                pick a scene, shape agency, watch ties evolve, and replay the exact
                decisions that led there.
              </p>
            </div>

            <div className="metric-row fade-in-up" style={{ animationDelay: "140ms" }}>
              <div className="metric-pill">
                <div className="text-[0.8rem] font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
                  Experimental arcs
                </div>
                <div className="mt-2 text-2xl font-bold text-[var(--sim-text-strong)]">
                  6-step studio
                </div>
              </div>
              <div className="metric-pill">
                <div className="text-[0.8rem] font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
                  Relationship lens
                </div>
                <div className="mt-2 text-2xl font-bold text-[var(--sim-text-strong)]">
                  Live networks
                </div>
              </div>
              <div className="metric-pill">
                <div className="text-[0.8rem] font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
                  Replay value
                </div>
                <div className="mt-2 text-2xl font-bold text-[var(--sim-text-strong)]">
                  Prompt provenance
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 fade-in-up" style={{ animationDelay: "220ms" }}>
              <Link to={isAuthenticated ? "/simulations/new" : "/register"} className="button">
                Start an experiment
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to={isAuthenticated ? "/dashboard" : "/login"} className="button-ghost">
                <PlayCircle className="h-4 w-4" />
                Open workspace
              </Link>
            </div>
          </div>

          <div className="landing-stage fade-in-up" style={{ animationDelay: "280ms" }}>
            <div className="landing-stage__grid" />

            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M18 22 C34 18, 44 34, 58 30 S84 24, 86 40" stroke="rgba(74, 123, 208, 0.36)" strokeWidth="0.5" fill="none" />
              <path d="M26 68 C38 52, 60 54, 72 70" stroke="rgba(54, 151, 136, 0.36)" strokeWidth="0.5" fill="none" />
              <path d="M32 32 C42 44, 58 48, 64 64" stroke="rgba(127, 107, 201, 0.28)" strokeWidth="0.5" fill="none" />
            </svg>

            <div className="landing-node breathing-node" style={{ top: "18%", left: "18%", width: 22, height: 22, background: "rgba(51,104,200,0.84)" }} />
            <div className="landing-node breathing-node" style={{ top: "29%", right: "24%", width: 18, height: 18, background: "rgba(45,143,132,0.82)", animationDelay: "0.4s" }} />
            <div className="landing-node breathing-node" style={{ bottom: "22%", left: "30%", width: 16, height: 16, background: "rgba(127,107,201,0.82)", animationDelay: "0.8s" }} />
            <div className="landing-node breathing-node" style={{ bottom: "18%", right: "18%", width: 24, height: 24, background: "rgba(190,136,82,0.82)", animationDelay: "1.1s" }} />

            <div className="landing-stage-card hover-lift" style={{ top: "8%", right: "10%", width: "44%" }}>
              <div className="flex items-center justify-between">
                <span className="badge">Experiment world</span>
                <span className="text-caption">Tick 07</span>
              </div>
              <div className="text-lg font-bold text-[var(--sim-text-strong)]">
                Coalition pressure begins to split the network.
              </div>
              <p className="text-sm leading-6 text-[var(--sim-text-muted)]">
                Three clusters are now reacting to the same policy in different
                ways. One interprets, one amplifies, one resists.
              </p>
            </div>

            <div className="landing-stage-card hover-lift" style={{ left: "10%", bottom: "10%", width: "40%" }}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[rgba(45,143,132,0.12)] text-[var(--sim-teal)]">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--sim-text-strong)]">
                    Live relationship summary
                  </div>
                  <div className="text-caption">4 factions, 2 unstable bridges</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--sim-text-muted)]">
                <Network className="h-4 w-4 text-[var(--sim-primary)]" />
                Edges are no longer evenly distributed.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="story-section">
        <div className="story-section__header">
          <div className="page-hero__eyebrow">How it works</div>
          <h2 className="text-title">A product flow built around experimental rhythm.</h2>
          <p className="text-subtitle">
            The interface is designed to feel like entering an experimental world,
            not filling out a default admin form.
          </p>
        </div>

        <div className="editorial-grid">
          {HOW_IT_WORKS.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="story-card span-4 fade-in-up"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--sim-primary-soft)] text-[var(--sim-primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-[1.18rem] font-bold text-[var(--sim-text-strong)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-[0.98rem] leading-7 text-[var(--sim-text-muted)]">
                  {item.body}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="story-section">
        <div className="story-section__header">
          <div className="page-hero__eyebrow">Scenario gallery</div>
          <h2 className="text-title">Start from a system worth observing.</h2>
          <p className="text-subtitle">
            Each world suggests a different social texture: coordinated cooperation,
            fragile hierarchies, or rumor-driven fragmentation.
          </p>
        </div>

        <div className="scenario-gallery-grid">
          {GALLERY.map((item) => (
            <article key={item.name} className="scenario-card">
              <div className={`badge ${item.tone}`.trim()}>{item.name}</div>
              <p className="mt-6 text-[1rem] leading-7 text-[var(--sim-text-muted)]">
                {item.description}
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span key={tag} className="status-pill">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="story-section">
        <div className="story-section__header">
          <div className="page-hero__eyebrow">Replay value</div>
          <h2 className="text-title">Why this product matters after the run finishes.</h2>
          <p className="text-subtitle">
            Simulations are only useful if you can understand what shifted, why it shifted,
            and how to replay the turning point.
          </p>
        </div>

        <div className="editorial-grid">
          <article className="feature-card span-7">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[rgba(45,143,132,0.12)] text-[var(--sim-teal)]">
                <Radar className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-bold text-[var(--sim-text-strong)]">
                  Read the turning point, not just the final score.
                </div>
                <div className="text-caption">
                  Reopen prompts, inspect action sets, and trace network drift round by round.
                </div>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {VALUE_CARDS.slice(0, 2).map((item) => (
                <div key={item.title} className="studio-field-group">
                  <div className="text-[1rem] font-bold text-[var(--sim-text-strong)]">
                    {item.title}
                  </div>
                  <div className="text-sm leading-7 text-[var(--sim-text-muted)]">
                    {item.body}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="feature-card span-5">
            <div className="page-hero__eyebrow">Story-driven analysis</div>
            <h3 className="mt-5 text-[1.24rem] font-bold text-[var(--sim-text-strong)]">
              Designed for researchers, strategists, and builders who need causal texture.
            </h3>
            <p className="mt-4 text-[0.98rem] leading-7 text-[var(--sim-text-muted)]">
              The product keeps experimental context visible so you can translate emergent
              behavior into interpretable system decisions.
            </p>
            <div className="mt-8 studio-field-group">
              <div className="text-[1rem] font-bold text-[var(--sim-text-strong)]">
                {VALUE_CARDS[2].title}
              </div>
              <div className="text-sm leading-7 text-[var(--sim-text-muted)]">
                {VALUE_CARDS[2].body}
              </div>
            </div>
            <Link
              to={isAuthenticated ? "/simulations/new" : "/register"}
              className="button mt-8 w-fit"
            >
              Create your first world
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}
