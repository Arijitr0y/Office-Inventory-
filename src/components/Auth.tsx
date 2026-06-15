import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, Database, Copy, Check, Sparkles } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: () => void;
}

const appsScriptTemplate = `1. Create a Google Sheet.
2. Open Extensions > Apps Script.
3. Paste google-apps-script/Code.gs from this project.
4. Click Deploy > New deployment > Web app.
5. Execute as: Me.
6. Who has access: Anyone with the link.
7. Copy the Web App URL and put it in .env.local.`;

const envTemplate = `# Add this to your .env.local file:
VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
# Optional, only if API_TOKEN is set inside Code.gs
VITE_GOOGLE_SCRIPT_TOKEN=`;

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedGuide, setCopiedGuide] = useState(false);

  const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) return;

    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        onAuthSuccess();
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        onAuthSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div style={styles.authContainer} className="animate-fade-in">
        <div style={styles.setupCard} className="glass-panel">
          <div style={styles.header}>
            <Database size={42} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Configure Google Sheets Connection</h2>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.95rem' }}>
              Your PWA now uses a Google Sheet as the database through a Google Apps Script web app.
            </p>
          </div>

          <div style={styles.setupSection}>
            <h3 style={styles.sectionTitle}>1. Deploy the Apps Script API</h3>
            <p style={styles.sectionDesc}>
              Use the provided <code>google-apps-script/Code.gs</code> file. It creates the required tabs automatically when the web app is opened once.
            </p>
            <div style={styles.codeBlockContainer}>
              <pre style={styles.codeBlock}>{appsScriptTemplate}</pre>
              <button
                className="btn btn-secondary btn-icon btn-sm"
                onClick={() => handleCopy(appsScriptTemplate, setCopiedGuide)}
                style={styles.copyBtn}
                title="Copy setup guide"
              >
                {copiedGuide ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          <div style={styles.setupSection}>
            <h3 style={styles.sectionTitle}>2. Set Environment Variables</h3>
            <p style={styles.sectionDesc}>
              Create <code>.env.local</code> in the project root and paste your Apps Script Web App URL.
            </p>
            <div style={styles.codeBlockContainer}>
              <pre style={styles.codeBlock}>{envTemplate}</pre>
              <button
                className="btn btn-secondary btn-icon btn-sm"
                onClick={() => handleCopy(envTemplate, setCopiedEnv)}
                style={styles.copyBtn}
                title="Copy env template"
              >
                {copiedEnv ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          <div style={styles.setupFooter}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--warning)', fontSize: '0.85rem' }}>
              <AlertCircle size={16} />
              <span>After editing .env.local, restart the npm development server.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.authContainer} className="animate-fade-in">
      <div style={styles.authCard} className="glass-panel">
        <div style={styles.logoContainer}>
          <div style={styles.logoBadge}>
            <Sparkles size={24} style={{ color: '#fff' }} />
          </div>
          <h1 style={styles.title}>VeloStock</h1>
          <p style={styles.subtitle}>Google Sheets Inventory PWA</p>
        </div>

        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(isSignUp ? {} : styles.activeTab) }}
            onClick={() => { setIsSignUp(false); setError(null); }}
          >
            Sign In
          </button>
          <button
            style={{ ...styles.tab, ...(isSignUp ? styles.activeTab : {}) }}
            onClick={() => { setIsSignUp(true); setError(null); }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleAuth} style={styles.form}>
          {error && (
            <div style={styles.errorBanner}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <div style={styles.inputWrapper}>
              <Mail size={18} style={styles.inputIcon} />
              <input
                id="email"
                type="email"
                className="form-control"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={styles.inputWithIcon}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={styles.inputWrapper}>
              <Lock size={18} style={styles.inputIcon} />
              <input
                id="password"
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={4}
                style={styles.inputWithIcon}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '10px', height: '48px' }}
          >
            {loading ? (
              <span style={styles.spinner}></span>
            ) : isSignUp ? (
              <>
                <UserPlus size={18} />
                <span>Create Sheet Account</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>Sign In to Dashboard</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  authContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '24px',
    position: 'relative',
    zIndex: 1,
  },
  authCard: {
    width: '100%',
    maxWidth: '420px',
    padding: '40px 32px',
    display: 'flex',
    flexDirection: 'column',
  },
  setupCard: {
    width: '100%',
    maxWidth: '650px',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  setupSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  sectionDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  codeBlockContainer: {
    position: 'relative',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
  },
  codeBlock: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    padding: '16px',
    background: 'var(--bg-input)',
    color: 'hsl(190, 90%, 50%)',
    overflowX: 'auto',
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  copyBtn: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    opacity: 0.8,
  },
  setupFooter: {
    borderTop: '1px solid var(--border-color)',
    paddingTop: '16px',
    marginTop: '8px',
  },
  logoContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '32px',
  },
  logoBadge: {
    width: '48px',
    height: '48px',
    borderRadius: 'var(--radius-md)',
    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    boxShadow: '0 8px 20px var(--primary-glow)',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, var(--text-primary) 30%, var(--text-secondary) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  tabs: {
    display: 'flex',
    background: 'var(--bg-input)',
    padding: '4px',
    borderRadius: 'var(--radius-md)',
    marginBottom: '24px',
    border: '1px solid var(--border-color)',
  },
  tab: {
    flex: 1,
    padding: '10px 0',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 600,
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
  },
  activeTab: {
    background: 'var(--bg-card-solid)',
    color: 'var(--primary)',
    boxShadow: 'var(--shadow-sm)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    color: 'var(--text-muted)',
  },
  inputWithIcon: {
    paddingLeft: '44px',
  },
  errorBanner: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    padding: '12px',
    borderRadius: 'var(--radius-md)',
    background: 'hsla(0, 70%, 50%, 0.1)',
    color: 'var(--danger)',
    border: '1px solid hsla(0, 70%, 50%, 0.2)',
    fontSize: '0.9rem',
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
