import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface NamingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  title: string;
  placeholder: string;
  initialValue?: string;
}

export const NamingModal: React.FC<NamingModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title,
  placeholder,
  initialValue = '',
}) => {
  const [name, setName] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialValue);
    setError(null);
  }, [initialValue, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name cannot be empty.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSave(name.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div style={styles.modalHeader}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>{title}</h3>
          <button style={styles.closeBtn} onClick={onClose} disabled={loading}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.errorBanner}>{error}</div>}

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <input
              type="text"
              className="form-control"
              placeholder={placeholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoFocus
              required
            />
          </div>

          <div style={styles.modalActions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? (
                <span className="spin-loader"></span>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-color)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    padding: '20px',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
  },
  errorBanner: {
    padding: '10px 14px',
    background: 'var(--danger-glow)',
    border: '1px solid hsla(350, 80%, 55%, 0.2)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger)',
    fontSize: '0.85rem',
    marginBottom: '12px',
  },
};

// Add styles tag if spin-loader isn't defined
if (!document.getElementById('spin-loader-style')) {
  const loaderTag = document.createElement('style');
  loaderTag.id = 'spin-loader-style';
  loaderTag.innerHTML = `
    .spin-loader {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      display: inline-block;
      animation: spin 0.8s linear infinite;
    }
  `;
  document.head.appendChild(loaderTag);
}
