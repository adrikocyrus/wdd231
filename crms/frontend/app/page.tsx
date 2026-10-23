"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  Activity, ArrowRight, Bell, Boxes, Check, CircleHelp, ClipboardList,
  Clock3, Cpu, Grid2X2, KeyRound, LayoutDashboard, LogOut, Menu, Plus, Search, ShieldCheck,
  Smartphone, Sparkles, Users, Wrench, X, ReceiptText
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
type Role = "ADMIN" | "TECHNICIAN" | "CUSTOMER";
type User = { id: string; email: string; role: Role };
type Ticket = {
  id: string; customer_id: string; customer_name: string; customer_phone: string;
  device_type: string; serial_number: string | null; issue_description: string;
  status: string; estimated_cost: number | null; assigned_to: string | null;
  assigned_email: string | null; version: number; created_at: string;
};
type Customer = { id: string; name: string; phone: string; address: string | null };
type Part = {
  id: string; sku: string; name: string; quantity_on_hand: number;
  unit_price: number; is_active: boolean;
};
type Invoice = {
  id: string; ticket_id: string; customer_name: string; subtotal: number;
  tax: number; total: number; currency: string; status: string; issued_at: string;
};
type TeamMember = { id: string; email: string; role: Role; is_active: boolean; created_at: string };
type Tab = "Overview" | "Tickets" | "Inventory" | "Customers" | "Invoices" | "Team" | "Account";

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "The request could not be completed." }));
    throw new Error(data.error ?? "The request could not be completed.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function money(amount: number | null) {
  return amount == null ? "—" : new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2
  }).format(amount);
}

function shortId(id: string) {
  return `#${id.slice(0, 6).toUpperCase()}`;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}

const statusLabels: Record<string, string> = {
  OPEN: "New request",
  IN_PROGRESS: "In progress",
  WAITING_FOR_PARTS: "Waiting on parts",
  READY_FOR_PICKUP: "Ready for pickup",
  PICKED_UP: "Completed",
  CANCELLED: "Cancelled"
};

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await api<{ user: User }>("/api/auth/login", {
        method: "POST", body: JSON.stringify({ email, password })
      });
      onLogin(result.user);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="login-art">
        <div className="brand brand-on-dark"><span className="brand-mark"><Wrench size={18} /></span>benchflow</div>
        <div className="login-message">
          <span className="eyebrow eyebrow-light"><span className="pulse-dot" /> REPAIR OPERATIONS, IN SYNC</span>
          <h1>Good work<br />starts <em>here.</em></h1>
          <p>One calm workspace for every repair, every part, and every person who keeps things moving.</p>
        </div>
        <div className="login-art-footer"><span>BUILT FOR THE PEOPLE BEHIND THE BENCH</span><span>01 — 04</span></div>
        <div className="art-shape art-shape-one" /><div className="art-shape art-shape-two" />
      </div>
      <div className="login-panel">
        <div className="login-top"><span>WORKSPACE ACCESS</span><span className="secure-note"><ShieldCheck size={15} /> SECURE SIGN IN</span></div>
        <form className="login-form" onSubmit={submit}>
          <div className="login-heading"><span className="eyebrow">WELCOME BACK</span><h2>Sign in to your<br />workbench.</h2><p>Your shop’s moving. Let’s pick up where you left off.</p></div>
          <label>Email address<input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@workshop.com" /></label>
          <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary button-wide" disabled={busy}>{busy ? "Signing in…" : "Enter workspace"} <ArrowRight size={17} /></button>
          <p className="login-hint">Your administrator creates staff accounts. Ask your shop manager if you need access.</p>
        </form>
        <div className="login-bottom"><span>BENCHFLOW · REPAIR MANAGEMENT</span><span>HELP & SUPPORT <ArrowRight size={12} /></span></div>
      </div>
    </main>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"ticket" | "customer" | "part" | "complete" | "team" | "restock" | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const canManage = user?.role === "ADMIN" || user?.role === "TECHNICIAN";
  const isAdmin = user?.role === "ADMIN";

  const loadData = useCallback(async (activeUser: User) => {
    setError("");
    try {
      const [ticketData, partData, invoiceData] = await Promise.all([
        api<Ticket[]>("/api/tickets"),
        activeUser.role === "CUSTOMER" ? Promise.resolve([] as Part[]) : api<Part[]>("/api/inventory"),
        api<Invoice[]>("/api/invoices")
      ]);
      setTickets(ticketData);
      setParts(partData);
      setInvoices(invoiceData);
      if (activeUser.role !== "CUSTOMER") {
        setCustomers(await api<Customer[]>("/api/customers"));
      }
      if (activeUser.role === "ADMIN") setTeam(await api<TeamMember[]>("/api/team"));
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not load workspace data.");
    }
  }, []);

  useEffect(() => {
    api<User>("/api/auth/me").then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    const interval = window.setInterval(() => {
      api<User>("/api/auth/me")
        .then((refreshed) => setUser((current) =>
          current && current.id === refreshed.id && current.role === refreshed.role ? current : refreshed
        ))
        .catch(() => setUser(null));
    }, 8 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (user) void loadData(user);
  }, [user, loadData, refreshKey]);

  useEffect(() => {
    if (!user) return;
    const socket: Socket = io(API_URL, { withCredentials: true, transports: ["websocket", "polling"] });
    socket.on("ticket:changed", () => setRefreshKey((value) => value + 1));
    const reconnect = window.setInterval(() => {
      socket.disconnect();
      socket.connect();
    }, 13 * 60 * 1000);
    return () => {
      window.clearInterval(reconnect);
      socket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const filteredTickets = useMemo(() => tickets.filter((ticket) => {
    const query = search.toLowerCase();
    return !query || [ticket.customer_name, ticket.device_type, ticket.issue_description, ticket.id]
      .some((value) => value.toLowerCase().includes(query));
  }), [tickets, search]);

  const openCount = tickets.filter((ticket) => ["OPEN", "IN_PROGRESS", "WAITING_FOR_PARTS"].includes(ticket.status)).length;
  const readyCount = tickets.filter((ticket) => ticket.status === "READY_FOR_PICKUP").length;
  const lowStockCount = parts.filter((part) => part.quantity_on_hand <= 5).length;
  const activeCount = tickets.filter((ticket) => ["IN_PROGRESS", "WAITING_FOR_PARTS"].includes(ticket.status)).length;

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    setTickets([]);
    setCustomers([]);
    setParts([]);
    setInvoices([]);
    setTeam([]);
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setError("");
    try {
      await action();
      setNotice(message);
      setModal(null);
      setSelectedTicket(null);
      setRefreshKey((value) => value + 1);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Something went wrong.");
    }
  }

  if (loading) return <div className="boot-screen"><span className="brand-mark"><Wrench size={18} /></span><span>Preparing your workbench…</span></div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand"><span className="brand-mark"><Wrench size={17} /></span><span>benchflow<small>REPAIR OPERATIONS</small></span><button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={18} /></button></div>
        <div className="shop-switcher"><span className="shop-icon"><Cpu size={17} /></span><span><strong>Northside Repair</strong><small>WORKSPACE</small></span></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {([
            ["Overview", LayoutDashboard],
            ["Tickets", ClipboardList],
            ...(user.role !== "CUSTOMER" ? [["Inventory", Boxes] as const] : []),
            ...(user.role !== "CUSTOMER" ? [["Customers", Users] as const, ["Invoices", ReceiptText] as const] : [["Invoices", ReceiptText] as const]),
            ...(user.role === "ADMIN" ? [["Team", ShieldCheck] as const] : []),
            ["Account", KeyRound]
          ] as const).map(([name, Icon]) => (
            <button key={name} className={`nav-item ${tab === name ? "nav-item-active" : ""}`} onClick={() => { setTab(name as Tab); setMobileMenu(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{name}</span>
              {name === "Tickets" && openCount > 0 && <span className="nav-count">{openCount}</span>}
            </button>
          ))}
        </nav>
        {canManage && <div className="sidebar-note"><div className="note-icon"><Sparkles size={17} /></div><strong>Small things,<br />running smoothly.</strong><p>Keep the bench clear and the next repair close at hand.</p><button onClick={() => setTab("Tickets")}>View open work <ArrowRight size={14} /></button></div>}
        <div className="sidebar-bottom">
          <button className="nav-item muted-nav" onClick={() => setNotice("For help with your account, contact your shop administrator.")}><CircleHelp size={18} /><span>Help & support</span></button>
          <div className="profile-row"><span className="avatar">{initials(user.email)}</span><span className="profile-copy"><strong>{user.email.split("@")[0]}</strong><small>{user.role.toLowerCase()}</small></span><button onClick={signOut} aria-label="Sign out" className="icon-button"><LogOut size={17} /></button></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="mobile-menu" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={20} /></button><span>Northside Repair</span><span className="crumb-divider">/</span><strong>{tab}</strong></div>
          <div className="topbar-actions"><span className="today-label">{new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span><button className="icon-button notification-button" onClick={() => setTab("Tickets")} aria-label="Open repair tickets"><Bell size={18} /></button><span className="topbar-avatar">{initials(user.email)}</span></div>
        </header>

        <div className="content-wrap">
          {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={16} /></button></div>}
          {tab === "Overview" && <Overview
            user={user} tickets={tickets} parts={parts} invoicesCount={invoices.length} openCount={openCount}
            readyCount={readyCount} activeCount={activeCount} lowStockCount={lowStockCount}
            onTab={setTab} onCreate={() => setModal("ticket")} onTicket={(ticket) => { setSelectedTicket(ticket); setTab("Tickets"); }}
          />}
          {tab === "Tickets" && <TicketList
            user={user} tickets={filteredTickets} search={search} onSearch={setSearch}
            onCreate={() => setModal("ticket")}
            onClaim={(ticket) => void run(() => api(`/api/tickets/${ticket.id}/claim`, { method: "POST" }), "Ticket claimed")}
            onComplete={(ticket) => { setSelectedTicket(ticket); setModal("complete"); }}
            onStatus={(ticket, status) => void run(() => api(`/api/tickets/${ticket.id}/status`, {
              method: "PATCH", body: JSON.stringify({ status, version: ticket.version })
            }), `Ticket moved to ${statusLabels[status]}`)}
          />}
          {tab === "Inventory" && <InventoryList
            parts={parts} search={search} onSearch={setSearch} canEdit={isAdmin ?? false}
            onCreate={() => setModal("part")}
            onRestock={(part) => { setSelectedPart(part); setModal("restock"); }}
          />}
          {tab === "Customers" && <CustomerList
            customers={customers} tickets={tickets} search={search} onSearch={setSearch}
            onCreate={() => setModal("customer")}
          />}
          {tab === "Invoices" && <InvoiceList invoices={invoices} canManage={isAdmin ?? false} onStatus={(invoice, status) => void run(
            () => api(`/api/invoices/${invoice.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
            `Invoice marked ${status.toLowerCase()}`
          )} />}
          {tab === "Team" && isAdmin && <TeamList team={team} onCreate={() => setModal("team")} />}
          {tab === "Account" && <AccountPage onSubmit={async (payload) => {
            await api("/api/auth/password", { method: "POST", body: JSON.stringify(payload) });
            setNotice("Password updated");
          }} />}
          <footer className="page-footer"><span>BENCHFLOW <span className="footer-dot">·</span> REPAIR OPERATIONS</span><span><Activity size={13} /> PRIVATE SHOP WORKSPACE</span></footer>
        </div>
      </main>

      {modal && <Modal title={{
        ticket: "Create repair ticket", customer: "Add a customer",
        part: "Add inventory item", complete: "Complete repair", team: "Add a team member",
        restock: "Restock inventory"
      }[modal]} onClose={() => { setModal(null); setSelectedTicket(null); setSelectedPart(null); }}>
        {modal === "ticket" && <TicketForm user={user} customers={customers} onCancel={() => setModal(null)} onSubmit={(payload) => run(
          () => api("/api/tickets", { method: "POST", body: JSON.stringify(payload) }),
          "Repair ticket created"
        )} />}
        {modal === "customer" && <CustomerForm onCancel={() => setModal(null)} onSubmit={(payload) => run(
          () => api("/api/customers", { method: "POST", body: JSON.stringify(payload) }),
          "Customer added to your workspace"
        )} />}
        {modal === "part" && <PartForm onCancel={() => setModal(null)} onSubmit={(payload) => run(
          () => api("/api/inventory", { method: "POST", body: JSON.stringify(payload) }),
          "Inventory item added"
        )} />}
        {modal === "complete" && selectedTicket && <CompleteForm ticket={selectedTicket} parts={parts}
          onCancel={() => { setModal(null); setSelectedTicket(null); }}
          onSubmit={(payload) => run(
            () => api(`/api/tickets/${selectedTicket.id}/complete`, { method: "POST", body: JSON.stringify(payload) }),
            "Repair completed and invoice issued"
          )}
        />}
        {modal === "team" && <TeamForm onCancel={() => setModal(null)} onSubmit={(payload) => run(
          () => api("/api/team", { method: "POST", body: JSON.stringify(payload) }),
          "Team account created"
        )} />}
        {modal === "restock" && selectedPart && <RestockForm part={selectedPart}
          onCancel={() => { setModal(null); setSelectedPart(null); }}
          onSubmit={(quantity) => run(
            () => api(`/api/inventory/${selectedPart.id}`, {
              method: "PATCH", body: JSON.stringify({ quantity_on_hand: quantity })
            }),
            "Inventory quantity updated"
          )}
        />}
      </Modal>}
      {notice && <div className="toast" role="status"><span className="toast-check"><Check size={15} /></span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
    </div>
  );
}

function Overview({
  user, tickets, parts, invoicesCount, openCount, readyCount, activeCount, lowStockCount, onTab, onCreate, onTicket
}: {
  user: User; tickets: Ticket[]; parts: Part[]; invoicesCount: number; openCount: number; readyCount: number;
  activeCount: number; lowStockCount: number; onTab: (tab: Tab) => void;
  onCreate: () => void; onTicket: (ticket: Ticket) => void;
}) {
  const firstName = user.email.split("@")[0].split(/[._-]/)[0];
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  const recent = tickets.slice(0, 5);
  const customer = user.role === "CUSTOMER";
  return <>
    <section className="welcome-row"><div><span className="eyebrow"><span className="pulse-dot" /> YOUR SHOP, AT A GLANCE</span><h1>{greeting}, {firstName}.</h1><p>Here’s what’s happening at the bench today.</p></div><button className="button button-primary" onClick={onCreate}><Plus size={17} /> New repair ticket</button></section>
    <section className="metric-grid" aria-label="Repair metrics">
      <Metric label="Open tickets" value={openCount} change="Needs a pair of hands" icon={<ClipboardList size={18} />} tone="lavender" onClick={() => onTab("Tickets")} />
      <Metric label="On the bench" value={activeCount} change="Currently being worked on" icon={<Wrench size={18} />} tone="blue" onClick={() => onTab("Tickets")} />
      <Metric label="Ready for pickup" value={readyCount} change="Waiting for their owners" icon={<Check size={18} />} tone="green" onClick={() => onTab("Tickets")} />
      {customer
        ? <Metric label="Your invoices" value={invoicesCount} change="Available in your portal" icon={<ReceiptText size={18} />} tone="orange" onClick={() => onTab("Invoices")} />
        : <Metric label="Parts to watch" value={lowStockCount} change="5 or fewer in stock" icon={<Boxes size={18} />} tone="orange" onClick={() => onTab("Inventory")} />}
    </section>
    <section className="overview-grid">
      <div className="surface recent-surface">
        <div className="section-heading"><div><span className="eyebrow">THE LATEST</span><h2>Recent repairs</h2></div><button className="text-button" onClick={() => onTab("Tickets")}>All tickets <ArrowRight size={14} /></button></div>
        {recent.length ? <div className="recent-list">{recent.map((ticket, index) => <button className="recent-row" key={ticket.id} onClick={() => onTicket(ticket)}>
          <span className={`device-icon device-${index % 4}`}>{ticket.device_type.toLowerCase().includes("phone") ? <Smartphone size={17} /> : <Cpu size={17} />}</span>
          <span className="recent-main"><strong>{ticket.customer_name}</strong><small>{ticket.device_type} <span>·</span> {ticket.issue_description}</small></span>
          <span className={`status-pill status-${ticket.status.toLowerCase()}`}>{statusLabels[ticket.status] ?? ticket.status}</span>
          <ArrowRight className="row-arrow" size={15} />
        </button>)}</div> : <EmptyState title="A clean slate." detail="New repair requests will show up here." />}
        <button className="surface-footer" onClick={() => onTab("Tickets")}>Open ticket board <ArrowRight size={14} /></button>
      </div>
      {!customer ? <div className="surface side-surface">
        <div className="section-heading"><div><span className="eyebrow">KEEP AN EYE ON</span><h2>Parts shelf</h2></div><button className="mini-icon-button" onClick={() => onTab("Inventory")} aria-label="Open inventory"><ArrowRight size={15} /></button></div>
        {parts.filter((part) => part.quantity_on_hand <= 5).slice(0, 4).length
          ? <div className="stock-list">{parts.filter((part) => part.quantity_on_hand <= 5).slice(0, 4).map((part) => <div className="stock-row" key={part.id}><span className="stock-indicator" /><span className="stock-name"><strong>{part.name}</strong><small>{part.sku}</small></span><span className={`stock-count ${part.quantity_on_hand === 0 ? "stock-zero" : ""}`}>{part.quantity_on_hand}<small>left</small></span></div>)}</div>
          : <EmptyState title="Stock looks good." detail="Low-stock items will be flagged here." />}
        <button className="surface-footer" onClick={() => onTab("Inventory")}>View inventory <ArrowRight size={14} /></button>
      </div> : <div className="surface side-surface customer-portal-card">
        <div className="section-heading"><div><span className="eyebrow">YOUR REPAIR JOURNEY</span><h2>We’ll keep you posted.</h2></div><span className="customer-portal-icon"><Smartphone size={18} /></span></div>
        <p>Check your repair tickets for the latest status. When a repair is ready, your invoice will appear here too.</p>
        <button className="surface-footer" onClick={() => onTab("Invoices")}>View your invoices <ArrowRight size={14} /></button>
      </div>}
    </section>
    <section className="bottom-note"><div className="bottom-note-icon"><Clock3 size={18} /></div><div><strong>One thing at a time.</strong><span>Small, steady progress keeps every repair moving.</span></div><button onClick={() => onTab("Tickets")}>See what’s next <ArrowRight size={14} /></button></section>
  </>;
}

function Metric({ label, value, change, icon, tone, onClick }: {
  label: string; value: number; change: string; icon: ReactNode;
  tone: string; onClick: () => void;
}) {
  return <button className="metric-card" onClick={onClick}><span className={`metric-icon metric-${tone}`}>{icon}</span><span className="metric-label">{label}</span><strong className="metric-value">{value.toString().padStart(2, "0")}</strong><span className="metric-change">{change}</span><ArrowRight className="metric-arrow" size={15} /></button>;
}

function TicketList({ user, tickets, search, onSearch, onCreate, onClaim, onComplete, onStatus }: {
  user: User; tickets: Ticket[]; search: string; onSearch: (value: string) => void;
  onCreate: () => void; onClaim: (ticket: Ticket) => void;
  onComplete: (ticket: Ticket) => void; onStatus: (ticket: Ticket, status: string) => void;
}) {
  const [filter, setFilter] = useState("All");
  const visible = tickets.filter((ticket) => filter === "All" || ticket.status === filter);
  return <section className="list-page">
    <div className="page-heading"><div><span className="eyebrow">REPAIR WORKFLOW</span><h1>Ticket board</h1><p>Every repair, from first hello to ready for pickup.</p></div>{user.role !== "CUSTOMER" && <button className="button button-primary" onClick={onCreate}><Plus size={17} /> New ticket</button>}</div>
    <div className="list-toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search repairs, customers…" /></div><div className="filter-pills">{["All", "OPEN", "IN_PROGRESS", "WAITING_FOR_PARTS", "READY_FOR_PICKUP"].map((status) => <button key={status} className={filter === status ? "filter-active" : ""} onClick={() => setFilter(status)}>{status === "All" ? "All tickets" : statusLabels[status]}</button>)}</div></div>
    <div className="ticket-list">{visible.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} user={user} onClaim={onClaim} onComplete={onComplete} onStatus={onStatus} />)}</div>
    {!visible.length && <div className="surface empty-list"><EmptyState title="Nothing on this bench." detail="Try another filter, or create a new repair ticket." />{user.role !== "CUSTOMER" && <button className="button button-secondary" onClick={onCreate}><Plus size={15} /> Create a ticket</button>}</div>}
  </section>;
}

function TicketCard({ ticket, user, onClaim, onComplete, onStatus }: {
  ticket: Ticket; user: User; onClaim: (ticket: Ticket) => void;
  onComplete: (ticket: Ticket) => void; onStatus: (ticket: Ticket, status: string) => void;
}) {
  const staff = user.role === "ADMIN" || user.role === "TECHNICIAN";
  const canWork = user.role === "ADMIN" || ticket.assigned_to === user.id;
  return <article className="ticket-card">
    <div className="ticket-top"><span className="ticket-reference">{shortId(ticket.id)} <span>·</span> {new Date(ticket.created_at).toLocaleDateString()}</span><span className={`status-pill status-${ticket.status.toLowerCase()}`}>{statusLabels[ticket.status] ?? ticket.status}</span></div>
    <div className="ticket-core"><span className="ticket-device-icon"><Cpu size={20} /></span><div className="ticket-copy"><h3>{ticket.device_type}</h3><p>{ticket.issue_description}</p></div><div className="ticket-customer"><span className="customer-avatar">{initials(ticket.customer_name)}</span><span><strong>{ticket.customer_name}</strong><small>{ticket.customer_phone}</small></span></div><div className="ticket-estimate"><small>ESTIMATE</small><strong>{money(ticket.estimated_cost)}</strong></div></div>
    <div className="ticket-bottom"><span className="assigned-label">{ticket.assigned_email ? <><span className="assignee-dot" /> {ticket.assigned_email}</> : <><span className="assignee-empty" /> Waiting for a technician</>}</span><div className="ticket-actions">
      {staff && ticket.status === "OPEN" && !ticket.assigned_to && <button className="button button-small button-secondary" onClick={() => onClaim(ticket)}>Assign to me</button>}
      {staff && canWork && ticket.status === "IN_PROGRESS" && <button className="button button-small button-primary" onClick={() => onComplete(ticket)}><Check size={14} /> Complete repair</button>}
      {staff && canWork && ticket.status === "IN_PROGRESS" && <button className="text-button" onClick={() => onStatus(ticket, "WAITING_FOR_PARTS")}>Need parts</button>}
      {staff && canWork && ticket.status === "WAITING_FOR_PARTS" && <button className="button button-small button-secondary" onClick={() => onStatus(ticket, "IN_PROGRESS")}>Resume work</button>}
      {staff && canWork && ticket.status === "READY_FOR_PICKUP" && <button className="button button-small button-secondary" onClick={() => onStatus(ticket, "PICKED_UP")}>Mark picked up</button>}
    </div></div>
  </article>;
}

function InventoryList({ parts, search, onSearch, canEdit, onCreate, onRestock }: {
  parts: Part[]; search: string; onSearch: (value: string) => void;
  canEdit: boolean; onCreate: () => void; onRestock: (part: Part) => void;
}) {
  const filtered = parts.filter((part) => `${part.name} ${part.sku}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="list-page">
    <div className="page-heading"><div><span className="eyebrow">THE PARTS SHELF</span><h1>Inventory</h1><p>Know what’s in stock before the repair needs it.</p></div>{canEdit && <button className="button button-primary" onClick={onCreate}><Plus size={17} /> Add item</button>}</div>
    <div className="list-toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search parts or SKU…" /></div><span className="table-count">{parts.length} active items</span></div>
    <div className="surface inventory-table"><div className={`table-head ${canEdit ? "table-head-admin" : ""}`}><span>PART</span><span>SKU</span><span>IN STOCK</span><span>UNIT PRICE</span><span>STATUS</span>{canEdit && <span />}</div>
      {filtered.map((part) => <div className={`table-row ${canEdit ? "table-row-admin" : ""}`} key={part.id}><span className="table-part"><span className="part-icon"><Cpu size={16} /></span><strong>{part.name}</strong></span><span className="sku-cell">{part.sku}</span><span className="quantity-cell">{part.quantity_on_hand}</span><span className="price-cell">{money(part.unit_price)}</span><span><span className={`stock-status ${part.quantity_on_hand === 0 ? "stock-status-out" : part.quantity_on_hand <= 5 ? "stock-status-low" : "stock-status-good"}`}><i />{part.quantity_on_hand === 0 ? "Out of stock" : part.quantity_on_hand <= 5 ? "Low stock" : "In stock"}</span></span>{canEdit && <button className="restock-button" onClick={() => onRestock(part)}><Plus size={13} /> Restock</button>}</div>)}
      {!filtered.length && <EmptyState title="No parts found." detail="Try another search or add a new item." />}
    </div>
  </section>;
}

function CustomerList({ customers, tickets, search, onSearch, onCreate }: {
  customers: Customer[]; tickets: Ticket[]; search: string; onSearch: (value: string) => void; onCreate: () => void;
}) {
  const filtered = customers.filter((customer) => `${customer.name} ${customer.phone}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="list-page">
    <div className="page-heading"><div><span className="eyebrow">PEOPLE FIRST</span><h1>Customers</h1><p>A little context makes every repair feel personal.</p></div><button className="button button-primary" onClick={onCreate}><Plus size={17} /> Add customer</button></div>
    <div className="list-toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search customers…" /></div><span className="table-count">{customers.length} people</span></div>
    <div className="customer-grid">{filtered.map((customer, index) => <article className="customer-card" key={customer.id}><div className={`large-avatar avatar-tone-${index % 4}`}>{initials(customer.name)}</div><div className="customer-card-main"><h3>{customer.name}</h3><span>{customer.phone}</span><small>{tickets.filter((ticket) => ticket.customer_id === customer.id).length} repair tickets</small></div><button className="mini-icon-button" aria-label={`View ${customer.name}`}><ArrowRight size={15} /></button></article>)}</div>
    {!filtered.length && <div className="surface empty-list"><EmptyState title="No customers just yet." detail="Add your first customer when a repair comes through." /></div>}
  </section>;
}

function InvoiceList({ invoices, canManage, onStatus }: {
  invoices: Invoice[]; canManage: boolean; onStatus: (invoice: Invoice, status: "PAID" | "VOID") => void;
}) {
  return <section className="list-page">
    <div className="page-heading"><div><span className="eyebrow">CLEAR, COMPLETE RECORDS</span><h1>Invoices</h1><p>Every issued invoice, together in one place.</p></div></div>
    <div className="list-toolbar"><span className="table-count">{invoices.length} issued invoices</span></div>
    <div className="surface invoice-table">
      <div className="invoice-head"><span>INVOICE</span><span>CUSTOMER</span><span>ISSUED</span><span>STATUS</span><span>TOTAL</span></div>
      {invoices.map((invoice) => <div className={`invoice-row ${canManage ? "invoice-row-admin" : ""}`} key={invoice.id}>
        <span className="invoice-reference">{shortId(invoice.id)}</span>
        <span className="invoice-customer">{invoice.customer_name}<small>{shortId(invoice.ticket_id)}</small></span>
        <span className="invoice-date">{new Date(invoice.issued_at).toLocaleDateString()}</span>
        <span><span className={`invoice-status invoice-${invoice.status.toLowerCase()}`}>{invoice.status.toLowerCase()}</span></span>
        <strong className="invoice-total-cell">{new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(invoice.total)}</strong>
        {canManage && invoice.status === "ISSUED" && <button className="invoice-paid-button" onClick={() => onStatus(invoice, "PAID")}>Mark paid</button>}
      </div>)}
      {!invoices.length && <EmptyState title="No invoices issued yet." detail="Invoices will be recorded here when a repair is completed." />}
    </div>
  </section>;
}

function TeamList({ team, onCreate }: { team: TeamMember[]; onCreate: () => void }) {
  return <section className="list-page">
    <div className="page-heading"><div><span className="eyebrow">THE PEOPLE BEHIND THE BENCH</span><h1>Team access</h1><p>Manage who can access your repair workspace.</p></div><button className="button button-primary" onClick={onCreate}><Plus size={17} /> Add team member</button></div>
    <div className="list-toolbar"><span className="table-count">{team.length} staff accounts</span><span className="permission-note"><ShieldCheck size={14} /> Admin-only access</span></div>
    <div className="surface team-list">{team.map((member, index) => <div className="team-row" key={member.id}>
      <span className={`large-avatar avatar-tone-${index % 4}`}>{initials(member.email)}</span>
      <span className="team-identity"><strong>{member.email}</strong><small>Added {new Date(member.created_at).toLocaleDateString()}</small></span>
      <span className={`team-role team-${member.role.toLowerCase()}`}>{member.role.toLowerCase()}</span>
      <span className="team-active"><i /> {member.is_active ? "Active" : "Inactive"}</span>
    </div>)}
    {!team.length && <EmptyState title="Your team starts here." detail="Create an account for each technician and administrator." />}</div>
  </section>;
}

function TicketForm({ user, customers, onCancel, onSubmit }: {
  user: User; customers: Customer[]; onCancel: () => void; onSubmit: (payload: object) => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [device, setDevice] = useState("");
  const [serial, setSerial] = useState("");
  const [issue, setIssue] = useState("");
  const [estimate, setEstimate] = useState("");
  const [busy, setBusy] = useState(false);
  const isCustomer = user.role === "CUSTOMER";
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    await onSubmit({
      ...(isCustomer ? {} : { customer_id: customerId }),
      device_type: device, serial_number: serial || undefined, issue_description: issue,
      ...(!isCustomer && estimate ? { estimated_cost: Number(estimate) } : {})
    });
    setBusy(false);
  }
  return <form className="modal-form" onSubmit={submit}>
    {!isCustomer && <label>Customer<select required value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Choose a customer</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name} · {customer.phone}</option>)}</select></label>}
    <label>Device type<input required maxLength={100} value={device} onChange={(e) => setDevice(e.target.value)} placeholder="e.g. MacBook Pro 14″" /></label>
    <label>Serial number <span className="optional-label">OPTIONAL · ENCRYPTED</span><input value={serial} maxLength={200} onChange={(e) => setSerial(e.target.value)} placeholder="Found on the device label" /></label>
    <label>What needs attention?<textarea required maxLength={4000} rows={3} value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Describe the issue in the customer's words…" /></label>
    {!isCustomer && <label>Estimated cost <span className="optional-label">OPTIONAL · USD</span><input type="number" min="0" step="0.01" value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="0.00" /></label>}
    <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Cancel</button><button disabled={busy} className="button button-primary">{busy ? "Creating…" : "Create ticket"} <ArrowRight size={15} /></button></div>
  </form>;
}

function CustomerForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (payload: object) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    await onSubmit({
      name, phone,
      ...(address ? { address } : {}),
      ...(email && password ? { email, password } : {})
    });
    setBusy(false);
  }
  return <form className="modal-form" onSubmit={submit}>
    <label>Full name<input required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Morgan" /></label>
    <label>Phone number<input type="tel" required minLength={7} maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" /></label>
    <label>Address <span className="optional-label">OPTIONAL · ENCRYPTED</span><textarea rows={2} maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, postal code" /></label>
    <div className="account-optional"><span className="form-section-label">CUSTOMER PORTAL <span>OPTIONAL</span></span><p>Create a customer sign-in so they can view their own tickets and invoices.</p>
      <label>Email<input type="email" maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" /></label>
      <label>Initial password<input type="password" minLength={12} maxLength={128} autoComplete="new-password" required={Boolean(email)} disabled={!email} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 12 characters" /></label>
    </div>
    <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Cancel</button><button disabled={busy} className="button button-primary">{busy ? "Saving…" : "Save customer"} <ArrowRight size={15} /></button></div>
  </form>;
}

function PartForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (payload: object) => void }) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    await onSubmit({ sku, name, quantity_on_hand: Number(quantity), unit_price: Number(price) });
    setBusy(false);
  }
  return <form className="modal-form" onSubmit={submit}>
    <label>Part name<input required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. USB-C charging port" /></label>
    <label>SKU<input required maxLength={80} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. PORT-USBC-02" /></label>
    <div className="form-columns"><label>Quantity<input type="number" min="0" step="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" /></label><label>Unit price (USD)<input type="number" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" /></label></div>
    <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Cancel</button><button disabled={busy} className="button button-primary">{busy ? "Adding…" : "Add to inventory"} <ArrowRight size={15} /></button></div>
  </form>;
}

function RestockForm({ part, onCancel, onSubmit }: {
  part: Part; onCancel: () => void; onSubmit: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(String(part.quantity_on_hand));
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    await onSubmit(Number(quantity));
    setBusy(false);
  }
  return <form className="modal-form" onSubmit={submit}>
    <div className="completion-summary"><span className="part-icon"><Cpu size={17} /></span><span><strong>{part.name}</strong><small>{part.sku} · {part.quantity_on_hand} currently in stock</small></span></div>
    <label>New stock quantity<input type="number" required min="0" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
    <p className="restock-description">Enter the total quantity after the delivery is counted.</p>
    <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Cancel</button><button disabled={busy} className="button button-primary">{busy ? "Updating…" : "Update stock"} <Check size={15} /></button></div>
  </form>;
}

function TeamForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (payload: object) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"TECHNICIAN" | "ADMIN">("TECHNICIAN");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    await onSubmit({ email, password, role });
    setBusy(false);
  }
  return <form className="modal-form" onSubmit={submit}>
    <div className="security-hint"><ShieldCheck size={16} /><span>Share the initial password securely. Ask the new teammate to change it after signing in.</span></div>
    <label>Work email<input type="email" required maxLength={320} autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@workshop.com" /></label>
    <label>Initial password<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 12 characters" /></label>
    <label>Role<select value={role} onChange={(e) => setRole(e.target.value as "TECHNICIAN" | "ADMIN")}><option value="TECHNICIAN">Technician</option><option value="ADMIN">Administrator</option></select></label>
    <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Cancel</button><button disabled={busy} className="button button-primary">{busy ? "Creating…" : "Create account"} <ArrowRight size={15} /></button></div>
  </form>;
}

function AccountPage({ onSubmit }: { onSubmit: (payload: object) => Promise<void> }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ current_password: current, new_password: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      setSaved(true);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }
  return <section className="list-page">
    <div className="page-heading"><div><span className="eyebrow">YOUR PERSONAL SETTINGS</span><h1>Account security</h1><p>Keep your workspace access in your hands.</p></div></div>
    <div className="surface account-panel"><div className="section-heading"><div><span className="eyebrow">PASSWORD</span><h2>Change your password</h2></div><span className="account-shield"><ShieldCheck size={19} /></span></div>
      <p className="account-description">Choose a strong password with at least 12 characters. Your new password is securely hashed before it is stored.</p>
      <form className="account-form" onSubmit={submit}>
        <label>Current password<input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
        <label>New password<input type="password" required minLength={12} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></label>
        <label>Confirm new password<input type="password" required minLength={12} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {saved && <p className="form-success" role="status">Your password has been updated.</p>}
        <button className="button button-primary" disabled={busy}>{busy ? "Updating…" : "Update password"} <ArrowRight size={15} /></button>
      </form>
    </div>
  </section>;
}

function CompleteForm({ ticket, parts, onCancel, onSubmit }: {
  ticket: Ticket; parts: Part[]; onCancel: () => void; onSubmit: (payload: object) => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [labor, setLabor] = useState("");
  const [tax, setTax] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = Object.entries(quantities).filter(([, quantity]) => quantity > 0);
  const partsTotal = chosen.reduce((sum, [id, quantity]) => sum + (parts.find((part) => part.id === id)?.unit_price ?? 0) * quantity, 0);
  const total = partsTotal + Number(labor || 0) + Number(tax || 0);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    await onSubmit({
      parts: chosen.map(([inventory_id, quantity]) => ({ inventory_id, quantity })),
      labor: Number(labor || 0), tax: Number(tax || 0), currency: "USD"
    });
    setBusy(false);
  }
  return <form className="modal-form" onSubmit={submit}>
    <div className="completion-summary"><span className="ticket-device-icon"><Cpu size={20} /></span><span><strong>{ticket.device_type}</strong><small>{ticket.customer_name} · {shortId(ticket.id)}</small></span><span className="completion-ready">READY WHEN YOU ARE</span></div>
    <span className="form-section-label">PARTS USED <span>OPTIONAL</span></span>
    <div className="parts-picker">{parts.filter((part) => part.quantity_on_hand > 0).map((part) => <label className="part-pick-row" key={part.id}><span><strong>{part.name}</strong><small>{part.quantity_on_hand} available · {money(part.unit_price)} each</small></span><input aria-label={`Quantity of ${part.name}`} type="number" min="0" max={part.quantity_on_hand} value={quantities[part.id] ?? 0} onChange={(e) => setQuantities({ ...quantities, [part.id]: Number(e.target.value) })} /></label>)}
      {!parts.some((part) => part.quantity_on_hand > 0) && <span className="no-parts">No parts are currently in stock.</span>}
    </div>
    <div className="form-columns"><label>Labor (USD)<input type="number" min="0" step="0.01" required value={labor} onChange={(e) => setLabor(e.target.value)} placeholder="0.00" /></label><label>Tax (USD)<input type="number" min="0" step="0.01" required value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0.00" /></label></div>
    <div className="invoice-total"><span>Invoice total</span><strong>{money(total)}</strong></div>
    <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Not yet</button><button disabled={busy} className="button button-primary">{busy ? "Finishing repair…" : "Complete & issue invoice"} <Check size={15} /></button></div>
  </form>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-heading"><div><span className="eyebrow">BENCHFLOW WORKSPACE</span><h2 id="modal-title">{title}</h2></div><button className="modal-close" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>
      {children}
    </section>
  </div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span className="empty-icon"><Grid2X2 size={19} /></span><strong>{title}</strong><p>{detail}</p></div>;
}
