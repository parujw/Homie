import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Home as HomeIcon,
  ShoppingCart,
  Calendar as CalendarIcon,
  PawPrint,
  Wallet,
  User,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Trash2,
  ArrowLeftRight,
  Utensils,
  ShieldPlus,
  Sparkles,
  Dog,
  Cat,
  Bird,
  Rabbit,
  Fish,
  ArrowRight,
  Bell,
  BellOff,
} from "lucide-react";
import {
  watchAuth,
  signUp,
  signIn,
  logOut,
  authErrorMessage,
  watchHouse,
  saveField,
  requestNotificationPermission,
  notificationSupport,
  registerPushToken,
  localNotify,
} from "./firebase.js";

/* ---------------------------------------------------------------
   TOKENS
--------------------------------------------------------------- */
const C = {
  ink: "#2B1B12",
  ink70: "rgba(43,27,18,0.68)",
  ink50: "rgba(43,27,18,0.46)",
  ink30: "rgba(43,27,18,0.26)",
  paper: "#FAF2E6",
  card: "#FFFFFF",
  line: "#ECDFC9",
  primary: "#8C2F39",
  primaryDark: "#6C2029",
  primarySoft: "#F3DADC",
  mint: "#3F7F76",
  mintSoft: "#DCEEE8",
  gold: "#C88A2E",
  goldSoft: "#F5E6C8",
  coral: "#C96A4B",
  coralSoft: "#F5E0D3",
  slate: "#5B5147",
};

const USERS = ["Putter", "Q"];

const SHOP_CATS = [
  { key: "Food", icon: Utensils, color: C.gold, soft: C.goldSoft },
  { key: "Home", icon: HomeIcon, color: C.primary, soft: C.primarySoft },
  { key: "Health", icon: ShieldPlus, color: C.mint, soft: C.mintSoft },
  { key: "Pets", icon: PawPrint, color: C.coral, soft: C.coralSoft },
];

const PET_SPECIES = [
  { key: "Dog", icon: Dog },
  { key: "Cat", icon: Cat },
  { key: "Bird", icon: Bird },
  { key: "Rabbit", icon: Rabbit },
  { key: "Fish", icon: Fish },
];

const MOODS = [
  { key: "Happy", emoji: "😊", color: "#E98FB3" },
  { key: "Calm", emoji: "🙂", color: "#8E7FD1" },
  { key: "Content", emoji: "😌", color: "#5FA8D3" },
  { key: "Stressed", emoji: "😖", color: "#E0713F" },
  { key: "Tired", emoji: "😑", color: C.gold },
];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

const NOTIF_COPY = {
  granted:
    "On — you'll hear when the other person adds something while the app is open. Alerts with the app closed need Cloud Messaging finished (see SETUP.md).",
  denied:
    "Blocked by your browser. Turn Homie's notifications back on in your browser or phone settings, then reopen the app.",
  "needs-install":
    "On iPhone, notifications only work once Homie is installed: tap Share → Add to Home Screen, then open it from your home screen and come back here.",
  unsupported: "This browser can't show notifications.",
  default: "Turn these on to hear when Putter or Q adds an item, event, or expense.",
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function fmtBaht(n) {
  const v = Number(n) || 0;
  // Narrow no-break space: the ฿ glyph comes from a different font than the
  // digits, and without it the symbol collides with the first number.
  return "฿ " + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function fmtDateLabel(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
}
function otherUser(identity) {
  return USERS.find((u) => u !== identity) || USERS[0];
}

/* ---------------------------------------------------------------
   SMALL UI PRIMITIVES
--------------------------------------------------------------- */
function IconCircle({ Icon, color, soft, size = 40 }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 999, background: soft,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      <Icon size={size * 0.5} color={color} strokeWidth={2.2} />
    </div>
  );
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 21, color: C.ink }}>{title}</h2>
      {action && (
        <button onClick={onAction} style={{ color: C.primary, fontWeight: 600, fontSize: 15 }} className="flex items-center gap-1">
          {action} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

function EmptyState({ text, cta, onCta }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4" style={{ color: C.ink50 }}>
      <p style={{ fontSize: 15.5 }}>{text}</p>
      {cta && (
        <button onClick={onCta} style={{ color: C.primary, fontWeight: 600, fontSize: 15, marginTop: 6 }}>
          {cta}
        </button>
      )}
    </div>
  );
}

function Sheet({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }} className="flex items-end justify-center">
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(43,27,18,0.4)" }} />
      <div
        style={{
          position: "relative", width: "100%", maxWidth: 430, background: C.paper,
          borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: "18px 20px 28px",
          maxHeight: "82vh", overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20, color: C.ink }}>{title}</h3>
          <button onClick={onClose}><X size={20} color={C.ink50} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TextField({ label, ...props }) {
  return (
    <label className="block mb-3">
      {label && (
        <span style={{ fontSize: 14, color: C.ink70, fontWeight: 600, display: "block", marginBottom: 5 }}>{label}</span>
      )}
      <input
        {...props}
        style={{
          width: "100%", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14,
          padding: "11px 14px", fontSize: 16, color: C.ink, fontFamily: "var(--font-sans)",
        }}
      />
    </label>
  );
}

function PillSelect({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {options.map((opt) => {
        const val = typeof opt === "string" ? opt : opt.key;
        const active = value === val;
        return (
          <button
            key={val} type="button" onClick={() => onChange(val)}
            style={{
              padding: "7px 14px", borderRadius: 999, fontSize: 14.5, fontWeight: 600,
              border: `1px solid ${active ? C.primary : C.line}`,
              background: active ? C.primary : C.card, color: active ? "#fff" : C.ink70,
            }}
          >
            {val}
          </button>
        );
      })}
    </div>
  );
}

function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      style={{
        width: "100%", background: C.primary, color: "#fff", fontWeight: 700, fontSize: 16.5,
        padding: "13px", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------
   IDENTITY GATE
--------------------------------------------------------------- */
function AuthGate() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
      // watchAuth in App renders the rest — nothing to do here on success.
    } catch (err) {
      console.error("auth error", err.code, err.message);
      setError(authErrorMessage(err.code));
      setBusy(false);
    }
  };

  const field = {
    width: "100%", padding: "14px 16px", borderRadius: 16, background: C.card,
    border: `1.5px solid ${C.line}`, fontSize: 16.5, color: C.ink, marginBottom: 12,
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 32px", background: C.paper }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ width: 84, height: 84, borderRadius: 28, background: C.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <HomeIcon size={38} color={C.primary} strokeWidth={2} />
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 32, color: C.ink }}>Homie</h1>
        <p style={{ color: C.ink70, fontSize: 16, marginTop: 8, marginBottom: 28, lineHeight: 1.5 }}>
          {mode === "signup"
            ? "Create an account to start planning together."
            : "Sign in to your shared planner."}
        </p>
      </div>

      <form onSubmit={submit}>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" autoComplete="email" required style={field}
        />
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" required
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          style={field}
        />
        {error && (
          <p data-testid="auth-error" style={{ color: C.coral, fontSize: 14.5, marginBottom: 12, lineHeight: 1.4 }}>{error}</p>
        )}
        <button
          type="submit" disabled={busy}
          style={{ width: "100%", padding: "15px 0", borderRadius: 18, background: C.primary, color: "#fff", fontWeight: 700, fontSize: 17, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <button
        onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}
        style={{ marginTop: 18, color: C.ink70, fontSize: 15, background: "none", border: "none" }}
      >
        {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </div>
  );
}

function IdentityGate({ onPick }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center" style={{ background: C.paper }}>
      <div style={{ width: 84, height: 84, borderRadius: 28, background: C.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <HomeIcon size={38} color={C.primary} strokeWidth={2} />
      </div>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 32, color: C.ink }}>Homie</h1>
      <p style={{ color: C.ink70, fontSize: 16, marginTop: 8, marginBottom: 32, lineHeight: 1.5 }}>
        One shared space for shopping, the calendar, the pets, and who paid for what.
      </p>
      <p style={{ color: C.ink50, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>WHO'S OPENING THE APP?</p>
      <div className="flex gap-3 w-full">
        {USERS.map((u) => (
          <button
            key={u} onClick={() => onPick(u)}
            style={{ flex: 1, padding: "16px 0", borderRadius: 18, background: C.card, border: `1.5px solid ${C.line}`, fontWeight: 700, fontSize: 17, color: C.ink }}
          >
            {u}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   BOTTOM NAV
--------------------------------------------------------------- */
function BottomNav({ tab, setTab, shoppingCount }) {
  const items = [
    { key: "home", label: "Home", Icon: HomeIcon },
    { key: "shopping", label: "Shopping", Icon: ShoppingCart, badge: shoppingCount },
    { key: "calendar", label: "Calendar", Icon: CalendarIcon },
    { key: "pets", label: "Pets", Icon: PawPrint },
    { key: "finance", label: "Finance", Icon: Wallet },
    { key: "profile", label: "Profile", Icon: User },
  ];
  return (
    <div style={{ position: "sticky", bottom: 0, background: C.card, borderTop: `1px solid ${C.line}`, display: "flex", padding: "8px 2px 10px" }}>
      {items.map(({ key, label, Icon, badge }) => {
        const active = tab === key;
        return (
          <button key={key} onClick={() => setTab(key)} className="flex-1 flex flex-col items-center gap-1" style={{ position: "relative", padding: "4px 0" }}>
            <Icon size={21} color={active ? C.primary : C.ink30} strokeWidth={2.2} />
            {!!badge && (
              <span style={{ position: "absolute", top: -2, right: "26%", background: C.primary, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                {badge}
              </span>
            )}
            <span style={{ fontSize: 11, fontWeight: 600, color: active ? C.primary : C.ink30, lineHeight: 1.1 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------
   HOME TAB
--------------------------------------------------------------- */
function HomeTab({ identity, shopping, events, pets, budgets, expenses, setTab }) {
  const openShopping = shopping.filter((i) => !i.done);
  const upcomingEvents = useMemo(() => {
    const today = todayISO();
    return events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  }, [events]);
  const petTasks = useMemo(() => {
    const list = [];
    pets.forEach((p) => (p.tasks || []).filter((t) => !t.done).forEach((t) => list.push({ ...t, petName: p.name })));
    return list;
  }, [pets]);
  const thisMonth = todayISO().slice(0, 7);
  const monthExpenses = expenses.filter((e) => e.date.slice(0, 7) === thisMonth);
  const spent = monthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const limitTotal = budgets.reduce((s, b) => s + Number(b.limit || 0), 0);
  const pct = limitTotal > 0 ? Math.round((spent / limitTotal) * 100) : 0;

  const stats = [
    { label: "Shopping", value: openShopping.length, color: C.primary, soft: C.primarySoft, tab: "shopping" },
    { label: "Events", value: upcomingEvents.length, color: C.mint, soft: C.mintSoft, tab: "calendar" },
    { label: "Pet care", value: petTasks.length, color: C.coral, soft: C.coralSoft, tab: "pets" },
    { label: "Budget", value: `${pct}%`, color: C.gold, soft: C.goldSoft, tab: "finance" },
  ];

  return (
    <div className="px-5 pt-6 pb-4">
      <p style={{ color: C.ink50, fontSize: 14.5, fontWeight: 600 }}>Welcome back</p>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, color: C.ink, marginBottom: 20 }}>{identity}</h1>
      <div className="grid grid-cols-4 gap-2 mb-7">
        {stats.map((s) => (
          <button key={s.label} onClick={() => setTab(s.tab)} style={{ background: s.soft, borderRadius: 18, padding: "12px 6px" }} className="flex flex-col items-center">
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 21, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 12, color: C.ink70, fontWeight: 600, marginTop: 2, textAlign: "center" }}>{s.label}</span>
          </button>
        ))}
      </div>

      <SectionHeader title="Upcoming" action="See calendar" onAction={() => setTab("calendar")} />
      <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.line}`, marginBottom: 26 }}>
        {upcomingEvents.length === 0 ? (
          <EmptyState text="Nothing on the calendar yet." cta="Add an event" onCta={() => setTab("calendar")} />
        ) : (
          upcomingEvents.map((e, i) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
              <div style={{ width: 42, textAlign: "center", background: e.type === "shared" ? C.primarySoft : C.mintSoft, borderRadius: 12, padding: "5px 0" }}>
                <div style={{ fontWeight: 700, fontSize: 16.5, color: e.type === "shared" ? C.primary : C.mint }}>{new Date(e.date + "T00:00:00").getDate()}</div>
              </div>
              <div className="flex-1">
                <p style={{ fontWeight: 600, fontSize: 15.5, color: C.ink }}>{e.title}</p>
                <p style={{ fontSize: 13.5, color: C.ink50 }}>{e.owner} · {e.type}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <SectionHeader title="Shopping list" action="View all" onAction={() => setTab("shopping")} />
      <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.line}`, marginBottom: 26 }}>
        {openShopping.length === 0 ? (
          <EmptyState text="Nothing to buy right now." cta="Add an item" onCta={() => setTab("shopping")} />
        ) : (
          openShopping.slice(0, 4).map((item, i) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
              <div style={{ width: 18, height: 18, borderRadius: 6, border: `2px solid ${C.line}` }} />
              <span style={{ fontSize: 15.5, color: C.ink, flex: 1 }}>{item.text}</span>
              <span style={{ fontSize: 12.5, color: C.ink50, background: C.paper, padding: "3px 9px", borderRadius: 999 }}>{item.category}</span>
            </div>
          ))
        )}
      </div>

      <SectionHeader title="Pet care" action="Open pets" onAction={() => setTab("pets")} />
      <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.line}` }}>
        {petTasks.length === 0 ? (
          <EmptyState text="No pet tasks pending." cta="Add a task" onCta={() => setTab("pets")} />
        ) : (
          petTasks.slice(0, 3).map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
              <IconCircle Icon={PawPrint} color={C.coral} soft={C.coralSoft} size={34} />
              <div className="flex-1">
                <p style={{ fontWeight: 600, fontSize: 15.5, color: C.ink }}>{t.text}</p>
                <p style={{ fontSize: 13.5, color: C.ink50 }}>{t.petName}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   SHOPPING TAB
--------------------------------------------------------------- */
function ShoppingTab({ shopping, setShopping, identity }) {
  const [filter, setFilter] = useState("All");
  const [draft, setDraft] = useState("");
  const [draftCat, setDraftCat] = useState("Home");
  const items = filter === "All" ? shopping : shopping.filter((i) => i.category === filter);
  const toggle = (id) => setShopping(shopping.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const remove = (id) => setShopping(shopping.filter((i) => i.id !== id));
  const add = () => {
    if (!draft.trim()) return;
    setShopping([{ id: uid(), text: draft.trim(), category: draftCat, done: false, addedBy: identity }, ...shopping]);
    setDraft("");
  };
  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-center gap-2.5 mb-1">
        <IconCircle Icon={ShoppingCart} color={C.primary} soft={C.primarySoft} />
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, color: C.ink }}>Shopping list</h1>
      </div>
      <p style={{ color: C.ink50, fontSize: 14, marginBottom: 16 }}>Shared by {USERS.join(" & ")}</p>
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {["All", ...SHOP_CATS.map((c) => c.key)].map((cat) => {
          const active = filter === cat;
          return (
            <button key={cat} onClick={() => setFilter(cat)} style={{ padding: "7px 14px", borderRadius: 999, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", background: active ? C.primary : C.card, border: `1px solid ${active ? C.primary : C.line}`, color: active ? "#fff" : C.ink70 }}>
              {cat}
            </button>
          );
        })}
      </div>
      <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.line}`, marginBottom: 16 }}>
        {items.length === 0 ? (
          <EmptyState text="No items here yet." />
        ) : (
          items.map((item, i) => {
            const catInfo = SHOP_CATS.find((c) => c.key === item.category);
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                <button onClick={() => toggle(item.id)} style={{ width: 20, height: 20, borderRadius: 7, border: `2px solid ${item.done ? C.mint : C.line}`, background: item.done ? C.mint : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {item.done && <Check size={13} color="#fff" strokeWidth={3} />}
                </button>
                <span style={{ fontSize: 15.5, flex: 1, color: item.done ? C.ink30 : C.ink, textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
                <span style={{ fontSize: 12.5, color: catInfo?.color || C.ink50, background: catInfo?.soft || C.paper, padding: "3px 9px", borderRadius: 999, fontWeight: 600 }}>{item.category}</span>
                <button onClick={() => remove(item.id)}><Trash2 size={15} color={C.ink30} /></button>
              </div>
            );
          })
        )}
      </div>
      <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, padding: 12 }}>
        <div className="flex gap-2 mb-2 overflow-x-auto">
          {SHOP_CATS.map((c) => {
            const active = draftCat === c.key;
            return (
              <button key={c.key} onClick={() => setDraftCat(c.key)} style={{ padding: "5px 11px", borderRadius: 999, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", background: active ? c.color : c.soft, color: active ? "#fff" : c.color }}>
                {c.key}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add an item..." style={{ flex: 1, border: "none", outline: "none", fontSize: 16, color: C.ink, background: "transparent" }} />
          <button onClick={add} style={{ width: 34, height: 34, borderRadius: 12, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Plus size={17} color="#fff" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   CALENDAR TAB
--------------------------------------------------------------- */
function CalendarTab({ events, setEvents, moods, setMoods, identity }) {
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selected, setSelected] = useState(todayISO());
  const [scope, setScope] = useState("shared");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", type: "shared" });

  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const firstDow = new Date(cursor.y, cursor.m, 1).getDay();
  const monthStr = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`;
  const filteredEvents = events.filter((e) => (scope === "shared" ? e.type === "shared" : e.owner === identity));
  const eventsByDay = {};
  filteredEvents.forEach((e) => { if (e.date.startsWith(monthStr)) eventsByDay[e.date] = (eventsByDay[e.date] || 0) + 1; });
  const dayEvents = filteredEvents.filter((e) => e.date === selected);

  const changeMonth = (delta) => {
    let m = cursor.m + delta, y = cursor.y;
    if (m < 0) { m = 11; y -= 1; } if (m > 11) { m = 0; y += 1; }
    setCursor({ y, m });
  };
  const addEvent = () => {
    if (!form.title.trim()) return;
    setEvents([{ id: uid(), title: form.title.trim(), date: selected, type: form.type, owner: identity }, ...events]);
    setForm({ title: "", type: "shared" });
    setShowAdd(false);
  };
  const removeEvent = (id) => setEvents(events.filter((e) => e.id !== id));

  const todayMood = moods.find((m) => m.date === todayISO() && m.owner === identity);
  const setTodayMood = (moodKey) => {
    const others = moods.filter((m) => !(m.date === todayISO() && m.owner === identity));
    setMoods([{ id: uid(), date: todayISO(), owner: identity, mood: moodKey }, ...others]);
  };
  const recentMoods = [...moods].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <IconCircle Icon={CalendarIcon} color={C.mint} soft={C.mintSoft} />
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, color: C.ink }}>Calendar</h1>
        </div>
        <div className="flex" style={{ background: C.paper, borderRadius: 999, padding: 3 }}>
          {["shared", "personal"].map((s) => (
            <button key={s} onClick={() => setScope(s)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700, textTransform: "capitalize", background: scope === s ? C.card : "transparent", color: scope === s ? C.ink : C.ink50 }}>{s}</button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 my-4">
        {[{ k: "month", l: "Month" }, { k: "mood", l: "Mood" }].map((t) => (
          <button key={t.k} onClick={() => setView(t.k)} style={{ padding: "7px 16px", borderRadius: 999, fontSize: 14.5, fontWeight: 600, background: view === t.k ? C.primary : C.card, border: `1px solid ${view === t.k ? C.primary : C.line}`, color: view === t.k ? "#fff" : C.ink70 }}>{t.l}</button>
        ))}
      </div>

      {view === "month" && (
        <>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => changeMonth(-1)}><ChevronLeft size={20} color={C.ink50} /></button>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, color: C.ink }}>{MONTH_NAMES[cursor.m]} {cursor.y}</span>
            <button onClick={() => changeMonth(1)}><ChevronRight size={20} color={C.ink50} /></button>
          </div>
          <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.line}`, padding: 14, marginBottom: 16 }}>
            <div className="grid grid-cols-7 mb-2">
              {DOW.map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 12.5, color: C.ink30, fontWeight: 700 }}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {Array.from({ length: firstDow }).map((_, i) => <div key={"e" + i} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const iso = `${monthStr}-${String(day).padStart(2, "0")}`;
                const isSel = iso === selected, isToday = iso === todayISO(), has = eventsByDay[iso];
                return (
                  <button key={day} onClick={() => setSelected(iso)} className="flex flex-col items-center" style={{ padding: "5px 0" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14.5, fontWeight: isToday ? 700 : 500, background: isSel ? C.primary : "transparent", border: isToday && !isSel ? `1.5px solid ${C.primary}` : "none", color: isSel ? "#fff" : C.ink }}>{day}</div>
                    <div style={{ width: 4, height: 4, borderRadius: 4, background: has ? C.mint : "transparent", marginTop: 2 }} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontWeight: 600, fontSize: 15.5, color: C.ink }}>{fmtDateLabel(selected)}</span>
            <button onClick={() => setShowAdd(true)} style={{ width: 30, height: 30, borderRadius: 10, background: C.primarySoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plus size={16} color={C.primary} />
            </button>
          </div>
          <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.line}` }}>
            {dayEvents.length === 0 ? (
              <EmptyState text="No events today." cta="Add event" onCta={() => setShowAdd(true)} />
            ) : (
              dayEvents.map((e, i) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: 8, background: e.type === "shared" ? C.primary : C.mint, flexShrink: 0 }} />
                  <div className="flex-1">
                    <p style={{ fontSize: 15.5, fontWeight: 600, color: C.ink }}>{e.title}</p>
                    <p style={{ fontSize: 13, color: C.ink50 }}>{e.owner} · {e.type}</p>
                  </div>
                  <button onClick={() => removeEvent(e.id)}><Trash2 size={14} color={C.ink30} /></button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {view === "mood" && (
        <>
          <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.line}`, padding: 16, marginBottom: 18 }}>
            <p style={{ fontWeight: 600, fontSize: 16, color: C.ink, marginBottom: 12 }}>How are you feeling today?</p>
            <div className="flex justify-between">
              {MOODS.map((m) => {
                const active = todayMood?.mood === m.key;
                return (
                  <button key={m.key} onClick={() => setTodayMood(m.key)} className="flex flex-col items-center gap-1.5">
                    <div style={{ width: 48, height: 48, borderRadius: 999, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", background: active ? m.color : C.paper, border: active ? `2px solid ${m.color}` : `1px solid ${C.line}` }}>{m.emoji}</div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: active ? C.ink : C.ink50 }}>{m.key}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <SectionHeader title="Recent moods" />
          <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.line}` }}>
            {recentMoods.length === 0 ? (
              <EmptyState text="No moods logged yet." />
            ) : (
              recentMoods.map((m, i) => {
                const info = MOODS.find((x) => x.key === m.mood);
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                    <div style={{ width: 32, height: 32, borderRadius: 999, background: info ? `${info.color}22` : C.paper, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{info?.emoji || "🙂"}</div>
                    <div className="flex-1">
                      <p style={{ fontSize: 15.5, color: C.ink }}><b>{m.owner}</b> felt <b style={{ color: C.primary }}>{m.mood.toLowerCase()}</b></p>
                      <p style={{ fontSize: 13, color: C.ink50 }}>{fmtDateLabel(m.date)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {showAdd && (
        <Sheet title={`Add event · ${fmtDateLabel(selected)}`} onClose={() => setShowAdd(false)}>
          <TextField label="Title" placeholder="e.g. Vet appointment" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <span style={{ fontSize: 14, color: C.ink70, fontWeight: 600, display: "block", marginBottom: 5 }}>Type</span>
          <PillSelect options={["shared", "personal"]} value={form.type} onChange={(v) => setForm({ ...form, type: v })} />
          <PrimaryButton onClick={addEvent}><Plus size={16} /> Add event</PrimaryButton>
        </Sheet>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   PETS TAB
--------------------------------------------------------------- */
function PetsTab({ pets, setPets }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", species: "Dog", breed: "", gender: "Female", age: "", weight: "" });
  const [taskFor, setTaskFor] = useState(null);
  const [taskText, setTaskText] = useState("");

  const addPet = () => {
    if (!form.name.trim()) return;
    setPets([{ id: uid(), ...form, name: form.name.trim(), tasks: [] }, ...pets]);
    setForm({ name: "", species: "Dog", breed: "", gender: "Female", age: "", weight: "" });
    setShowAdd(false);
  };
  const removePet = (id) => setPets(pets.filter((p) => p.id !== id));
  const addTask = () => {
    if (!taskText.trim() || !taskFor) return;
    setPets(pets.map((p) => (p.id === taskFor ? { ...p, tasks: [{ id: uid(), text: taskText.trim(), done: false }, ...(p.tasks || [])] } : p)));
    setTaskText(""); setTaskFor(null);
  };
  const toggleTask = (petId, taskId) => setPets(pets.map((p) => (p.id === petId ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) } : p)));

  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <IconCircle Icon={PawPrint} color={C.coral} soft={C.coralSoft} />
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, color: C.ink }}>My pets</h1>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ width: 34, height: 34, borderRadius: 12, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plus size={17} color="#fff" strokeWidth={2.5} />
        </button>
      </div>
      <p style={{ color: C.ink50, fontSize: 14, marginBottom: 16 }}>{pets.length} pet{pets.length === 1 ? "" : "s"} in your care</p>
      {pets.length === 0 ? (
        <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.line}` }}>
          <EmptyState text="No pets added yet." cta="Add a pet" onCta={() => setShowAdd(true)} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pets.map((p) => {
            const speciesInfo = PET_SPECIES.find((s) => s.key === p.species) || PET_SPECIES[0];
            const openTasks = (p.tasks || []).filter((t) => !t.done);
            return (
              <div key={p.id} style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.line}`, padding: 16 }}>
                <div className="flex items-center gap-3 mb-3">
                  <IconCircle Icon={speciesInfo.icon} color={C.coral} soft={C.coralSoft} size={46} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span style={{ fontWeight: 700, fontSize: 17, color: C.ink }}>{p.name}</span>
                      <span style={{ fontSize: 12.5, color: C.ink50 }}>{p.gender}</span>
                    </div>
                    <p style={{ fontSize: 14, color: C.ink50 }}>{p.breed || p.species}</p>
                  </div>
                  <button onClick={() => removePet(p.id)}><Trash2 size={15} color={C.ink30} /></button>
                </div>
                <div className="flex gap-2 mb-3">
                  {p.age && (
                    <div style={{ flex: 1, background: C.paper, borderRadius: 12, padding: "8px 10px" }}>
                      <p style={{ fontSize: 11.5, color: C.ink50, fontWeight: 600 }}>AGE</p>
                      <p style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>{p.age}</p>
                    </div>
                  )}
                  {p.weight && (
                    <div style={{ flex: 1, background: C.paper, borderRadius: 12, padding: "8px 10px" }}>
                      <p style={{ fontSize: 11.5, color: C.ink50, fontWeight: 600 }}>WEIGHT</p>
                      <p style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>{p.weight}</p>
                    </div>
                  )}
                </div>
                {openTasks.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-2">
                    {openTasks.map((t) => (
                      <button key={t.id} onClick={() => toggleTask(p.id, t.id)} className="flex items-center gap-2" style={{ background: C.coralSoft, borderRadius: 10, padding: "7px 10px" }}>
                        <div style={{ width: 15, height: 15, borderRadius: 5, border: `2px solid ${C.coral}`, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, color: C.ink, textAlign: "left" }}>{t.text}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setTaskFor(p.id)} style={{ fontSize: 14, fontWeight: 600, color: C.primary }}>+ Add task</button>
              </div>
            );
          })}
        </div>
      )}
      {showAdd && (
        <Sheet title="Add a pet" onClose={() => setShowAdd(false)}>
          <TextField label="Name" placeholder="e.g. Leah" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <span style={{ fontSize: 14, color: C.ink70, fontWeight: 600, display: "block", marginBottom: 5 }}>Species</span>
          <PillSelect options={PET_SPECIES.map((s) => s.key)} value={form.species} onChange={(v) => setForm({ ...form, species: v })} />
          <TextField label="Breed" placeholder="e.g. Cocker Spaniel" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
          <span style={{ fontSize: 14, color: C.ink70, fontWeight: 600, display: "block", marginBottom: 5 }}>Gender</span>
          <PillSelect options={["Female", "Male"]} value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} />
          <div className="flex gap-3">
            <div className="flex-1"><TextField label="Age" placeholder="e.g. 2 yr" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
            <div className="flex-1"><TextField label="Weight" placeholder="e.g. 10 kg" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></div>
          </div>
          <PrimaryButton onClick={addPet}><Plus size={16} /> Add pet</PrimaryButton>
        </Sheet>
      )}
      {taskFor && (
        <Sheet title="Add a task" onClose={() => setTaskFor(null)}>
          <TextField label="Task" placeholder="e.g. Vaccine booster" value={taskText} onChange={(e) => setTaskText(e.target.value)} />
          <PrimaryButton onClick={addTask}><Plus size={16} /> Add task</PrimaryButton>
        </Sheet>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   FINANCE TAB
--------------------------------------------------------------- */
function FinanceTab({ expenses, setExpenses, budgets, setBudgets, identity }) {
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [eForm, setEForm] = useState({ desc: "", amount: "", category: "", paidBy: identity });
  const [bForm, setBForm] = useState({ name: "", limit: "" });

  const thisMonth = todayISO().slice(0, 7);
  const monthExpenses = useMemo(() => expenses.filter((e) => e.date.slice(0, 7) === thisMonth).sort((a, b) => b.date.localeCompare(a.date)), [expenses, thisMonth]);
  const totalSpend = monthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const paidByUser = (user) => monthExpenses.filter((e) => e.paidBy === user).reduce((s, e) => s + Number(e.amount || 0), 0);
  const pendingByUser = (user) => monthExpenses.filter((e) => e.paidBy === user && !e.settled).reduce((s, e) => s + Number(e.amount || 0), 0);
  const pendingCountByUser = (user) => monthExpenses.filter((e) => e.paidBy === user && !e.settled).length;
  const categoryTotal = (cat) => monthExpenses.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount || 0), 0);

  const addExpense = () => {
    if (!eForm.desc.trim() || !eForm.amount) return;
    setExpenses([{ id: uid(), desc: eForm.desc.trim(), amount: eForm.amount, category: eForm.category || (budgets[0]?.name || "Other"), paidBy: eForm.paidBy, date: todayISO(), settled: false }, ...expenses]);
    setEForm({ desc: "", amount: "", category: "", paidBy: identity });
    setShowAddExpense(false);
  };
  const toggleSettled = (id) => setExpenses(expenses.map((e) => (e.id === id ? { ...e, settled: !e.settled } : e)));
  const removeExpense = (id) => setExpenses(expenses.filter((e) => e.id !== id));
  const addBudget = () => {
    if (!bForm.name.trim() || !bForm.limit) return;
    setBudgets([...budgets, { id: uid(), name: bForm.name.trim(), limit: bForm.limit }]);
    setBForm({ name: "", limit: "" });
    setShowAddBudget(false);
  };
  const removeBudget = (id) => setBudgets(budgets.filter((b) => b.id !== id));

  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-center gap-2.5 mb-1">
        <IconCircle Icon={Wallet} color={C.gold} soft={C.goldSoft} />
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, color: C.ink }}>Finance</h1>
      </div>
      <p style={{ color: C.ink50, fontSize: 14, marginBottom: 16 }}>{MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()} · Shared expenses</p>
      <div style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, borderRadius: 22, padding: 20, marginBottom: 20, color: "#fff" }}>
        <p style={{ fontSize: 13, opacity: 0.8, fontWeight: 700, letterSpacing: 0.3 }}>THIS MONTH'S SPENDING</p>
        <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 34, margin: "4px 0 16px" }}>{fmtBaht(totalSpend)}</p>
        <div className="flex gap-4 mb-4">
          {USERS.map((u) => (
            <div key={u} style={{ flex: 1 }}>
              <p style={{ fontSize: 13, opacity: 0.8 }}>{u} paid</p>
              <p style={{ fontWeight: 700, fontSize: 17 }}>{fmtBaht(paidByUser(u))}</p>
              <div style={{ height: 4, background: "rgba(255,255,255,0.28)", borderRadius: 4, marginTop: 6 }}>
                <div style={{ height: 4, width: `${totalSpend > 0 ? Math.min(100, (paidByUser(u) / totalSpend) * 100) : 0}%`, background: "#fff", borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          {USERS.map((u) => (
            <div key={u} style={{ flex: 1, background: "rgba(255,255,255,0.16)", borderRadius: 14, padding: 12 }}>
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowLeftRight size={12} color="#fff" />
                <span style={{ fontSize: 12.5, opacity: 0.85 }}>{u} pending</span>
              </div>
              <p style={{ fontWeight: 700, fontSize: 16.5 }}>{fmtBaht(pendingByUser(u))}</p>
              <p style={{ fontSize: 12, opacity: 0.8 }}>{pendingCountByUser(u)} item{pendingCountByUser(u) === 1 ? "" : "s"} to settle</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: 13.5, color: C.ink50, fontWeight: 700, letterSpacing: 0.3 }}>MONTHLY BUDGET</span>
        <button onClick={() => setShowAddBudget(true)} style={{ color: C.primary, fontWeight: 700, fontSize: 14 }}>+ Add category</button>
      </div>
      <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.line}`, padding: 16, marginBottom: 22 }}>
        {budgets.length === 0 ? (
          <EmptyState text="No budget categories yet." cta="Add one" onCta={() => setShowAddBudget(true)} />
        ) : (
          budgets.map((b, i) => {
            const spent = categoryTotal(b.name);
            const pct = Math.min(100, (spent / (Number(b.limit) || 1)) * 100);
            const over = spent > Number(b.limit);
            return (
              <div key={b.id} style={{ marginTop: i === 0 ? 0 : 16 }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ fontSize: 15.5, fontWeight: 600, color: C.ink }}>{b.name}</span>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: over ? C.primary : C.ink70 }}>{fmtBaht(spent)} / {fmtBaht(b.limit)}</span>
                    <button onClick={() => removeBudget(b.id)}><Trash2 size={13} color={C.ink30} /></button>
                  </div>
                </div>
                <div style={{ height: 6, background: C.paper, borderRadius: 4 }}>
                  <div style={{ height: 6, width: `${pct}%`, background: over ? C.primary : C.mint, borderRadius: 4 }} />
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: 13.5, color: C.ink50, fontWeight: 700, letterSpacing: 0.3 }}>EXPENSES THIS MONTH</span>
        <button onClick={() => setShowAddExpense(true)} style={{ width: 28, height: 28, borderRadius: 10, background: C.primarySoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plus size={15} color={C.primary} />
        </button>
      </div>
      <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.line}` }}>
        {monthExpenses.length === 0 ? (
          <EmptyState text="No expenses logged yet." cta="Add an expense" onCta={() => setShowAddExpense(true)} />
        ) : (
          monthExpenses.map((e, i) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
              <div className="flex-1">
                <p style={{ fontSize: 15.5, fontWeight: 600, color: C.ink }}>{e.desc}</p>
                <p style={{ fontSize: 13, color: C.ink50 }}>{e.paidBy} · {e.category} · {fmtDateLabel(e.date)}</p>
              </div>
              <span style={{ fontWeight: 700, fontSize: 15.5, color: C.ink }}>{fmtBaht(e.amount)}</span>
              <button onClick={() => toggleSettled(e.id)} style={{ width: 26, height: 26, borderRadius: 999, background: e.settled ? C.mint : C.paper, border: e.settled ? "none" : `1.5px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {e.settled && <Check size={14} color="#fff" strokeWidth={3} />}
              </button>
              <button onClick={() => removeExpense(e.id)}><Trash2 size={14} color={C.ink30} /></button>
            </div>
          ))
        )}
      </div>
      {showAddExpense && (
        <Sheet title="Add expense" onClose={() => setShowAddExpense(false)}>
          <TextField label="What was it?" placeholder="e.g. Grocery run" value={eForm.desc} onChange={(e) => setEForm({ ...eForm, desc: e.target.value })} />
          <TextField label="Amount (฿)" type="number" placeholder="0" value={eForm.amount} onChange={(e) => setEForm({ ...eForm, amount: e.target.value })} />
          {budgets.length > 0 && (
            <>
              <span style={{ fontSize: 14, color: C.ink70, fontWeight: 600, display: "block", marginBottom: 5 }}>Category</span>
              <PillSelect options={budgets.map((b) => b.name)} value={eForm.category} onChange={(v) => setEForm({ ...eForm, category: v })} />
            </>
          )}
          <span style={{ fontSize: 14, color: C.ink70, fontWeight: 600, display: "block", marginBottom: 5 }}>Paid by</span>
          <PillSelect options={USERS} value={eForm.paidBy} onChange={(v) => setEForm({ ...eForm, paidBy: v })} />
          <PrimaryButton onClick={addExpense}><Plus size={16} /> Add expense</PrimaryButton>
        </Sheet>
      )}
      {showAddBudget && (
        <Sheet title="Add budget category" onClose={() => setShowAddBudget(false)}>
          <TextField label="Category name" placeholder="e.g. Utilities" value={bForm.name} onChange={(e) => setBForm({ ...bForm, name: e.target.value })} />
          <TextField label="Monthly limit (฿)" type="number" placeholder="0" value={bForm.limit} onChange={(e) => setBForm({ ...bForm, limit: e.target.value })} />
          <PrimaryButton onClick={addBudget}><Plus size={16} /> Add category</PrimaryButton>
        </Sheet>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   PROFILE TAB
--------------------------------------------------------------- */
function ProfileTab({ identity, setIdentity, email, onSignOut, onResetAll, notifStatus, onEnableNotifications }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-center gap-2.5 mb-6">
        <IconCircle Icon={User} color={C.slate} soft="#EDE7DD" />
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, color: C.ink }}>Profile</h1>
      </div>

      <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.line}`, padding: 18, marginBottom: 20 }}>
        <p style={{ fontSize: 13.5, color: C.ink50, fontWeight: 700, letterSpacing: 0.3, marginBottom: 4 }}>SIGNED IN AS</p>
        <p style={{ fontSize: 15, color: C.ink70, marginBottom: 12 }}>{email}</p>
        <div className="flex gap-3">
          {USERS.map((u) => (
            <button key={u} onClick={() => setIdentity(u)} style={{ flex: 1, padding: "14px 0", borderRadius: 16, background: identity === u ? C.primary : C.paper, color: identity === u ? "#fff" : C.ink, fontWeight: 700, fontSize: 16.5 }}>
              {u}
            </button>
          ))}
        </div>
        <button onClick={onSignOut} style={{ marginTop: 14, color: C.primary, fontWeight: 700, fontSize: 15 }}>Sign out</button>
      </div>

      <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.line}`, padding: 18, marginBottom: 20 }}>
        <div className="flex items-center gap-2 mb-2">
          {notifStatus === "granted" ? <Bell size={16} color={C.mint} /> : <BellOff size={16} color={C.ink50} />}
          <p style={{ fontWeight: 700, fontSize: 16, color: C.ink }}>Notifications</p>
        </div>
        <p style={{ fontSize: 14, color: C.ink50, marginBottom: 12, lineHeight: 1.55 }}>
          {NOTIF_COPY[notifStatus] || NOTIF_COPY.default}
        </p>
        {notifStatus === "default" && (
          <button onClick={onEnableNotifications} style={{ color: C.primary, fontWeight: 700, fontSize: 15 }}>
            Enable notifications
          </button>
        )}
      </div>

      <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.line}`, padding: 18, marginBottom: 20 }}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} color={C.gold} />
          <p style={{ fontWeight: 700, fontSize: 16, color: C.ink }}>About Homie</p>
        </div>
        <p style={{ fontSize: 14.5, color: C.ink70, lineHeight: 1.6 }}>
          Homie keeps the shopping list, calendar, pet care and shared expenses for {USERS.join(" & ")} in one place, synced through Firestore and installable straight to your home screen as a PWA.
        </p>
      </div>

      <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.line}`, padding: 18 }}>
        <p style={{ fontWeight: 700, fontSize: 16, color: C.primary, marginBottom: 6 }}>Reset all data</p>
        <p style={{ fontSize: 14, color: C.ink50, marginBottom: 12 }}>Clears shopping, calendar, pets and finance data for both of you. This can't be undone.</p>
        {!confirming ? (
          <button onClick={() => setConfirming(true)} style={{ color: C.primary, fontWeight: 700, fontSize: 15 }}>Reset data…</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => { onResetAll(); setConfirming(false); }} style={{ flex: 1, background: C.primary, color: "#fff", fontWeight: 700, fontSize: 14.5, padding: "10px 0", borderRadius: 12 }}>Yes, reset</button>
            <button onClick={() => setConfirming(false)} style={{ flex: 1, background: C.paper, color: C.ink, fontWeight: 700, fontSize: 14.5, padding: "10px 0", borderRadius: 12 }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   ROOT APP
--------------------------------------------------------------- */
export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [identity, setIdentityState] = useState(() => localStorage.getItem("homie:identity") || null);
  const [tab, setTab] = useState("home");
  const [loaded, setLoaded] = useState(false);
  const [notifStatus, setNotifStatus] = useState(() =>
    typeof Notification !== "undefined" ? Notification.permission : notificationSupport()
  );

  const [shopping, setShoppingState] = useState([]);
  const [events, setEventsState] = useState([]);
  const [moods, setMoodsState] = useState([]);
  const [pets, setPetsState] = useState([]);
  const [expenses, setExpensesState] = useState([]);
  const [budgets, setBudgetsState] = useState([]);

  const prevRef = useRef(null); // last house snapshot, for diff-based local notifications

  useEffect(() => watchAuth((u) => {
    setUser(u);
    setAuthReady(true);
  }), []);

  useEffect(() => {
    if (!user) {
      setLoaded(false);
      prevRef.current = null;
      return;
    }
    const unsub = watchHouse((house) => {
      // Notify about changes made by the OTHER person since last snapshot.
      if (identity && prevRef.current) {
        notifyOnDiff(prevRef.current, house, identity);
      }
      prevRef.current = house;
      setShoppingState(house.shopping || []);
      setEventsState(house.events || []);
      setMoodsState(house.moods || []);
      setPetsState(house.pets || []);
      setExpensesState(house.expenses || []);
      setBudgetsState(house.budgets || []);
      setLoaded(true);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, identity]);

  function notifyOnDiff(prev, next, me) {
    const newlyAdded = (a, b) => (b || []).filter((x) => !(a || []).some((y) => y.id === x.id));
    newlyAdded(prev.shopping, next.shopping).forEach((i) => {
      if (i.addedBy && i.addedBy !== me) localNotify("Homie · Shopping", `${i.addedBy} added "${i.text}"`);
    });
    newlyAdded(prev.events, next.events).forEach((e) => {
      if (e.owner && e.owner !== me) localNotify("Homie · Calendar", `${e.owner} added "${e.title}"`);
    });
    newlyAdded(prev.expenses, next.expenses).forEach((e) => {
      if (e.paidBy && e.paidBy !== me) localNotify("Homie · Finance", `${e.paidBy} logged ${e.desc} (฿${e.amount})`);
    });
  }

  const setShopping = useCallback((v) => { setShoppingState(v); saveField("shopping", v); }, []);
  const setEvents = useCallback((v) => { setEventsState(v); saveField("events", v); }, []);
  const setMoods = useCallback((v) => { setMoodsState(v); saveField("moods", v); }, []);
  const setPets = useCallback((v) => { setPetsState(v); saveField("pets", v); }, []);
  const setExpenses = useCallback((v) => { setExpensesState(v); saveField("expenses", v); }, []);
  const setBudgets = useCallback((v) => { setBudgetsState(v); saveField("budgets", v); }, []);

  const pickIdentity = (u) => {
    setIdentityState(u);
    localStorage.setItem("homie:identity", u);
  };

  const resetAll = () => {
    setShopping([]); setEvents([]); setMoods([]); setPets([]); setExpenses([]); setBudgets([]);
  };

  const enableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifStatus(perm === "unsupported" ? notificationSupport() : perm);
    if (perm === "granted" && identity) {
      await registerPushToken(identity);
      await localNotify("Homie", "Notifications are on ✅");
    }
  };

  const openShoppingCount = shopping.filter((i) => !i.done).length;

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", justifyContent: "center", background: "#E9E1D2", fontFamily: "var(--font-sans)" }}>
      <style>{`* { box-sizing: border-box; } ::-webkit-scrollbar { display: none; }`}</style>
      <div style={{ width: "100%", maxWidth: 430, background: C.paper, display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
        {!authReady ? (
          <div className="flex items-center justify-center h-full"><p style={{ color: C.ink50, fontSize: 14.5 }}>Loading Homie…</p></div>
        ) : !user ? (
          <AuthGate />
        ) : !identity ? (
          <IdentityGate onPick={pickIdentity} />
        ) : !loaded ? (
          <div className="flex items-center justify-center h-full"><p style={{ color: C.ink50, fontSize: 14.5 }}>Loading Homie…</p></div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {tab === "home" && <HomeTab identity={identity} shopping={shopping} events={events} pets={pets} budgets={budgets} expenses={expenses} setTab={setTab} />}
              {tab === "shopping" && <ShoppingTab shopping={shopping} setShopping={setShopping} identity={identity} />}
              {tab === "calendar" && <CalendarTab events={events} setEvents={setEvents} moods={moods} setMoods={setMoods} identity={identity} />}
              {tab === "pets" && <PetsTab pets={pets} setPets={setPets} />}
              {tab === "finance" && <FinanceTab expenses={expenses} setExpenses={setExpenses} budgets={budgets} setBudgets={setBudgets} identity={identity} />}
              {tab === "profile" && (
                <ProfileTab
                  identity={identity}
                  setIdentity={pickIdentity}
                  email={user.email}
                  onSignOut={logOut}
                  onResetAll={resetAll}
                  notifStatus={notifStatus}
                  onEnableNotifications={enableNotifications}
                />
              )}
            </div>
            <BottomNav tab={tab} setTab={setTab} shoppingCount={openShoppingCount} />
          </>
        )}
      </div>
    </div>
  );
}
