# Finance & Portfolio Manager

A full-stack, double-entry accounting and multi-currency portfolio platform I built from scratch to manage real personal finances across Canadian, US, and Hong Kong markets.

> **Note:** This is a showcase repository. The source code is private. This page documents the system's design, features, and the development workflow behind it.

---

## What it does

A single application that combines proper double-entry bookkeeping with live investment tracking, so every dollar — cash, stocks, FX, and income — reconciles to the penny across three currencies.

- **Double-entry journal engine** — balanced Dr/Cr entries, recurring entry templates (with balance guards and optional payee carry-through), transfers, bulk debit-account reassignment across selected entries, and auto-numbering across every creation path.
- **Multi-currency accounting (CAD / USD / HKD)** — penny-exact reconciliation in both native and CAD-accounted terms, with FX rates sourced from the Bank of Canada.
- **Stock portfolio tracking** — average-cost-basis (ACB) engine with position resets at net-zero boundaries, short-selling support (open/cover branches), and per-broker × currency × account-type holding granularity.
- **Brokerage CSV import** — a guided import wizard with fuzzy matching, duplicate detection, a searchable category combobox, and ticker normalization.
- **Smart data entry** — context-aware description autofill, ghost-text typeahead suggestions, and per-category icons for faster visual scanning, to speed up journal entry.
- **Dashboards & insights** — at-a-glance net worth alongside a rolling 30-day net-cashflow summary (income vs. expenses), spending breakdowns, and asset allocation.
- **Technical analysis** — indicators including Chandelier Exit (Wilder/RMA ATR) surfaced on a dashboard.
- **Reconciliation tooling** — Big-4-style audit workpaper outputs and a zero-difference reconciliation standard enforced simultaneously in native and CAD currencies.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript |
| Backend | Node.js + TypeScript |
| Testing | Jest, Vitest |
| Deployment | Render |
| Integrations | Questrade & Futu OAuth, Bank of Canada FX |

---

## Engineering practices

The codebase is held to a strict quality gate. Every commit must pass **five green checks** before it lands:

1. Server TypeScript compile
2. Client TypeScript compile
3. Jest canary suite
4. Client production build
5. Vitest unit suite

Other standing rules: path-scoped commits, separate code and documentation commits, and dedicated session-documentation artifacts (backlog, schedule, project guide).

---

## How it was built — a two-agent AI workflow

This project was developed using a disciplined **planner / executor** workflow with two AI agents:

- A **planner** turns intent into precise, scoped engineering prompts.
- An **executor** implements them commit-by-commit, enforcing the five-green gate before every commit.

This separation kept changes small, reviewable, and reversible, and turned a large solo build into a steady, auditable sprint.

---

## Background

I'm a software developer in Toronto with a background in financial planning and audit methodology. I built this app over many months to solve my own multi-currency, multi-broker bookkeeping problem — and to demonstrate that I can take a complex domain (double-entry accounting + investment tracking) from architecture to a tested, deployed product.

---

## Contact

Jonathan Lu
jonathanlu419@gmail.com

---

*Screenshots and a feature walkthrough coming soon.*
