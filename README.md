# Nutradietics

**AI-guided matching between clients and verified nutritionists or fitness trainers — with continuity of care built in.**

Built for the **Build with Kiro 2026** hackathon, entirely through Kiro's spec-driven workflow.

🔗 **Live app:** [nutradietics.vercel.app](https://nutradietics.vercel.app)
📋 **Specs:** [`.kiro/specs/nutradietics/`](./.kiro/specs/nutradietics)
🎥 **Demo video:** *(add link once uploaded)*

---

## What it does

A client describes their goal in plain language. AI classifies whether they need a **nutritionist** or a **fitness trainer**, collects the right health intake for that path, asks 3–5 tailored follow-up questions, and matches them to a specific professional with a written rationale — all before booking a single appointment.

Before the session, the professional sees an AI-organized patient summary instead of starting cold. After the session, **they** write the diagnosis and plan — never AI — and it persists to the client's medical history for the next professional they see, of either type.

> **AI organizes; real professionals decide.** AI drives classification, intake, matching, and summarization throughout the platform — but the actual clinical judgment always stays human.

---

## Screenshots

*(Add a few screenshots or a short GIF here — the intake wizard, the AI match result with rationale, and the patient summary view make the strongest first impression.)*

```
![Homepage](./docs/screenshots/homepage.png)
![AI Match Result](./docs/screenshots/match-result.png)
![Patient Summary](./docs/screenshots/patient-summary.png)
```

---

## Core features

- **AI-powered classification** — plain-language description → nutritionist or fitness trainer
- **Type-adaptive intake** — different standard fields and AI-generated follow-up questions per professional type
- **AI matching with rationale** — filtered by type, active services, and real availability
- **AI patient summaries** — generated before every appointment, visible only to the matched professional
- **Persistent medical history** — intakes, AI summaries, and professional-entered diagnoses carry across future appointments and professionals
- **Conflict-safe booking** — transactional slot booking prevents double-booking
- **Professional profiles** with photos and client reviews/ratings
- **Meeting link + manual payment status** per appointment
- **Resilient AI layer** — schema-validated responses, timeouts, and multi-key rate-limit failover

## Tech stack

- **Framework:** Next.js (TypeScript), single app for frontend + API routes
- **Database:** PostgreSQL via Prisma, hosted on Supabase
- **Auth:** Auth.js (Credentials provider)
- **AI:** Google Gemini API, with schema validation and automatic multi-key failover
- **Storage:** Supabase Storage (professional avatars)
- **Hosting:** Vercel

## Local setup

```bash
git clone https://github.com/Amtul-Aftab/Nutradietics.git
cd nutradietics
npm install
cp .env.example .env   # fill in your own values
npx prisma migrate dev
npm run dev
```

See [`.env.example`](./.env.example) for the full list of required environment variables.

## Built with Kiro

This project was built end-to-end through Kiro's spec-driven workflow: [`requirements.md`](./.kiro/specs/nutradietics/requirements.md) (user stories and acceptance criteria) → [`design.md`](./.kiro/specs/nutradietics/design.md) (architecture and key decisions) → [`tasks.md`](./.kiro/specs/nutradietics/tasks.md) (phased implementation checklist). The core marketplace was built and manually verified before any AI functionality was introduced, and each AI call was implemented and tested independently before being wired into the full client journey.

---

*Build with Kiro 2026 — individual submission.*
