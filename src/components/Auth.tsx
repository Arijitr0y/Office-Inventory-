import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, Database, Copy, Check, Sparkles } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // SQL code for users to copy
  const sqlSchema = `-- Run this in your Supabase SQL Editor:
create table public.inventory_items (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    sku text,
    description text,
    category text default 'General' not null,
    quantity integer default 0 not null check (quantity >= 0),
    min_stock_level integer default 5 not null check (min_stock_level >= 0),
    price numeric(10, 2) default 0.00 not null check (price >= 0),
    location text,
    image_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.stock_transactions (
    id uuid default gen_random_uuid() primary key,
    item_id uuid references public.inventory_items(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    type text not null check (type in ('IN', 'OUT', 'ADJUSTMENT')),
    quantity integer not null,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.inventory_items enable row level security;
alter table public.stock_transactions enable row level security;

create policy "Users can perform all operations on their own items"
    on public.inventory_items for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can perform all operations on their own transactions"
    on public.stock_transactions for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);`;

  const envTemplate = `# Add this to your .env.local file:
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY`;

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
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        alert('Registration successful! Please check your email for a confirmation link (if enabled) or proceed to login.');
        setIsSignUp(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        onAuthSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // If Supabase is not configured yet, show a gorgeous setup helper page
  if (!isSupabaseConfigured) {
    return (
      <div style={styles.authContainer} className="animate-fade-in">
        <div style={styles.setupCard} className="glass-panel">
          <div style={styles.header}>
            <Database size={42} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Configure Supabase Connection</h2>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.95rem' }}>
              Your PWA inventory manager requires a Supabase database and authentication configuration.
            </p>
          </div>

          <div style={styles.setupSection}>
            <h3 style={styles.sectionTitle}>1. Set Environment Variables</h3>
            <p style={styles.sectionDesc}>
              Create a file named <code>.env.local</code> in the root of the project (we created a template for you) and add your Supabase Project URL and Anon API key:
            </p>
            <div style={styles.codeBlockContainer}>
              <pre style={styles.codeBlock}>{envTemplate}</pre>
              <button 
                className="btn btn-secondary btn-icon btn-sm"
                onClick={() => handleCopy(envTemplate, setCopiedEnv)}
                style={styles.copyBtn}
                title="Copy Env Template"
              >
                {copiedEnv ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          <div style={styles.setupSection}>
            <h3 style={styles.sectionTitle}>2. Create Database Schema</h3>
            <p style={styles.sectionDesc}>
              Go to the <strong>SQL Editor</strong> in your Supabase Dashboard, create a new query, paste the schema below, and run it to set up your tables and Row-Level Security (RLS):
            </p>
            <div style={styles.codeBlockContainer}>
              <pre style={{...styles.codeBlock, maxHeight: '200px'}}>{sqlSchema}</pre>
              <button 
                className="btn btn-secondary btn-icon btn-sm"
                onClick={() => handleCopy(sqlSchema, setCopiedSql)}
                style={styles.copyBtn}
                title="Copy SQL Schema"
              >
                {copiedSql ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          <div style={styles.setupFooter}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--warning)', fontSize: '0.85rem' }}>
              <AlertCircle size={16} />
              <span>Once configured, restart the npm development server to apply the environment variables.</span>
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
          <p style={styles.subtitle}>PWA Inventory Intelligence</p>
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
                <span>Create Account</span>
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
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    fontSize: '0.95rem',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    transition: 'all var(--transition-fast)',
  },
  activeTab: {
    background: 'var(--bg-card-solid)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-sm)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  errorBanner: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'var(--danger-glow)',
    border: '1px solid hsla(350, 80%, 55%, 0.3)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger)',
    fontSize: '0.9rem',
    marginBottom: '16px',
    lineHeight: '1.4',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '16px',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  inputWithIcon: {
    paddingLeft: '46px',
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 0.8s linear infinite',
  },
};

// Insert basic animation styles to head
const styleTag = document.createElement('style');
styleTag.innerHTML = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleTag);
