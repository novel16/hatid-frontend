"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  ChartColumnIncreasing,
  ChevronRight,
  CircleHelp,
  CloudCheck,
  CloudOff,
  LayoutDashboard,
  Menu,
  Package,
  Plus,
  Route,
  Search,
  Settings,
  Store,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { usePrototypeState } from "@/lib/prototype/store";
import { Avatar, Badge, Brand, Modal } from "./ui";
import { useActions } from "./providers";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/batches", label: "Weekly batches", icon: BookOpen },
  { href: "/deliveries", label: "Deliveries", icon: Package },
  { href: "/map", label: "Route & map", icon: Route },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/sellers", label: "Sellers", icon: Store },
  { href: "/collections", label: "Collections", icon: Wallet },
  {
    href: "/earnings",
    label: "Earnings & reports",
    icon: ChartColumnIncreasing,
  },
];

/** Uses verified account identity/preferences while keeping sample workspace state separate. */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const state = usePrototypeState();
  const { session } = useActions();
  const riderName = session?.user.name ?? state.settings.riderName;
  const compactView =
    session?.user.preferences.compactView ?? state.settings.compactView;
  const searchRef = useRef<HTMLInputElement>(null);
  const path = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);
  const pending = state.parcels.filter(
    (parcel) =>
      parcel.batchId === state.selectedBatchId && parcel.status === "pending",
  ).length;
  const matches =
    query.trim().length > 1
      ? state.customers
          .filter((customer) =>
            customer.name.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 4)
      : [];
  const current =
    links.find((link) => path.startsWith(link.href))?.label ??
    (path.startsWith("/reports")
      ? "Earnings & reports"
      : path.startsWith("/parcels")
        ? "New parcel"
        : path.startsWith("/settings")
          ? "Settings"
          : path.startsWith("/sync")
            ? "Offline & sync"
            : "Notifications");

  return (
    <div className={`workspace ${compactView ? "workspace-compact" : ""}`}>
      {menuOpen && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-logo">
          <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
            <Brand light />
          </Link>
          <button
            className="icon-button sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={21} />
          </button>
        </div>
        <div className="workspace-selector">
          <span className="workspace-selector-icon">
            <Package size={17} />
          </span>
          <div>
            <strong>Rider workspace</strong>
            <span>Personal delivery manager</span>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={
                path.startsWith(href) ? "nav-link nav-link-active" : "nav-link"
              }
              aria-current={path.startsWith(href) ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
              {href === "/deliveries" && pending > 0 && (
                <b className="nav-count">{pending}</b>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            href="/settings"
            onClick={() => setMenuOpen(false)}
            className={`nav-link ${path.startsWith("/settings") ? "nav-link-active" : ""}`}
          >
            <Settings size={19} />
            <span>Settings</span>
          </Link>
          <button className="nav-link" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={19} />
            <span>Quick guide</span>
            <ArrowUpRight size={14} />
          </button>
          <Link href="/settings" className="sidebar-profile">
            <Avatar name={riderName} color="sage" small />
            <div>
              <strong>{riderName}</strong>
              <span>Independent rider</span>
            </div>
            <ChevronRight size={15} />
          </Link>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Prototype <ChevronRight size={13} />
              <strong>{current}</strong>
            </span>
          </div>
          <form
            className="global-search"
            onSubmit={(event) => {
              event.preventDefault();
              router.push(`/deliveries?search=${encodeURIComponent(query)}`);
              setQuery("");
            }}
          >
            <Search size={17} />
            <input
              ref={searchRef}
              aria-label="Search customers or deliveries"
              placeholder="Search anything..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <kbd>Ctrl K</kbd>
            {matches.length > 0 && (
              <div className="search-suggestions">
                {matches.map((customer) => {
                  const parcel = state.parcels.find(
                    (item) => item.customerId === customer.id,
                  );
                  return (
                    <Link
                      key={customer.id}
                      href={parcel ? `/deliveries/${parcel.id}` : "/customers"}
                      onClick={() => setQuery("")}
                    >
                      <Avatar
                        name={customer.name}
                        color={customer.color}
                        small
                      />
                      <span>
                        <strong>{customer.name}</strong>
                        <small>{customer.addresses[0]?.text}</small>
                      </span>
                      <ChevronRight size={15} />
                    </Link>
                  );
                })}
              </div>
            )}
          </form>
          <div className="topbar-actions">
            <Link
              href="/sync"
              className={`sync-status ${state.offline ? "is-offline" : ""}`}
              title="Open sync status"
            >
              {state.offline ? (
                <CloudOff size={16} />
              ) : (
                <CloudCheck size={16} />
              )}
              <span>{state.offline ? "Offline" : "All changes saved"}</span>
            </Link>
            <Link
              className="icon-button notification-button"
              href="/notifications"
              aria-label="Open notifications"
            >
              <Bell size={20} />
              {!state.notificationsRead && <i />}
            </Link>
            <Link
              className="top-avatar"
              href="/settings"
              aria-label="Open rider profile"
            >
              <Avatar name={riderName} color="sage" small />
            </Link>
          </div>
        </header>
        <main id="main-content" className="page-content">
          {state.offline && (
            <div className="offline-banner">
              <CloudOff size={17} />
              <span>You’re offline. Changes stay on this device.</span>
              <Link href="/sync">
                View {state.pendingChanges} local changes
                <ChevronRight size={14} />
              </Link>
            </div>
          )}
          {children}
          <footer className="workspace-footer">
            <span>Made for the way you deliver.</span>
            <Badge tone="green">Interactive prototype · sample data</Badge>
            <Link href="/welcome">
              Take a quick tour
              <ArrowUpRight size={12} />
            </Link>
          </footer>
        </main>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {[
          { href: "/dashboard", label: "Home", icon: LayoutDashboard },
          { href: "/deliveries", label: "Deliveries", icon: Package },
          { href: "/parcels/new", label: "Add parcel", icon: Plus },
          { href: "/map", label: "Route", icon: Route },
          { href: "/collections", label: "Money", icon: Wallet },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`${path.startsWith(href) ? "active" : ""} ${href === "/parcels/new" ? "mobile-add" : ""}`}
          >
            <span>
              <Icon size={21} />
            </span>
            <small>{label}</small>
          </Link>
        ))}
      </nav>
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="A little guide to your day"
        description="Everything starts with a parcel."
      >
        <div className="dialog-body guide-steps">
          <div>
            <span>01</span>
            <div>
              <h3>Add your parcels</h3>
              <p>
                Choose a weekly batch, customer and seller. Review the fee
                breakdown before saving.
              </p>
            </div>
          </div>
          <div>
            <span>02</span>
            <div>
              <h3>Take it one stop at a time</h3>
              <p>
                Pick a suggested customer or choose your next stop manually. An
                unknown location never blocks delivery.
              </p>
            </div>
          </div>
          <div>
            <span>03</span>
            <div>
              <h3>Confirm, collect, keep moving</h3>
              <p>
                Record each parcel and its payment. Save the customer pin only
                if you choose to.
              </p>
            </div>
          </div>
          <div>
            <span>04</span>
            <div>
              <h3>Settle with your sellers</h3>
              <p>
                Your fee is retained. Record a handover for the seller’s share
                after you complete it.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
