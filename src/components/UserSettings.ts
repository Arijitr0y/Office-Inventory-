export interface UserSettings {
  defaultMinStockLevel: number;
  lowStockWarningEnabled: boolean;
  outOfStockWarningEnabled: boolean;
  showLowStockOnHome: boolean;

  defaultRoomId: string | null;
  defaultBoxId: string | null;
  blockDeleteRoomWithItems: boolean;
  archiveEmptyBoxes: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  defaultMinStockLevel: 5,
  lowStockWarningEnabled: true,
  outOfStockWarningEnabled: true,
  showLowStockOnHome: true,

  defaultRoomId: null,
  defaultBoxId: null,
  blockDeleteRoomWithItems: true,
  archiveEmptyBoxes: false,
};

export function mergeSettings(partial: Partial<UserSettings> | null | undefined): UserSettings {
  return {
    ...DEFAULT_USER_SETTINGS,
    ...(partial || {}),
  };
}