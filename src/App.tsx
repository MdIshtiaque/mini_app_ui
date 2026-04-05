import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
  fetchUserStats,
  fetchRates,
  fetchSalesHistory,
  sendCodeRequest,
  verifyCodeRequest,
  type EnabledCountry,
  type SaleRecord,
} from "./services/api";
import { maskPhone } from "./lib/phone";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Loader2, ShieldCheck, Wallet, ChevronRight, ListOrdered, History } from "lucide-react";

type TabId = "sell" | "rates" | "history";

function formatSaleDate(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("sell");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  /** In-flight / dedupe guard for the code currently being verified. */
  const autoOtpSubmittedRef = useRef<string | null>(null);
  /** After a failed verify, do not auto-retry the same 5 digits until the user edits (or shortens) the code. */
  const lastFailedOtpRef = useRef<string | null>(null);

  const [reward, setReward] = useState(0);
  const [userStats, setUserStats] = useState<{
    balance?: number;
    total_earned?: number;
  } | null>(null);

  const [countries, setCountries] = useState<EnabledCountry[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  /** Set when /user returns 403 (mini app locked until bot verification). */
  const [accessBlocked, setAccessBlocked] = useState<string | null>(null);
  const lastVisibilityRefreshRef = useRef<number>(0);

  const refreshUser = useCallback(() => {
    fetchUserStats()
      .then((s) => {
        setAccessBlocked(null);
        setUserStats(s);
      })
      .catch((e: Error) => {
        const msg = e.message || "";
        if (
          msg.includes("Complete account verification") ||
          msg.includes("mini app button")
        ) {
          setAccessBlocked(msg);
        } else {
          console.error(e);
        }
      });
  }, []);

  const refreshHistory = useCallback(() => {
    fetchSalesHistory()
      .then((data) => setSales(data.sales || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    refreshUser();

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.setHeaderColor("secondary_bg_color");
    }
  }, [refreshUser]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastVisibilityRefreshRef.current < 5000) return;
      lastVisibilityRefreshRef.current = now;
      refreshUser();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshUser]);

  useEffect(() => {
    if (activeTab !== "rates") return;
    setRatesLoading(true);
    setRatesError(null);
    fetchRates()
      .then((data) => setCountries(data.countries || []))
      .catch((e: Error) => setRatesError(e.message || "Could not load rates"))
      .finally(() => setRatesLoading(false));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "history") return;
    setHistoryLoading(true);
    setHistoryError(null);
    fetchSalesHistory()
      .then((data) => setSales(data.sales || []))
      .catch((e: Error) => setHistoryError(e.message || "Could not load history"))
      .finally(() => setHistoryLoading(false));
  }, [activeTab]);

  const resetToSellHome = useCallback(() => {
    setActiveTab("sell");
    setStep("phone");
    setPhone("");
    setOtp("");
    setReward(0);
    setError(null);
    autoOtpSubmittedRef.current = null;
    lastFailedOtpRef.current = null;
  }, []);

  const handleSendCode = async () => {
    if (!phone) return setError("Phone number is required");
    setLoading(true);
    setError(null);
    autoOtpSubmittedRef.current = null;
    lastFailedOtpRef.current = null;
    try {
      const res = await sendCodeRequest(phone);
      setReward(res.reward || 0);
      setOtp("");
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setLoading(false);
    }
  };

  const runVerifyOtp = useCallback(
    async (codeRaw: string) => {
      const code = codeRaw.replace(/\s/g, "");
      if (!code || !phone) return;
      setLoading(true);
      setError(null);
      try {
        const res = await verifyCodeRequest(phone, code);
        if (res.status === "password_required") {
          autoOtpSubmittedRef.current = null;
          lastFailedOtpRef.current = code;
          setError(
            "This number uses extra login protection we don’t support. Try another number."
          );
          window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
          return;
        }
        if (res.status === "spam_flagged") {
          autoOtpSubmittedRef.current = null;
          lastFailedOtpRef.current = code;
          setError(`Cannot use this account: ${res.spam_message}`);
          window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
          return;
        }
        if (res.status === "rejected") {
          autoOtpSubmittedRef.current = null;
          lastFailedOtpRef.current = code;
          setError(
            res.message ||
              "This number uses extra login protection we don’t support. Try another number."
          );
          window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
          return;
        }
        if (res.status !== "ok") return;
        refreshUser();
        refreshHistory();
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
        resetToSellHome();
      } catch (err: unknown) {
        autoOtpSubmittedRef.current = null;
        lastFailedOtpRef.current = code;
        setError(err instanceof Error ? err.message : "Verification failed");
      } finally {
        setLoading(false);
      }
    },
    [phone, refreshUser, refreshHistory, resetToSellHome]
  );

  useEffect(() => {
    const code = otp.replace(/\s/g, "");
    const len = code.length;

    if (step !== "otp" || !phone || loading) return;
    if (len < 5) {
      autoOtpSubmittedRef.current = null;
      lastFailedOtpRef.current = null;
      return;
    }
    if (!/^\d{5}$/.test(code)) return;
    if (code === lastFailedOtpRef.current) return;
    if (autoOtpSubmittedRef.current === code) return;
    autoOtpSubmittedRef.current = code;
    void runVerifyOtp(code);
  }, [otp, step, phone, loading, runVerifyOtp]);

  if (accessBlocked) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-6 text-center bg-background">
        <ShieldCheck className="h-12 w-12 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold">Mini app locked</h1>
        <p className="text-sm text-muted-foreground max-w-sm">{accessBlocked}</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Finish selling one account in the bot (phone + login code). The bot will send an Open mini app button when you’re allowed to use this app.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-2"
          onClick={() => {
            setAccessBlocked(null);
            void refreshUser();
          }}
        >
          I finished in the bot — retry
        </Button>
      </div>
    );
  }

  const tabBtn = (id: TabId, label: string, icon: ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={activeTab === id}
      onClick={() => setActiveTab(id)}
      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-semibold transition-colors ${
        activeTab === id
          ? "bg-white text-slate-900 shadow-sm"
          : "bg-white/10 text-white/90 hover:bg-white/15"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="min-h-screen w-full flex flex-col items-center p-4 pb-8">
      <div className="w-full max-w-sm flex flex-col gap-4">
        {userStats != null && (
          <div className="flex justify-between items-center bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 shadow-sm text-white">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-green-400" />
              <span className="font-medium">Balance</span>
            </div>
            <span className="text-lg font-bold">${(userStats.balance ?? 0).toFixed(2)}</span>
          </div>
        )}

        <div className="flex gap-2" role="tablist" aria-label="Main">
          {tabBtn(
            "sell",
            "Sell",
            <ShieldCheck className="h-4 w-4 shrink-0" />
          )}
          {tabBtn(
            "rates",
            "Rates",
            <ListOrdered className="h-4 w-4 shrink-0" />
          )}
          {tabBtn(
            "history",
            "History",
            <History className="h-4 w-4 shrink-0" />
          )}
        </div>

        {activeTab === "rates" && (
          <Card className="glass border-0 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <CardHeader className="text-center pt-6 pb-2 text-white">
              <CardTitle className="text-xl">Enabled countries</CardTitle>
              <CardDescription className="text-blue-100/70">
                Current reward per verified number
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 max-h-[min(60vh,420px)] overflow-y-auto">
              {ratesLoading && (
                <div className="flex justify-center py-10 text-white">
                  <Loader2 className="h-8 w-8 animate-spin opacity-80" />
                </div>
              )}
              {ratesError && (
                <p className="text-sm text-red-200 text-center py-4">{ratesError}</p>
              )}
              {!ratesLoading && !ratesError && countries.length === 0 && (
                <p className="text-sm text-blue-100/70 text-center py-8">No countries enabled right now.</p>
              )}
              {!ratesLoading && countries.length > 0 && (
                <ul className="space-y-2">
                  {countries.map((c) => (
                    <li
                      key={c.calling_code}
                      className="flex items-center justify-between gap-3 rounded-xl bg-black/20 border border-white/10 px-3 py-3 text-white"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg shrink-0" aria-hidden>
                          {c.flag_emoji || "🌍"}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{c.country_name}</p>
                          <p className="text-xs text-blue-100/60 font-mono">{c.calling_code}</p>
                        </div>
                      </div>
                      <span className="text-green-300 font-bold shrink-0">${Number(c.reward).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "history" && (
          <Card className="glass border-0 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
            <CardHeader className="text-center pt-6 pb-2 text-white">
              <CardTitle className="text-xl">Your sales</CardTitle>
              <CardDescription className="text-blue-100/70">
                Successful numbers you verified
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 max-h-[min(60vh,420px)] overflow-y-auto">
              {historyLoading && (
                <div className="flex justify-center py-10 text-white">
                  <Loader2 className="h-8 w-8 animate-spin opacity-80" />
                </div>
              )}
              {historyError && (
                <p className="text-sm text-red-200 text-center py-4">{historyError}</p>
              )}
              {!historyLoading && !historyError && sales.length === 0 && (
                <p className="text-sm text-blue-100/70 text-center py-8">No completed sales yet.</p>
              )}
              {!historyLoading && sales.length > 0 && (
                <ul className="space-y-2">
                  {sales.map((s, i) => (
                    <li
                      key={`${s.created_at}-${s.phone}-${i}`}
                      className="rounded-xl bg-black/20 border border-white/10 px-3 py-3 text-white"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-sm truncate">{maskPhone(s.phone)}</p>
                          <p className="text-xs text-blue-100/55 mt-1">{formatSaleDate(s.created_at)}</p>
                        </div>
                        <span className="text-green-300 font-bold shrink-0">+${Number(s.amount).toFixed(2)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "sell" && (
          <Card className="w-full glass border-0 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
            <CardHeader className="text-center pt-8 pb-4 text-white">
              <div className="mx-auto bg-white/10 p-3 rounded-full w-fit mb-3">
                <ShieldCheck className="w-8 h-8 text-blue-400" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Secure Verification</CardTitle>
              <CardDescription className="text-blue-100/70">
                {step === "phone" && "Sell your Telegram account securely"}
                {step === "otp" &&
                  "Enter the 5-digit code from Telegram — we verify automatically. Numbers with extra login protection aren’t accepted."}
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 py-4">
              {error && (
                <div className="mb-4 text-sm font-medium text-red-200 bg-red-500/20 px-3 py-2 rounded-lg border border-red-500/30 text-center">
                  {error}
                </div>
              )}

              {step === "phone" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-blue-50/90 text-sm">
                      Phone Number
                    </Label>
                    <div className="relative">
                      <Input
                        id="phone"
                        placeholder="+1234567890"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="bg-black/20 border-white/10 text-white placeholder:text-white/40 focus:border-blue-500/50 pl-4 h-12 text-lg"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleSendCode}
                    disabled={loading}
                    className="w-full h-12 bg-white text-black hover:bg-white/90 text-md font-semibold transition-all"
                  >
                    {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    Continue <ChevronRight className="ml-1 w-5 h-5" />
                  </Button>
                </div>
              )}

              {step === "otp" && (
                <div className="space-y-4">
                  {reward > 0 && (
                    <p className="text-center text-sm text-green-300 font-medium mb-2">
                      Reward for this number: ${reward}
                    </p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="otp" className="text-blue-50/90 text-sm">
                      Login code
                    </Label>
                    <Input
                      id="otp"
                      placeholder="•••••"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={5}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 5))}
                      disabled={loading}
                      className="bg-black/20 border-white/10 text-white placeholder:text-white/40 h-12 text-center text-xl tracking-widest"
                    />
                  </div>
                  {loading && (
                    <div className="flex items-center justify-center gap-2 text-blue-100/80 text-sm py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying…
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-center border-t border-white/5 pt-4 pb-4">
              <p className="text-xs text-blue-100/50 flex flex-col uppercase tracking-wider items-center">
                Guaranteed by Telegram Mini Apps
              </p>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
