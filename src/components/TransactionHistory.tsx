import React, { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  ArrowRightLeft,
} from 'lucide-react';

interface Transaction {
  id: string;
  item_id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
  quantity: number;
  notes?: string;
  movement_reason?: string | null;
  from_box_id?: string | null;
  to_box_id?: string | null;
  related_item_id?: string | null;
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
  const [typeFilter, setTypeFilter] = useState<
    'ALL' | 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'
  >('ALL');

  const filteredTransactions = transactions.filter((tx) => {
    const itemName = (tx.inventory_items?.name || '').toLowerCase();
    const itemSku = (tx.inventory_items?.sku || '').toLowerCase();
    const notes = (tx.notes || '').toLowerCase();
    const reason = (tx.movement_reason || '').toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      itemName.includes(search) ||
      itemSku.includes(search) ||
      notes.includes(search) ||
      reason.includes(search);

    const matchesType =
      typeFilter === 'ALL' ||
      tx.type === typeFilter;

    return matchesSearch && matchesType;
  });

  const getTxVisual = (tx: Transaction) => {
    if (tx.type === 'IN') {
      return {
        label: 'Stock In',
        icon: <ArrowUpRight size={18} />,
        background: 'var(--success-glow)',
        color: 'var(--success)',
        borderColor: 'hsla(142, 72%, 50%, 0.3)',
        qtyPrefix: '+',
      };
    }

    if (tx.type === 'OUT') {
      return {
        label: 'Stock Out',
        icon: <ArrowDownRight size={18} />,
        background: 'var(--danger-glow)',
        color: 'var(--danger)',
        borderColor: 'hsla(350, 80%, 55%, 0.3)',
        qtyPrefix: '-',
      };
    }

    if (tx.type === 'TRANSFER') {
      return {
        label: 'Stock Transfer',
        icon: <ArrowRightLeft size={18} />,
        background: 'var(--primary-glow)',
        color: 'var(--primary)',
        borderColor: 'hsla(262, 83%, 62%, 0.3)',
        qtyPrefix: '',
      };
    }

    return {
      label: 'Adjustment',
      icon: <RefreshCw size={16} />,
      background: 'var(--primary-glow)',
      color: 'var(--primary)',
      borderColor: 'hsla(262, 83%, 62%, 0.3)',
      qtyPrefix: '',
    };
  };

  return (
    <div style={styles.container} className="animate-slide-up">
      <div>
        <h1 style={styles.title}>Activity Log</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Audit history of stock in, stock out, adjustments, and stock transfers.
        </p>
      </div>

      <div style={styles.filterPanel} className="glass-panel">
        <div style={styles.searchContainer}>
          <Search size={18} style={styles.searchIcon} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by product name, SKU, note, or reason..."
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
              <option value="IN">Stock Additions</option>
              <option value="OUT">Stock Outflow</option>
              <option value="TRANSFER">Stock Transfer</option>
              <option value="ADJUSTMENT">Adjustments</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={styles.listWrapper}>
        {filteredTransactions.length === 0 ? (
          <div style={styles.emptyState}>
            <Filter size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p style={{ color: 'var(--text-secondary)' }}>
              No transactions matched your query.
            </p>
          </div>
        ) : (
          <div style={styles.timeline}>
            {filteredTransactions.map((tx) => {
              const visual = getTxVisual(tx);

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
                  <div
                    style={{
                      ...styles.iconWrapper,
                      backgroundColor: visual.background,
                      color: visual.color,
                      borderColor: visual.borderColor,
                    }}
                  >
                    {visual.icon}
                  </div>

                  <div style={styles.detailsContainer}>
                    <div style={styles.detailsHeader}>
                      <div>
                        <div style={styles.typeLabel}>{visual.label}</div>

                        <h4 style={styles.itemName}>
                          {tx.inventory_items?.name || (
                            <span style={{ color: 'var(--text-muted)' }}>
                              Deleted Product
                            </span>
                          )}
                        </h4>

                        {tx.inventory_items?.sku && (
                          <span style={styles.skuLabel}>
                            SKU: {tx.inventory_items.sku}
                          </span>
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
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          {tx.type === 'TRANSFER' ? 'Quantity transferred:' : 'Quantity change:'}
                        </span>

                        <strong
                          style={{
                            fontSize: '1rem',
                            color: visual.color,
                          }}
                        >
                          {visual.qtyPrefix}
                          {tx.quantity}
                        </strong>
                      </div>

                      {tx.notes && (
                        <p style={styles.notesText}>
                          <strong>Details: </strong>
                          {tx.notes}
                        </p>
                      )}

                      {tx.movement_reason && (
                        <p style={styles.reasonText}>
                          <strong>Reason: </strong>
                          {tx.movement_reason}
                        </p>
                      )}

                      {tx.type === 'TRANSFER' && tx.related_item_id && (
                        <p style={styles.metaText}>
                          {tx.related_item_id === tx.item_id
                            ? 'Full item transfer'
                            : 'Partial transfer created a new item entry in the destination box'}
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
  typeLabel: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '4px',
    fontWeight: 700,
  },
  itemName: {
    fontSize: '1.05rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  skuLabel: {
    fontSize: '0.76rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
    display: 'inline-block',
  },
  dateContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  detailsBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  notesText: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
  },
  reasonText: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    padding: '8px 10px',
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
  },
  metaText: {
    fontSize: '0.76rem',
    color: 'var(--text-muted)',
  },
};