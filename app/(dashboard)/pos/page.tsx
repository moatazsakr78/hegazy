"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";

// Local storage key for POS column visibility
const POS_COLUMN_VISIBILITY_KEY = 'pos-column-visibility-v2';
import { useCart, CartProvider } from "@/lib/contexts/CartContext";
import { useCartBadge } from "@/lib/hooks/useCartBadge";
import CartModal from "@/app/components/CartModal";
import { useCompanySettings } from "@/lib/hooks/useCompanySettings";
import {
  ProductGridImage,
  ProductModalImage,
  ProductThumbnail,
} from "../../components/ui/OptimizedImage";
import { usePerformanceMonitor } from "../../lib/utils/performanceMonitor";
import { useSystemCurrency, useFormatPrice } from "@/lib/hooks/useCurrency";
import { preloadImagesInBackground, getPreloadStats } from "@/lib/utils/imagePreloader";

// Editable Field Component for inline editing
interface EditableFieldProps {
  value: number;
  type?: string;
  step?: string;
  onUpdate: (value: number) => void;
  className?: string;
}

function EditableField({
  value,
  type = "text",
  step,
  onUpdate,
  className = "",
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value.toString());

  const handleClick = () => {
    setIsEditing(true);
    setTempValue(value.toString());
  };

  const handleSubmit = () => {
    const numValue = parseFloat(tempValue);
    if (!isNaN(numValue) && numValue >= 0) {
      onUpdate(numValue);
    }
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setTempValue(value.toString());
    }
  };

  if (isEditing) {
    return (
      <input
        type={type}
        step={step}
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={handleKeyPress}
        className={`${className} ring-1 ring-blue-500`}
        autoFocus
        onFocus={(e) => e.target.select()}
      />
    );
  }

  return (
    <span
      onClick={handleClick}
      className={`${className} cursor-pointer`}
      title="اضغط للتعديل"
    >
      {value}
    </span>
  );
}

import { supabase } from "../../lib/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Category } from "../../types";
import ResizableTable from "../../components/tables/ResizableTable";
import Sidebar from "../../components/layout/Sidebar";
import TopHeader from "../../components/layout/TopHeader";
import RecordsSelectionModal from "../../components/RecordsSelectionModal";
import CustomerSelectionModal from "../../components/CustomerSelectionModal";
import BranchSelectionModal from "../../components/BranchSelectionModal";
import PriceTypeSelectionModal, { PriceType, getPriceTypeName } from "../../components/PriceTypeSelectionModal";
import HistoryModal from "../../components/HistoryModal";
import AddToCartModal from "../../components/AddToCartModal";
import ColorSelectionModal from "../../components/ColorSelectionModal";
import SupplierSelectionModal from "../../components/SupplierSelectionModal";
import WarehouseSelectionModal from "../../components/WarehouseSelectionModal";
import TransferLocationModal from "../../components/TransferLocationModal";
import QuickAddProductModal from "../../components/QuickAddProductModal";
import ColumnsControlModal from "../../components/ColumnsControlModal";
import PaymentSplit from "../../components/PaymentSplit";
import POSTabletView from "../../components/POSTabletView";
import DiscountModal from "../../components/DiscountModal";
import PostponedInvoicesModal from "../../components/PostponedInvoicesModal";
import CashDrawerModal from "../../components/CashDrawerModal";
import ProductGridSkeleton from "../../components/ui/ProductGridSkeleton";
import { useProductsAdmin } from "../../../lib/hooks/useProductsAdmin";
import { Product } from "../../lib/hooks/useProductsOptimized";
import { usePersistentSelections } from "../../lib/hooks/usePersistentSelections";
import { usePOSTabs } from "@/lib/hooks/usePOSTabs";
import {
  createSalesInvoice,
  CartItem,
} from "../../lib/invoices/createSalesInvoice";
import { createPurchaseInvoice } from "../../lib/invoices/createPurchaseInvoice";
import { createTransferInvoice } from "../../lib/invoices/createTransferInvoice";
import {
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ListBulletIcon,
  PlusIcon,
  ShoppingCartIcon,
  HomeIcon,
  BuildingOfficeIcon,
  ArrowsRightLeftIcon,
  UserIcon,
  BanknotesIcon,
  TableCellsIcon,
  CogIcon,
  EyeIcon,
  XMarkIcon,
  ClockIcon,
  ShoppingBagIcon,
  BuildingStorefrontIcon,
  ArrowUturnLeftIcon,
  PrinterIcon,
  CurrencyDollarIcon,
  ReceiptPercentIcon,
  FolderIcon,
  MinusIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

function POSPageContent() {
  // OPTIMIZED: Performance monitoring for POS page
  const { startRender, endRender } = usePerformanceMonitor("POSPage");
  const systemCurrency = useSystemCurrency();
  const formatPrice = useFormatPrice();
  const { companyName, logoUrl } = useCompanySettings();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keep CartContext for website functionality
  const {
    cartItems: webCartItems,
    addToCart: webAddToCart,
    removeFromCart: webRemoveFromCart,
    updateQuantity: webUpdateQuantity,
    clearCart: webClearCart,
  } = useCart();
  const { cartBadgeCount } = useCartBadge();

  // POS Tabs Management
  const {
    tabs: posTabs,
    activeTab: activePOSTab,
    activeTabId,
    addTab,
    addTabWithCustomer,
    addTabWithCustomerAndCart,
    closeTab,
    switchTab,
    updateActiveTabCart,
    updateActiveTabSelections,
    updateActiveTabMode,
    clearActiveTabCart,
    postponeTab,
    restoreTab,
    postponedTabs,
    isLoading: isLoadingTabs,
  } = usePOSTabs();

  // Dedicated POS Cart State (separate from website cart)
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRecordsModalOpen, setIsRecordsModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid");
  const [isCartOpen, setIsCartOpen] = useState(true); // Default open for desktop, toggle for mobile;
  const [showProductModal, setShowProductModal] = useState(false);
  const [showAddToCartModal, setShowAddToCartModal] = useState(false);
  const [showColorSelectionModal, setShowColorSelectionModal] = useState(false);
  const [modalProduct, setModalProduct] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isProcessingInvoice, setIsProcessingInvoice] = useState(false);

  // Purchase Mode States
  const [isPurchaseMode, setIsPurchaseMode] = useState(false);
  const [showPurchaseModeConfirm, setShowPurchaseModeConfirm] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isSupplierModalForNewPurchase, setIsSupplierModalForNewPurchase] = useState(false); // لتمييز إذا كان لبدء شراء جديد
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [showQuickAddProductModal, setShowQuickAddProductModal] =
    useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<{
    [key: string]: boolean;
  }>({});
  const posVisibilityLoadedRef = useRef(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);

  // Returns State - simple toggle
  const [isReturnMode, setIsReturnMode] = useState(false);

  // Price Type Selection State
  // Initialize from active tab's priceType or default to "price"
  const [selectedPriceType, setSelectedPriceTypeState] = useState<PriceType>("price");
  const [isPriceTypeModalOpen, setIsPriceTypeModalOpen] = useState(false);

  // Sync priceType with active tab when tab changes
  useEffect(() => {
    if (!isLoadingTabs && activePOSTab) {
      const tabPriceType = activePOSTab.selections?.priceType || "price";
      setSelectedPriceTypeState(tabPriceType as PriceType);
    }
  }, [activeTabId, activePOSTab, isLoadingTabs]);

  // Custom setter that updates both local state AND tab selections
  const setSelectedPriceType = useCallback((priceType: PriceType) => {
    setSelectedPriceTypeState(priceType);
    // Also update the tab's selections to persist the price type
    if (activePOSTab) {
      updateActiveTabSelections({
        ...activePOSTab.selections,
        priceType: priceType
      });
    }
  }, [activePOSTab, updateActiveTabSelections]);

  // Transfer Mode States
  const [isTransferMode, setIsTransferMode] = useState(false);
  const [transferFromLocation, setTransferFromLocation] = useState<any>(null);
  const [transferToLocation, setTransferToLocation] = useState<any>(null);
  const [isTransferLocationModalOpen, setIsTransferLocationModalOpen] =
    useState(false);

  // Print Receipt States
  const [showPrintReceiptModal, setShowPrintReceiptModal] = useState(false);
  const [lastInvoiceData, setLastInvoiceData] = useState<any>(null);

  // Add Tab Modal States
  const [showAddTabModal, setShowAddTabModal] = useState(false);
  const [newTabName, setNewTabName] = useState("");

  // Payment Split States
  const [paymentSplitData, setPaymentSplitData] = useState<any[]>([]);
  const [creditAmount, setCreditAmount] = useState<number>(0);

  // Change Calculator States (حساب الباقي)
  const [paidAmount, setPaidAmount] = useState<string>("");

  // Discount States
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [cartDiscount, setCartDiscount] = useState<number>(0);
  const [cartDiscountType, setCartDiscountType] = useState<"percentage" | "fixed">("percentage");

  // Postponed Invoices States
  const [isPostponedModalOpen, setIsPostponedModalOpen] = useState(false);
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

  // Cash Drawer States
  const [isCashDrawerModalOpen, setIsCashDrawerModalOpen] = useState(false);

  // Edit Invoice Mode States
  const [isEditMode, setIsEditMode] = useState(false);
  const [editInvoiceData, setEditInvoiceData] = useState<any>(null);
  const [editItemsLoaded, setEditItemsLoaded] = useState(false);

  // Use persistent selections hook for main tab defaults only
  const {
    selections: globalSelections,
    isLoaded: selectionsLoaded,
    setRecord: setGlobalRecord,
    setCustomer: setGlobalCustomer,
    setBranch: setGlobalBranch,
    clearSelections: clearGlobalSelections,
    resetToDefaultCustomer,
    hasRequiredForCart: globalHasRequiredForCart,
    hasRequiredForSale: globalHasRequiredForSale,
  } = usePersistentSelections();

  // Get selections from active tab (tab-specific selections)
  const selections = useMemo(() => {
    // For main tab, use global selections
    if (activeTabId === 'main') {
      return globalSelections;
    }
    // For other tabs, use tab-specific selections
    return activePOSTab?.selections || { customer: null, branch: null, record: null };
  }, [activeTabId, activePOSTab?.selections, globalSelections]);

  // Functions to update selections (tab-aware)
  const setRecord = useCallback((record: any) => {
    if (activeTabId === 'main') {
      setGlobalRecord(record);
    } else {
      updateActiveTabSelections({ ...activePOSTab?.selections, record });
    }
  }, [activeTabId, activePOSTab?.selections, setGlobalRecord, updateActiveTabSelections]);

  const setCustomer = useCallback((customer: any) => {
    if (activeTabId === 'main') {
      setGlobalCustomer(customer);
    } else {
      updateActiveTabSelections({ ...activePOSTab?.selections, customer });
    }
  }, [activeTabId, activePOSTab?.selections, setGlobalCustomer, updateActiveTabSelections]);

  const setBranch = useCallback((branch: any) => {
    if (activeTabId === 'main') {
      setGlobalBranch(branch);
    } else {
      updateActiveTabSelections({ ...activePOSTab?.selections, branch });
    }
  }, [activeTabId, activePOSTab?.selections, setGlobalBranch, updateActiveTabSelections]);

  const clearSelections = useCallback(() => {
    if (activeTabId === 'main') {
      clearGlobalSelections();
    } else {
      updateActiveTabSelections({ customer: null, branch: null, record: null });
    }
  }, [activeTabId, clearGlobalSelections, updateActiveTabSelections]);

  const hasRequiredForCart = useCallback(() => {
    return selections.branch !== null;
  }, [selections.branch]);

  const hasRequiredForSale = useCallback(() => {
    return selections.record && selections.customer && selections.branch;
  }, [selections.record, selections.customer, selections.branch]);

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Selected Category for filtering products
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Category tree expanded nodes state
  const [expandedCategoryNodes, setExpandedCategoryNodes] = useState<Set<string>>(new Set());

  // Build category tree structure for hierarchical display
  interface CategoryTreeNode {
    id: string;
    name: string;
    parent_id: string | null;
    children: CategoryTreeNode[];
    isExpanded: boolean;
  }

  // Build tree from flat categories
  const buildCategoryTree = useCallback((cats: Category[]): CategoryTreeNode | null => {
    // Find the root "منتجات" category
    const productsCategory = cats.find(cat => cat.name === 'منتجات' && !cat.parent_id);

    const buildNode = (cat: Category): CategoryTreeNode => {
      const children = cats
        .filter(c => c.parent_id === cat.id && c.is_active)
        .map(c => buildNode(c));

      return {
        id: cat.id,
        name: cat.name,
        parent_id: cat.parent_id,
        children,
        isExpanded: expandedCategoryNodes.has(cat.id) || cat.name === 'منتجات'
      };
    };

    if (productsCategory) {
      return buildNode(productsCategory);
    }

    // If no "منتجات" category exists, create virtual root
    const rootCategories = cats
      .filter(c => !c.parent_id && c.is_active)
      .map(c => buildNode(c));

    return {
      id: 'products-root',
      name: 'منتجات',
      parent_id: null,
      children: rootCategories,
      isExpanded: true
    };
  }, [expandedCategoryNodes]);

  // Get the category tree
  const categoryTree = useMemo(() => {
    return buildCategoryTree(categories);
  }, [categories, buildCategoryTree]);

  // Toggle category node expansion
  const toggleCategoryNode = useCallback((nodeId: string) => {
    setExpandedCategoryNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  // Get all descendant category IDs for filtering (so selecting parent shows all children's products)
  const getAllDescendantCategoryIds = useCallback((categoryId: string | null): Set<string> => {
    if (!categoryId) return new Set();

    const descendants = new Set<string>([categoryId]);

    const addChildren = (parentId: string) => {
      categories
        .filter(c => c.parent_id === parentId && c.is_active)
        .forEach(child => {
          descendants.add(child.id);
          addChildren(child.id);
        });
    };

    addChildren(categoryId);
    return descendants;
  }, [categories]);

  // Category IDs to filter products (includes selected + all descendants)
  const categoryFilterIds = useMemo(() => {
    return getAllDescendantCategoryIds(selectedCategoryId);
  }, [selectedCategoryId, getAllDescendantCategoryIds]);

  // Get selected category name for display
  const selectedCategoryName = useMemo(() => {
    if (!selectedCategoryId) return null;
    const category = categories.find(c => c.id === selectedCategoryId);
    return category?.name || null;
  }, [selectedCategoryId, categories]);

  // ✨ OPTIMIZED: Use super-optimized admin hook for better performance
  const { products, branches, isLoading, error, fetchProducts } = useProductsAdmin();

  // Device Detection for Tablet View
  const [isTabletDevice, setIsTabletDevice] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const width = window.innerWidth;
      setWindowWidth(width);

      const isMobile = /mobile|android.*mobile|webos|blackberry|opera mini|iemobile/.test(userAgent);
      const isTablet = (/tablet|ipad|playbook|silk|android(?!.*mobile)/i.test(userAgent) ||
                        (width >= 768 && width <= 1280)) &&
                       !isMobile;

      setIsTabletDevice(isTablet);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Cleanup: Clear any stale edit invoice data from localStorage on page load
  // This prevents old data from interfering with new edit sessions
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isEdit = urlParams.get('edit') === 'true';

    // Only clear if we're NOT in edit mode - if we are, let the initEditMode handle it
    if (!isEdit) {
      localStorage.removeItem('pos_edit_invoice');
    }
  }, []);

  // Edit Mode: Check URL params, load invoice data, and fetch sale items
  // Track if edit mode has been initialized to prevent re-running
  const editModeInitializedRef = useRef(false);

  useEffect(() => {
    const initEditMode = async () => {
      // Skip if already initialized
      if (editModeInitializedRef.current) {
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const isEdit = urlParams.get('edit') === 'true';
      const saleId = urlParams.get('saleId');

      if (!isEdit || !saleId) {
        return;
      }

      // Mark as initialized
      editModeInitializedRef.current = true;

      // Don't set isEditMode here - let the tab control the edit mode state
      // The edit mode will be set in the tab via updateActiveTabMode after tab creation

      // Read edit data from localStorage for customer info (localStorage is shared between tabs)
      const editDataStr = localStorage.getItem('pos_edit_invoice');
      let customerData: any = null;
      let localStorageItems: any[] = [];

      if (editDataStr) {
        try {
          const editData = JSON.parse(editDataStr);
          customerData = editData;
          localStorageItems = editData.items || [];

          // العميل الافتراضي: لا يمكن تعديل فواتيره - حذف فقط
          if (customerData?.customerId === '00000000-0000-0000-0000-000000000001') {
            alert('لا يمكن تعديل فواتير العميل الافتراضي - يمكن الحذف فقط');
            localStorage.removeItem('pos_edit_invoice');
            // Clear URL params and reload
            window.history.replaceState({}, '', '/pos');
            return;
          }

          // Clear localStorage after reading
          localStorage.removeItem('pos_edit_invoice');
        } catch (error) {
          console.error('Error parsing edit invoice data:', error);
        }
      }

      // Fetch sale items from database
      try {
        const { data: saleItemsData, error } = await supabase
          .from('sale_items')
          .select(`
            id,
            quantity,
            unit_price,
            discount,
            product_id,
            product:products(
              id,
              name,
              barcode,
              main_image_url,
              price,
              cost_price,
              wholesale_price,
              half_wholesale_price,
              category:categories(name)
            )
          `)
          .eq('sale_id', saleId);

        // Also fetch sale info for invoice number
        const { data: saleData } = await supabase
          .from('sales')
          .select('invoice_number, customer_id')
          .eq('id', saleId)
          .single();

        // العميل الافتراضي: لا يمكن تعديل فواتيره - حذف فقط (تحقق إضافي من قاعدة البيانات)
        if (saleData?.customer_id === '00000000-0000-0000-0000-000000000001') {
          alert('لا يمكن تعديل فواتير العميل الافتراضي - يمكن الحذف فقط');
          window.history.replaceState({}, '', '/pos');
          return;
        }

        // Store invoice number for later use (don't set state here)
        const invoiceNumber = saleData?.invoice_number || '';

        // Build cart items from fetched data
        let newCartItems: any[] = [];

        if (!error && saleItemsData && saleItemsData.length > 0) {
          saleItemsData.forEach((item: any) => {
            const productData = item.product;

            if (productData) {
              newCartItems.push({
                id: `edit-${item.id}-${Date.now()}-${Math.random()}`,
                product: productData,
                quantity: item.quantity,
                price: item.unit_price,
                totalPrice: item.unit_price * item.quantity,
                discount: item.discount || 0,
                isEditItem: true
              });
            }
          });
        }

        // Fallback to localStorage items if database query failed or returned empty
        if (newCartItems.length === 0 && localStorageItems.length > 0) {
          newCartItems = localStorageItems.map((item: any, index: number) => ({
            id: `edit-local-${index}-${Date.now()}-${Math.random()}`,
            product: {
              id: item.productId,
              name: item.productName,
              barcode: item.barcode,
              main_image_url: item.main_image_url
            },
            quantity: item.quantity,
            price: item.unitPrice,
            totalPrice: item.unitPrice * item.quantity,
            discount: item.discount || 0,
            isEditItem: true
          }));
        }

        // Create customer object for the new tab
        const customerForTab = customerData?.customerId ? {
          id: customerData.customerId,
          name: customerData.customerName,
          phone: customerData.customerPhone
        } : null;

        // Create tab title with customer name (like when selecting a customer from POS)
        const tabTitle = customerForTab?.name || 'تعديل فاتورة';

        // Store edit invoice data for the new tab
        const editData = {
          ...customerData,
          saleId: saleId,
          invoiceNumber: invoiceNumber
        };

        if (newCartItems.length > 0) {
          // Create a new tab with the customer name and cart items (like when selecting a customer)
          // Pass edit mode options directly to avoid race conditions
          addTabWithCustomerAndCart(customerForTab, newCartItems, tabTitle, {
            branch: globalSelections.branch,
            record: globalSelections.record,
            priceType: selectedPriceType,
          }, {
            isEditMode: true,
            editInvoiceData: editData,
          });
          setEditItemsLoaded(true);
        } else {
          // Even if no cart items, create a tab with customer name
          if (customerForTab) {
            addTabWithCustomerAndCart(customerForTab, [], tabTitle, {
              branch: globalSelections.branch,
              record: globalSelections.record,
              priceType: selectedPriceType,
            }, {
              isEditMode: true,
              editInvoiceData: editData,
            });
          }
          setEditItemsLoaded(true);
        }
      } catch (error) {
        console.error('Error loading edit items:', error);

        // Create customer object for the new tab
        const customerForTab = customerData?.customerId ? {
          id: customerData.customerId,
          name: customerData.customerName,
          phone: customerData.customerPhone
        } : null;

        // Create tab title with customer name
        const tabTitle = customerForTab?.name || 'تعديل فاتورة';

        // Store edit invoice data for the new tab
        const editData = {
          ...customerData,
          saleId: saleId,
          invoiceNumber: ''
        };

        // Fallback to localStorage items if exception occurred
        if (localStorageItems.length > 0) {
          const fallbackItems = localStorageItems.map((item: any, index: number) => ({
            id: `edit-local-${index}-${Date.now()}-${Math.random()}`,
            product: {
              id: item.productId,
              name: item.productName,
              barcode: item.barcode,
              main_image_url: item.main_image_url
            },
            quantity: item.quantity,
            price: item.unitPrice,
            totalPrice: item.unitPrice * item.quantity,
            discount: item.discount || 0,
            isEditItem: true
          }));

          // Create a new tab with the customer name and cart items
          // Pass edit mode options directly to avoid race conditions
          addTabWithCustomerAndCart(customerForTab, fallbackItems, tabTitle, {
            branch: globalSelections.branch,
            record: globalSelections.record,
            priceType: selectedPriceType,
          }, {
            isEditMode: true,
            editInvoiceData: editData,
          });
          setEditItemsLoaded(true);
        } else {
          // Even if no items, create a tab with customer name
          if (customerForTab) {
            addTabWithCustomerAndCart(customerForTab, [], tabTitle, {
              branch: globalSelections.branch,
              record: globalSelections.record,
              priceType: selectedPriceType,
            }, {
              isEditMode: true,
              editInvoiceData: editData,
            });
          }
          setEditItemsLoaded(true);
        }
      }
    };

    initEditMode();
  }, [addTabWithCustomerAndCart, globalSelections.branch, globalSelections.record, selectedPriceType]);

  // Generate dynamic table columns based on branches - same as Products page
  const dynamicTableColumns = useMemo(() => {
    const baseColumns = [
      {
        id: "index",
        header: "#",
        accessor: "#",
        width: 60,
        render: (value: any, item: any, index: number) => (
          <span className="text-gray-400 font-medium">{index + 1}</span>
        ),
      },
      {
        id: "name",
        header: "اسم المنتج",
        accessor: "name",
        width: 200,
        render: (value: string) => (
          <span className="text-white font-medium">{value}</span>
        ),
      },
      {
        id: "group",
        header: "المجموعة",
        accessor: "category",
        width: 100,
        render: (value: any) => (
          <span className="text-gray-300">{value?.name || "غير محدد"}</span>
        ),
      },
      {
        id: "totalQuantity",
        header: "كمية كلية",
        accessor: "totalQuantity",
        width: 120,
        render: (value: number) => (
          <span className="text-blue-400 font-medium">قطعة {value}</span>
        ),
      },
      {
        id: "buyPrice",
        header: "سعر الشراء",
        accessor: "cost_price",
        width: 120,
        render: (value: number) => (
          <span className="text-white">{(value || 0).toFixed(2)}</span>
        ),
      },
      {
        id: "sellPrice",
        header: "سعر البيع",
        accessor: "price",
        width: 120,
        render: (value: number) => (
          <span className="text-white">{(value || 0).toFixed(2)}</span>
        ),
      },
      {
        id: "wholeSalePrice",
        header: "سعر الجملة",
        accessor: "wholesale_price",
        width: 120,
        render: (value: number) => (
          <span className="text-white">{(value || 0).toFixed(2)}</span>
        ),
      },
      {
        id: "sellPrice1",
        header: "سعر 1",
        accessor: "price1",
        width: 100,
        render: (value: number) => (
          <span className="text-white">{(value || 0).toFixed(2)}</span>
        ),
      },
      {
        id: "sellPrice2",
        header: "سعر 2",
        accessor: "price2",
        width: 100,
        render: (value: number) => (
          <span className="text-white">{(value || 0).toFixed(2)}</span>
        ),
      },
      {
        id: "sellPrice3",
        header: "سعر 3",
        accessor: "price3",
        width: 100,
        render: (value: number) => (
          <span className="text-white">{(value || 0).toFixed(2)}</span>
        ),
      },
      {
        id: "sellPrice4",
        header: "سعر 4",
        accessor: "price4",
        width: 100,
        render: (value: number) => (
          <span className="text-white">{(value || 0).toFixed(2)}</span>
        ),
      },
      {
        id: "location",
        header: "الموقع",
        accessor: "location",
        width: 100,
        render: (value: string) => (
          <span className="text-gray-300">{value || "-"}</span>
        ),
      },
      {
        id: "barcode",
        header: "الباركود",
        accessor: "barcode",
        width: 150,
        render: (value: string) => (
          <span className="text-gray-300 font-mono text-sm">
            {value || "-"}
          </span>
        ),
      },
    ];

    // Add dynamic branch quantity columns
    const branchColumns = branches.map((branch) => ({
      id: `branch_${branch.id}`,
      header: branch.name,
      accessor: `branch_${branch.id}`,
      width: 120,
      render: (value: any, item: Product) => {
        const inventoryData = item.inventoryData?.[branch.id];
        const quantity = inventoryData?.quantity || 0;
        return (
          <span className="text-blue-400 font-medium">قطعة {quantity}</span>
        );
      },
    }));

    // Add dynamic branch min stock columns
    const minStockColumns = branches.map((branch) => ({
      id: `min_stock_${branch.id}`,
      header: `منخفض - ${branch.name}`,
      accessor: `min_stock_${branch.id}`,
      width: 150,
      render: (value: any, item: Product) => {
        const inventoryData = item.inventoryData?.[branch.id];
        const minStock = inventoryData?.min_stock || 0;
        const quantity = inventoryData?.quantity || 0;

        // Show warning style if quantity is below or equal to min stock
        const isLowStock = quantity <= minStock && minStock > 0;

        return (
          <span
            className={`font-medium ${isLowStock ? "text-red-400" : "text-yellow-400"}`}
          >
            {minStock} قطعة
          </span>
        );
      },
    }));

    // Add dynamic branch variants columns
    const variantColumns = branches.map((branch) => ({
      id: `variants_${branch.id}`,
      header: `الأشكال والألوان - ${branch.name}`,
      accessor: `variants_${branch.id}`,
      width: 250,
      render: (value: any, item: Product) => {
        const variants = item.variantsData?.[branch.id] || [];
        const colorVariants = variants.filter(
          (v) => v.variant_type === "color",
        );
        const shapeVariants = variants.filter(
          (v) => v.variant_type === "shape",
        );

        // If no color variants from variants table, try to get colors from description
        let descriptionColors: any[] = [];
        if (
          colorVariants.length === 0 &&
          item.productColors &&
          item.productColors.length > 0
        ) {
          descriptionColors = item.productColors.map((color, index) => ({
            name: color.name,
            quantity: Math.floor(
              (item.inventoryData?.[branch.id]?.quantity || 0) /
                (item.productColors?.length || 1),
            ),
            variant_type: "color",
            color: color.color,
          }));
        }

        // Helper function to get variant color
        const getVariantColor = (variant: any) => {
          if (variant.variant_type === "color") {
            // If variant has color property (from description), use it directly
            if (variant.color) {
              return variant.color;
            }

            // Try to find the color from product colors
            const productColor = item.productColors?.find(
              (c) => c.name === variant.name,
            );
            if (productColor?.color) {
              return productColor.color;
            }

            // Try to parse color from variant value if it's JSON
            try {
              if (variant.value && variant.value.startsWith("{")) {
                const valueData = JSON.parse(variant.value);
                if (valueData.color) {
                  return valueData.color;
                }
              }
            } catch (e) {
              // If parsing fails, use default
            }
          }
          return "#6B7280"; // Default gray color
        };

        // Helper function to get text color based on background
        const getTextColor = (bgColor: string) => {
          // Convert hex to RGB
          const hex = bgColor.replace("#", "");
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);

          // Calculate luminance
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

          // Return white for dark colors, black for light colors
          return luminance > 0.5 ? "#000000" : "#FFFFFF";
        };

        // Calculate unassigned quantity
        const totalInventoryQuantity =
          item.inventoryData?.[branch.id]?.quantity || 0;

        // Combine all variants (from database and description)
        const allColorVariants = [...colorVariants, ...descriptionColors];
        const allVariants = [...allColorVariants, ...shapeVariants];

        const assignedQuantity = allVariants.reduce(
          (sum, variant) => sum + variant.quantity,
          0,
        );
        const unassignedQuantity = totalInventoryQuantity - assignedQuantity;

        return (
          <div className="flex flex-wrap gap-1">
            {allVariants.map((variant, index) => {
              const bgColor = getVariantColor(variant);
              const textColor = getTextColor(bgColor);

              return (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border"
                  style={{
                    backgroundColor: bgColor,
                    color: textColor,
                    borderColor: bgColor === "#6B7280" ? "#6B7280" : bgColor,
                  }}
                >
                  {variant.name} ({variant.quantity})
                </span>
              );
            })}

            {/* Show unassigned quantity if any */}
            {unassignedQuantity > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white bg-gray-600 border border-gray-600">
                غير محدد ({unassignedQuantity})
              </span>
            )}
          </div>
        );
      },
    }));

    const activityColumn = {
      id: "activity",
      header: "نشيط",
      accessor: "is_active",
      width: 80,
      render: (value: boolean) => (
        <div className="flex justify-center">
          <div
            className={`w-3 h-3 rounded-full ${value ? "bg-green-500" : "bg-red-500"}`}
          ></div>
        </div>
      ),
    };

    return [
      ...baseColumns,
      ...branchColumns,
      ...minStockColumns,
      ...variantColumns,
      activityColumn,
    ];
  }, [branches]);

  // Get all columns for columns control modal
  const getAllColumns = () => {
    return dynamicTableColumns.map((col) => ({
      id: col.id,
      header: col.header,
      visible: visibleColumns[col.id] !== false,
    }));
  };

  // Load column visibility from localStorage on mount
  useEffect(() => {
    if (posVisibilityLoadedRef.current) return;

    try {
      const savedData = localStorage.getItem(POS_COLUMN_VISIBILITY_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setVisibleColumns(parsed);
        console.log('✅ Loaded POS column visibility from localStorage');
      }
      posVisibilityLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading POS column visibility:', error);
      posVisibilityLoadedRef.current = true;
    }
  }, []);

  // Handle columns visibility change - saves to localStorage
  const handleColumnsChange = useCallback((updatedColumns: any[]) => {
    const newVisibleColumns: { [key: string]: boolean } = {};
    updatedColumns.forEach((col) => {
      newVisibleColumns[col.id] = col.visible;
    });
    setVisibleColumns(newVisibleColumns);

    // Save to localStorage
    try {
      localStorage.setItem(POS_COLUMN_VISIBILITY_KEY, JSON.stringify(newVisibleColumns));
      console.log('✅ Saved POS column visibility to localStorage');
    } catch (error) {
      console.error('Error saving POS column visibility:', error);
    }
  }, []);

  // Filter visible columns
  const visibleTableColumns = dynamicTableColumns.filter(
    (col) => visibleColumns[col.id] !== false,
  );

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleRecordsModal = () => {
    setIsRecordsModalOpen(!isRecordsModalOpen);
  };

  const toggleCustomerModal = () => {
    setIsCustomerModalOpen(!isCustomerModalOpen);
  };

  const toggleBranchModal = () => {
    setIsBranchModalOpen(!isBranchModalOpen);
  };

  const toggleCategoriesModal = () => {
    setIsCategoriesModalOpen(!isCategoriesModalOpen);
  };

  const toggleHistoryModal = () => {
    setIsHistoryModalOpen(!isHistoryModalOpen);
  };

  const handleRecordSelect = (record: any) => {
    setRecord(record);
    setIsRecordsModalOpen(false);
    console.log("Selected record:", record);
  };

  const handleCustomerSelect = (customer: any) => {
    // If we're in main tab, create a new tab with customer name
    // Otherwise, just update the current tab's customer
    if (activeTabId === 'main') {
      // Create new tab with customer, inheriting selections from main tab
      addTabWithCustomer(customer, {
        customer: globalSelections.customer,
        branch: globalSelections.branch,
        record: globalSelections.record,
        priceType: selectedPriceType,
      });
    } else {
      // Update current tab's customer
      setCustomer(customer);
    }
    setIsCustomerModalOpen(false);
    console.log("Selected customer:", customer);
  };

  const handleBranchSelect = (branch: any) => {
    setBranch(branch);
    setIsBranchModalOpen(false);
    console.log("Selected branch:", branch);
  };

  // Categories fetching function
  const fetchCategories = async () => {
    try {
      setIsLoadingCategories(true);
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching categories:", error);
        return;
      }

      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  // OPTIMIZED: Categories real-time subscription with smart updates
  useEffect(() => {
    startRender();
    fetchCategories();
    endRender();

    // Subscribe to real-time changes with optimized handling
    const subscription = supabase
      .channel("categories-realtime-optimized")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        (payload: any) => {
          console.log("Categories change detected:", payload.eventType);
          // Only refetch if necessary
          if (payload.eventType !== "DELETE" || payload.old?.is_active) {
            fetchCategories();
          }
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - fetchCategories and performance monitors are internal

  // Ref to track previous activeTabId for cart sync
  const prevCartSyncTabIdRef = useRef<string | null>(null);

  // Sync cart with active tab - wait for tabs to load from database first
  useEffect(() => {
    // Don't sync until tabs are loaded from database
    if (isLoadingTabs) {
      return;
    }

    // Only sync cart when tab actually changes (not when tab data changes)
    if (prevCartSyncTabIdRef.current === activeTabId) {
      return;
    }
    prevCartSyncTabIdRef.current = activeTabId;

    if (activePOSTab) {
      setCartItems(activePOSTab.cartItems || []);
    }
  }, [activeTabId, activePOSTab, isLoadingTabs]);

  // Ref to track previous activeTabId to only restore on actual tab switch
  const prevActiveTabIdRef = useRef<string | null>(null);

  // Sync modes and selections from active tab after loading
  // Only runs when activeTabId changes (tab switch), not when tab data changes
  useEffect(() => {
    if (isLoadingTabs || !activePOSTab) {
      return;
    }

    // Only restore if we actually switched tabs (not just tab data changed)
    if (prevActiveTabIdRef.current === activeTabId) {
      return;
    }
    prevActiveTabIdRef.current = activeTabId;

    // Restore modes from saved tab
    if (activePOSTab.isPurchaseMode !== undefined) {
      setIsPurchaseMode(activePOSTab.isPurchaseMode);
    }
    if (activePOSTab.isTransferMode !== undefined) {
      setIsTransferMode(activePOSTab.isTransferMode);
    }
    if (activePOSTab.isReturnMode !== undefined) {
      setIsReturnMode(activePOSTab.isReturnMode);
    }
    if (activePOSTab.selectedSupplier !== undefined) {
      setSelectedSupplier(activePOSTab.selectedSupplier);
    }
    if (activePOSTab.selectedWarehouse !== undefined) {
      setSelectedWarehouse(activePOSTab.selectedWarehouse);
    }
    if (activePOSTab.transferFromLocation !== undefined) {
      setTransferFromLocation(activePOSTab.transferFromLocation);
    }
    if (activePOSTab.transferToLocation !== undefined) {
      setTransferToLocation(activePOSTab.transferToLocation);
    }
    // Restore edit mode from saved tab
    setIsEditMode(activePOSTab.isEditMode || false);
    setEditInvoiceData(activePOSTab.editInvoiceData || null);
    // Reset editItemsLoaded when switching tabs to allow loading items for the new tab
    if (!activePOSTab.isEditMode) {
      setEditItemsLoaded(false);
    }

    console.log('POS: Restored modes from tab:', {
      isPurchaseMode: activePOSTab.isPurchaseMode,
      isTransferMode: activePOSTab.isTransferMode,
      isReturnMode: activePOSTab.isReturnMode,
      isEditMode: activePOSTab.isEditMode,
    });
  }, [activeTabId, activePOSTab, isLoadingTabs]);

  // Save modes to tab when they change
  useEffect(() => {
    if (isLoadingTabs || !activePOSTab) {
      return;
    }

    // Only save if modes actually changed from what's in the tab
    const modesChanged =
      activePOSTab.isPurchaseMode !== isPurchaseMode ||
      activePOSTab.isTransferMode !== isTransferMode ||
      activePOSTab.isReturnMode !== isReturnMode ||
      activePOSTab.isEditMode !== isEditMode ||
      JSON.stringify(activePOSTab.editInvoiceData) !== JSON.stringify(editInvoiceData) ||
      JSON.stringify(activePOSTab.selectedSupplier) !== JSON.stringify(selectedSupplier) ||
      JSON.stringify(activePOSTab.selectedWarehouse) !== JSON.stringify(selectedWarehouse) ||
      JSON.stringify(activePOSTab.transferFromLocation) !== JSON.stringify(transferFromLocation) ||
      JSON.stringify(activePOSTab.transferToLocation) !== JSON.stringify(transferToLocation);

    if (modesChanged) {
      updateActiveTabMode({
        isPurchaseMode,
        isTransferMode,
        isReturnMode,
        isEditMode,
        editInvoiceData,
        selectedSupplier,
        selectedWarehouse,
        transferFromLocation,
        transferToLocation,
      });
    }
  }, [isPurchaseMode, isTransferMode, isReturnMode, isEditMode, editInvoiceData, selectedSupplier, selectedWarehouse, transferFromLocation, transferToLocation, isLoadingTabs, activePOSTab, updateActiveTabMode]);

  // OPTIMIZED: Memoized product filtering to prevent unnecessary re-renders
  // Returns Set of matching product IDs for O(1) lookup
  // Now includes both search query AND category filter
  const filteredProductIds = useMemo(() => {
    const hasSearchFilter = !!searchQuery;
    const hasCategoryFilter = selectedCategoryId !== null && categoryFilterIds.size > 0;

    // No filters - show all
    if (!hasSearchFilter && !hasCategoryFilter) return null;

    const query = searchQuery.toLowerCase();
    const matchingIds = new Set<string>();

    products.forEach((product) => {
      // Check search filter
      const matchesSearch = !hasSearchFilter || (
        product.name.toLowerCase().includes(query) ||
        (product.barcode && product.barcode.toLowerCase().includes(query))
      );

      // Check category filter
      const matchesCategory = !hasCategoryFilter || (
        product.category_id && categoryFilterIds.has(product.category_id)
      );

      if (matchesSearch && matchesCategory) {
        matchingIds.add(product.id);
      }
    });
    return matchingIds;
  }, [products, searchQuery, selectedCategoryId, categoryFilterIds]);

  // Helper function to check if product matches search
  const isProductVisible = useCallback((productId: string) => {
    return filteredProductIds === null || filteredProductIds.has(productId);
  }, [filteredProductIds]);

  // For backward compatibility - filtered products array (used for count display etc.)
  const filteredProducts = useMemo(() => {
    const hasSearchFilter = !!searchQuery;
    const hasCategoryFilter = selectedCategoryId !== null && categoryFilterIds.size > 0;

    if (!hasSearchFilter && !hasCategoryFilter) return products;
    return products.filter((p) => filteredProductIds?.has(p.id));
  }, [products, searchQuery, selectedCategoryId, categoryFilterIds, filteredProductIds]);

  // OPTIMIZED: Memoized refresh handler
  const handleRefresh = useCallback(() => {
    fetchProducts();
  }, [fetchProducts]);

  // OPTIMIZED: Preload product images in background for faster rendering
  useEffect(() => {
    if (isLoading || products.length === 0) {
      return;
    }

    // Extract all image URLs from products
    const imageUrls = products.map(p => p.main_image_url).filter(Boolean);

    // Preload in background without blocking UI
    preloadImagesInBackground(imageUrls, () => {
      const stats = getPreloadStats();
      console.log(`POS: Preloaded ${stats.preloaded} images in background`);
    });
  }, [products, isLoading]);

  // Close tab context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (tabContextMenu) {
        setTabContextMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [tabContextMenu]);

  // Helper function to get product price based on selected price type
  // لو السعر مش موجود بيرجع 0 مش سعر البيع - علشان المستخدم يلاحظ إن السعر ناقص
  const getProductPriceByType = useCallback((product: any): number => {
    if (!product) return 0;
    switch (selectedPriceType) {
      case "price":
        return product.price || 0;
      case "wholesale_price":
        return product.wholesale_price || 0;
      case "price1":
        return product.price1 || 0;
      case "price2":
        return product.price2 || 0;
      case "price3":
        return product.price3 || 0;
      case "price4":
        return product.price4 || 0;
      default:
        return product.price || 0;
    }
  }, [selectedPriceType]);

  // OPTIMIZED: Memoized POS Cart Functions
  const handleAddToCart = useCallback(
    (product: any, quantity: number, selectedColor?: string) => {
      console.log("Adding to cart:", {
        productId: product.id,
        quantity,
        selectedColor,
      });

      setCartItems((prev) => {
        const existingItemIndex = prev.findIndex(
          (item) => item.product.id === product.id,
        );

        let newCart;
        if (existingItemIndex >= 0) {
          // Product already exists in cart
          const newCartItems = [...prev];
          const existingItem = { ...newCartItems[existingItemIndex] };

          if (selectedColor) {
            // Initialize selectedColors if it doesn't exist
            if (!existingItem.selectedColors) {
              existingItem.selectedColors = {};
            }

            // Add or update color quantity
            existingItem.selectedColors[selectedColor] =
              (existingItem.selectedColors[selectedColor] || 0) + quantity;

            // Recalculate total quantity from all colors
            existingItem.quantity = Object.values(
              existingItem.selectedColors,
            ).reduce(
              (total: number, colorQty) => total + (colorQty as number),
              0,
            );
          } else {
            existingItem.quantity += quantity;
          }

          // Update total price
          existingItem.total = existingItem.price * existingItem.quantity;

          newCartItems[existingItemIndex] = existingItem;
          newCart = newCartItems;
        } else {
          // New product - create new cart item
          // في وضع الشراء نستخدم cost_price، وإلا نستخدم السعر المحدد
          const productPrice = isPurchaseMode
            ? (product.cost_price || 0)
            : getProductPriceByType(product);
          const newCartItem = {
            id: product.id.toString(),
            product: product,
            quantity: quantity,
            price: productPrice,
            total: productPrice * quantity,
            selectedColors: selectedColor
              ? { [selectedColor]: quantity }
              : undefined,
            color: selectedColor || null,
          };

          newCart = [...prev, newCartItem];
        }

        // Update active tab cart
        updateActiveTabCart(newCart);
        return newCart;
      });
    },
    [updateActiveTabCart, getProductPriceByType, isPurchaseMode],
  );

  // OPTIMIZED: Remove from Cart
  const removeFromCart = useCallback((itemId: string) => {
    setCartItems((prev) => {
      const newCart = prev.filter((item) => item.id !== itemId);
      updateActiveTabCart(newCart);
      return newCart;
    });
  }, [updateActiveTabCart]);

  // OPTIMIZED: Clear Cart
  const clearCart = useCallback(() => {
    setCartItems([]);
    clearActiveTabCart();
    // Reset discount when clearing cart
    setCartDiscount(0);
    setCartDiscountType("percentage");
  }, [clearActiveTabCart]);

  // Discount Functions
  const handleApplyItemDiscount = useCallback((itemId: string, discount: number, discountType: "percentage" | "fixed") => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, discount, discountType }
          : item
      )
    );
  }, []);

  const handleApplyCartDiscount = useCallback((discount: number, discountType: "percentage" | "fixed") => {
    setCartDiscount(discount);
    setCartDiscountType(discountType);
  }, []);

  const handleRemoveItemDiscount = useCallback((itemId: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, discount: undefined, discountType: undefined }
          : item
      )
    );
  }, []);

  const handleRemoveCartDiscount = useCallback(() => {
    setCartDiscount(0);
    setCartDiscountType("percentage");
  }, []);

  // Calculate total with discounts
  const calculateTotalWithDiscounts = useCallback(() => {
    // First calculate items total with item-level discounts
    let itemsTotal = cartItems.reduce((sum, item) => {
      let itemTotal = item.price * item.quantity;
      if (item.discount) {
        if (item.discountType === "percentage") {
          itemTotal -= (itemTotal * item.discount) / 100;
        } else {
          itemTotal -= item.discount;
        }
      }
      return sum + Math.max(0, itemTotal);
    }, 0);

    // Then apply cart-level discount
    if (cartDiscount > 0) {
      if (cartDiscountType === "percentage") {
        itemsTotal -= (itemsTotal * cartDiscount) / 100;
      } else {
        itemsTotal -= cartDiscount;
      }
    }

    return Math.max(0, itemsTotal);
  }, [cartItems, cartDiscount, cartDiscountType]);

  const handleColorSelection = async (
    selections: { [key: string]: number },
    totalQuantity: number,
    purchasePricingData?: {
      purchasePrice: number;
      salePrice: number;
      wholesalePrice: number;
      price1: number;
      price2: number;
      price3: number;
      price4: number;
      productCode: string;
    },
  ) => {
    if (!modalProduct) return;

    // في وضع الشراء، تحديث بيانات المنتج في قاعدة البيانات
    if (isPurchaseMode && purchasePricingData) {
      try {
        const { error } = await supabase
          .from('products')
          .update({
            price: purchasePricingData.salePrice,
            wholesale_price: purchasePricingData.wholesalePrice,
            price1: purchasePricingData.price1,
            price2: purchasePricingData.price2,
            price3: purchasePricingData.price3,
            price4: purchasePricingData.price4,
            product_code: purchasePricingData.productCode || null,
          })
          .eq('id', modalProduct.id);

        if (error) {
          console.error('خطأ في تحديث أسعار المنتج:', error);
        } else {
          console.log('✅ تم تحديث أسعار المنتج بنجاح');
        }
      } catch (err) {
        console.error('خطأ في تحديث أسعار المنتج:', err);
      }
    }

    const productWithPrice = {
      ...modalProduct,
      price:
        isPurchaseMode && purchasePricingData?.purchasePrice !== undefined
          ? purchasePricingData.purchasePrice
          : getProductPriceByType(modalProduct),
    };

    // البحث عن المنتج في السلة
    const existingItemIndex = cartItems.findIndex(
      (item) => item.product.id === modalProduct.id,
    );

    if (existingItemIndex >= 0) {
      // المنتج موجود - تحديثه
      setCartItems((prev) => {
        const newCartItems = [...prev];
        const existingItem = { ...newCartItems[existingItemIndex] };

        // تحديث الكميات والألوان المحددة
        existingItem.quantity = totalQuantity;
        existingItem.selectedColors =
          Object.keys(selections).length > 0 ? selections : null;
        existingItem.total = productWithPrice.price * totalQuantity;

        newCartItems[existingItemIndex] = existingItem;
        updateActiveTabCart(newCartItems);
        return newCartItems;
      });
    } else {
      // منتج جديد - إضافته
      const newCartItem = {
        id: productWithPrice.id.toString(),
        product: productWithPrice,
        quantity: totalQuantity,
        selectedColors: Object.keys(selections).length > 0 ? selections : null,
        price: productWithPrice.price || 0,
        total: (productWithPrice.price || 0) * totalQuantity,
      };

      setCartItems((prev) => {
        const newCart = [...prev, newCartItem];
        updateActiveTabCart(newCart);
        return newCart;
      });
    }

    // إغلاق النافذة
    setShowColorSelectionModal(false);
    setModalProduct(null);

    // مسح البحث وإعادة التركيز على حقل البحث
    setSearchQuery("");
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleProductClick = (product: any) => {
    // Check if required selections are made before allowing cart operations
    if (isPurchaseMode) {
      if (!selectedSupplier || !selectedWarehouse || !selections.record) {
        alert("يجب تحديد المورد والمخزن والخزنة أولاً قبل إضافة المنتجات للسلة");
        return;
      }
    } else if (isTransferMode) {
      if (!transferFromLocation || !transferToLocation) {
        alert("يجب تحديد مصدر ووجهة النقل أولاً");
        return;
      }
      // Handle transfer mode product selection
      handleTransferProductClick(product);
      return;
    } else {
      if (!hasRequiredForCart()) {
        alert("يجب تحديد الفرع أولاً قبل إضافة المنتجات للسلة");
        return;
      }
    }

    setModalProduct(product);

    // عرض نافذة اختيار الألوان دائماً
    // ستتعامل النافذة مع عرض الألوان أو إخفائها حسب المنتج
    setShowColorSelectionModal(true);
  };

  // Calculate cart total from CartContext items
  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItems]);

  // Handle invoice creation
  const handleCreateInvoice = async () => {
    // Validate based on current mode
    if (isTransferMode) {
      if (!transferFromLocation || !transferToLocation) {
        alert("يجب تحديد مصدر ووجهة النقل قبل تأكيد النقل");
        return;
      }
      if (!selections.record) {
        alert("يجب تحديد الخزنة أولاً قبل إنشاء فاتورة النقل");
        return;
      }
    } else if (isPurchaseMode) {
      if (!hasRequiredForPurchase()) {
        alert("يجب تحديد الخزنة والمورد والمخزن قبل تأكيد الطلب");
        return;
      }
    } else {
      if (!hasRequiredForSale()) {
        alert("يجب تحديد الخزنة والعميل والفرع قبل تأكيد الطلب");
        return;
      }

      // حساب إجمالي المبلغ المدفوع من بيانات تقسيم الدفع
      const totalPaid = paymentSplitData.reduce((sum, p) => sum + (p.amount || 0), 0);
      const isDefaultCustomer = selections.customer?.id === '00000000-0000-0000-0000-000000000001';

      // التحقق من صحة المدفوعات للعميل الافتراضي
      if (isDefaultCustomer) {
        // العميل الافتراضي: المبلغ المدفوع يجب أن يساوي قيمة الفاتورة بالضبط
        if (totalPaid < cartTotal) {
          alert('العميل الافتراضي لا يقبل البيع بالآجل - يجب دفع قيمة الفاتورة كاملة');
          return;
        }
        if (totalPaid > cartTotal) {
          alert('المبلغ المدفوع أعلى من قيمة الفاتورة - العميل الافتراضي يقبل الدفع بقيمة الفاتورة فقط');
          return;
        }
      } else {
        // العملاء العاديين: يمكنهم الدفع أكثر من الفاتورة بشرط أن لا يتجاوز رصيدهم
        const customerBalance = selections.customer?.credit_balance || selections.customer?.calculatedBalance || 0;
        // الحد الأقصى للدفع = قيمة الفاتورة + رصيد العميل (ما عليه)
        const maxPaymentAllowed = cartTotal + customerBalance;

        if (totalPaid > maxPaymentAllowed) {
          alert(`المبلغ المدفوع (${totalPaid.toFixed(0)}) أعلى من رصيد العميل (${customerBalance.toFixed(0)}) + قيمة الفاتورة (${cartTotal.toFixed(0)})`);
          return;
        }
      }
    }

    // In edit mode, allow empty cart (user might want to delete all items)
    const tabIsEditModeCheck = activePOSTab?.isEditMode || false;
    if (cartItems.length === 0 && !tabIsEditModeCheck) {
      const emptyCartMessage = isTransferMode
        ? "لا يمكن إنشاء فاتورة نقل بدون منتجات"
        : isReturnMode
          ? isPurchaseMode
            ? "لا يمكن إنشاء مرتجع شراء بدون منتجات"
            : "لا يمكن إنشاء مرتجع بيع بدون منتجات"
          : isPurchaseMode
            ? "لا يمكن إنشاء فاتورة شراء بدون منتجات"
            : "لا يمكن إنشاء فاتورة بدون منتجات";
      alert(emptyCartMessage);
      return;
    }

    setIsProcessingInvoice(true);

    try {
      // Handle Edit Mode - Update existing invoice
      // Use tab's edit mode state directly to avoid sync issues
      const tabIsEditMode = activePOSTab?.isEditMode || false;
      const tabEditInvoiceData = activePOSTab?.editInvoiceData || null;

      if (tabIsEditMode && tabEditInvoiceData) {
        const saleId = tabEditInvoiceData.saleId;

        // Get the original sale total
        const { data: originalSale } = await supabase
          .from('sales')
          .select('total_amount, customer_id')
          .eq('id', saleId)
          .single();

        const originalTotal = originalSale?.total_amount || 0;

        // Calculate new total from cart
        const newTotal = cartItems.reduce((sum, item) => {
          const itemTotal = item.totalPrice || (item.price * item.quantity);
          return sum + itemTotal;
        }, 0);

        // Delete old sale items
        const { error: deleteError } = await supabase
          .from('sale_items')
          .delete()
          .eq('sale_id', saleId);

        if (deleteError) {
          throw new Error(`خطأ في حذف المنتجات القديمة: ${deleteError.message}`);
        }

        // Insert new sale items
        const newSaleItems = cartItems.map(item => ({
          sale_id: saleId,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.price,
          cost_price: item.product.cost_price || 0,
          discount: item.discount || 0,
          notes: ''
        }));

        const { error: insertError } = await supabase
          .from('sale_items')
          .insert(newSaleItems);

        if (insertError) {
          throw new Error(`خطأ في إضافة المنتجات الجديدة: ${insertError.message}`);
        }

        // Update sale total
        const { error: updateError } = await supabase
          .from('sales')
          .update({
            total_amount: newTotal
          })
          .eq('id', saleId);

        if (updateError) {
          throw new Error(`خطأ في تحديث الفاتورة: ${updateError.message}`);
        }

        // Calculate the difference and update customer balance
        const totalDifference = newTotal - originalTotal;
        if (originalSale?.customer_id && totalDifference !== 0) {
          // Get current customer balance
          const { data: customerData } = await supabase
            .from('customers')
            .select('account_balance')
            .eq('id', originalSale.customer_id)
            .single();

          if (customerData) {
            const newBalance = (customerData.account_balance || 0) + totalDifference;
            await supabase
              .from('customers')
              .update({ account_balance: newBalance })
              .eq('id', originalSale.customer_id);
          }
        }

        // تحديث رصيد الخزنة عند تعديل الفاتورة
        if (totalDifference !== 0) {
          // جلب معاملة الخزنة الأصلية لهذه الفاتورة
          const { data: originalTransaction } = await supabase
            .from('cash_drawer_transactions')
            .select('id, drawer_id, amount, record_id')
            .eq('sale_id', saleId)
            .eq('transaction_type', 'sale')
            .single();

          if (originalTransaction) {
            // جلب رصيد الخزنة الحالي
            const { data: drawer } = await supabase
              .from('cash_drawers')
              .select('id, current_balance')
              .eq('id', originalTransaction.drawer_id)
              .single();

            if (drawer) {
              // تحديث رصيد الخزنة بالفرق
              const newDrawerBalance = (drawer.current_balance || 0) + totalDifference;

              await supabase
                .from('cash_drawers')
                .update({
                  current_balance: newDrawerBalance,
                  updated_at: new Date().toISOString()
                })
                .eq('id', drawer.id);

              // تحديث المعاملة الأصلية بالمبلغ الجديد
              await supabase
                .from('cash_drawer_transactions')
                .update({
                  amount: originalTransaction.amount + totalDifference,
                  balance_after: newDrawerBalance
                })
                .eq('id', originalTransaction.id);

              // إضافة سجل تعديل الفاتورة
              await supabase
                .from('cash_drawer_transactions')
                .insert({
                  drawer_id: drawer.id,
                  record_id: originalTransaction.record_id,
                  transaction_type: 'invoice_edit',
                  amount: totalDifference,
                  balance_after: newDrawerBalance,
                  sale_id: saleId,
                  notes: `تعديل فاتورة رقم ${tabEditInvoiceData.invoiceNumber} - الفرق: ${totalDifference}`,
                  performed_by: 'system'
                });

              console.log(`✅ Cash drawer updated after edit: ${totalDifference >= 0 ? '+' : ''}${totalDifference}, new balance: ${newDrawerBalance}`);
            }
          }
        }

        // Success! Show message
        alert(`تم تعديل الفاتورة رقم ${tabEditInvoiceData.invoiceNumber} بنجاح`);

        // Clear cart and close the edit tab
        clearCart();

        // Clean URL params (remove edit mode params)
        const url = new URL(window.location.href);
        url.searchParams.delete('edit');
        url.searchParams.delete('saleId');
        window.history.replaceState({}, '', url.toString());

        // Close the current edit tab (returns to main tab or previous tab)
        if (activeTabId !== 'main') {
          closeTab(activeTabId);
        }

        return;
      }

      if (isTransferMode) {
        // Handle transfer invoice creation
        // Transform cartItems to match TransferCartItem interface
        const transferCartItems = cartItems.map((item) => ({
          id: item.id,
          product: item.product || { name: "Unknown Product" },
          quantity: item.quantity,
          selectedColors: item.selected_color
            ? { [item.selected_color]: item.quantity }
            : undefined,
          isTransfer: true,
        }));

        const transferInvoice = await createTransferInvoice({
          cartItems: transferCartItems,
          transferFromLocation,
          transferToLocation,
          record: selections.record,
        });

        // Store transfer invoice data for printing (with orange theme)
        setLastInvoiceData({
          invoiceNumber: transferInvoice.invoiceNumber,
          totalAmount: 0, // No amount in transfer
          cartItems: cartItems,
          isTransfer: true,
          date: new Date(),
          fromLocation: transferFromLocation,
          toLocation: transferToLocation,
          transferType: "transfer",
        });

        // Show print confirmation modal
        setShowPrintReceiptModal(true);

        // Clear cart and exit transfer mode
        clearCart();
        exitTransferMode();
      } else if (isPurchaseMode) {
        // Handle purchase invoice creation (or return)
        // Transform cartItems to match sales invoice CartItem interface
        const purchaseCartItems = cartItems.map((item) => ({
          id: item.id,
          product: item.product || { name: "Unknown Product" },
          quantity: item.quantity,
          selectedColors: item.selected_color
            ? { [item.selected_color]: item.quantity }
            : null,
          price: item.price,
          total: item.price * item.quantity,
        }));

        const result = await createPurchaseInvoice({
          cartItems: purchaseCartItems,
          selections: {
            supplier: selectedSupplier,
            warehouse: selectedWarehouse,
            record: selections.record,
          },
          paymentMethod: "cash",
          notes: isReturnMode
            ? `مرتجع شراء - ${cartItems.length} منتج`
            : `فاتورة شراء - ${cartItems.length} منتج`,
          isReturn: isReturnMode, // Pass return mode flag
        });

        // Store invoice data for printing
        setLastInvoiceData({
          invoiceNumber: result.invoiceNumber,
          totalAmount: result.totalAmount,
          cartItems: cartItems,
          isReturn: isReturnMode,
          isPurchaseMode: true,
          date: new Date(),
          supplier: selectedSupplier,
          warehouse: selectedWarehouse,
          record: selections.record,
        });

        // Show print confirmation modal
        setShowPrintReceiptModal(true);
      } else {
        // Handle sales invoice creation (or return)
        // Transform cartItems to match sales invoice CartItem interface
        const salesCartItems = cartItems.map((item) => ({
          id: item.id,
          product: item.product || { name: "Unknown Product" },
          quantity: item.quantity,
          selectedColors: item.selected_color
            ? { [item.selected_color]: item.quantity }
            : null,
          price: item.price,
          total: item.price * item.quantity,
        }));

        const result = await createSalesInvoice({
          cartItems: salesCartItems,
          selections: {
            customer: selections.customer,
            branch: selections.branch,
            record: selections.record,
          },
          paymentMethod: "cash",
          notes: isReturnMode
            ? `مرتجع بيع - ${cartItems.length} منتج`
            : `فاتورة بيع - ${cartItems.length} منتج`,
          isReturn: isReturnMode, // Pass return mode flag
          paymentSplitData: paymentSplitData, // Pass payment split data
          creditAmount: creditAmount, // Pass credit amount
          userId: user?.id || null, // Pass current user ID for tracking
          userName: user?.name || null, // Pass current user name for performed_by
        });

        // Fetch customer's updated data and calculate balance after invoice creation
        let customerForReceipt = selections.customer;
        let calculatedBalance = 0;
        if (selections.customer && selections.customer.id !== '00000000-0000-0000-0000-000000000001') {
          // Fetch customer basic info
          const { data: customerData } = await supabase
            .from('customers')
            .select('id, name, phone, address, city')
            .eq('id', selections.customer.id)
            .single();

          // Calculate customer balance from sales and payments
          const [salesRes, paymentsRes] = await Promise.all([
            supabase
              .from('sales')
              .select('total_amount')
              .eq('customer_id', selections.customer.id),
            supabase
              .from('customer_payments')
              .select('amount')
              .eq('customer_id', selections.customer.id)
          ]);

          const salesTotal = (salesRes.data || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);
          const paymentsTotal = (paymentsRes.data || []).reduce((sum, p) => sum + (p.amount || 0), 0);
          calculatedBalance = salesTotal - paymentsTotal;

          if (customerData) {
            customerForReceipt = { ...selections.customer, ...customerData, calculatedBalance };
          } else {
            customerForReceipt = { ...selections.customer, calculatedBalance };
          }
        }

        // Store invoice data for printing
        setLastInvoiceData({
          invoiceNumber: result.invoiceNumber,
          totalAmount: result.totalAmount,
          cartItems: cartItems,
          isReturn: isReturnMode,
          isPurchaseMode: false,
          date: new Date(),
          customer: customerForReceipt,
          branch: selections.branch,
          record: selections.record,
          paymentSplitData: paymentSplitData,
          creditAmount: creditAmount,
        });

        // Show print confirmation modal
        setShowPrintReceiptModal(true);
      }

      // Clear cart after successful invoice creation
      clearCart();

      // Reset paid amount (change calculator)
      setPaidAmount("");

      // Close tab if not the main tab
      if (activeTabId !== 'main') {
        closeTab(activeTabId);
      }

      // Reset to default customer after sales (not purchase or transfer)
      if (!isPurchaseMode && !isTransferMode) {
        await resetToDefaultCustomer();
        // Reset price type to default (سعر البيع) after invoice
        setSelectedPriceType("price");
      }

      // Exit return mode after successful return
      if (isReturnMode) {
        setIsReturnMode(false);
      }

      // Refresh products to update inventory
      handleRefresh();
    } catch (error: any) {
      console.error("Invoice creation error:", error);
      console.error("Cart items at time of error:", cartItems);
      console.error("Selections at time of error:", {
        customer: selections.customer,
        branch: selections.branch,
        record: selections.record,
      });

      const errorType = isReturnMode
        ? isPurchaseMode
          ? "مرتجع الشراء"
          : "مرتجع البيع"
        : isPurchaseMode
          ? "فاتورة الشراء"
          : "الفاتورة";
      alert(`خطأ في إنشاء ${errorType}: ${error.message}`);
    } finally {
      setIsProcessingInvoice(false);
    }
  };

  // Y keyboard shortcut to confirm order
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' ||
                             activeElement?.tagName === 'TEXTAREA' ||
                             activeElement?.getAttribute('contenteditable') === 'true';

      if ((e.key === 'y' || e.key === 'Y') && !isInputFocused) {
        e.preventDefault();
        e.stopPropagation();
        handleCreateInvoice();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  });

  // Purchase Mode Functions
  const handlePurchaseModeToggle = () => {
    // دائماً افتح نافذة اختيار المورد لإضافة نافذة شراء جديدة
    // حتى لو كان وضع الشراء مفعل بالفعل، يمكن فتح نوافذ شراء متعددة
    setIsSupplierModalForNewPurchase(true);
    setIsSupplierModalOpen(true);
  };

  const confirmPurchaseMode = () => {
    setIsPurchaseMode(true);
    setShowPurchaseModeConfirm(false);
    // Clear existing selections when switching to purchase mode
    clearSelections();
    clearCart();
  };

  const cancelPurchaseMode = () => {
    setShowPurchaseModeConfirm(false);
  };

  const exitPurchaseMode = () => {
    setIsPurchaseMode(false);
    setIsReturnMode(false); // Also exit return mode
    clearSelections();
    clearCart();
  };

  // Handler لاختيار المورد وتفعيل وضع الشراء
  const handleSupplierSelectForPurchase = (supplier: any) => {
    // تفعيل وضع الشراء
    setIsPurchaseMode(true);
    setSelectedSupplier(supplier);

    // إنشاء tab جديد باسم المورد
    const tabName = supplier.name;
    addTab(tabName, {
      customer: null,
      branch: globalSelections.branch,
      record: globalSelections.record,
      priceType: 'cost_price',
      isPurchaseMode: true,
      selectedSupplier: supplier,
    });

    // إغلاق نافذة المورد وإعادة تعيين الـ flag
    setIsSupplierModalOpen(false);
    setIsSupplierModalForNewPurchase(false);
  };

  // Handler لتغيير المورد في وضع الشراء (بدون فتح tab جديد)
  const handleSupplierChange = (supplier: any) => {
    setSelectedSupplier(supplier);
    setIsSupplierModalOpen(false);
    setIsSupplierModalForNewPurchase(false);
  };

  // Transfer Mode Functions
  const handleTransferModeToggle = () => {
    // Clear existing modes and cart when starting transfer mode
    setIsPurchaseMode(false);
    setIsReturnMode(false);
    clearCart();

    // Reset transfer locations
    setTransferFromLocation(null);
    setTransferToLocation(null);

    // Open transfer location selection modal
    setIsTransferLocationModalOpen(true);
  };

  const handleTransferLocationConfirm = (
    fromLocation: any,
    toLocation: any,
  ) => {
    setTransferFromLocation(fromLocation);
    setTransferToLocation(toLocation);
    setIsTransferMode(true);
    setIsTransferLocationModalOpen(false);
  };

  const exitTransferMode = () => {
    setIsTransferMode(false);
    setTransferFromLocation(null);
    setTransferToLocation(null);
    clearCart();
  };

  const handleTransferProductClick = async (product: any) => {
    setModalProduct(product);

    console.log("نقل المنتج:", product);
    console.log("من:", transferFromLocation);
    console.log("إلى:", transferToLocation);

    // Always use ColorSelectionModal for consistency in transfer mode
    // This modal will handle products with or without colors properly
    setShowColorSelectionModal(true);
  };

  const toggleSupplierModal = () => {
    setIsSupplierModalOpen(!isSupplierModalOpen);
  };

  const toggleWarehouseModal = () => {
    setIsWarehouseModalOpen(!isWarehouseModalOpen);
  };

  const handleQuickAddProduct = (product: any) => {
    setSelectedProduct(product);
    setShowQuickAddProductModal(true);
  };

  const handleQuickAddToCart = (productData: any) => {
    // Use the main handleAddToCart function to ensure consistent grouping
    handleAddToCart(productData, productData.quantity);

    // مسح البحث وإعادة التركيز على حقل البحث
    setSearchQuery("");
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  // Check if all required selections are made for purchase mode
  const hasRequiredForPurchase = () => {
    return selectedSupplier && selectedWarehouse && selections.record;
  };

  // Check if all required selections are made (works for both modes)
  const hasAllRequiredSelections = () => {
    // In edit mode, skip validation - the original invoice already had valid selections
    // User is just modifying items, not creating a new invoice
    if (activePOSTab?.isEditMode) {
      return true;
    }

    if (isTransferMode) {
      return transferFromLocation && transferToLocation && selections.record;
    } else if (isPurchaseMode) {
      return hasRequiredForPurchase();
    } else {
      return hasRequiredForSale();
    }
  };

  // Helper function to convert numbers to Arabic words
  const numberToArabicWords = (num: number): string => {
    if (num === 0) return 'صفر';

    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
    const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];

    let result = '';
    const intNum = Math.floor(num);

    // Thousands
    const thousands = Math.floor(intNum / 1000);
    if (thousands > 0) {
      if (thousands === 1) result += 'ألف';
      else if (thousands === 2) result += 'ألفان';
      else if (thousands >= 3 && thousands <= 10) result += ones[thousands] + ' آلاف';
      else result += numberToArabicWords(thousands) + ' ألف';
      result += ' و';
    }

    const remainder = intNum % 1000;
    const hundredsDigit = Math.floor(remainder / 100);
    const tensRemainder = remainder % 100;
    const tensDigit = Math.floor(tensRemainder / 10);
    const onesDigit = tensRemainder % 10;

    // Hundreds
    if (hundredsDigit > 0) {
      result += hundreds[hundredsDigit];
      if (tensRemainder > 0) result += ' و';
    }

    // Tens and ones
    if (tensRemainder >= 10 && tensRemainder < 20) {
      result += teens[tensRemainder - 10];
    } else {
      if (tensDigit > 0) {
        result += tens[tensDigit];
        if (onesDigit > 0) result += ' و';
      }
      if (onesDigit > 0) {
        result += ones[onesDigit];
      }
    }

    return result.trim().replace(/\s*و$/, '');
  };

  // Print Receipt Function
  const printReceipt = (invoiceData?: any) => {
    const dataToUse = invoiceData || lastInvoiceData;
    if (!dataToUse) {
      alert("لا توجد بيانات فاتورة للطباعة");
      return;
    }

    // Create receipt content based on the image format
    const receiptContent = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>فاتورة رقم ${dataToUse.invoiceNumber}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Arial', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              font-size: 13px;
              line-height: 1.3;
              color: #000;
              background: white;
              width: 100%;
              margin: 0;
              padding: 0;
            }
            
            .receipt-header {
              text-align: center;
              margin-bottom: 3px;
              padding: 0 2px;
            }
            
            .company-logo {
              width: 60px;
              height: auto;
              margin: 0 auto 4px auto;
              display: block;
              max-height: 60px;
              object-fit: contain;
            }
            
            .company-logo-fallback {
              display: none;
            }
            
            .company-name {
              font-size: 18px;
              font-weight: 700;
              margin-bottom: 2px;
              color: #000;
            }
            
            .receipt-date {
              font-size: 11px;
              margin-bottom: 1px;
            }
            
            .receipt-address {
              font-size: 10px;
              margin-bottom: 1px;
            }
            
            .receipt-phone {
              font-size: 10px;
            }

            .customer-info {
              margin: 10px 20px;
              padding: 8px;
              border: 1px dashed #333;
              background-color: #f9f9f9;
            }

            .customer-row {
              display: flex;
              justify-content: space-between;
              padding: 2px 0;
              font-size: 11px;
            }

            .customer-label {
              font-weight: 600;
              color: #333;
            }

            .customer-value {
              color: #000;
            }

            .items-table {
              width: calc(100% - 40px);
              border-collapse: collapse;
              margin: 3px 20px;
              border: 1px solid #000;
              table-layout: fixed; /* Forces table to use full width */
            }
            
            .items-table th,
            .items-table td {
              border: 1px solid #000;
              padding: 7px;
              text-align: center;
              font-size: 14px;
              font-weight: 400;
            }
            
            .items-table th {
              background-color: #f5f5f5;
              font-weight: 600;
              font-size: 14px;
            }
            
            /* Column width optimization for 80mm thermal paper */
            .items-table th:nth-child(1),
            .items-table td:nth-child(1) {
              width: 45%; /* Item name - reduced slightly */
            }
            
            .items-table th:nth-child(2),
            .items-table td:nth-child(2) {
              width: 12%; /* Quantity - reduced slightly */
            }
            
            .items-table th:nth-child(3),
            .items-table td:nth-child(3) {
              width: 18%; /* Price - same */
            }
            
            .items-table th:nth-child(4),
            .items-table td:nth-child(4) {
              width: 25%; /* Total - increased for full visibility */
              text-align: right !important; /* Align value column to the right */
              padding-right: 4px !important;
            }

            .item-name {
              text-align: right !important;
              padding-right: 12px !important;
              padding-left: 2px !important;
              font-size: 15px;
              font-weight: bold;
              word-wrap: break-word;
              white-space: normal;
              overflow-wrap: break-word;
            }
            
            .total-row {
              border-top: 2px solid #000;
              font-weight: 700;
              font-size: 12px;
            }
            
            .payment-section {
              margin-top: 8px;
              text-align: center;
              font-size: 11px;
              padding: 0 2px;
            }
            
            .payment-table {
              width: calc(100% - 40px);
              border-collapse: collapse;
              margin: 5px 20px;
              border: 1px solid #000;
            }
            
            .payment-table th,
            .payment-table td {
              border: 1px solid #000;
              padding: 4px;
              text-align: center;
              font-size: 11px;
            }
            
            .footer {
              text-align: center;
              margin-top: 8px;
              font-size: 9px;
              border-top: 1px solid #000;
              padding: 3px 2px 0 2px;
            }
            
            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }
              
              body {
                width: 80mm !important;
                max-width: 80mm !important;
                margin: 0 !important;
                padding: 0 1.5mm !important;
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              .company-logo {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              .no-print {
                display: none;
              }
              
              .items-table {
                margin: 3px 0;
                width: 100% !important;
              }
              
              .items-table th,
              .items-table td {
                padding: 2px;
              }
              
              /* Ensure no containers limit width */
              * {
                max-width: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <img
              src="${logoUrl || (window.location.origin + '/assets/logo/Hegazy.png')}"
              alt="${companyName}"
              class="company-logo"
              onerror="this.style.display='none'; document.querySelector('.company-logo-fallback').style.display='block';"
            />
            <div class="company-logo-fallback" style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 4px;">🏢</div>
            <div class="company-name">${companyName}</div>
            <div class="receipt-date">${new Date().toLocaleDateString("ar-EG")} - ${new Date().toLocaleDateString("en-US")}</div>
            <div class="receipt-address">${selections.branch?.name || "الفرع الرئيسي"}</div>
            <div class="receipt-phone">${selections.branch?.phone || "01102862856"}</div>
          </div>

          ${
            // Show customer info for non-default customers only (if they have at least one field)
            dataToUse.customer &&
            dataToUse.customer.id !== '00000000-0000-0000-0000-000000000001' &&
            (dataToUse.customer.name || dataToUse.customer.phone || dataToUse.customer.address || dataToUse.customer.city)
              ? `
          <div class="customer-info">
            ${dataToUse.customer.name ? `<div class="customer-row"><span class="customer-label">العميل:</span> <span class="customer-value">${dataToUse.customer.name}</span></div>` : ''}
            ${dataToUse.customer.phone ? `<div class="customer-row"><span class="customer-label">الهاتف:</span> <span class="customer-value">${dataToUse.customer.phone}</span></div>` : ''}
            ${dataToUse.customer.address ? `<div class="customer-row"><span class="customer-label">العنوان:</span> <span class="customer-value">${dataToUse.customer.address}</span></div>` : ''}
            ${dataToUse.customer.city ? `<div class="customer-row"><span class="customer-label">المدينة:</span> <span class="customer-value">${dataToUse.customer.city}</span></div>` : ''}
          </div>
              `
              : ''
          }

          <table class="items-table">
            <thead>
              <tr>
                <th class="item-name">الصنف</th>
                <th>كمية</th>
                <th>سعر</th>
                <th>قيمة</th>
              </tr>
            </thead>
            <tbody>
              ${dataToUse.cartItems
                .map(
                  (item: any) => `
                <tr>
                  <td class="item-name">${item.product.name}</td>
                  <td>${item.quantity}</td>
                  <td>${item.price.toFixed(0)}</td>
                  <td>${(item.price * item.quantity).toFixed(0)}</td>
                </tr>
              `,
                )
                .join("")}
              <tr class="total-row">
                <td class="item-name">-</td>
                <td>${dataToUse.cartItems.length}</td>
                <td>= اجمالي =</td>
                <td>${dataToUse.totalAmount.toFixed(0)}</td>
              </tr>
            </tbody>
          </table>

          ${
            // Only show payment section for customers with accounts (not default cash customer) AND if there is credit amount
            dataToUse.customer &&
            dataToUse.customer.id !== '00000000-0000-0000-0000-000000000001' &&
            (dataToUse.creditAmount || 0) > 0
              ? `
          <div class="payment-section">
            ${numberToArabicWords(dataToUse.totalAmount)} جنيهاً

            <table class="payment-table">
              <tr>
                <th>مدفوع</th>
                <th>مدين من الفاتورة</th>
                <th>إجمالي الدين</th>
              </tr>
              <tr>
                <td>${(dataToUse.totalAmount - (dataToUse.creditAmount || 0)).toFixed(0)}</td>
                <td>${(dataToUse.creditAmount || 0).toFixed(0)}</td>
                <td>${(dataToUse.customer?.calculatedBalance || 0).toFixed(0)}</td>
              </tr>
            </table>
          </div>
              `
              : ''
          }

          <div class="footer">
            ${new Date().toLocaleDateString("en-GB")} ${new Date().toLocaleTimeString("en-GB", { hour12: false })} by: ${selections.record?.name || "kassem"}
          </div>

          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">طباعة</button>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">إغلاق</button>
          </div>
        </body>
      </html>
    `;

    // Open new window with receipt content
    const printWindow = window.open(
      "",
      "_blank",
      "width=450,height=650,scrollbars=yes,resizable=yes",
    );
    if (printWindow) {
      printWindow.document.write(receiptContent);
      printWindow.document.close();

      // Auto-focus the print window
      printWindow.focus();

      // Optional: Auto-print after a short delay
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      alert("يرجى السماح بالنوافذ المنبثقة لطباعة الفاتورة");
    }
  };

  // Print Preview Receipt - for printing current cart before confirmation (as review/draft)
  const printPreviewReceipt = () => {
    if (cartItems.length === 0) {
      alert("السلة فارغة - لا يوجد منتجات للطباعة");
      return;
    }

    // Calculate total with any discounts applied
    const totalAmount = calculateTotalWithDiscounts();

    // Get paid amount from payment split if available
    const paidFromSplit = paymentSplitData.reduce((sum, p) => sum + (p.amount || 0), 0);
    const actualPaid = paidFromSplit > 0 ? paidFromSplit : (parseFloat(paidAmount) || totalAmount);
    const remainingCredit = Math.max(0, totalAmount - actualPaid);

    // Create preview receipt content (similar to invoice but marked as "مراجعة")
    const previewReceiptContent = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>مراجعة الطلب</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Arial', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              font-size: 13px;
              line-height: 1.3;
              color: #000;
              background: white;
              width: 100%;
              margin: 0;
              padding: 0;
            }

            .preview-banner {
              background: #ff9800;
              color: white;
              text-align: center;
              padding: 8px;
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 5px;
              border: 2px dashed #e65100;
            }

            .receipt-header {
              text-align: center;
              margin-bottom: 3px;
              padding: 0 2px;
            }

            .company-logo {
              width: 60px;
              height: auto;
              margin: 0 auto 4px auto;
              display: block;
              max-height: 60px;
              object-fit: contain;
            }

            .company-logo-fallback {
              display: none;
            }

            .company-name {
              font-size: 18px;
              font-weight: 700;
              margin-bottom: 2px;
              color: #000;
            }

            .receipt-date {
              font-size: 11px;
              margin-bottom: 1px;
            }

            .receipt-address {
              font-size: 10px;
              margin-bottom: 1px;
            }

            .receipt-phone {
              font-size: 10px;
            }

            .customer-info {
              margin: 10px 20px;
              padding: 8px;
              border: 1px dashed #333;
              background-color: #f9f9f9;
            }

            .customer-row {
              display: flex;
              justify-content: space-between;
              padding: 2px 0;
              font-size: 11px;
            }

            .customer-label {
              font-weight: 600;
              color: #333;
            }

            .customer-value {
              color: #000;
            }

            .items-table {
              width: calc(100% - 40px);
              border-collapse: collapse;
              margin: 3px 20px;
              border: 1px solid #000;
              table-layout: fixed;
            }

            .items-table th,
            .items-table td {
              border: 1px solid #000;
              padding: 7px;
              text-align: center;
              font-size: 14px;
              font-weight: 400;
            }

            .items-table th {
              background-color: #f5f5f5;
              font-weight: 600;
              font-size: 14px;
            }

            .items-table th:nth-child(1),
            .items-table td:nth-child(1) {
              width: 45%;
            }

            .items-table th:nth-child(2),
            .items-table td:nth-child(2) {
              width: 12%;
            }

            .items-table th:nth-child(3),
            .items-table td:nth-child(3) {
              width: 18%;
            }

            .items-table th:nth-child(4),
            .items-table td:nth-child(4) {
              width: 25%;
              text-align: right !important;
              padding-right: 4px !important;
            }

            .item-name {
              text-align: right !important;
              padding-right: 12px !important;
              padding-left: 2px !important;
              font-size: 15px;
              font-weight: bold;
              word-wrap: break-word;
              white-space: normal;
              overflow-wrap: break-word;
            }

            .total-row {
              border-top: 2px solid #000;
              font-weight: 700;
              font-size: 12px;
            }

            .payment-section {
              margin-top: 8px;
              text-align: center;
              font-size: 11px;
              padding: 0 2px;
            }

            .payment-table {
              width: calc(100% - 40px);
              border-collapse: collapse;
              margin: 5px 20px;
              border: 1px solid #000;
            }

            .payment-table th,
            .payment-table td {
              border: 1px solid #000;
              padding: 4px;
              text-align: center;
              font-size: 11px;
            }

            .footer {
              text-align: center;
              margin-top: 8px;
              font-size: 9px;
              border-top: 1px solid #000;
              padding: 3px 2px 0 2px;
            }

            .preview-footer-note {
              background: #fff3cd;
              border: 1px dashed #ffc107;
              padding: 5px;
              margin: 8px 20px;
              text-align: center;
              font-size: 10px;
              color: #856404;
            }

            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }

              body {
                width: 80mm !important;
                max-width: 80mm !important;
                margin: 0 !important;
                padding: 0 1.5mm !important;
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              .preview-banner {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              .company-logo {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              .no-print {
                display: none;
              }

              .items-table {
                margin: 3px 0;
                width: 100% !important;
              }

              .items-table th,
              .items-table td {
                padding: 2px;
              }

              * {
                max-width: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="preview-banner">
            ⚠️ مراجعة الطلب - ليست فاتورة نهائية ⚠️
          </div>

          <div class="receipt-header">
            <img
              src="${logoUrl || (window.location.origin + '/assets/logo/Hegazy.png')}"
              alt="${companyName}"
              class="company-logo"
              onerror="this.style.display='none'; document.querySelector('.company-logo-fallback').style.display='block';"
            />
            <div class="company-logo-fallback" style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 4px;">🏢</div>
            <div class="company-name">${companyName}</div>
            <div class="receipt-date">${new Date().toLocaleDateString("ar-EG")} - ${new Date().toLocaleDateString("en-US")}</div>
            <div class="receipt-address">${selections.branch?.name || "الفرع الرئيسي"}</div>
            <div class="receipt-phone">${selections.branch?.phone || "01102862856"}</div>
          </div>

          ${
            // Show customer info if customer is selected and not default
            selections.customer &&
            selections.customer.id !== '00000000-0000-0000-0000-000000000001' &&
            (selections.customer.name || selections.customer.phone || selections.customer.address || selections.customer.city)
              ? `
          <div class="customer-info">
            ${selections.customer.name ? `<div class="customer-row"><span class="customer-label">العميل:</span> <span class="customer-value">${selections.customer.name}</span></div>` : ''}
            ${selections.customer.phone ? `<div class="customer-row"><span class="customer-label">الهاتف:</span> <span class="customer-value">${selections.customer.phone}</span></div>` : ''}
            ${selections.customer.address ? `<div class="customer-row"><span class="customer-label">العنوان:</span> <span class="customer-value">${selections.customer.address}</span></div>` : ''}
            ${selections.customer.city ? `<div class="customer-row"><span class="customer-label">المدينة:</span> <span class="customer-value">${selections.customer.city}</span></div>` : ''}
          </div>
              `
              : ''
          }

          <table class="items-table">
            <thead>
              <tr>
                <th class="item-name">الصنف</th>
                <th>كمية</th>
                <th>سعر</th>
                <th>قيمة</th>
              </tr>
            </thead>
            <tbody>
              ${cartItems
                .map(
                  (item: any) => `
                <tr>
                  <td class="item-name">${item.product.name}</td>
                  <td>${item.quantity}</td>
                  <td>${(item.price || 0).toFixed(0)}</td>
                  <td>${((item.price || 0) * item.quantity).toFixed(0)}</td>
                </tr>
              `,
                )
                .join("")}
              <tr class="total-row">
                <td class="item-name">-</td>
                <td>${cartItems.length}</td>
                <td>= اجمالي =</td>
                <td>${totalAmount.toFixed(0)}</td>
              </tr>
            </tbody>
          </table>

          ${
            // Show payment section for non-default customers
            selections.customer &&
            selections.customer.id !== '00000000-0000-0000-0000-000000000001'
              ? `
          <div class="payment-section">
            ${numberToArabicWords(totalAmount)} جنيهاً

            <table class="payment-table">
              <tr>
                <th>مدفوع</th>
                <th>متبقي</th>
                <th>رصيد العميل الحالي</th>
              </tr>
              <tr>
                <td>${actualPaid.toFixed(0)}</td>
                <td>${remainingCredit.toFixed(0)}</td>
                <td>${(selections.customer?.credit_balance || selections.customer?.calculatedBalance || 0).toFixed(0)}</td>
              </tr>
            </table>
          </div>
              `
              : `
          <div class="payment-section">
            ${numberToArabicWords(totalAmount)} جنيهاً
          </div>
              `
          }

          <div class="preview-footer-note">
            📋 هذه مراجعة للطلب وليست فاتورة رسمية - يرجى التأكيد للحصول على الفاتورة النهائية
          </div>

          <div class="footer">
            ${new Date().toLocaleDateString("en-GB")} ${new Date().toLocaleTimeString("en-GB", { hour12: false })} by: ${selections.record?.name || "kassem"}
          </div>

          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; background: #ff9800; color: white; border: none; border-radius: 5px; cursor: pointer;">طباعة المراجعة</button>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">إغلاق</button>
          </div>
        </body>
      </html>
    `;

    // Open new window with preview receipt content
    const printWindow = window.open(
      "",
      "_blank",
      "width=450,height=700,scrollbars=yes,resizable=yes",
    );
    if (printWindow) {
      printWindow.document.write(previewReceiptContent);
      printWindow.document.close();
      printWindow.focus();

      // Auto-print after a short delay
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      alert("يرجى السماح بالنوافذ المنبثقة لطباعة المراجعة");
    }
  };

  // Open PDF Preview - for viewing/sharing current cart as PDF (without printing)
  const openPDFPreview = () => {
    if (cartItems.length === 0) {
      alert("السلة فارغة - لا يوجد منتجات للمعاينة");
      return;
    }

    // Calculate total with any discounts applied
    const totalAmount = calculateTotalWithDiscounts();

    // Get paid amount from payment split if available
    const paidFromSplit = paymentSplitData.reduce((sum, p) => sum + (p.amount || 0), 0);
    const actualPaid = paidFromSplit > 0 ? paidFromSplit : (parseFloat(paidAmount) || totalAmount);
    const remainingCredit = Math.max(0, totalAmount - actualPaid);

    // Create PDF-style preview content
    const pdfPreviewContent = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>معاينة الطلب - ${selections.customer?.name || 'عميل'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Cairo', 'Arial', sans-serif;
              font-size: 14px;
              line-height: 1.5;
              color: #000;
              background: #f5f5f5;
              padding: 20px;
            }

            .pdf-container {
              max-width: 400px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border-radius: 10px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            }

            .preview-banner {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-align: center;
              padding: 12px;
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 15px;
              border-radius: 8px;
            }

            .receipt-header {
              text-align: center;
              margin-bottom: 15px;
              padding-bottom: 15px;
              border-bottom: 2px dashed #ddd;
            }

            .company-logo {
              width: 80px;
              height: auto;
              margin: 0 auto 10px auto;
              display: block;
              max-height: 80px;
              object-fit: contain;
            }

            .company-name {
              font-size: 22px;
              font-weight: 700;
              margin-bottom: 5px;
              color: #333;
            }

            .receipt-date {
              font-size: 12px;
              color: #666;
              margin-bottom: 3px;
            }

            .receipt-address,
            .receipt-phone {
              font-size: 11px;
              color: #888;
            }

            .customer-info {
              margin: 15px 0;
              padding: 12px;
              border: 1px solid #e0e0e0;
              background-color: #fafafa;
              border-radius: 8px;
            }

            .customer-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              font-size: 13px;
            }

            .customer-label {
              font-weight: 600;
              color: #555;
            }

            .customer-value {
              color: #000;
            }

            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }

            .items-table th,
            .items-table td {
              border: 1px solid #ddd;
              padding: 10px 8px;
              text-align: center;
              font-size: 13px;
            }

            .items-table th {
              background-color: #f8f9fa;
              font-weight: 600;
              color: #333;
            }

            .items-table td:first-child {
              text-align: right;
              font-weight: 500;
            }

            .total-row {
              background-color: #e8f5e9;
              font-weight: 700;
            }

            .payment-section {
              margin-top: 15px;
              padding: 15px;
              background: #f0f7ff;
              border-radius: 8px;
              text-align: center;
            }

            .payment-total-text {
              font-size: 14px;
              color: #1976d2;
              margin-bottom: 10px;
            }

            .payment-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }

            .payment-table th,
            .payment-table td {
              border: 1px solid #bbdefb;
              padding: 8px;
              text-align: center;
              font-size: 12px;
            }

            .payment-table th {
              background: #e3f2fd;
              color: #1565c0;
            }

            .footer {
              text-align: center;
              margin-top: 15px;
              font-size: 10px;
              color: #999;
              padding-top: 10px;
              border-top: 1px dashed #ddd;
            }

            .preview-note {
              background: #fff8e1;
              border: 1px solid #ffecb3;
              padding: 10px;
              margin: 15px 0;
              text-align: center;
              font-size: 12px;
              color: #f57c00;
              border-radius: 8px;
            }

            .action-buttons {
              display: flex;
              gap: 10px;
              justify-content: center;
              margin-top: 20px;
              padding-top: 15px;
              border-top: 1px solid #eee;
            }

            .btn {
              padding: 12px 24px;
              font-size: 14px;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 600;
              transition: all 0.3s ease;
            }

            .btn-primary {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }

            .btn-primary:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }

            .btn-secondary {
              background: #6c757d;
              color: white;
            }

            .btn-secondary:hover {
              background: #5a6268;
            }

            .btn-success {
              background: #28a745;
              color: white;
            }

            .btn-success:hover {
              background: #218838;
            }

            @media print {
              body {
                background: white;
                padding: 0;
              }

              .pdf-container {
                box-shadow: none;
                max-width: none;
              }

              .action-buttons {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="pdf-container">
            <div class="preview-banner">
              📋 معاينة الطلب
            </div>

            <div class="receipt-header">
              <img
                src="${logoUrl || (window.location.origin + '/assets/logo/Hegazy.png')}"
                alt="${companyName}"
                class="company-logo"
                onerror="this.style.display='none';"
              />
              <div class="company-name">${companyName}</div>
              <div class="receipt-date">${new Date().toLocaleDateString("ar-EG")} - ${new Date().toLocaleTimeString("ar-EG")}</div>
              <div class="receipt-address">${selections.branch?.name || "الفرع الرئيسي"}</div>
              <div class="receipt-phone">${selections.branch?.phone || "01102862856"}</div>
            </div>

            ${
              selections.customer &&
              selections.customer.id !== '00000000-0000-0000-0000-000000000001' &&
              (selections.customer.name || selections.customer.phone || selections.customer.address || selections.customer.city)
                ? `
            <div class="customer-info">
              ${selections.customer.name ? `<div class="customer-row"><span class="customer-label">العميل:</span> <span class="customer-value">${selections.customer.name}</span></div>` : ''}
              ${selections.customer.phone ? `<div class="customer-row"><span class="customer-label">الهاتف:</span> <span class="customer-value">${selections.customer.phone}</span></div>` : ''}
              ${selections.customer.address ? `<div class="customer-row"><span class="customer-label">العنوان:</span> <span class="customer-value">${selections.customer.address}</span></div>` : ''}
              ${selections.customer.city ? `<div class="customer-row"><span class="customer-label">المدينة:</span> <span class="customer-value">${selections.customer.city}</span></div>` : ''}
            </div>
                `
                : ''
            }

            <table class="items-table">
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>الكمية</th>
                  <th>السعر</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                ${cartItems
                  .map(
                    (item: any) => `
                  <tr>
                    <td>${item.product.name}</td>
                    <td>${item.quantity}</td>
                    <td>${(item.price || 0).toFixed(2)} ج.م</td>
                    <td>${((item.price || 0) * item.quantity).toFixed(2)} ج.م</td>
                  </tr>
                `,
                  )
                  .join("")}
                <tr class="total-row">
                  <td>الإجمالي</td>
                  <td>${cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0)}</td>
                  <td>-</td>
                  <td>${totalAmount.toFixed(2)} ج.م</td>
                </tr>
              </tbody>
            </table>

            ${
              selections.customer &&
              selections.customer.id !== '00000000-0000-0000-0000-000000000001'
                ? `
            <div class="payment-section">
              <div class="payment-total-text">
                ${numberToArabicWords(totalAmount)} جنيهاً مصرياً
              </div>

              <table class="payment-table">
                <tr>
                  <th>المبلغ المدفوع</th>
                  <th>المتبقي</th>
                  <th>رصيد العميل</th>
                </tr>
                <tr>
                  <td>${actualPaid.toFixed(2)} ج.م</td>
                  <td>${remainingCredit.toFixed(2)} ج.م</td>
                  <td>${(selections.customer?.credit_balance || selections.customer?.calculatedBalance || 0).toFixed(2)} ج.م</td>
                </tr>
              </table>
            </div>
                `
                : `
            <div class="payment-section">
              <div class="payment-total-text">
                ${numberToArabicWords(totalAmount)} جنيهاً مصرياً
              </div>
            </div>
                `
            }

            <div class="preview-note">
              ⚠️ هذه معاينة للطلب وليست فاتورة نهائية - يمكنك إرسالها للعميل للمراجعة
            </div>

            <div class="footer">
              تم إنشاء المعاينة: ${new Date().toLocaleDateString("en-GB")} ${new Date().toLocaleTimeString("en-GB", { hour12: false })} | ${selections.record?.name || "kassem"}
            </div>

            <div class="action-buttons">
              <button onclick="window.print()" class="btn btn-primary">🖨️ طباعة</button>
              <button onclick="copyToClipboard()" class="btn btn-success">📋 نسخ النص</button>
              <button onclick="window.close()" class="btn btn-secondary">✕ إغلاق</button>
            </div>
          </div>

          <script>
            function copyToClipboard() {
              const items = ${JSON.stringify(cartItems.map((item: any) => ({
                name: item.product.name,
                quantity: item.quantity,
                price: item.price || 0,
                total: (item.price || 0) * item.quantity
              })))};

              let text = "📋 *معاينة الطلب*\\n";
              text += "━━━━━━━━━━━━━━━━━━\\n";
              text += "🏪 ${companyName}\\n";
              text += "📅 ${new Date().toLocaleDateString("ar-EG")}\\n";
              ${selections.customer?.name ? `text += "👤 العميل: ${selections.customer.name}\\n";` : ''}
              text += "━━━━━━━━━━━━━━━━━━\\n\\n";

              items.forEach((item, index) => {
                text += (index + 1) + ". " + item.name + "\\n";
                text += "   الكمية: " + item.quantity + " | السعر: " + item.price.toFixed(2) + " ج.م\\n";
                text += "   الإجمالي: " + item.total.toFixed(2) + " ج.م\\n\\n";
              });

              text += "━━━━━━━━━━━━━━━━━━\\n";
              text += "💰 *الإجمالي الكلي: ${totalAmount.toFixed(2)} ج.م*\\n";
              text += "━━━━━━━━━━━━━━━━━━\\n\\n";
              text += "⚠️ هذه معاينة وليست فاتورة نهائية";

              navigator.clipboard.writeText(text).then(() => {
                alert("تم نسخ تفاصيل الطلب! يمكنك لصقها في WhatsApp أو أي تطبيق آخر");
              }).catch(() => {
                alert("فشل النسخ، يرجى المحاولة مرة أخرى");
              });
            }
          </script>
        </body>
      </html>
    `;

    // Open new window with PDF preview content
    const previewWindow = window.open(
      "",
      "_blank",
      "width=500,height=800,scrollbars=yes,resizable=yes",
    );
    if (previewWindow) {
      previewWindow.document.write(pdfPreviewContent);
      previewWindow.document.close();
      previewWindow.focus();
    } else {
      alert("يرجى السماح بالنوافذ المنبثقة لمعاينة الفاتورة");
    }
  };

  // Render Tablet View if tablet device detected
  if (isTabletDevice) {
    return (
      <>
        <POSTabletView
          products={products}
          filteredProducts={filteredProducts}
          isLoading={isLoading}
          error={error}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          viewMode={viewMode}
          setViewMode={setViewMode}
          cartItems={cartItems}
          setCartItems={setCartItems}
          isCartOpen={isCartOpen}
          setIsCartOpen={setIsCartOpen}
          cartTotal={cartTotal}
          removeFromCart={removeFromCart}
          clearCart={clearCart}
          updateActiveTabCart={updateActiveTabCart}
          selections={selections}
          isPurchaseMode={isPurchaseMode}
          isTransferMode={isTransferMode}
          isReturnMode={isReturnMode}
          selectedSupplier={selectedSupplier}
          selectedWarehouse={selectedWarehouse}
          setIsRecordsModalOpen={setIsRecordsModalOpen}
          setIsCustomerModalOpen={setIsCustomerModalOpen}
          setIsBranchModalOpen={setIsBranchModalOpen}
          setIsHistoryModalOpen={setIsHistoryModalOpen}
          setIsSupplierModalOpen={setIsSupplierModalOpen}
          setIsWarehouseModalOpen={setIsWarehouseModalOpen}
          setShowQuickAddProductModal={setShowQuickAddProductModal}
          setShowColumnsModal={setShowColumnsModal}
          handleProductClick={handleProductClick}
          selectedProduct={selectedProduct}
          showColorSelectionModal={showColorSelectionModal}
          setShowColorSelectionModal={setShowColorSelectionModal}
          modalProduct={modalProduct}
          setModalProduct={setModalProduct}
          handleColorSelection={handleColorSelection}
          hasRequiredForCart={hasRequiredForCart}
          transferFromLocation={transferFromLocation}
          handleCreateInvoice={handleCreateInvoice}
          hasAllRequiredSelections={hasAllRequiredSelections}
          isProcessingInvoice={isProcessingInvoice}
          setPaymentSplitData={setPaymentSplitData}
          setCreditAmount={setCreditAmount}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          posTabs={posTabs}
          activeTab={activePOSTab}
          switchTab={switchTab}
          closeTab={closeTab}
          setShowAddTabModal={setShowAddTabModal}
          setShowPurchaseModeConfirm={setShowPurchaseModeConfirm}
          setIsTransferMode={setIsTransferMode}
          setTransferFromLocation={setTransferFromLocation}
          setTransferToLocation={setTransferToLocation}
          setIsTransferLocationModalOpen={setIsTransferLocationModalOpen}
          setIsReturnMode={setIsReturnMode}
          clearSelections={clearSelections}
        />

        {/* Modals */}
        <RecordsSelectionModal
          isOpen={isRecordsModalOpen}
          onClose={() => setIsRecordsModalOpen(false)}
          onSelectRecord={handleRecordSelect}
        />

        <CustomerSelectionModal
          isOpen={isCustomerModalOpen}
          onClose={() => setIsCustomerModalOpen(false)}
          onSelectCustomer={handleCustomerSelect}
        />

        <BranchSelectionModal
          isOpen={isBranchModalOpen}
          onClose={() => setIsBranchModalOpen(false)}
          onSelectBranch={handleBranchSelect}
        />

        <HistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
        />

        <SupplierSelectionModal
          isOpen={isSupplierModalOpen}
          onClose={() => {
            setIsSupplierModalOpen(false);
            setIsSupplierModalForNewPurchase(false);
          }}
          onSelect={isSupplierModalForNewPurchase ? handleSupplierSelectForPurchase : handleSupplierChange}
          selectedSupplier={selectedSupplier}
          isPurchaseMode={isSupplierModalForNewPurchase}
        />

        <WarehouseSelectionModal
          isOpen={isWarehouseModalOpen}
          onClose={() => setIsWarehouseModalOpen(false)}
          onSelect={setSelectedWarehouse}
          selectedWarehouse={selectedWarehouse}
        />

        <TransferLocationModal
          isOpen={isTransferLocationModalOpen}
          onClose={() => setIsTransferLocationModalOpen(false)}
          onConfirm={handleTransferLocationConfirm}
        />

        <QuickAddProductModal
          isOpen={showQuickAddProductModal}
          onClose={() => setShowQuickAddProductModal(false)}
          onAddToCart={handleQuickAddToCart}
        />

        <ColumnsControlModal
          isOpen={showColumnsModal}
          onClose={() => setShowColumnsModal(false)}
          columns={getAllColumns()}
          onColumnsChange={handleColumnsChange}
        />

        {/* Add Tab Modal */}
        {showAddTabModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowAddTabModal(false)}>
            <div className="bg-[#2B3544] rounded-lg p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-white text-lg font-medium mb-4">إضافة نافذة بيع جديدة</h3>
              <input
                type="text"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                placeholder="اسم النافذة..."
                className="w-full px-4 py-2 bg-[#374151] border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newTabName.trim()) {
                    // Inherit selections from main tab
                    addTab(newTabName.trim(), {
                      customer: globalSelections.customer,
                      branch: globalSelections.branch,
                      record: globalSelections.record,
                      priceType: selectedPriceType,
                    });
                    setNewTabName("");
                    setShowAddTabModal(false);
                  }
                }}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setNewTabName("");
                    setShowAddTabModal(false);
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => {
                    if (newTabName.trim()) {
                      // Inherit selections from main tab
                      addTab(newTabName.trim(), {
                        customer: globalSelections.customer,
                        branch: globalSelections.branch,
                        record: globalSelections.record,
                        priceType: selectedPriceType,
                      });
                      setNewTabName("");
                      setShowAddTabModal(false);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  disabled={!newTabName.trim()}
                >
                  موافق
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Purchase Mode Confirmation Modal */}
        {showPurchaseModeConfirm && (
          <>
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setShowPurchaseModeConfirm(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b border-[#4A5568]">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      تفعيل وضع الشراء
                    </h2>
                    <p className="text-gray-400 text-sm">
                      {isPurchaseMode
                        ? "إيقاف وضع الشراء والعودة لوضع البيع"
                        : "تفعيل وضع الشراء من الموردين"}
                    </p>
                  </div>
                </div>

                <div className="p-6">
                  <p className="text-white mb-4">
                    {isPurchaseMode
                      ? "هل تريد إيقاف وضع الشراء والعودة لوضع البيع؟"
                      : "هل تريد تفعيل وضع الشراء من الموردين؟"}
                  </p>
                  {!isPurchaseMode && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <p className="text-blue-400 text-sm">
                        📝 في وضع الشراء، سيتم تحديد المورد والمخزن بدلاً من
                        العميل والفرع.
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-[#4A5568]">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowPurchaseModeConfirm(false)}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-medium transition-colors"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={() => {
                        setIsPurchaseMode(!isPurchaseMode);
                        if (isPurchaseMode) {
                          setSelectedSupplier(null);
                          setSelectedWarehouse(null);
                        }
                        setShowPurchaseModeConfirm(false);
                      }}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-colors"
                    >
                      {isPurchaseMode ? "إيقاف وضع الشراء" : "تفعيل وضع الشراء"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Print Receipt Confirmation Modal */}
        {showPrintReceiptModal && (
          <>
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setShowPrintReceiptModal(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b border-[#4A5568]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                      <PrinterIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        طباعة الفاتورة
                      </h2>
                      <p className="text-gray-400 text-sm">
                        تم إنشاء الفاتورة بنجاح
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
                    <p className="text-green-400 text-sm flex items-center gap-2 mb-2">
                      <span className="text-green-400">✅</span>
                      تم إنشاء{" "}
                      {lastInvoiceData?.isReturn ? "المرتجع" : "الفاتورة"} بنجاح
                    </p>
                    <div className="text-white text-sm space-y-1">
                      <p>
                        رقم الفاتورة:{" "}
                        <span className="font-bold">
                          {lastInvoiceData?.invoiceNumber}
                        </span>
                      </p>
                      <p>
                        الإجمالي:{" "}
                        <span className="font-bold text-green-400">
                          {formatPrice(
                            lastInvoiceData?.totalAmount || 0,
                            "system",
                          )}
                        </span>
                      </p>
                      <p>
                        عدد الأصناف:{" "}
                        <span className="font-bold">
                          {lastInvoiceData?.cartItems?.length}
                        </span>
                      </p>
                    </div>
                  </div>

                  <p className="text-white font-medium text-center mb-4">
                    هل تريد طباعة الفاتورة؟
                  </p>
                </div>

                <div className="p-6 border-t border-[#4A5568]">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowPrintReceiptModal(false)}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-medium transition-colors"
                    >
                      لا، شكراً
                    </button>
                    <button
                      onClick={() => {
                        printReceipt(lastInvoiceData);
                        setShowPrintReceiptModal(false);
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <PrinterIcon className="h-5 w-5" />
                      نعم، اطبع الفاتورة
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className="flex h-screen bg-[#2B3544]">
      {/* Top Header */}
      <TopHeader onMenuClick={toggleSidebar} isMenuOpen={isSidebarOpen} pageTitle={isPurchaseMode ? 'نقطة الشراء' : 'نقطة البيع'} />

      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

      {/* Main Content Container - Responsive Layout */}
      <div className="flex-1 flex flex-col md:flex-row h-screen overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out">
          {/* Action Buttons Bar - Desktop Version (hidden on mobile) */}
          <div className="hidden md:block bg-[#374151] border-b border-gray-600 px-4 py-2 w-full mt-12">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {/* Selection Buttons - First three buttons grouped together */}
                <button
                  onClick={toggleRecordsModal}
                  className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px] transition-all relative"
                >
                  <BanknotesIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">الخزنة</span>
                  {!selections.record && (
                    <div className="w-1 h-1 bg-red-400 rounded-full mt-1"></div>
                  )}
                </button>

                {/* Conditional Customer/Supplier Button */}
                {isPurchaseMode ? (
                  <button
                    onClick={toggleSupplierModal}
                    className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px] transition-all relative"
                  >
                    <BuildingStorefrontIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">اختيار مورد</span>
                    {!selectedSupplier && (
                      <div className="w-1 h-1 bg-red-400 rounded-full mt-1"></div>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={toggleCustomerModal}
                    className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px] transition-all relative"
                  >
                    <UserIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">اختيار عميل</span>
                    {!selections.customer && (
                      <div className="w-1 h-1 bg-red-400 rounded-full mt-1"></div>
                    )}
                  </button>
                )}

                {/* Conditional Branch/Warehouse Button */}
                {isPurchaseMode ? (
                  <button
                    onClick={toggleWarehouseModal}
                    className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px] transition-all relative"
                  >
                    <BuildingOfficeIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">فرع / مخزن</span>
                    {!selectedWarehouse && (
                      <div className="w-1 h-1 bg-red-400 rounded-full mt-1"></div>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={toggleBranchModal}
                    className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px] transition-all relative"
                  >
                    <BuildingOfficeIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">تحويل فرع</span>
                    {!selections.branch && (
                      <div className="w-1 h-1 bg-red-400 rounded-full mt-1"></div>
                    )}
                  </button>
                )}

                {/* Price Type Button */}
                {!isPurchaseMode && !isTransferMode && (
                  <button
                    onClick={() => setIsPriceTypeModalOpen(true)}
                    className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] transition-all relative ${
                      selectedPriceType !== "price"
                        ? "text-blue-400 hover:text-blue-300"
                        : "text-gray-300 hover:text-white"
                    }`}
                  >
                    <CurrencyDollarIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">السعر</span>
                    {selectedPriceType !== "price" && (
                      <div className="w-1 h-1 bg-blue-400 rounded-full mt-1"></div>
                    )}
                  </button>
                )}

                {/* Separator */}
                <div className="h-8 w-px bg-gray-600 mx-2"></div>

                {/* Other Action Buttons */}
                {/* زر الأعمدة مخفي مؤقتاً لتوفير المساحة
                <button
                  onClick={() => setShowColumnsModal(true)}
                  className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
                >
                  <TableCellsIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">الأعمدة</span>
                </button>
                */}

                <button
                  onClick={toggleHistoryModal}
                  className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px]"
                >
                  <ClockIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">التاريخ</span>
                </button>

                <button
                  onClick={handleTransferModeToggle}
                  className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] transition-all ${
                    isTransferMode
                      ? "text-orange-400 hover:text-orange-300"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  <ArrowsRightLeftIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">نقل</span>
                </button>

                <button
                  onClick={toggleCategoriesModal}
                  className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] transition-all relative ${
                    selectedCategoryId
                      ? "text-blue-400 hover:text-blue-300"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  <div className="relative">
                    <Squares2X2Icon className="h-5 w-5 mb-1" />
                    {selectedCategoryId && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
                    )}
                  </div>
                  <span className="text-sm">{selectedCategoryName || 'الفئات'}</span>
                </button>

                {/* Discount Button */}
                {!isPurchaseMode && !isTransferMode && (
                  <button
                    onClick={() => setIsDiscountModalOpen(true)}
                    className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] transition-all ${
                      cartDiscount > 0 || cartItems.some(item => item.discount && item.discount > 0)
                        ? "text-orange-400 hover:text-orange-300"
                        : "text-gray-300 hover:text-white"
                    }`}
                  >
                    <ReceiptPercentIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">خصم</span>
                    {(cartDiscount > 0 || cartItems.some(item => item.discount && item.discount > 0)) && (
                      <div className="w-1 h-1 bg-orange-400 rounded-full mt-1"></div>
                    )}
                  </button>
                )}

                {/* Postponed Invoices Button */}
                <button
                  onClick={() => setIsPostponedModalOpen(true)}
                  className={`relative flex flex-col items-center p-2 cursor-pointer min-w-[80px] transition-all ${
                    postponedTabs.length > 0
                      ? "text-orange-400 hover:text-orange-300"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  <ClockIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">الفواتير</span>
                  {postponedTabs.length > 0 && (
                    <div className="absolute top-0 right-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                      {postponedTabs.length}
                    </div>
                  )}
                </button>

                {/* Cash Drawer Button */}
                <button
                  onClick={() => setIsCashDrawerModalOpen(true)}
                  disabled={!selections.record}
                  className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] transition-all ${
                    selections.record
                      ? "text-green-400 hover:text-green-300"
                      : "text-gray-500 cursor-not-allowed"
                  }`}
                  title={selections.record ? `درج ${selections.record.name}` : "يجب اختيار سجل أولاً"}
                >
                  <CurrencyDollarIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">الدرج</span>
                </button>

                <button
                  onClick={printPreviewReceipt}
                  disabled={cartItems.length === 0}
                  className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] transition-all ${
                    cartItems.length === 0
                      ? "text-gray-500 cursor-not-allowed"
                      : "text-gray-300 hover:text-white"
                  }`}
                  title="طباعة مراجعة للطلب الحالي"
                >
                  <PrinterIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">طباعة</span>
                </button>

                <button
                  onClick={openPDFPreview}
                  disabled={cartItems.length === 0}
                  className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] transition-all ${
                    cartItems.length === 0
                      ? "text-gray-500 cursor-not-allowed"
                      : "text-blue-400 hover:text-blue-300"
                  }`}
                  title="معاينة الفاتورة للإرسال للعميل"
                >
                  <EyeIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">معاينة</span>
                </button>
              </div>

              {/* Right Side - Cart, Purchase Mode Toggle & Returns */}
              <div className="flex items-center gap-2">
                {/* Returns Button */}
                <button
                  onClick={() => setIsReturnMode(!isReturnMode)}
                  className={`flex flex-col items-center p-2 cursor-pointer min-w-[80px] transition-all ${
                    isReturnMode
                      ? "text-orange-400 hover:text-orange-300"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  <ArrowUturnLeftIcon className="h-5 w-5 mb-1" />
                  <span className="text-sm">مرتجع</span>
                </button>

                {/* Separator */}
                <div className="h-8 w-px bg-gray-600 mx-1"></div>

                {isPurchaseMode ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowQuickAddProductModal(true)}
                      className="flex flex-col items-center p-2 text-green-400 hover:text-green-300 cursor-pointer min-w-[80px] transition-all"
                    >
                      <PlusIcon className="h-5 w-5 mb-1" />
                      <span className="text-sm">منتج جديد</span>
                    </button>
                    <button
                      onClick={handlePurchaseModeToggle}
                      className="flex flex-col items-center p-2 text-blue-400 hover:text-blue-300 cursor-pointer min-w-[80px] transition-all"
                    >
                      <ShoppingBagIcon className="h-5 w-5 mb-1" />
                      <span className="text-sm">شراء</span>
                    </button>
                  </div>
                ) : isTransferMode ? (
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400 text-sm font-medium">
                      وضع النقل مفعل
                    </span>
                    <div className="text-xs text-gray-300">
                      من: {transferFromLocation?.name} → إلى:{" "}
                      {transferToLocation?.name}
                    </div>
                    <button
                      onClick={exitTransferMode}
                      className="flex flex-col items-center p-2 text-red-400 hover:text-red-300 cursor-pointer min-w-[80px] transition-all"
                    >
                      <XMarkIcon className="h-5 w-5 mb-1" />
                      <span className="text-sm">إنهاء النقل</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handlePurchaseModeToggle}
                    className="flex flex-col items-center p-2 text-gray-300 hover:text-white cursor-pointer min-w-[80px] transition-all"
                  >
                    <ShoppingBagIcon className="h-5 w-5 mb-1" />
                    <span className="text-sm">شراء</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons Bar - Mobile Version (shown only on mobile) */}
          <div className="block md:hidden bg-[#374151] border-b border-gray-600 px-2 py-2 w-full mt-12">
            <div className="flex items-center justify-start gap-1 overflow-x-auto scrollbar-hide">
              {/* Selection Buttons */}
              <button
                onClick={toggleRecordsModal}
                className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors relative"
              >
                <BanknotesIcon className="h-4 w-4" />
                <span className="text-xs">الخزنة</span>
                {!selections.record && (
                  <div className="w-1 h-1 bg-red-400 rounded-full absolute -top-1 -right-1"></div>
                )}
              </button>

              {/* Conditional Customer/Supplier Button */}
              {isPurchaseMode ? (
                <button
                  onClick={toggleSupplierModal}
                  className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors relative"
                >
                  <BuildingStorefrontIcon className="h-4 w-4" />
                  <span className="text-xs">اختيار مورد</span>
                  {!selectedSupplier && (
                    <div className="w-1 h-1 bg-red-400 rounded-full absolute -top-1 -right-1"></div>
                  )}
                </button>
              ) : (
                <button
                  onClick={toggleCustomerModal}
                  className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors relative"
                >
                  <UserIcon className="h-4 w-4" />
                  <span className="text-xs">اختيار عميل</span>
                  {!selections.customer && (
                    <div className="w-1 h-1 bg-red-400 rounded-full absolute -top-1 -right-1"></div>
                  )}
                </button>
              )}

              {/* Conditional Branch/Warehouse Button */}
              {isPurchaseMode ? (
                <button
                  onClick={toggleWarehouseModal}
                  className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors relative"
                >
                  <BuildingOfficeIcon className="h-4 w-4" />
                  <span className="text-xs">فرع / مخزن</span>
                  {!selectedWarehouse && (
                    <div className="w-1 h-1 bg-red-400 rounded-full absolute -top-1 -right-1"></div>
                  )}
                </button>
              ) : (
                <button
                  onClick={toggleBranchModal}
                  className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors relative"
                >
                  <BuildingOfficeIcon className="h-4 w-4" />
                  <span className="text-xs">تحويل فرع</span>
                  {!selections.branch && (
                    <div className="w-1 h-1 bg-red-400 rounded-full absolute -top-1 -right-1"></div>
                  )}
                </button>
              )}

              {/* Price Type Button - Mobile */}
              {!isPurchaseMode && !isTransferMode && (
                <button
                  onClick={() => setIsPriceTypeModalOpen(true)}
                  className={`flex items-center gap-2 px-3 py-2 border border-gray-600 rounded cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors relative ${
                    selectedPriceType !== "price"
                      ? "bg-blue-600 text-white hover:bg-blue-700 border-blue-500"
                      : "bg-[#2B3544] text-gray-300 hover:text-white hover:bg-[#374151]"
                  }`}
                >
                  <CurrencyDollarIcon className="h-4 w-4" />
                  <span className="text-xs">السعر</span>
                  {selectedPriceType !== "price" && (
                    <div className="w-1 h-1 bg-blue-300 rounded-full absolute -top-1 -right-1"></div>
                  )}
                </button>
              )}

              {/* Other Action Buttons */}
              {/* زر الأعمدة مخفي مؤقتاً لتوفير المساحة
              <button
                onClick={() => setShowColumnsModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
              >
                <TableCellsIcon className="h-4 w-4" />
                <span className="text-xs">الأعمدة</span>
              </button>
              */}

              <button
                onClick={toggleHistoryModal}
                className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
              >
                <ClockIcon className="h-4 w-4" />
                <span className="text-xs">التاريخ</span>
              </button>

              <button
                onClick={handleTransferModeToggle}
                className={`flex items-center gap-2 px-3 py-2 border border-gray-600 rounded cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors ${
                  isTransferMode
                    ? "bg-orange-600 text-white hover:bg-orange-700"
                    : "bg-[#2B3544] text-gray-300 hover:text-white hover:bg-[#374151]"
                }`}
              >
                <ArrowsRightLeftIcon className="h-4 w-4" />
                <span className="text-xs">نقل</span>
              </button>

              <button
                onClick={toggleCategoriesModal}
                className={`flex items-center gap-2 px-3 py-2 border border-gray-600 rounded cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors ${
                  selectedCategoryId
                    ? "bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
                    : "bg-[#2B3544] text-gray-300 hover:text-white hover:bg-[#374151]"
                }`}
              >
                <Squares2X2Icon className="h-4 w-4" />
                <span className="text-xs">{selectedCategoryName || 'الفئات'}</span>
              </button>

              {/* Discount Button - Mobile */}
              {!isPurchaseMode && !isTransferMode && (
                <button
                  onClick={() => setIsDiscountModalOpen(true)}
                  className={`flex items-center gap-2 px-3 py-2 border border-gray-600 rounded cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors relative ${
                    cartDiscount > 0 || cartItems.some(item => item.discount && item.discount > 0)
                      ? "bg-orange-600 text-white hover:bg-orange-700 border-orange-500"
                      : "bg-[#2B3544] text-gray-300 hover:text-white hover:bg-[#374151]"
                  }`}
                >
                  <ReceiptPercentIcon className="h-4 w-4" />
                  <span className="text-xs">خصم</span>
                  {(cartDiscount > 0 || cartItems.some(item => item.discount && item.discount > 0)) && (
                    <div className="w-1 h-1 bg-orange-300 rounded-full absolute -top-1 -right-1"></div>
                  )}
                </button>
              )}

              <button
                onClick={printPreviewReceipt}
                disabled={cartItems.length === 0}
                className={`flex items-center gap-2 px-3 py-2 border border-gray-600 rounded cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors ${
                  cartItems.length === 0
                    ? "bg-[#2B3544] text-gray-500 cursor-not-allowed"
                    : "bg-[#2B3544] text-gray-300 hover:text-white hover:bg-[#374151]"
                }`}
                title="طباعة مراجعة للطلب الحالي"
              >
                <PrinterIcon className="h-4 w-4" />
                <span className="text-xs">طباعة</span>
              </button>

              <button
                onClick={openPDFPreview}
                disabled={cartItems.length === 0}
                className={`flex items-center gap-2 px-3 py-2 border border-gray-600 rounded cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors ${
                  cartItems.length === 0
                    ? "bg-[#2B3544] text-gray-500 cursor-not-allowed"
                    : "bg-[#2B3544] text-blue-400 hover:text-blue-300 hover:bg-[#374151]"
                }`}
                title="معاينة الفاتورة للإرسال للعميل"
              >
                <EyeIcon className="h-4 w-4" />
                <span className="text-xs">معاينة</span>
              </button>

              {/* Returns Button */}
              <button
                onClick={() => setIsReturnMode(!isReturnMode)}
                className={`flex items-center gap-2 px-3 py-2 border border-gray-600 rounded cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors ${
                  isReturnMode
                    ? "bg-orange-600 text-white hover:bg-orange-700"
                    : "bg-[#2B3544] text-gray-300 hover:text-white hover:bg-[#374151]"
                }`}
              >
                <ArrowUturnLeftIcon className="h-4 w-4" />
                <span className="text-xs">مرتجع</span>
              </button>

              {/* Purchase Mode Button */}
              {isPurchaseMode ? (
                <>
                  <button
                    onClick={() => setShowQuickAddProductModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 border border-green-500 rounded text-white hover:bg-green-700 cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span className="text-xs">منتج جديد</span>
                  </button>
                  <button
                    onClick={handlePurchaseModeToggle}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 border border-blue-500 rounded text-white hover:bg-blue-700 cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
                  >
                    <ShoppingBagIcon className="h-4 w-4" />
                    <span className="text-xs">شراء</span>
                  </button>
                </>
              ) : isTransferMode ? (
                <button
                  onClick={exitTransferMode}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 border border-red-500 rounded text-white hover:bg-red-700 cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
                >
                  <XMarkIcon className="h-4 w-4" />
                  <span className="text-xs">إنهاء النقل</span>
                </button>
              ) : (
                <button
                  onClick={handlePurchaseModeToggle}
                  className="flex items-center gap-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-gray-300 hover:text-white hover:bg-[#374151] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
                >
                  <ShoppingBagIcon className="h-4 w-4" />
                  <span className="text-xs">شراء</span>
                </button>
              )}
            </div>
          </div>

          {/* Combined Selection Display & POS Tabs Bar (hidden on mobile) */}
          <div className="hidden md:flex bg-[#2B3544] border-b border-gray-600 items-center justify-between">
            {/* Right Side: Selection Display */}
            <div className="flex items-center gap-6 text-sm px-4 py-2">
              {/* Customer/Supplier */}
              <span className="text-gray-300 whitespace-nowrap">
                {isPurchaseMode ? "المورد" : "العميل"}:{" "}
                <span className="text-white font-medium">
                  {isPurchaseMode
                    ? selectedSupplier
                      ? selectedSupplier.name
                      : "غير محدد"
                    : selections.customer
                      ? selections.customer.name
                      : "غير محدد"}
                </span>
              </span>

              {/* Branch/Warehouse */}
              <span className="text-gray-300 whitespace-nowrap">
                {isPurchaseMode
                  ? selectedWarehouse
                    ? selectedWarehouse.locationType === "branch"
                      ? "الفرع"
                      : "المخزن"
                    : "فرع / مخزن"
                  : "الفرع"}
                :{" "}
                <span className="text-white font-medium">
                  {isPurchaseMode
                    ? selectedWarehouse
                      ? selectedWarehouse.name
                      : "غير محدد"
                    : selections.branch
                      ? selections.branch.name
                      : "غير محدد"}
                </span>
              </span>

              {/* Record */}
              <span className="text-gray-300 whitespace-nowrap">
                الخزنة:{" "}
                <span className="text-white font-medium">
                  {selections.record ? selections.record.name : "غير محدد"}
                </span>
              </span>

              {/* Price Type Display */}
              {!isPurchaseMode && !isTransferMode && (
                <span className="text-gray-300 whitespace-nowrap">
                  السعر:{" "}
                  <span className={`font-medium ${selectedPriceType !== "price" ? "text-blue-400" : "text-white"}`}>
                    {getPriceTypeName(selectedPriceType)}
                  </span>
                </span>
              )}

              {/* Clear all button - if any selections exist */}
              {(selections.customer ||
                selections.branch ||
                selections.record ||
                selectedSupplier ||
                selectedWarehouse) && (
                <button
                  onClick={() => {
                    clearSelections();
                    if (isPurchaseMode) {
                      setSelectedSupplier(null);
                      setSelectedWarehouse(null);
                    }
                  }}
                  className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded whitespace-nowrap"
                >
                  مسح الكل
                </button>
              )}
            </div>

            {/* Vertical Divider */}
            <div className="h-8 w-px bg-gray-600"></div>

            {/* Left Side: POS Tabs */}
            <div className="flex items-center overflow-x-auto scrollbar-hide flex-1">
              {posTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center border-l border-gray-600 ${
                    tab.active
                      ? tab.isPurchaseMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#F97316] text-white'
                      : 'text-gray-300 hover:text-white hover:bg-[#4B5563]'
                  }`}
                  onContextMenu={(e) => {
                    // Only show context menu for non-main tabs
                    if (tab.id !== 'main') {
                      e.preventDefault();
                      setTabContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                    }
                  }}
                >
                  <button
                    onClick={() => switchTab(tab.id)}
                    className="px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <span>{tab.title}</span>
                  </button>

                  {tab.id !== 'main' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="ml-1 p-1 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="إغلاق"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              {/* Add New Tab Button */}
              <button
                onClick={() => setShowAddTabModal(true)}
                className="px-3 py-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors flex items-center gap-1 border-l border-gray-600"
                title="إضافة نافذة بيع جديدة"
              >
                <PlusIcon className="w-4 h-4" />
              </button>

            </div>

            {/* Tab Context Menu for Postponing */}
            {tabContextMenu && (
              <div
                className="fixed z-50 bg-[#2B3544] border border-gray-600 rounded-lg shadow-xl py-1 min-w-[160px]"
                style={{ top: tabContextMenu.y, left: tabContextMenu.x }}
                onClick={() => setTabContextMenu(null)}
              >
                <button
                  onClick={() => {
                    const tab = posTabs.find(t => t.id === tabContextMenu.tabId);
                    if (tab && tab.cartItems && tab.cartItems.length > 0) {
                      postponeTab(tabContextMenu.tabId);
                    }
                    setTabContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-right text-sm text-gray-300 hover:bg-orange-500/20 hover:text-orange-400 flex items-center gap-2 transition-colors"
                >
                  <ClockIcon className="h-4 w-4" />
                  تأجيل الفاتورة
                </button>
                <button
                  onClick={() => {
                    closeTab(tabContextMenu.tabId);
                    setTabContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-right text-sm text-gray-300 hover:bg-red-500/20 hover:text-red-400 flex items-center gap-2 transition-colors"
                >
                  <XMarkIcon className="h-4 w-4" />
                  إغلاق الفاتورة
                </button>
              </div>
            )}
          </div>

          {/* Desktop Toolbar - Original Design (hidden on mobile) */}
          <div className="hidden md:block bg-[#374151] border-b border-gray-600 px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Left Side Elements */}
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="اسم المنتج..."
                    className="w-64 pl-4 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* View Mode Toggle */}
                <div className="flex bg-[#2B3544] rounded-lg p-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === "grid"
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:text-white"
                    }`}
                  >
                    <Squares2X2Icon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === "table"
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:text-white"
                    }`}
                  >
                    <ListBulletIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Right Side - Change Calculator */}
              {!isTransferMode && !isPurchaseMode && (
                <div className="flex flex-col items-end self-start">
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="المدفوع"
                    className="w-24 px-2 py-1 bg-[#2B3544] border border-gray-600 rounded text-white text-xs placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-left"
                    dir="ltr"
                  />
                  {paidAmount && parseFloat(paidAmount) > 0 && (
                    <span className="text-orange-400 text-xs font-medium mt-1">
                      الباقي: {(parseFloat(paidAmount) - calculateTotalWithDiscounts()).toFixed(0)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Unified Toolbar - New Design (shown only on mobile) */}
          <div className="block md:hidden bg-[#374151] border-b border-gray-600 px-4 py-3 flex-shrink-0">
            {/* Single Horizontal Row - Search Bar, View Toggle, Cart Toggle, Customer Info, Branch Info, Record Info, Clear All */}
            <div
              className="flex items-center gap-3 overflow-x-auto scrollbar-hide"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {/* 1. Search Bar */}
              <div className="relative flex-shrink-0 w-64">
                <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="اسم المنتج..."
                  className="w-full pl-4 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#5DADE2] focus:border-transparent"
                  style={{ fontSize: "16px" }}
                />
              </div>

              {/* 2. Cart Toggle Button */}
              <button
                onClick={() => setIsCartOpen(!isCartOpen)}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md transition-colors bg-[#2B3544] border border-gray-600 flex-shrink-0"
                title={isCartOpen ? "إخفاء السلة" : "إظهار السلة"}
              >
                {isCartOpen ? (
                  <ShoppingBagIcon className="h-4 w-4" />
                ) : (
                  <ShoppingCartIcon className="h-4 w-4" />
                )}
              </button>

              {/* 3. Product Count */}
              <span className="text-xs text-gray-400 whitespace-nowrap">
                عرض {filteredProducts.length} من {products.length}
              </span>

              {/* 3. View Toggle (Images or Tables) */}
              <div className="flex bg-[#2B3544] rounded-md overflow-hidden flex-shrink-0 border border-gray-600">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 transition-colors ${
                    viewMode === "grid"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-600"
                  }`}
                  title="عرض الصور"
                >
                  <Squares2X2Icon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-2 transition-colors ${
                    viewMode === "table"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-600"
                  }`}
                  title="عرض الجداول"
                >
                  <ListBulletIcon className="h-4 w-4" />
                </button>
              </div>

              {/* 4. Customer Info */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">العميل:</span>
                <span className="text-xs text-white bg-[#2B3544] px-2 py-1 rounded border border-gray-600">
                  {selections.customer?.name || "غير محدد"}
                </span>
              </div>

              {/* 5. Branch Info */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">الفرع:</span>
                <span className="text-xs text-white bg-[#2B3544] px-2 py-1 rounded border border-gray-600">
                  {selections.branch?.name || "غير محدد"}
                </span>
              </div>

              {/* 6. Record Info */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">الخزنة:</span>
                <span className="text-xs text-white bg-[#2B3544] px-2 py-1 rounded border border-gray-600">
                  {selections.record?.name || "غير محدد"}
                </span>
              </div>

              {/* 7. Price Type Info - Mobile */}
              {!isPurchaseMode && !isTransferMode && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-400">السعر:</span>
                  <span className={`text-xs px-2 py-1 rounded border ${
                    selectedPriceType !== "price"
                      ? "text-blue-400 bg-blue-600/20 border-blue-500"
                      : "text-white bg-[#2B3544] border-gray-600"
                  }`}>
                    {getPriceTypeName(selectedPriceType)}
                  </span>
                </div>
              )}

              {/* 8. Clear All Button */}
              {(selections.customer ||
                selections.branch ||
                selections.record) && (
                <button
                  onClick={() => {
                    // Clear all selections manually
                    // Note: This would need to be integrated with the proper selection management system
                    console.log('Clear all selections clicked');
                  }}
                  className="text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 px-3 py-2 rounded-md transition-colors bg-[#2B3544] border border-gray-600 flex-shrink-0"
                >
                  مسح الكل
                </button>
              )}
            </div>
          </div>

          {/* Products Content Container - Smart sizing for both layout and scroll */}
          <div className="flex-1 relative overflow-hidden">
            {/* Show cart on mobile when isCartOpen is true */}
            {isCartOpen && (
              <div className="block md:hidden h-full">
                {/* Mobile Cart View */}
                <div className="h-full bg-[#374151] border-t-2 border-gray-500 flex flex-col">
                  {/* Cart Items Area - Full Height */}
                  <div className="flex-1 border-t-2 border-gray-500 overflow-hidden">
                    {cartItems.length === 0 ? (
                      <div className="flex flex-col justify-center items-center h-full p-8">
                        <ShoppingCartIcon className="h-24 w-24 text-gray-500 mb-8" />
                        <p className="text-gray-400 text-sm text-center mb-4">
                          اضغط على المنتجات لإضافتها للسلة
                        </p>
                        <div className="text-center">
                          <span className="bg-gray-600 px-3 py-1 rounded text-sm text-gray-300">
                            0 منتج
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col">
                        {/* Cart Header */}
                        <div className="p-4 border-b border-gray-600 flex-shrink-0">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              {/* Close button for mobile */}
                              <button
                                onClick={() => setIsCartOpen(false)}
                                className="text-gray-400 hover:text-white mr-2"
                                title="إغلاق السلة"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              <span className="text-white font-medium">السلة</span>
                              <span className="bg-blue-600 px-2 py-1 rounded text-xs text-white">
                                {cartItems.length}
                              </span>
                            </div>
                            {cartItems.length > 0 && (
                              <button
                                onClick={() => clearCart()}
                                className="text-red-400 hover:text-red-300 text-sm"
                                title="مسح السلة"
                              >
                                مسح الكل
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3 min-h-0">
                          {cartItems.map((item) => (
                            <div
                              key={item.id}
                              className="bg-[#2B3544] rounded-lg p-3 border border-gray-600"
                            >
                              <div className="flex gap-3 mb-2">
                                {/* Product Image */}
                                <div className="w-12 h-12 bg-[#374151] rounded-lg overflow-hidden flex-shrink-0">
                                  <ProductThumbnail
                                    src={item.product.main_image_url}
                                    alt={item.product.name}
                                  />
                                </div>

                                {/* Product Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-medium text-white text-sm truncate">
                                      {item.product.name}
                                    </h4>
                                    <button
                                      onClick={() => removeFromCart(item.id)}
                                      className="text-red-400 hover:text-red-300 p-1 ml-2 flex-shrink-0"
                                      title="إزالة من السلة"
                                    >
                                      <XMarkIcon className="h-4 w-4" />
                                    </button>
                                  </div>

                                  {/* Quantity and Price Controls */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-400 text-xs">الكمية:</span>
                                      <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => {
                                          const newQuantity = parseInt(e.target.value) || 1;
                                          setCartItems((prev) => {
                                            const newCart = prev.map((cartItem) => {
                                              if (cartItem.id === item.id) {
                                                const pricePerUnit =
                                                  newQuantity / cartItem.quantity;

                                                // Handle selected colors proportionally
                                                let newSelectedColors = null;
                                                if (cartItem.selectedColors) {
                                                  newSelectedColors = Object.fromEntries(
                                                    Object.entries(
                                                      cartItem.selectedColors,
                                                    ).map(([color, count]) => [
                                                      color,
                                                      Math.round(
                                                        (count as number) *
                                                          pricePerUnit,
                                                      ),
                                                    ]),
                                                  );
                                                }

                                                // Calculate unit price from totalPrice if custom price was set
                                                const unitPrice = cartItem.isCustomPrice && cartItem.totalPrice
                                                  ? cartItem.totalPrice / cartItem.quantity
                                                  : cartItem.price;
                                                return {
                                                  ...cartItem,
                                                  quantity: newQuantity,
                                                  selectedColors: newSelectedColors,
                                                  totalPrice: unitPrice * newQuantity,
                                                };
                                              }
                                              return cartItem;
                                            });
                                            updateActiveTabCart(newCart);
                                            return newCart;
                                          });
                                        }}
                                        className="w-16 px-2 py-1 bg-[#374151] border border-gray-600 rounded text-white text-xs text-center"
                                      />
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-400 text-xs">السعر:</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={((item.totalPrice || (item.price * item.quantity) || 0) / item.quantity).toFixed(2)}
                                        onChange={(e) => {
                                          const newPrice = parseFloat(e.target.value) || 0;
                                          setCartItems((prev) => {
                                            const newCart = prev.map((cartItem) =>
                                              cartItem.id === item.id
                                                ? {
                                                    ...cartItem,
                                                    isCustomPrice: true,
                                                    totalPrice:
                                                      cartItem.quantity * newPrice,
                                                  }
                                                : cartItem,
                                            );
                                            updateActiveTabCart(newCart);
                                            return newCart;
                                          });
                                        }}
                                        className="w-20 px-2 py-1 bg-[#374151] border border-gray-600 rounded text-white text-xs text-center"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Total Price */}
                              <div className="text-right">
                                <span className="text-green-400 font-bold text-sm">
                                  {formatPrice(item.totalPrice || (item.price * item.quantity) || 0, "system")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cart Footer */}
                  <div className="p-4 border-t border-gray-600 bg-[#2B3544] flex-shrink-0">
                    {/* Payment Split Component - Show in sales, return, and purchase mode (not transfer or edit mode) */}
                    {!isTransferMode && !activePOSTab?.isEditMode && (
                      <PaymentSplit
                        totalAmount={calculateTotalWithDiscounts()}
                        onPaymentsChange={(payments, credit) => {
                          setPaymentSplitData(payments);
                          setCreditAmount(credit);
                        }}
                        isDefaultCustomer={isPurchaseMode ? false : selections.customer?.id === '00000000-0000-0000-0000-000000000001'}
                        isReturnMode={isReturnMode}
                        isPurchaseMode={isPurchaseMode}
                      />
                    )}

                    {/* Single row layout for total and button */}
                    <div className="flex items-center justify-between gap-3">
                      {/* Total/Transfer info section */}
                      <div className="flex-shrink-0">
                        {!isTransferMode ? (
                          <div className="text-right">
                            {(cartDiscount > 0 || cartItems.some(item => item.discount && item.discount > 0)) ? (
                              <>
                                <div className="flex items-center gap-2 justify-end">
                                  <span className="text-gray-400 text-xs line-through">
                                    {formatPrice(cartTotal, "system")}
                                  </span>
                                  <span className="text-orange-400 text-xs">
                                    خصم {cartDiscount > 0 ? (cartDiscountType === "percentage" ? `${cartDiscount}%` : `${cartDiscount} ج.م`) : ""}
                                  </span>
                                </div>
                                <div className="text-green-400 font-bold text-lg">
                                  {formatPrice(calculateTotalWithDiscounts(), "system")}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-white text-sm font-medium">الإجمالي:</div>
                                <div className="text-green-400 font-bold text-lg">
                                  {formatPrice(cartTotal, "system")}
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="text-right">
                            <div className="text-orange-400 text-sm font-medium">وضع النقل</div>
                            <div className="text-white font-bold text-lg">
                              {cartItems.reduce((sum, item) => sum + item.quantity, 0)} قطعة
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Button section */}
                      <button
                        disabled={
                          // In edit mode, allow empty cart (user might delete all items)
                          (cartItems.length === 0 && !activePOSTab?.isEditMode) ||
                          !hasAllRequiredSelections() ||
                          isProcessingInvoice
                        }
                        className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed text-white ${
                          activePOSTab?.isEditMode
                            ? "bg-amber-600 hover:bg-amber-700"
                            : isTransferMode
                              ? "bg-orange-600 hover:bg-orange-700"
                              : isReturnMode
                                ? "bg-red-600 hover:bg-red-700"
                                : isPurchaseMode
                                  ? "bg-purple-600 hover:bg-purple-700"
                                  : "bg-blue-600 hover:bg-blue-700"
                        }`}
                        onClick={handleCreateInvoice}
                      >
                        {isProcessingInvoice
                          ? "جاري المعالجة..."
                          : cartItems.length === 0 && !activePOSTab?.isEditMode
                            ? "السلة فارغة"
                            : !hasAllRequiredSelections()
                              ? "يجب إكمال التحديدات"
                              : activePOSTab?.isEditMode
                                ? `تعديل الفاتورة (${cartItems.length}) [Y]`
                                : isTransferMode
                                  ? `تأكيد النقل (${cartItems.length}) [Y]`
                                  : isReturnMode
                                    ? isPurchaseMode
                                      ? `مرتجع شراء (${cartItems.length}) [Y]`
                                      : `مرتجع بيع (${cartItems.length}) [Y]`
                                    : isPurchaseMode
                                      ? `تأكيد الشراء (${cartItems.length}) [Y]`
                                      : `تأكيد الطلب (${cartItems.length}) [Y]`}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Products Display Container - Responsive: absolute for mobile, normal for desktop */}
            <div className={`${isCartOpen ? "hidden md:block" : "block"} md:h-full md:flex md:flex-col absolute inset-0 md:relative md:inset-auto flex flex-col`}>
              {/* Loading State - Skeleton UI for faster perceived loading */}
              {isLoading && (
                <ProductGridSkeleton count={12} />
              )}

              {/* Error State */}
              {error && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-red-400">خطأ: {error}</div>
                </div>
              )}

              {/* Products Content */}
              {!isLoading && !error && (
                <>
                  {viewMode === "table" ? (
                    /* Table View */
                    <div className="flex-1 min-h-0">
                      <ResizableTable
                        className="h-full w-full"
                        columns={visibleTableColumns}
                        data={filteredProducts}
                        selectedRowId={selectedProduct?.id || null}
                        onRowClick={(product, index) => {
                          if (selectedProduct?.id === product.id) {
                            setSelectedProduct(null);
                          } else {
                            setSelectedProduct(product as Product);
                          }
                        }}
                      />
                    </div>
                  ) : (
                    /* Grid View - Responsive scroll solution */
                    <div className="flex-1 overflow-hidden">
                      <div className="h-full overflow-y-auto scrollbar-hide p-4">
                        <div className="grid gap-4 grid-cols-2 md:grid-cols-6">
                          {/* OPTIMIZED: Use CSS visibility to hide products instead of filtering */}
                          {/* This keeps images loaded in DOM and prevents re-loading on search changes */}
                          {products.map((product, index) => (
                            <div
                              key={product.id}
                              onClick={() => {
                                if (!isProductVisible(product.id)) return; // Don't allow clicks on hidden products
                                if (selectedProduct?.id === product.id) {
                                  setSelectedProduct(null);
                                } else {
                                  setSelectedProduct(product);
                                }
                                handleProductClick(product);
                              }}
                              className={`bg-[#374151] rounded-lg p-3 cursor-pointer transition-all duration-200 border-2 relative group ${
                                selectedProduct?.id === product.id
                                  ? "border-blue-500 bg-[#434E61]"
                                  : "border-transparent hover:border-gray-500 hover:bg-[#434E61]"
                              } ${!isProductVisible(product.id) ? "hidden" : ""}`}
                            >
                              {/* Product Image */}
                              <div className="mb-3 relative">
                                <ProductGridImage
                                  src={product.main_image_url}
                                  alt={product.name}
                                  priority={index < 6}
                                />

                                {/* View Details Button */}
                                <div className="absolute top-2 right-2 z-50">
                                  <button
                                    onClick={(e) => {
                                      if (isSidebarOpen) return; // لا تعمل إذا القائمة مفتوحة
                                      e.stopPropagation();
                                      setModalProduct(product);
                                      const firstImage =
                                        product.allImages?.[0] ||
                                        product.main_image_url ||
                                        null;
                                      setSelectedImage(firstImage);
                                      setShowProductModal(true);
                                    }}
                                    className={`bg-black/50 hover:bg-black/90 text-white p-2 rounded-full opacity-0 ${!isSidebarOpen ? 'group-hover:opacity-100' : 'pointer-events-none'} transition-all duration-200 shadow-lg`}
                                  >
                                    <EyeIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Product Name */}
                              <h3 className="text-white font-medium text-sm text-center mb-2 line-clamp-2">
                                {product.name}
                              </h3>

                              {/* Product Details */}
                              <div className="space-y-1 text-xs">
                                {/* Price */}
                                <div className="flex justify-center mb-2">
                                  <span className="text-blue-400 font-medium text-sm">
                                    {getProductPriceByType(product).toFixed(2)}
                                  </span>
                                </div>

                                {/* Total Quantity */}
                                <div className="flex justify-between items-center">
                                  <span className="text-blue-400 font-medium">
                                    {(product.inventoryData &&
                                      Object.values(product.inventoryData).reduce(
                                        (sum: number, inv: any) =>
                                          sum + (inv?.quantity || 0),
                                        0,
                                      )) ||
                                      0}
                                  </span>
                                  <span className="text-gray-400">
                                    الكمية الإجمالية
                                  </span>
                                </div>

                                {/* Branch Quantities */}
                                {product.inventoryData &&
                                  Object.entries(product.inventoryData).map(
                                    ([locationId, inventory]: [string, any]) => {
                                      const branch = branches.find(
                                        (b) => b.id === locationId,
                                      );
                                      const locationName =
                                        branch?.name ||
                                        `موقع ${locationId.slice(0, 8)}`;

                                      return (
                                        <div
                                          key={locationId}
                                          className="flex justify-between items-center"
                                        >
                                          <span className="text-white">
                                            {inventory?.quantity || 0}
                                          </span>
                                          <span className="text-gray-400 truncate">
                                            {locationName}
                                          </span>
                                        </div>
                                      );
                                    },
                                  )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Shopping Cart Panel - Desktop: Sidebar, Mobile: Shows below search toolbar */}
        <div className="hidden md:flex">
          <div className="w-80 bg-[#374151] border-l-2 border-r-2 border-gray-500 flex flex-col h-screen flex-shrink-0"
          >
            {/* Cart Items Area - Full Height */}
            <div className="flex-1 border-t-2 border-gray-500 overflow-hidden">
              {cartItems.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-full p-8">
                  <ShoppingCartIcon className="h-24 w-24 text-gray-500 mb-8" />
                  <p className="text-gray-400 text-sm text-center mb-4">
                    اضغط على المنتجات لإضافتها للسلة
                  </p>
                  <div className="text-center">
                    <span className="bg-gray-600 px-3 py-1 rounded text-sm text-gray-300">
                      0 منتج
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {/* Cart Header */}
                  <div className="p-4 border-b border-gray-600 flex-shrink-0">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">السلة</span>
                        <span className="bg-blue-600 px-2 py-1 rounded text-xs text-white">
                          {cartItems.length}
                        </span>
                      </div>
                      {cartItems.length > 0 && (
                        <button
                          onClick={clearCart}
                          className="text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded px-2 py-1 transition-colors text-xs"
                          title="مسح السلة"
                        >
                          مسح الكل
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cart Items */}
                  <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3 min-h-0">
                    {cartItems.map((item) => (
                      <div
                        key={item.id}
                        className="bg-[#2B3544] rounded-lg p-3 border border-gray-600"
                      >
                        <div className="flex gap-3 mb-2">
                          {/* Product Image - OPTIMIZED */}
                          <div className="w-12 h-12 bg-[#374151] rounded-lg overflow-hidden flex-shrink-0">
                            <ProductThumbnail
                              src={item.product.main_image_url}
                              alt={item.product.name}
                            />
                          </div>

                          <div className="flex-1 flex justify-between items-start">
                            <h4 className="text-white text-sm font-medium leading-tight flex-1">
                              {item.product.name}
                            </h4>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-full p-1 transition-colors text-lg leading-none ml-2"
                              title="إزالة من السلة"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {/* Quantity and Price Row */}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs">
                              الكمية:
                            </span>
                            <EditableField
                              value={item.quantity}
                              type="number"
                              onUpdate={(newQuantity) => {
                                setCartItems((prev) => {
                                  const newCart = prev.map((cartItem) => {
                                    if (cartItem.id === item.id) {
                                      // Calculate the ratio of change for proportional color updates
                                      const ratio =
                                        newQuantity / cartItem.quantity;
                                      let updatedColors: {
                                        [key: string]: number;
                                      } | null = null;

                                      // If we have selected colors, update them proportionally
                                      if (cartItem.selectedColors) {
                                        updatedColors = {};
                                        Object.entries(
                                          cartItem.selectedColors,
                                        ).forEach(
                                          ([color, quantity]: [
                                            string,
                                            any,
                                          ]) => {
                                            updatedColors![color] = Math.max(
                                              1,
                                              Math.round(quantity * ratio),
                                            );
                                          },
                                        );
                                      }

                                      const newTotal = isTransferMode
                                        ? 0
                                        : cartItem.price * newQuantity;
                                      return {
                                        ...cartItem,
                                        quantity: newQuantity,
                                        selectedColors: updatedColors,
                                        total: newTotal,
                                        totalPrice: newTotal,
                                      };
                                    }
                                    return cartItem;
                                  });
                                  updateActiveTabCart(newCart);
                                  return newCart;
                                });
                              }}
                              className="text-white font-medium text-right bg-transparent border-none outline-none w-16 hover:bg-gray-600/20 rounded px-1"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            {!isTransferMode && (
                              <>
                                <span className="text-gray-400 text-xs">
                                  السعر:
                                </span>
                                <EditableField
                                  value={item.price}
                                  type="number"
                                  step="0.01"
                                  onUpdate={(newPrice) => {
                                    setCartItems((prev) => {
                                      const newCart = prev.map((cartItem) => {
                                        if (cartItem.id === item.id) {
                                          const newTotal = cartItem.quantity * newPrice;
                                          return {
                                            ...cartItem,
                                            price: newPrice,
                                            total: newTotal,
                                            totalPrice: newTotal,
                                          };
                                        }
                                        return cartItem;
                                      });
                                      updateActiveTabCart(newCart);
                                      return newCart;
                                    });
                                  }}
                                  className="text-blue-400 font-medium text-right bg-transparent border-none outline-none w-16 hover:bg-gray-600/20 rounded px-1"
                                />
                                <span className="text-blue-400 text-xs">
                                  {systemCurrency}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Colors Display */}
                        {item.selectedColors &&
                          Object.keys(item.selectedColors).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-600">
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(item.selectedColors).map(
                                  ([color, quantity]: [string, any]) => (
                                    <span
                                      key={color}
                                      className="bg-gray-600 px-2 py-1 rounded text-xs text-white"
                                    >
                                      {color}: {quantity}
                                    </span>
                                  ),
                                )}
                              </div>
                            </div>
                          )}

                        {/* Total */}
                        {!isTransferMode && (
                          <div className="mt-2 text-left">
                            <span className="text-green-400 font-bold text-sm">
                              {(item.totalPrice || (item.price * item.quantity) || 0).toFixed(2)} {systemCurrency}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cart Footer */}
            <div className="p-4 border-t border-gray-600 bg-[#2B3544] flex-shrink-0">
              {/* Payment Split Component - Show in sales, return, and purchase mode (not transfer or edit mode) */}
              {!isTransferMode && !activePOSTab?.isEditMode && (
                <PaymentSplit
                  totalAmount={calculateTotalWithDiscounts()}
                  onPaymentsChange={(payments, credit) => {
                    setPaymentSplitData(payments);
                    setCreditAmount(credit);
                  }}
                  isDefaultCustomer={isPurchaseMode ? false : selections.customer?.id === '00000000-0000-0000-0000-000000000001'}
                  isReturnMode={isReturnMode}
                  isPurchaseMode={isPurchaseMode}
                />
              )}

              {/* Single row layout for total and button */}
              <div className="flex items-center justify-between gap-3">
                {/* Total/Transfer info section */}
                <div className="flex-shrink-0">
                  {!isTransferMode ? (
                    <div className="text-right">
                      {(cartDiscount > 0 || cartItems.some(item => item.discount && item.discount > 0)) ? (
                        <>
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-gray-400 text-xs line-through">
                              {formatPrice(cartTotal, "system")}
                            </span>
                            <span className="text-orange-400 text-xs">
                              خصم {cartDiscount > 0 ? (cartDiscountType === "percentage" ? `${cartDiscount}%` : `${cartDiscount} ج.م`) : ""}
                            </span>
                          </div>
                          <div className="text-green-400 font-bold text-lg">
                            {formatPrice(calculateTotalWithDiscounts(), "system")}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-white text-sm font-medium">الإجمالي:</div>
                          <div className="text-green-400 font-bold text-lg">
                            {formatPrice(cartTotal, "system")}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="text-right">
                      <div className="text-orange-400 text-sm font-medium">وضع النقل</div>
                      <div className="text-white font-bold text-lg">
                        {cartItems.reduce((sum, item) => sum + item.quantity, 0)} قطعة
                      </div>
                    </div>
                  )}
                </div>

                {/* Button section */}
                <button
                disabled={
                  // In edit mode, allow empty cart (user might delete all items)
                  (cartItems.length === 0 && !activePOSTab?.isEditMode) ||
                  !hasAllRequiredSelections() ||
                  isProcessingInvoice
                }
                className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed text-white ${
                  activePOSTab?.isEditMode
                    ? "bg-amber-600 hover:bg-amber-700"
                    : isTransferMode
                      ? "bg-orange-600 hover:bg-orange-700"
                      : isReturnMode
                        ? "bg-red-600 hover:bg-red-700"
                        : isPurchaseMode
                          ? "bg-purple-600 hover:bg-purple-700"
                          : "bg-blue-600 hover:bg-blue-700"
                }`}
                onClick={handleCreateInvoice}
              >
                {isProcessingInvoice
                  ? "جاري المعالجة..."
                  : cartItems.length === 0 && !activePOSTab?.isEditMode
                    ? "السلة فارغة"
                    : !hasAllRequiredSelections()
                      ? "يجب إكمال التحديدات"
                      : activePOSTab?.isEditMode
                        ? `تعديل الفاتورة (${cartItems.length}) [Y]`
                        : isTransferMode
                          ? `تأكيد النقل (${cartItems.length}) [Y]`
                          : isReturnMode
                            ? isPurchaseMode
                              ? `مرتجع شراء (${cartItems.length}) [Y]`
                              : `مرتجع بيع (${cartItems.length}) [Y]`
                            : isPurchaseMode
                              ? `تأكيد الشراء (${cartItems.length}) [Y]`
                              : `تأكيد الطلب (${cartItems.length}) [Y]`}
              </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Records Selection Modal */}
      <RecordsSelectionModal
        isOpen={isRecordsModalOpen}
        onClose={() => setIsRecordsModalOpen(false)}
        onSelectRecord={handleRecordSelect}
      />

      {/* Customer Selection Modal */}
      <CustomerSelectionModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelectCustomer={handleCustomerSelect}
      />

      {/* Branch Selection Modal */}
      <BranchSelectionModal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        onSelectBranch={handleBranchSelect}
      />

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      {/* Add to Cart Modal */}
      <AddToCartModal
        isOpen={showAddToCartModal}
        onClose={() => {
          setShowAddToCartModal(false);
          setModalProduct(null);
        }}
        product={modalProduct}
        isTransferMode={isTransferMode}
        onAddToCart={(product, quantity, selectedColor) => {
          // Use the main handleAddToCart function to ensure consistent grouping
          const productWithCorrectPrice = {
            ...product,
            price: isTransferMode ? 0 : product.price || 0,
          };
          handleAddToCart(productWithCorrectPrice, quantity, selectedColor);

          // مسح البحث وإعادة التركيز على حقل البحث
          setSearchQuery("");
          setTimeout(() => {
            searchInputRef.current?.focus();
          }, 100);
        }}
      />

      {/* Color Selection Modal */}
      <ColorSelectionModal
        isOpen={showColorSelectionModal}
        onClose={() => {
          setShowColorSelectionModal(false);
          setModalProduct(null);
        }}
        product={modalProduct}
        onAddToCart={handleColorSelection}
        hasRequiredForCart={hasRequiredForCart()}
        selectedBranchId={selections.branch?.id}
        isPurchaseMode={isPurchaseMode}
        isTransferMode={isTransferMode}
        transferFromLocation={transferFromLocation}
      />

      {/* Supplier Selection Modal */}
      <SupplierSelectionModal
        isOpen={isSupplierModalOpen}
        onClose={() => {
          setIsSupplierModalOpen(false);
          setIsSupplierModalForNewPurchase(false);
        }}
        onSelect={isSupplierModalForNewPurchase ? handleSupplierSelectForPurchase : handleSupplierChange}
        selectedSupplier={selectedSupplier}
        isPurchaseMode={isSupplierModalForNewPurchase}
      />

      {/* Warehouse Selection Modal */}
      <WarehouseSelectionModal
        isOpen={isWarehouseModalOpen}
        onClose={() => setIsWarehouseModalOpen(false)}
        onSelect={setSelectedWarehouse}
        selectedWarehouse={selectedWarehouse}
      />

      {/* Transfer Location Selection Modal */}
      <TransferLocationModal
        isOpen={isTransferLocationModalOpen}
        onClose={() => setIsTransferLocationModalOpen(false)}
        onConfirm={handleTransferLocationConfirm}
      />

      {/* Price Type Selection Modal */}
      <PriceTypeSelectionModal
        isOpen={isPriceTypeModalOpen}
        onClose={() => setIsPriceTypeModalOpen(false)}
        selectedPriceType={selectedPriceType}
        onSelectPriceType={setSelectedPriceType}
      />

      {/* Discount Modal */}
      <DiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        cartItems={cartItems}
        cartDiscount={cartDiscount}
        cartDiscountType={cartDiscountType}
        onApplyItemDiscount={handleApplyItemDiscount}
        onApplyCartDiscount={handleApplyCartDiscount}
        onRemoveItemDiscount={handleRemoveItemDiscount}
        onRemoveCartDiscount={handleRemoveCartDiscount}
      />

      {/* Postponed Invoices Modal */}
      <PostponedInvoicesModal
        isOpen={isPostponedModalOpen}
        onClose={() => setIsPostponedModalOpen(false)}
        postponedTabs={postponedTabs}
        onRestoreTab={restoreTab}
        onDeleteTab={closeTab}
      />

      {/* Cash Drawer Modal */}
      <CashDrawerModal
        isOpen={isCashDrawerModalOpen}
        onClose={() => setIsCashDrawerModalOpen(false)}
        record={selections.record}
      />

      {/* Quick Add Product Modal */}
      <QuickAddProductModal
        isOpen={showQuickAddProductModal}
        onClose={() => setShowQuickAddProductModal(false)}
        onAddToCart={handleQuickAddToCart}
      />

      {/* Product Details Modal */}
      {showProductModal && modalProduct && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowProductModal(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] max-w-6xl w-full max-h-[90vh] overflow-y-auto scrollbar-hide">
              {/* Header */}
              <div className="sticky top-0 bg-[#2B3544] px-8 py-6 border-b border-[#4A5568] flex items-center justify-between rounded-t-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">📦</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      تفاصيل المنتج
                    </h2>
                    <p className="text-blue-400 font-medium">
                      {modalProduct.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-600/30 rounded-full transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-8">
                <div className="grid grid-cols-3 gap-8">
                  {/* Left Column - Product Info */}
                  <div className="space-y-6">
                    {/* Basic Info Card */}
                    <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                          <span className="text-blue-400 text-sm">ℹ️</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">
                          معلومات المنتج
                        </h3>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-gray-600/50">
                          <span className="text-gray-400">المجموعة</span>
                          <span className="text-white font-medium">
                            {modalProduct.category?.name || "غير محدد"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-600/50">
                          <span className="text-gray-400">الوحدة</span>
                          <span className="text-white font-medium">
                            {modalProduct.unit || "قطعة"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-600/50">
                          <span className="text-gray-400">الحد الأدنى</span>
                          <span className="text-white font-medium">
                            {modalProduct.min_stock || 0}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-gray-400">الباركود</span>
                          <span className="text-white font-mono text-sm">
                            {modalProduct.barcode || "غير متوفر"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pricing Card */}
                    <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center">
                          <span className="text-green-400 text-sm">💰</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">
                          الأسعار
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">
                            سعر البيع
                          </p>
                          <p className="text-green-400 font-bold text-xl">
                            {(modalProduct.price || 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">
                            سعر الشراء
                          </p>
                          <p className="text-orange-400 font-bold text-xl">
                            {(modalProduct.cost_price || 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">
                            سعر الجملة
                          </p>
                          <p className="text-blue-400 font-bold text-lg">
                            {(modalProduct.wholesale_price || 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-[#2B3544] rounded-lg p-4 text-center">
                          <p className="text-gray-400 text-sm mb-1">سعر 1</p>
                          <p className="text-purple-400 font-bold text-lg">
                            {(modalProduct.price1 || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Description Card */}
                    {modalProduct.description && (
                      <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center">
                            <span className="text-purple-400 text-sm">📝</span>
                          </div>
                          <h3 className="text-lg font-semibold text-white">
                            وصف المنتج
                          </h3>
                        </div>
                        <p className="text-gray-300 leading-relaxed">
                          {modalProduct.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Middle Column - Inventory */}
                  <div className="space-y-6">
                    {/* Total Inventory Card */}
                    <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                          <span className="text-blue-400 text-sm">📊</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">
                          المخازن والفروع
                        </h3>
                      </div>

                      {/* Total Quantity Display */}
                      <div className="bg-blue-600/10 rounded-lg p-4 mb-4 text-center border border-blue-600/20">
                        <p className="text-blue-400 text-sm mb-1">
                          الكمية الإجمالية
                        </p>
                        <p className="text-blue-400 font-bold text-3xl">
                          {(modalProduct.inventoryData &&
                            Object.values(modalProduct.inventoryData).reduce(
                              (sum: number, inv: any) =>
                                sum + (inv?.quantity || 0),
                              0,
                            )) ||
                            0}
                        </p>
                      </div>

                      {/* Branch/Warehouse Details */}
                      <div className="space-y-3">
                        {modalProduct.inventoryData &&
                          Object.entries(modalProduct.inventoryData).map(
                            ([locationId, inventory]: [string, any]) => {
                              const branch = branches.find(
                                (b) => b.id === locationId,
                              );
                              const locationName =
                                branch?.name ||
                                `موقع ${locationId.slice(0, 8)}`;

                              return (
                                <div
                                  key={locationId}
                                  className="bg-[#2B3544] rounded-lg p-4 border border-gray-600/30"
                                >
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-white font-medium">
                                      {locationName}
                                    </span>
                                    <span className="text-blue-400 font-bold text-lg">
                                      {inventory?.quantity || 0}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400">
                                      الحد الأدنى
                                    </span>
                                    <span className="text-orange-400">
                                      {inventory?.min_stock || 0}
                                    </span>
                                  </div>
                                </div>
                              );
                            },
                          )}
                      </div>
                    </div>

                    {/* Variants Card */}
                    {modalProduct.variantsData &&
                      Object.keys(modalProduct.variantsData).length > 0 && (
                        <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center">
                              <span className="text-purple-400 text-sm">
                                🎨
                              </span>
                            </div>
                            <h3 className="text-lg font-semibold text-white">
                              الألوان والأشكال
                            </h3>
                          </div>
                          <div className="space-y-3">
                            {Object.entries(modalProduct.variantsData).map(
                              ([locationId, variants]: [string, any]) => {
                                const branch = branches.find(
                                  (b) => b.id === locationId,
                                );
                                const locationName =
                                  branch?.name ||
                                  `موقع ${locationId.slice(0, 8)}`;

                                // Helper functions
                                const getVariantColor = (variant: any) => {
                                  if (variant.variant_type === 'color') {
                                    const productColor = modalProduct.productColors?.find((c: any) => c.name === variant.name)
                                    if (productColor?.color) return productColor.color
                                    if (variant.value) return variant.value
                                    if (variant.color_hex) return variant.color_hex
                                  }
                                  return '#6B7280'
                                }

                                const getTextColor = (bgColor: string) => {
                                  const hex = bgColor.replace('#', '')
                                  const r = parseInt(hex.substr(0, 2), 16)
                                  const g = parseInt(hex.substr(2, 2), 16)
                                  const b = parseInt(hex.substr(4, 2), 16)
                                  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
                                  return luminance > 0.5 ? '#000000' : '#FFFFFF'
                                }

                                // Calculate unassigned quantity
                                const totalInventoryQuantity = modalProduct.inventoryData?.[locationId]?.quantity || 0
                                const assignedQuantity = variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0)
                                const unassignedQuantity = totalInventoryQuantity - assignedQuantity

                                return (
                                  <div
                                    key={locationId}
                                    className="bg-[#2B3544] rounded-lg p-4"
                                  >
                                    <p className="text-white font-medium mb-3">
                                      {locationName}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {/* Show specified variants (colors, shapes with names) */}
                                      {variants
                                        .filter((v: any) => v.name !== 'غير محدد')
                                        .map((variant: any, index: number) => {
                                          const bgColor = getVariantColor(variant)
                                          const textColor = getTextColor(bgColor)

                                          return (
                                            <span
                                              key={index}
                                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border"
                                              style={{
                                                backgroundColor: bgColor,
                                                color: textColor,
                                                borderColor: bgColor === '#6B7280' ? '#6B7280' : bgColor
                                              }}
                                            >
                                              {variant.name} ({variant.quantity})
                                            </span>
                                          )
                                        })}

                                      {/* Show unassigned quantity if any */}
                                      {unassignedQuantity > 0 && (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white bg-gray-600 border border-gray-600">
                                          غير محدد ({unassignedQuantity})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Right Column - Images */}
                  <div className="space-y-6">
                    {/* Main Image Preview */}
                    <div className="bg-[#374151] rounded-xl p-6 border border-[#4A5568]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center">
                          <span className="text-indigo-400 text-sm">🖼️</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">
                          صور المنتج
                        </h3>
                      </div>

                      {/* Large Image Preview - OPTIMIZED */}
                      <div className="mb-4">
                        <ProductModalImage
                          src={selectedImage}
                          alt={modalProduct.name}
                          priority={true}
                        />
                      </div>

                      {/* Thumbnail Gallery */}
                      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto scrollbar-hide">
                        {modalProduct.allImages &&
                        modalProduct.allImages.length > 0 ? (
                          modalProduct.allImages.map(
                            (imageUrl: string, index: number) => (
                              <ProductThumbnail
                                key={index}
                                src={imageUrl}
                                alt={`صورة ${index + 1}`}
                                isSelected={selectedImage === imageUrl}
                                onClick={() => setSelectedImage(imageUrl)}
                              />
                            ),
                          )
                        ) : (
                          /* Fallback when no images available */
                          <div className="w-full h-16 bg-[#2B3544] rounded-md border border-gray-600/30 flex items-center justify-center col-span-4">
                            <span className="text-gray-500 text-xs">
                              لا توجد صور متاحة
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Categories Display Modal - Tree View */}
      {isCategoriesModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#2B3544] rounded-lg w-96 max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-600">
              <h3 className="text-xl font-bold text-white">المجموعات</h3>
              <button
                onClick={toggleCategoriesModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Tree View Content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
              {isLoadingCategories ? (
                <div className="text-center py-4 text-gray-400">
                  جارٍ التحميل...
                </div>
              ) : !categoryTree ? (
                <div className="text-center py-4 text-gray-400">
                  لا توجد مجموعات
                </div>
              ) : (
                // Recursive Tree Node Component
                (() => {
                  const renderTreeNode = (node: typeof categoryTree, level: number = 0): React.ReactNode => {
                    if (!node) return null;
                    const hasChildren = node.children && node.children.length > 0;
                    const isSelected = selectedCategoryId === node.id;
                    const isExpanded = expandedCategoryNodes.has(node.id) || node.name === 'منتجات';

                    return (
                      <div key={node.id}>
                        <div
                          className={`flex items-center cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'hover:bg-[#374151] text-gray-300 hover:text-white'
                          }`}
                          style={{ paddingRight: `${16 + level * 24}px`, paddingLeft: '12px', paddingTop: '10px', paddingBottom: '10px' }}
                          onClick={() => {
                            // Toggle selection - if already selected, deselect (show all products)
                            if (isSelected) {
                              setSelectedCategoryId(null);
                            } else {
                              setSelectedCategoryId(node.id);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 w-full">
                            {/* Expand/Collapse Button */}
                            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                              {hasChildren ? (
                                <button
                                  className="text-gray-400 hover:text-white w-5 h-5 flex items-center justify-center rounded hover:bg-gray-600/30"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCategoryNode(node.id);
                                  }}
                                >
                                  {isExpanded ? (
                                    <MinusIcon className="h-4 w-4" />
                                  ) : (
                                    <ChevronRightIcon className="h-4 w-4" />
                                  )}
                                </button>
                              ) : null}
                            </div>

                            {/* Folder Icon */}
                            <FolderIcon className={`h-5 w-5 flex-shrink-0 ${isSelected ? 'text-white' : 'text-gray-400'}`} />

                            {/* Category Name */}
                            <span className="text-base truncate">
                              {node.name}
                            </span>
                          </div>
                        </div>

                        {/* Children */}
                        {hasChildren && isExpanded && (
                          <div>
                            {node.children.map((child) => renderTreeNode(child, level + 1))}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return renderTreeNode(categoryTree);
                })()
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-600 space-y-2">
              {/* Clear Selection Button */}
              {selectedCategoryId && (
                <button
                  onClick={() => setSelectedCategoryId(null)}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <XMarkIcon className="h-4 w-4" />
                  إظهار جميع المنتجات
                </button>
              )}
              {/* Close Button */}
              <button
                onClick={toggleCategoriesModal}
                className="w-full py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Mode Confirmation Modal */}
      {showPurchaseModeConfirm && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowPurchaseModeConfirm(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] w-full max-w-md">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#4A5568]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                    <ShoppingBagIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      تفعيل وضع الشراء
                    </h2>
                    <p className="text-gray-400 text-sm">تأكيد تبديل الوضع</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-4">
                  <p className="text-orange-400 text-sm flex items-center gap-2">
                    <span className="text-orange-400">⚠️</span>
                    سيتم تغيير واجهة نقطة البيع لوضع الشراء
                  </p>
                </div>

                <div className="space-y-3 text-gray-300 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">•</span>
                    <span>سيتم استبدال اختيار العميل باختيار المورد</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">•</span>
                    <span>سيتم إضافة خيار اختيار المخزن أو الفرع</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">•</span>
                    <span>سيتم تعطيل اختيار الألوان والأشكال</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">•</span>
                    <span>سيتم إضافة إمكانية إنشاء منتجات جديدة</span>
                  </div>
                </div>

                <p className="text-white font-medium mt-4 text-center">
                  هل تريد تفعيل وضع الشراء؟
                </p>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-[#4A5568]">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPurchaseModeConfirm(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={confirmPurchaseMode}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingBagIcon className="h-5 w-5" />
                    تفعيل وضع الشراء
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Print Receipt Confirmation Modal */}
      {showPrintReceiptModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowPrintReceiptModal(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] w-full max-w-md">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#4A5568]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                    <PrinterIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      طباعة الفاتورة
                    </h2>
                    <p className="text-gray-400 text-sm">
                      تم إنشاء الفاتورة بنجاح
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
                  <p className="text-green-400 text-sm flex items-center gap-2 mb-2">
                    <span className="text-green-400">✅</span>
                    تم إنشاء{" "}
                    {lastInvoiceData?.isReturn ? "المرتجع" : "الفاتورة"} بنجاح
                  </p>
                  <div className="text-white text-sm space-y-1">
                    <p>
                      رقم الفاتورة:{" "}
                      <span className="font-bold">
                        {lastInvoiceData?.invoiceNumber}
                      </span>
                    </p>
                    <p>
                      الإجمالي:{" "}
                      <span className="font-bold text-green-400">
                        {formatPrice(
                          lastInvoiceData?.totalAmount || 0,
                          "system",
                        )}
                      </span>
                    </p>
                    <p>
                      عدد الأصناف:{" "}
                      <span className="font-bold">
                        {lastInvoiceData?.cartItems?.length}
                      </span>
                    </p>
                  </div>
                </div>

                <p className="text-white font-medium text-center mb-4">
                  هل تريد طباعة الفاتورة؟
                </p>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-[#4A5568]">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPrintReceiptModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    لا، شكراً
                  </button>
                  <button
                    onClick={() => {
                      printReceipt(lastInvoiceData);
                      setShowPrintReceiptModal(false);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <PrinterIcon className="h-5 w-5" />
                    نعم، اطبع الفاتورة
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        /* Enhanced scrollbar styles for table container */
        .custom-scrollbar {
          /* For Firefox */
          scrollbar-width: thin;
          scrollbar-color: #6b7280 #374151;
        }

        .custom-scrollbar::-webkit-scrollbar {
          height: 12px; /* Horizontal scrollbar height */
          width: 12px; /* Vertical scrollbar width */
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: #374151;
          border-radius: 7px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #6b7280;
          border-radius: 7px;
          border: 2px solid #374151;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }

        /* Enhanced scrollbar visibility */
        .custom-scrollbar::-webkit-scrollbar:horizontal {
          height: 12px;
          display: block;
        }

        .custom-scrollbar::-webkit-scrollbar:vertical {
          width: 12px;
          display: block;
        }

        /* Ensure proper scrolling behavior */
        .table-container {
          position: relative;
        }

        /* Utility classes for grid view */
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .scrollbar-hide {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Columns Control Modal */}
      <ColumnsControlModal
        isOpen={showColumnsModal}
        onClose={() => setShowColumnsModal(false)}
        columns={getAllColumns()}
        onColumnsChange={handleColumnsChange}
      />

      {/* Cart Modal */}
      <CartModal
        isOpen={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
      />

      {/* Add Tab Modal */}
      {showAddTabModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowAddTabModal(false)}>
          <div className="bg-[#2B3544] rounded-lg p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white text-lg font-medium mb-4">إضافة نافذة بيع جديدة</h3>
            <input
              type="text"
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              placeholder="اسم النافذة..."
              className="w-full px-4 py-2 bg-[#374151] border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newTabName.trim()) {
                  addTab(newTabName.trim());
                  setNewTabName("");
                  setShowAddTabModal(false);
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setNewTabName("");
                  setShowAddTabModal(false);
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  if (newTabName.trim()) {
                    addTab(newTabName.trim());
                    setNewTabName("");
                    setShowAddTabModal(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                disabled={!newTabName.trim()}
              >
                موافق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function POSPage() {
  return (
    <CartProvider>
      <POSPageContent />
    </CartProvider>
  );
}
