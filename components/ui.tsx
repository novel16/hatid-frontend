"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Package,
  PackageOpen,
  X,
} from "lucide-react";
import { VEHICLE_LABELS } from "@/lib/api";
import { initials } from "@/lib/prototype/domain";
import type { ParcelStatus } from "@/lib/prototype/types";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-mark">
        <Package size={23} strokeWidth={1.8} />
      </span>
      <span>
        hatid<span className="brand-period">.</span>
      </span>
    </span>
  );
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
        disabled={props.disabled}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

/** Keep vehicle choices identical in registration and the rider's editable Settings profile. */
export function VehicleSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props}>
      <option value="" disabled>
        Choose your vehicle
      </option>
      {Object.entries(VEHICLE_LABELS).map(
        /** Show the same vehicle labels as the rider map. */
        ([vehicle, label]) => (
          <option key={vehicle} value={vehicle}>
            {label}
          </option>
        ),
      )}
    </select>
  );
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      type="button"
      className={`button button-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`button button-${variant} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}

export function Badge({
  children,
  tone = "gray",
  dot = false,
}: {
  children: ReactNode;
  tone?: "gray" | "green" | "amber" | "red" | "blue" | "purple";
  dot?: boolean;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <i />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: ParcelStatus | "partial" }) {
  const labels = {
    pending: "To deliver",
    delivered: "Delivered",
    held: "On hold",
    failed: "Failed",
    returned: "Returned",
    partial: "Partial delivery",
  };
  const tones = {
    pending: "gray",
    delivered: "green",
    held: "amber",
    failed: "red",
    returned: "purple",
    partial: "blue",
  } as const;
  return (
    <Badge tone={tones[status]} dot>
      {labels[status]}
    </Badge>
  );
}

export function Avatar({
  name,
  color = "sage",
  small = false,
}: {
  name: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar avatar-${color} ${small ? "avatar-small" : ""}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}

export function Card({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-heading">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <PackageOpen size={26} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

/** Shares a native modal shell, including guarded dismissal during an unresolved save. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
  drawer = false,
  className = "",
  closeDisabled = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  drawer?: boolean;
  className?: string;
  closeDisabled?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""} ${drawer ? "dialog-drawer" : ""} ${className}`}
      aria-labelledby={id}
      onCancel={
        /** Escape belongs to the top modal and cannot discard a pending save. */ (
          event,
        ) => {
          event.preventDefault();
          event.stopPropagation();
          if (!closeDisabled) onClose();
        }
      }
      onClick={
        /** Only a dismissible modal's own backdrop closes it. */ (event) => {
          if (!closeDisabled && event.target === event.currentTarget) onClose();
        }
      }
    >
      <div className="dialog-inner">
        <header className="dialog-header">
          <div>
            <h2 id={id}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={closeDisabled}
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  required = false,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <b className="required"> *</b>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

export function CheckField({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="check-field">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="checkbox-ui">{checked && <Check size={12} />}</span>
      <span>{children}</span>
    </label>
  );
}

export function SectionLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="text-link" href={href}>
      {children}
      <ArrowRight size={15} />
    </Link>
  );
}

/** Formats explicit demo rows safely, then reuses the same download path as actual server reports. */
export function exportCsv(filename: string, rows: (string | number)[][]): void {
  const csv = rows
    .map((row) =>
      row
        .map((item) => {
          const value = String(item);
          const safe = /^\s*[=+@-]/.test(value) ? `'${value}` : value;
          return `"${safe.replaceAll('"', '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
  downloadFile(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    filename,
  );
}

/** Shares browser downloads for server-authenticated CSV blobs and explicit prototype exports. */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(
    /** Release the temporary URL after the browser starts its download. */ () =>
      URL.revokeObjectURL(url),
    1000,
  );
}
