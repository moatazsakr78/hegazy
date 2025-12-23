/**
 * System Settings Types
 * Comprehensive settings structure for the POS system
 */

// Currency settings interface
export interface CurrencySettings {
  mode: 'separate' | 'unified';
  system_currency: string;
  website_currency: string;
  unified_currency: string;
  default_currencies: string[];
}

// Website display settings
export interface WebsiteSettings {
  show_categories: boolean;
  show_search: boolean;
  show_featured_products: boolean;
  show_ratings: boolean;
  show_discounts: boolean;
  enable_cart: boolean;
  enable_wishlist: boolean;
  enable_user_registration: boolean;
  default_language: 'ar' | 'en';
  products_per_page: number;
  enable_product_reviews: boolean;
  auto_approve_reviews: boolean;
  // Store display settings
  show_quantity_in_store: boolean;
  show_product_star_rating: boolean;
}

// UI/Theme settings
export interface UISettings {
  theme: 'dark' | 'light';
  primary_color: string;
  secondary_color: string;
  hover_color: string;
  font_family: string;
  font_size: number;
  enable_animations: boolean;
  enable_sounds: boolean;
  direction: 'rtl' | 'ltr';
  show_line_numbers: boolean;
  show_today_indicator: boolean;
  rows_per_page: number;
  notification_position: 'top' | 'bottom';
}

// System behavior settings
export interface SystemSettings {
  enable_notifications: boolean;
  auto_save_interval: number; // in minutes
  session_timeout: number; // in minutes
  enable_audit_log: boolean;
  backup_frequency: 'daily' | 'weekly' | 'monthly';
  default_branch_id?: string;
  default_warehouse_id?: string;
  enable_barcode_scanner: boolean;
  enable_receipt_printer: boolean;
}

// POS specific settings
export interface POSSettings {
  allow_negative_inventory: boolean;
  require_customer_for_sale: boolean;
  enable_discounts: boolean;
  enable_tax_calculation: boolean;
  default_tax_rate: number;
  enable_loyalty_points: boolean;
  points_per_currency_unit: number;
  enable_installments: boolean;
  max_installment_months: number;
}

// Reports and analytics settings
export interface ReportsSettings {
  default_date_range: 'today' | 'week' | 'month' | 'year';
  enable_real_time_reports: boolean;
  auto_generate_daily_reports: boolean;
  export_format: 'pdf' | 'excel' | 'csv';
  include_charts: boolean;
  chart_style: 'bar' | 'line' | 'pie';
}

// Security settings
export interface SecuritySettings {
  enable_two_factor: boolean;
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_numbers: boolean;
  password_require_symbols: boolean;
  session_timeout_minutes: number;
  max_login_attempts: number;
  lockout_duration_minutes: number;
}

// Social Media interface
export interface SocialMedia {
  platform: string;
  link: string;
}

// Branch interface
export interface Branch {
  branchId: string;
  branchName: string;
  address: string;
  locationLink: string;
}

// Company settings
export interface CompanySettings {
  name: string;
  logoUrl: string;
  logoShape: 'square' | 'circle';
  socialMedia: SocialMedia[];
  branches: Branch[];
}

// Main settings object that combines all categories
export interface SystemSettingsObject {
  currency: CurrencySettings;
  website: WebsiteSettings;
  ui: UISettings;
  system: SystemSettings;
  pos: POSSettings;
  reports: ReportsSettings;
  security: SecuritySettings;
  company: CompanySettings;
  version: string;
  last_updated: string;
  updated_by?: string;
}

// Default settings object
export const DEFAULT_SETTINGS: SystemSettingsObject = {
  currency: {
    mode: 'separate',
    system_currency: 'ريال',
    website_currency: 'جنيه',
    unified_currency: 'ريال',
    default_currencies: ['ريال', 'جنيه']
  },
  website: {
    show_categories: true,
    show_search: true,
    show_featured_products: true,
    show_ratings: true,
    show_discounts: true,
    enable_cart: true,
    enable_wishlist: true,
    enable_user_registration: true,
    default_language: 'ar',
    products_per_page: 20,
    enable_product_reviews: true,
    auto_approve_reviews: false,
    show_quantity_in_store: true,
    show_product_star_rating: true
  },
  ui: {
    theme: 'dark',
    primary_color: '#3B82F6',
    secondary_color: '#10B981',
    hover_color: '#EF4444',
    font_family: 'Cairo',
    font_size: 100,
    enable_animations: true,
    enable_sounds: false,
    direction: 'rtl',
    show_line_numbers: false,
    show_today_indicator: true,
    rows_per_page: 5,
    notification_position: 'top'
  },
  system: {
    enable_notifications: true,
    auto_save_interval: 5,
    session_timeout: 120,
    enable_audit_log: true,
    backup_frequency: 'daily',
    enable_barcode_scanner: false,
    enable_receipt_printer: false
  },
  pos: {
    allow_negative_inventory: false,
    require_customer_for_sale: false,
    enable_discounts: true,
    enable_tax_calculation: true,
    default_tax_rate: 15,
    enable_loyalty_points: true,
    points_per_currency_unit: 1,
    enable_installments: false,
    max_installment_months: 12
  },
  reports: {
    default_date_range: 'month',
    enable_real_time_reports: true,
    auto_generate_daily_reports: false,
    export_format: 'pdf',
    include_charts: true,
    chart_style: 'bar'
  },
  security: {
    enable_two_factor: false,
    password_min_length: 8,
    password_require_uppercase: true,
    password_require_numbers: true,
    password_require_symbols: false,
    session_timeout_minutes: 120,
    max_login_attempts: 5,
    lockout_duration_minutes: 30
  },
  company: {
    name: 'hegazy',
    logoUrl: '',
    logoShape: 'square',
    socialMedia: [{ platform: '', link: '' }],
    branches: []
  },
  version: '1.0.0',
  last_updated: new Date().toISOString()
};

// Helper type for updating settings
export type SettingsUpdateInput = {
  [K in keyof SystemSettingsObject]?: Partial<SystemSettingsObject[K]>;
};

// Settings database row interface
export interface SettingsRow {
  id: string;
  settings_data: SystemSettingsObject;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}