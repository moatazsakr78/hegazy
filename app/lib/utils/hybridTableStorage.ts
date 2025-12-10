// Hybrid Table Storage - Combines database persistence with localStorage fallback
// Provides reliable, high-performance user-specific table configuration management

import {
  databaseSettingsService,
  type ColumnConfig,
  type TablePreferences
} from '@/app/lib/services/databaseSettingsService';

interface LegacyColumnConfig {
  id: string;
  width?: number;
  visible?: boolean;
}

interface LegacyTableConfig {
  columns: Array<{
    id: string;
    width: number;
    order: number;
    visible: boolean;
  }>;
  timestamp: number;
  version: string;
}

// Report type mapping for consistency
const REPORT_TYPE_MAP = {
  'MAIN_REPORT': 'main',
  'PRODUCTS_REPORT': 'products',
  'CATEGORIES_REPORT': 'categories',
  'CUSTOMERS_REPORT': 'customers',
  'CUSTOMER_INVOICES_REPORT': 'customer_invoices',
  'DAILY_SALES_REPORT': 'daily_sales',
  'HOURLY_SALES_REPORT': 'hourly_sales',
  'PROFIT_MARGIN_REPORT': 'profit_margin'
} as const;

type ReportType = keyof typeof REPORT_TYPE_MAP;

/**
 * Enhanced hybrid table storage with database + localStorage fallback
 */
class HybridTableStorage {
  private readonly LEGACY_STORAGE_KEYS = {
    MAIN_REPORT: 'pos-reports-main-table-config',
    PRODUCTS_REPORT: 'pos-reports-products-table-config',
    CATEGORIES_REPORT: 'pos-reports-categories-table-config',
    CUSTOMERS_REPORT: 'pos-reports-customers-table-config',
    CUSTOMER_INVOICES_REPORT: 'pos-reports-customer-invoices-table-config',
    DAILY_SALES_REPORT: 'pos-reports-daily-sales-table-config',
    HOURLY_SALES_REPORT: 'pos-reports-hourly-sales-table-config',
    PROFIT_MARGIN_REPORT: 'pos-reports-profit-margin-table-config'
  } as const;

  private readonly CONFIG_VERSION = '2.1.0';
  private readonly saveTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly saveQueue = new Map<string, any>();

  /**
   * Convert legacy config format to new format
   */
  private convertLegacyConfig(
    legacyConfig: LegacyTableConfig,
    reportType: string
  ): TablePreferences {
    return {
      columns: legacyConfig.columns,
      timestamp: legacyConfig.timestamp || Date.now(),
      version: this.CONFIG_VERSION,
      reportType: REPORT_TYPE_MAP[reportType as ReportType] || reportType.toLowerCase(),
      userId: 'legacy' // Will be updated when user logs in
    };
  }

  /**
   * Convert new format back to legacy format for backward compatibility
   */
  private convertToLegacyConfig(preferences: TablePreferences): LegacyTableConfig {
    return {
      columns: preferences.columns,
      timestamp: preferences.timestamp,
      version: preferences.version
    };
  }

  // Loading state tracking to prevent multiple simultaneous loads
  private loadingStates = new Map<string, Promise<LegacyTableConfig | null>>();

  /**
   * Load table configuration with fallback chain (with deduplication)
   * 1. Try database (user-specific)
   * 2. Try localStorage backup
   * 3. Try legacy localStorage format
   * 4. Return null (use defaults)
   */
  async loadTableConfig(reportType: ReportType): Promise<LegacyTableConfig | null> {
    const mappedType = REPORT_TYPE_MAP[reportType];
    const loadKey = `${reportType}_${mappedType}`;

    // Check if already loading to prevent duplicate requests
    if (this.loadingStates.has(loadKey)) {
      return this.loadingStates.get(loadKey)!;
    }

    const loadPromise = this.performLoad(reportType, mappedType);
    this.loadingStates.set(loadKey, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      // Clean up loading state after completion
      setTimeout(() => {
        this.loadingStates.delete(loadKey);
      }, 100);
    }
  }

  private async performLoad(reportType: ReportType, mappedType: string): Promise<LegacyTableConfig | null> {
    try {
      // Method 1: Try database first (most reliable)
      try {
        const dbPreferences = await databaseSettingsService.loadUserSettings(mappedType);
        if (dbPreferences) {
          // Sync with localStorage backup (silently)
          this.syncToLocalStorageBackup(reportType, dbPreferences).catch(() => {});
          return this.convertToLegacyConfig(dbPreferences);
        }
      } catch (error) {
        // Database access failed, continue to fallbacks
      }

      // Method 2: Try localStorage backup
      try {
        const userId = await this.getCurrentUserId();
        if (userId) {
          const backupPreferences = databaseSettingsService.loadBackupSettings(mappedType, userId);
          if (backupPreferences) {
            // Try to restore to database (silently)
            this.restoreToDatabase(mappedType, backupPreferences).catch(() => {});
            return this.convertToLegacyConfig(backupPreferences);
          }
        }
      } catch (error) {
        // Backup load failed, continue to legacy
      }

      // Method 3: Try legacy localStorage format
      try {
        const legacyConfig = this.loadLegacyConfig(reportType);
        if (legacyConfig) {
          // Migrate to new system in background (silently)
          this.migrateLegacyConfig(reportType, legacyConfig).catch(() => {});
          return legacyConfig;
        }
      } catch (error) {
        // Legacy load failed
      }

      return null;

    } catch (error) {
      console.error('Failed to load table config:', error);
      return null;
    }
  }

  /**
   * Enhanced save with intelligent debouncing and immediate persistence
   */
  async saveTableConfig(
    reportType: ReportType,
    columns: LegacyColumnConfig[],
    columnOrder?: string[],
    source?: string
  ): Promise<void> {
    try {
      const mappedType = REPORT_TYPE_MAP[reportType];
      const saveKey = `${reportType}_${source || 'default'}`;

      // Convert to standardized format
      const columnConfigs: ColumnConfig[] = columns.map((col, index) => ({
        id: col.id,
        width: col.width || 100,
        order: columnOrder ? columnOrder.indexOf(col.id) : index,
        visible: col.visible !== false
      }));

      // Minimal logging to reduce console spam
      if (source === 'ColumnManagement') {
      }

      // Queue the save data
      this.saveQueue.set(saveKey, {
        reportType,
        mappedType,
        columnConfigs,
        source: source || 'hybridStorage',
        timestamp: Date.now()
      });

      // Clear existing timeout
      if (this.saveTimeouts.has(saveKey)) {
        clearTimeout(this.saveTimeouts.get(saveKey)!);
      }

      // Different debounce times based on source
      let debounceTime = 300; // Default
      if (source === 'ResizableTable') {
        debounceTime = 0; // Immediate save for resize operations
      } else if (source === 'ColumnManagement') {
        debounceTime = 100; // Quick save for visibility changes
      }

      // Set new timeout
      const timeoutId = setTimeout(async () => {
        await this.executeSave(saveKey);
      }, debounceTime);

      this.saveTimeouts.set(saveKey, timeoutId);

    } catch (error) {
      console.error('❌ Failed to queue table config save:', error);
    }
  }

  /**
   * Execute the actual save operation
   */
  private async executeSave(saveKey: string): Promise<void> {
    try {
      const saveData = this.saveQueue.get(saveKey);
      if (!saveData) return;

      const { reportType, mappedType, columnConfigs, source } = saveData;

      // Minimal logging for saves

      // Method 1: Try database save (primary)
      let dbSaveSuccess = false;
      try {
        dbSaveSuccess = await databaseSettingsService.saveUserSettings(
          mappedType,
          columnConfigs,
          undefined, // Let service get current user
          0 // No additional debounce
        );

        if (dbSaveSuccess) {
          // Success - no logging needed for performance
          // Clean up legacy localStorage on successful database save
          this.cleanupLegacyConfig(reportType);
        }
      } catch (dbError) {
        // Database save failed, fallback will be used
      }

      // Method 2: Fallback to localStorage if database failed
      if (!dbSaveSuccess) {
        // Using fallback storage
        const legacyConfig: LegacyTableConfig = {
          columns: columnConfigs,
          timestamp: Date.now(),
          version: this.CONFIG_VERSION
        };
        this.saveLegacyConfig(reportType, legacyConfig);
      }

      // Always try to create backup
      try {
        await databaseSettingsService.syncWithLocalStorage(mappedType);
      } catch (syncError) {
        // Backup sync failed silently
      }

      // Dispatch event for UI updates (with delay to prevent loops)
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('tableConfigChanged', {
            detail: {
              reportType,
              source,
              columns: columnConfigs.length,
              visibleColumns: columnConfigs.filter((col: ColumnConfig) => col.visible).length,
              timestamp: Date.now()
            }
          }));
        }, 50);
      }

      // Clean up
      this.saveQueue.delete(saveKey);
      this.saveTimeouts.delete(saveKey);

      // Save completed

    } catch (error) {
      console.error('❌ Save execution failed:', error);
      // Clean up failed save
      this.saveQueue.delete(saveKey);
      this.saveTimeouts.delete(saveKey);
    }
  }

  /**
   * Update column visibility with optimized saving
   */
  async updateColumnVisibility(
    reportType: ReportType,
    visibilityMap: { [columnId: string]: boolean },
    allColumns: LegacyColumnConfig[]
  ): Promise<void> {
    try {
      const updatedColumns = allColumns.map(col => ({
        ...col,
        visible: visibilityMap[col.id] !== false
      }));

      await this.saveTableConfig(reportType, updatedColumns, undefined, 'ColumnManagement');

      const visibleCount = Object.values(visibilityMap).filter(Boolean).length;
      // Column visibility updated

    } catch (error) {
      console.error('Failed to update column visibility:', error);
    }
  }

  /**
   * Update column width with immediate saving
   */
  async updateColumnWidth(
    reportType: ReportType,
    columnId: string,
    newWidth: number,
    allColumns: LegacyColumnConfig[]
  ): Promise<void> {
    try {
      const updatedColumns = allColumns.map((col: LegacyColumnConfig) =>
        col.id === columnId
          ? { ...col, width: newWidth }
          : col
      );

      // Force immediate save for width changes
      await this.saveTableConfig(reportType, updatedColumns, undefined, 'ResizableTable');

      // Column width save queued

    } catch (error) {
      console.error('❌ Failed to update column width:', error);
      throw error; // Re-throw to let caller handle
    }
  }

  /**
   * Update column order
   */
  async updateColumnOrder(
    reportType: ReportType,
    newOrder: string[],
    allColumns: LegacyColumnConfig[]
  ): Promise<void> {
    try {
      await this.saveTableConfig(reportType, allColumns, newOrder, 'ResizableTable');
      // Column order updated
    } catch (error) {
      console.error('Failed to update column order:', error);
    }
  }

  /**
   * Get current user ID with better error handling
   */
  private async getCurrentUserId(): Promise<string | null> {
    try {
      const { supabase } = await import('@/app/lib/supabase/client');

      // Check session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return null;
      }

      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Load legacy localStorage config
   */
  private loadLegacyConfig(reportType: ReportType): LegacyTableConfig | null {
    try {
      if (typeof window === 'undefined') return null;

      const storageKey = this.LEGACY_STORAGE_KEYS[reportType];
      const stored = localStorage.getItem(storageKey);

      if (!stored) return null;

      const config = JSON.parse(stored) as LegacyTableConfig;

      // Basic validation
      if (!config.columns || !Array.isArray(config.columns)) {
        return null;
      }

      return config;
    } catch {
      return null;
    }
  }

  /**
   * Save to legacy localStorage format
   */
  private saveLegacyConfig(reportType: ReportType, config: LegacyTableConfig): void {
    try {
      if (typeof window === 'undefined') return;

      const storageKey = this.LEGACY_STORAGE_KEYS[reportType];
      localStorage.setItem(storageKey, JSON.stringify(config));

    } catch (error) {
      console.error('Failed to save legacy config:', error);
    }
  }

  /**
   * Clean up legacy localStorage entries
   */
  private cleanupLegacyConfig(reportType: ReportType): void {
    try {
      if (typeof window === 'undefined') return;

      const storageKey = this.LEGACY_STORAGE_KEYS[reportType];
      localStorage.removeItem(storageKey);

    } catch (error) {
      // Failed to cleanup legacy config silently
    }
  }

  /**
   * Migrate legacy config to new system
   */
  private async migrateLegacyConfig(reportType: ReportType, legacyConfig: LegacyTableConfig): Promise<void> {
    try {
      const mappedType = REPORT_TYPE_MAP[reportType];
      const columnConfigs: ColumnConfig[] = legacyConfig.columns;

      // Save to database
      await databaseSettingsService.saveUserSettings(mappedType, columnConfigs);


      // Clean up legacy after successful migration
      setTimeout(() => this.cleanupLegacyConfig(reportType), 1000);

    } catch (error) {
      // Failed to migrate legacy config silently
    }
  }

  /**
   * Sync preferences to localStorage backup
   */
  private async syncToLocalStorageBackup(reportType: ReportType, preferences: TablePreferences): Promise<void> {
    try {
      await databaseSettingsService.syncWithLocalStorage(preferences.reportType, preferences.userId);
    } catch (error) {
      // Failed to sync to localStorage backup silently
    }
  }

  /**
   * Restore backup to database
   */
  private async restoreToDatabase(reportType: string, preferences: TablePreferences): Promise<void> {
    try {
      await databaseSettingsService.saveUserSettings(
        reportType,
        preferences.columns,
        preferences.userId
      );
    } catch (error) {
      // Failed to restore backup to database silently
    }
  }

  /**
   * Force immediate save of all pending operations
   */
  async flushPendingSaves(): Promise<void> {
    try {
      const pendingKeys = Array.from(this.saveTimeouts.keys());

      // Clear all timeouts and execute saves immediately
      for (const key of pendingKeys) {
        const timeoutId = this.saveTimeouts.get(key);
        if (timeoutId) {
          clearTimeout(timeoutId);
          await this.executeSave(key);
        }
      }

    } catch (error) {
      console.error('❌ Failed to flush pending saves:', error);
    }
  }

  /**
   * Clear all configurations (for reset/debugging)
   */
  async clearAllConfigs(): Promise<void> {
    try {
      // Clear any pending saves first
      this.saveTimeouts.forEach(timeout => clearTimeout(timeout));
      this.saveTimeouts.clear();
      this.saveQueue.clear();

      // Clear database cache
      databaseSettingsService.clearAllCache();

      // Clear legacy localStorage
      if (typeof window !== 'undefined') {
        Object.values(this.LEGACY_STORAGE_KEYS).forEach(key => {
          localStorage.removeItem(key);
        });
      }

    } catch (error) {
      console.error('❌ Failed to clear all configs:', error);
    }
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus(): Promise<{
    database: boolean;
    cache: number;
    legacy: number;
    health: any;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];

    // Health check
    const health = await databaseSettingsService.healthCheck();

    // Cache stats
    const cacheStats = databaseSettingsService.getCacheStats();

    // Check legacy entries
    let legacyCount = 0;
    if (typeof window !== 'undefined') {
      legacyCount = Object.values(this.LEGACY_STORAGE_KEYS)
        .filter(key => localStorage.getItem(key))
        .length;
    }

    // Generate recommendations
    if (!health.database) {
      recommendations.push('Database connection issue - using fallback mode');
    }

    if (legacyCount > 0) {
      recommendations.push(`${legacyCount} legacy configs found - will auto-migrate on next save`);
    }

    if (cacheStats.size > 10) {
      recommendations.push('Consider clearing cache if experiencing memory issues');
    }

    return {
      database: health.database,
      cache: cacheStats.size,
      legacy: legacyCount,
      health,
      recommendations
    };
  }
}

// Create singleton instance
export const hybridTableStorage = new HybridTableStorage();

// Legacy exports for backward compatibility
export const loadTableConfig = (reportType: ReportType) => hybridTableStorage.loadTableConfig(reportType);
export const saveTableConfig = (reportType: ReportType, columns: LegacyColumnConfig[], columnOrder?: string[], source?: string) =>
  hybridTableStorage.saveTableConfig(reportType, columns, columnOrder, source);
export const updateColumnVisibility = (reportType: ReportType, visibilityMap: { [columnId: string]: boolean }, allColumns: LegacyColumnConfig[]) =>
  hybridTableStorage.updateColumnVisibility(reportType, visibilityMap, allColumns);
export const updateColumnWidth = (reportType: ReportType, columnId: string, newWidth: number, allColumns: LegacyColumnConfig[]) =>
  hybridTableStorage.updateColumnWidth(reportType, columnId, newWidth, allColumns);
export const updateColumnOrder = (reportType: ReportType, newOrder: string[], allColumns: LegacyColumnConfig[]) =>
  hybridTableStorage.updateColumnOrder(reportType, newOrder, allColumns);

// Enhanced exports
export { HybridTableStorage };
export type { ReportType, LegacyColumnConfig, LegacyTableConfig };