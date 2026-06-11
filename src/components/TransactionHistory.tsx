import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Search, Filter, Calendar } from 'lucide-react';

interface Transaction {
  id: string;
  item_id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  notes?: string;
  created_at: string;
  inventory_items?: {
    name: string | null;
    sku: string | null;
  } | null;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ transactions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  // Filtered transactions
  const filteredTransactions = transactions.filter((tx) => {
    const itemName = (tx.inventory_items?.name || '').toLowerCase();
    const itemSku = (tx.inventory_items?.sku || '').toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      itemName.includes(search) ||
      itemSku.includes(search);

    const matchesType =
      typeFilter === 'ALL' ||
      tx.type === typeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div style={styles.container} className="animate-slide-up">
      {/* Header */}
      <div>
        <h1 style={styles.title}>Activity Log</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Audit history of all inventory intake and outflow operations.</p>
      </div>

      {/* Filters Panel */}
      <div style={styles.filterPanel} className="glass-panel">
        <div style={styles.searchContainer}>
          <Search size={18} style={styles.searchIcon} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by product name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '44px' }}
          />
        </div>

        <div style={styles.dropdownsContainer}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={styles.filterLabel}>Movement Type</span>
            <select
              className="form-control"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              style={{ padding: '10px 14px' }}
            >
              <option value="ALL">All Movements</option>
              <option value="IN">Stock Additions (IN)</option>
              <option value="OUT">Stock Drawdowns (OUT)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Log list */}
      <div className="glass-panel" style={styles.listWrapper}>
        {filteredTransactions.length === 0 ? (
          <div style={styles.emptyState}>
            <Filter size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p style={{ color: 'var(--text-secondary)' }}>No transactions matched your query.</p>
          </div>
        ) : (
          <div style={styles.timeline}>
            {filteredTransactions.map((tx) => {
              const isAdd = tx.type === 'IN';
              const isRemove = tx.type === 'OUT';
              const formattedDate = new Date(tx.created_at).toLocaleDateString([], {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
              const formattedTime = new Date(tx.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={tx.id} style={styles.timelineItem}>
                  {/* Timeline Badge Icon */}
                  <div style={{
                    ...styles.iconWrapper,
                    backgroundColor: isAdd ? 'var(--success-glow)' : isRemove ? 'var(--danger-glow)' : 'var(--primary-glow)',
                    color: isAdd ? 'var(--success)' : isRemove ? 'var(--danger)' : 'var(--primary)',
                    borderColor: isAdd ? 'hsla(142, 72%, 50%, 0.3)' : isRemove ? 'hsla(350, 80%, 55%, 0.3)' : 'hsla(262, 83%, 62%, 0.3)',
                  }}>
                    {isAdd ? <ArrowUpRight size={18} /> : isRemove ? <ArrowDownRight size={18} /> : <RefreshCw size={16} />}
                  </div>

                  {/* Log Details */}
                  <div style={styles.detailsContainer}>
                    <div style={styles.detailsHeader}>
                      <div>
                        <h4 style={styles.itemName}>
                          {tx.inventory_items?.name || <span style={{ color: 'var(--text-muted)' }}>Deleted Product</span>}
                        </h4>
                        {tx.inventory_items?.sku && (
                          <span style={styles.skuLabel}>SKU: {tx.inventory_items.sku}</span>
                        )}
                      </div>
                      <div style={styles.dateContainer}>
                        <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {formattedDate} at {formattedTime}
                        </span>
                      </div>
                    </div>

                    <div style={styles.detailsBody}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Quantity change:</span>
                        <strong style={{
                          fontSize: '1rem',
                          color: isAdd ? 'var(--success)' : isRemove ? 'var(--danger)' : 'var(--primary)'
                        }}>
                          {isAdd ? '+' : ''}{tx.quantity}
                        </strong>
                      </div>
                      {tx.notes && (
                        <p style={styles.notesText}>
                          <strong>Notes: </strong>{tx.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    width: '100%',
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, var(--text-primary) 30%, var(--text-secondary) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  filterPanel: {
    padding: '20px',
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
  },
  searchContainer: {
    position: 'relative',
    flex: 2,
    minWidth: '280px',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '16px',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  dropdownsContainer: {
    display: 'flex',
    flex: 1,
    gap: '16px',
    minWidth: '200px',
  },
  filterLabel: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  listWrapper: {
    padding: '30px 24px',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-md)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 0',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    position: 'relative',
  },
  timelineItem: {
    display: 'flex',
    gap: '20px',
    position: 'relative',
  },
  iconWrapper: {
    width: '44px',
    height: '44px',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: '1px solid transparent',
  },
  detailsContainer: {
    flex: 1,
    padding: '16px 20px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  detailsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    flexWrap: 'wrap',
  },
  itemName: {
    fontSize: '1.05rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  skuLabel: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    background: 'var(--bg-card)',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid var(--border-color)',
    display: 'inline-block',
    marginTop: '4px',
  },
  dateContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  detailsBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '10px',
  },
  notesText: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
};
