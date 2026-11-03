"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  CircleAlert,
  MapPin,
  Package,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  ApiError,
  authApi,
  errorMessage,
  normalizeEmail,
  workspacePath,
} from "@/lib/api";
import { SessionCheck, useActions } from "@/components/providers";
import {
  Badge,
  Brand,
  Button,
  Field,
  LinkButton,
  PasswordInput,
} from "@/components/ui";

type AuthMode = "login" | "signup" | "forgot" | "reset";
const titles: Record<AuthMode, string> = {
  login: "Welcome back, rider.",
  signup: "Your next chapter starts here.",
  forgot: "Let’s get you back on route.",
  reset: "A fresh start for your account.",
};

const subscribeToHydration = () => () => {};

/** Render account forms after any existing tab session has been verified. */
export function AuthScreen({ mode }: { mode: AuthMode }) {
  const {
    session,
    mode: accessMode,
    signIn,
    signOut,
    enterDemo,
  } = useActions();
  const params = useSearchParams();
  const router = useRouter();
  const ready = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const destination = workspacePath(params.get("next"));
  const missingResetToken = mode === "reset" && !params.get("token");
  const message =
    error ||
    (missingResetToken
      ? "This reset link is incomplete. Request a new password reset link."
      : "");

  useEffect(() => {
    if (session && (mode === "login" || mode === "signup"))
      router.replace(destination);
  }, [session, mode, destination, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || missingResetToken) return;
    setError("");
    setErrors({});
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const password_confirmation = String(
      data.get("password_confirmation") ?? "",
    );
    try {
      if (mode === "forgot") {
        await authApi.forgotPassword(email);
        setSuccess(true);
      } else if (mode === "reset") {
        await authApi.resetPassword({
          email,
          token: params.get("token") ?? "",
          password,
          password_confirmation,
        });
        if (session?.user.email === normalizeEmail(email)) await signOut();
        setSuccess(true);
      } else {
        const credentials = {
          email,
          password,
          device_name: "Hatid web browser",
        };
        const result =
          mode === "signup"
            ? await authApi.register({
                ...credentials,
                name: String(data.get("name") ?? ""),
                password_confirmation,
              })
            : await authApi.login(credentials);
        await signIn(result.data);
      }
    } catch (cause) {
      setError(errorMessage(cause, "Unable to sign in. Please try again."));
      if (cause instanceof ApiError) setErrors(cause.errors);
    } finally {
      setBusy(false);
    }
  }

  if (accessMode === "checking" || accessMode === "unavailable")
    return <SessionCheck />;

  if (session && (mode === "login" || mode === "signup")) {
    return (
      <main id="main-content" className="workspace-loading">
        Opening your workspace…
      </main>
    );
  }

  return (
    <div className="auth-layout">
      <aside className="auth-brand-panel">
        <Link href="/dashboard">
          <Brand light />
        </Link>
        <div className="auth-brand-copy">
          <Badge tone="green">
            A little less paperwork. A lot more clarity.
          </Badge>
          <h1>
            Every parcel.
            <br />
            Every stop.
            <br />
            <span>All in a day’s work.</span>
          </h1>
          <p>
            Your parcels, customers and collections — together in one calmer
            rider workspace.
          </p>
          <div className="auth-route-art">
            <div className="art-road art-road-one" />
            <div className="art-road art-road-two" />
            <div className="art-road art-road-three" />
            <span className="art-pin art-pin-one">
              <MapPin size={25} />
            </span>
            <span className="art-pin art-pin-two">
              <Check size={22} />
            </span>
            <div className="art-delivery-card">
              <span>
                <Package size={22} />
              </span>
              <div>
                <strong>One more happy handover.</strong>
                <small>Delivery confirmed · fee retained</small>
              </div>
              <CheckCheck size={20} />
            </div>
          </div>
          <div className="auth-feature-row">
            <span>
              <Package size={16} />
              Clear parcel records
            </span>
            <span>
              <Wallet size={16} />
              Simpler settlement
            </span>
          </div>
        </div>
        <p className="auth-brand-bottom">
          Built for independent riders. Made for the way you deliver.
        </p>
      </aside>
      <main id="main-content" className="auth-main">
        <div className="auth-mobile-logo">
          <Link href="/dashboard">
            <Brand />
          </Link>
        </div>
        <div className="auth-form-wrap">
          {mode !== "login" && (
            <Link className="text-link auth-back" href="/login">
              <ArrowLeft size={15} />
              Back to sign in
            </Link>
          )}
          <span className="auth-kicker">YOUR RIDER WORKSPACE</span>
          <h2>
            {success
              ? mode === "forgot"
                ? "Check your next step."
                : "You’re ready to sign in."
              : titles[mode]}
          </h2>
          <p className="auth-form-intro">
            {success
              ? mode === "forgot"
                ? "If that email belongs to an account, a reset link will be sent. Email delivery is being set up for this local prototype."
                : "Your password is updated. Sign in again on your devices."
              : mode === "login"
                ? "Sign in to your account or take the prototype for a spin."
                : mode === "signup"
                  ? "Create a rider account and make room for a clearer delivery day."
                  : mode === "forgot"
                    ? "Enter the email linked to your rider or admin account."
                    : "Choose a strong password you haven’t used before."}
          </p>
          {success ? (
            <div className="auth-success">
              <span>
                <CheckCheck size={30} />
              </span>
              <LinkButton href="/login" className="button-full">
                Return to sign in
                <ArrowRight size={16} />
              </LinkButton>
              <Link
                className="text-link"
                href={destination}
                onClick={enterDemo}
              >
                Explore the prototype instead
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <form
              className="auth-form form-stack"
              method="post"
              onSubmit={submit}
            >
              {missingResetToken && (
                <Link className="text-link" href="/forgot-password">
                  Request a new reset link
                </Link>
              )}
              {message && (
                <div className="form-error" role="alert">
                  <CircleAlert size={18} />
                  <p>{message}</p>
                </div>
              )}
              {mode === "signup" && (
                <Field label="Full name" required error={errors.name?.[0]}>
                  <input
                    name="name"
                    aria-invalid={!!errors.name}
                    required
                    autoComplete="name"
                    placeholder="Your full name"
                    maxLength={255}
                  />
                </Field>
              )}
              <Field label="Email address" required error={errors.email?.[0]}>
                <input
                  name="email"
                  aria-invalid={!!errors.email}
                  autoCapitalize="none"
                  spellCheck={false}
                  type="email"
                  required
                  defaultValue={
                    mode === "reset" ? (params.get("email") ?? "") : ""
                  }
                  autoComplete="email"
                  placeholder="you@example.com"
                  maxLength={255}
                />
              </Field>
              {mode !== "forgot" && (
                <Field
                  label={mode === "reset" ? "New password" : "Password"}
                  error={errors.password?.[0]}
                  required
                  hint={
                    mode === "signup" || mode === "reset"
                      ? "At least 12 characters, with upper/lowercase and a number."
                      : undefined
                  }
                >
                  <PasswordInput
                    name="password"
                    required
                    aria-invalid={!!errors.password}
                    minLength={mode === "login" ? 1 : 12}
                    maxLength={72}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder={
                      mode === "login"
                        ? "Enter your password"
                        : "Create a strong password"
                    }
                  />
                </Field>
              )}
              {(mode === "signup" || mode === "reset") && (
                <Field
                  label="Confirm password"
                  required
                  error={errors.password_confirmation?.[0]}
                >
                  <PasswordInput
                    name="password_confirmation"
                    aria-invalid={!!errors.password_confirmation}
                    required
                    minLength={12}
                    maxLength={72}
                    autoComplete="new-password"
                    placeholder="Enter it once more"
                  />
                </Field>
              )}
              {mode === "login" && (
                <Link className="text-link forgot-link" href="/forgot-password">
                  Forgot your password?
                </Link>
              )}
              <Button
                type="submit"
                className="button-full auth-submit"
                disabled={!ready || busy || missingResetToken}
              >
                {!ready || busy
                  ? "One moment…"
                  : mode === "login"
                    ? "Sign in to Hatid"
                    : mode === "signup"
                      ? "Create rider account"
                      : mode === "forgot"
                        ? "Send reset link"
                        : "Save new password"}
                <ArrowRight size={17} />
              </Button>
              {mode === "login" && (
                <p className="auth-signup-link">
                  New to Hatid?{" "}
                  <Link href="/signup">Create your rider account</Link>
                </p>
              )}
            </form>
          )}
          <div className="auth-divider">
            <span />
            {mode === "login"
              ? "JUST LOOKING AROUND?"
              : "EXPLORE WITH SAMPLE DATA"}
            <span />
          </div>
          <Button
            variant="secondary"
            className="button-full"
            disabled={!ready || busy}
            onClick={() => {
              enterDemo();
              router.replace(destination);
            }}
          >
            Try the interactive prototype
            <ArrowRight size={16} />
          </Button>
          <p className="auth-bottom-note">
            <ShieldCheck size={14} />A rider-first workspace, from entry to
            handover.
          </p>
        </div>
        <footer>
          <Link href="/welcome">
            A quick introduction
            <ArrowRight size={13} />
          </Link>
          <span>hatid. · Rider workspace</span>
        </footer>
      </main>
    </div>
  );
}

export function WelcomeScreen() {
  const { enterDemo } = useActions();
  const [step, setStep] = useState(0);
  const steps = [
    {
      icon: Package,
      kicker: "01 / MAKE ROOM FOR CLARITY",
      title: "Every parcel, in its place.",
      copy: "Organise weekly batches, find a familiar customer and know exactly what to collect. Seller fees are clear before you save.",
      detail: "Search a customer · choose a seller · preview the breakdown",
    },
    {
      icon: Wallet,
      kicker: "02 / KNOW WHERE THE MONEY GOES",
      title: "Collect with confidence.",
      copy: "Record cash and manually confirmed GCash. Retain your delivery fee and track each seller’s net share without counting anything twice.",
      detail: "₱115 collected = ₱100 seller share + ₱15 rider fee",
    },
    {
      icon: MapPin,
      kicker: "03 / A ROUTE THAT STAYS YOURS",
      title: "One good handover at a time.",
      copy: "Choose a suggested stop or deliver manually. After delivery, review a fresh location, confirm the pin or simply skip it. Your delivery stays saved.",
      detail: "Up to 5 suggested stops · manual override · optional GPS",
    },
  ];
  const current = steps[step];
  const Icon = current.icon;
  return (
    <div className="welcome-page">
      <header>
        <Link href="/dashboard" onClick={enterDemo}>
          <Brand />
        </Link>
        <Link className="text-link" href="/dashboard" onClick={enterDemo}>
          Skip tour
          <ArrowRight size={15} />
        </Link>
      </header>
      <main id="main-content">
        <div className="welcome-illustration">
          <span className="welcome-orbit orbit-one" />
          <span className="welcome-orbit orbit-two" />
          <span className="welcome-icon">
            <Icon size={67} strokeWidth={1.4} />
          </span>
          <span className="welcome-mini-card">
            <CheckCheck size={22} />
            <strong>
              {step === 0
                ? "Parcel details are clear."
                : step === 1
                  ? "Your fee is accounted for."
                  : "You choose the next step."}
            </strong>
          </span>
        </div>
        <div className="welcome-copy">
          <span className="eyebrow">{current.kicker}</span>
          <h1>{current.title}</h1>
          <p>{current.copy}</p>
          <div className="notice">
            <Check size={17} />
            <p>{current.detail}</p>
          </div>
          <div className="welcome-pagination">
            {steps.map((_, index) => (
              <button
                key={index}
                className={step === index ? "selected" : ""}
                aria-label={`Go to introduction step ${index + 1}`}
                onClick={() => setStep(index)}
              />
            ))}
          </div>
          <div className="welcome-actions">
            {step > 0 && (
              <Button
                variant="secondary"
                onClick={() => setStep((value) => value - 1)}
              >
                <ArrowLeft size={16} />
                Back
              </Button>
            )}
            {step < 2 ? (
              <Button onClick={() => setStep((value) => value + 1)}>
                Let’s keep going
                <ArrowRight size={16} />
              </Button>
            ) : (
              <LinkButton href="/dashboard" onClick={enterDemo}>
                Open my workspace
                <ArrowRight size={16} />
              </LinkButton>
            )}
          </div>
        </div>
      </main>
      <footer>Less paperwork. More parcels delivered.</footer>
    </div>
  );
}
