# Graph Report - .  (2026-07-26)

## Corpus Check
- 105 files · ~78,127 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 389 nodes · 649 edges · 39 communities (28 shown, 11 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.8)
- Token cost: 0 input · 147,178 output

## Community Hubs (Navigation)
- Settings & App Shell UI
- Backend Services & Vision AI
- Legacy App.jsx Screens & Nav
- Multi-Home & Economy Migration Docs
- Release Documentation (v1.1.0)
- Feature Modules (Economy/Tasks/Shopping)
- iOS AppDelegate & UIKit
- Build Scripts & Vite Config
- Add Object Wizard & Photos
- Calendar & Google Calendar Sync
- App Dependencies (Capacitor/React)
- Onboarding Slides
- Room/Container Location Helpers
- Home Sharing & Invite Docs
- App State & Persistence Core
- Onboarding Manager & Feature Guide
- Search Engine
- Android Instrumented Test
- Mock Vision Provider
- Android Unit Test
- Gradle Wrapper Script
- Android MainActivity
- Shopping & Zone Modals
- Add Container Wizard
- Add Room Wizard
- Share Home Modal (Roles)
- Vision Proxy Edge Function
- Visual Map Doc Refs
- Play Store Release Prep
- Privacy Policy & Terms
- Service Worker App Shell
- index.html Entry Point

## God Nodes (most connected - your core abstractions)
1. `useTranslation()` - 39 edges
2. `HomeMapApp()` - 12 edges
3. `MEJORAS.md (full feature list)` - 12 edges
4. `supabase` - 11 edges
5. `CAMBIOS_TECNICOS.md (technical changes doc)` - 11 edges
6. `AppDelegate` - 10 edges
7. `scripts` - 10 edges
8. `locationPath()` - 10 edges
9. `INDICE_DOCUMENTACION.md (documentation index)` - 10 edges
10. `README_INICIO.md (getting-started guide)` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Multi-home centralized data model (User -> Houses)` --semantically_similar_to--> `Economy tables RLS policies (multi-casa via home_members)`  [INFERRED] [semantically similar]
  .artifacts/209e7ac1-c313-42b0-953b-e6aa0b5ac103/implementation_plan.artifact.md → src/modules/economy/README.md
- `Data model extension: photo + locationHistory fields` --semantically_similar_to--> `20240725_001_create_economy_tables.sql migration`  [INFERRED] [semantically similar]
  CAMBIOS_TECNICOS.md → src/modules/economy/README.md
- `I18nProvider()` --references--> `react`  [EXTRACTED]
  src/i18n.js → package.json
- `MEJORAS.md (full feature list)` --conceptually_related_to--> `CAMBIOS_TECNICOS.md (technical changes doc)`  [INFERRED]
  MEJORAS.md → CAMBIOS_TECNICOS.md
- `HomeMap v1.1.0 release (search + photos)` --conceptually_related_to--> `searchUtils.js (search scoring engine)`  [INFERRED]
  CHECKLIST_FINAL.md → CAMBIOS_TECNICOS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Multi-Home Auth & Sharing Feature (Plan)** — _artifacts_209e7ac1_c313_42b0_953b_e6aa0b5ac103_implementation_plan_artifact_authview, _artifacts_209e7ac1_c313_42b0_953b_e6aa0b5ac103_implementation_plan_artifact_homeselector, _artifacts_209e7ac1_c313_42b0_953b_e6aa0b5ac103_implementation_plan_artifact_sharehomemodal, _artifacts_209e7ac1_c313_42b0_953b_e6aa0b5ac103_implementation_plan_artifact_demostate [INFERRED 0.85]
- **Search Scoring + Photo Upload v1.1.0 Release** — cambios_tecnicos_searchutils_js, cambios_tecnicos_photoutils_js, cambios_tecnicos_dashboard_component, cambios_tecnicos_objectdetail_component [INFERRED 0.85]
- **Economy Tables Migration Lifecycle (Planned -> Archived -> Replaced)** — src_modules_economy_readme_migration_sql, supabase_migrations__archive_readme_economy_tables_20240725, supabase_migrations__archive_readme_economy_tables_v2 [INFERRED 0.75]

## Communities (39 total, 11 thin omitted)

### Community 0 - "Settings & App Shell UI"
Cohesion: 0.11
Nodes (24): BottomNav(), FitCheckerModal(), Modal(), MoveObjectModal(), PrivacyModal(), Route(), AppHeader(), AboutSection() (+16 more)

### Community 1 - "Backend Services & Vision AI"
Cohesion: 0.10
Nodes (16): ScanSpaceModal(), AuthView(), StepAnalyze(), homeContentService, houseService, detectObjectsClaude(), detectObjectsGemini(), fileToBase64() (+8 more)

### Community 2 - "Legacy App.jsx Screens & Nav"
Cohesion: 0.06
Nodes (15): ANALYSIS_MESSAGES, ANALYSIS_PROGRESS, BOX_COLORS, CATEGORY_ICONS, DEFAULT_CATEGORIES, DEMO_ACTIVITY, DEMO_MEMBERS, NAV (+7 more)

### Community 3 - "Multi-Home & Economy Migration Docs"
Cohesion: 0.07
Nodes (27): App.jsx guard/refactor (planned), AuthView.jsx (planned), demoState.js multi-home refactor (planned), Multi-home centralized data model (User -> Houses), App.jsx currentUser/currentHomeId (task item), AuthView.jsx (task item), useHomeMapState multi-house persistence (task item), AuthView.jsx (walkthrough) (+19 more)

### Community 4 - "Release Documentation (v1.1.0)"
Cohesion: 0.20
Nodes (18): Dashboard '¿Dónde está...?' component (redesigned), CAMBIOS_TECNICOS.md (technical changes doc), searchUtils.js (search scoring engine), HomeMap v1.1.0 release (search + photos), INDICE_DOCUMENTACION.md (documentation index), Project folder structure (src/services/searchUtils.js, photoUtils.js, visionService.js), LEEME_PRIMERO.md (quick-start doc), MAPA_VISUAL.md (visual map doc) (+10 more)

### Community 5 - "Feature Modules (Economy/Tasks/Shopping)"
Cohesion: 0.13
Nodes (13): ModuleCard(), Dashboard(), DashboardOverview(), BillsSection(), EconomyModule(), EconomyOverview(), economyService, MembersModule() (+5 more)

### Community 6 - "iOS AppDelegate & UIKit"
Cohesion: 0.13
Nodes (13): Any, Bool, Capacitor, AppDelegate, NSUserActivity, UIApplication, UIApplicationDelegate, UIKit (+5 more)

### Community 7 - "Build Scripts & Vite Config"
Cohesion: 0.10
Nodes (19): devDependencies, vite, @vitejs/plugin-react, name, private, scripts, android:bundle, android:release (+11 more)

### Community 8 - "Add Object Wizard & Photos"
Cohesion: 0.16
Nodes (12): ObjectDetail(), AddObjectWizard(), CATEGORY_ICONS, StepCategory(), StepDetails(), StepLocation(), StepName(), StepPhoto() (+4 more)

### Community 9 - "Calendar & Google Calendar Sync"
Cohesion: 0.22
Nodes (17): CalendarModule(), formatDayLabel(), toDateKey(), clearStoredToken(), connectGoogleCalendar(), disconnectGoogleCalendar(), ensureGoogleIdentityScript(), getGoogleCalendarFetchScope() (+9 more)

### Community 10 - "App Dependencies (Capacitor/React)"
Cohesion: 0.12
Nodes (17): @capacitor/android, @capacitor/cli, @capacitor/core, @capacitor/ios, lucide-react, dependencies, @capacitor/android, @capacitor/cli (+9 more)

### Community 11 - "Onboarding Slides"
Cohesion: 0.21
Nodes (10): AddObjectSlide(), FinishSlide(), Onboarding(), OrganizationSlide(), roomOptions, SearchSlide(), SharingSlide(), WelcomeSlide() (+2 more)

### Community 12 - "Room/Container Location Helpers"
Cohesion: 0.29
Nodes (11): allContainersFlat(), Cajas(), containerChain(), countObjectsIn(), getContainer(), getRoom(), getZone(), locationPath() (+3 more)

### Community 13 - "Home Sharing & Invite Docs"
Cohesion: 0.22
Nodes (10): HomeSelector.jsx (planned), House invitation code flow (HOME-1234), ShareHomeModal.jsx (planned), HomeSelector.jsx (task item), Invitation code migration for existing houses (task item), Share button integrated in Ajustes (task item), ShareHomeModal.jsx (task item), HomeSelector.jsx (walkthrough) (+2 more)

### Community 14 - "App State & Persistence Core"
Cohesion: 0.33
Nodes (8): buildEmptyState(), getHomesStorageKey(), getHouseStorageKey(), HomeMapApp(), mapSupabaseUser(), normalizeLocation(), sanitizeHomeState(), useHomeMapState()

### Community 15 - "Onboarding Manager & Feature Guide"
Cohesion: 0.38
Nodes (5): FeatureGuide(), getPointerStyle(), DEFAULT_GUIDES, OnboardingManager(), resetOnboardingForUser()

### Community 16 - "Search Engine"
Cohesion: 0.40
Nodes (6): Buscar(), CategoryIcon(), fuzzyMatch(), fuzzyMatchAny(), normalizeText(), searchEverything()

### Community 17 - "Android Instrumented Test"
Cohesion: 0.60
Nodes (3): ExampleInstrumentedTest, Test, RunWith

### Community 18 - "Mock Vision Provider"
Cohesion: 0.60
Nodes (4): detectObjectsMock(), MOCK_CATALOG, randomConfidence(), wait()

### Community 20 - "Gradle Wrapper Script"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 22 - "Shopping & Zone Modals"
Cohesion: 0.67
Nodes (3): AddShoppingModal(), AddZoneModal(), uid()

## Knowledge Gaps
- **77 isolated node(s):** `UIKit`, `Capacitor`, `name`, `private`, `version` (+72 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `I18nProvider()` connect `Settings & App Shell UI` to `Legacy App.jsx Screens & Nav`, `App Dependencies (Capacitor/React)`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `react` connect `App Dependencies (Capacitor/React)` to `Settings & App Shell UI`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `dependencies` connect `App Dependencies (Capacitor/React)` to `Build Scripts & Vite Config`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **What connects `UIKit`, `Capacitor`, `name` to the rest of the system?**
  _77 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Settings & App Shell UI` be split into smaller, more focused modules?**
  _Cohesion score 0.11428571428571428 - nodes in this community are weakly interconnected._
- **Should `Backend Services & Vision AI` be split into smaller, more focused modules?**
  _Cohesion score 0.10084033613445378 - nodes in this community are weakly interconnected._
- **Should `Legacy App.jsx Screens & Nav` be split into smaller, more focused modules?**
  _Cohesion score 0.062388591800356503 - nodes in this community are weakly interconnected._