// Add Telegram context to window
declare global {
  interface Window {
    Telegram: {
      WebApp: any;
    };
  }
}

const API_BASE = "http://127.0.0.1:8000/api/webapp";

export const getHeaders = () => {
    // Falls back to empty string if run outside Telegram Context
    const initData = window.Telegram?.WebApp?.initData || "";
    return {
        "Content-Type": "application/json",
        "x-tg-init-data": initData
    };
};

export const fetchUserStats = async () => {
    const res = await fetch(`${API_BASE}/user`, {
        headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const sendCodeRequest = async (phone: string) => {
    const res = await fetch(`${API_BASE}/send-code`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ phone })
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || await res.text());
    }
    return res.json();
};

export const verifyCodeRequest = async (phone: string, otp: string) => {
    const res = await fetch(`${API_BASE}/verify-code`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ phone, otp })
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || await res.text());
    }
    return res.json();
};

export const verifyPasswordRequest = async (phone: string, password: string) => {
    const res = await fetch(`${API_BASE}/verify-password`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ phone, password })
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || await res.text());
    }
    return res.json();
};
