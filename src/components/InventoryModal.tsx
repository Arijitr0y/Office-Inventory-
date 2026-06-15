import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  X,
  Hash,
  DollarSign,
  Tag,
  Camera,
  CalendarDays,
  Upload,
  Image as ImageIcon,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Category } from './CategoryManager';
import { DEFAULT_USER_SETTINGS } from './UserSettings';
import type { UserSettings } from './UserSettings';

// Fallback hardcoded categories for users who haven't configured categories yet
const FALLBACK_CATEGORIES = [
  'No category',
  'General',
  'Electronics',
  'Office Supplies',
  'Furniture',
  'Apparel',
  'Food & Beverage',
  'Raw Materials',
  'Tools & Equipment',
  'Packaging',
];

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
  purchase_date?: string | null;
}

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  userId: string;
  editItem?: InventoryItem | null;
  boxId?: string | null;
  boxName?: string | null;
  categories?: Category[];
  settings?: UserSettings;
}

type FieldKey = 'quantity' | 'price' | 'category' | 'picture' | 'date';

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  userId,
  editItem = null,
  boxId = null,
  boxName = null,
  categories: categoriesProp = [],
  settings = DEFAULT_USER_SETTINGS,
}) => {
  // Resolve the list of category names to show in the dropdown
  const categoryNames: string[] = categoriesProp.length > 0
    ? categoriesProp.map((c) => c.name)
    : FALLBACK_CATEGORIES;

  // The default category name (from props or first fallback)
  const defaultCategoryName = categoriesProp.find((c) => c.is_default)?.name
    ?? (categoryNames[0] || 'No category');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState(defaultCategoryName);
  const [quantity, setQuantity] = useState(0);
  const [minStock, setMinStock] = useState(settings.defaultMinStockLevel);
  const [price, setPrice] = useState(0);
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');

  const [visibleFields, setVisibleFields] = useState<Record<FieldKey, boolean>>({
    quantity: false,
    price: false,
    category: false,
    picture: false,
    date: false,
  });

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showPictureMenu, setShowPictureMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editItem) {
      setName(editItem.name || '');
      setSku(editItem.sku || '');
      setCategory(editItem.category || defaultCategoryName);
      setQuantity(editItem.quantity || 0);
      setMinStock(editItem.min_stock_level ?? settings.defaultMinStockLevel);
      setPrice(Number(editItem.price || 0));
      setLocation(editItem.location || '');
      setImageUrl(editItem.image_url || '');
      setDescription(editItem.description || '');
      setPurchaseDate(editItem.purchase_date || '');

      setVisibleFields({
        quantity: true,
        price: true,
        category: true,
        picture: !!editItem.image_url,
        date: !!editItem.purchase_date,
      });
    } else {
      setName('');
      setSku('');
      setCategory(defaultCategoryName);
      setQuantity(0);
      setMinStock(settings.defaultMinStockLevel);
      setPrice(0);
      setLocation('');
      setImageUrl('');
      setDescription('');
      setPurchaseDate('');

      setVisibleFields({
        quantity: false,
        price: false,
        category: false,
        picture: false,
        date: false,
      });
    }

    setError(null);
    setShowPictureMenu(false);
  }, [editItem, isOpen, defaultCategoryName, settings.defaultMinStockLevel]);

  if (!isOpen) return null;

  const toggleField = (field: FieldKey) => {
    setVisibleFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handlePictureFile = async (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('item-images')
        .getPublicUrl(filePath);

      setImageUrl(data.publicUrl);
      setVisibleFields((prev) => ({ ...prev, picture: true }));
      setShowPictureMenu(false);
    } catch (err: any) {
      setError(err.message || 'Image upload failed. Check the Google Apps Script Drive upload permission.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Item name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const itemData = {
        user_id: userId,
        name: name.trim(),
        sku: sku.trim() || null,
        category,
        quantity,
        min_stock_level: minStock,
        price,
        location: location.trim() || null,
        image_url: imageUrl || null,
        description: description.trim() || null,
        purchase_date: purchaseDate || null,
        box_id: editItem ? editItem.box_id : boxId || null,
      };

      if (editItem) {
        const { error: updateError } = await supabase
          .from('inventory_items')
          .update(itemData)
          .eq('id', editItem.id);

        if (updateError) throw updateError;

        const qtyDiff = quantity - editItem.quantity;

        if (qtyDiff !== 0) {
          const { error: txError } = await supabase
            .from('stock_transactions')
            .insert({
              item_id: editItem.id,
              user_id: userId,
              type: qtyDiff > 0 ? 'IN' : 'OUT',
              quantity: Math.abs(qtyDiff),
              notes: `Manual quantity update from ${editItem.quantity} to ${quantity}`,
            });

          if (txError) console.error('Error logging transaction:', txError);
        }
      } else {
        const { data, error: insertError } = await supabase
          .from('inventory_items')
          .insert(itemData)
          .select()
          .single();

        if (insertError) throw insertError;

        if (quantity > 0 && data) {
          const { error: txError } = await supabase
            .from('stock_transactions')
            .insert({
              item_id: data.id,
              user_id: userId,
              type: 'IN',
              quantity,
              notes: 'Initial stock intake',
            });

          if (txError) console.error('Error logging transaction:', txError);
        }

        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 },
        });
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error saving item.');
    } finally {
      setLoading(false);
    }
  };

  const iconButton = (
    key: FieldKey,
    icon: React.ReactNode,
    color: string,
    label: string,
  ) => (
    <button
      type="button"
      aria-label={label}
      onClick={() => toggleField(key)}
      style={{
        ...styles.quickButton,
        borderColor: visibleFields[key] ? color : 'var(--border-color)',
        color,
        boxShadow: visibleFields[key] ? `0 0 0 2px ${color}22` : 'none',
      }}
    >
      {icon}
    </button>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button type="button" style={styles.closeButton} onClick={onClose}>
          <X size={20} />
        </button>

        <div style={styles.header}>
          <h2 style={styles.title}>
            {editItem ? 'Edit item' : 'Add item to box'}
          </h2>
          <p style={styles.subtitle}>
            {editItem
              ? 'Update item details'
              : `Add a new item to ${boxName || 'this box'}`}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.errorBox}>{error}</div>}

          <input
            type="text"
            placeholder="Add new item..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.nameInput}
            autoFocus
          />

          <div style={styles.quickRow}>
            {iconButton('quantity', <Hash size={21} />, '#3b82f6', 'Quantity')}
            {iconButton('price', <DollarSign size={21} />, '#22c55e', 'Price')}
            {iconButton('category', <Tag size={21} />, '#a855f7', 'Category')}
            {iconButton('picture', <Camera size={21} />, '#ec4899', 'Picture')}
            {iconButton('date', <CalendarDays size={21} />, '#ef4444', 'Date')}
          </div>

          <div style={styles.fieldsStack}>
            {visibleFields.quantity && (
              <div style={styles.inputWithIcon}>
                <Hash size={18} color="#3b82f6" />
                <input
                  type="number"
                  min="0"
                  placeholder="Quantity"
                  value={quantity === 0 ? '' : quantity}
                  onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                  style={styles.inlineInput}
                />
              </div>
            )}

            {visibleFields.price && (
              <div style={styles.inputWithIcon}>
                <DollarSign size={18} color="#22c55e" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  value={price === 0 ? '' : price}
                  onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  style={styles.inlineInput}
                />
              </div>
            )}

            {visibleFields.category && (
              <div style={styles.inputWithIcon}>
                <Tag size={18} color="#a855f7" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={styles.inlineInput}
                >
                  {categoryNames.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} color="var(--text-muted)" />
              </div>
            )}

            {visibleFields.picture && (
              <div style={styles.pictureField}>
                <Camera size={18} color="#ec4899" />

                {imageUrl ? (
                  <img src={imageUrl} alt="Item" style={styles.previewImage} />
                ) : null}

                <button
                  type="button"
                  onClick={() => setShowPictureMenu(true)}
                  style={styles.pictureButton}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <>
                      <Loader2 size={17} className="spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={17} />
                      Picture
                    </>
                  )}
                </button>
              </div>
            )}

            {visibleFields.date && (
              <div style={styles.inputWithIcon}>
                <CalendarDays size={18} color="#ef4444" />
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  style={styles.inlineInput}
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            style={{
              ...styles.submitButton,
              opacity: loading || !name.trim() ? 0.55 : 1,
            }}
          >
            {loading ? 'Saving...' : editItem ? 'Save Item' : 'Add Item'}
          </button>
        </form>

        {showPictureMenu && (
          <div style={styles.pictureMenuOverlay} onClick={() => setShowPictureMenu(false)}>
            <div style={styles.pictureMenu} onClick={(e) => e.stopPropagation()}>
              <h3 style={styles.pictureMenuTitle}>Add picture</h3>

              <button
                type="button"
                style={styles.pictureMenuButton}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera size={20} />
                Take picture from camera
              </button>

              <button
                type="button"
                style={styles.pictureMenuButton}
                onClick={() => galleryInputRef.current?.click()}
              >
                <ImageIcon size={20} />
                Upload from device
              </button>

              <button
                type="button"
                style={styles.cancelPictureButton}
                onClick={() => setShowPictureMenu(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            handlePictureFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            handlePictureFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  modalContent: {
    position: 'relative',
    width: '100%',
    maxWidth: '500px',
    background: 'var(--bg-card-solid)',
    border: '1px solid var(--border-color)',
    borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    padding: '22px 26px 24px',
    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
  },
  closeButton: {
    position: 'absolute',
    top: '15px',
    right: '16px',
    width: '34px',
    height: '34px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    textAlign: 'center',
    marginBottom: '16px',
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
    marginBottom: '2px',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  errorBox: {
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'var(--danger-glow)',
    border: '1px solid hsla(350, 80%, 55%, 0.35)',
    color: 'var(--danger)',
    fontSize: '0.88rem',
  },
  nameInput: {
    width: '100%',
    height: '40px',
    borderRadius: '7px',
    border: '1px solid #24415f',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    padding: '0 12px',
    fontSize: '1rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  },
  quickRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '9px',
  },
  quickButton: {
    height: '46px',
    borderRadius: '7px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  fieldsStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inputWithIcon: {
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    border: '1px solid #24415f',
    background: 'var(--bg-input)',
    borderRadius: '7px',
    padding: '0 12px',
  },
  inlineInput: {
    flex: 1,
    width: '100%',
    height: '100%',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '0.98rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  },
  pictureField: {
    minHeight: '40px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    border: '1px solid #24415f',
    background: 'var(--bg-input)',
    borderRadius: '7px',
    padding: '6px 12px',
  },
  pictureButton: {
    flex: 1,
    minHeight: '34px',
    border: '1px solid #24415f',
    borderRadius: '7px',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  previewImage: {
    width: '32px',
    height: '32px',
    objectFit: 'cover',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
  },
  submitButton: {
    width: '100%',
    height: '40px',
    border: 'none',
    borderRadius: '7px',
    background: '#15703a',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 700,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    marginTop: '2px',
  },
  pictureMenuOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: '14px',
  },
  pictureMenu: {
    width: '100%',
    maxWidth: '480px',
    background: 'var(--bg-card-solid)',
    border: '1px solid var(--border-color)',
    borderRadius: '18px',
    padding: '16px',
    boxShadow: 'var(--shadow-lg)',
  },
  pictureMenuTitle: {
    fontSize: '1rem',
    marginBottom: '12px',
  },
  pictureMenuButton: {
    width: '100%',
    height: '48px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    borderRadius: '12px',
    marginBottom: '10px',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.95rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    cursor: 'pointer',
  },
  cancelPictureButton: {
    width: '100%',
    height: '44px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default InventoryModal;