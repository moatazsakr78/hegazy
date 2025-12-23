export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  hegazy: {
    Tables: {
      cash_drawers: {
        Row: {
          id: string
          record_id: string
          current_balance: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          record_id: string
          current_balance?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          record_id?: string
          current_balance?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cash_drawer_transactions: {
        Row: {
          id: string
          drawer_id: string
          record_id: string
          transaction_type: string
          amount: number
          balance_after: number
          sale_id: string | null
          notes: string | null
          performed_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          drawer_id: string
          record_id: string
          transaction_type: string
          amount: number
          balance_after: number
          sale_id?: string | null
          notes?: string | null
          performed_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          drawer_id?: string
          record_id?: string
          transaction_type?: string
          amount?: number
          balance_after?: number
          sale_id?: string | null
          notes?: string | null
          performed_by?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_drawer_transactions_drawer_id_fkey"
            columns: ["drawer_id"]
            isOneToOne: false
            referencedRelation: "cash_drawers"
            referencedColumns: ["id"]
          }
        ]
      }
      auth_accounts: {
        Row: {
          access_token: string | null
          created_at: string | null
          expires_at: number | null
          id: string
          id_token: string | null
          provider: string
          provider_account_id: string
          refresh_token: string | null
          scope: string | null
          session_state: string | null
          token_type: string | null
          type: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          expires_at?: number | null
          id?: string
          id_token?: string | null
          provider: string
          provider_account_id: string
          refresh_token?: string | null
          scope?: string | null
          session_state?: string | null
          token_type?: string | null
          type: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          expires_at?: number | null
          id?: string
          id_token?: string | null
          provider?: string
          provider_account_id?: string
          refresh_token?: string | null
          scope?: string | null
          session_state?: string | null
          token_type?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_users"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_sessions: {
        Row: {
          created_at: string | null
          expires: string
          id: string
          session_token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires: string
          id?: string
          session_token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires?: string
          id?: string
          session_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_users"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_users: {
        Row: {
          created_at: string | null
          email: string
          email_verified: string | null
          id: string
          image: string | null
          name: string | null
          password_hash: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          email_verified?: string | null
          id?: string
          image?: string | null
          name?: string | null
          password_hash?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          email_verified?: string | null
          id?: string
          image?: string | null
          name?: string | null
          password_hash?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      auth_verification_tokens: {
        Row: {
          expires: string
          identifier: string
          token: string
        }
        Insert: {
          expires: string
          identifier: string
          token: string
        }
        Update: {
          expires?: string
          identifier?: string
          token?: string
        }
        Relationships: []
      }
      background_colors: {
        Row: {
          background_color: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
        }
        Insert: {
          background_color: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
        }
        Update: {
          background_color?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
        }
        Relationships: []
      }
      branch_stocks: {
        Row: {
          branch_id: string | null
          branch_name: string
          created_at: string | null
          id: string
          min_stock_threshold: number | null
          product_id: string
          stock: number | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          branch_name: string
          created_at?: string | null
          id?: string
          min_stock_threshold?: number | null
          product_id: string
          stock?: number | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          branch_name?: string
          created_at?: string | null
          id?: string
          min_stock_threshold?: number | null
          product_id?: string
          stock?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_stocks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_stocks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string
          allow_variants: boolean
          created_at: string | null
          id: string
          is_active: boolean | null
          location_link: string | null
          manager_id: string | null
          name: string
          name_en: string | null
          phone: string
          updated_at: string | null
        }
        Insert: {
          address: string
          allow_variants?: boolean
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_link?: string | null
          manager_id?: string | null
          name: string
          name_en?: string | null
          phone: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          allow_variants?: boolean
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_link?: string | null
          manager_id?: string | null
          name?: string
          name_en?: string | null
          phone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "current_user_role"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "branches_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string | null
          id: string
          price: number
          product_id: string
          quantity: number
          selected_color: string | null
          selected_shape: string | null
          selected_size: string | null
          session_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          price?: number
          product_id: string
          quantity?: number
          selected_color?: string | null
          selected_shape?: string | null
          selected_size?: string | null
          session_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          price?: number
          product_id?: string
          quantity?: number
          selected_color?: string | null
          selected_shape?: string | null
          selected_size?: string | null
          session_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cashbox_entries: {
        Row: {
          amount: number
          branch_id: string
          created_at: string | null
          description: string | null
          entry_type: string
          id: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string | null
          description?: string | null
          entry_type: string
          id?: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string | null
          description?: string | null
          entry_type?: string
          id?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashbox_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashbox_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "current_user_role"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cashbox_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          name_en: string | null
          parent_id: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          name_en?: string | null
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_currencies: {
        Row: {
          created_at: string | null
          currency_name: string
          id: string
          is_active: boolean | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          created_at?: string | null
          currency_name: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          created_at?: string | null
          currency_name?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      custom_sections: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          products: Json | null
          section_key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          products?: Json | null
          section_key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          products?: Json | null
          section_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_groups: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_groups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          reference_number: string | null
          safe_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: string | null
          safe_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: string | null
          safe_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "current_user_role"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customer_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_balance: number | null
          address: string | null
          backup_phone: string | null
          category: string | null
          city: string | null
          company_name: string | null
          contact_person: string | null
          country: string | null
          created_at: string | null
          credit_limit: number | null
          email: string | null
          governorate: string | null
          group_id: string | null
          id: string
          is_active: boolean | null
          loyalty_points: number | null
          name: string
          notes: string | null
          opening_balance: number | null
          phone: string | null
          profile_image_url: string | null
          rank: string | null
          tax_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_balance?: number | null
          address?: string | null
          backup_phone?: string | null
          category?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          governorate?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          loyalty_points?: number | null
          name: string
          notes?: string | null
          opening_balance?: number | null
          phone?: string | null
          profile_image_url?: string | null
          rank?: string | null
          tax_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_balance?: number | null
          address?: string | null
          backup_phone?: string | null
          category?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          governorate?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          loyalty_points?: number | null
          name?: string
          notes?: string | null
          opening_balance?: number | null
          phone?: string | null
          profile_image_url?: string | null
          rank?: string | null
          tax_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          branch_id: string
          category: string
          created_at: string | null
          description: string
          id: string
          receipt_url: string | null
          user_id: string
        }
        Insert: {
          amount: number
          branch_id: string
          category?: string
          created_at?: string | null
          description: string
          id?: string
          receipt_url?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          branch_id?: string
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          receipt_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "current_user_role"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          audit_status: string | null
          branch_id: string | null
          id: string
          last_updated: string | null
          min_stock: number | null
          product_id: string
          quantity: number
          warehouse_id: string | null
        }
        Insert: {
          audit_status?: string | null
          branch_id?: string | null
          id?: string
          last_updated?: string | null
          min_stock?: number | null
          product_id: string
          quantity?: number
          warehouse_id?: string | null
        }
        Update: {
          audit_status?: string | null
          branch_id?: string | null
          id?: string
          last_updated?: string | null
          min_stock?: number | null
          product_id?: string
          quantity?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          discount: number | null
          id: string
          is_prepared: boolean | null
          notes: string | null
          order_id: string
          prepared_at: string | null
          prepared_by: string | null
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          discount?: number | null
          id?: string
          is_prepared?: boolean | null
          notes?: string | null
          order_id: string
          prepared_at?: string | null
          prepared_by?: string | null
          product_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          discount?: number | null
          id?: string
          is_prepared?: boolean | null
          notes?: string | null
          order_id?: string
          prepared_at?: string | null
          prepared_by?: string | null
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: string | null
          created_at: string | null
          customer_address: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivery_type: string | null
          fully_paid: boolean | null
          id: string
          invoice_type:
            | Database["hegazy"]["Enums"]["invoice_type_enum"]
            | null
          notes: string | null
          order_number: string
          payment_progress: number | null
          shipping_amount: number | null
          status: string | null
          subtotal_amount: number | null
          time: string | null
          total_amount: number
          total_paid: number | null
          updated_at: string | null
          user_id: string | null
          user_session: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivery_type?: string | null
          fully_paid?: boolean | null
          id?: string
          invoice_type?:
            | Database["hegazy"]["Enums"]["invoice_type_enum"]
            | null
          notes?: string | null
          order_number: string
          payment_progress?: number | null
          shipping_amount?: number | null
          status?: string | null
          subtotal_amount?: number | null
          time?: string | null
          total_amount?: number
          total_paid?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_session?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_type?: string | null
          fully_paid?: boolean | null
          id?: string
          invoice_type?:
            | Database["hegazy"]["Enums"]["invoice_type_enum"]
            | null
          notes?: string | null
          order_number?: string
          payment_progress?: number | null
          shipping_amount?: number | null
          status?: string | null
          subtotal_amount?: number | null
          time?: string | null
          total_amount?: number
          total_paid?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_session?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_receipts: {
        Row: {
          created_at: string | null
          customer_id: string | null
          detected_account_number: string | null
          detected_amount: number | null
          id: string
          order_id: string
          payment_status: string | null
          receipt_image_url: string
          transaction_date: string | null
          updated_at: string | null
          user_id: string | null
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          detected_account_number?: string | null
          detected_amount?: number | null
          id?: string
          order_id: string
          payment_status?: string | null
          receipt_image_url: string
          transaction_date?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          detected_account_number?: string | null
          detected_amount?: number | null
          id?: string
          order_id?: string
          payment_status?: string | null
          receipt_image_url?: string
          transaction_date?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "current_user_role"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_receipts_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_tabs_state: {
        Row: {
          active_tab_id: string | null
          created_at: string | null
          id: string
          tabs: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_tab_id?: string | null
          created_at?: string | null
          id?: string
          tabs?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active_tab_id?: string | null
          created_at?: string | null
          id?: string
          tabs?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      product_card_colors: {
        Row: {
          background_color: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          background_color?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          background_color?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_color_shape_definitions: {
        Row: {
          barcode: string | null
          color_hex: string | null
          created_at: string | null
          id: string
          image_url: string | null
          name: string | null
          product_id: string
          sort_order: number | null
          updated_at: string | null
          variant_type: string
        }
        Insert: {
          barcode?: string | null
          color_hex?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          name?: string | null
          product_id: string
          sort_order?: number | null
          updated_at?: string | null
          variant_type: string
        }
        Update: {
          barcode?: string | null
          color_hex?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          name?: string | null
          product_id?: string
          sort_order?: number | null
          updated_at?: string | null
          variant_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_color_shape_definitions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_cost_tracking: {
        Row: {
          average_cost: number
          created_at: string | null
          has_purchase_history: boolean | null
          id: string
          last_purchase_date: string | null
          last_purchase_price: number | null
          product_id: string | null
          total_cost: number
          total_quantity_purchased: number
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          average_cost?: number
          created_at?: string | null
          has_purchase_history?: boolean | null
          id?: string
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          product_id?: string | null
          total_cost?: number
          total_quantity_purchased?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          average_cost?: number
          created_at?: string | null
          has_purchase_history?: boolean | null
          id?: string
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          product_id?: string | null
          total_cost?: number
          total_quantity_purchased?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_cost_tracking_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_display_settings: {
        Row: {
          created_at: string | null
          display_mode: string
          id: string
          selected_branches: string[] | null
          selected_warehouses: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_mode?: string
          id?: string
          selected_branches?: string[] | null
          selected_warehouses?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_mode?: string
          id?: string
          selected_branches?: string[] | null
          selected_warehouses?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string | null
          id: string
          image_url: string
          product_id: string
          sort_order: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          image_url: string
          product_id: string
          sort_order?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          image_url?: string
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_location_thresholds: {
        Row: {
          branch_id: string | null
          created_at: string | null
          id: string
          min_stock_threshold: number
          product_id: string
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          min_stock_threshold?: number
          product_id: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          min_stock_threshold?: number
          product_id?: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_location_thresholds_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_location_thresholds_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_location_thresholds_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ratings: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          helpful_count: number | null
          id: string
          is_approved: boolean | null
          is_featured: boolean | null
          is_verified_purchase: boolean | null
          product_id: string
          rating: number
          review_text: string | null
          review_title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          helpful_count?: number | null
          id?: string
          is_approved?: boolean | null
          is_featured?: boolean | null
          is_verified_purchase?: boolean | null
          product_id: string
          rating: number
          review_text?: string | null
          review_title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          helpful_count?: number | null
          id?: string
          is_approved?: boolean | null
          is_featured?: boolean | null
          is_verified_purchase?: boolean | null
          product_id?: string
          rating?: number
          review_text?: string | null
          review_title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_ratings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ratings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_size_group_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          size_group_id: string
          size_name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          size_group_id: string
          size_name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          size_group_id?: string
          size_name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_size_group_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_size_group_items_size_group_id_fkey"
            columns: ["size_group_id"]
            isOneToOne: false
            referencedRelation: "product_size_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      product_size_groups: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_sizes: {
        Row: {
          created_at: string | null
          id: string
          is_available: boolean | null
          min_stock: number | null
          price_adjustment: number | null
          product_id: string
          size_category: string | null
          size_code: string | null
          size_name: string
          size_value: string | null
          sort_order: number | null
          stock_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          min_stock?: number | null
          price_adjustment?: number | null
          product_id: string
          size_category?: string | null
          size_code?: string | null
          size_name: string
          size_value?: string | null
          sort_order?: number | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          min_stock?: number | null
          price_adjustment?: number | null
          product_id?: string
          size_category?: string | null
          size_code?: string | null
          size_name?: string
          size_value?: string | null
          sort_order?: number | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_sizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_quantities: {
        Row: {
          branch_id: string
          created_at: string | null
          id: string
          quantity: number
          updated_at: string | null
          variant_definition_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          id?: string
          quantity?: number
          updated_at?: string | null
          variant_definition_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          id?: string
          quantity?: number
          updated_at?: string | null
          variant_definition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_quantities_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_quantities_variant_definition_id_fkey"
            columns: ["variant_definition_id"]
            isOneToOne: false
            referencedRelation: "product_color_shape_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          branch_id: string
          color_hex: string | null
          color_name: string | null
          created_at: string | null
          id: string
          image_url: string | null
          name: string
          product_id: string
          quantity: number
          updated_at: string | null
          variant_type: string
        }
        Insert: {
          barcode?: string | null
          branch_id: string
          color_hex?: string | null
          color_name?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          product_id: string
          quantity?: number
          updated_at?: string | null
          variant_type: string
        }
        Update: {
          barcode?: string | null
          branch_id?: string
          color_hex?: string | null
          color_name?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          product_id?: string
          quantity?: number
          updated_at?: string | null
          variant_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_videos: {
        Row: {
          created_at: string | null
          duration: number | null
          id: string
          product_id: string
          sort_order: number | null
          thumbnail_url: string | null
          updated_at: string | null
          video_name: string | null
          video_size: number | null
          video_url: string
        }
        Insert: {
          created_at?: string | null
          duration?: number | null
          id?: string
          product_id: string
          sort_order?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_name?: string | null
          video_size?: number | null
          video_url: string
        }
        Update: {
          created_at?: string | null
          duration?: number | null
          id?: string
          product_id?: string
          sort_order?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_name?: string | null
          video_size?: number | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_videos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_votes: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          user_identifier: string
          vote: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          user_identifier: string
          vote: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          user_identifier?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_votes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          additional_images_urls: Json | null
          barcode: string | null
          barcodes: string[] | null
          branch: string | null
          category_id: string | null
          cost_price: number
          created_at: string | null
          description: string | null
          description_en: string | null
          discount_amount: number | null
          discount_end_date: string | null
          discount_percentage: number | null
          discount_start_date: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          is_hidden: boolean | null
          location: string | null
          main_image_url: string | null
          max_stock: number | null
          min_stock: number | null
          name: string
          name_en: string | null
          price: number
          price1: number | null
          price2: number | null
          price3: number | null
          price4: number | null
          product_code: string | null
          rating: number | null
          rating_count: number | null
          status: string | null
          stock: number | null
          sub_image_url: string | null
          suggested_products: string[] | null
          tax_price: number | null
          unit: string | null
          updated_at: string | null
          video_url: string | null
          warehouse: string | null
          wholesale_price: number | null
        }
        Insert: {
          additional_images_urls?: Json | null
          barcode?: string | null
          barcodes?: string[] | null
          branch?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          discount_amount?: number | null
          discount_end_date?: string | null
          discount_percentage?: number | null
          discount_start_date?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_hidden?: boolean | null
          location?: string | null
          main_image_url?: string | null
          max_stock?: number | null
          min_stock?: number | null
          name: string
          name_en?: string | null
          price?: number
          price1?: number | null
          price2?: number | null
          price3?: number | null
          price4?: number | null
          product_code?: string | null
          rating?: number | null
          rating_count?: number | null
          status?: string | null
          stock?: number | null
          sub_image_url?: string | null
          suggested_products?: string[] | null
          tax_price?: number | null
          unit?: string | null
          updated_at?: string | null
          video_url?: string | null
          warehouse?: string | null
          wholesale_price?: number | null
        }
        Update: {
          additional_images_urls?: Json | null
          barcode?: string | null
          barcodes?: string[] | null
          branch?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          discount_amount?: number | null
          discount_end_date?: string | null
          discount_percentage?: number | null
          discount_start_date?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_hidden?: boolean | null
          location?: string | null
          main_image_url?: string | null
          max_stock?: number | null
          min_stock?: number | null
          name?: string
          name_en?: string | null
          price?: number
          price1?: number | null
          price2?: number | null
          price3?: number | null
          price4?: number | null
          product_code?: string | null
          rating?: number | null
          rating_count?: number | null
          status?: string | null
          stock?: number | null
          sub_image_url?: string | null
          suggested_products?: string[] | null
          tax_price?: number | null
          unit?: string | null
          updated_at?: string | null
          video_url?: string | null
          warehouse?: string | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoice_items: {
        Row: {
          created_at: string | null
          discount_amount: number | null
          id: string
          notes: string | null
          product_id: string | null
          purchase_invoice_id: string | null
          quantity: number
          tax_amount: number | null
          total_price: number
          unit_purchase_price: number
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          product_id?: string | null
          purchase_invoice_id?: string | null
          quantity: number
          tax_amount?: number | null
          total_price: number
          unit_purchase_price: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          product_id?: string | null
          purchase_invoice_id?: string | null
          quantity?: number
          tax_amount?: number | null
          total_price?: number
          unit_purchase_price?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          discount_amount: number | null
          id: string
          invoice_date: string
          invoice_number: string
          invoice_type:
            | Database["hegazy"]["Enums"]["purchase_invoice_type_enum"]
            | null
          is_active: boolean | null
          net_amount: number
          notes: string | null
          payment_status: string | null
          record_id: string | null
          supplier_id: string | null
          tax_amount: number | null
          time: string | null
          total_amount: number
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          id?: string
          invoice_date?: string
          invoice_number: string
          invoice_type?:
            | Database["hegazy"]["Enums"]["purchase_invoice_type_enum"]
            | null
          is_active?: boolean | null
          net_amount?: number
          notes?: string | null
          payment_status?: string | null
          record_id?: string | null
          supplier_id?: string | null
          tax_amount?: number | null
          time?: string | null
          total_amount?: number
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          invoice_type?:
            | Database["hegazy"]["Enums"]["purchase_invoice_type_enum"]
            | null
          is_active?: boolean | null
          net_amount?: number
          notes?: string | null
          payment_status?: string | null
          record_id?: string | null
          supplier_id?: string | null
          tax_amount?: number | null
          time?: string | null
          total_amount?: number
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_purchase_invoices_record_id"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      records: {
        Row: {
          branch_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          cost_price: number
          created_at: string | null
          discount: number | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          cost_price?: number
          created_at?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          sale_id: string
          unit_price: number
        }
        Update: {
          cost_price?: number
          created_at?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string
          cashier_id: string | null
          created_at: string | null
          customer_id: string | null
          discount_amount: number | null
          id: string
          invoice_number: string
          invoice_type:
            | Database["hegazy"]["Enums"]["sales_invoice_type_enum"]
            | null
          is_updated: boolean | null
          notes: string | null
          payment_method: string
          profit: number | null
          record_id: string | null
          tax_amount: number | null
          time: string | null
          total_amount: number
          update_history: Json | null
        }
        Insert: {
          branch_id: string
          cashier_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          invoice_number: string
          invoice_type?:
            | Database["hegazy"]["Enums"]["sales_invoice_type_enum"]
            | null
          is_updated?: boolean | null
          notes?: string | null
          payment_method?: string
          profit?: number | null
          record_id?: string | null
          tax_amount?: number | null
          time?: string | null
          total_amount?: number
          update_history?: Json | null
        }
        Update: {
          branch_id?: string
          cashier_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          invoice_number?: string
          invoice_type?:
            | Database["hegazy"]["Enums"]["sales_invoice_type_enum"]
            | null
          is_updated?: boolean | null
          notes?: string | null
          payment_method?: string
          profit?: number | null
          record_id?: string | null
          tax_amount?: number | null
          time?: string | null
          total_amount?: number
          update_history?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sales_record_id"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "current_user_role"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_areas: {
        Row: {
          created_at: string | null
          id: string
          name: string
          price: number
          shipping_governorate_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          price: number
          shipping_governorate_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          price?: number
          shipping_governorate_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_areas_shipping_governorate_id_fkey"
            columns: ["shipping_governorate_id"]
            isOneToOne: false
            referencedRelation: "shipping_governorates"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_companies: {
        Row: {
          created_at: string | null
          id: string
          name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shipping_governorates: {
        Row: {
          created_at: string | null
          id: string
          name: string
          price: number | null
          shipping_company_id: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          price?: number | null
          shipping_company_id: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          price?: number | null
          shipping_company_id?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_governorates_shipping_company_id_fkey"
            columns: ["shipping_company_id"]
            isOneToOne: false
            referencedRelation: "shipping_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      store_categories: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          name_en: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          name_en?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      store_category_products: {
        Row: {
          added_at: string | null
          added_by: string | null
          id: string
          product_id: string | null
          sort_order: number | null
          store_category_id: string | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          product_id?: string | null
          sort_order?: number | null
          store_category_id?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          product_id?: string | null
          sort_order?: number | null
          store_category_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_category_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_category_products_store_category_id_fkey"
            columns: ["store_category_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      store_theme_colors: {
        Row: {
          button_color: string
          button_hover_color: string
          created_at: string | null
          id: string
          interactive_color: string | null
          is_active: boolean | null
          is_default: boolean | null
          name: string
          primary_color: string
          primary_hover_color: string
          updated_at: string | null
        }
        Insert: {
          button_color?: string
          button_hover_color?: string
          created_at?: string | null
          id?: string
          interactive_color?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          primary_color?: string
          primary_hover_color?: string
          updated_at?: string | null
        }
        Update: {
          button_color?: string
          button_hover_color?: string
          created_at?: string | null
          id?: string
          interactive_color?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          primary_color?: string
          primary_hover_color?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      supplier_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_groups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "supplier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          reference_number: string | null
          safe_id: string | null
          supplier_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: string | null
          safe_id?: string | null
          supplier_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: string | null
          safe_id?: string | null
          supplier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          account_balance: number | null
          address: string | null
          category: string | null
          city: string | null
          company_name: string | null
          contact_person: string | null
          country: string | null
          created_at: string | null
          credit_limit: number | null
          email: string | null
          group_id: string | null
          id: string
          is_active: boolean | null
          last_purchase: string | null
          name: string
          notes: string | null
          opening_balance: number | null
          phone: string | null
          rank: string | null
          tax_id: string | null
          total_purchases: number | null
          updated_at: string | null
        }
        Insert: {
          account_balance?: number | null
          address?: string | null
          category?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          last_purchase?: string | null
          name: string
          notes?: string | null
          opening_balance?: number | null
          phone?: string | null
          rank?: string | null
          tax_id?: string | null
          total_purchases?: number | null
          updated_at?: string | null
        }
        Update: {
          account_balance?: number | null
          address?: string | null
          category?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          last_purchase?: string | null
          name?: string
          notes?: string | null
          opening_balance?: number | null
          phone?: string | null
          rank?: string | null
          tax_id?: string | null
          total_purchases?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          settings_data: Json
          updated_at: string | null
          version: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          settings_data?: Json
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          settings_data?: Json
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      user_column_preferences: {
        Row: {
          created_at: string | null
          id: string
          preferences: Json
          report_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          preferences?: Json
          report_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          preferences?: Json
          report_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          id: number
          preferences: Json
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          preferences?: Json
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          preferences?: Json
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          is_admin: boolean
          phone: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          is_admin?: boolean
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_admin?: boolean
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_profiles_branch"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_role: string | null
          permissions: string[] | null
          price_level: number | null
          role_type: string
          updated_at: string | null
          user_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_role?: string | null
          permissions?: string[] | null
          price_level?: number | null
          role_type?: string
          updated_at?: string | null
          user_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_role?: string | null
          permissions?: string[] | null
          price_level?: number | null
          role_type?: string
          updated_at?: string | null
          user_count?: number | null
        }
        Relationships: []
      }
      warehouse_stocks: {
        Row: {
          created_at: string | null
          id: string
          min_stock_threshold: number | null
          product_id: string
          stock: number | null
          updated_at: string | null
          warehouse_id: string | null
          warehouse_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          min_stock_threshold?: number | null
          product_id: string
          stock?: number | null
          updated_at?: string | null
          warehouse_id?: string | null
          warehouse_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          min_stock_threshold?: number | null
          product_id?: string
          stock?: number | null
          updated_at?: string | null
          warehouse_id?: string | null
          warehouse_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_stocks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stocks_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string
          allow_variants: boolean
          created_at: string | null
          id: string
          is_active: boolean | null
          manager_id: string | null
          name: string
          name_en: string | null
          phone: string
          updated_at: string | null
        }
        Insert: {
          address: string
          allow_variants?: boolean
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name: string
          name_en?: string | null
          phone: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          allow_variants?: boolean
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name?: string
          name_en?: string | null
          phone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "current_user_role"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "warehouses_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_user_role: {
        Row: {
          full_name: string | null
          is_active: boolean | null
          is_admin: boolean | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          full_name?: string | null
          is_active?: boolean | null
          is_admin?: boolean | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          full_name?: string | null
          is_active?: boolean | null
          is_admin?: boolean | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      register_user: {
        Args: { user_email: string; user_name?: string; user_password: string }
        Returns: Json
      }
    }
    Enums: {
      invoice_type_enum: "Sale" | "Purchase" | "Sale Return" | "Purchase Return"
      purchase_invoice_type_enum: "Purchase Invoice" | "Purchase Return"
      sales_invoice_type_enum: "Sale Invoice" | "Sale Return"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  hegazy: {
    Enums: {
      invoice_type_enum: ["Sale", "Purchase", "Sale Return", "Purchase Return"],
      purchase_invoice_type_enum: ["Purchase Invoice", "Purchase Return"],
      sales_invoice_type_enum: ["Sale Invoice", "Sale Return"],
    },
  },
} as const
