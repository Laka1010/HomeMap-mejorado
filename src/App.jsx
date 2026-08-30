import { useState, useEffect, useMemo, useCallback, useRef, useId, Fragment, lazy, Suspense, memo } from "react";
import {
  Home, Search, Package, ShoppingCart, Settings, Plus, Camera, MapPin,
  ChevronRight, X, Sun, Moon, Sofa, UtensilsCrossed, BedDouble, Bath,
  Archive, Car, Briefcase, Cable, Watch, Gamepad2, Headphones, Lightbulb,
  Box as BoxIcon, Ruler, Check, AlertTriangle, Upload,
  Sparkles, ArrowLeft, Trash2, Filter, ChevronDown, PenSquare, Boxes,
  ClipboardList, Layers, Link as LinkIcon, Calendar, Tag, StickyNote,
  ScanLine, Grid3x3, ExternalLink, MapPinOff, RotateCcw, Zap, Share2, Eye, EyeOff,
  ShieldCheck, Bell, User, Building2, CheckSquare, TrendingUp, Star
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { I18nProvider, useTranslation } from "./i18n";
import { CurrencyProvider, useCurrency } from "./currency";
import { formatCurrencyValue } from "./utils/currencyUtils";
// Pantallas de ajustes: solo se montan al abrir su modal, así que se cargan
// bajo demanda (mismo componente y props, sin cambio de comportamiento).
const HouseSettingsScreen = lazy(() => import("./components/settings/HouseSettingsScreen").then((m) => ({ default: m.HouseSettingsScreen })));
const AccountHub = lazy(() => import("./components/settings/AccountHub").then((m) => ({ default: m.AccountHub })));
const MemberDetailScreen = lazy(() => import("./components/settings/MemberDetailScreen").then((m) => ({ default: m.MemberDetailScreen })));
const SecurityCenter = lazy(() => import("./modules/security/SecurityCenter").then((m) => ({ default: m.SecurityCenter })));
import { AppHeader } from "./components/AppHeader";
import { NotificationSection } from "./components/settings/NotificationSection";
import { detectObjects } from "./services/visionService";
import { AddObjectWizard } from "./components/AddObjectWizard";
import { AddRoomWizard } from "./components/AddRoomWizard";
import { AddContainerWizard } from "./components/AddContainerWizard";
import { AuthView, ResetPasswordView } from "./components/auth/AuthView";
import { EmptyState } from "./components/EmptyState";
import { HomeSelector } from "./components/home/HomeSelector";
import { ShareHomeModal } from "./components/home/ShareHomeModal";
import { OnboardingManager } from "./components/onboarding/OnboardingManager";
import { WelcomeGate } from "./components/onboarding/WelcomeGate";
import { BrandMark } from "./components/BrandMark";
import { PurchaseCompleteAnimation } from "./modules/shopping/PurchaseCompleteAnimation";
import { DependencyGateModal } from "./components/DependencyGateModal";
import { supabase } from "./supabaseClient";
import { securityEventsService } from "./services/securityEventsService";
import { houseService, MAX_HOMES_PER_USER } from "./services/houseService";
import { homeContentService } from "./services/homeContentService";
import { taskService, DEFAULT_TASK_RETENTION_DAYS } from "./services/taskService";
import { REPEAT_OPTIONS, repeatLabelKey } from "./modules/tasks/taskRepeat";
import { notesService } from "./services/notesService";
import { shoppingService } from "./services/shoppingService";
import { shoppingListsService } from "./services/shoppingListsService";
import { shoppingPurchasesService } from "./services/shoppingPurchasesService";
import { categoriesService } from "./services/categoriesService";
import { activityService } from "./services/activityService";
import { economyService } from "./modules/economy/services/economyService";
import { applyTemplate } from "./modules/homeTemplates/applyTemplate";
import { Dashboard as DashboardModule, DashboardOverview } from "./modules";

// Estas pantallas solo se montan cuando el usuario navega a su pestaña, así
// que se cargan bajo demanda para reducir el bundle inicial (no cambia el
// comportamiento: siguen siendo el mismo componente con las mismas props).
const ShoppingModule = lazy(() => import("./modules/shopping/ShoppingModule").then((m) => ({ default: m.ShoppingModule })));
const ShoppingHistory = lazy(() => import("./modules/shopping/ShoppingHistory").then((m) => ({ default: m.ShoppingHistory })));
const TasksModule = lazy(() => import("./modules/tasks/TasksModule").then((m) => ({ default: m.TasksModule })));
const NotesModule = lazy(() => import("./modules/notes/NotesModule").then((m) => ({ default: m.NotesModule })));
const CalendarModule = lazy(() => import("./modules/calendar/CalendarModule").then((m) => ({ default: m.CalendarModule })));
const EconomyModule = lazy(() => import("./modules/economy/EconomyModule").then((m) => ({ default: m.EconomyModule })));
import { computeFrequentProducts } from "./modules/shopping/frequentProducts";
import { uploadReceiptImage } from "./services/receiptService";
import { useDragToDismiss } from "./hooks/useDragToDismiss";
import { useAuthSession, mapSupabaseUser, USER_STORAGE_KEY } from "./hooks/useAuthSession";
import { useTheme } from "./hooks/useTheme";
import { useTaskRetention } from "./hooks/useTaskRetention";
import { useNotificationsEngine } from "./hooks/useNotificationsEngine";
import { useHomesAndMembers } from "./hooks/useHomesAndMembers";
import { useAppModals } from "./hooks/useAppModals";
import { useHomeNavigation } from "./hooks/useHomeNavigation";
import { NotificationCenter } from "./components/NotificationCenter";
import { buildNotificationActionHandlers } from "./notifications/notificationActions";
import { PRIORITY_LEVELS } from "./modules/shopping/shoppingMeta";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, DEFAULT_CATEGORY, categoryLabel } from "./modules/economy/economyCategories";
import { normalizeText, fuzzyMatch, fuzzyMatchAny } from "./utils/textMatch";
import { toLocalDateString } from "./utils/dates";
import { ActionCenter } from "./components/ActionCenter";
import { GlobalSearchModal } from "./modules/search/GlobalSearchModal";
import { FavoriteStar } from "./components/FavoriteStar";
import { useFocusTrap } from "./hooks/useFocusTrap";
import { useSheetGesture } from "./hooks/useSheetGesture";

/* -------------------------------------------------------------------- */
/* DESIGN TOKENS — "cartographer" palette: routes, pins, paper           */
/* -------------------------------------------------------------------- */
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

    /* Reset */
    html, body { margin: 0; padding: 0; background: #F6F7F5; }
    @media (prefers-color-scheme: dark) { html, body { background: #15171A; } }

    /* Design tokens: spacing scale, radii, shadows, sizes */
    .hm-root {
      /* Spacing scale */
      --space-1: 4px;   /* 4 */
      --space-2: 8px;   /* 8 */
      --space-3: 12px;  /* 12 */
      --space-4: 16px;  /* 16 */
      --space-5: 20px;  /* 20 */
      --space-6: 24px;  /* 24 */
      --space-7: 32px;  /* 32 */
      --space-8: 48px;  /* 48 */

      /* Colors (light) */
      --bg: #F6F7F5;
      --surface: #FFFFFF;
      --surface-alt: #EEF0EC;
      --surface-rgb: 255, 255, 255;
      --ink: #1B1D1F;
      --ink-soft: #676D67;
      --border: #E3E5E0;
      --border-rgb: 227, 229, 224;
      --accent: #5E8C61;
      --accent-ink: #FFFFFF;
      --accent-soft: #E7EEE7;
      --pin: #C98A3E;
      --pin-soft: #F7E8D0;
      --success: #3F7857;
      --success-soft: #DEEAE2;
      --danger: #B3503F;
      --danger-soft: #F4E1DC;

      /* Chart colors (CVD-validated, see /docs or dataviz skill) */
      --chart-income: #2a78d6;
      --chart-expense: #e34948;
      --chart-category: #1baf7a;
      --chart-good: #0ca30c;
      --chart-warning: #fab219;
      --chart-serious: #ec835a;
      --chart-critical: #d03b3b;

      /* Geometry */
      --radius: 12px;           /* unified radius for cards/controls */
      --radius-pill: 999px;
      --btn-height: 44px;      /* unified button height for all primary/secondary */
      --input-height: 44px;    /* unified input height */

      /* Elevation */
      --shadow-elev-1: 0 1px 3px rgba(20,20,15,0.05);
      --shadow-elev-2: 0 10px 28px rgba(10,10,10,0.10);
      --shadow-elev-3: 0 8px 22px rgba(10,10,10,0.16);

      font-family: 'Inter', sans-serif;
      background: var(--bg);
      color: var(--ink);
      min-height: 100svh;
      height: 100svh;
      overflow: hidden;
      transition: background .24s ease, color .24s ease;
    }

    /* Dark theme tokens - mirror the same token names */
    .hm-root.dark {
      --bg: #15171A;
      --surface: #1D2024;
      --surface-alt: #24282D;
      --surface-rgb: 29, 32, 36;
      --ink: #EDEEEC;
      --ink-soft: #9BA1A6;
      --border: #2C3036;
      --border-rgb: 44, 48, 54;
      --accent: #96B498;
      --accent-ink: #10151C;
      --accent-soft: #3B4541;
      --pin: #E8B876;
      --pin-soft: #3A2F1E;
      --success: #6FBF95;
      --success-soft: #22362B;
      --danger: #E08877;
      --danger-soft: #3C2622;

      --chart-income: #3987e5;
      --chart-expense: #e66767;
      --chart-category: #199e70;
    }

    /* Global helpers */
    .hm-root, .hm-root * { box-sizing: border-box; }
    .hm-display { font-family: 'Fraunces', serif; letter-spacing: -0.01em; }
    .hm-mono { font-family: 'IBM Plex Mono', monospace; }
    .hm-row { display: flex; align-items: center; gap: var(--space-3); }

    /* Typography hierarchy */
    .hm-h1 { font-size: 28px; line-height: 36px; font-weight: 700; }
    .hm-h2 { font-size: 20px; line-height: 28px; font-weight: 600; }
    .hm-subtitle { font-size: 16px; line-height: 22px; font-weight: 600; }
    .hm-body { font-size: 14px; line-height: 20px; font-weight: 400; }
    .hm-muted { font-size: 13px; line-height: 18px; color: var(--ink-soft); }
    .hm-caption { font-size: 12px; line-height: 16px; color: var(--ink-soft); }

    /* Cards */
    .hm-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-elev-1);
      min-width: 0;
    }
    .hm-card.flat,
    .hm-card-flat {
      background: var(--surface-alt);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      min-width: 0;
      box-shadow: none;
    }
    /* Card padding helpers */
    .hm-card--p12 { padding: 12px; }
    .hm-card--p14 { padding: 14px; }
    .hm-card--p16 { padding: 16px; }
    .hm-card--p18 { padding: 18px; }
    .hm-card--p20 { padding: 20px; }
    .hm-card--p22 { padding: 22px; }
    .hm-card--p24 { padding: 24px; }
    .hm-card--center { text-align: center; }

    /* Small spacing helpers (used during migration) */
    .hm-mb-14 { margin-bottom: 14px; }
    .hm-pl-0 { padding-left: 0; }

    /* Small icon/button helpers */
    .hm-btn--icon-circle { position: relative; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; border: none; cursor: pointer; }
    .hm-btn--icon-circle::after { content: ""; position: absolute; inset: -8px; }
    .hm-btn--danger { background: var(--danger); color: #fff; border: none; }

    /* Buttons - unified */
    /* Browsers don't inherit color into <button> by default (their UA stylesheet
       sets its own, which on mobile WebKit/WebView often renders system blue).
       Reset it here once instead of setting color on every individual button. */
    .hm-btn, button { position: relative; overflow: hidden; -webkit-tap-highlight-color: transparent; color: inherit; transition: transform .14s cubic-bezier(.22,1,.36,1), opacity .14s ease, background .18s ease, background-color .18s ease, color .18s ease, box-shadow .14s ease, border-color .18s ease; }
    .hm-btn { display: inline-flex; align-items: center; gap: var(--space-2); height: var(--btn-height); min-height: var(--btn-height); padding: 0 var(--space-4); border-radius: var(--radius); font-weight: 600; font-size: 14px; border: 1px solid transparent; cursor: pointer; }
    .hm-btn:active, button:active { transform: scale(0.94); opacity: 0.88; box-shadow: var(--shadow-elev-1); }
    .hm-btn:disabled, button:disabled { opacity: 0.65; cursor: not-allowed; transform: none; box-shadow: none; }
    .hm-btn::after, button::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0; }
    @media (prefers-reduced-motion: reduce) { .hm-btn, button { transition: none !important; } }

    /* Pestaña "Movimientos" de Economía — aro interior sutil cuando está
       seleccionada, para darle más presencia sin cambiar el color de fondo
       ya existente. El feedback al pulsar ya lo cubre la regla global de
       arriba (button:active); esto solo añade el estado seleccionado. */
    .hm-tab-movements--active { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16), var(--shadow-elev-1); }

    /* Primary / secondary / ghost */
    .hm-btn-primary { background: var(--accent); color: var(--accent-ink); }
    .hm-btn-primary:hover { filter: brightness(0.96); }
    .hm-btn-secondary, .hm-btn-soft { background: var(--surface-alt); color: var(--ink); border-color: var(--border); }
    .hm-btn-secondary:hover { background: var(--border); }
    .hm-btn-ghost { background: transparent; color: var(--ink-soft); }
    .hm-btn-ghost:hover { color: var(--ink); }

    /* Button sizing utilities */
    .hm-btn--full { width: 100%; justify-content: center; }
    .hm-btn--icon { padding-left: var(--space-3); padding-right: var(--space-3); width: var(--btn-height); justify-content: center; }

    /* Small utility helpers for migration: spacing, alignment and text colors */
    .hm-mt-20 { margin-top: var(--space-5); }
    .hm-ml-auto { margin-left: auto; }
    .hm-justify-center { justify-content: center; }
    .hm-btn--compact { padding: 8px 10px; }
    .hm-square-54 { width: 54px; height: 54px; min-width: 54px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; }
    .hm-text-danger { color: var(--danger); }

    /* Inputs / forms */
    .hm-input, textarea.hm-input, select.hm-input {
      width: 100%;
      min-height: var(--input-height);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--ink);
      padding: 0 var(--space-4);
      font-size: 14px;
      font-family: 'Inter', sans-serif;
      outline: none;
      transition: border-color .12s ease, box-shadow .12s ease, background .12s ease;
      display: block;
      box-sizing: border-box;
    }
    .hm-input:focus, textarea.hm-input:focus, select.hm-input:focus { border-color: var(--accent); box-shadow: 0 6px 18px rgba(0,0,0,0.04); }
    .hm-input::placeholder, textarea.hm-input::placeholder { color: var(--ink-soft); }
    textarea.hm-input { min-height: calc(var(--input-height) * 2); padding-top: 12px; resize: vertical; }
    .hm-input:disabled, textarea.hm-input:disabled, select.hm-input:disabled { background: var(--surface-alt); cursor: not-allowed; }
    .hm-label { font-size: 12px; font-weight: 600; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: var(--space-2); display: block; }

    /* Sidebar / nav items */
    .hm-sidebar-item { display: flex; align-items: center; gap: var(--space-3); padding: 10px 12px; border-radius: var(--radius); color: var(--ink-soft); font-weight: 500; font-size: 14px; cursor: pointer; transition: background .12s ease, color .12s ease; }
    .hm-sidebar-item:hover { background: var(--surface-alt); color: var(--ink); }
    .hm-sidebar-item.active { color: var(--accent); font-weight: 700; }

    .hm-bottomnav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--ink-soft); font-size: 11px; font-weight: 600; flex: 1; padding: 8px 0; cursor: pointer; transition: color .12s ease, background .12s ease; -webkit-tap-highlight-color: transparent; border-radius: 16px; }
    .hm-bottomnav-item:hover { background: rgba(var(--surface-rgb), 0.95); }
    .hm-bottomnav-item.active { color: var(--accent); }

    /* Route breadcrumb */
    .hm-route { display: flex; align-items: center; flex-wrap: wrap; gap: 0; font-family: 'IBM Plex Mono', monospace; font-size: 13px; }
    .hm-route-node { display: flex; align-items: center; gap: 6px; padding: 5px 10px 5px 8px; background: var(--pin-soft); color: var(--pin); border-radius: var(--radius-pill); font-weight: 500; white-space: nowrap; }
    .hm-route-node--sm { padding: 4px 8px; font-size: 12px; }

    /* Modal title */
    .hm-modal-title { font-size: 20px; font-weight: 600; margin: 0; }

    /* Empty state helpers */
    .hm-empty { text-align: center; padding: var(--space-8) var(--space-3); color: var(--ink-soft); }
    .hm-empty-icon { width: 56px; height: 56px; border-radius: 12px; background: var(--surface-alt); display: flex; align-items: center; justify-content: center; margin: 0 auto var(--space-3); }
    .hm-empty-icon svg { color: var(--accent); }
    .hm-empty-title { font-weight: 600; color: var(--ink); margin: 0 0 4px; }
    .hm-empty-subtitle { font-size: 13.5px; margin: 0 0 var(--space-4); }


    /* Animations: consistent, subtle. fill-mode "backwards" (not "both"): aplica
       el keyframe "from" antes de empezar (sin flash), pero NO retiene el "to"
       después de terminar. "both" retendría para siempre un transform distinto
       de "none" en el elemento — y por CSS, cualquier ancestro con transform
       se convierte en el "containing block" de sus descendientes
       position:fixed, confinando cualquier overlay/modal anidado dentro a la
       caja de ese ancestro en vez de al viewport real (el bug de "el backdrop
       solo cubre parte de la pantalla"). Visualmente idéntico: el estado final
       ya es transform:none/opacity:1 en ambos casos. */
    .hm-fade-in { animation: hmFadeIn .32s cubic-bezier(.22,1,.36,1) backwards; }
    @keyframes hmFadeIn { from { opacity: 0; transform: translateY(-8px) scale(0.995); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .hm-pop { animation: hmPop .18s cubic-bezier(.2,.9,.3,1.2) backwards; }
    @keyframes hmPop { from { opacity:0; transform: scale(.98); } to { opacity:1; transform: scale(1);} }
    @keyframes hmDrawerIn { from { opacity: 0; transform: translateX(18px) scale(0.995); } to { opacity: 1; transform: translateX(0) scale(1); } }
    @keyframes hmSpin { to { transform: rotate(360deg); } }

    /* Iconography: unified sizes, no wandering float */
    .hm-icon { width: 18px; height: 18px; display: inline-block; vertical-align: middle; }
    .hm-sidebar-item svg, .hm-btn svg, .hm-card svg { width: 18px; height: 18px; transform-origin: center; }
    .hm-bottomnav-item svg { width: 26px; height: 26px; transform-origin: center; }

    /* Scrollbars */
    .hm-scroll { -webkit-overflow-scrolling: touch; }
    .hm-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .hm-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }

    /* Tap / elevation */
    @media (hover: hover) { .hm-tap:hover { transform: translateY(-2px); } }
    .hm-tap { transition: transform .18s ease, box-shadow .18s ease; cursor: pointer; }

    /* Modal / drawer */
    .hm-room-name-input { color: var(--ink); outline: none; transition: background .15s ease, border-color .15s ease; }
    @media (hover: hover) { .hm-room-name-input:hover { background: var(--surface-alt) !important; } }
    .hm-room-name-input:focus { background: var(--surface-alt) !important; border-color: var(--accent) !important; }
    .hm-modal-overlay { position: fixed; inset: 0; z-index: 1000; padding: 0; background: rgba(0,0,0,0.36); backdrop-filter: blur(6px); display: flex; align-items: flex-end; justify-content: center; }
    .hm-drawer-overlay { position: fixed; inset: 0; z-index: 1200; display: flex; justify-content: flex-end; align-items: stretch; background: rgba(15,20,25,0.32); backdrop-filter: blur(8px); padding: 0; }
    .hm-drawer { width: min(100%, 920px); height: 100dvh; max-height: 100dvh; background: var(--surface); box-shadow: -24px 0 48px rgba(0,0,0,0.12); overflow-y: auto; overflow-x: hidden; overscroll-behavior-y: contain; animation: hmDrawerIn .28s cubic-bezier(.22,1,.36,1) backwards; }
    .hm-drawer.profile-drawer { width: min(100%, 420px); }

    .hm-modal { width: 100%; max-width: 560px; max-height: 92vh; overflow-y: auto; overscroll-behavior-y: contain; background: var(--surface); border-radius: 28px 28px 0 0; box-shadow: 0 -12px 40px rgba(0,0,0,0.18); overflow-x: hidden; position: relative; animation: hmSheetIn .32s cubic-bezier(.22,1,.36,1) backwards; }
    .hm-modal--wide { max-width: 680px; }
    @keyframes hmSheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .hm-modal-handle-wrap { width: 100%; padding: 16px 0 14px; display: flex; justify-content: center; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
    .hm-modal-handle-wrap:active { cursor: grabbing; }
    .hm-modal-handle { width: 42px; height: 5px; border-radius: 999px; background: var(--border); transition: background .15s; }
    .hm-modal-handle-wrap:active .hm-modal-handle { background: var(--ink-soft); }
    .hm-modal-header { padding: 6px 56px 14px; display: flex; align-items: center; justify-content: center; position: relative; text-align: center; }
    .hm-modal-body { padding: var(--space-2) var(--space-5) calc(var(--space-6) + env(safe-area-inset-bottom)); }
    .hm-modal-close { position: absolute; left: 10px; top: -2px; background: var(--surface-alt); border: none; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ink-soft); font-size: 18px; line-height: 1; -webkit-tap-highlight-color: transparent; }
    @media (prefers-reduced-motion: reduce) { .hm-modal { animation: none !important; } }

    @media (prefers-reduced-motion: reduce) { .hm-fade-in, .hm-pop { animation: none !important; } .hm-tap { transition: none !important; } }

    /* Toasts */
    .hm-toast { position: fixed; right: var(--space-4); bottom: 92px; z-index: 1200; }
    .hm-toast-inner { background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; box-shadow: var(--shadow-elev-1); max-width: 320px; }
    .hm-toast-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--success); display: inline-block; margin-right: 10px; }
    .hm-toast-message { font-size: 13.5px; font-weight: 700; }
    .hm-toast-action { background: none; border: none; color: var(--accent); font-weight: 700; font-size: 12.5px; cursor: pointer; padding: 0 0 0 14px; white-space: nowrap; }

    /* Stat card */
    .hm-stat-chip { padding: 14px 16px; flex: 1 1 120px; min-width: 110px; }
    .hm-stat-value { font-family: 'IBM Plex Mono', monospace; font-size: 26px; font-weight: 600; line-height: 1; }
    .hm-stat-label { font-size: 12.5px; color: var(--ink-soft); margin-top: 6px; font-weight: 500; }

    /* Avatars: unified scale (was drifting per-screen — same "member" avatar
       rendered at slightly different sizes/weights depending on which file
       happened to implement it). Initials by default; an <img> child fills it. */
    .hm-avatar { border-radius: 50%; display: grid; place-items: center; font-weight: 700; flex-shrink: 0; overflow: hidden; background: var(--accent); color: var(--accent-ink); }
    .hm-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .hm-avatar--sm { width: 32px; height: 32px; font-size: 13px; }
    .hm-avatar--md { width: 40px; height: 40px; font-size: 16px; }
    .hm-avatar--lg { width: 64px; height: 64px; font-size: 26px; }
    .hm-avatar--xl { width: 96px; height: 96px; font-size: 32px; }

    /* Badges/pills: unified scale (role labels, status pills) — was drifting
       between 3px/9px and 5px/12px padding for the same kind of small pill. */
    .hm-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; padding: 5px 12px; border-radius: var(--radius-pill); white-space: nowrap; }
    .hm-badge--accent { color: var(--accent); background: var(--accent-soft); }
    .hm-badge--neutral { color: var(--ink-soft); background: var(--surface-alt); font-weight: 600; }
    .hm-badge--success { color: var(--success); background: var(--success-soft); }
    .hm-badge--danger { color: var(--danger); background: var(--danger-soft); }
    .hm-badge--pin { color: var(--pin); background: var(--pin-soft); }

    /* Row icon: the colored circle + icon that leads a list row (movements,
       bills, calendar events, overview rows) — unified at 38px/17px, the size
       already used consistently everywhere except Calendar, which had
       independently drifted to 34px/16px. */
    .hm-row-icon { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; }

    .hm-desktop-sidebar { display: none; }
    .hm-mobile-nav { display: block; }
    @media (min-width: 860px) { .hm-desktop-sidebar { display: block; } .hm-mobile-nav { display: none; } }
  `}</style>
);

/* -------------------------------------------------------------------- */
/* ICON MAPS                                                             */
/* -------------------------------------------------------------------- */
const ROOM_ICONS = {
  salon: Sofa, cocina: UtensilsCrossed, habitacion: BedDouble, bano: Bath,
  trastero: Archive, garaje: Car, oficina: Briefcase,
};
const ROOM_ICON_OPTIONS = [
  { key: "salon", label: "Salón" }, { key: "cocina", label: "Cocina" },
  { key: "habitacion", label: "Habitación" }, { key: "bano", label: "Baño" },
  { key: "trastero", label: "Trastero" }, { key: "garaje", label: "Garaje" },
  { key: "oficina", label: "Oficina" },
];
const CATEGORY_ICONS = {
  "Tecnología": Cable, "Ropa": Tag, "Videojuegos": Gamepad2, "Libros": ClipboardList,
  "Cocina": UtensilsCrossed, "Herramientas": Grid3x3, "Navidad": Lightbulb,
  "Documentos": StickyNote, "Otros": BoxIcon,
};
const DEFAULT_CATEGORIES = ["Comida", "Viajes", "Muebles", "Electrónica", "Regalos"];
const BOX_COLORS = ["#3D5A80", "#C98A3E", "#6B7A5E", "#8E5B72", "#4C7A8B", "#8B6B4C"];
const APP_VERSION = "1.1.0";
const APP_BUILD = "001";

const DEMO_MEMBERS = [
  { id: "member-1", name: "Lucas", role: "Propietario", tasks: 4 },
  { id: "member-2", name: "Ana", role: "Coordinadora", tasks: 2 },
  { id: "member-3", name: "Carlos", role: "Miembro", tasks: 1 },
];

function RoomIcon({ iconKey, size = 20, ...props }) {
  const Cmp = ROOM_ICONS[iconKey] || Home;
  return <Cmp size={size} {...props} />;
}
function CategoryIcon({ category, size = 16, ...props }) {
  const Cmp = CATEGORY_ICONS[category] || BoxIcon;
  return <Cmp size={size} {...props} />;
}

/* -------------------------------------------------------------------- */
/* DEMO DATA                                                             */
/* -------------------------------------------------------------------- */
const uid = () => Math.random().toString(36).slice(2, 10);

function buildEmptyState(t) {
  const translate = t || ((path) => path);
  const activity = [];
  const members = DEMO_MEMBERS.map((member) => ({
    ...member,
    role: member.role === "Propietario" ? translate("demoActivity.ownerRole")
      : member.role === "Coordinadora" ? translate("demoActivity.coordinatorRole")
      : translate("demoActivity.memberRole"),
  }));
  return {
    profile: {
      userName: translate("common.userFallback"),
      lastName: "",
      email: "",
      homeName: "Mi Hogar",
      darkMode: false,
      theme: "system",
      language: "es",
      units: "cm",
    },
    settings: {
      notifications: {
        categories: { organizacion: true, compras: true, finanzas: true, calendario: true, hogar: true },
        level: "all",
      },
      taskRetentionDays: DEFAULT_TASK_RETENTION_DAYS,
    },
    rooms: [],
    zones: [],
    containers: [],
    objects: [],
    shoppingItems: [],
    shoppingLists: [],
    shoppingPurchases: [],
    tasks: [],
    notes: [],
    bills: [],
    activity,
    members,
    categories: DEFAULT_CATEGORIES,
  };
}

/* -------------------------------------------------------------------- */
/* PERSISTENCE & MULTI-HOME                                              */
/* -------------------------------------------------------------------- */
const HOMES_STORAGE_KEY = "homemap-homes-v2";

function getHomesStorageKey(userId) {
  return userId ? `${HOMES_STORAGE_KEY}:${userId}` : HOMES_STORAGE_KEY;
}

function getHouseStorageKey(userId, homeId) {
  if (!homeId) return null;
  return userId ? `homemap-house-${userId}:${homeId}` : `homemap-house-${homeId}`;
}

/**
 * Preferencias personales (no de la casa) que se arrastran al crear una casa
 * nueva: el nombre del usuario, el idioma, el tema, las unidades... Así una
 * casa recién creada hereda lo que ya tienes configurado en tus otras casas
 * en vez de volver a los valores por defecto / al nombre de la cuenta.
 */
const CARRIED_PROFILE_KEYS = ["userName", "lastName", "email", "language", "theme", "darkMode", "units"];

function readCarryOverPreferences(userId, currentHomeId) {
  try {
    const prefix = userId ? `homemap-house-${userId}:` : "homemap-house-";
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      if (key.slice(prefix.length) === String(currentHomeId)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const other = JSON.parse(raw);
      if (other && typeof other === "object" && other.profile) {
        return { profile: other.profile, settings: other.settings };
      }
    }
  } catch (e) {
    // localStorage inaccesible o JSON corrupto: se quedan los valores por defecto.
  }
  return null;
}

function seedPreferencesFromSiblingHouse(baseState, userId, currentHomeId) {
  const carried = readCarryOverPreferences(userId, currentHomeId);
  if (!carried) return baseState;
  const next = { ...baseState };
  if (carried.profile) {
    const picked = {};
    for (const k of CARRIED_PROFILE_KEYS) {
      const v = carried.profile[k];
      if (v !== undefined && v !== "") picked[k] = v;
    }
    next.profile = { ...baseState.profile, ...picked };
  }
  if (carried.settings && typeof carried.settings === "object") {
    next.settings = { ...baseState.settings, ...carried.settings };
  }
  return next;
}

function useHomeMapState(currentHomeId, userId) {
  const { t } = useTranslation();
  const [state, setState] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!currentHomeId || !userId) {
      setState(buildEmptyState(t));
      setLoaded(true);
      return;
    }
    setLoaded(false);
    let cancelled = false;
    (async () => {
      let parsed;
      let hadLocalCache = false;
      try {
        const storageKey = getHouseStorageKey(userId, currentHomeId) || `homemap-house-${currentHomeId}`;
        const raw = localStorage.getItem(storageKey);
        hadLocalCache = !!raw;
        parsed = raw ? JSON.parse(raw) : buildEmptyState(t);
      } catch (e) {
        console.error("Error state loading:", e);
        parsed = buildEmptyState(t);
      }
      if (!hadLocalCache) {
        // Casa recién abierta en este dispositivo (típicamente recién creada):
        // hereda las preferencias personales de otra casa del usuario.
        parsed = seedPreferencesFromSiblingHouse(parsed, userId, currentHomeId);
      }

      try {
        const remote = await homeContentService.fetchHomeContent(currentHomeId);
        if (cancelled) return;
        parsed = { ...parsed, ...remote };
      } catch (e) {
        console.error("Error loading home content from Supabase:", e);
        // Falls back to whatever was cached locally for rooms/zones/containers/objects.
      }

      try {
        const tasks = await taskService.fetchTasks(currentHomeId);
        if (cancelled) return;
        parsed = { ...parsed, tasks };
      } catch (e) {
        console.error("Error loading tasks from Supabase:", e);
        // Falls back to whatever was cached locally for tasks.
      }

      try {
        const notes = await notesService.fetchNotes(currentHomeId);
        if (cancelled) return;
        const localNotes = Array.isArray(parsed.notes) ? parsed.notes : [];
        if (notes.length === 0 && localNotes.length > 0) {
          // First run after adding Supabase sync: seed the server with whatever was only local.
          await Promise.all(localNotes.map((n) => notesService.createNote(currentHomeId, n).catch((e) => console.error("Error seeding note:", e))));
          parsed = { ...parsed, notes: localNotes };
        } else {
          parsed = { ...parsed, notes };
        }
      } catch (e) {
        console.error("Error loading notes from Supabase:", e);
        // Falls back to whatever was cached locally for notes.
      }

      try {
        const shoppingLists = await shoppingListsService.fetchLists(currentHomeId);
        if (cancelled) return;
        parsed = { ...parsed, shoppingLists };
      } catch (e) {
        console.error("Error loading shopping lists from Supabase:", e);
      }

      try {
        const shoppingPurchases = await shoppingPurchasesService.fetchHistory(currentHomeId);
        if (cancelled) return;
        parsed = { ...parsed, shoppingPurchases };
      } catch (e) {
        console.error("Error loading shopping history from Supabase:", e);
      }

      try {
        const shoppingItems = await shoppingService.fetchItems(currentHomeId);
        if (cancelled) return;
        const localShoppingItems = Array.isArray(parsed.shoppingItems) ? parsed.shoppingItems : [];
        if (shoppingItems.length === 0 && localShoppingItems.length > 0) {
          await Promise.all(localShoppingItems.map((i) => shoppingService.createItem(currentHomeId, i).catch((e) => console.error("Error seeding shopping item:", e))));
          parsed = { ...parsed, shoppingItems: localShoppingItems };
        } else {
          parsed = { ...parsed, shoppingItems };
        }
      } catch (e) {
        console.error("Error loading shopping items from Supabase:", e);
        // Falls back to whatever was cached locally for shoppingItems.
      }

      try {
        const categories = await categoriesService.fetchCategories(currentHomeId);
        if (cancelled) return;
        const localCategories = Array.isArray(parsed.categories) ? parsed.categories : [];
        if (categories.length === 0 && localCategories.length > 0) {
          await categoriesService.replaceCategories(currentHomeId, localCategories).catch((e) => console.error("Error seeding categories:", e));
        } else if (categories.length > 0) {
          parsed = { ...parsed, categories };
        }
      } catch (e) {
        console.error("Error loading categories from Supabase:", e);
        // Falls back to whatever was cached locally (or the defaults) for categories.
      }

      try {
        const activity = await activityService.fetchRecent(currentHomeId);
        if (cancelled) return;
        parsed = { ...parsed, activity };
      } catch (e) {
        console.error("Error loading activity from Supabase:", e);
        parsed = { ...parsed, activity: [] };
      }

      if (!cancelled) {
        setState(sanitizeHomeState(parsed));
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [currentHomeId, userId]);

  useEffect(() => {
    if (!loaded || !state || !currentHomeId || !userId) return;
    const t = setTimeout(() => {
      try {
        const storageKey = getHouseStorageKey(userId, currentHomeId);
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(state));
        }
      } catch (e) {}
    }, 250);
    return () => clearTimeout(t);
  }, [state, loaded, currentHomeId, userId]);

  return [state, setState, loaded];
}

/* -------------------------------------------------------------------- */
/* HELPERS                                                               */
/* -------------------------------------------------------------------- */
function getRoom(state, id) { return state.rooms.find((r) => r.id === id); }
function getZone(state, id) { return state.zones.find((z) => z.id === id); }
function getContainer(state, id) { return state.containers.find((c) => c.id === id); }

function containerChain(state, containerId) {
  const chain = [];
  let cur = containerId ? getContainer(state, containerId) : null;
  const guard = new Set();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? getContainer(state, cur.parentId) : null;
  }
  return chain;
}

function locationPath(state, entity) {
  // entity: object or container-like {roomId, zoneId, containerId}
  const path = [];
  const room = entity.roomId ? getRoom(state, entity.roomId) : null;
  if (room) path.push(room.name);
  const zone = entity.zoneId ? getZone(state, entity.zoneId) : null;
  if (zone) path.push(zone.name);
  const chain = containerChain(state, entity.containerId);
  chain.forEach((c) => path.push(c.name));
  return path;
}

function normalizeLocation(state, location = {}) {
  const room = state.rooms.find((r) => r.id === location.roomId);
  const zone = state.zones.find((z) => z.id === location.zoneId);
  const container = state.containers.find((c) => c.id === location.containerId);

  let roomId = room?.id || container?.roomId || zone?.roomId || state.rooms[0]?.id || null;
  let zoneId = null;
  let containerId = null;

  if (zone && zone.roomId === roomId) {
    zoneId = zone.id;
  }

  if (container && container.roomId === roomId) {
    if (!container.zoneId || container.zoneId === zoneId) {
      containerId = container.id;
      if (!zoneId && container.zoneId) {
        zoneId = container.zoneId;
      }
    }
  }

  return { roomId, zoneId, containerId };
}

function sanitizeHomeState(parsed) {
  const base = buildEmptyState();
  const rooms = Array.isArray(parsed.rooms)
    ? parsed.rooms.filter((r) => r && typeof r.id === "string" && r.id.trim())
    : [];

  const roomIds = new Set(rooms.map((r) => r.id));
  const zones = Array.isArray(parsed.zones)
    ? parsed.zones.filter((z) => z && typeof z.id === "string" && z.id.trim() && roomIds.has(z.roomId))
    : [];

  const zoneMap = new Map(zones.map((z) => [z.id, z]));
  const containers = Array.isArray(parsed.containers)
    ? parsed.containers
      .filter((c) => c && typeof c.id === "string" && c.id.trim() && roomIds.has(c.roomId))
      .map((c) => {
        const zoneId = c.zoneId && zoneMap.has(c.zoneId) && zoneMap.get(c.zoneId).roomId === c.roomId ? c.zoneId : null;
        const parentId = c.parentId && c.parentId !== c.id ? c.parentId : null;
        return { ...c, zoneId, parentId };
      })
    : [];

  const containerMap = new Map(containers.map((c) => [c.id, c]));
  const validContainers = containers.map((c) => {
    const parentId = c.parentId && containerMap.has(c.parentId) && containerMap.get(c.parentId).roomId === c.roomId ? c.parentId : null;
    return { ...c, parentId };
  });

  const objects = Array.isArray(parsed.objects)
    ? parsed.objects
      .filter((o) => o && typeof o.id === "string" && o.id.trim())
      .map((o) => {
        const normalized = normalizeLocation({ rooms, zones, containers: validContainers }, o);
        return {
          ...o,
          roomId: normalized.roomId,
          zoneId: normalized.zoneId,
          containerId: normalized.containerId,
          locationHistory: Array.isArray(o.locationHistory)
            ? o.locationHistory.map((entry) => ({
                date: entry?.date || "",
                path: Array.isArray(entry?.path) ? entry.path.filter(Boolean).map(String) : [],
              }))
            : [],
        };
      })
    : [];

  return {
    profile: {
      ...base.profile,
      ...(parsed.profile || {}),
    },
    settings: {
      notifications: {
        categories: {
          organizacion: parsed.settings?.notifications?.categories?.organizacion ?? base.settings.notifications.categories.organizacion,
          compras: parsed.settings?.notifications?.categories?.compras ?? base.settings.notifications.categories.compras,
          finanzas: parsed.settings?.notifications?.categories?.finanzas ?? base.settings.notifications.categories.finanzas,
          calendario: parsed.settings?.notifications?.categories?.calendario ?? base.settings.notifications.categories.calendario,
          hogar: parsed.settings?.notifications?.categories?.hogar ?? base.settings.notifications.categories.hogar,
        },
        level: parsed.settings?.notifications?.level ?? base.settings.notifications.level,
      },
      taskRetentionDays: parsed.settings?.taskRetentionDays ?? base.settings.taskRetentionDays,
    },
    rooms,
    zones,
    containers: validContainers,
    objects,
    shoppingItems: Array.isArray(parsed.shoppingItems) ? parsed.shoppingItems : base.shoppingItems,
    shoppingLists: Array.isArray(parsed.shoppingLists) ? parsed.shoppingLists : base.shoppingLists,
    shoppingPurchases: Array.isArray(parsed.shoppingPurchases) ? parsed.shoppingPurchases : base.shoppingPurchases,
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : base.tasks,
    notes: Array.isArray(parsed.notes) ? parsed.notes : base.notes,
    bills: Array.isArray(parsed.bills) ? parsed.bills : base.bills,
    activity: Array.isArray(parsed.activity) ? parsed.activity : base.activity,
    members: Array.isArray(parsed.members) ? parsed.members : base.members,
    categories: Array.isArray(parsed.categories) ? parsed.categories : base.categories,
  };
}

function countObjectsIn(state, predicate) {
  return state.objects.filter(predicate).length;
}

function roomObjectCount(state, roomId) {
  return countObjectsIn(state, (o) => o.roomId === roomId);
}

function allContainersFlat(state) {
  // returns top-level + nested, each with resolved path
  return state.containers.map((c) => ({ ...c, path: locationPath(state, c) }));
}

function objectCountInContainer(state, containerId) {
  // objects directly in it, plus objects in nested containers
  const nestedIds = new Set([containerId]);
  let changed = true;
  while (changed) {
    changed = false;
    state.containers.forEach((c) => {
      if (c.parentId && nestedIds.has(c.parentId) && !nestedIds.has(c.id)) {
        nestedIds.add(c.id);
        changed = true;
      }
    });
  }
  return state.objects.filter((o) => o.containerId && nestedIds.has(o.containerId)).length;
}

function timeAgo(dateStr) {
  const d = new Date(dateStr).getTime();
  const diff = Math.floor((Date.now() - d) / 86400000);
  if (diff <= 0) return "hoy";
  if (diff === 1) return "ayer";
  if (diff < 7) return `hace ${diff} días`;
  if (diff < 30) return `hace ${Math.floor(diff / 7)} sem`;
  return `hace ${Math.floor(diff / 30)} meses`;
}

/* -------------------------------------------------------------------- */
/* SMALL SHARED UI                                                       */
/* -------------------------------------------------------------------- */
function Route({ path, size = "md" }) {
  const { t } = useTranslation();
  if (!path || path.length === 0) return <span className="hm-mono hm-muted">{t("common.locationNone")}</span>;
  return (
    <div className="hm-route">
      {path.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="hm-route-dots" />}
          <span className={`hm-route-node ${size === "sm" ? "hm-route-node--sm" : ""}`}>
            <MapPin size={size === "sm" ? 11 : 12} />{p}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * `elevated` sube el overlay por encima de los drawers (z-index 1200) y los
 * toasts: lo usa ConfirmDialog para que una confirmación lanzada desde dentro
 * de un drawer (p.ej. "Eliminar casa" en Configuración de la casa) no quede
 * oculta detrás de él.
 */
function Modal({ title, onClose, children, wide, elevated }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  const trapRef = useFocusTrap({ onEscape: onClose });
  const titleId = useId();

  return (
    <div
      className="hm-modal-overlay"
      style={elevated ? { zIndex: 1400 } : undefined}
      onClick={(e) => { if (isSuppressingClick()) return; onClose(e); }}
    >
      <div
        ref={trapRef}
        className={`hm-modal hm-scroll ${wide ? 'hm-modal--wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : t("common.dialogLabel")}
      >
        <div
          ref={handleRef}
          className="hm-modal-handle-wrap"
          onMouseDown={handleMouseDown}
        >
          <div className="hm-modal-handle" />
        </div>
        {title ? (
          <div className="hm-modal-header">
            <button className="hm-modal-close" onClick={onClose} aria-label={t("common.close")}><X size={20} /></button>
            <h3 id={titleId} className="hm-display hm-modal-title">{title}</h3>
          </div>
        ) : (
          <div style={{ height: 8 }} />
        )}
        <div className="hm-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

function MemberPicker({ id, members = [], selected = [] }) {
  const { t } = useTranslation();
  if (!members.length) {
    return <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("membersModule.noOtherMembers")}</div>;
  }
  return (
    <div id={id} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {members.map((m) => {
        const name = m.name || m.email || m.id;
        return (
          <label
            key={m.user_id || m.id || name}
            className="hm-btn hm-btn-soft hm-btn--compact"
            style={{ cursor: "pointer", gap: 6, marginBottom: 0 }}
          >
            <input type="checkbox" value={name} defaultChecked={selected.includes(name)} style={{ margin: 0 }} />
            {name}
          </label>
        );
      })}
    </div>
  );
}

function ToastHost({ notice, onDismiss }) {
  if (!notice) return null;
  const { message, action } = notice;
  return (
    <div className="hm-fade-in hm-toast">
      <div className="hm-toast-inner">
        <div className="hm-row" style={{ justifyContent: "space-between" }}>
          <span className="hm-row">
            <span className="hm-toast-dot" />
            <span className="hm-toast-message">{message}</span>
          </span>
          {action && (
            <button type="button" className="hm-toast-action" onClick={() => { action.onClick(); onDismiss && onDismiss(); }}>
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel, isDangerous, confirmLabel, extraAction }) {
  return (
    <Modal title={title} onClose={onCancel} elevated>
      <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>{message}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {extraAction && (
          <button className="hm-btn hm-btn-soft hm-btn--full" onClick={extraAction.onClick}>
            {extraAction.label}
          </button>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="hm-btn hm-btn-soft hm-btn--full" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className={`hm-btn ${isDangerous ? 'hm-btn--danger' : 'hm-btn-primary'} hm-btn--full`}
            onClick={onConfirm}
          >
            {confirmLabel || "Confirmar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function StatChip({ value, label }) {
  return (
    <div className="hm-card-flat hm-stat-chip">
      <div className="hm-stat-value">{value}</div>
      <div className="hm-stat-label">{label}</div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* ADD / EDIT FORMS (Wizards)                                            */
/* -------------------------------------------------------------------- */

/**
 * `category` sigue en el formulario aunque ya no haya selector: se guarda
 * siempre vacía desde aquí, pero la columna sigue viva y la rellenan otras
 * vías (el escaneo de tickets, y repetir una compra del historial), que son
 * las que alimentan el emoji del icono en la lista.
 */
function AddShoppingModal({ onClose, onSave }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", price: "", category: "", notes: "", priority: "week" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setPrice = (e) => {
    // Allow only digits, comma or dot while typing
    const val = e.target.value || "";
    const clean = val.replace(/[^0-9.,]/g, "");
    setForm((f) => ({ ...f, price: clean }));
  };

  return (
    <Modal title={t("modal.addShoppingTitle")} onClose={onClose}>
      <label className="hm-label">{t("addShopping.name")}</label>
      <input className="hm-input" value={form.name} onChange={set("name")} />

      <label className="hm-label" style={{ marginTop: 14 }}>{t("quickAdd.priorityLabel")}</label>
      <div style={{ display: "flex", gap: 8 }}>
        {PRIORITY_LEVELS.map((p) => (
          <button
            key={p.key}
            type="button"
            className="hm-btn hm-btn-soft"
            style={{ flex: 1, borderColor: form.priority === p.key ? p.color : "var(--border)", color: form.priority === p.key ? p.color : "var(--ink)" }}
            onClick={() => setForm((f) => ({ ...f, priority: p.key }))}
          >
            <p.icon size={14} /> {t(p.labelKey)}
          </button>
        ))}
      </div>

      <label className="hm-label" style={{ marginTop: 14 }}>{t("addShopping.price")}</label>
      <input
        className="hm-input"
        type="number"
        inputMode="decimal"
        step="0.01"
        value={form.price}
        onChange={setPrice}
      />

      <label className="hm-label" style={{ marginTop: 14 }}>{t("addShopping.notes")}</label>
      <textarea className="hm-input" rows={2} value={form.notes} onChange={set("notes")} />

      <button className="hm-btn hm-btn-primary hm-btn--full hm-mt-20"
        disabled={!form.name.trim()}
        onClick={() => {
          const parsedPrice = form.price === "" ? "" : parseFloat(form.price.toString().replace(/,/g, '.'));
          onSave({ id: "s-" + uid(), photo: null, ...form, price: parsedPrice });
          onClose();
        }}>
        <Plus size={16} /> {t("addShopping.addButton")}
      </button>
    </Modal>
  );
}

/**
 * Un solo formulario para registrar ingreso o gasto, con un interruptor
 * para elegir cuál. Reutiliza addExpense/addIncome ya existentes (no
 * duplica la lógica de guardado, solo consolida la UI de alta rápida).
 */
function AddMovementModal({ onClose, onSaveExpense, onSaveIncome }) {
  const { t } = useTranslation();
  const [type, setType] = useState("expense"); // expense | income
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const isExpense = type === "expense";

  const categoryOptions = isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const submit = () => {
    const payload = { name: name.trim(), amount: parseFloat(amount) || 0, category: category || categoryOptions[0] };
    if (isExpense) onSaveExpense(payload);
    else onSaveIncome(payload);
  };

  return (
    <Modal title={t("addMovement.title")} onClose={onClose}>
      <div style={{ display: "flex", background: "var(--surface-alt)", borderRadius: 999, padding: 4, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => { setType("expense"); setCategory(""); }}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 999, border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 14,
            background: isExpense ? "var(--danger)" : "transparent",
            color: isExpense ? "#fff" : "var(--ink-soft)",
            transition: "background .18s ease, color .18s ease",
          }}
        >
          {t("addMovement.expenseToggle")}
        </button>
        <button
          type="button"
          onClick={() => { setType("income"); setCategory(""); }}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 999, border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 14,
            background: !isExpense ? "var(--success)" : "transparent",
            color: !isExpense ? "#fff" : "var(--ink-soft)",
            transition: "background .18s ease, color .18s ease",
          }}
        >
          {t("addMovement.incomeToggle")}
        </button>
      </div>

      <label className="hm-label">{t("addMovement.nameLabel")}</label>
      <input className="hm-input" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="hm-label" style={{ marginTop: 14 }}>{t("addMovement.amountLabel")}</label>
      <input className="hm-input" type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <label className="hm-label" style={{ marginTop: 14 }}>{t("addMovement.categoryLabel")}</label>
      <select className="hm-input" value={category || categoryOptions[0]} onChange={(e) => setCategory(e.target.value)}>
        {categoryOptions.map((c) => <option key={c} value={c}>{categoryLabel(c, t)}</option>)}
      </select>

      <button className="hm-btn hm-btn-primary hm-btn--full hm-mt-20" disabled={!name.trim()} onClick={submit}>
        {isExpense ? t("addMovement.registerExpense") : t("addMovement.registerIncome")}
      </button>
    </Modal>
  );
}

function AddZoneModal({ roomId, onClose, onSave }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🗄️");
  const iconOptions = ["🗄️", "🛏️", "📺", "🧺", "🧰", "📚", "🪑", "🧽"];

  return (
    <Modal title={t("modal.addZoneTitle")} onClose={onClose}>
      <label className="hm-label">{t("addZone.zoneName")}</label>
      <input
        className="hm-input"
        placeholder={t("addZone.zonePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            onSave({ id: "z-" + uid(), roomId, name: name.trim(), icon, photo: null });
            onClose();
          }
        }}
      />

      <label className="hm-label" style={{ marginTop: 14 }}>{t("addZone.iconLabel")}</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {iconOptions.map((option) => (
          <button
            key={option}
            className={"hm-btn hm-btn-soft hm-btn--compact"}
            style={{
              minWidth: 48,
              borderColor: icon === option ? "var(--accent)" : "var(--border)",
            }}
            onClick={() => setIcon(option)}
          >
            <span style={{ fontSize: 18 }}>{option}</span>
          </button>
        ))}
      </div>

      <button
        className="hm-btn hm-btn-primary hm-btn--full hm-mt-20"
        disabled={!name.trim()}
        onClick={() => {
          onSave({ id: "z-" + uid(), roomId, name: name.trim(), icon, photo: null });
          onClose();
        }}
      >
        <Plus size={16} /> {t("addZone.createButton")}
      </button>
    </Modal>
  );
}

function MoveObjectModal({ state, object, onClose, onMove }) {
  const { t } = useTranslation();
  const [roomId, setRoomId] = useState(object.roomId || state.rooms[0]?.id || "");
  const [zoneId, setZoneId] = useState(object.zoneId || "");
  const [containerId, setContainerId] = useState(object.containerId || "");

  const roomOptions = state.rooms;
  const zoneOptions = state.zones.filter((z) => z.roomId === roomId);
  const containerOptions = state.containers.filter((c) => c.roomId === roomId && c.zoneId === zoneId);

  const handleRoomChange = (nextRoomId) => {
    setRoomId(nextRoomId);
    setZoneId("");
    setContainerId("");
  };

  const handleZoneChange = (nextZoneId) => {
    setZoneId(nextZoneId);
    setContainerId("");
  };

  return (
    <Modal title={t("modal.moveObjectTitle")} onClose={onClose}>
      <p style={{ margin: "-8px 0 16px", fontSize: 13.5, color: "var(--ink-soft)" }}>
        {t("moveObject.chooseLocation", { name: object.name })}
      </p>
      <label className="hm-label">{t("moveObject.roomLabel")}</label>
      <select className="hm-input" value={roomId} onChange={(e) => handleRoomChange(e.target.value)}>
        {roomOptions.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
      </select>

      <label className="hm-label" style={{ marginTop: 14 }}>{t("moveObject.zoneLabel")}</label>
      <select className="hm-input" value={zoneId} onChange={(e) => handleZoneChange(e.target.value)}>
        <option value="">{t("moveObject.noZone")}</option>
        {zoneOptions.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
      </select>

      <label className="hm-label" style={{ marginTop: 14 }}>{t("moveObject.boxLabel")}</label>
      <select className="hm-input" value={containerId} onChange={(e) => setContainerId(e.target.value)}>
        <option value="">{t("moveObject.noContainer")}</option>
        {containerOptions.map((container) => <option key={container.id} value={container.id}>{container.name}</option>)}
      </select>

      <button className="hm-btn hm-btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 20 }} onClick={() => {
        onMove(object.id, {
          roomId,
          zoneId: zoneId || null,
          containerId: containerId || null,
        });
        onClose();
      }}>
        <MapPin size={16} /> {t("moveObject.saveLocation")}
      </button>
    </Modal>
  );
}

/* -------------------------------------------------------------------- */
/* ¿CABE? — fit checker                                                  */
/* -------------------------------------------------------------------- */
function FitCheckerModal({ onClose, presetItem }) {
  const { t } = useTranslation();
  const [space, setSpace] = useState({ width: "145", height: "80", depth: "60" });
  const [item, setItem] = useState({ width: presetItem?.width || "", height: presetItem?.height || "", depth: presetItem?.depth || "" });
  const result = useMemo(() => {
    const sw = parseFloat(space.width), sh = parseFloat(space.height), sd = parseFloat(space.depth);
    const iw = parseFloat(item.width), ih = parseFloat(item.height), id = parseFloat(item.depth);
    if ([sw, iw].some((n) => isNaN(n))) return null;
    const widthOk = isNaN(iw) || iw <= sw;
    const heightOk = isNaN(ih) || isNaN(sh) || ih <= sh;
    const depthOk = isNaN(id) || isNaN(sd) || id <= sd;
    return widthOk && heightOk && depthOk;
  }, [space, item]);

  return (
    <Modal title={t("modal.fitCheckerTitle")} onClose={onClose}>
      <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: -8, marginBottom: 16 }}>
        {t("fitChecker.prompt")}
      </p>
      <label className="hm-label">{t("fitChecker.availableSpace")}</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <input className="hm-input" placeholder={t("fitChecker.widthPlaceholder")} value={space.width} onChange={(e) => setSpace({ ...space, width: e.target.value })} />
        <input className="hm-input" placeholder={t("fitChecker.heightPlaceholder")} value={space.height} onChange={(e) => setSpace({ ...space, height: e.target.value })} />
        <input className="hm-input" placeholder={t("fitChecker.depthPlaceholder")} value={space.depth} onChange={(e) => setSpace({ ...space, depth: e.target.value })} />
      </div>
      <label className="hm-label" style={{ marginTop: 16 }}>{t("fitChecker.item")}</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <input className="hm-input" placeholder={t("fitChecker.widthPlaceholder")} value={item.width} onChange={(e) => setItem({ ...item, width: e.target.value })} />
        <input className="hm-input" placeholder={t("fitChecker.heightPlaceholder")} value={item.height} onChange={(e) => setItem({ ...item, height: e.target.value })} />
        <input className="hm-input" placeholder={t("fitChecker.depthPlaceholder")} value={item.depth} onChange={(e) => setItem({ ...item, depth: e.target.value })} />
      </div>
      {result !== null && (
        <div className="hm-fade-in" style={{
          marginTop: 20, padding: "16px", borderRadius: 14, display: "flex", alignItems: "center", gap: 10,
          background: result ? "var(--success-soft)" : "var(--danger-soft)", color: result ? "var(--success)" : "var(--danger)", fontWeight: 700,
        }}>
          {result ? <Check size={20} /> : <AlertTriangle size={20} />}
          {result ? t("fitChecker.fitYes") : t("fitChecker.fitNo")}
        </div>
      )}
      <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 14 }}>
        {t("fitChecker.comingSoon")}
      </p>
    </Modal>
  );
}

/* -------------------------------------------------------------------- */
/* SCAN SPACE — real AI vision flow (services/visionService.js)         */
/* -------------------------------------------------------------------- */
const ANALYSIS_MESSAGES = {
  uploading: "Analizando imagen…",
  analyzing: "Reconociendo objetos…",
  classifying: "Clasificando categorías…",
};
const ANALYSIS_PROGRESS = { uploading: 30, analyzing: 68, classifying: 92 };
/**
 * Pasos que emite visionService/claudeVision -> clave i18n. Se mapea con esta
 * tabla explícita en vez de concatenar `"scan." + paso`: `t()` devuelve la
 * propia clave cuando no la encuentra, y esa cadena es truthy, así que el
 * `|| t("scan.analyzing")` que había como red de seguridad nunca llegaba a
 * ejecutarse — el paso "uploading" (el inicial, y el único sin traducción)
 * se le enseñaba al usuario como el literal "scan.uploading".
 */
const SCAN_STEP_KEYS = {
  uploading: "scan.uploading",
  analyzing: "scan.analyzing",
  recognizing: "scan.recognizing",
  classifying: "scan.classifying",
};

function ScanSpaceModal({ onClose, onImport, state }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("object");
  const [stage, setStage] = useState("modePicker");
  const [analysisStep, setAnalysisStep] = useState("uploading");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [detections, setDetections] = useState([]);
  const [selected, setSelected] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [singleName, setSingleName] = useState("");
  const [singleDetection, setSingleDetection] = useState(null);
  const [isEditingSingleName, setIsEditingSingleName] = useState(false);
  const [locationDraft, setLocationDraft] = useState({ roomId: state.rooms[0]?.id || "", zoneId: "", containerId: "" });
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);

  const roomOptions = state.rooms;
  const zoneOptions = state.zones.filter((z) => z.roomId === locationDraft.roomId);
  const containerOptions = state.containers.filter((c) => c.roomId === locationDraft.roomId && c.zoneId === locationDraft.zoneId);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectMode = (nextMode) => {
    setMode(nextMode);
    setStage("upload");
    setErrorMsg("");
  };

  const resetSelection = () => {
    setDetections([]);
    setSelected([]);
    setSingleDetection(null);
    setSingleName("");
    setIsEditingSingleName(false);
  };

  const handleFileChosen = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setStage("analyzing");
    setAnalysisStep("uploading");
    setErrorMsg("");
    resetSelection();

    detectObjects(file, { onProgress: setAnalysisStep })
      .then((results) => {
        setDetections(results);
        if (mode === "object") {
          const best = results[0] || null;
          setSingleDetection(best);
          setSingleName(best?.name || "");
          setStage(best ? "identify" : "error");
        } else {
          setSelected(results.map((_, i) => i));
          setStage(results.length > 0 ? "results" : "error");
        }
      })
      .catch((err) => {
        setErrorMsg(err?.message || t("scanSpace.analyzeError"));
        setStage("error");
      });
  };

  const toggle = (idx) => setSelected((s) => (s.includes(idx) ? s.filter((i) => i !== idx) : [...s, idx]));

  const confirmSpaceImport = () => {
    const chosen = detections.filter((_, i) => selected.includes(i)).map((d) => ({
      ...d,
      roomId: locationDraft.roomId || state.rooms[0]?.id || null,
      zoneId: locationDraft.zoneId || null,
      containerId: locationDraft.containerId || null,
    }));
    onImport(chosen);
    onClose();
  };

  const confirmObjectImport = () => {
    const payload = {
      ...singleDetection,
      name: singleName.trim() || singleDetection?.name || "Objeto detectado",
      category: singleDetection?.category || "Otros",
      roomId: locationDraft.roomId || state.rooms[0]?.id || null,
      zoneId: locationDraft.zoneId || null,
      containerId: locationDraft.containerId || null,
    };
    onImport([payload]);
    onClose();
  };

  const locationSummary = () => {
    const room = state.rooms.find((r) => r.id === locationDraft.roomId);
    const zone = state.zones.find((z) => z.id === locationDraft.zoneId);
    const container = state.containers.find((c) => c.id === locationDraft.containerId);
    return [room?.name, zone?.name, container?.name].filter(Boolean).join(" → ");
  };

  const handleRoomChange = (nextRoomId) => {
    setLocationDraft({ roomId: nextRoomId, zoneId: "", containerId: "" });
  };

  const handleZoneChange = (nextZoneId) => {
    setLocationDraft((prev) => ({ ...prev, zoneId: nextZoneId, containerId: "" }));
  };

  return (
    <Modal title={mode === "object" ? t("modal.scanObjectTitle") : t("modal.scanSpaceTitle")} onClose={onClose}>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFileChosen} />
      <input ref={uploadRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChosen} />

      {stage === "modePicker" && (
        <div className="hm-fade-in" style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: "-6px 0 2px", fontSize: 13.5, color: "var(--ink-soft)" }}>
            Elige el tipo de escaneo que quieres hacer.
          </p>
          <button className="hm-tap" onClick={() => selectMode("object")}
            style={{ display: "grid", gap: 10, textAlign: "left", border: "1px solid var(--border)", borderRadius: 18, padding: 16, background: "var(--surface-alt)", cursor: "pointer", color: "var(--ink)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
                <Camera size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{t("scanSpace.objectModeTitle")}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("scanSpace.objectModeSubtitle")}</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("scanSpace.objectModeHint")}</div>
          </button>
          <button className="hm-tap" onClick={() => selectMode("space")}
            style={{ display: "grid", gap: 10, textAlign: "left", border: "1px solid var(--border)", borderRadius: 18, padding: 16, background: "var(--surface-alt)", cursor: "pointer", color: "var(--ink)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
                <Search size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{t("scanSpace.spaceModeTitle")}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("scanSpace.spaceModeSubtitle")}</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("scanSpace.spaceModeHint")}</div>
          </button>
        </div>
      )}

      {stage === "upload" && (
        <div className="hm-fade-in">
          <div className="hm-card-flat" style={{ padding: 14, marginBottom: 16, display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{mode === "object" ? t("scanSpace.objectModeTitle") : t("scanSpace.spaceModeTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              {mode === "object" ? t("scanSpace.objectModePrompt") : t("scanSpace.spaceModePrompt")}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button onClick={() => cameraRef.current?.click()} className="hm-tap"
              style={{ border: "2px dashed var(--border)", borderRadius: 16, padding: "26px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "var(--surface-alt)", cursor: "pointer", color: "var(--ink)" }}>
              <Camera size={24} style={{ color: "var(--accent)" }} />
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{t("scanSpace.cameraButton")}</span>
            </button>
            <button onClick={() => uploadRef.current?.click()} className="hm-tap"
              style={{ border: "2px dashed var(--border)", borderRadius: 16, padding: "26px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "var(--surface-alt)", cursor: "pointer", color: "var(--ink)" }}>
              <Upload size={24} style={{ color: "var(--accent)" }} />
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{t("scanSpace.uploadButton")}</span>
            </button>
          </div>
          <span style={{ fontSize: 12, color: "var(--ink-soft)", display: "block", marginTop: 12, textAlign: "center" }}>{t("scanSpace.imageFormatHint")}</span>
        </div>
      )}

      {stage === "analyzing" && (
        <div className="hm-fade-in" style={{ padding: "8px 0" }}>
          {previewUrl && (
            <div style={{ width: "100%", height: 170, borderRadius: 14, overflow: "hidden", marginBottom: 18, background: "var(--surface-alt)" }}>
              <img src={previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }} />
            </div>
          )}
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 44, height: 44, margin: "0 auto 16px", borderRadius: "50%", border: "3px solid var(--accent-soft)", borderTopColor: "var(--accent)", animation: "hmSpin 0.9s linear infinite" }} />
            <p style={{ fontWeight: 700, margin: "0 0 4px" }}>{t(SCAN_STEP_KEYS[analysisStep] || "scan.analyzing")}</p>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>{t("scanSpace.aiStatus")}</p>
          </div>
          <div style={{ marginTop: 22, height: 8, borderRadius: 999, background: "var(--surface-alt)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 999, background: "var(--accent)", width: `${ANALYSIS_PROGRESS[analysisStep] || 15}%`, transition: "width .5s ease" }} />
          </div>
        </div>
      )}

      {stage === "identify" && singleDetection && (
        <div className="hm-fade-in" style={{ display: "grid", gap: 14 }}>
          {previewUrl && (
            <div style={{ width: "100%", height: 170, borderRadius: 14, overflow: "hidden", background: "var(--surface-alt)" }}>
              <img src={previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}
          <div className="hm-card-flat" style={{ padding: 16, display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t("scanSpace.objectIdentificationTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("scanSpace.objectIdentificationSubtitle")}</div>
            {isEditingSingleName ? (
              <div style={{ display: "grid", gap: 10 }}>
                <label className="hm-label" style={{ marginBottom: -2 }}>{t("scanSpace.objectNameLabel")}</label>
                <input className="hm-input" value={singleName} onChange={(e) => setSingleName(e.target.value)} placeholder={t("scanSpace.objectNamePlaceholder")} />
                <button className="hm-btn hm-btn-primary hm-justify-center" onClick={() => { setIsEditingSingleName(false); }}>
                  {t("common.save")}
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("scanSpace.identifiedLabel")}</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: "var(--ink)" }}>{singleName}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="hm-btn hm-btn-primary" onClick={() => setStage("location")}><Check size={15} /> {t("common.save")}</button>
                  <button className="hm-btn hm-btn-soft" onClick={() => { setIsEditingSingleName(true); }}><PenSquare size={15} /> {t("scanSpace.correctName")}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {stage === "location" && (
        <div className="hm-fade-in" style={{ display: "grid", gap: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{mode === "object" ? t("scanSpace.objectLocationTitle") : t("scanSpace.spaceLocationTitle")}</div>
          <p style={{ margin: "-8px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>
            {mode === "object" ? t("scanSpace.objectLocationSubtitle") : t("scanSpace.spaceLocationSubtitle")}
          </p>

          <label className="hm-label">{t("moveObject.roomLabel")}</label>
          <select className="hm-input" value={locationDraft.roomId} onChange={(e) => handleRoomChange(e.target.value)}>
            {roomOptions.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>

          <label className="hm-label">{t("moveObject.zoneLabel")}</label>
          <select className="hm-input" value={locationDraft.zoneId} onChange={(e) => handleZoneChange(e.target.value)}>
            <option value="">{t("moveObject.noZone")}</option>
            {zoneOptions.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
          </select>

          <label className="hm-label">{t("moveObject.boxLabel")}</label>
          <select className="hm-input" value={locationDraft.containerId} onChange={(e) => setLocationDraft((prev) => ({ ...prev, containerId: e.target.value }))}>
            <option value="">{t("moveObject.noContainer")}</option>
            {containerOptions.map((container) => <option key={container.id} value={container.id}>{container.name}</option>)}
          </select>

          <div className="hm-card-flat" style={{ padding: 12, display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("moveObject.routeLabel")}</div>
            <div style={{ fontSize: 13, color: "var(--ink)" }}>{locationSummary() || t("scanSpace.locationPlaceholder")}</div>
          </div>

          <button className="hm-btn hm-btn-primary hm-btn--full" onClick={() => setStage("preview")}>
            <MapPin size={16} /> {t("scanSpace.continueLocation")}
          </button>
        </div>
      )}

      {stage === "preview" && (
        <div className="hm-fade-in" style={{ display: "grid", gap: 14 }}>
          {previewUrl && (
            <div style={{ width: "100%", height: 170, borderRadius: 14, overflow: "hidden", background: "var(--surface-alt)" }}>
              <img src={previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}
          <div className="hm-card-flat" style={{ padding: 16, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{mode === "object" ? t("scanSpace.previewObjectTitle") : t("scanSpace.previewSpaceTitle")}</div>
            <div style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>{locationSummary() || t("scanSpace.locationPlaceholder")}</div>
            {mode === "object" ? (
              <div style={{ fontWeight: 700, fontSize: 16 }}>{singleName}</div>
            ) : (
              <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.length} {t("scanSpace.objectsSelectedLabel")}</div>
            )}
          </div>
          <button className="hm-btn hm-btn-primary hm-btn--full" onClick={mode === "object" ? confirmObjectImport : confirmSpaceImport}>
            <Sparkles size={16} /> {mode === "object" ? t("scanSpace.saveObject") : t("scanSpace.saveSelected", { count: selected.length || 0 })}
          </button>
        </div>
      )}

      {stage === "results" && (
        <div className="hm-fade-in">
          <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: -8, marginBottom: 14 }}>
            {t("scanSpace.detectedCount", { count: detections.length })}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
            {detections.map((d, i) => {
              const isSelected = selected.includes(i);
              const confidencePct = Math.round(d.confidence * 100);
              return (
                <button key={i} onClick={() => toggle(i)} className="hm-tap" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)", background: isSelected ? "var(--success-soft)" : "var(--surface-alt)", color: "var(--ink)", textAlign: "left" }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, border: "1.5px solid " + (isSelected ? "var(--success)" : "var(--border)"), background: isSelected ? "var(--success)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isSelected && <Check size={14} color="var(--surface)" />}
                  </span>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <CategoryIcon category={d.category} size={16} style={{ color: "var(--accent)" }} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{d.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{d.category}</div>
                  </span>
                  <span className="hm-mono" style={{ fontSize: 11, color: "var(--ink-soft)", flexShrink: 0 }}>{confidencePct}%</span>
                </button>
              );
            })}
          </div>
          <button className="hm-btn hm-btn-primary hm-btn--full" disabled={selected.length === 0} onClick={() => setStage("location")}>
            <MapPin size={16} /> {t("scanSpace.continueLocation")}
          </button>
        </div>
      )}

      {stage === "error" && (
        <div className="hm-fade-in">
          <div style={{ padding: 16, borderRadius: 14, background: "var(--danger-soft)", color: "var(--danger)", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13.5 }}>{errorMsg}</span>
          </div>
          <button className="hm-btn hm-btn-soft" style={{ width: "100%", justifyContent: "center" }} onClick={() => setStage("modePicker")}>
            {t("scanSpace.tryAgain")}
          </button>
        </div>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------------- */
/* OBJECT DETAIL                                                        */
/* -------------------------------------------------------------------- */
function ObjectDetail({ state, objectId, onBack, onDelete, dispatch, onMove, onUpdateObject }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const obj = state.objects.find((o) => o.id === objectId);
  const [moveOpen, setMoveOpen] = useState(false);

  if (!obj) return null;

  const path = locationPath(state, obj);

  return (
    <div className="hm-fade-in">
      <button className="hm-btn hm-btn-ghost hm-mb-14 hm-pl-0" onClick={onBack}>
        <ArrowLeft size={16} /> {t("objectDetail.back")}
      </button>

      <div className="hm-card hm-card--p22">
        {/* Object info */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CategoryIcon category={obj.category} size={28} style={{ color: "var(--accent)" }} />
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <h2 className="hm-display" style={{ fontSize: 24, margin: "0 0 6px", fontWeight: 600 }}>{obj.name}</h2>
            <span className="hm-card-flat" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", fontSize: 12.5, fontWeight: 600, color: "var(--accent)" }}>
              <CategoryIcon category={obj.category} size={12} />{obj.category}
            </span>
          </div>
          <button className="hm-btn hm-btn-ghost hm-text-danger" onClick={() => onDelete(obj.id)}>
            <Trash2 size={16} /> {t("objectDetail.delete")}
          </button>
        </div>
 
        {/* Location section */}
        <div style={{ marginTop: 18 }}>
          <label className="hm-label">📍 {t("common.locationTitle")}</label>
          <Route path={path} />
          <button className="hm-btn hm-btn-soft" style={{ marginTop: 12 }} onClick={() => setMoveOpen(true)}>
            <Zap size={14} /> {t("common.changeLocation")}
          </button>
        </div>
 
        {obj.description && (
          <div style={{ marginTop: 18 }}>
            <label className="hm-label">{t("objectDetail.descriptionLabel")}</label>
            <p style={{ margin: 0, fontSize: 14.5 }}>{obj.description}</p>
          </div>
        )}
 
        {obj.notes && (
          <div style={{ marginTop: 18 }}>
            <label className="hm-label">{t("objectDetail.notesLabel")}</label>
            <p style={{ margin: 0, fontSize: 14.5 }}>{obj.notes}</p>
          </div>
        )}
        
        <div style={{ display: "flex", gap: 28, marginTop: 18, flexWrap: "wrap" }}>
          {obj.purchaseDate && (
            <div>
              <label className="hm-label">{t("objectDetail.purchaseDate")}</label>
              <span style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><Calendar size={14} />{obj.purchaseDate}</span>
            </div>
          )}
          {obj.price && (
            <div>
              <label className="hm-label">{t("objectDetail.price")}</label>
              <span style={{ fontSize: 14 }}>{formatCurrency(obj.price)}</span>
            </div>
          )}
        </div>
           
        {/* Location history */}
        {obj.locationHistory && obj.locationHistory.length > 0 && (
          <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
            <label className="hm-label">📜 {t("objectDetail.locationHistory")}</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {obj.locationHistory.map((entry, idx) => (
                <div key={idx} style={{ padding: 12, background: "var(--surface-alt)", borderRadius: 10, fontSize: 13 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{entry.date}</div>
                  <div style={{ color: "var(--ink-soft)" }}>{entry.path.join(" → ") || t("objectDetail.noLocationHistory")}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {moveOpen && <MoveObjectModal state={state} object={obj} onClose={() => setMoveOpen(false)} onMove={onMove} />}
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* DASHBOARD                                                             */
/* -------------------------------------------------------------------- */
function Dashboard({ state, goTo, openModal, canSeeEconomy, currentHome, houseMembers, notifications }) {
  return (
    <DashboardModule
      state={state}
      goTo={goTo}
      openModal={openModal}
      canSeeEconomy={canSeeEconomy}
      currentHome={currentHome}
      houseMembers={houseMembers}
      notifications={notifications}
    />
  );
}

/* -------------------------------------------------------------------- */
/* MI CASA                                                               */
/* -------------------------------------------------------------------- */
function MiCasa({ state, dispatch, view, setView, openModal, goTo, onUpdateObject, onUpdateCategories, onUpdateRoom, onDeleteRoom }) {
  const { t } = useTranslation();
  const room = view.roomId ? getRoom(state, view.roomId) : null;
  const zone = view.zoneId ? getZone(state, view.zoneId) : null;
  const [activeSection, setActiveSection] = useState("rooms"); // 'rooms' | 'favorites' | 'categories'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const showFavoritesOnly = activeSection === "favorites";
  const showCategoryFilter = activeSection === "categories";
  const toggleObjectFavorite = (o) => onUpdateObject?.(o.id, { favorite: !o.favorite });
  const selectSection = (section) => {
    setActiveSection(section);
    setSelectedCategory(null);
  };
  const handleAddCategory = () => {
    const name = window.prompt(t("wizard.stepCategoryPrompt"));
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    if (!(state.categories || []).includes(trimmed)) {
      onUpdateCategories?.([...(state.categories || []), trimmed]);
    }
    setSelectedCategory(trimmed);
  };
  // `peek` = habitación tocada en la lista: se pinta la lista con la hoja
  // inferior encima; deslizar la hoja hacia arriba pasa a `{ roomId }` (vista
  // completa de siempre).
  const peeking = !!(room && view.peek);

  if (!room || peeking) {
    // ROOM LIST (+ hoja inferior si `peeking`)
    const favoriteObjects = showFavoritesOnly ? state.objects.filter((o) => o.favorite) : [];
    const categoriesInUse = showCategoryFilter
      ? [...new Set([...(state.categories || []), ...state.objects.map((o) => o.category).filter(Boolean)])].sort((a, b) => a.localeCompare(b))
      : [];
    const categoryObjects = selectedCategory ? state.objects.filter((o) => o.category === selectedCategory) : [];
    return (
      <>
      <div className="hm-fade-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <h1 className="hm-display" style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>{t("room.title")}</h1>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className={`hm-btn hm-btn--compact ${activeSection === "rooms" ? "hm-btn-primary" : "hm-btn-soft"}`}
              style={{ fontSize: 12.5 }}
              onClick={() => selectSection("rooms")}
            >
              <Home size={13} /> {t("common.roomsFilter")}
            </button>
            <button
              className={`hm-btn hm-btn--compact ${showCategoryFilter ? "hm-btn-primary" : "hm-btn-soft"}`}
              style={{ fontSize: 12.5 }}
              onClick={() => selectSection("categories")}
            >
              <Tag size={13} /> {t("common.categoriesFilter")}
            </button>
            <button
              className={`hm-btn hm-btn--compact ${showFavoritesOnly ? "hm-btn-primary" : "hm-btn-soft"}`}
              style={{ fontSize: 12.5 }}
              onClick={() => selectSection("favorites")}
            >
              <Star size={13} fill={showFavoritesOnly ? "currentColor" : "none"} /> {t("common.favoritesFilter")}
            </button>
          </div>
        </div>
        {showFavoritesOnly ? (
          favoriteObjects.length === 0 ? (
            <EmptyState icon={Star} title={t("common.noResults")} subtitle={t("room.noFavoriteObjects")} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {favoriteObjects.map((o) => (
                <ObjectRow
                  key={o.id}
                  o={o}
                  onClick={() => goTo({ tab: "objectDetail", objectId: o.id })}
                  onToggleFavorite={() => toggleObjectFavorite(o)}
                  path={locationPath(state, o)}
                />
              ))}
            </div>
          )
        ) : showCategoryFilter ? (
          selectedCategory ? (
            <div>
              <button className="hm-btn hm-btn-ghost" style={{ paddingLeft: 0, marginBottom: 12 }} onClick={() => setSelectedCategory(null)}>
                <ArrowLeft size={16} /> {t("common.back")}
              </button>
              {categoryObjects.length === 0 ? (
                <EmptyState icon={Tag} title={t("common.noResults")} subtitle={t("room.noCategoryObjects")} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {categoryObjects.map((o) => (
                    <ObjectRow
                      key={o.id}
                      o={o}
                      onClick={() => goTo({ tab: "objectDetail", objectId: o.id })}
                      onToggleFavorite={() => toggleObjectFavorite(o)}
                      path={locationPath(state, o)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: 10 }}>
              {categoriesInUse.map((cat) => (
                <div key={cat} className="hm-card hm-tap hm-card--p14" onClick={() => setSelectedCategory(cat)}>
                  <CategoryIcon category={cat} size={26} style={{ color: "var(--accent)" }} />
                  <div className="hm-display" style={{ fontWeight: 600, fontSize: 15, marginTop: 10 }}>{cat}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", margin: "3px 0 10px" }}>
                    {t("common.objectsCount", { count: state.objects.filter((o) => o.category === cat).length })}
                  </div>
                  <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    {t("room.viewObjects")} <ChevronRight size={14} />
                  </span>
                </div>
              ))}
              <div
                className="hm-tap hm-card--p14"
                onClick={handleAddCategory}
                style={{ border: "2px dashed var(--border)", borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "var(--ink-soft)", minHeight: 132 }}
              >
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={18} />
                </div>
                <span className="hm-display" style={{ fontWeight: 600, fontSize: 15 }}>{t("wizard.stepCategoryNew")}</span>
              </div>
            </div>
          )
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: 10 }}>
            {state.rooms.map((r) => (
              <div key={r.id} className="hm-card hm-tap hm-card--p14" onClick={() => setView({ roomId: r.id, peek: true })}>
                <RoomIcon iconKey={r.icon} size={26} style={{ color: "var(--accent)" }} />
                <div className="hm-display" style={{ fontWeight: 600, fontSize: 15, marginTop: 10 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", margin: "3px 0 10px" }}>{t("common.objectsCount", { count: roomObjectCount(state, r.id) })}</div>
                <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                  {t("room.viewRoom")} <ChevronRight size={14} />
                </span>
              </div>
            ))}
            <div
              className="hm-tap hm-card--p14"
              onClick={() => openModal("addRoom")}
              style={{ border: "2px dashed var(--border)", borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "var(--ink-soft)", minHeight: 132 }}
            >
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={18} />
              </div>
              <span className="hm-display" style={{ fontWeight: 600, fontSize: 15 }}>{t("room.createRoom")}</span>
            </div>
          </div>
        )}
      </div>
      {peeking && (
        <RoomSheet
          room={room}
          state={state}
          goTo={goTo}
          onRename={(nextName) => onUpdateRoom?.(room.id, { name: nextName })}
          onDelete={() => onDeleteRoom?.(room.id)}
          onExpand={() => setView({ roomId: room.id })}
          onClose={() => setView({})}
        />
      )}
      </>
    );
  }

  if (room && !zone) {
    const zones = state.zones.filter((z) => z.roomId === room.id);
    const directContainers = state.containers.filter((c) => c.roomId === room.id && !c.zoneId && !c.parentId);
    const directObjects = state.objects.filter((o) => o.roomId === room.id && !o.zoneId && !o.containerId);
    return (
      <div className="hm-fade-in">
       <button className="hm-btn hm-btn-ghost" style={{ paddingLeft: 0, marginBottom: 8 }} onClick={() => setView({})}><ArrowLeft size={16} />{t("room.title")}</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RoomIcon iconKey={room.icon} size={26} style={{ color: "var(--ink-soft)" }} />
            <div>
              <h1 className="hm-display" style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{room.name}</h1>
              <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("room.objects", { count: roomObjectCount(state, room.id) })}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button id="create-zone-cta" className="hm-btn hm-btn-soft" onClick={() => openModal("addZone", { roomId: room.id })}><Plus size={15} />{t("room.addZone")}</button>
            <button className="hm-btn hm-btn-primary" onClick={() => openModal("addObject", { roomId: room.id })}><Plus size={15} />{t("room.addObject")}</button>
          </div>
        </div>

        {zones.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <label className="hm-label">{t("room.zonesHeader")}</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {zones.map((z) => (
                <div key={z.id} className="hm-card hm-tap hm-card--p16" onClick={() => setView({ roomId: room.id, zoneId: z.id })}>
                  <span style={{ fontSize: 20 }}>{z.icon}</span>
                  <div style={{ fontWeight: 600, fontSize: 14, marginTop: 8 }}>{z.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{countObjectsIn(state, (o) => o.zoneId === z.id)} {t("room.objectsLabel")}</div>
                </div>
              ))}
            </div>
          </div>
        )}
 
        {directContainers.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <label className="hm-label">{t("room.boxesInRoom")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {directContainers.map((c) => (
                <span key={c.id} className="hm-card-flat hm-tap hm-card--p14" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                  onClick={() => goTo({ tab: "cajas", containerId: c.id })}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: c.color }} /> {c.name}
                </span>
              ))}
            </div>
          </div>
        )}
 
        <label className="hm-label">{t("room.looseObjectsHeader")}</label>
        {directObjects.length === 0 ? (
          <EmptyState
            icon={BoxIcon}
            title={t("room.emptyObjectsTitle")}
            subtitle={t("room.emptyObjectsSubtitle")}
            action={<button className="hm-btn hm-btn-primary" onClick={() => openModal("addObject", { roomId: room.id })}><Plus size={15} />{t("room.addObject")}</button>}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {directObjects.map((o) => (
              <ObjectRow key={o.id} o={o} onClick={() => goTo({ tab: "objectDetail", objectId: o.id })} onToggleFavorite={() => toggleObjectFavorite(o)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ZONE VIEW
  const containersInZone = state.containers.filter((c) => c.zoneId === zone.id && !c.parentId);
  const objectsInZone = state.objects.filter((o) => o.zoneId === zone.id && !o.containerId);
  return (
    <div className="hm-fade-in">
      <button className="hm-btn hm-btn-ghost" style={{ paddingLeft: 0, marginBottom: 8 }} onClick={() => setView({ roomId: room.id })}><ArrowLeft size={16} />{room.name}</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 className="hm-display" style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{zone.icon} {zone.name}</h1>
          <Route path={locationPath(state, { roomId: room.id, zoneId: zone.id })} size="sm" />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="hm-btn hm-btn-soft" onClick={() => openModal("addContainer", { roomId: room.id, zoneId: zone.id })}><Plus size={15} />{t("room.addContainer")}</button>
          <button className="hm-btn hm-btn-primary" onClick={() => openModal("addObject", { roomId: room.id, zoneId: zone.id })}><Plus size={15} />{t("room.addObject")}</button>
        </div>
      </div>
 
      {containersInZone.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <label className="hm-label">{t("room.containersHeader")}</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
            {containersInZone.map((c) => (
              <div key={c.id} className="hm-card hm-tap hm-card--p14" onClick={() => goTo({ tab: "cajas", containerId: c.id })}>
                <span style={{ width: 12, height: 12, borderRadius: 999, background: c.color, display: "inline-block" }} />
                <div style={{ fontWeight: 600, fontSize: 14, marginTop: 8 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{objectCountInContainer(state, c.id)} {t("room.objectsLabel")}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <label className="hm-label">{t("room.objectsHeader")}</label>
      {objectsInZone.length === 0 ? (
        <EmptyState
          icon={BoxIcon}
          title={t("room.zoneEmptyTitle")}
          subtitle={t("room.zoneEmptySubtitle")}
          action={<button className="hm-btn hm-btn-primary" onClick={() => openModal("addObject", { roomId: room.id, zoneId: zone.id })}><Plus size={15} />{t("room.addObject")}</button>}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {objectsInZone.map((o) => <ObjectRow key={o.id} o={o} onClick={() => goTo({ tab: "objectDetail", objectId: o.id })} onToggleFavorite={() => toggleObjectFavorite(o)} />)}
        </div>
      )}
    </div>
  );
}

/**
 * Hoja inferior que sube al tocar una habitación en la lista de Hogar: resumen
 * (cajas + primeros objetos) sin salir de la lista. Se arrastra hacia arriba
 * (o se toca "Ver habitación") para expandir a la vista completa, y hacia abajo
 * (o tocando el fondo) para cerrar. Ver useSheetGesture.
 */
function RoomSheet({ room, state, goTo, onRename, onDelete, onExpand, onClose }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, sheetStyle, isSuppressingClick } = useSheetGesture(onClose, onExpand);
  const [name, setName] = useState(room.name);

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === room.name) { setName(room.name); return; }
    onRename?.(trimmed);
  };

  const directContainers = state.containers.filter((c) => c.roomId === room.id && !c.zoneId && !c.parentId);
  const looseObjects = state.objects.filter((o) => o.roomId === room.id && !o.zoneId && !o.containerId);

  const guardedGo = (target) => {
    if (isSuppressingClick()) return;
    goTo(target);
  };

  return (
    <div
      className="hm-modal-overlay"
      style={{ zIndex: 1000 }}
      onClick={() => { if (!isSuppressingClick()) onClose(); }}
    >
      <div
        className="hm-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ height: "62dvh", maxHeight: "62dvh", overflowY: "hidden", display: "flex", flexDirection: "column", ...sheetStyle }}
      >
        {/* Solo el tirador arrastra la hoja: la fila del nombre queda fuera para
            que al tocar el input (móvil) no se dispare el gesto — useSheetGesture
            hace preventDefault en touchstart sobre todo el elemento arrastrable. */}
        <div ref={handleRef} onMouseDown={handleMouseDown} style={{ touchAction: "none", cursor: "grab", flexShrink: 0 }}>
          <div className="hm-modal-handle-wrap"><div className="hm-modal-handle" /></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px 12px", flexShrink: 0 }}>
          <RoomIcon iconKey={room.icon} size={22} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <input
            className="hm-display hm-room-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            aria-label={t("room.nameLabel")}
            style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 17, border: "1px solid transparent", background: "transparent", borderRadius: 8, padding: "4px 6px" }}
          />
          <button
            className="hm-btn hm-btn-ghost hm-text-danger hm-btn--compact"
            style={{ flexShrink: 0 }}
            onClick={() => onDelete?.()}
            aria-label={t("room.deleteRoom")}
          >
            <Trash2 size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          {directContainers.length > 0 && (
            <div>
              <label className="hm-label">{t("room.boxesInRoom")}</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {directContainers.map((c) => (
                  <span
                    key={c.id}
                    className="hm-card-flat hm-tap hm-card--p14"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                    onClick={() => guardedGo({ tab: "cajas", containerId: c.id })}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: c.color }} /> {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {looseObjects.length > 0 && (
            <div>
              <label className="hm-label">{t("room.looseObjectsHeader")}</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {looseObjects.slice(0, 8).map((o) => (
                  <ObjectRow key={o.id} o={o} onClick={() => guardedGo({ tab: "objectDetail", objectId: o.id })} />
                ))}
              </div>
            </div>
          )}

          {directContainers.length === 0 && looseObjects.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: 13, padding: "10px 0" }}>
              {t("room.emptyObjectsTitle")}
            </div>
          )}

          <button className="hm-btn hm-btn-soft hm-btn--full" style={{ marginTop: "auto" }} onClick={onExpand}>
            {t("room.viewRoom")} <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ObjectRow({ o, onClick, onToggleFavorite, path }) {
  return (
    <div className="hm-card hm-tap hm-card--p12" style={{ display: "flex", alignItems: "center", gap: 10 }} onClick={onClick}>
      <CategoryIcon category={o.category} size={18} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{o.name}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{path && path.length > 0 ? path.join(" · ") : o.category}</div>
      </div>
      {onToggleFavorite && <FavoriteStar active={o.favorite} onToggle={onToggleFavorite} size={15} />}
      <ChevronRight size={16} style={{ color: "var(--ink-soft)" }} />
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* CAJAS                                                                 */
/* -------------------------------------------------------------------- */
function Cajas({ state, view, setView, openModal, goTo, onUpdateObject }) {
  const { t } = useTranslation();
  const activeContainer = view.containerId ? getContainer(state, view.containerId) : null;

  if (activeContainer) {
    const childObjects = state.objects.filter((o) => o.containerId === activeContainer.id);
    const childContainers = state.containers.filter((c) => c.parentId === activeContainer.id);
    const parentContainer = activeContainer.parentId ? getContainer(state, activeContainer.parentId) : null;
    // Al salir de una caja de primer nivel se vuelve a la habitación de la que
    // se vino (el pilar Hogar repinta MiCasa con `micasaView` intacto), así
    // que el botón muestra el nombre de esa habitación y no un genérico
    // "Cajas" que llevaría a pensar que se va a la lista de cajas.
    const parentRoom = !parentContainer && activeContainer.roomId ? getRoom(state, activeContainer.roomId) : null;
    return (
      <div className="hm-fade-in">
        <button className="hm-btn hm-btn-ghost" style={{ paddingLeft: 0, marginBottom: 8 }} onClick={() => setView(parentContainer ? { containerId: parentContainer.id } : {})}><ArrowLeft size={16} />{parentContainer ? parentContainer.name : (parentRoom?.name || t("room.boxesSection"))}</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: activeContainer.color, flexShrink: 0 }} />
              <h1 className="hm-display" style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{activeContainer.name}</h1>
            </div>
            <Route path={locationPath(state, activeContainer)} size="sm" />
          </div>
          <button className="hm-btn hm-btn-primary" onClick={() => openModal("addObject", { roomId: activeContainer.roomId, zoneId: activeContainer.zoneId, containerId: activeContainer.id })}>
            <Plus size={16} /> {t("room.addObjectToBox")}
          </button>
        </div>

        {childContainers.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <label className="hm-label">{t("room.containersInside")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {childContainers.map((c) => (
                <span key={c.id} className="hm-card-flat hm-tap" style={{ padding: "8px 14px", cursor: "pointer" }} onClick={() => setView({ containerId: c.id })}>{c.name}</span>
              ))}
            </div>
          </div>
        )}
        <label className="hm-label">{t("room.contentHeader")}</label>
        {childObjects.length === 0 ? (
          <EmptyState icon={BoxIcon} title={t("box.emptyTitle")} subtitle={t("box.emptySubtitle")}
            action={<button className="hm-btn hm-btn-primary" onClick={() => openModal("addObject", { roomId: activeContainer.roomId, zoneId: activeContainer.zoneId, containerId: activeContainer.id })}><Plus size={15} />{t("room.addObject")}</button>} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {childObjects.map((o) => <ObjectRow key={o.id} o={o} onClick={() => goTo({ tab: "objectDetail", objectId: o.id })} onToggleFavorite={() => onUpdateObject?.(o.id, { favorite: !o.favorite })} />)}
          </div>
        )}
      </div>
    );
  }

  const topLevel = allContainersFlat(state).filter((c) => !c.parentId);
  return (
    <div className="hm-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h1 className="hm-display" style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>{t("room.boxesSection")}</h1>
      <button id="create-box-cta" className="hm-btn hm-btn-primary" onClick={() => openModal("addContainer")}><Plus size={16} /> {t("room.createContainer")}</button>
      </div>
      {topLevel.length === 0 ? (
        <EmptyState icon={BoxIcon} title={t("box.emptyListTitle")} subtitle={t("box.emptyListSubtitle")}
          action={<button className="hm-btn hm-btn-primary" onClick={() => openModal("addContainer")}><Plus size={15} />{t("room.createContainer")}</button>} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14 }}>
          {topLevel.map((c) => (
            <div key={c.id} className="hm-card hm-tap hm-card--p16" onClick={() => setView({ containerId: c.id })}>
              <span style={{ width: 30, height: 30, borderRadius: 10, background: c.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BoxIcon size={15} color="#fff" />
              </span>
              <div className="hm-display" style={{ fontWeight: 600, fontSize: 15, marginTop: 10 }}>{c.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-soft)", margin: "4px 0 8px" }}>{t("common.objectsCount", { count: objectCountInContainer(state, c.id) })}</div>
              <Route path={c.path} size="sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* COMPRAS                                                               */
/* -------------------------------------------------------------------- */
function Compras({ state, dispatch, openModal, deleteShoppingList, addShopping, onCompletePurchase, onRepeatPurchase, onSaveReceiptPurchase }) {
  return (
    <ShoppingModule
      state={state}
      dispatch={dispatch}
      openModal={openModal}
      deleteShoppingList={deleteShoppingList}
      addShopping={addShopping}
      onCompletePurchase={onCompletePurchase}
      onRepeatPurchase={onRepeatPurchase}
      onSaveReceiptPurchase={onSaveReceiptPurchase}
    />
  );
}

/* -------------------------------------------------------------------- */
/* TAREAS                                                                 */
/* -------------------------------------------------------------------- */
function Tareas({ state, dispatch, openModal, onTaskCompleted }) {
  return <TasksModule state={state} dispatch={dispatch} openModal={openModal} onTaskCompleted={onTaskCompleted} />;
}

/* -------------------------------------------------------------------- */
/* NOTAS                                                                 */
/* -------------------------------------------------------------------- */
function Notas({ state, dispatch, openModal }) {
  return <NotesModule state={state} dispatch={dispatch} openModal={openModal} />;
}

/* -------------------------------------------------------------------- */
/* FACTURAS                                                               */
/* -------------------------------------------------------------------- */
/* -------------------------------------------------------------------- */
/* CALENDARIO                                                             */
/* -------------------------------------------------------------------- */
function Calendario({ state, currentHome, canSeeEconomy }) {
  return <CalendarModule state={state} currentHome={currentHome} canSeeEconomy={canSeeEconomy} />;
}

/* -------------------------------------------------------------------- */
/* NAVIGATION                                                            */
/* -------------------------------------------------------------------- */
const NAV = [
  { key: "inicio", label: "Inicio", icon: Home },
  { key: "hogar", label: "Hogar", icon: Building2, oldKeys: ["micasa", "cajas"] },
  { key: "organizacion", label: "Organización", icon: CheckSquare, oldKeys: ["compras", "tareas"] },
  { key: "economia", label: "Economía", icon: TrendingUp, oldKeys: ["facturas"] },
];

const Sidebar = memo(function Sidebar({ active, onSelect, homeName, darkMode, onToggleDark, onOpenHomeSelector, user, nav = NAV }) {
  const { t } = useTranslation();
  return (
    <div className="hm-card" style={{ width: 232, padding: 18, display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, height: "fit-content", position: "sticky", top: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 18px" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "#F3F4F6", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BrandMark size={17} />
        </div>
        <span className="hm-display" style={{ fontWeight: 700, fontSize: 17 }}>Haven</span>
      </div>
 
      <div
        className="hm-card-flat hm-tap"
        style={{ padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", border: "1px solid var(--border)" }}
        onClick={onOpenHomeSelector}
      >
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
          <Home size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{homeName}</div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{t("common.changeHome")}</div>
        </div>
        <ChevronDown size={14} style={{ color: "var(--ink-soft)" }} />
      </div>
 
      {nav.map((n) => (
        <div key={n.key} className={"hm-sidebar-item" + (active === n.key ? " active" : "")} onClick={() => onSelect(n.key)}>
          <n.icon size={18} /> {t(`nav.${n.key}`)}
        </div>
      ))}
 
      <div style={{ borderTop: "1px solid var(--border)", marginTop: 10, paddingTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        <div className="hm-sidebar-item" onClick={onToggleDark}>
          {darkMode ? <Sun size={18} /> : <Moon size={18} />} {darkMode ? t("common.lightMode") : t("common.darkMode")}
        </div>
      </div>
    </div>
  );
});

const BottomNav = memo(function BottomNav({ active, onSelect, nav = NAV }) {
  const { t } = useTranslation();
  return (
    <nav role="navigation" aria-label="Main" style={{ display: "flex", justifyContent: "center" }}>
      <div role="tablist" aria-label="Main tabs" style={{
        position: "fixed", bottom: "calc(12px + env(safe-area-inset-bottom))", left: 12, right: 12, display: "flex", padding: "4px 8px",
        zIndex: 50, borderRadius: 24,
        background: "rgba(var(--surface-rgb), 0.55)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid rgba(var(--border-rgb), 0.25)",
        boxShadow: "0 10px 36px rgba(10,10,10,0.12), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}>        {nav.map((n) => (
          <div
            key={n.key}
            role="tab"
            aria-selected={active === n.key}
            aria-label={t(`nav.${n.key}`)}
            title={t(`nav.${n.key}`)}
            tabIndex={0}
            className={"hm-bottomnav-item" + (active === n.key ? " active" : "")}
            onClick={() => onSelect(n.key)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(n.key); }}
            style={{ padding: "6px 12px" }}
          >
            <n.icon size={26} />
          </div>
        ))}
      </div>
    </nav>
  );
});

function NotificationsModal({ notifications, activity, onAction, onDelete, onMarkAllRead, onClose }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  /**
   * Abrir el panel ya cuenta como haber visto las notificaciones: se marcan
   * todas como leídas para que el contador rojo del icono desaparezca sin
   * tener que pulsar nada.
   *
   * `unreadIds` congela cuáles estaban sin leer JUSTO al abrir (inicializador
   * de useState, que solo corre en el primer render). Sin esa foto, el
   * refresco posterior las devolvería ya como "read" y perderían el resaltado
   * mientras el usuario las está leyendo.
   */
  const [unreadIds] = useState(
    () => new Set(notifications.filter((n) => n.status === "unread").map((n) => n.id))
  );
  useEffect(() => {
    onMarkAllRead?.();
    // Solo al abrir: las dependencias se dejan vacías a propósito para no
    // relanzar el UPDATE en cada refresco de la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="hm-modal-overlay" onClick={(e) => { if (isSuppressingClick()) return; onClose(e); }}>
      <div className="hm-modal hm-scroll" style={{ maxWidth: 540, ...sheetStyle }} onClick={(e) => e.stopPropagation()}>
        <div ref={handleRef} className="hm-modal-handle-wrap" onMouseDown={handleMouseDown}>
          <div className="hm-modal-handle" />
        </div>
        <div className="hm-modal-header">
          <button className="hm-modal-close" onClick={onClose} aria-label={t("common.close")}><X size={20} /></button>
          <h3 className="hm-display hm-modal-title" style={{ fontSize: 21, fontWeight: 600, margin: 0 }}>{t("header.notifications")}</h3>
        </div>
        <div className="hm-modal-body">
          <NotificationCenter
            notifications={notifications}
            activity={activity}
            unreadIds={unreadIds}
            onAction={onAction}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

function PrivacyModal({ onClose }) {
  const { t } = useTranslation();
  return (
    <Modal title={t("settings.privacySection")} onClose={onClose}>
      <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
        {t("settings.privacyText")}
      </p>
    </Modal>
  );
}

function TermsModal({ onClose }) {
  const { t } = useTranslation();
  return (
    <Modal title={t("settings.termsSection")} onClose={onClose}>
      <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
        {t("settings.termsText")}
      </p>
    </Modal>
  );
}

/**
 * Al crear una lista, sugiere los productos que más se repiten en el
 * historial de compras de la casa (computeFrequentProducts — estadística
 * pura, sin IA). Si todavía no hay suficiente historial, no sugiere nada:
 * es preferible no decir nada a inventar una lista de "básicos" genérica.
 */
function AddShoppingListModal({ purchases, onCreate, onClose }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState(() => new Set());

  const suggestions = useMemo(() => computeFrequentProducts(purchases), [purchases]);

  const toggleSuggestion = (productName) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productName)) next.delete(productName);
      else next.add(productName);
      return next;
    });
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), suggestions.filter((s) => selected.has(s.name)));
  };

  return (
    <Modal title={t("quickAdd.newListTitle")} onClose={onClose}>
      <label className="hm-label">{t("quickAdd.nameLabel")}</label>
      <input
        className="hm-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {suggestions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <label className="hm-label">{t("quickAdd.frequentProductsLabel")}</label>
          <p style={{ fontSize: 11.5, color: "var(--ink-soft)", margin: "0 0 10px" }}>{t("quickAdd.frequentProductsHint")}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {suggestions.map((s) => {
              const isSelected = selected.has(s.name);
              return (
                <button
                  key={s.name}
                  type="button"
                  className={"hm-btn hm-btn--compact " + (isSelected ? "hm-btn-primary" : "hm-btn-soft")}
                  onClick={() => toggleSuggestion(s.name)}
                >
                  {isSelected ? <Check size={13} /> : <Plus size={13} />} {s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="hm-btn hm-btn-soft" onClick={onClose}>{t("quickAdd.cancel")}</button>
        <button className="hm-btn hm-btn-primary" onClick={handleCreate} disabled={!name.trim()}>{t("quickAdd.create")}</button>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------- */
/* APP ROOT                                                              */
/* -------------------------------------------------------------------- */
// HomeMapApp itself can't consume the I18nProvider it renders — a component
// can never read context from a provider it produces as its own output, only
// from an ancestor. So the actual provider lives in the outer HomeMapApp
// wrapper below, and this inner component just reports the locale it wants
// (derived from the loaded profile) back up via onLocaleChange.
function HomeMapAppInner({ appLocale, onLocaleChange }) {
  const { t } = useTranslation();
  const { user, setUser, authLoading, passwordRecovery, setPasswordRecovery } = useAuthSession();
  const {
    homes, setHomes,
    homesLoaded, setHomesLoaded,
    homesLoadError, setHomesLoadError,
    houseMembers, setHouseMembers,
    currentHomeId, setCurrentHomeId,
    activeHome,
  } = useHomesAndMembers(user?.id);
  const [shareMembers, setShareMembers] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  // Los niños no ven ni economía ni notificaciones (que a menudo son sobre
  // facturas/gastos), así que esta misma flag gatea ambas cosas.
  const canSeeEconomy = !activeHome || activeHome.myRole !== "child";
  const [state, setState, loaded] = useHomeMapState(currentHomeId, user?.id);
  // Los avisos se lanzan desde manejadores de este componente, que es el que
  // renderiza el CurrencyProvider y por tanto no puede consumirlo. Se formatea
  // con el util directamente; el resto del árbol usa useCurrency().
  const formatAmount = (amount) =>
    formatCurrencyValue(amount, activeHome?.currency_code, state?.profile?.language || "es");
  useEffect(() => {
    const desiredLocale = state?.profile?.language || "es";
    if (desiredLocale !== appLocale) onLocaleChange(desiredLocale);
  }, [state?.profile?.language, appLocale, onLocaleChange]);
  // Inyectado en el buscador global (módulo aparte, sin acceso a los
  // helpers internos de este archivo) para que pueda construir la ruta de
  // objetos/cajas sin duplicar la lógica de habitación/zona/caja.
  const getEntityPath = useCallback((entity) => (state ? locationPath(state, entity) : []), [state]);
  const {
    route, setRoute,
    prevTab, setPrevTab,
    micasaView, setMicasaView,
    cajasView, setCajasView,
    organizationTab, setOrganizationTab,
    mapTabToNewPillar, goTo, selectTab,
  } = useHomeNavigation(canSeeEconomy);
  const { prefersDark } = useTheme(state?.profile?.theme, state?.profile?.darkMode);
  const {
    modal, setModal, openModal, closeModal,
    notice, setNotice, showNotice,
    confirmDialog, setConfirmDialog,
    viewingMember, setViewingMember,
  } = useAppModals(state, homes);
  const [currencyLoading, setCurrencyLoading] = useState(false);
  /**
   * BillsSection/EconomyOverview/MovementsSection cargan sus datos en un
   * useEffect propio que solo depende de currentHome.id: si se crea una
   * factura/gasto/ingreso desde el modal rápido del botón flotante (fuera
   * del árbol de esas pantallas) esas pantallas no se enteran y se quedan
   * mostrando la lista vieja aunque el alta se haya guardado bien ("no
   * puedo añadir facturas" era esto: sí se guardaban, pero no aparecían).
   * Subir esta versión y pasarla a EconomyModule fuerza un remount de la
   * pestaña de Economía activa, que vuelve a pedir los datos.
   */
  const [economyVersion, setEconomyVersion] = useState(0);
  /**
   * Recibo animado de "compra completada" (ver PurchaseCompleteAnimation).
   * Una sola ranura de estado a propósito: aunque se cierren dos compras
   * seguidas (o se pulse dos veces "Finalizar"), nunca puede haber dos
   * overlays a la vez — el segundo disparo sustituye al primero. Se pone a
   * null solo desde onDone, así que la animación siempre se limpia.
   */
  const [purchaseCelebration, setPurchaseCelebration] = useState(null);

  const refreshHomes = async () => {
    try {
      const rows = await houseService.listMyHouses();
      setHomes(rows.map((h) => ({
        id: h.id,
        name: h.name,
        inviteCode: h.invite_code,
        myRole: h.my_role,
        isOwner: h.my_role === "admin",
        createdByMe: h.created_by === user?.id,
        memberCount: h.member_count,
        createdAt: h.created_at || null,
        currency_code: h.currency_code || "EUR",
      })));
      setHomesLoadError(false);
      setHomesLoaded(true);
    } catch (error) {
      console.error("Error loading homes:", error);
      showNotice(t("toast.couldNotLoadHomes"));
      // No marcamos homesLoaded aquí: si lo hiciéramos, un fallo de red
      // pasajero haría que un usuario que ya pertenece a una casa cayera en
      // la pantalla de "crear o unirse a una casa" como si no tuviera
      // ninguna, arriesgándose a que cree una casa duplicada por error.
      setHomesLoadError(true);
    }
  };

  const handleRenameHouse = async (houseId, name) => {
    try {
      await houseService.renameHouse(houseId, name);
      await refreshHomes();
      showNotice(t("toast.houseRenamed"));
    } catch (error) {
      console.error("Error renaming house:", error);
      showNotice(error?.message || t("toast.houseRenameError"));
    }
  };

  const handleRegenerateInviteCode = async (houseId) => {
    try {
      const newCode = await houseService.regenerateInviteCode(houseId);
      await refreshHomes();
      showNotice(t("toast.inviteCodeRegenerated"));
      return newCode;
    } catch (error) {
      console.error("Error regenerating invite code:", error);
      showNotice(error?.message || t("toast.inviteCodeRegenerateError"));
      return null;
    }
  };

  const refreshHouseMembers = async () => {
    if (!activeHome?.id) return;
    try {
      setHouseMembers(await houseService.getHouseMembers(activeHome.id));
    } catch (error) {
      console.error("Error loading house members:", error);
      showNotice(t("toast.couldNotLoadMembers"));
    }
  };

  const handleChangeMemberRole = async (memberId, role) => {
    if (!activeHome?.id) return;
    try {
      await houseService.setMemberRole(activeHome.id, memberId, role);
      await refreshHouseMembers();
      showNotice(t("toast.roleUpdated"));
    } catch (error) {
      console.error("Error changing member role:", error);
      showNotice(error?.message || t("toast.roleUpdateError"));
    }
  };

  const handleChangeMemberEconomyAccess = async (memberId, access) => {
    if (!activeHome?.id) return;
    try {
      await houseService.setMemberEconomyAccess(activeHome.id, memberId, access);
      await refreshHouseMembers();
      showNotice(t("toast.economyAccessUpdated"));
      setViewingMember((m) => (m ? { ...m, economy_role: access } : m));
    } catch (error) {
      console.error("Error changing member economy access:", error);
      showNotice(error?.message || t("toast.economyAccessUpdateError"));
    }
  };

  const handleRemoveHouseMember = async (memberId) => {
    if (!activeHome?.id) return;
    try {
      await houseService.removeMember(activeHome.id, memberId);
      await refreshHouseMembers();
      await refreshHomes();
      showNotice(t("toast.memberRemoved"));
    } catch (error) {
      console.error("Error removing member:", error);
      showNotice(error?.message || t("toast.memberRemoveError"));
    }
  };

  /** Pide confirmación antes de eliminar, a diferencia del botón rápido de HouseMembersSection: esta acción vive en la pantalla de información del miembro, un sitio más deliberado. */
  const confirmRemoveMemberFromDetail = (member) => {
    setConfirmDialog({
      title: t("memberDetail.confirmRemoveTitle"),
      message: t("memberDetail.confirmRemoveMessage", { name: member.name }),
      isDangerous: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setViewingMember(null);
        await handleRemoveHouseMember(member.user_id);
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  const handleTransferOwnership = (member) => {
    setConfirmDialog({
      title: t("memberDetail.confirmTransferTitle"),
      message: t("memberDetail.confirmTransferMessage", { name: member.name }),
      isDangerous: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        if (!activeHome?.id) return;
        try {
          await houseService.transferOwnership(activeHome.id, member.user_id);
          await refreshHouseMembers();
          await refreshHomes();
          showNotice(t("memberDetail.transferSuccess", { name: member.name }));
          setViewingMember(null);
        } catch (error) {
          console.error("Error transferring house ownership:", error);
          showNotice(error?.message || t("memberDetail.transferError"));
        }
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  /**
   * Borra la casa entera (habitaciones, objetos, tareas, compras, notas,
   * Economía...) — irreversible, solo el admin la ve. Tras confirmar, cierra
   * el panel de ajustes y navega fuera antes de que `activeHome` quede
   * apuntando a una casa que ya no existe.
   */
  const handleDeleteHouse = (house) => {
    if (!house?.id) { showNotice(t("toast.houseDeleteError")); return; }
    // Cierra el panel de Configuración de la casa antes de pedir confirmación:
    // ese drawer se dibuja por encima del diálogo y, si no, tapaba la pregunta.
    closeModal();
    setConfirmDialog({
      title: t("confirm.deleteHouseTitle"),
      message: t("confirm.deleteHouseMessage", { name: house.name }),
      isDangerous: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await houseService.deleteHouse(house.id);
          setRoute({ tab: "inicio" });
          setHomes((prev) => prev.filter((h) => h.id !== house.id));
          setCurrentHomeId((prev) => (prev === house.id ? "" : prev));
          showNotice(t("toast.houseDeleted", { name: house.name }));
        } catch (error) {
          console.error("Error deleting house:", error);
          showNotice(error?.message || t("toast.houseDeleteError"));
        }
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  const handleChangeCurrency = async (currencyCode) => {
    if (!activeHome?.id) return;
    try {
      setCurrencyLoading(true);
      await houseService.setHouseCurrency(activeHome.id, currencyCode);
      await refreshHomes();
      showNotice(t("toast.currencyChanged") || "Moneda actualizada");
    } catch (error) {
      console.error("Error changing currency:", error);
      showNotice(error?.message || t("toast.currencyError") || "Error al cambiar la moneda");
    } finally {
      setCurrencyLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setHomes([]);
      setHomesLoaded(false);
      setHomesLoadError(false);
      return;
    }
    refreshHomes();
  }, [user?.id]);

  useEffect(() => {
    if (modal?.type !== "shareHome" || !activeHome?.id) {
      setShareMembers([]);
      return;
    }
    let cancelled = false;
    houseService.getHouseMembers(activeHome.id)
      .then((members) => { if (!cancelled) setShareMembers(members); })
      .catch((error) => {
        console.error("Error loading house members:", error);
        if (!cancelled) showNotice(t("toast.couldNotLoadMembers"));
      });
    return () => { cancelled = true; };
  }, [modal?.type, activeHome?.id]);

  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
  } = useNotificationsEngine(state, activeHome?.id, user?.id, loaded);

  const handleNotificationAction = (notification) => {
    const handlers = buildNotificationActionHandlers({ dispatch, openModal, goTo, setOrganizationTab });
    const handler = notification.action?.type && handlers[notification.action.type];
    if (handler) handler(notification.action.payload || {});
    markNotificationRead(notification.id);
    closeModal();
  };

  useEffect(() => {
    if (!user || !state) return;
    const authName = user.name || user.email?.split("@")[0] || "Usuario";
    const authEmail = user.email || "";
    const currentName = state.profile?.userName || "";
    const currentEmail = state.profile?.email || "";
    const fallbackName = user.email?.split("@")[0] || "Usuario";
    const shouldUpdateName = !currentName || currentName === "Usuario" || currentName === fallbackName;
    const shouldUpdateEmail = !currentEmail && authEmail;

    if (!shouldUpdateName && !shouldUpdateEmail) return;

    setState((s) => ({
      ...s,
      profile: {
        ...s.profile,
        userName: shouldUpdateName ? authName : s.profile.userName,
        email: shouldUpdateEmail ? authEmail : s.profile.email,
      },
    }));
  }, [user, state, setState]);

    const dispatch = (updater) => setState((s) => updater(s));
    useTaskRetention(state, dispatch, activeHome?.id, loaded);

    const handleLogin = (userData) => {
      setUser(mapSupabaseUser(userData));
  };

    const handleImportData = (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("El archivo no contiene un estado válido.");
          }
          const importedState = sanitizeHomeState(parsed);
          setState(importedState);
        } catch (error) {
          console.error("Error importing data:", error);
          showNotice(t("toast.importError"));
        }
      };
      reader.onerror = () => {
        showNotice(t("toast.fileReadError"));
      };
      reader.readAsText(file);
    };

  const handleLogout = async () => {
      // Se registra ANTES de signOut(): en cuanto la sesión se cierra, el
      // cliente deja de adjuntar el JWT a sus llamadas y auth.uid() ya no
      // podría resolver quién ha salido.
      await securityEventsService.logSecurityEvent("auth_logout");
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error signing out:", error);
        showNotice(t("toast.logoutError"));
        return;
      }
      localStorage.removeItem(USER_STORAGE_KEY);
      setUser(null);
      setHomes([]);
      setCurrentHomeId("");
      setRoute({ tab: "inicio" });
    };

  const handleDeleteAccount = async () => {
    setConfirmDialog({
      title: t("confirm.deleteAccountTitle"),
      message: t("confirm.deleteAccountMessage"),
      isDangerous: true,
      onConfirm: async () => {
        setConfirmDialog(null);

        const { data: deleteResult, error: invokeError } = await supabase.functions.invoke("delete-account");

        if (invokeError || deleteResult?.error) {
          if (deleteResult?.error === "blocked_owner") {
            showNotice(t("toast.accountDeleteBlockedOwner"));
          } else {
            console.error("Error deleting account:", invokeError || deleteResult?.error);
            showNotice(t("toast.accountDeleteError"));
          }
          return;
        }

        // La cuenta ya no existe en el servidor -- limpiar todo el estado local.
        homes.forEach((h) => {
          const houseKey = getHouseStorageKey(user?.id, h.id);
          if (houseKey) localStorage.removeItem(houseKey);
        });
        if (user?.id) {
          localStorage.removeItem(getHomesStorageKey(user.id));
        }
        localStorage.removeItem(USER_STORAGE_KEY);

        await supabase.auth.signOut();

        setState(null);
        setHomes([]);
        setCurrentHomeId("");
        setUser(null);
        setRoute({ tab: "inicio" });
        showNotice(t("toast.accountDeleted"));
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  /**
   * Usada como `onSubmit` del asistente de creación (WelcomeGate, ver modal
   * "createHome" más abajo), que ya muestra sus propios errores/spinner
   * inline — por eso, a diferencia de otras acciones de esta función, deja
   * que el error se propague en vez de tragárselo con un toast.
   */
  const createHome = async (name, template = null) => {
    if (!name?.trim()) return;
    const newHouse = await houseService.createHouse(name.trim());
    if (template) await applyTemplate(newHouse.id, template);
    await refreshHomes();
    setCurrentHomeId(newHouse.id);
    closeModal();
  };

  const joinHome = async (code) => {
    if (!code?.trim()) return;
    try {
      const house = await houseService.joinHouseByCode(code.trim());
      await refreshHomes();
      setCurrentHomeId(house.id);
      closeModal();
      showNotice(t("toast.joinedHome", { name: house.name }));
    } catch (error) {
      console.error("Error joining house:", error);
      showNotice(error.message || t("toast.joinHouseError"));
    }
  };

  /**
   * Variante usada por WelcomeGate cuando el usuario no tiene ninguna casa
   * todavía: a diferencia de joinHome (usada desde HomeSelector con toast),
   * relanza el error para que el propio WelcomeGate lo muestre inline, ya
   * que se renderiza antes de que exista el resto del árbol de la app (el
   * sistema de `notice` vive dentro del shell). createHome (arriba) sigue
   * el mismo patrón de "relanzar" por la misma razón, aunque sí hay shell
   * de por medio: es el modal "createHome", que reutiliza WelcomeGate.
   */
  const createHomeFromGate = async (name, template = null) => {
    const newHouse = await houseService.createHouse(name.trim());
    if (template) await applyTemplate(newHouse.id, template);
    await refreshHomes();
    setCurrentHomeId(newHouse.id);
  };

  const joinHomeFromGate = async (code) => {
    const house = await houseService.joinHouseByCode(code.trim());
    await refreshHomes();
    setCurrentHomeId(house.id);
  };

  // Botón físico "atrás" de Android: orden de prioridad — diálogo de
  // confirmación abierto → modal abierto → un nivel arriba en Cajas/MiCasa →
  // pestaña "inicio" → si ya está en inicio, deja que el sistema minimice/
  // cierre la app. El listener se registra una sola vez (no puede depender
  // de `modal`/`route`/etc., que cambian en casi cada render) y en su lugar
  // lee siempre el snapshot más reciente desde esta ref, actualizada en cada
  // render — así nunca actúa sobre estado obsoleto. Solo usa setters de
  // useState (estables) o updaters funcionales, nunca los closures de arriba
  // (`closeModal` es una excepción segura: solo usa el updater funcional de
  // `setModal`, no lee `modal` del closure).
  const backButtonStateRef = useRef(null);
  backButtonStateRef.current = { modal, confirmDialog, route, cajasView, micasaView, state };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = CapacitorApp.addListener("backButton", () => {
      const { modal, confirmDialog, route, cajasView, micasaView, state } = backButtonStateRef.current;

      if (confirmDialog) {
        confirmDialog.onCancel ? confirmDialog.onCancel() : setConfirmDialog(null);
        return;
      }
      if (modal) {
        closeModal();
        return;
      }
      // Una caja abierta vive dentro del pilar "hogar" (route.tab nunca vale
      // "cajas", ver mapTabToNewPillar), y se comprueba ANTES que micasaView
      // porque el pilar la pinta con esa misma prioridad.
      if (route?.tab === "hogar" && cajasView?.containerId) {
        const activeContainer = getContainer(state, cajasView.containerId);
        setCajasView(activeContainer?.parentId ? { containerId: activeContainer.parentId } : {});
        return;
      }
      if (route?.tab === "hogar" && micasaView?.roomId) {
        setMicasaView({});
        return;
      }
      if (route?.tab && route.tab !== "inicio") {
        setPrevTab(route.tab);
        setRoute({ tab: "inicio" });
        return;
      }
      CapacitorApp.exitApp();
    });
    return () => { listenerPromise.then((l) => l.remove()); };
  }, []);

  if (authLoading) {
    return (
      <div className="hm-root" style={{ padding: 40, textAlign: "center" }}>
        <GlobalStyle />
        {t("common.loadingSession")}
      </div>
    );
  }

  if (passwordRecovery) {
    return (
      <div className="hm-root" style={{ background: "var(--bg)" }}>
        <GlobalStyle />
        <ResetPasswordView
          onDone={() => {
            setPasswordRecovery(false);
            showNotice(t("auth.passwordUpdated"));
          }}
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="hm-root" style={{ background: "var(--bg)" }}>
        <GlobalStyle />
        <AuthView onLogin={handleLogin} />
      </div>
    );
  }

  if (homesLoadError) {
    return (
      <div className="hm-root" style={{ padding: 40, textAlign: "center" }}>
        <GlobalStyle />
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{t("common.homesLoadErrorTitle")}</div>
        <div style={{ color: "var(--ink-soft)", fontSize: 13.5, marginBottom: 18 }}>{t("common.homesLoadErrorSubtitle")}</div>
        <button className="hm-btn hm-btn-primary" onClick={refreshHomes}>{t("common.retry")}</button>
      </div>
    );
  }

  if (!homesLoaded) {
    return (
      <div className="hm-root" style={{ padding: 40, textAlign: "center" }}>
        <GlobalStyle />
        {t("common.loadingHomes")}
      </div>
    );
  }

  if (homes.length === 0) {
    return (
      <div className="hm-root">
        <GlobalStyle />
        <WelcomeGate onCreateHouse={createHomeFromGate} onJoinHouse={joinHomeFromGate} onLogout={handleLogout} />
      </div>
    );
  }

  if (!loaded || !state) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
        {t("common.loadingHaven")}
      </div>
    );
  }

  const currentHome = (homes && homes.length > 0)
    ? (homes.find(h => h.id === currentHomeId) || homes[0])
    : { name: t("ajustes.noHomeFallback"), inviteCode: "", myRole: null };

  // meta opcional: { category, entityType, entityId }. entityType/entityId
  // permiten que una notificación con el mismo entity_ref (ver
  // src/notifications/rules/*.js) enlace a esta entrada de actividad.
  // Se guarda la clave i18n (`titleKey`) y sus parámetros además de la frase
  // ya renderizada: el feed se pinta en el idioma de quien lo lee, no en el
  // del autor. `title` queda como copia de respaldo para filas antiguas.
  const logActivity = (titleKey, titleParams = {}, meta = {}) => {
    if (!currentHome?.id || !user?.id) return;
    const { category = null, entityType = null, entityId = null } = meta;
    const actorName = user.name || t("common.userFallback");
    const title = t(titleKey, titleParams);
    const entry = { id: "act-" + uid(), title, titleKey, titleParams, when: new Date().toISOString(), userId: user.id, actorName, category, entityType, entityId };
    dispatch((s) => ({ ...s, activity: [entry, ...(Array.isArray(s.activity) ? s.activity : [])].slice(0, 20) }));
    activityService.logActivity(currentHome.id, user.id, actorName, title, { category, entityType, entityId, titleKey, titleParams }).catch((error) => {
      console.error("Error logging activity:", error);
    });
  };

  const addRoom = (room) => {
    dispatch((s) => ({ ...s, rooms: [...s.rooms, room] }));
    showNotice(t("toast.roomCreated", { name: room.name }));
    logActivity("activity.roomCreated", { name: user?.name, room: room.name }, { entityType: "room", entityId: room.id });
    window.dispatchEvent(new CustomEvent("homemap:onboarding-complete", { detail: { id: "createRoom" } }));
    const continueTo = modal?.payload?.__continueTo;
    if (continueTo) {
      openModal(continueTo.type, { ...continueTo.payload, roomId: room.id });
    } else {
      closeModal();
    }
    homeContentService.createRoom(currentHome.id, room).catch((error) => {
      console.error("Error saving room:", error);
      showNotice(t("toast.roomSaveError"));
    });
  };
  const updateRoom = (roomId, patch) => {
    dispatch((s) => ({ ...s, rooms: s.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r)) }));
    showNotice(t("toast.roomUpdated"));
    homeContentService.updateRoom(roomId, patch).catch((error) => {
      console.error("Error updating room:", error);
      showNotice(t("toast.roomUpdateError"));
    });
  };
  const deleteRoom = (roomId) => {
    const room = state.rooms.find((r) => r.id === roomId);
    if (!room) return;
    // zones/containers cuelgan de la habitación (borrado en cascada en la BD y
    // aquí); los objetos de esa habitación se borran también — no se conservan
    // "sueltos" sin ubicación.
    dispatch((s) => ({
      ...s,
      rooms: s.rooms.filter((r) => r.id !== roomId),
      zones: s.zones.filter((z) => z.roomId !== roomId),
      containers: s.containers.filter((c) => c.roomId !== roomId),
      objects: s.objects.filter((o) => o.roomId !== roomId),
    }));
    showNotice(t("toast.roomDeleted", { name: room.name }));
    homeContentService.deleteRoom(roomId).catch((error) => {
      console.error("Error deleting room:", error);
      showNotice(t("toast.roomDeleteError"));
    });
  };
  /** Pide confirmación antes de borrar la habitación (acción irreversible). */
  const requestDeleteRoom = (roomId) => {
    const room = state.rooms.find((r) => r.id === roomId);
    if (!room) return;
    setConfirmDialog({
      title: t("confirm.deleteRoomTitle"),
      message: t("confirm.deleteRoomMessage", { name: room.name }),
      isDangerous: true,
      confirmLabel: t("confirm.deleteRoomConfirm"),
      onConfirm: () => { setConfirmDialog(null); deleteRoom(roomId); },
      onCancel: () => setConfirmDialog(null),
    });
  };
  const addZone = (zone) => {
    dispatch((s) => ({ ...s, zones: [...s.zones, zone] }));
    showNotice(t("toast.zoneCreated", { name: zone.name }));
    window.dispatchEvent(new CustomEvent("homemap:onboarding-complete", { detail: { id: "createZone" } }));
    closeModal();
    homeContentService.createZone(currentHome.id, zone).catch((error) => {
      console.error("Error saving zone:", error);
      showNotice(t("toast.zoneSaveError"));
    });
  };
  const addContainer = (c) => {
    dispatch((s) => ({ ...s, containers: [...s.containers, c] }));
    showNotice(t("toast.containerCreated", { name: c.name }));
    logActivity("activity.containerCreated", { name: user?.name, box: c.name });
    window.dispatchEvent(new CustomEvent("homemap:onboarding-complete", { detail: { id: "createBox" } }));
    closeModal();
    homeContentService.createContainer(currentHome.id, c).catch((error) => {
      console.error("Error saving container:", error);
      showNotice(t("toast.containerSaveError"));
    });
  };
  const addObject = (o) => {
    const normalized = normalizeLocation(state, o);
    const nextObject = { ...o, ...normalized };
    dispatch((s) => ({ ...s, objects: [...s.objects, nextObject] }));
    showNotice(t("toast.objectSaved", { name: o.name }));
    logActivity("activity.objectAdded", { name: user?.name, item: o.name }, { entityType: "object", entityId: o.id });
    window.dispatchEvent(new CustomEvent("homemap:onboarding-complete", { detail: { id: "addObject" } }));
    closeModal();
    homeContentService.createObject(currentHome.id, nextObject).catch((error) => {
      console.error("Error saving object:", error);
      showNotice(t("toast.objectSaveError"));
    });
  };
  const addShopping = (s2) => {
    dispatch((s) => ({ ...s, shoppingItems: [...s.shoppingItems, s2] }));
    showNotice(t("toast.addedToShoppingList", { name: s2.name }));
    logActivity("activity.shoppingItemAdded", { name: user?.name, item: s2.name });
    closeModal();
    shoppingService.createItem(currentHome.id, s2).catch((error) => {
      console.error("Error saving shopping item:", error);
      showNotice(t("toast.shoppingItemSaveError"));
    });
  };
  const addShoppingList = async (name, suggestedItems = []) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    try {
      const list = await shoppingListsService.createList(currentHome.id, trimmed, (state.shoppingLists || []).length);
      const newItems = suggestedItems.map((item) => ({
        id: "s-" + uid(),
        listId: list.id,
        name: item.name,
        category: item.category || null,
        quantity: 1,
        priority: "week",
        completed: false,
      }));
      dispatch((s) => ({
        ...s,
        shoppingLists: [...(s.shoppingLists || []), list],
        shoppingItems: [...s.shoppingItems, ...newItems],
      }));
      newItems.forEach((item) => {
        shoppingService.createItem(currentHome.id, item).catch((error) => {
          console.error("Error saving suggested shopping item:", error);
        });
      });
      showNotice(t("toast.listCreated", { name: trimmed }));
      const continueTo = modal?.payload?.__continueTo;
      if (continueTo) {
        openModal(continueTo.type, { ...continueTo.payload, listId: list.id });
      } else {
        closeModal();
      }
    } catch (error) {
      console.error("Error creating shopping list:", error);
      showNotice(t("toast.listCreateError"));
    }
  };
  const deleteShoppingList = async (listId) => {
    try {
      await shoppingListsService.deleteList(listId);
      dispatch((s) => ({
        ...s,
        shoppingLists: (s.shoppingLists || []).filter((l) => l.id !== listId),
        shoppingItems: (s.shoppingItems || []).filter((i) => i.listId !== listId),
      }));
    } catch (error) {
      console.error("Error deleting shopping list:", error);
      showNotice(t("toast.listDeleteError"));
    }
  };

  /**
   * Devuelve la primera lista de la compra existente, o crea "General" si la
   * casa todavía no tiene ninguna. Así los productos añadidos desde Tareas
   * (o cualquier alta rápida sin lista explícita) siempre aparecen en algún
   * sitio visible en vez de quedar huérfanos (listId null nunca se muestra
   * en ShoppingModule, que solo lista productos dentro de una lista).
   */
  const ensureDefaultShoppingList = async () => {
    const existing = (state.shoppingLists || [])[0];
    if (existing) return existing;
    const list = await shoppingListsService.createList(currentHome.id, "General", 0);
    dispatch((s) => ({ ...s, shoppingLists: [...(s.shoppingLists || []), list] }));
    return list;
  };

  /**
   * Crea automáticamente el gasto financiero de una compra recién archivada
   * (Compras -> Finanzas): mismo house_id/trigger chain que ya usaba el
   * modal manual de "Registrar gasto", solo que ahora se dispara solo, una
   * única vez, sin que el usuario tenga que reintroducir nada. El índice
   * único parcial de economy_expenses.shopping_purchase_id (migración
   * 20260812_068) es la red de seguridad en base de datos si esto se
   * llamara dos veces por error.
   *
   * financial_space_id no se envía explícitamente: el trigger
   * economy_sync_house_id lo resuelve al espacio 'household' de la casa a
   * partir de house_id. Esto NO es un valor por defecto elegido a falta de
   * algo mejor: es el único financial_space_id que el modelo de datos actual
   * puede asociar a una compra, sin ambigüedad posible.
   *   - shopping_purchases y shopping_lists solo tienen house_id — ninguna
   *     de las dos tablas ha tenido nunca (ni tiene hoy) columna, FK ni
   *     concepto de financial_space_id. Compras es, por diseño actual,
   *     una función de la CASA, no de un espacio financiero: no existe (ni
   *     podría construirse a partir del esquema actual) una compra "del
   *     espacio Personal de Lucas" o "del espacio compartido Viaje" — solo
   *     existe "una compra de esta casa".
   *   - financial_spaces_one_household_per_house (índice único sobre
   *     financial_spaces.house_id where type='household', migración
   *     20260803_022) garantiza que cada casa tiene EXACTAMENTE un espacio
   *     household, creado automáticamente al crear la casa. La resolución
   *     house_id -> espacio household es por tanto 1:1 y determinista, no
   *     una suposición.
   *   - currentSpaceId (el espacio que el usuario tiene seleccionado en el
   *     SpaceSwitcher de Economía) es estado local de EconomyModule, sin
   *     persistencia, y solo existe dentro de esa pantalla — Compras no
   *     tiene ni podría tener acceso a "qué space estás mirando ahora
   *     mismo", pero tampoco lo necesita: aunque lo tuviera, no habría
   *     forma de que una compra perteneciera a un space Personal o
   *     Compartido sin añadir esa relación al esquema, algo que no se ha
   *     pedido ni se implementa aquí.
   * Conclusión: el gasto automático en el espacio Household es correcto y
   * completo para el modelo de datos actual, no una aproximación. Si en el
   * futuro Compras necesita vincularse a espacios Personal/Compartido, es
   * una funcionalidad nueva (añadir financial_space_id a shopping_lists o
   * shopping_purchases) que debe decidirse explícitamente, no inferirse.
   */
  const registerPurchaseExpense = async ({ store, amount, purchaseId }) => {
    try {
      const expense = await economyService.createExpense({
        house_id: currentHome.id,
        created_by: user.id,
        name: store || t("actionCenter.shopping"),
        amount,
        // "Otros", no EXPENSE_CATEGORIES[0]: una compra puede ser de
        // cualquier cosa (ferretería, ropa...) y aquí el usuario no llega a
        // elegir categoría, así que asignar "Alimentación" sería inventarse
        // un dato. El toast ofrece "Editar" para afinarla.
        category: DEFAULT_CATEGORY,
        shopping_purchase_id: purchaseId,
      });
      setEconomyVersion((v) => v + 1);
      showNotice(t("toast.purchaseExpenseAdded", { amount: formatAmount(amount) }), {
        label: t("common.edit"),
        onClick: () => openModal("addExpense", {
          expenseId: expense.id,
          name: expense.name,
          amount: expense.amount,
          category: expense.category,
        }),
      });
    } catch (error) {
      console.error("Error creating linked expense:", error);
      showNotice(t("toast.expenseSaveError"));
    }
  };

  /**
   * Lanza el recibo animado. Solo se llama cuando la compra ya está creada
   * en shopping_purchases: es un efecto puramente visual y no participa en
   * la operación (no se espera, no puede fallarla y no retrasa el gasto
   * automático). El importe se formatea aquí porque este componente vive
   * fuera del CurrencyProvider; si la compra no tiene importe se pasa null y
   * el recibo simplemente no enseña un total.
   */
  const celebratePurchase = ({ listId, store, itemCount, amount }) => {
    const listName = (state?.shoppingLists || []).find((l) => l.id === listId)?.name;
    setPurchaseCelebration({
      id: uid(),
      title: store || listName || null,
      itemCount,
      amountText: amount > 0 ? formatAmount(amount) : null,
    });
  };

  /**
   * Integración Modo compra -> Historial -> Finanzas. Archiva los productos
   * ya marcados como comprados de una lista en shopping_purchases y los
   * retira de la lista activa; si la compra tiene importe, registra el
   * gasto financiero automáticamente (ver registerPurchaseExpense) sin
   * pedirle nada más al usuario.
   */
  const completeShoppingPurchase = async ({ listId, items, store }) => {
    const amount = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    const snapshot = items.map((item) => ({ name: item.name, quantity: item.quantity, category: item.category, price: item.price }));
    try {
      const purchase = await shoppingPurchasesService.createPurchase(currentHome.id, {
        listId, store, amount: amount || null, items: snapshot, createdBy: user.id,
      });
      const purchasedIds = new Set(items.map((item) => item.id));
      dispatch((s) => ({
        ...s,
        shoppingItems: (s.shoppingItems || []).filter((item) => !purchasedIds.has(item.id)),
        shoppingPurchases: [purchase, ...(s.shoppingPurchases || [])],
      }));
      logActivity("activity.purchaseCompleted", { name: user?.name, count: items.length }, { entityType: "shoppingList", entityId: listId });
      celebratePurchase({ listId, store, itemCount: items.length, amount });
      Promise.all(items.map((item) => shoppingService.deleteItem(item.id))).catch((error) => {
        console.error("Error clearing purchased shopping items:", error);
      });
      if (amount > 0) {
        await registerPurchaseExpense({ store, amount, purchaseId: purchase.id });
      } else {
        showNotice(t("toast.purchaseCompleted"));
      }
    } catch (error) {
      console.error("Error archiving shopping purchase:", error);
      showNotice(t("toast.purchaseHistorySaveError"));
    }
  };

  /**
   * Guarda una compra a partir de un ticket escaneado (con foto, impuestos
   * y descuentos). Comparte el mismo cierre del ciclo que
   * completeShoppingPurchase (archivar productos comprados + ofrecer
   * registrar el gasto), pero además sube la foto del ticket y guarda los
   * campos extra detectados.
   */
  const saveScannedPurchase = async ({ store, date, items, taxAmount, discountAmount, total, imageFile, listId, purchasedItemIds }) => {
    const snapshot = items.map((item) => ({ name: item.name, quantity: item.quantity, category: item.category, price: item.unitPrice }));
    try {
      let purchase = await shoppingPurchasesService.createPurchase(currentHome.id, {
        listId,
        store,
        amount: total || null,
        items: snapshot,
        createdBy: user.id,
        taxAmount,
        discountAmount,
        completedAt: date ? new Date(date).toISOString() : undefined,
      });

      if (imageFile) {
        try {
          const path = await uploadReceiptImage(currentHome.id, purchase.id, imageFile);
          purchase = await shoppingPurchasesService.updatePurchase(purchase.id, { receiptImagePath: path });
        } catch (error) {
          console.error("Error subiendo la foto del ticket:", error);
          showNotice(t("toast.receiptUploadError"));
        }
      }

      const purchasedIds = new Set(purchasedItemIds || []);
      dispatch((s) => ({
        ...s,
        shoppingItems: (s.shoppingItems || []).filter((item) => !purchasedIds.has(item.id)),
        shoppingPurchases: [purchase, ...(s.shoppingPurchases || [])],
      }));
      if (purchasedIds.size > 0) {
        Promise.all(Array.from(purchasedIds).map((id) => shoppingService.deleteItem(id))).catch((error) => {
          console.error("Error clearing purchased shopping items:", error);
        });
      }
      celebratePurchase({ listId, store, itemCount: items.length, amount: Number(total) || 0 });

      if (total > 0) {
        await registerPurchaseExpense({ store, amount: Number(total), purchaseId: purchase.id });
      } else {
        showNotice(t("toast.receiptSaved"));
      }
    } catch (error) {
      console.error("Error guardando la compra escaneada:", error);
      showNotice(t("toast.receiptSaveError"));
    }
  };

  /** Vuelve a añadir todos los productos de una compra pasada a una lista. */
  const repeatShoppingPurchase = async (purchase, listId) => {
    try {
      const targetList = listId ? { id: listId } : await ensureDefaultShoppingList();
      const newItems = (purchase.items || []).map((snap) => ({
        id: "s-" + uid(),
        listId: targetList.id,
        name: snap.name,
        category: snap.category || null,
        quantity: snap.quantity || 1,
        price: snap.price ?? "",
        priority: "week",
        completed: false,
      }));
      dispatch((s) => ({ ...s, shoppingItems: [...(s.shoppingItems || []), ...newItems] }));
      showNotice(t("toast.productsReaddedToList"));
      closeModal();
      await Promise.all(newItems.map((item) => shoppingService.createItem(currentHome.id, item)));
    } catch (error) {
      console.error("Error repeating shopping purchase:", error);
      showNotice(t("toast.productsReaddError"));
    }
  };

  /**
   * Borra la fila de shopping_purchases y limpia el estado local. El gasto
   * vinculado (si lo hay) ya se ha resuelto antes de llegar aquí — ver
   * deleteShoppingPurchase: por la FK on delete set null, si el gasto sigue
   * vivo simplemente pierde la referencia solo.
   */
  const performDeletePurchase = async (purchaseId) => {
    try {
      await shoppingPurchasesService.deletePurchase(purchaseId);
      dispatch((s) => ({
        ...s,
        shoppingPurchases: (s.shoppingPurchases || []).filter((p) => p.id !== purchaseId),
      }));
      showNotice(t("toast.purchaseDeleted"));
    } catch (error) {
      console.error("Error deleting shopping purchase:", error);
      showNotice(t("toast.purchaseDeleteError"));
    }
  };

  /**
   * Elimina una compra del historial (no afecta a la lista activa). Si tiene
   * un gasto financiero vinculado (shopping_purchase_id), pregunta primero
   * qué hacer con él en vez de dejarlo huérfano en silencio.
   *
   * La comprobación previa (getExpenseByPurchaseId) puede fallar por red o
   * por la propia consulta — ese fallo NUNCA debe tratarse como "no tiene
   * gasto vinculado": si no podemos comprobarlo con certeza, no borramos la
   * compra y avisamos al usuario, en vez de arriesgarnos a dejar un gasto
   * huérfano sin que nadie llegue a preguntarlo.
   */
  const deleteShoppingPurchase = async (purchaseId) => {
    let linkedExpense;
    try {
      linkedExpense = await economyService.getExpenseByPurchaseId(purchaseId);
    } catch (error) {
      console.error("Error checking linked expense before delete:", error);
      showNotice(t("toast.purchaseDeleteCheckError"));
      return;
    }

    if (linkedExpense) {
      setConfirmDialog({
        title: t("confirm.purchaseHasExpenseTitle"),
        message: t("confirm.purchaseHasExpenseMessage", { amount: formatAmount(linkedExpense.amount) }),
        isDangerous: true,
        confirmLabel: t("confirm.deletePurchaseAndExpense"),
        extraAction: {
          label: t("confirm.keepExpenseOnly"),
          onClick: () => {
            setConfirmDialog(null);
            performDeletePurchase(purchaseId);
          },
        },
        onConfirm: async () => {
          setConfirmDialog(null);
          const deleted = await economyService.deleteExpense(linkedExpense.id);
          if (!deleted) {
            showNotice(t("toast.expenseDeleteError"));
            return;
          }
          setEconomyVersion((v) => v + 1);
          performDeletePurchase(purchaseId);
        },
        onCancel: () => setConfirmDialog(null),
      });
      return;
    }

    performDeletePurchase(purchaseId);
  };
  const addNote = (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    const note = { id: "note-" + uid(), text: trimmed, pinned: false, done: false, createdAt: Date.now() };
    dispatch((s) => ({ ...s, notes: [...(s.notes || []), note] }));
    showNotice(t("toast.noteSaved"));
    logActivity("activity.noteAdded", { name: user?.name });
    closeModal();
    notesService.createNote(currentHome.id, note).catch((error) => {
      console.error("Error saving note:", error);
      showNotice(t("toast.noteSaveError"));
    });
  };
  const updateCategories = (nextCategories) => {
    const next = Array.isArray(nextCategories) ? nextCategories : [];
    dispatch((s) => ({ ...s, categories: next }));
    categoriesService.replaceCategories(currentHome.id, next).catch((error) => {
      console.error("Error saving categories:", error);
      showNotice(t("toast.categoriesSaveError"));
    });
  };

  const setTaskRetentionDays = (value) => {
    const days = Math.max(1, Math.round(Number(value)) || DEFAULT_TASK_RETENTION_DAYS);
    dispatch((current) => ({
      ...current,
      settings: { ...current.settings, taskRetentionDays: days },
    }));
  };

  /* -------------------- New add handlers for Action Center -------------------- */
  const addTask = (taskData) => {
    const next = { id: "task-" + uid(), status: "pending", ...taskData };
    dispatch((s) => ({ ...s, tasks: [...(s.tasks || []), next] }));
    showNotice(t("toast.taskCreated", { title: taskData.title }));
    logActivity("activity.taskCreated", { name: user?.name, task: taskData.title }, { entityType: "task", entityId: next.id });
    closeModal();
    taskService.createTask(currentHome.id, next).catch((error) => {
      console.error("Error saving task:", error);
      showNotice(t("toast.taskSaveError"));
    });
  };

  /**
   * Solo registra actividad (sin toast ni cambio visible): TasksModule ya
   * hace su propio toggle optimista de estado/completedAt, esto únicamente
   * añade el rastro para poder contar "tareas completadas" por miembro en
   * la pantalla de información del miembro.
   */
  const logTaskCompleted = (task) => {
    logActivity("activity.taskCompleted", { name: user?.name, task: task?.title }, { entityType: "taskCompleted", entityId: task?.id });
  };
  const editTask = (taskId, patch) => {
    dispatch((s) => ({
      ...s,
      tasks: (s.tasks || []).map((task) => task.id === taskId ? { ...task, ...patch } : task),
    }));
    showNotice(t("toast.taskUpdated"));
    closeModal();
    taskService.updateTask(taskId, patch).catch((error) => {
      console.error("Error updating task:", error);
      showNotice(t("toast.taskUpdateError"));
    });
  };

  const addBill = (b) => {
    setEconomyVersion((v) => v + 1);
    // Se genera aquí (en vez de dejar que la DB use su default) para poder
    // enlazar ya mismo esta entrada de actividad con la factura, antes de
    // que exista la fila — así una notificación futura de esa factura
    // (p.ej. "vence pronto", que referencia bill.id) puede encontrarla.
    const billId = crypto.randomUUID();
    showNotice(t("toast.billAdded", { name: b.name }));
    logActivity("activity.billCreated", { name: user?.name, bill: b.name }, { category: "finanzas", entityType: "bill", entityId: billId });
    closeModal();
    economyService.createBill({
      id: billId,
      house_id: currentHome.id,
      created_by: user.id,
      name: b.name,
      amount: b.amount,
      due_date: b.dueDate || toLocalDateString(new Date()),
      category: b.category || DEFAULT_CATEGORY,
      frequency: b.frequency || "once",
    }).catch((error) => {
      console.error("Error creating bill:", error);
      showNotice(t("toast.billSaveError"));
    });
  };

  /**
   * Alta manual de un gasto (Movimientos): dinero que sale, sin lista ni
   * productos detrás. NUNCA escribe shopping_purchase_id — el único camino
   * que puede vincular un gasto con una compra es registerPurchaseExpense,
   * disparado desde Compras al cerrar una compra con importe > 0. Así la
   * separación conceptual (Compras = qué he comprado / Movimientos = qué ha
   * pasado con mi dinero) también es una invariante del código, y no solo
   * de la UI: no existe forma de crear "a mano" un gasto que finja venir de
   * una compra, ni de generar un segundo gasto para una compra que ya tiene
   * el suyo.
   */
  const addExpense = (e) => {
    setEconomyVersion((v) => v + 1);
    showNotice(t("toast.expenseRegistered", { name: e.name || (e.amount ? formatAmount(e.amount) : '') }));
    closeModal();
    economyService.createExpense({
      house_id: currentHome.id,
      created_by: user.id,
      name: e.name,
      amount: e.amount,
      category: e.category || DEFAULT_CATEGORY,
    }).catch((error) => {
      console.error("Error creating expense:", error);
      showNotice(t("toast.expenseSaveError"));
    });
  };

  /**
   * Modo edición del modal "addExpense" — usado por la acción "Editar" del
   * toast que aparece tras registrar automáticamente el gasto de una compra
   * (ver registerPurchaseExpense). Nunca crea una fila nueva: siempre
   * actualiza el gasto ya existente, así que shopping_purchase_id no se
   * toca (el vínculo con la compra se conserva tal cual).
   */
  const updateExpenseFromModal = async (expenseId, updates) => {
    closeModal();
    const result = await economyService.updateExpense(expenseId, updates);
    if (!result) {
      showNotice(t("toast.expenseSaveError"));
      return;
    }
    setEconomyVersion((v) => v + 1);
    showNotice(t("toast.expenseRegistered", { name: updates.name || (updates.amount ? formatAmount(updates.amount) : '') }));
  };

  /**
   * Alta de un ingreso. Su única UI es AddMovementModal (el interruptor
   * Gasto/Ingreso): el modal suelto "addIncome" que existía aquí estaba
   * muerto — ningún openModal lo abría — y era un segundo formulario para
   * lo mismo, así que se ha eliminado en vez de dejarlo como vía paralela.
   */
  const addIncome = (inc) => {
    setEconomyVersion((v) => v + 1);
    showNotice(t("toast.incomeRegistered", { name: inc.name || (inc.amount ? formatAmount(inc.amount) : '') }));
    closeModal();
    economyService.createIncome({
      house_id: currentHome.id,
      created_by: user.id,
      name: inc.name,
      amount: inc.amount,
      category: inc.category || DEFAULT_CATEGORY,
    }).catch((error) => {
      console.error("Error creating income:", error);
      showNotice(t("toast.incomeSaveError"));
    });
  };
  const updateObject = (objectId, patch) => {
    dispatch((s) => ({
      ...s,
      objects: s.objects.map((o) => (o.id === objectId ? { ...o, ...patch } : o)),
    }));
    homeContentService.updateObject(objectId, patch).catch((error) => {
      console.error("Error updating object:", error);
      showNotice(t("toast.objectUpdateError"));
    });
  };
  const deleteObject = (id) => {
    const deletedName = state.objects.find((o) => o.id === id)?.name || t("toast.defaultObjectName");
    dispatch((s) => ({ ...s, objects: s.objects.filter((o) => o.id !== id) }));
    showNotice(t("toast.objectDeleted", { name: deletedName }));
    setRoute({ tab: "inicio" });
    homeContentService.deleteObject(id).catch((error) => {
      console.error("Error deleting object:", error);
      showNotice(t("toast.objectDeleteError"));
    });
  };
  const moveObject = (objectId, nextLocation) => {
    let persistedPatch = null;
    dispatch((s) => {
      const nextState = {
        ...s,
        objects: s.objects.map((o) => {
          if (o.id !== objectId) return o;
          const normalized = normalizeLocation(s, { ...o, ...nextLocation });
          const nextPath = locationPath(s, { ...o, ...normalized });
          const locationHistory = [
            ...(o.locationHistory || []),
            { date: toLocalDateString(new Date()), path: nextPath },
          ];
          persistedPatch = { ...normalized, locationHistory };
          return { ...o, ...normalized, locationHistory };
        }),
      };
      return nextState;
    });
    showNotice(t("toast.locationUpdated"));
    if (persistedPatch) {
      homeContentService.updateObject(objectId, persistedPatch).catch((error) => {
        console.error("Error moving object:", error);
        showNotice(t("toast.locationSaveError"));
      });
    }
  };
  const importScanned = (detections) => {
    let newObjects = [];
    dispatch((s) => {
      newObjects = detections.map((d) => {
        const rawObject = {
          id: "o-" + uid(),
          name: d.name,
          category: d.category || "Otros",
          description: "",
          roomId: d.roomId ?? s.rooms[0]?.id ?? null,
          zoneId: d.zoneId ?? null,
          containerId: d.containerId ?? null,
          purchaseDate: "",
          price: "",
          notes: d.notes || `Importado con IA desde escaneo de espacio (confianza ${Math.round((d.confidence ?? 0.75) * 100)}%).`,
          createdAt: toLocalDateString(new Date()),
          photo: null,
          locationHistory: [],
        };
        return {
          ...rawObject,
          ...normalizeLocation(s, rawObject),
        };
      });
      return { ...s, objects: [...s.objects, ...newObjects] };
    });
    showNotice(t("toast.objectsImported", { count: detections.length }));
    homeContentService.insertObjects(currentHome.id, newObjects).catch((error) => {
      console.error("Error saving scanned objects:", error);
      showNotice(t("toast.scannedObjectsSaveError"));
    });
  };

  const updateProfile = (patch) => {
    dispatch((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  };

  const toggleNotificationCategory = (category) => {
    dispatch((s) => ({
      ...s,
      settings: {
        ...s.settings,
        notifications: {
          ...s.settings.notifications,
          categories: {
            ...s.settings.notifications.categories,
            [category]: !s.settings.notifications.categories[category],
          },
        },
      },
    }));
  };

  const setNotificationLevel = (level) => {
    dispatch((s) => ({
      ...s,
      settings: {
        ...s.settings,
        notifications: { ...s.settings.notifications, level },
      },
    }));
  };

  const handleChangePassword = async (newPassword) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      securityEventsService.logSecurityEvent("auth_password_change");
      showNotice(t("toast.passwordChanged"));
      return true;
    } catch (error) {
      showNotice(error?.message || t("toast.passwordChangeError"));
      return false;
    }
  };

  /**
   * "Exportar datos" antes solo volcaba `state`, que NO incluye facturas ni
   * gastos/ingresos (economy_bills/economy_expenses/economy_income nunca se
   * cargan en el estado global, ver CalendarModule.jsx) y cuyo `members`
   * era una lista de ejemplo hardcodeada (DEMO_MEMBERS), no los miembros
   * reales de la casa. Se piden aparte (misma fuente que usa el resto de la
   * app: economyService/houseService) y se fusionan antes de exportar.
   */
  const handleExportData = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const [bills, expenses, income, members] = await Promise.all([
        economyService.getAllBills(currentHome.id).catch((e) => { console.error("Error exportando facturas:", e); return []; }),
        economyService.getAllExpenses(currentHome.id, 100000).catch((e) => { console.error("Error exportando gastos:", e); return []; }),
        economyService.getAllIncome(currentHome.id, 100000).catch((e) => { console.error("Error exportando ingresos:", e); return []; }),
        houseService.getHouseMembers(currentHome.id).catch((e) => { console.error("Error exportando miembros:", e); return []; }),
      ]);

      const exportData = {
        ...state,
        members,
        house: { id: currentHome.id, name: currentHome.name, inviteCode: currentHome.inviteCode },
        economy: { bills, expenses, income },
        exportedAt: new Date().toISOString(),
      };
      delete exportData.activity; // era una lista de ejemplo, no actividad real de la casa
      delete exportData.bills; // siempre vacío en `state` (ver comentario arriba); las reales están en `economy.bills`

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "haven-datos.json"; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const locale = state.profile?.language || "es";
  const themeMode = state.profile?.theme || (state.profile?.darkMode ? "dark" : "system");
  const effectiveTheme = themeMode === "system" ? (prefersDark ? "dark" : "light") : themeMode;
  const isDarkMode = effectiveTheme === "dark";

  const visibleNav = canSeeEconomy ? NAV : NAV.filter((n) => n.key !== "economia");

  return (
    <CurrencyProvider code={activeHome?.currency_code}>
      <div className={"hm-root" + (isDarkMode ? " dark" : "")} style={{ padding: "16px 14px 88px" }}>
        <GlobalStyle />
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 24, alignItems: "flex-start" }}>
          <div className="hm-desktop-sidebar">
          <Sidebar
            active={route.tab === "objectDetail" ? (prevTab || "inicio") : route.tab}
            onSelect={selectTab}
            homeName={currentHome.name}
            darkMode={isDarkMode}
            user={user}
            nav={visibleNav}
            onOpenHomeSelector={() => openModal("homeSelector")}
            onToggleDark={() => updateProfile({ theme: effectiveTheme === "dark" ? "light" : "dark" })}
          />
        </div>

        <ToastHost notice={notice} onDismiss={() => setNotice(null)} />

        {/* `key` remonta la animación si se completa otra compra mientras
            aún se está reproduciendo, en vez de dejarla a medias. */}
        {purchaseCelebration && (
          <PurchaseCompleteAnimation
            key={purchaseCelebration.id}
            title={purchaseCelebration.title}
            itemCount={purchaseCelebration.itemCount}
            amountText={purchaseCelebration.amountText}
            onDone={() => setPurchaseCelebration(null)}
          />
        )}

        <div className="hm-scroll" style={{ flex: 1, minWidth: 0, height: "calc(100svh - 104px)", overflowY: "auto", paddingRight: 4, WebkitOverflowScrolling: "touch" }}>
          <AppHeader
            user={user}
            profile={state.profile}
            currentHome={currentHome}
            onOpenHomeSelector={() => openModal("homeSelector")}
            onOpenNotifications={() => openModal("notifications")}
            onOpenAccountHub={() => openModal("accountHub")}
            onOpenSearch={() => openModal("globalSearch")}
            unreadNotifications={notifications.filter((n) => n.status === "unread").length}
            showNotifications={canSeeEconomy}
          />
          {/* padding horizontal único para todas las pestañas (Inicio/Hogar/
              Organización/Economía/Perfil) — un solo valor aquí en vez de que
              cada módulo defina el suyo por separado. */}
          <div key={route.tab} className="hm-fade-in" style={{ display: "grid", gap: 16, padding: "0 4px 6px" }}>
            {/* 🏠 INICIO - Dashboard */}
            {route.tab === "inicio" && (
              <Dashboard
                state={state}
                goTo={goTo}
                openModal={openModal}
                canSeeEconomy={canSeeEconomy}
                currentHome={currentHome}
                houseMembers={houseMembers}
                notifications={notifications}
              />
            )}
             
            {/* 🏡 HOGAR - Rooms, Zones, Containers, Objects
                Una caja abierta (`cajasView.containerId`) se pinta en lugar de
                MiCasa dentro del MISMO pilar: `goTo({tab:"cajas"})` normaliza a
                "hogar" (ver mapTabToNewPillar), así que no existe una ruta
                "cajas" propia donde montar <Cajas>. Al cerrar la caja, Cajas
                hace setView({}) y se vuelve solo a la habitación de la que se
                vino, que sigue intacta en `micasaView`. */}
            {route.tab === "hogar" && (
              cajasView?.containerId
                ? <Cajas state={state} view={cajasView} setView={setCajasView} openModal={openModal} goTo={goTo} onUpdateObject={updateObject} />
                : <MiCasa state={state} dispatch={dispatch} view={micasaView} setView={setMicasaView} openModal={openModal} goTo={goTo} onUpdateObject={updateObject} onUpdateCategories={updateCategories} onUpdateRoom={updateRoom} onDeleteRoom={requestDeleteRoom} />
            )}

            {/* ✅ ORGANIZACIÓN - Shopping, Tasks, Calendar */}
            {route.tab === "organizacion" && (
              <h1 className="hm-display" style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>{t("nav.organizacion")}</h1>
            )}
            {route.tab === "organizacion" && (
              // Grid fijo de 2 columnas (no auto-fit) — igual que en Economía:
              // con auto-fit el número de columnas que caben a ancho de móvil
              // está justo en el límite entre 2 y 3, y una variación mínima del
              // ancho del contenedor hace que el grid "salte" entre layouts.
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 4 }}>
                {[
                  { key: "compras", label: t("nav.compras"), Icon: ShoppingCart },
                  { key: "tareas", label: t("nav.tareas"), Icon: CheckSquare },
                  { key: "notas", label: t("nav.notas"), Icon: StickyNote },
                  { key: "calendario", label: t("nav.calendario"), Icon: Calendar },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setOrganizationTab(tab.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: organizationTab === tab.key ? "var(--accent)" : "var(--surface-alt)",
                      color: organizationTab === tab.key ? "var(--accent-ink)" : "var(--ink)",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 13,
                      whiteSpace: "nowrap",
                      textAlign: "center",
                    }}
                  >
                    <tab.Icon size={15} /> {tab.label}
                  </button>
                ))}
              </div>
            )}
            {route.tab === "organizacion" && (
              // minWidth: 0 — mismo motivo que en EconomyModule.jsx: este div es un
              // item del grid de la ruta (línea ~3363) y sin esto un texto largo sin
              // espacios en Compras/Tareas/Notas podría ensanchar toda la pantalla en
              // vez de truncarse.
              <div key={organizationTab} className="hm-fade-in" style={{ minWidth: 0 }}>
                <Suspense fallback={null}>
                  {organizationTab === "compras" && <Compras state={state} dispatch={dispatch} openModal={openModal} deleteShoppingList={deleteShoppingList} addShopping={addShopping} onCompletePurchase={completeShoppingPurchase} onRepeatPurchase={repeatShoppingPurchase} onSaveReceiptPurchase={saveScannedPurchase} />}
                  {organizationTab === "tareas" && <Tareas state={state} dispatch={dispatch} openModal={openModal} onTaskCompleted={logTaskCompleted} />}
                  {organizationTab === "notas" && <Notas state={state} dispatch={dispatch} openModal={openModal} />}
                  {organizationTab === "calendario" && <Calendario state={state} currentHome={currentHome} canSeeEconomy={canSeeEconomy} />}
                </Suspense>
              </div>
            )}

            {/* 💰 ECONOMÍA - Bills and Finance (solo admin/adult; RLS lo aplica también en el servidor) */}
            {route.tab === "economia" && canSeeEconomy && <Suspense fallback={null}><EconomyModule state={state} dispatch={dispatch} openModal={openModal} currentHome={currentHome} user={user} refreshToken={economyVersion} /></Suspense>}
            {route.tab === "economia" && !canSeeEconomy && (
              <div className="hm-card hm-card--p24 hm-card--center">
                <ShieldCheck size={26} style={{ color: "var(--accent)", marginBottom: 10 }} />
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("economy.restrictedAccessTitle")}</div>
                <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>{t("economy.adultsOnlyNotice")}</div>
              </div>
            )}

            {/* Nota: aquí vivía un bloque "BACKWARDS COMPATIBILITY" que
                comprobaba route.tab contra las claves antiguas (micasa,
                cajas, compras, tareas, calendario). Era código muerto:
                goTo/selectTab normalizan SIEMPRE la clave con
                mapTabToNewPillar antes de setRoute, y los únicos setRoute
                directos usan "inicio" o prevTab (que ya guarda valores
                normalizados), así que route.tab nunca puede tomar ninguna de
                ellas. La compatibilidad real la da mapTabToNewPillar, no
                estas ramas. */}

            {/* Object Detail */}
            {route.tab === "objectDetail" && <ObjectDetail state={state} objectId={route.objectId} onBack={() => setRoute({ tab: prevTab || "inicio" })} onDelete={deleteObject} onMove={moveObject} onUpdateObject={updateObject} dispatch={dispatch} />}
          </div>
        </div>
      </div>

      <div className="hm-mobile-nav">
        {route.tab !== "perfil" && (
          <ActionCenter currentTab={route.tab} openModal={openModal} currentHome={state} canSeeEconomy={canSeeEconomy} position={"corner"} />
        )}
        <BottomNav active={route.tab === "objectDetail" ? (prevTab || "inicio") : route.tab} onSelect={selectTab} nav={visibleNav} />
      </div>

      {modal?.type === "accountHub" && (
        <Suspense fallback={null}>
          <AccountHub
            state={state}
            currentHome={activeHome || currentHome}
            houseMembers={houseMembers}
            user={user}
            onUpdateProfile={updateProfile}
            onRenameHouse={handleRenameHouse}
            onChangePassword={handleChangePassword}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
            onImportData={handleImportData}
            onExportData={handleExportData}
            isExporting={isExporting}
            locale={locale}
            theme={themeMode}
            notifications={state.settings.notifications}
            currency={activeHome?.currency_code || "EUR"}
            onChangeLanguage={(nextLocale) => updateProfile({ language: nextLocale })}
            onChangeTheme={(nextTheme) => updateProfile({ theme: nextTheme })}
            onToggleNotificationCategory={toggleNotificationCategory}
            onChangeNotificationLevel={setNotificationLevel}
            onChangeCurrency={handleChangeCurrency}
            isCurrencyLoading={currencyLoading}
            build={APP_BUILD}
            openModal={openModal}
            onClose={closeModal}
            version={APP_VERSION}
          />
        </Suspense>
      )}
      {modal?.type === "securityCenter" && (
        <Suspense fallback={null}>
          <SecurityCenter onClose={closeModal} />
        </Suspense>
      )}
      {modal?.type === "houseSettings" && (
        <Suspense fallback={null}>
          <HouseSettingsScreen
            house={activeHome || currentHome}
            members={houseMembers}
            currentUserId={user?.id}
            currency={activeHome?.currency_code || "EUR"}
            onChangeCurrency={handleChangeCurrency}
            onChangeMemberRole={handleChangeMemberRole}
            onRemoveMember={handleRemoveHouseMember}
            onMemberClick={setViewingMember}
            categories={state.categories}
            onChangeCategories={updateCategories}
            taskRetentionDays={Number(state?.settings?.taskRetentionDays) || DEFAULT_TASK_RETENTION_DAYS}
            onChangeTaskRetention={setTaskRetentionDays}
            onClose={closeModal}
            isCurrencyLoading={currencyLoading}
            onDeleteHouse={handleDeleteHouse}
          />
        </Suspense>
      )}
      {viewingMember && (
        <Suspense fallback={null}>
          <MemberDetailScreen
            member={viewingMember}
            houseId={(activeHome || currentHome)?.id}
            viewerRole={currentHome?.myRole}
            viewerUserId={user?.id}
            onChangeRole={(memberId, role) => handleChangeMemberRole(memberId, role).then(() => setViewingMember((m) => (m ? { ...m, role } : m)))}
            onChangeEconomyAccess={handleChangeMemberEconomyAccess}
            onTransferOwnership={handleTransferOwnership}
            onRemoveMember={confirmRemoveMemberFromDetail}
            onClose={() => setViewingMember(null)}
          />
        </Suspense>
      )}
      {modal?.type === "notifications" && (
        <NotificationsModal
          notifications={notifications}
          activity={state.activity}
          onAction={handleNotificationAction}
          onDelete={deleteNotification}
          onMarkAllRead={markAllNotificationsRead}
          onClose={closeModal}
        />
      )}
      {modal?.type === "privacy" && <PrivacyModal onClose={closeModal} />}
      {modal?.type === "terms" && <TermsModal onClose={closeModal} />}
      {modal?.type === "homeSelector" && (
        <Modal title={null} onClose={closeModal}>
          <HomeSelector
            homes={homes}
            currentHomeId={currentHomeId}
            onSelect={(id) => { setCurrentHomeId(id); closeModal(); }}
            onOpenCreate={() => openModal("createHome", null, { returnTo: "homeSelector" })}
            onJoin={joinHome}
            onClose={closeModal}
            canCreateHome={homes.filter((h) => h.createdByMe).length < MAX_HOMES_PER_USER}
          />
        </Modal>
      )}
      {modal?.type === "createHome" && (
        <div className="hm-root">
          <GlobalStyle />
          <WelcomeGate initialStep="create" onCreateHouse={createHome} onCancel={closeModal} />
        </div>
      )}
      {modal?.type === "globalSearch" && (
        <Modal title={t("search.title")} onClose={closeModal} wide>
          <GlobalSearchModal
            state={state}
            houseId={currentHome?.id}
            canSeeEconomy={canSeeEconomy}
            members={houseMembers}
            getPath={getEntityPath}
            goTo={goTo}
            onOpenMembers={() => openModal("houseSettings")}
            onClose={closeModal}
          />
        </Modal>
      )}

          {modal?.type === "shareHome" && (
            <Modal title={t("home.shareTitle")} onClose={closeModal}>
              <ShareHomeModal
                home={currentHome}
                members={shareMembers.map((m) => ({
                  id: m.user_id,
                  name: m.name,
                  role: m.role,
                  isYou: m.user_id === user?.id,
                }))}
                currentUserRole={currentHome.myRole}
                onRegenerateInviteCode={() => handleRegenerateInviteCode(currentHome.id)}
                onRemoveMember={async (memberId) => {
                  try {
                    await houseService.removeMember(currentHome.id, memberId);
                    setShareMembers(await houseService.getHouseMembers(currentHome.id));
                    await refreshHomes();
                    showNotice(t("toast.memberRemoved"));
                  } catch (error) {
                    showNotice(error.message || t("toast.memberRemoveError"));
                  }
                }}
                onChangeRole={async (memberId, newRole) => {
                  try {
                    await houseService.setMemberRole(currentHome.id, memberId, newRole);
                    setShareMembers(await houseService.getHouseMembers(currentHome.id));
                    showNotice(t("toast.roleUpdated"));
                  } catch (error) {
                    showNotice(error.message || t("toast.roleUpdateError"));
                  }
                }}
              />
            </Modal>
          )}

      {modal?.type === "addRoom" && <AddRoomWizard onClose={closeModal} onSave={addRoom} />}
      {modal?.type === "addZone" && <AddZoneModal roomId={modal.payload?.roomId || state.rooms[0]?.id} onClose={closeModal} onSave={addZone} />}
      {modal?.type === "addContainer" && (
        <AddContainerWizard state={state} onClose={closeModal} onSave={addContainer} defaults={modal.payload} />
      )}
      {modal?.type === "addObject" && <AddObjectWizard state={state} defaults={modal.payload} onClose={closeModal} onSave={addObject} />}
      {modal?.type === "addShopping" && <AddShoppingModal onClose={closeModal} onSave={(item) => addShopping({ ...item, listId: modal.payload?.listId || null })} /> }

      {/* El modal "editCategories" se quitó al sacar las categorías de las
          listas de la compra: sus dos únicos accesos estaban ahí. Las
          categorías se siguen gestionando (y se siguen usando en el
          inventario) desde Configuración de la casa, que monta el mismo
          CategoriesSection. */}

      {modal?.type === "addTask" && (
        <Modal title={t("quickAdd.createTaskTitle")} onClose={closeModal}>
          <label className="hm-label">{t("quickAdd.titleLabel")}</label>
          <input className="hm-input" id="ac-task-title" />
          <label className="hm-label" style={{ marginTop: 12 }}>{t("quickAdd.descriptionLabel")}</label>
          <input className="hm-input" id="ac-task-desc" />
          <label className="hm-label" style={{ marginTop: 12 }}>{t("quickAdd.dateLabel")}</label>
          <input className="hm-input" type="date" id="ac-task-date" />
          <label className="hm-label" style={{ marginTop: 12 }}>{t("quickAdd.assignedLabel")}</label>
          <MemberPicker id="ac-task-assignee" members={houseMembers.length ? houseMembers : state.members} selected={[]} />
          <label className="hm-label" style={{ marginTop: 12 }}>{t("quickAdd.repeatLabel")}</label>
          <select className="hm-input" id="ac-task-repeat" defaultValue="none">
            {REPEAT_OPTIONS.map((r) => <option key={r} value={r}>{t(repeatLabelKey(r))}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="hm-btn hm-btn-soft" onClick={closeModal}>{t("quickAdd.cancel")}</button>
            <button className="hm-btn hm-btn-primary" onClick={() => {
              const title = document.getElementById("ac-task-title").value || t("quickAdd.defaultTaskTitle");
              const description = document.getElementById("ac-task-desc").value || "";
              const date = document.getElementById("ac-task-date").value;
              const assignee = Array.from(document.querySelectorAll("#ac-task-assignee input:checked")).map((el) => el.value).join(", ");
              const repeatSel = document.getElementById("ac-task-repeat").value;
              const repeat = repeatSel === "none" ? null : repeatSel;
              addTask({ title, description, date, assignee, repeat });
            }}>{t("quickAdd.create")}</button>
          </div>
        </Modal>
      )}

      {modal?.type === "editTask" && (
        <Modal title={t("quickAdd.editTaskTitle")} onClose={closeModal}>
          <label className="hm-label">{t("quickAdd.titleLabel")}</label>
          <input className="hm-input" id="ac-edit-task-title" defaultValue={modal.payload?.title || ""} />
          <label className="hm-label" style={{ marginTop: 12 }}>{t("quickAdd.descriptionLabel")}</label>
          <input className="hm-input" id="ac-edit-task-desc" defaultValue={modal.payload?.description || ""} />
          <label className="hm-label" style={{ marginTop: 12 }}>{t("quickAdd.priorityLabel")}</label>
          <select className="hm-input" id="ac-edit-task-priority" defaultValue={modal.payload?.priority || "normal"}>
            <option value="baja">{t("quickAdd.priorityLow")}</option>
            <option value="normal">{t("quickAdd.priorityNormal")}</option>
            <option value="alta">{t("quickAdd.priorityHigh")}</option>
          </select>
          <label className="hm-label" style={{ marginTop: 12 }}>{t("quickAdd.assignedLabel")}</label>
          <MemberPicker
            id="ac-edit-task-assignee"
            members={houseMembers.length ? houseMembers : state.members}
            selected={(modal.payload?.assignee || "").split(",").map((n) => n.trim()).filter(Boolean)}
          />
          <label className="hm-label" style={{ marginTop: 12 }}>{t("quickAdd.dateLabel")}</label>
          <input className="hm-input" type="date" id="ac-edit-task-date" defaultValue={modal.payload?.date || ""} />
          <label className="hm-label" style={{ marginTop: 12 }}>{t("quickAdd.repeatLabel")}</label>
          <select className="hm-input" id="ac-edit-task-repeat" defaultValue={REPEAT_OPTIONS.includes(modal.payload?.repeat) ? modal.payload.repeat : "none"}>
            {REPEAT_OPTIONS.map((r) => <option key={r} value={r}>{t(repeatLabelKey(r))}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="hm-btn hm-btn-soft" onClick={closeModal}>{t("quickAdd.cancel")}</button>
            <button className="hm-btn hm-btn-primary" onClick={() => {
              const title = document.getElementById("ac-edit-task-title").value || t("quickAdd.defaultTaskTitle");
              const description = document.getElementById("ac-edit-task-desc").value || "";
              const priority = document.getElementById("ac-edit-task-priority").value;
              const assignee = Array.from(document.querySelectorAll("#ac-edit-task-assignee input:checked")).map((el) => el.value).join(", ");
              const date = document.getElementById("ac-edit-task-date").value;
              const repeatSel = document.getElementById("ac-edit-task-repeat").value;
              const repeat = repeatSel === "none" ? null : repeatSel;
              editTask(modal.payload.id, { title, description, priority, assignee, date, repeat });
            }}>{t("quickAdd.saveChanges")}</button>
          </div>
        </Modal>
      )}

      {modal?.type === "addNote" && (
        <Modal title={t("quickAdd.newNoteTitle")} onClose={closeModal}>
          <label className="hm-label">{t("quickAdd.noteLabel")}</label>
          <textarea className="hm-input" rows={3} id="ac-note-text" />
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="hm-btn hm-btn-soft" onClick={closeModal}>{t("quickAdd.cancel")}</button>
            <button className="hm-btn hm-btn-primary" onClick={() => {
              const text = document.getElementById("ac-note-text").value;
              addNote(text);
            }}>{t("quickAdd.save")}</button>
          </div>
        </Modal>
      )}

      {modal?.type === "addShoppingList" && (
        <AddShoppingListModal
          purchases={state.shoppingPurchases}
          onCreate={(name, suggestedItems) => addShoppingList(name, suggestedItems)}
          onClose={closeModal}
        />
      )}

      {modal?.type === "dependencyGate" && modal.payload.missing.createModal === "houseGate" && (
        <div className="hm-root">
          <GlobalStyle />
          <WelcomeGate
            title={t(modal.payload.missing.title)}
            subtitle={t(modal.payload.missing.description)}
            onCancel={closeModal}
            onCreateHouse={async (name, template) => {
              const target = modal.payload.target;
              await createHomeFromGate(name, template);
              if (target) openModal(target.type, target.payload); else closeModal();
            }}
            onJoinHouse={async (code) => {
              const target = modal.payload.target;
              await joinHomeFromGate(code);
              if (target) openModal(target.type, target.payload); else closeModal();
            }}
          />
        </div>
      )}

      {modal?.type === "dependencyGate" && modal.payload.missing.createModal !== "houseGate" && (
        <Modal onClose={closeModal}>
          <DependencyGateModal
            meta={modal.payload.missing}
            onCancel={closeModal}
            onProceed={() => openModal(modal.payload.missing.createModal, { __continueTo: modal.payload.target })}
          />
        </Modal>
      )}

      {modal?.type === "shoppingHistory" && (
        <Modal title={t("quickAdd.purchaseHistoryTitle")} onClose={closeModal} wide>
          <Suspense fallback={null}>
            <ShoppingHistory
              purchases={(state.shoppingPurchases || []).filter((p) => !modal.payload?.listId || p.listId === modal.payload.listId)}
              onRepeat={(purchase) => repeatShoppingPurchase(purchase, modal.payload?.listId)}
              onDelete={deleteShoppingPurchase}
            />
          </Suspense>
        </Modal>
      )}

      {modal?.type === "addBill" && (
        <Modal title={t("quickAdd.addBillTitle")} onClose={closeModal}>
          <label className="hm-label">{t("quickAdd.nameLabel")}</label>
          <input className="hm-input" placeholder={t("quickAdd.billNamePlaceholder")} id="ac-bill-name" />
          <label className="hm-label" style={{ marginTop: 12 }}>{t("quickAdd.amountLabel")}</label>
          <input className="hm-input" type="number" placeholder="0.00" id="ac-bill-amount" />
          <label className="hm-label" style={{ marginTop: 12 }}>{t("quickAdd.dueDateLabel")}</label>
          <input className="hm-input" type="date" id="ac-bill-due" />
          <label className="hm-label" style={{ marginTop: 12 }}>{t("quickAdd.categoryLabel")}</label>
          <select className="hm-input" id="ac-bill-category" defaultValue={DEFAULT_CATEGORY}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c, t)}</option>)}
          </select>
          <label className="hm-label" style={{ marginTop: 12 }}>{t("quickAdd.repeatLabel")}</label>
          <select className="hm-input" id="ac-bill-frequency" defaultValue="once">
            <option value="once">{t("quickAdd.frequencyOnce")}</option>
            <option value="monthly">{t("quickAdd.frequencyMonthly")}</option>
            <option value="quarterly">{t("quickAdd.frequencyQuarterly")}</option>
            <option value="semiannual">{t("quickAdd.frequencySemiannual")}</option>
            <option value="every9months">{t("quickAdd.frequencyEvery9Months")}</option>
            <option value="yearly">{t("quickAdd.frequencyYearly")}</option>
          </select>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="hm-btn hm-btn-soft" onClick={closeModal}>{t("quickAdd.cancel")}</button>
            <button className="hm-btn hm-btn-primary" onClick={() => {
              const name = document.getElementById("ac-bill-name").value || t("actionCenter.bill");
              const amount = parseFloat(document.getElementById("ac-bill-amount").value || 0);
              const dueDate = document.getElementById("ac-bill-due").value || null;
              const category = document.getElementById("ac-bill-category").value;
              const frequency = document.getElementById("ac-bill-frequency").value;
              addBill({ name, amount, dueDate, category, frequency });
            }}>{t("quickAdd.add")}</button>
          </div>
        </Modal>
      )}

      {modal?.type === "addMovement" && (
        <AddMovementModal
          onClose={closeModal}
          onSaveExpense={addExpense}
          onSaveIncome={addIncome}
        />
      )}

      {modal?.type === "addExpense" && (
        <Modal title={modal.payload?.expenseId ? t("quickAdd.editExpenseTitle") : t("quickAdd.registerExpenseTitle")} onClose={closeModal}>
          <label className="hm-label">{t("quickAdd.nameLabel")}</label>
          <input className="hm-input" placeholder={t("quickAdd.expenseNamePlaceholder")} id="ac-exp-name" defaultValue={modal.payload?.name || ""} />
          <label className="hm-label" style={{ marginTop: 12 }}>{t("quickAdd.amountLabel")}</label>
          <input className="hm-input" type="number" placeholder="0.00" id="ac-exp-amount" defaultValue={modal.payload?.amount || ""} />
          <label className="hm-label" style={{ marginTop: 12 }}>{t("quickAdd.categoryLabel")}</label>
          <select className="hm-input" id="ac-exp-cat" defaultValue={EXPENSE_CATEGORIES.includes(modal.payload?.category) ? modal.payload.category : DEFAULT_CATEGORY}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c, t)}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="hm-btn hm-btn-soft" onClick={closeModal}>{t("quickAdd.cancel")}</button>
            <button className="hm-btn hm-btn-primary" onClick={() => {
              const name = document.getElementById("ac-exp-name").value || t("quickAdd.registerExpenseTitle");
              const amount = parseFloat(document.getElementById("ac-exp-amount").value || 0);
              const category = document.getElementById("ac-exp-cat").value || DEFAULT_CATEGORY;
              if (modal.payload?.expenseId) {
                updateExpenseFromModal(modal.payload.expenseId, { name, amount, category });
              } else {
                addExpense({ name, amount, category });
              }
            }}>{modal.payload?.expenseId ? t("quickAdd.saveChanges") : t("quickAdd.register")}</button>
          </div>
        </Modal>
      )}

      {modal?.type === "scan" && <ScanSpaceModal state={state} onClose={closeModal} onImport={importScanned} />}
      <OnboardingManager
        user={user}
        activeTab={route.tab}
        selectedRoomId={micasaView.roomId}
        roomsCount={state.rooms.length}
        zonesCount={state.zones.length}
        boxesCount={state.containers.length}
        objectsCount={state.objects.length}
        isHomeReady={Boolean(currentHomeId && homes.length > 0)}
        onCreateRoomClick={() => openModal("addRoom")}
        onCreateZoneClick={() => openModal("addZone", { roomId: micasaView.roomId || state.rooms[0]?.id })}
        onCreateBoxClick={() => openModal("addContainer")}
        onAddObjectClick={() => openModal("addObject")}
      />
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          isDangerous={confirmDialog.isDangerous}
          confirmLabel={confirmDialog.confirmLabel}
          extraAction={confirmDialog.extraAction}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
        />
      )}
      </div>
    </CurrencyProvider>
  );
}

export default function HomeMapApp() {
  const [appLocale, setAppLocale] = useState("es");
  return (
    <I18nProvider locale={appLocale} setLocale={setAppLocale}>
      <HomeMapAppInner appLocale={appLocale} onLocaleChange={setAppLocale} />
    </I18nProvider>
  );
}
