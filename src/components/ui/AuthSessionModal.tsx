import React, { useState } from 'react';
import { CheckCircle2, KeyRound, LogOut, ShieldCheck, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppButton } from './AppButton';
import { StateBanner } from './StateBanner';

export interface AuthSessionState {
  accessToken: string;
  refreshToken: string;
  mfaVerified?: boolean;
  user: {
    id: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    preferredLanguage: string;
    marketingConsent: boolean;
    notificationConsent?: boolean;
    mfaEnabled?: boolean;
    roles: string[];
  };
}

interface AuthSessionModalProps {
  open: boolean;
  session: AuthSessionState | null;
  onClose: () => void;
  onSessionChange: (next: AuthSessionState | null) => void;
  onOpenPrivacyCenter: () => void;
}

type ModalMode = 'login' | 'register' | 'otp' | 'account';

export function AuthSessionModal({
  open,
  session,
  onClose,
  onSessionChange,
  onOpenPrivacyCenter,
}: AuthSessionModalProps) {
  const { lang } = useLanguage();
  const [mode, setMode] = useState<ModalMode>(session ? 'account' : 'login');

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);

  // OTP state
  const [otpDestination, setOtpDestination] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // TOTP MFA state
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaUri, setMfaUri] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!open) return null;

  const activeMode: ModalMode = session ? 'account' : mode === 'account' ? 'login' : mode;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message || 'Sign-in failed.');
      }
      onSessionChange({
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
        mfaVerified: body.mfaVerified,
        user: body.user,
      });
      setPassword('');
      setNotice(
        lang === 'am' ? 'በተሳካ ሁኔታ ገብተዋል።' : 'Signed in successfully.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          password,
          preferredLanguage: lang,
          marketingConsent,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message || 'Registration failed.');
      }
      setOtpDestination(body.destination);
      setMode('otp');
      setNotice(
        lang === 'am'
          ? 'ባለ 6 አሃዝ የማረጋገጫ ኮድ ተልኳል (በልማት ሁኔታ በሰርቨር መዝገብ ውስጥ ይታያል)።'
          : 'A 6-digit verification code was issued. Enter it below to verify your account.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: otpDestination, code: otpCode }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message || 'Verification failed.');
      }
      onSessionChange({
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
        mfaVerified: body.mfaVerified,
        user: body.user,
      });
      setOtpCode('');
      setNotice(
        lang === 'am' ? 'መለያዎ ተረጋግጧል።' : 'Account verified and signed in.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSetupMfa = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/mfa/setup', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'MFA setup failed.');
      setMfaSecret(body.secret);
      setMfaUri(body.otpauthUri);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA setup failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ code: mfaCode }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'MFA verification failed.');
      onSessionChange({
        ...session,
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
        mfaVerified: true,
        user: { ...session.user, mfaEnabled: true },
      });
      setMfaCode('');
      setMfaSecret(null);
      setMfaUri(null);
      setNotice(
        lang === 'am'
          ? 'ባለ ሁለት ደረጃ ማረጋገጫ (TOTP MFA) ነቅቷል።'
          : 'Authenticator MFA is enabled and verified for this session.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (session?.refreshToken) {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      }).catch(() => {});
    }
    onSessionChange(null);
    setMode('login');
    setNotice(null);
    setError(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white border border-[#E2E8F0] p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="auth-modal-title" className="text-lg font-bold text-[#0F172A]">
              {activeMode === 'account'
                ? lang === 'am'
                  ? 'የመለያ እና የደህንነት ሁኔታ'
                  : 'Account & Security'
                : activeMode === 'register'
                ? lang === 'am'
                  ? 'መለያ ይፍጠሩ'
                  : 'Create Account'
                : activeMode === 'otp'
                ? lang === 'am'
                  ? 'የOTP ኮድ ያረጋግጡ'
                  : 'Verify OTP Code'
                : lang === 'am'
                ? 'ወደ TenderLink ይግቡ'
                : 'Sign In to TenderLink'}
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              {lang === 'am'
                ? 'በScrypt ምስጠራ እና የመቆለፍ ጥበቃ የተጠበቀ'
                : 'Protected with scrypt hashing, brute-force lockout & TOTP MFA'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] -mt-2 -me-2 inline-flex items-center justify-center rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <StateBanner compact variant="error" title="Error" description={error} />
        )}
        {notice && (
          <StateBanner compact variant="success" title="Notice" description={notice} />
        )}

        {activeMode === 'account' && session && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-1.5 text-sm">
              <div className="font-semibold text-[#0F172A]">{session.user.fullName}</div>
              <div className="text-xs text-[#475569] font-mono">
                {session.user.email || session.user.phone}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-[#475569]">
                <span>
                  Roles:{' '}
                  <strong className="text-[#0F172A]">
                    {session.user.roles.join(', ')}
                  </strong>
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-[#1D4ED8] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  {session.user.mfaEnabled
                    ? session.mfaVerified
                      ? 'MFA Active (Verified)'
                      : 'MFA Enabled'
                    : 'MFA Not Set'}
                </span>
              </div>
            </div>

            {/* TOTP Authenticator MFA Section */}
            <div className="rounded-lg border border-[#E2E8F0] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                  <KeyRound className="w-4 h-4 text-[#1D4ED8]" aria-hidden="true" />
                  <span>Authenticator MFA (TOTP)</span>
                </div>
                {!mfaSecret && (
                  <AppButton
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={handleSetupMfa}
                  >
                    {session.user.mfaEnabled ? 'Rotate Key' : 'Enable MFA'}
                  </AppButton>
                )}
              </div>

              {mfaSecret && (
                <form onSubmit={handleVerifyMfa} className="space-y-3">
                  <p className="text-xs text-[#475569] leading-relaxed">
                    Add this Base32 key to Google Authenticator or Authy, then enter the 6-digit code:
                  </p>
                  <div className="rounded bg-[#F1F5F9] px-3 py-2 font-mono text-xs text-[#0F172A] break-all select-all">
                    {mfaSecret}
                  </div>
                  {mfaUri && (
                    <div className="text-[11px] font-mono text-[#64748B] break-all">
                      {mfaUri}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="flex-1 min-h-[40px] rounded-lg border border-[#CBD5E1] px-3 text-sm font-mono tracking-widest"
                    />
                    <AppButton size="sm" variant="primary" type="submit" disabled={busy}>
                      Verify
                    </AppButton>
                  </div>
                </form>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0]">
              <AppButton
                size="sm"
                variant="secondary"
                onClick={() => {
                  onClose();
                  onOpenPrivacyCenter();
                }}
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                {lang === 'am' ? 'የውሂብ ኤክስፖርት / መሰረዝ' : 'Data Export & Deletion'}
              </AppButton>
              <AppButton size="sm" variant="secondary" onClick={handleLogout}>
                <LogOut className="w-4 h-4" aria-hidden="true" />
                {lang === 'am' ? 'ውጣ' : 'Sign Out'}
              </AppButton>
            </div>
          </div>
        )}

        {activeMode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">
                {lang === 'am' ? 'ኢሜይል ወይም ስልክ (+251)' : 'Email or Ethiopian Phone (+251)'}
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@company.et or +251911234567"
                className="w-full min-h-[42px] rounded-lg border border-[#CBD5E1] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">
                {lang === 'am' ? 'የይለፍ ቃል' : 'Password'}
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-[#CBD5E1] px-3 text-sm"
              />
            </div>
            <AppButton
              type="submit"
              variant="primary"
              size="md"
              disabled={busy}
              className="w-full justify-center"
            >
              {busy ? 'Signing in…' : lang === 'am' ? 'ግባ' : 'Sign In'}
            </AppButton>
            <div className="text-center text-xs text-[#64748B]">
              {lang === 'am' ? 'መለያ የለዎትም?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('register');
                }}
                className="font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
              >
                {lang === 'am' ? 'አዲስ መለያ ይፍጠሩ' : 'Create one'}
              </button>
            </div>
          </form>
        )}

        {activeMode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">
                {lang === 'am' ? 'ሙሉ ስም' : 'Full Name'}
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Abebe Bikila"
                className="w-full min-h-[42px] rounded-lg border border-[#CBD5E1] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">
                {lang === 'am' ? 'ኢሜይል' : 'Email Address'}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="supplier@company.et"
                className="w-full min-h-[42px] rounded-lg border border-[#CBD5E1] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">
                {lang === 'am' ? 'ስልክ ቁጥር (አማራጭ)' : 'Ethiopian Phone (optional, +2519...)'}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251911234567"
                className="w-full min-h-[42px] rounded-lg border border-[#CBD5E1] px-3 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">
                {lang === 'am' ? 'የይለፍ ቃል (ቢያንስ 8 ፊደላት)' : 'Password (min 8 characters)'}
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-[#CBD5E1] px-3 text-sm"
              />
            </div>
            <label className="flex items-start gap-2 text-xs text-[#475569] cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 accent-[#2563EB]"
              />
              <span>
                {lang === 'am'
                  ? 'ስለ አዳዲስ የጨረታ አገልግሎቶች ማስታወቂያ ለመቀበል እስማማለሁ (አማራጭ)።'
                  : 'Optional: I consent to receive product updates and promotional notices (withdraw anytime).'}
              </span>
            </label>
            <AppButton
              type="submit"
              variant="primary"
              size="md"
              disabled={busy}
              className="w-full justify-center"
            >
              {busy ? 'Creating…' : lang === 'am' ? 'መለያ ፍጠር' : 'Create Account'}
            </AppButton>
            <div className="text-center text-xs text-[#64748B]">
              {lang === 'am' ? 'መለያ አለዎት?' : 'Already registered?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('login');
                }}
                className="font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
              >
                {lang === 'am' ? 'ግባ' : 'Sign In'}
              </button>
            </div>
          </form>
        )}

        {activeMode === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-3.5">
            <p className="text-xs text-[#475569]">
              Destination: <strong className="font-mono text-[#0F172A]">{otpDestination}</strong>
            </p>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full min-h-[42px] rounded-lg border border-[#CBD5E1] px-3 text-sm font-mono tracking-widest"
              />
            </div>
            <AppButton
              type="submit"
              variant="primary"
              size="md"
              disabled={busy}
              className="w-full justify-center"
            >
              {busy ? 'Verifying…' : 'Verify & Continue'}
            </AppButton>
          </form>
        )}
      </div>
    </div>
  );
}
