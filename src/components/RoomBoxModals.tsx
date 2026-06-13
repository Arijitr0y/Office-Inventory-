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

interface Box {
  id: string;
  room_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface Room {
  id: string;
  name: string;
  created_at: string;
}

interface MoveItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMove: () => Promise<void>;
  itemName: string;
  itemQuantity: number;
  currentBoxId: string | null;
  targetBoxId: string;
  setTargetBoxId: (id: string) => void;
  transferQuantity: number;
  setTransferQuantity: (qty: number) => void;
  transferReason: string;
  setTransferReason: (reason: string) => void;
  boxes: Box[];
  rooms: Room[];
}

export const MoveItemModal: React.FC<MoveItemModalProps> = ({
  isOpen,
  onClose,
  onMove,
  itemName,
  itemQuantity,
  currentBoxId,
  targetBoxId,
  setTargetBoxId,
  transferQuantity,
  setTransferQuantity,
  transferReason,
  setTransferReason,
  boxes,
  rooms,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFullTransfer = transferQuantity >= itemQuantity;

  useEffect(() => {
    setError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetBoxId) {
      setError('Please select a destination box.');
      return;
    }

    if (targetBoxId === currentBoxId) {
      setError('Please select a different destination box.');
      return;
    }

    if (!transferQuantity || transferQuantity <= 0) {
      setError('Transfer quantity must be greater than 0.');
      return;
    }

    if (transferQuantity > itemQuantity) {
      setError('Transfer quantity cannot be more than available stock.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onMove();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error occurred while transferring item.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '460px' }}
      >
        <div style={styles.modalHeader}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>
              Transfer Stock
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {itemName}
            </p>
          </div>

          <button style={styles.closeBtn} onClick={onClose} disabled={loading}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.errorBanner}>{error}</div>}

          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Available quantity
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {itemQuantity}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Destination Box</label>
            <select
              className="form-control"
              value={targetBoxId}
              onChange={(e) => setTargetBoxId(e.target.value)}
              disabled={loading}
              required
              style={{ padding: '10px 14px' }}
            >
              <option value="" disabled>
                -- Select target box --
              </option>

              {rooms.map((room) => {
                const boxesInRoom = boxes.filter((b) => b.room_id === room.id);

                if (boxesInRoom.length === 0) return null;

                return (
                  <optgroup key={room.id} label={room.name}>
                    {boxesInRoom.map((box) => (
                      <option key={box.id} value={box.id}>
                        {box.name} {box.id === currentBoxId ? '(Current)' : ''}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Quantity to transfer</label>
            <input
              type="number"
              className="form-control"
              min={1}
              max={itemQuantity}
              value={transferQuantity}
              onChange={(e) => {
                const nextQty = Math.floor(Number(e.target.value) || 0);
                setTransferQuantity(Math.max(1, Math.min(itemQuantity, nextQty)));
              }}
              disabled={loading}
              required
            />

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={loading}
                onClick={() => setTransferQuantity(itemQuantity)}
              >
                Full Transfer
              </button>

              {itemQuantity > 1 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={loading}
                  onClick={() => setTransferQuantity(1)}
                >
                  Transfer 1
                </button>
              )}
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              {isFullTransfer
                ? 'Full transfer: the complete item will move to the selected box.'
                : 'Partial transfer: the old item quantity will reduce and a new item copy will be created in the destination box.'}
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Reason / note</label>
            <textarea
              className="form-control"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              disabled={loading}
              placeholder="Example: moved to production, shifted to testing, stock re-arranged..."
              rows={3}
              style={{ resize: 'vertical' }}
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
              disabled={
                loading ||
                !targetBoxId ||
                targetBoxId === currentBoxId ||
                transferQuantity <= 0 ||
                transferQuantity > itemQuantity
              }
              style={{ flex: 1 }}
            >
              {loading ? (
                <span className="spin-loader"></span>
              ) : (
                <>
                  <Save size={16} />
                  <span>{isFullTransfer ? 'Move Item' : 'Split & Move'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
interface MoveBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMove: () => Promise<void>;
  boxName: string;
  currentRoomId: string;
  targetRoomId: string;
  setTargetRoomId: (id: string) => void;
  rooms: Room[];
}

export const MoveBoxModal: React.FC<MoveBoxModalProps> = ({
  isOpen,
  onClose,
  onMove,
  boxName,
  currentRoomId,
  targetRoomId,
  setTargetRoomId,
  rooms,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRoomId) {
      setError('Please select a storage room.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onMove();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error occurred while moving box.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div style={styles.modalHeader}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Move Box: {boxName}</h3>
          <button style={styles.closeBtn} onClick={onClose} disabled={loading}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.errorBanner}>{error}</div>}

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Destination Room</label>
            <select
              className="form-control"
              value={targetRoomId}
              onChange={(e) => setTargetRoomId(e.target.value)}
              disabled={loading}
              required
              style={{ padding: '10px 14px' }}
            >
              <option value="" disabled>-- Select target room --</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} {room.id === currentRoomId ? '(Current)' : ''}
                </option>
              ))}
            </select>
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
              disabled={loading || !targetRoomId || targetRoomId === currentRoomId}
              style={{ flex: 1 }}
            >
              {loading ? (
                <span className="spin-loader"></span>
              ) : (
                <>
                  <Save size={16} />
                  <span>Move</span>
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

