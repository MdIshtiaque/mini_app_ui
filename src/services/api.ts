// Add Telegram context to window
declare global {
  interface Window {
    Telegram: {
      WebApp: any;
    };
  }
}

/** Dev: relative path → Vite proxy (works through ngrok). Prod: set VITE_API_URL to full webapp base. */
function getApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "/api/webapp";
}

const API_BASE = getApiBase();

function errorDetailFromJson(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const d = o.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((item) =>
        typeof item === "object" && item && item !== null && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : String(item)
      )
      .join("; ");
  }
  return null;
}

/** Read body once; throw on HTTP error with FastAPI-style detail when present. */
async function readJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    throw new Error("Invalid JSON response");
  }
  if (!res.ok) {
    throw new Error(errorDetailFromJson(parsed) || text || `HTTP ${res.status}`);
  }
  return parsed as T;
}

export const getHeaders = () => {
  const initData = window.Telegram?.WebApp?.initData || "";
  return {
    "Content-Type": "application/json",
    "x-tg-init-data": initData,
  };
};

export type EnabledCountry = {
  calling_code: string;
  country_name: string;
  flag_emoji: string;
  reward: number;
};

export type SaleRecord = {
  amount: number;
  phone: string;
  description: string;
  created_at: string;
};

export type VerifyCodeResponse =
  | { status: "ok"; session_string: string; twofa_set: boolean }
  | { status: "password_required" }
  | { status: "spam_flagged"; spam_message: string }
  | { status: "rejected"; reason: string; message?: string };

export type UserStatsResponse = {
  status: string;
  user_id?: number;
  balance?: number;
  total_earned?: number;
  extracted_sessions?: number;
  recent_transactions?: unknown[];
};

export const fetchUserStats = async () => {
  const res = await fetch(`${API_BASE}/user`, { headers: getHeaders() });
  return readJsonResponse<UserStatsResponse>(res);
};

export const fetchRates = async (): Promise<{ status: string; countries: EnabledCountry[] }> => {
  const res = await fetch(`${API_BASE}/rates`, { headers: getHeaders() });
  return readJsonResponse<{ status: string; countries: EnabledCountry[] }>(res);
};

export const fetchSalesHistory = async (): Promise<{ status: string; sales: SaleRecord[] }> => {
  const res = await fetch(`${API_BASE}/history`, { headers: getHeaders() });
  return readJsonResponse<{ status: string; sales: SaleRecord[] }>(res);
};

export const sendCodeRequest = async (phone: string) => {
  const res = await fetch(`${API_BASE}/send-code`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ phone }),
  });
  return readJsonResponse<{ status: string; reward?: number }>(res);
};

export const verifyCodeRequest = async (phone: string, otp: string): Promise<VerifyCodeResponse> => {
  const res = await fetch(`${API_BASE}/verify-code`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ phone, otp }),
  });
  return readJsonResponse(res);
};

export const verifyPasswordRequest = async (phone: string, password: string) => {
  const res = await fetch(`${API_BASE}/verify-password`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ phone, password }),
  });
  return readJsonResponse(res);
};
