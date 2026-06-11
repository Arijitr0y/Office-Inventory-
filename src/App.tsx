import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { InventoryList } from './components/InventoryList';
import { InventoryModal } from './components/InventoryModal';
import { TransactionHistory } from './components/TransactionHistory';
import {
  LayoutDashboard,
  History,
  Settings as SettingsIcon,
  LogOut,
  User,
  Download,
  RefreshCw,
  Smartphone,
  CheckSquare,
  Search as SearchIcon,
  Plus,
  AlertTriangle,
  Minus
} from 'lucide-react';

interface Room {
  id: string;
  name: string;
  created_at: string;
}

interface Box {
  id: string;
  room_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

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

interface Transaction {
  id: string;
  item_id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  notes?: string;
  created_at: string;
  inventory_items?: { name: string; sku: string };
}

export const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'history' | 'checklist' | 'settings'>('home');

  // Storage Hierarchy States
  const [rooms, setRooms] = useState<Room[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [targetBoxId, setTargetBoxId] = useState<string | null>(null);

  // PWA install states
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Local adjustment state for checklist
  const [checklistAdjustingId, setChecklistAdjustingId] = useState<string | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthChecked(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch rooms, boxes, items, transactions
  const fetchData = async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      // Fetch Rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: true });
      if (roomsError) throw roomsError;
      setRooms(roomsData || []);

      // Fetch Boxes
      const { data: boxesData, error: boxesError } = await supabase
        .from('boxes')
        .select('*')
        .order('created_at', { ascending: true });
      if (boxesError) throw boxesError;
      setBoxes(boxesData || []);

      // Fetch inventory items
      const { data: itemsData, error: itemsError } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name', { ascending: true });
      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Fetch transactions
      const { data: txData, error: txError } = await supabase
        .from('stock_transactions')
        .select(`
          id,
          item_id,
          type,
          quantity,
          notes,
          created_at,
          inventory_items (
            name,
            sku
          )
        `)
        .order('created_at', { ascending: false });
      if (txError) throw txError;
      setTransactions((txData as any) || []);
    } catch (err: any) {
      console.error('Error fetching inventory storage data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchData();
    }
  }, [session]);

  // Listen for PWA install event
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });

    window.addEventListener('appinstalled', () => {
      setInstallPrompt(null);
    });
  }, []);

  const handleInstallPWA = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setRooms([]);
    setBoxes([]);
    setItems([]);
    setTransactions([]);
    setActiveTab('home');
  };

  // Adjust stock quantity inside interactive checklist tab
  const handleAdjustChecklistItem = async (item: InventoryItem, amount: number) => {
    const newQty = item.quantity + amount;
    if (newQty < 0) return;

    setChecklistAdjustingId(item.id);
    try {
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
          user_id: session.user.id,
          type: amount > 0 ? 'IN' : 'OUT',
          quantity: Math.abs(amount),
          notes: `Checklist replenish adjustment (${amount > 0 ? '+' : ''}${amount})`,
        });

      if (txError) console.error('Error logging transaction:', txError);

      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error adjusting quantity');
    } finally {
      setChecklistAdjustingId(null);
    }
  };

  const exportCSV = () => {
    if (items.length === 0) return;

    const headers = ['ID', 'Name', 'SKU', 'Category', 'Quantity', 'Min Stock Level', 'Price', 'Location', 'Box ID', 'Description'];
    const rows = items.map(item => [
      item.id,
      `"${item.name.replace(/"/g, '""')}"`,
      item.sku || '',
      item.category || '',
      item.quantity,
      item.min_stock_level,
      item.price,
      item.location || '',
      item.box_id || '',
      `"${(item.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `velostock_inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!authChecked) {
    return (
      <div style={styles.loadingContainer}>
        <RefreshCw size={40} className="spin" style={{ color: 'var(--primary)' }} />
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Initializing VeloStock...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth onAuthSuccess={() => { }} />;
  }

  const renderActiveTabContent = () => {
    if (loading && items.length === 0 && rooms.length === 0) {
      return (
        <div style={styles.loadingContainer}>
          <RefreshCw size={32} className="spin" style={{ color: 'var(--primary)' }} />
          <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Syncing storage layout...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <Dashboard
            rooms={rooms}
            boxes={boxes}
            items={items}
            userId={session.user.id}
            onRefresh={fetchData}
            onEditItem={(item) => { setEditItem(item); setTargetBoxId(item.box_id || null); setIsModalOpen(true); }}
            onAddItemInBox={(boxId) => { setTargetBoxId(boxId); setEditItem(null); setIsModalOpen(true); }}
          />
        );
      case 'search':
        return (
          <InventoryList
            items={items}
            userId={session.user.id}
            onRefresh={fetchData}
            onEditItem={(item) => { setEditItem(item); setTargetBoxId(item.box_id || null); setIsModalOpen(true); }}
          />
        );
      case 'history':
        return <TransactionHistory transactions={transactions} />;
      case 'checklist':
        const lowStockItems = items.filter(item => item.quantity <= item.min_stock_level);
        return (
          <div className="animate-slide-up" style={{ width: '100%' }}>
            <h1 style={styles.tabTitle}>Restock Checklist</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Items whose quantities have fallen to or below warnings threshold.
            </p>

            {lowStockItems.length === 0 ? (
              <div style={styles.emptyChecklist}>
                <CheckSquare size={44} style={{ color: 'var(--success)', marginBottom: '12px' }} />
                <h3>All Stock is Healthy</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                  No items require replenishment alerts.
                </p>
              </div>
            ) : (
              <div style={styles.checklistWrapper}>
                {lowStockItems.map(item => {
                  const associatedBox = boxes.find(b => b.id === item.box_id);
                  const associatedRoom = associatedBox ? rooms.find(r => r.id === associatedBox.room_id) : null;

                  return (
                    <div key={item.id} style={styles.checklistCard} className="glass-panel">
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={styles.warningAlertIcon}>
                          <AlertTriangle size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div style={styles.checklistCardMeta}>
                            <span>Box: {associatedBox?.name || 'Unassigned'}</span>
                            <span>•</span>
                            <span>Room: {associatedRoom?.name || 'Unassigned'}</span>
                          </div>
                        </div>
                      </div>

                      <div style={styles.checklistQtyControls}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--warning)' }}>
                            {item.quantity} / {item.min_stock_level}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stock / Min Alert</span>
                        </div>

                        {checklistAdjustingId === item.id ? (
                          <RefreshCw size={14} className="spin" style={{ color: 'var(--primary)', margin: '0 8px' }} />
                        ) : (
                          <div style={styles.qtyContainer}>
                            <button
                              className="btn-icon"
                              style={styles.checklistQtyBtn}
                              onClick={() => handleAdjustChecklistItem(item, -1)}
                              disabled={item.quantity === 0}
                            >
                              <Minus size={12} />
                            </button>
                            <button
                              className="btn-icon"
                              style={styles.checklistQtyBtn}
                              onClick={() => handleAdjustChecklistItem(item, 1)}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      case 'settings':
        return (
          <div className="animate-slide-up" style={{ width: '100%' }}>
            <h1 style={styles.tabTitle}>Settings</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Control your system configurations and perform export tasks.</p>

            <div style={styles.settingsGrid}>
              {/* Account Card */}
              <div style={styles.settingsCard} className="glass-panel">
                <h3 style={styles.settingsCardTitle}>User Account</h3>
                <div style={styles.accountRow}>
                  <div style={styles.avatar}>
                    <User size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{session.user.email}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registered Admin</div>
                  </div>
                </div>
                <button className="btn btn-secondary" style={{ width: '100%', marginTop: '16px' }} onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>

              {/* Data Operations */}
              <div style={styles.settingsCard} className="glass-panel">
                <h3 style={styles.settingsCardTitle}>Backup & Exports</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Download a snapshot of your current catalog to back up your records.
                </p>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={exportCSV}
                  disabled={items.length === 0}
                >
                  <Download size={16} />
                  <span>Download Catalog (.csv)</span>
                </button>
              </div>

              {/* Device Status */}
              <div style={styles.settingsCard} className="glass-panel">
                <h3 style={styles.settingsCardTitle}>System Metadata</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
                  <div style={styles.metadataRow}>
                    <span>App Version</span>
                    <strong>1.1.0 (Nested Storage Edition)</strong>
                  </div>
                  <div style={styles.metadataRow}>
                    <span>Database Status</span>
                    <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%' }}></span>
                      Connected
                    </span>
                  </div>
                  <div style={styles.metadataRow}>
                    <span>Offline Engine</span>
                    <strong>Service Worker Active</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      {/* PWA Install Promo bar if prompt is available */}
      {installPrompt && (
        <div style={styles.installBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <Smartphone size={16} />
            <span>Install VeloStock for offline capabilities and app icon on home screen.</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleInstallPWA} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
            Install App
          </button>
        </div>
      )}

      {/* Main View Area */}
      <main className="main-content">
        {renderActiveTabContent()}
      </main>

      {/* Bottom Navigation tab bar - matching mockup navigation */}
      <nav className="bottom-nav-bar">
        <button
          className={`bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <LayoutDashboard size={20} />
          <span>Home</span>
        </button>

        <button
          className={`bottom-nav-item ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <SearchIcon size={20} />
          <span>Search</span>
        </button>

        <button
          className={`bottom-nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={20} />
          <span>History</span>
        </button>

        <button
          className={`bottom-nav-item ${activeTab === 'checklist' ? 'active' : ''}`}
          onClick={() => setActiveTab('checklist')}
        >
          <CheckSquare size={20} />
          <span>Checklist</span>
        </button>

        <button
          className={`bottom-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <SettingsIcon size={20} />
          <span>Settings</span>
        </button>
      </nav>

      {/* Inventory Add/Edit Modal */}
      <InventoryModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditItem(null); setTargetBoxId(null); }}
        onSave={fetchData}
        userId={session.user.id}
        editItem={editItem}
        boxId={targetBoxId}
        boxName={boxes.find((box) => box.id === targetBoxId)?.name || null}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    height: '100%',
    width: '100%',
  },
  installBanner: {
    background: 'var(--bg-card-solid)',
    borderBottom: '1px solid var(--border-color)',
    padding: '8px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    zIndex: 101,
  },
  tabTitle: {
    fontSize: '1.8rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, var(--text-primary) 30%, var(--text-secondary) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '4px',
  },
  emptyChecklist: {
    padding: '60px 24px',
    textAlign: 'center',
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    border: '1px dashed var(--border-color)',
    marginTop: '20px',
  },
  checklistWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '16px',
  },
  checklistCard: {
    padding: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
  },
  warningAlertIcon: {
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--warning-glow)',
    color: 'var(--warning)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checklistCardMeta: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    display: 'flex',
    gap: '6px',
    marginTop: '2px',
  },
  checklistQtyControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  qtyContainer: {
    display: 'flex',
    gap: '6px',
  },
  checklistQtyBtn: {
    width: '28px',
    height: '28px',
    borderRadius: 'var(--radius-sm)',
  },
  settingsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '20px',
  },
  settingsCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
  },
  settingsCardTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    marginBottom: '16px',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '8px',
  },
  accountRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: 'var(--text-secondary)',
  },
  metadataRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid hsla(225, 20%, 22%, 0.2)',
    paddingBottom: '8px',
  },
};
export default App;
