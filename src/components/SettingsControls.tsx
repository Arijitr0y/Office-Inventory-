import React from 'react';
import {
    AlertTriangle,
    Archive,
    Bell,
    Home,
    Loader2,
    ShieldCheck,
} from 'lucide-react';
import type { UserSettings } from './UserSettings';

interface Room {
    id: string;
    name: string;
    created_at: string;
}

interface StorageBox {
    id: string;
    room_id: string;
    name: string;
    created_at: string;
    updated_at: string;
    archived?: boolean;
}

interface SettingsControlsProps {
    settings: UserSettings;
    rooms: Room[];
    boxes: StorageBox[];
    saving?: boolean;
    onChange: (nextSettings: UserSettings) => void | Promise<void>;
}

export const SettingsControls: React.FC<SettingsControlsProps> = ({
    settings,
    rooms,
    boxes,
    saving = false,
    onChange,
}) => {
    const updateSettings = (patch: Partial<UserSettings>) => {
        onChange({ ...settings, ...patch });
    };

    const boxesForSelectedRoom = settings.defaultRoomId
        ? boxes.filter((box) => box.room_id === settings.defaultRoomId)
        : boxes;

    const handleDefaultRoomChange = (roomId: string) => {
        const nextRoomId = roomId || null;
        const currentDefaultBox = boxes.find((box) => box.id === settings.defaultBoxId);

        updateSettings({
            defaultRoomId: nextRoomId,
            defaultBoxId:
                nextRoomId && currentDefaultBox?.room_id === nextRoomId
                    ? settings.defaultBoxId
                    : null,
        });
    };

    return (
        <>
            <div style={styles.settingsCard} className="glass-panel">
                <div style={styles.cardTitleRow}>
                    <div>
                        <h3 style={styles.settingsCardTitle}>Stock Alert Settings</h3>
                        <p style={styles.cardDescription}>
                            Control default stock limits and warning visibility.
                        </p>
                    </div>

                    {saving && (
                        <Loader2 size={18} className="spin" style={{ color: 'var(--primary)' }} />
                    )}
                </div>

                <label style={styles.fieldBlock}>
                    <span style={styles.labelText}>Default minimum stock level</span>
                    <input
                        type="number"
                        min={0}
                        className="form-control"
                        value={settings.defaultMinStockLevel}
                        disabled={saving}
                        onChange={(e) =>
                            updateSettings({
                                defaultMinStockLevel: Math.max(0, Number(e.target.value) || 0),
                            })
                        }
                        style={styles.numberInput}
                    />
                    <span style={styles.helpText}>
                        This value is used automatically when you add a new item.
                    </span>
                </label>

                <SettingToggle
                    icon={<Bell size={16} />}
                    title="Low stock warning"
                    description="Warn when quantity is above 0 but at or below the minimum stock level."
                    checked={settings.lowStockWarningEnabled}
                    disabled={saving}
                    onChange={(checked) => updateSettings({ lowStockWarningEnabled: checked })}
                />

                <SettingToggle
                    icon={<AlertTriangle size={16} />}
                    title="Out-of-stock warning"
                    description="Warn when quantity reaches 0."
                    checked={settings.outOfStockWarningEnabled}
                    disabled={saving}
                    onChange={(checked) => updateSettings({ outOfStockWarningEnabled: checked })}
                />

                <SettingToggle
                    icon={<Home size={16} />}
                    title="Show low stock on home"
                    description="Show an alert card on the home screen for items needing restock."
                    checked={settings.showLowStockOnHome}
                    disabled={saving}
                    onChange={(checked) => updateSettings({ showLowStockOnHome: checked })}
                />
            </div>

            <div style={styles.settingsCard} className="glass-panel">
                <div style={styles.cardTitleRow}>
                    <div>
                        <h3 style={styles.settingsCardTitle}>Room / Box Defaults</h3>
                        <p style={styles.cardDescription}>
                            Choose default storage and deletion behavior.
                        </p>
                    </div>

                    {saving && (
                        <Loader2 size={18} className="spin" style={{ color: 'var(--primary)' }} />
                    )}
                </div>

                <label style={styles.fieldBlock}>
                    <span style={styles.labelText}>Default room</span>
                    <select
                        className="form-control"
                        value={settings.defaultRoomId || ''}
                        disabled={saving}
                        onChange={(e) => handleDefaultRoomChange(e.target.value)}
                    >
                        <option value="">No default room</option>
                        {rooms.map((room) => (
                            <option key={room.id} value={room.id}>
                                {room.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label style={styles.fieldBlock}>
                    <span style={styles.labelText}>Default box</span>
                    <select
                        className="form-control"
                        value={settings.defaultBoxId || ''}
                        disabled={saving || boxesForSelectedRoom.length === 0}
                        onChange={(e) => updateSettings({ defaultBoxId: e.target.value || null })}
                    >
                        <option value="">No default box</option>

                        {boxesForSelectedRoom.map((box) => {
                            const room = rooms.find((r) => r.id === box.room_id);

                            return (
                                <option key={box.id} value={box.id}>
                                    {box.name}
                                    {room ? ` — ${room.name}` : ''}
                                </option>
                            );
                        })}
                    </select>

                    <span style={styles.helpText}>
                        Used when an item is added without selecting a box first.
                    </span>
                </label>

                <SettingToggle
                    icon={<ShieldCheck size={16} />}
                    title="Block room delete if it contains items"
                    description="Prevent accidental deletion of a room that contains inventory items."
                    checked={settings.blockDeleteRoomWithItems}
                    disabled={saving}
                    onChange={(checked) => updateSettings({ blockDeleteRoomWithItems: checked })}
                />

                <SettingToggle
                    icon={<Archive size={16} />}
                    title="Archive empty boxes"
                    description="When deleting an empty box, hide it instead of permanently deleting it."
                    checked={settings.archiveEmptyBoxes}
                    disabled={saving}
                    onChange={(checked) => updateSettings({ archiveEmptyBoxes: checked })}
                />
            </div>
        </>
    );
};

interface SettingToggleProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
}

const SettingToggle: React.FC<SettingToggleProps> = ({
    icon,
    title,
    description,
    checked,
    disabled = false,
    onChange,
}) => {
    return (
        <label style={styles.toggleRow}>
            <div style={styles.toggleIcon}>{icon}</div>

            <div style={{ flex: 1 }}>
                <div style={styles.toggleTitle}>{title}</div>
                <div style={styles.toggleDescription}>{description}</div>
            </div>

            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
                style={styles.checkbox}
            />
        </label>
    );
};

const styles: Record<string, React.CSSProperties> = {
    settingsCard: {
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
    },
    cardTitleRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '10px',
        marginBottom: '4px',
    },
    settingsCardTitle: {
        fontSize: '1.1rem',
        fontWeight: 600,
        marginBottom: '4px',
    },
    cardDescription: {
        fontSize: '0.82rem',
        color: 'var(--text-secondary)',
    },
    fieldBlock: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    labelText: {
        fontSize: '0.85rem',
        fontWeight: 600,
    },
    helpText: {
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
    },
    numberInput: {
        maxWidth: '160px',
    },
    toggleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
    },
    toggleIcon: {
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-card)',
        color: 'var(--primary)',
        flexShrink: 0,
    },
    toggleTitle: {
        fontSize: '0.9rem',
        fontWeight: 600,
    },
    toggleDescription: {
        fontSize: '0.76rem',
        color: 'var(--text-muted)',
        marginTop: '2px',
        lineHeight: 1.35,
    },
    checkbox: {
        width: '18px',
        height: '18px',
        accentColor: 'var(--primary)',
    },
};