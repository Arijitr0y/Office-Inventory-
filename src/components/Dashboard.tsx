import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  Plus,
  ArrowRight,
  HelpCircle,
  User,
  ArrowUpDown,
  LayoutGrid,
  List,
  Package,
  Edit2,
  Trash2,
  PlusCircle,
  ArrowLeft,
  Tag,
  MapPin,
  Minus,
  RefreshCw,
  //Printer,
  AlertTriangle
} from 'lucide-react';
import { NamingModal, MoveItemModal, MoveBoxModal } from './RoomBoxModals';
import type { UserSettings } from './UserSettings';

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
  archived?: boolean;
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

interface DashboardProps {
  rooms: Room[];
  boxes: Box[];
  items: InventoryItem[];
  userId: string;
  onRefresh: () => void;
  onEditItem: (item: InventoryItem) => void;
  onAddItemInBox: (boxId: string) => void;
  onOpenSettings: () => void;
  settings: UserSettings;
}

export const Dashboard: React.FC<DashboardProps> = ({
  rooms,
  boxes,
  items,
  userId,
  onRefresh,
  onEditItem,
  onAddItemInBox,
  onOpenSettings,
  settings,
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);

  // Sorting/View states
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortOrder, setSortOrder] = useState<'recent' | 'name'>('recent');

  // Naming Modals states
  const [namingModalOpen, setNamingModalOpen] = useState(false);
  const [namingTarget, setNamingTarget] = useState<'room-add' | 'room-edit' | 'box-add' | 'box-edit'>('room-add');
  const [editingId, setEditingId] = useState<string>('');
  const [editingInitialValue, setEditingInitialValue] = useState('');

  // Local adjusting spinner tracking
  const [adjustingItemId, setAdjustingItemId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const [movingItem, setMovingItem] = useState<InventoryItem | null>(null);
  const [movingBox, setMovingBox] = useState<Box | null>(null);
  const [moveTargetBoxId, setMoveTargetBoxId] = useState('');
  const [moveTargetRoomId, setMoveTargetRoomId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState(1);
  const [transferReason, setTransferReason] = useState('');
  const [moving, setMoving] = useState(false);

  // Set default selected room if not set
  React.useEffect(() => {
    if (rooms.length === 0) {
      if (selectedRoomId) setSelectedRoomId('');
      return;
    }

    const selectedRoomStillExists = rooms.some((room) => room.id === selectedRoomId);
    const defaultRoomStillExists = settings.defaultRoomId
      ? rooms.some((room) => room.id === settings.defaultRoomId)
      : false;

    if (!selectedRoomId || !selectedRoomStillExists) {
      setSelectedRoomId(
        defaultRoomStillExists && settings.defaultRoomId
          ? settings.defaultRoomId
          : rooms[0].id
      );
    }
  }, [rooms, selectedRoomId, settings.defaultRoomId]);

  const activeRoom = rooms.find(r => r.id === selectedRoomId);
  const activeRoomName = activeRoom ? activeRoom.name : 'Storage Room';

  // Filter boxes in active room
  const boxesInActiveRoom = boxes.filter(b => b.room_id === selectedRoomId);

  // Sort boxes
  const sortedBoxes = [...boxesInActiveRoom].sort((a, b) => {
    if (sortOrder === 'name') {
      return a.name.localeCompare(b.name);
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const activeBox = boxes.find(b => b.id === activeBoxId);
  const itemsInActiveBox = items.filter(item => item.box_id === activeBoxId);

  const shouldShowStockWarning = (item: InventoryItem) => {
    const isOut = item.quantity === 0;
    const isLow = item.quantity > 0 && item.quantity <= item.min_stock_level;

    return (
      (isOut && settings.outOfStockWarningEnabled) ||
      (isLow && settings.lowStockWarningEnabled)
    );
  };

  const getStockBadge = (item: InventoryItem) => {
    if (item.quantity === 0 && settings.outOfStockWarningEnabled) {
      return { label: 'Out', className: 'badge-danger' };
    }

    if (
      item.quantity > 0 &&
      item.quantity <= item.min_stock_level &&
      settings.lowStockWarningEnabled
    ) {
      return { label: 'Low', className: 'badge-warning' };
    }

    return { label: 'Healthy', className: 'badge-success' };
  };

  const homeWarningItems = settings.showLowStockOnHome
    ? items.filter(shouldShowStockWarning).slice(0, 5)
    : [];

  // Room DB Operations
  const handleSaveRoom = async (name: string) => {
    if (namingTarget === 'room-add') {
      const { data, error } = await supabase
        .from('rooms')
        .insert({ name, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      if (data) setSelectedRoomId(data.id);
    } else if (namingTarget === 'room-edit') {
      const { error } = await supabase
        .from('rooms')
        .update({ name })
        .eq('id', editingId);
      if (error) throw error;
    }
    onRefresh();
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoomId) return;

    const boxesInsideRoom = boxes.filter((box) => box.room_id === selectedRoomId);
    const boxIdsInsideRoom = boxesInsideRoom.map((box) => box.id);
    const itemCountInsideRoom = items.filter(
      (item) => item.box_id && boxIdsInsideRoom.includes(item.box_id)
    ).length;

    if (settings.blockDeleteRoomWithItems && itemCountInsideRoom > 0) {
      alert(
        `Room delete blocked. "${activeRoomName}" contains ${itemCountInsideRoom} inventory item(s). Move or delete those items first, or turn off this setting.`
      );
      return;
    }

    const confirmMessage =
      itemCountInsideRoom > 0
        ? `Are you sure you want to delete the room "${activeRoomName}"? It contains ${itemCountInsideRoom} item(s). All boxes and items inside it will be permanently deleted.`
        : `Are you sure you want to delete the room "${activeRoomName}"? Empty boxes inside it will also be deleted.`;

    const confirmDelete = window.confirm(confirmMessage);
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', selectedRoomId)
        .eq('user_id', userId);

      if (error) throw error;

      const remainingRooms = rooms.filter((r) => r.id !== selectedRoomId);

      if (remainingRooms.length > 0) {
        setSelectedRoomId(remainingRooms[0].id);
      } else {
        setSelectedRoomId('');
      }

      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error deleting room');
    }
  };

  // Box DB Operations
  const handleSaveBox = async (name: string) => {
    if (namingTarget === 'box-add') {
      if (!selectedRoomId) throw new Error('Please select or create a storage room first.');
      const { error } = await supabase
        .from('boxes')
        .insert({ name, room_id: selectedRoomId, user_id: userId });
      if (error) throw error;
    } else if (namingTarget === 'box-edit') {
      const { error } = await supabase
        .from('boxes')
        .update({ name })
        .eq('id', editingId);
      if (error) throw error;
    }
    onRefresh();
  };

  const handleDeleteBox = async (boxId: string) => {
    const box = boxes.find((b) => b.id === boxId);
    const boxItems = items.filter((item) => item.box_id === boxId);

    if (settings.archiveEmptyBoxes && boxItems.length === 0) {
      const confirmArchive = window.confirm(
        `Archive the empty box "${box?.name || 'Box'}" instead of deleting it?`
      );

      if (!confirmArchive) return;

      try {
        const { error } = await supabase
          .from('boxes')
          .update({ archived: true })
          .eq('id', boxId)
          .eq('user_id', userId);

        if (error) throw error;

        if (activeBoxId === boxId) {
          setActiveBoxId(null);
        }

        onRefresh();
      } catch (err: any) {
        alert(
          err.message ||
          'Error archiving box. Make sure the Google Sheet API is deployed and the boxes tab has the archived column.'
        );
      }

      return;
    }

    const confirmMessage =
      boxItems.length > 0
        ? `Are you sure you want to delete the box "${box?.name || 'Box'}"? ${boxItems.length} item(s) inside it will be permanently deleted.`
        : `Are you sure you want to permanently delete the empty box "${box?.name || 'Box'}"?`;

    const confirmDelete = window.confirm(confirmMessage);
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('boxes')
        .delete()
        .eq('id', boxId)
        .eq('user_id', userId);

      if (error) throw error;

      if (activeBoxId === boxId) {
        setActiveBoxId(null);
      }

      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error deleting box');
    }
  };

  // Quick adjust quantity in box detail view
  const handleQuickAdjustItem = async (item: InventoryItem, amount: number) => {
    const newQty = item.quantity + amount;
    if (newQty < 0) return;

    setAdjustingItemId(item.id);
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
          user_id: userId,
          type: amount > 0 ? 'IN' : 'OUT',
          quantity: Math.abs(amount),
          notes: `Quick box item adjust (${amount > 0 ? '+' : ''}${amount})`,
        });

      if (txError) console.error('Error logging transaction:', txError);

      // Update parent state
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error adjusting quantity');
    } finally {
      setAdjustingItemId(null);
    }
  };

  // Delete item from box
  const handleDeleteItem = async (itemId: string) => {
    try {
      setDeletingItemId(itemId);
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', itemId);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error deleting item');
    } finally {
      setDeletingItemId(null);
    }
  };

  const openMoveItem = (item: InventoryItem) => {
    setMovingItem(item);
    setMoveTargetBoxId('');
    setTransferQuantity(item.quantity || 1);
    setTransferReason('');
  };

  const closeMoveItem = () => {
    setMovingItem(null);
    setMoveTargetBoxId('');
    setTransferQuantity(1);
    setTransferReason('');
  };

  const handleMoveItem = async () => {
    if (!movingItem || !moveTargetBoxId) return;

    if (moveTargetBoxId === movingItem.box_id) {
      alert('Please select a different destination box.');
      return;
    }
    const qtyToMove = Math.floor(Number(transferQuantity));

    if (!qtyToMove || qtyToMove <= 0) {
      alert('Transfer quantity must be greater than 0.');
      return;
    }

    if (qtyToMove > movingItem.quantity) {
      alert('Transfer quantity cannot be more than available stock.');
      return;
    }

    setMoving(true);

    try {
      const { error } = await supabase.rpc('transfer_inventory_item', {
        p_item_id: movingItem.id,
        p_to_box_id: moveTargetBoxId,
        p_quantity: qtyToMove,
        p_reason: transferReason.trim() || null,
      });

      if (error) throw error;

      closeMoveItem();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error transferring stock');
    } finally {
      setMoving(false);
    }
  };

  const openMoveBox = (box: Box) => {
    setMovingBox(box);
    setMoveTargetRoomId('');
  };

  const closeMoveBox = () => {
    setMovingBox(null);
    setMoveTargetRoomId('');
  };

  const handleMoveBox = async () => {
    if (!movingBox || !moveTargetRoomId) return;

    if (moveTargetRoomId === movingBox.room_id) {
      alert('Please select a different destination room.');
      return;
    }

    const fromRoomId = movingBox.room_id;
    const fromRoom = rooms.find((room) => room.id === fromRoomId);
    const toRoom = rooms.find((room) => room.id === moveTargetRoomId);

    setMoving(true);

    try {
      const { error: updateError } = await supabase
        .from('boxes')
        .update({ room_id: moveTargetRoomId })
        .eq('id', movingBox.id)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      const { error: movementError } = await supabase
        .from('box_movements')
        .insert({
          user_id: userId,
          box_id: movingBox.id,
          from_room_id: fromRoomId,
          to_room_id: moveTargetRoomId,
          notes: `Moved box "${movingBox.name}" from "${fromRoom?.name || 'Unknown'}" to "${toRoom?.name || 'Unknown'}"`,
        });

      if (movementError) {
        console.error('Box movement log error:', movementError);
      }

      setSelectedRoomId(moveTargetRoomId);
      closeMoveBox();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error moving box');
    } finally {
      setMoving(false);
    }
  };
  // const handlePrint = () => {
  //   window.print();
  // };

  // Naming helper toggles
  const openAddRoom = () => {
    setNamingTarget('room-add');
    setEditingInitialValue('');
    setNamingModalOpen(true);
  };

  const openEditRoom = () => {
    if (!selectedRoomId) return;
    setNamingTarget('room-edit');
    setEditingId(selectedRoomId);
    setEditingInitialValue(activeRoomName);
    setNamingModalOpen(true);
  };

  const openAddBox = () => {
    if (!selectedRoomId) {
      alert('Please create or select a storage room first.');
      return;
    }
    setNamingTarget('box-add');
    setEditingInitialValue('');
    setNamingModalOpen(true);
  };

  const openEditBox = (boxId: string, boxName: string) => {
    setNamingTarget('box-edit');
    setEditingId(boxId);
    setEditingInitialValue(boxName);
    setNamingModalOpen(true);
  };

  // Box details relative timer helper
  const getRelativeTime = (isoString: string) => {
    const now = new Date();
    const date = new Date(isoString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `about ${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // VIEW 1: Box Detail View (Inside a Box)
  if (activeBoxId && activeBox) {
    return (
      <div className="animate-slide-up" style={{ width: '100%' }}>
        {/* Detail Header */}
        <div style={styles.detailHeaderContainer}>
          <button className="btn-back-link" onClick={() => setActiveBoxId(null)} title="Back to Room">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{activeBox.name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Stored inside {activeRoomName}
            </p>
          </div>
        </div>

        {/* Box Detail Actions */}
        <div style={styles.detailActionRow}>
          <button className="btn btn-primary" onClick={() => onAddItemInBox(activeBox.id)}>
            <Plus size={18} />
            <span>Add Item inside Box</span>
          </button>
          <button
            className="btn btn-secondary btn-icon"
            onClick={() => openEditBox(activeBox.id, activeBox.name)}
            title="Rename Box"
          >
            <Edit2 size={16} />
          </button>

          <button
            className="btn btn-secondary btn-icon"
            onClick={() => openMoveBox(activeBox)}
            title="Move Box to Another Room"
          >
            <ArrowUpDown size={16} />
          </button>

          <button
            className="btn btn-secondary btn-icon"
            style={{ color: 'var(--danger)' }}
            onClick={() => handleDeleteBox(activeBox.id)}
            title="Delete Box"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* List of Items inside Box */}
        <div style={{ marginTop: '24px' }}>
          <h3 style={styles.sectionTitle}>
            {itemsInActiveBox.length} {itemsInActiveBox.length === 1 ? 'Item' : 'Items'} in this box
          </h3>

          {itemsInActiveBox.length === 0 ? (
            <div style={styles.emptyState}>
              <Package size={42} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p style={{ color: 'var(--text-secondary)' }}>No items in this box yet.</p>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '12px' }}
                onClick={() => onAddItemInBox(activeBox.id)}
              >
                Intake First Item
              </button>
            </div>
          ) : (
            <div style={styles.itemGrid}>
              {itemsInActiveBox.map((item) => {
                const stockBadge = getStockBadge(item);

                return (
                  <div key={item.id} style={styles.itemCard} className="glass-panel">
                    <div style={styles.itemCardHeader}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{item.name}</div>
                        <div style={styles.itemCardMeta}>
                          {item.sku && <span className="skuCode" style={styles.smallSku}>{item.sku}</span>}
                          <span style={styles.categoryBadge}>
                            <Tag size={10} />
                            {item.category}
                          </span>
                        </div>
                      </div>
                      <span className={`badge ${stockBadge.className}`}>
                        {stockBadge.label}
                      </span>
                    </div>

                    {item.description && (
                      <p style={styles.itemCardDesc}>{item.description}</p>
                    )}

                    <div style={styles.itemCardDetailsRow}>
                      {item.location && (
                        <div style={styles.itemDetailIndicator}>
                          <MapPin size={12} />
                          <span>{item.location}</span>
                        </div>
                      )}
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginLeft: 'auto' }}>
                        ${item.price.toFixed(2)} / unit
                      </div>
                    </div>

                    <div style={styles.itemCardFooter}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn-icon"
                          style={{ width: '32px', height: '32px' }}
                          onClick={() => onEditItem(item)}
                          title="Edit Details"
                        >
                          <Edit2 size={12} />
                        </button>

                        <button
                          className="btn-icon"
                          style={{ width: '32px', height: '32px' }}
                          onClick={() => openMoveItem(item)}
                          title="Transfer / Split Stock"
                        >
                          <ArrowRight size={12} />
                        </button>

                        {deletingItemId === item.id ? (
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ height: '32px', padding: '0 8px', fontSize: '0.75rem' }}
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            Confirm Delete
                          </button>
                        ) : (
                          <button
                            className="btn-icon"
                            style={{ width: '32px', height: '32px', color: 'var(--danger)' }}
                            onClick={() => setDeletingItemId(item.id)}
                            title="Delete Item"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>

                      {/* Stock adjustments inside card */}
                      <div style={styles.qtyContainer}>
                        {adjustingItemId === item.id ? (
                          <RefreshCw size={14} className="spin" style={{ color: 'var(--primary)', margin: '0 10px' }} />
                        ) : (
                          <>
                            <button
                              className="btn-icon"
                              style={styles.qtyBtn}
                              onClick={() => handleQuickAdjustItem(item, -1)}
                              disabled={item.quantity === 0}
                            >
                              <Minus size={12} />
                            </button>
                            <span style={styles.qtyText}>{item.quantity}</span>
                            <button
                              className="btn-icon"
                              style={styles.qtyBtn}
                              onClick={() => handleQuickAdjustItem(item, 1)}
                            >
                              <Plus size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* naming modal handles box naming adjustments */}
        {/* naming modal handles box naming adjustments */}
        <NamingModal
          isOpen={namingModalOpen}
          onClose={() => setNamingModalOpen(false)}
          onSave={handleSaveBox}
          title="Rename Box"
          placeholder="e.g. Electrical Components"
          initialValue={editingInitialValue}
        />

        {/* move item modal */}
        <MoveItemModal
          isOpen={movingItem !== null}
          onClose={closeMoveItem}
          onMove={handleMoveItem}
          itemName={movingItem ? movingItem.name : ''}
          itemQuantity={movingItem ? movingItem.quantity : 0}
          currentBoxId={movingItem ? movingItem.box_id || null : null}
          targetBoxId={moveTargetBoxId}
          setTargetBoxId={setMoveTargetBoxId}
          transferQuantity={transferQuantity}
          setTransferQuantity={setTransferQuantity}
          transferReason={transferReason}
          setTransferReason={setTransferReason}
          boxes={boxes}
          rooms={rooms}
        />

        {/* move box modal */}
        <MoveBoxModal
          isOpen={movingBox !== null}
          onClose={closeMoveBox}
          onMove={handleMoveBox}
          boxName={movingBox ? movingBox.name : ''}
          currentRoomId={movingBox ? movingBox.room_id : ''}
          targetRoomId={moveTargetRoomId}
          setTargetRoomId={setMoveTargetRoomId}
          rooms={rooms}
        />
      </div>
    );
  }

  // VIEW 2: Room Dashboard (Rooms & Boxes list)
  return (
    <div className="animate-slide-up" style={{ width: '100%' }}>
      {/* Title Header matches user mockup */}
      <div style={styles.mockHeader}>
        <div style={styles.mockTitleWrapper}>
          <h1 style={styles.mockTitle}>Your storage room</h1>
          {moving && <RefreshCw size={16} className="spin" style={{ color: 'var(--primary)', marginLeft: '4px' }} />}
          <HelpCircle size={18} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="beta-tag">Beta</span>
          <div
            className="profile-avatar-btn"
            onClick={onOpenSettings}
            title="Settings"
            style={{ cursor: 'pointer' }}
          >
            <User size={18} />
          </div>
        </div>
      </div>

      {settings.showLowStockOnHome && homeWarningItems.length > 0 && (
        <div style={styles.homeWarningCard} className="glass-panel">
          <div style={styles.homeWarningHeader}>
            <AlertTriangle size={18} />
            <strong>{homeWarningItems.length} item(s) need attention</strong>
          </div>

          <div style={styles.homeWarningList}>
            {homeWarningItems.map((item) => {
              const box = boxes.find((b) => b.id === item.box_id);
              const room = box ? rooms.find((r) => r.id === box.room_id) : null;
              const badge = getStockBadge(item);

              return (
                <div key={item.id} style={styles.homeWarningItem}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {box?.name || 'Unassigned box'}
                      {room ? ` • ${room.name}` : ''}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${badge.className}`}>{badge.label}</span>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginTop: '4px',
                      }}
                    >
                      {item.quantity} / {item.min_stock_level}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Room Selector dropdown container */}
      <div className="room-selector-container">
        {rooms.length === 0 ? (
          <div
            className="room-select"
            onClick={openAddRoom}
            style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}
          >
            No storage rooms. Click to create one.
          </div>
        ) : (
          <select
            className="room-select"
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
          >
            {rooms.map(room => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
        )}
        <div className="room-select-arrow">
          <ArrowUpDown size={16} />
        </div>
      </div>

      {/* Actions Row */}
      <div className="actions-row">
        <button
          className="btn btn-secondary btn-icon btn-room-action"
          onClick={openEditRoom}
          disabled={rooms.length === 0}
          title="Edit Room Name"
        >
          <Edit2 size={16} />
        </button>
        <button
          className="btn btn-secondary btn-icon btn-room-action"
          style={{ color: 'var(--danger)' }}
          onClick={handleDeleteRoom}
          disabled={rooms.length === 0}
          title="Delete Room"
        >
          <Trash2 size={16} />
        </button>
        <button
          className="btn btn-secondary btn-icon btn-room-action"
          onClick={openAddRoom}
          title="Add New Room"
        >
          <PlusCircle size={16} />
        </button>
        {/* <button
          className="btn btn-secondary btn-room-action"
          style={{ padding: '0 14px', width: 'auto', gap: '6px' }}
          onClick={handlePrint}
          title="Print Room Contents"
        >
          <Printer size={16} />
          <span>Print</span>
        </button> */}
        <button className="btn btn-primary btn-add-box" onClick={openAddBox}>
          <Plus size={16} />
          <span>Add Box</span>
        </button>
      </div>

      {/* Header for boxes list */}
      <div style={styles.boxesListHeader}>
        <span style={styles.boxesCountText}>
          {boxesInActiveRoom.length} {boxesInActiveRoom.length === 1 ? 'Box' : 'Boxes'} in {activeRoomName}
        </span>
        <div style={styles.boxesSortControls}>
          <button
            className="btn-icon"
            style={{ width: '32px', height: '32px' }}
            onClick={() => setSortOrder(sortOrder === 'recent' ? 'name' : 'recent')}
            title="Sort List"
          >
            <ArrowUpDown size={14} />
          </button>
          <button
            className={`btn-icon ${viewMode === 'grid' ? 'active' : ''}`}
            style={{ width: '32px', height: '32px' }}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            className={`btn-icon ${viewMode === 'list' ? 'active' : ''}`}
            style={{ width: '32px', height: '32px' }}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Box List rendering */}
      {rooms.length === 0 ? (
        <div style={styles.emptyState}>
          <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h3>Create your first storage room</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>
            Storage rooms allow you to group boxes and inventory items logically.
          </p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAddRoom}>
            <Plus size={16} />
            <span>Create Room</span>
          </button>
        </div>
      ) : boxesInActiveRoom.length === 0 ? (
        <div style={styles.emptyState}>
          <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h3>Add boxes to this room</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>
            Create custom boxes inside "{activeRoomName}" to start storing electrical components, tools, or items.
          </p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAddBox}>
            <Plus size={16} />
            <span>Create Box</span>
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(220px, 1fr))' : '1fr',
          gap: '12px',
          marginTop: '16px'
        }}>
          {sortedBoxes.map((box) => {
            const boxItems = items.filter(i => i.box_id === box.id);
            const totalQty = boxItems.reduce((acc, curr) => acc + curr.quantity, 0);

            return (
              <div key={box.id} className="box-card" style={viewMode === 'grid' ? styles.gridBoxCard : undefined}>
                <div className="box-card-left" style={viewMode === 'grid' ? styles.gridBoxCardLeft : undefined}>
                  <div className="box-card-icon-wrapper">
                    <Package size={22} />
                  </div>
                  <div>
                    <h4 className="box-card-title">{box.name}</h4>
                    <div className="box-card-subtitle">
                      <span>{totalQty} {totalQty === 1 ? 'item' : 'items'}</span>
                      <span>•</span>
                      <span>{getRelativeTime(box.updated_at || box.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="box-card-actions" style={viewMode === 'grid' ? styles.gridBoxCardActions : undefined}>
                  {/* Quick add item inside box */}
                  <button
                    className="btn-box-action"
                    onClick={() => onAddItemInBox(box.id)}
                    title="Quick Add Item in Box"
                  >
                    <Plus size={18} />
                  </button>
                  {/* Enter box details */}
                  <button
                    className="btn-box-action"
                    onClick={() => setActiveBoxId(box.id)}
                    title="Enter Box"
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* naming modals for room & box creation/renames */}
      <NamingModal
        isOpen={namingModalOpen}
        onClose={() => setNamingModalOpen(false)}
        onSave={
          namingTarget.startsWith('room') ? handleSaveRoom : handleSaveBox
        }
        title={
          namingTarget === 'room-add' ? 'Create Storage Room' :
            namingTarget === 'room-edit' ? 'Rename Storage Room' :
              namingTarget === 'box-add' ? 'Create Box' : 'Rename Box'
        }
        placeholder={
          namingTarget.startsWith('room') ? 'e.g. Back Warehouse, Shelf A' : 'e.g. Resistors Box'
        }
        initialValue={editingInitialValue}
      />

      {/* move item modal */}
      <MoveItemModal
        isOpen={movingItem !== null}
        onClose={closeMoveItem}
        onMove={handleMoveItem}
        itemName={movingItem ? movingItem.name : ''}
        itemQuantity={movingItem ? movingItem.quantity : 0}
        currentBoxId={movingItem ? movingItem.box_id || null : null}
        targetBoxId={moveTargetBoxId}
        setTargetBoxId={setMoveTargetBoxId}
        transferQuantity={transferQuantity}
        setTransferQuantity={setTransferQuantity}
        transferReason={transferReason}
        setTransferReason={setTransferReason}
        boxes={boxes}
        rooms={rooms}
      />

      {/* move box modal */}
      <MoveBoxModal
        isOpen={movingBox !== null}
        onClose={closeMoveBox}
        onMove={handleMoveBox}
        boxName={movingBox ? movingBox.name : ''}
        currentRoomId={movingBox ? movingBox.room_id : ''}
        targetRoomId={moveTargetRoomId}
        setTargetRoomId={setMoveTargetRoomId}
        rooms={rooms}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {

  homeWarningCard: {
    padding: '14px',
    marginBottom: '16px',
    border: '1px solid var(--warning)',
  },
  homeWarningHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--warning)',
    marginBottom: '10px',
  },
  homeWarningList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  homeWarningItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-input)',
  },

  mockHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  mockTitleWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  mockTitle: {
    fontSize: '1.45rem',
    fontWeight: 700,
  },
  boxesListHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: '12px 0 8px 0',
  },
  boxesCountText: {
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  boxesSortControls: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  emptyState: {
    padding: '48px 24px',
    textAlign: 'center',
    background: 'var(--bg-card)',
    border: '1px dashed var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '16px',
  },
  detailHeaderContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  detailActionRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '14px',
  },
  itemGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  itemCard: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  itemCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemCardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '4px',
    flexWrap: 'wrap',
  },
  smallSku: {
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    background: 'var(--bg-input)',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid var(--border-color)',
  },
  categoryBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  itemCardDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  itemCardDetailsRow: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.85rem',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '10px',
  },
  itemDetailIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: 'var(--text-secondary)',
  },
  itemCardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  gridBoxCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: '20px 16px',
    gap: '16px',
  },
  gridBoxCardLeft: {
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '12px',
  },
  gridBoxCardActions: {
    justifyContent: 'center',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '12px',
  },
};

