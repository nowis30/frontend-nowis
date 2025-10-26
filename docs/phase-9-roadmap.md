# Phase 9 – IA Proactive & Notifications

## Objectives
- Deliver proactive monitoring across key financial indicators.
- Notify users of alerts, opportunities, and reminders before issues occur.
- Launch a monthly “coaching fiscal” report powered by internal analytics + AI summarization.

## High-Level Architecture
- **Observation Pipeline**: Scheduled jobs pull valuation, income, tax, and debt data, compute indicators, and publish events.
- **Rules Engine**: Configurable thresholds and heuristics (e.g., debt-to-value > 65%). Maintains severity levels and cooldown windows.
- **Notification Service**: Queues events, deduplicates, routes to delivery channels (in-app, email, SMS, push – start with in-app + email). Tracks delivery/ack status.
- **Coaching Reports**: Monthly generator compiling KPIs, anomalies, recommendations, and TODOs.
- **UX Surfaces**: Notification center, preferences screen, insight widgets on dashboards.

## Workstreams & Tasks

### 1. Data & Observability Foundation
- [ ] Create `monitoring` schema + models: `AlertRule`, `AlertEvent`, `Notification`.
- [ ] Implement scheduled jobs (cron / background worker) for KPI refresh.
- [ ] Add audit logging on alert generation.

### 2. Rules Engine & Alert Catalog
- [ ] Seed initial rules: 
  - Debt-to-asset ratio > 65% (critical).
  - Upcoming debt maturity < 90 days (warning).
  - Cash coverage < 6 months (warning).
  - Tax installment overdue (warning).
  - Refinancing opportunity (info) – triggered on rate differentials.
- [ ] Build rule editor API (CRUD) with validation & cooldown windows.
- [ ] Support per-user overrides / opt-outs.

### 3. Notification Delivery Layer
- [ ] Implement notification queue processor.
- [ ] Build in-app notification center (React + React Query).
- [ ] Email templates + transactional provider integration.
- [ ] Add notification preferences screen.

### 4. Coaching Fiscal Mode
- [ ] Monthly aggregation job (income, taxes, dividends, stress tests).
- [ ] Apply AI summarization (OpenAI / Azure) for recommendations.
- [ ] Generate PDF/HTML report stored in object storage.
- [ ] Surface latest report on dashboard with download/email options.

### 5. UX Enhancements & Onboarding
- [ ] Dashboard “Insights” widget with top alerts/opportunities.
- [ ] Notification center route `/notifications`.
- [ ] Onboarding checklist explaining proactive monitoring.
- [ ] Tooltips / docs referencing how thresholds are computed.

### 6. QA & Compliance
- [ ] Unit tests for rules + notification pipeline.
- [ ] End-to-end tests for alert -> notification flow.
- [ ] Privacy review (data minimization, user consent).
- [ ] Monitoring dashboards (Grafana/Datadog) for alert throughput.

## Dependencies & Risks
- Ensure Phase 8 data endpoints expose the metrics required.
- Background processing infrastructure (BullMQ/Redis or serverless schedulers).
- Legal review on automated advisory wording.

## Milestones
1. **Week 1** – Data foundation & scheduler in place.
2. **Week 2** – Core alert catalog and notification center MVP.
3. **Week 3** – Coaching fiscal report prototype + email delivery.
4. **Week 4** – QA, personalization options, production readiness.

---
Prepared: 26 octobre 2025
