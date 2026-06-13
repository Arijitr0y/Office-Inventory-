import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Star,
  Check,
  X,
  RefreshCw,
  Layers,
} from 'lucide-react';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

interface CategoryManagerProps {
  userId: string;
  categories: Category[];
  onRefresh: () => void | Promise<void>;
}

// const DEFAULT_SEED = [
//   'General',
//   'Electronics',
//   'Office Supplies',
//   'Furniture',
//   'Apparel',
//   'Food & Beverage',
//   'Raw Materials',
//   'Tools & Equipment',
//   'Packaging',
// ];

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  userId,
  categories,
  onRefresh,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const handleAddCategory = async () => {
    const trimmed = newCatName.trim();

    if (!trimmed) return;

    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A category with this name already exists.');
      return;
    }

    setAddingCat(true);
    setError(null);

    try {
      const hasDefault = categories.some((c) => c.is_default);

      const { data, error: insertError } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: trimmed,
          is_default: false,
          sort_order: categories.length,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (!hasDefault && data?.id) {
        const { error: defaultError } = await supabase.rpc('set_default_category', {
          p_category_id: data.id,
        });

        if (defaultError) throw defaultError;
      }

      setNewCatName('');
      setShowAdd(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Error adding category.');
    } finally {
      setAddingCat(false);
    }
  };

  const handleRename = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A category with this name already exists.');
      return;
    }

    setLoadingId(id);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('categories')
        .update({ name: trimmed })
        .eq('id', id)
        .eq('user_id', userId);
      if (updateError) throw updateError;
      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Error renaming category.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleSetDefault = async (categoryId: string) => {
    setLoadingId(categoryId);
    setError(null);

    try {
      const { error } = await supabase.rpc('set_default_category', {
        p_category_id: categoryId,
      });

      if (error) throw error;

      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Error setting default category.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const cat = categories.find((c) => c.id === id);

    if (!cat) return;

    if (
      !window.confirm(
        `Delete category "${cat.name}"? Items using it will keep the name but you can reassign them.`
      )
    ) {
      return;
    }

    setLoadingId(id);
    setError(null);

    try {
      const remaining = categories.filter((c) => c.id !== id);

      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      if (cat.is_default && remaining.length > 0) {
        const { error: defaultError } = await supabase.rpc('set_default_category', {
          p_category_id: remaining[0].id,
        });

        if (defaultError) throw defaultError;
      }

      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Error deleting category.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    setError(null);

    try {
      const { error } = await supabase.rpc('seed_default_categories');

      if (error) {
        console.error('Seed defaults error:', error);
        throw error;
      }

      await onRefresh();

      alert('Default categories added successfully.');
    } catch (err: any) {
      console.error('Seed defaults failed:', err);
      setError(err.message || 'Error seeding categories.');
      alert(err.message || 'Error seeding categories.');
    } finally {
      setSeeding(false);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div style={s.wrapper} className="glass-panel">
      {/* Header */}
      <div style={s.cardHeader}>
        <div style={s.cardTitleRow}>
          <Layers size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={s.cardTitle}>Category Management</h3>
        </div>
        <div style={s.headerActions}>
          <button
            className="btn btn-secondary btn-sm"
            style={s.seedBtn}
            onClick={handleSeedDefaults}
            disabled={seeding}
            title="Add all default categories"
          >
            {seeding ? <RefreshCw size={13} className="spin" /> : <Layers size={13} />}
            Seed Defaults
          </button>
          <button
            className="btn btn-primary btn-sm"
            style={s.addBtn}
            onClick={() => { setShowAdd((v) => !v); setError(null); }}
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      <p style={s.hint}>
        Categories are used when tagging inventory items. Set a default that auto-selects in the item form.
      </p>

      {error && <div style={s.errorBox}>{error}</div>}

      {/* Inline add form */}
      {showAdd && (
        <div style={s.addRow}>
          <Tag size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <input
            autoFocus
            type="text"
            placeholder="New category name..."
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setShowAdd(false); }}
            style={s.addInput}
          />
          <button
            style={s.iconActionBtn}
            onClick={handleAddCategory}
            disabled={addingCat || !newCatName.trim()}
            title="Save"
          >
            {addingCat ? <RefreshCw size={14} className="spin" /> : <Check size={14} style={{ color: 'var(--success)' }} />}
          </button>
          <button
            style={s.iconActionBtn}
            onClick={() => { setShowAdd(false); setNewCatName(''); }}
            title="Cancel"
          >
            <X size={14} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      )}

      {/* Category list */}
      {categories.length === 0 ? (
        <div style={s.emptyState}>
          <Tag size={32} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            No categories yet. Add one above or seed the defaults.
          </p>
        </div>
      ) : (
        <div style={s.list}>
          {categories.map((cat) => (
            <div key={cat.id} style={s.catRow} className={cat.is_default ? 'cat-row-default' : ''}>
              {editingId === cat.id ? (
                /* Edit mode */
                <div style={s.editRow}>
                  <input
                    autoFocus
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(cat.id); if (e.key === 'Escape') cancelEdit(); }}
                    style={s.editInput}
                  />
                  <button
                    style={s.iconActionBtn}
                    onClick={() => handleRename(cat.id)}
                    disabled={loadingId === cat.id || !editingName.trim()}
                    title="Save"
                  >
                    {loadingId === cat.id ? <RefreshCw size={13} className="spin" /> : <Check size={13} style={{ color: 'var(--success)' }} />}
                  </button>
                  <button style={s.iconActionBtn} onClick={cancelEdit} title="Cancel">
                    <X size={13} style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>
              ) : (
                /* Display mode */
                <>
                  <div style={s.catInfo}>
                    <div style={s.catDot} />
                    <span style={s.catName}>{cat.name}</span>
                    {cat.is_default && (
                      <span style={s.defaultBadge}>
                        <Star size={10} fill="currentColor" /> Default
                      </span>
                    )}
                  </div>
                  <div style={s.catActions}>
                    {!cat.is_default && (
                      <button
                        style={s.iconActionBtn}
                        onClick={() => handleSetDefault(cat.id)}
                        disabled={loadingId === cat.id}
                        title="Set as default"
                      >
                        {loadingId === cat.id
                          ? <RefreshCw size={13} className="spin" />
                          : <Star size={13} style={{ color: 'var(--text-muted)' }} />
                        }
                      </button>
                    )}
                    <button
                      style={s.iconActionBtn}
                      onClick={() => startEdit(cat)}
                      disabled={loadingId === cat.id}
                      title="Rename"
                    >
                      <Edit2 size={13} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    <button
                      style={s.iconActionBtn}
                      onClick={() => handleDelete(cat.id)}
                      disabled={loadingId === cat.id}
                      title="Delete"
                    >
                      {loadingId === cat.id
                        ? <RefreshCw size={13} className="spin" />
                        : <Trash2 size={13} style={{ color: 'var(--danger)' }} />
                      }
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <p style={s.countHint}>{categories.length} {categories.length === 1 ? 'category' : 'categories'} total</p>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  wrapper: {
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cardTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  seedBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.78rem',
    padding: '5px 10px',
    height: '30px',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.82rem',
    padding: '5px 12px',
    height: '30px',
  },
  hint: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    lineHeight: '1.45',
    marginTop: '-6px',
  },
  errorBox: {
    padding: '9px 12px',
    borderRadius: '8px',
    background: 'var(--danger-glow)',
    border: '1px solid hsla(350, 80%, 55%, 0.3)',
    color: 'var(--danger)',
    fontSize: '0.85rem',
  },
  addRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'var(--bg-input)',
    border: '1px solid var(--primary)',
    borderRadius: '10px',
    padding: '6px 12px',
    boxShadow: '0 0 0 3px hsla(210, 90%, 56%, 0.12)',
  },
  addInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '0.92rem',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  catRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '9px 12px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-input)',
    transition: 'border-color 0.15s',
  },
  catInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
    flex: 1,
  },
  catDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--primary)',
    flexShrink: 0,
  },
  catName: {
    fontSize: '0.92rem',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  defaultBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'hsl(40, 90%, 55%)',
    background: 'hsla(40, 90%, 55%, 0.12)',
    border: '1px solid hsla(40, 90%, 55%, 0.25)',
    borderRadius: '20px',
    padding: '2px 7px',
    flexShrink: 0,
  },
  catActions: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconActionBtn: {
    width: '28px',
    height: '28px',
    border: 'none',
    borderRadius: '7px',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  editRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
  },
  editInput: {
    flex: 1,
    height: '28px',
    border: '1px solid var(--primary)',
    borderRadius: '7px',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    padding: '0 10px',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 16px',
    borderRadius: '10px',
    border: '1px dashed var(--border-color)',
  },
  countHint: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    textAlign: 'right',
    marginTop: '-6px',
  },
};

export default CategoryManager;
