"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, MonitorSmartphone, RefreshCw } from "lucide-react";
import { useActions } from "@/components/providers";
import { Pagination, PaginationEntries } from "@/components/pagination";
import { Badge, Button, Card, EmptyState, Modal } from "@/components/ui";
import { errorMessage, type ApiToken, type PaginatedResponse } from "@/lib/api";
import type { PaginationState } from "@/lib/pagination";
import { formatDate } from "@/lib/prototype/domain";

/** Pages real account sign-ins and confirms any token revocation before sending it. */
export function DevicesPanel() {
  const { request, revokeDevice, signOutEverywhere, notify } = useActions();
  const router = useRouter();
  const [page, setPage] = useState<PaginationState>({ page: 1, perPage: 10 });
  const [result, setResult] = useState<PaginatedResponse<ApiToken> | null>(
    null,
  );
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<ApiToken | "all" | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  /** Fetches only the selected server page and ignores results after navigation/account changes. */
  useEffect(() => {
    let active = true;
    request<PaginatedResponse<ApiToken>>(
      `/auth/tokens?page=${page.page}&per_page=${page.perPage}`,
    )
      .then(
        /** Removing the final item on a page moves to the last remaining server page. */
        (response) => {
          if (!active) return;
          if (page.page > Math.max(1, response.meta.last_page)) {
            setPage({ ...page, page: Math.max(1, response.meta.last_page) });
            return;
          }
          setResult(response);
          setLoading(false);
        },
      )
      .catch(
        /** Failed loads remain retryable without presenting stale rows as current. */
        (cause: unknown) => {
          if (!active) return;
          setError(errorMessage(cause));
          setLoading(false);
        },
      );
    /** Unmounted or superseded requests must not replace a newer list. */
    return () => {
      active = false;
    };
  }, [request, page, revision]);

  /** Reuses the selected size for refresh and lets shared pagination reset size changes to page one. */
  function loadPage(next = page) {
    setLoading(true);
    setError("");
    setPage(next);
    setRevision(
      /** A refresh can request the same page without creating a polling loop. */
      (current) => current + 1,
    );
  }

  /** Opens the shared modal without revoking access until the rider confirms. */
  function confirmSignOut(device: ApiToken | "all") {
    setActionError("");
    setTarget(device);
  }

  /** Leaves failures visible for retry; successful current/all-device revocation ends local access. */
  async function signOutConfirmed() {
    if (!target || busy) return;
    setBusy(true);
    setActionError("");
    try {
      if (target === "all") {
        await signOutEverywhere();
      } else {
        await revokeDevice(target);
      }
      notify(
        target === "all" ? "Signed out on all devices." : "Device signed out.",
      );
      setTarget(null);
      if (target === "all" || target.is_current) router.replace("/login");
      else loadPage();
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const controls = {
    page: result?.meta.current_page ?? page.page,
    perPage: page.perPage,
    total: result?.meta.total ?? 0,
    onChange: loadPage,
    disabled: loading || busy,
  };

  return (
    <>
      <Card
        title="Signed-in devices"
        description="Review and revoke active sign-ins for your account."
        action={<MonitorSmartphone size={20} />}
      >
        <div className="table-toolbar">
          <PaginationEntries {...controls} label="Devices pagination" />
          <Button
            variant="secondary"
            disabled={loading || busy}
            onClick={
              /** Refreshing never creates another sign-in. */
              () => loadPage()
            }
          >
            <RefreshCw size={15} />
            Refresh
          </Button>
        </div>
        <div className="device-list" aria-busy={loading}>
          {loading ? (
            <div className="card-body">
              <p role="status">Loading your devices…</p>
            </div>
          ) : error ? (
            <div className="card-body form-stack">
              <p className="form-error" role="alert">
                {error}
              </p>
              <Button
                variant="secondary"
                onClick={
                  /** Retry only on request rather than polling an unavailable API. */
                  () => loadPage()
                }
              >
                Try again
              </Button>
            </div>
          ) : result?.data.length ? (
            result.data.map(
              /** Use server-owned token metadata rather than inferred hardware or location. */
              (device) => (
                <div className="setting-action-row" key={device.id}>
                  <div>
                    <h3>
                      {device.name}{" "}
                      {device.is_current && (
                        <Badge tone="green">This device</Badge>
                      )}
                    </h3>
                    <p>
                      Signed in {formatDate(device.created_at, true)}
                      <br />
                      Last used{" "}
                      {device.last_used_at
                        ? formatDate(device.last_used_at, true)
                        : "not yet"}
                      <br />
                      {device.expires_at
                        ? `Expires ${formatDate(device.expires_at, true)}`
                        : "No scheduled expiry"}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    aria-label={`Sign out ${device.name}${device.is_current ? " (this device)" : ""}`}
                    onClick={
                      /** Token ownership is checked again by the API when confirmed. */
                      () => confirmSignOut(device)
                    }
                  >
                    <LogOut size={15} />
                    Sign out
                  </Button>
                </div>
              ),
            )
          ) : (
            <EmptyState title="No active sign-ins">
              No active devices are listed for this account.
            </EmptyState>
          )}
        </div>
        {result && !error && (
          <Pagination {...controls} label="Devices pagination" />
        )}
        <div className="card-body">
          <p className="small-muted">
            Closing a tab does not revoke its sign-in token. Device labels are
            not a live online-status indicator.
          </p>
        </div>
        <div className="card-form-footer">
          <Button
            variant="danger"
            disabled={busy}
            onClick={
              /** All-device revocation requires its own explicit confirmation. */
              () => confirmSignOut("all")
            }
          >
            Sign out all devices
          </Button>
        </div>
      </Card>
      <Modal
        open={target !== null}
        title={
          target === "all" ? "Sign out all devices?" : "Sign out this device?"
        }
        description={
          target === "all"
            ? "This ends every sign-in for your account, including this tab. You will need to sign in again."
            : target?.is_current
              ? "This tab will return to sign in. Your other devices stay signed in."
              : `This revokes access for ${target?.name ?? "the selected device"}. Your current sign-in stays active.`
        }
        onClose={
          /** Keep the confirmation stable while its request is pending. */
          () => {
            if (!busy) setTarget(null);
          }
        }
      >
        <div className="dialog-body">
          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}
          <p>Your profile, preferences and delivery records will be kept.</p>
        </div>
        <footer className="dialog-footer">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={
              /** Cancelling never contacts the revocation endpoint. */
              () => setTarget(null)
            }
          >
            Cancel
          </Button>
          <Button variant="danger" disabled={busy} onClick={signOutConfirmed}>
            {busy
              ? "Signing out…"
              : target === "all"
                ? "Sign out all devices"
                : "Sign out device"}
          </Button>
        </footer>
      </Modal>
    </>
  );
}
