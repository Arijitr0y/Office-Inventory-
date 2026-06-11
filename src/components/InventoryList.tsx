import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Filter, ArrowUpDown, Plus, Minus, Edit2, Trash2, MapPin, Tag, RefreshCw } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  min_stock_level: number;
  price: number;
  location?: string;
  image_url?: string;
  description?: string;
  box_id?: string | null;
}

interface InventoryListProps {
  items: InventoryItem[];
  userId: string;
  onRefresh: () => void;
  onEditItem: (item: InventoryItem) => void;
}

const CATEGORIES = [
  'All',
  'General',
  'Electronics',
  'Office Supplies',
  'Furniture',
  'Apparel',
  'Food & Beverage',
  'Raw Materials',
  'Tools & Equipment',
  'Packaging'
];

type SortKey = 'name' | 'quantity' | 'price' | 'sku';
type SortOrder = 'asc' | 'desc';

export const InventoryList: React.FC<InventoryListProps> = ({
  items,
  userId,
  onRefresh,
  onEditItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockStatus, setStockStatus] = useState<'All' | 'Low' | 'Out' | 'In'>('All');

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Quick adjust quantity by +/- amount
  const handleQuickAdjust = async (item: InventoryItem, amount: number) => {
    const newQty = item.quantity + amount;
    if (newQty < 0) return;

    setAdjustingId(item.id);
    try {
      // Update item quantity
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ quantity: newQty })
        .eq('id', item.id);

      if (updateError) throw updateError;

      // Log transaction
      const { error: txError } = await supabase
        .from('stock_transactions')
        .insert({
          item_id: item.id,
          user_id: userId,
          type: amount > 0 ? 'IN' : 'OUT',
          quantity: Math.abs(amount),
          notes: `Quick adjust (${amount > 0 ? '+' : ''}${amount})`,
        });

      if (txError) console.error('Error logging transaction:', txError);

      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error adjusting inventory quantity');
    } finally {
      setAdjustingId(null);
    }
  };

  // Delete inventory item
  const handleDelete = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error deleting item');
    } finally {
      setDeletingId(null);
    }
  };

  // Handle sort changes
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // Filter and sort items list
  const processedItems = items
    .filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;

      let matchesStatus = true;
      if (stockStatus === 'Low') {
        matchesStatus = item.quantity <= item.min_stock_level && item.quantity > 0;
      } else if (stockStatus === 'Out') {
        matchesStatus = item.quantity === 0;
      } else if (stockStatus === 'In') {
        matchesStatus = item.quantity > item.min_stock_level;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      let valA: any = a[sortKey];
      let valB: any = b[sortKey];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div style={styles.container} className="animate-slide-up">
      {/* Header and Controls */}
      <div style={styles.listHeader}>
        <div>
          <h1 style={styles.title}>Inventory Stock</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your products and execute quick stock intakes or drawdowns.</p>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div style={styles.filterPanel} className="glass-panel">
        <div style={styles.searchContainer}>
          <Search size={18} style={styles.searchIcon} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by name, SKU or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '44px' }}
          />
        </div>

        <div style={styles.dropdownsContainer}>
          {/* Category Filter */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={styles.filterLabel}>Category</span>
            <select
              className="form-control"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ padding: '10px 14px' }}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={styles.filterLabel}>Stock Status</span>
            <select
              className="form-control"
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value as any)}
              style={{ padding: '10px 14px' }}
            >
              <option value="All">All Levels</option>
              <option value="In">{"Healthy (> Min)"}</option>
              <option value="Low">Low Stock (≤ Min)</option>
              <option value="Out">Out of Stock (0)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Display Table */}
      <div className="glass-panel" style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th onClick={() => toggleSort('name')} style={styles.sortableHeader}>
                <div style={styles.headerCell}>Product Name <ArrowUpDown size={14} /></div>
              </th>
              <th onClick={() => toggleSort('sku')} style={styles.sortableHeader}>
                <div style={styles.headerCell}>SKU / Code <ArrowUpDown size={14} /></div>
              </th>
              <th>Category</th>
              <th onClick={() => toggleSort('price')} style={styles.sortableHeader}>
                <div style={styles.headerCell}>Unit Price <ArrowUpDown size={14} /></div>
              </th>
              <th onClick={() => toggleSort('quantity')} style={{ ...styles.sortableHeader, width: '170px' }}>
                <div style={styles.headerCell}>Quantity <ArrowUpDown size={14} /></div>
              </th>
              <th>Status</th>
              <th>Warehouse</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {processedItems.length === 0 ? (
              <tr>
                <td colSpan={8} style={styles.tableEmpty}>
                  <Filter size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>No items matched your query.</p>
                </td>
              </tr>
            ) : (
              processedItems.map((item) => {
                const isLow = item.quantity <= item.min_stock_level && item.quantity > 0;
                const isOut = item.quantity === 0;

                return (
                  <tr key={item.id} style={styles.tableRow} className="table-row-hover">
                    <td style={styles.itemNameCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} style={styles.itemImg} onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1540747737956-37872404f80f?w=100';
                          }} />
                        ) : (
                          <div style={styles.itemImgPlaceholder}>
                            {item.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          <span style={styles.itemDescText}>{item.description || 'No description provided'}</span>
                        </div>
                      </div>
                    </td>
                    <td><code style={styles.skuCode}>{item.sku || '—'}</code></td>
                    <td>
                      <span style={styles.categoryChip}>
                        <Tag size={12} style={{ opacity: 0.7 }} />
                        {item.category}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>${item.price.toFixed(2)}</td>
                    <td>
                      {adjustingId === item.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <RefreshCw size={16} className="spin" style={{ color: 'var(--primary)' }} />
                          <span style={{ color: 'var(--text-muted)' }}>Updating...</span>
                        </div>
                      ) : (
                        <div style={styles.qtyContainer}>
                          <button
                            className="btn-icon"
                            style={styles.qtyBtn}
                            onClick={() => handleQuickAdjust(item, -1)}
                            disabled={item.quantity === 0}
                            title="Quick Subtract -1"
                          >
                            <Minus size={14} />
                          </button>
                          <span style={styles.qtyText}>{item.quantity}</span>
                          <button
                            className="btn-icon"
                            style={styles.qtyBtn}
                            onClick={() => handleQuickAdjust(item, 1)}
                            title="Quick Add +1"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${isOut ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}`}>
                        {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Healthy'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {item.location ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} />
                          <span>{item.location}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          className="btn-icon"
                          style={{ width: '32px', height: '32px' }}
                          onClick={() => onEditItem(item)}
                          title="Edit Details"
                        >
                          <Edit2 size={14} />
                        </button>

                        {deletingId === item.id ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(item.id)}
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              Confirm
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setDeletingId(null)}
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn-icon"
                            style={{ width: '32px', height: '32px', color: 'var(--danger)' }}
                            onClick={() => setDeletingId(item.id)}
                            title="Delete Product"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
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
    flex: 1.5,
    gap: '16px',
    minWidth: '280px',
  },
  filterLabel: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  tableWrapper: {
    overflowX: 'auto',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-md)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  tableHeaderRow: {
    borderBottom: '1px solid var(--border-color)',
    background: 'hsla(223, 20%, 8%, 0.5)',
  },
  sortableHeader: {
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'color var(--transition-fast)',
  },
  headerCell: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  tableRow: {
    borderBottom: '1px solid var(--border-color)',
    transition: 'background var(--transition-fast)',
  },
  itemNameCell: {
    padding: '16px 20px',
  },
  itemImg: {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius-sm)',
    objectFit: 'cover',
    border: '1px solid var(--border-color)',
  },
  itemImgPlaceholder: {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    color: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '1.2rem',
  },
  itemDescText: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    maxWidth: '240px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: '2px',
  },
  skuCode: {
    fontFamily: 'monospace',
    background: 'var(--bg-input)',
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    fontSize: '0.85rem',
  },
  categoryChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8rem',
    background: 'var(--bg-input)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
  },
  qtyContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  qtyBtn: {
    width: '28px',
    height: '28px',
    borderRadius: 'var(--radius-sm)',
  },
  qtyText: {
    fontSize: '0.95rem',
    fontWeight: 600,
    minWidth: '24px',
    textAlign: 'center',
  },
  tableEmpty: {
    padding: '60px 0',
    textAlign: 'center',
  },
};

// Add standard table styling hook to stylesheet
if (!document.getElementById('table-hover-style')) {
  const stylesTag = document.createElement('style');
  stylesTag.id = 'table-hover-style';
  stylesTag.innerHTML = `
    table th {
      padding: 16px 20px;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      font-weight: 600;
    }
    table td {
      padding: 14px 20px;
      font-size: 0.95rem;
    }
    .table-row-hover:hover {
      background-color: hsla(223, 20%, 15%, 0.4);
    }
    .spin {
      animation: spin 0.8s linear infinite;
    }
  `;
  document.head.appendChild(stylesTag);
}
