'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatPrice } from '@/lib/hooks/useCurrency';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { useStoreTheme } from '@/lib/hooks/useStoreTheme';
import { useAuth } from '@/app/lib/hooks/useAuth';
import PaymentModal from '@/app/components/PaymentModal';
import ImageViewerModal from '@/app/components/ImageViewerModal';
import { paymentService, PaymentReceipt } from '@/lib/services/paymentService';
import { CreditCardIcon } from '@heroicons/react/24/outline';

// Order status type
type OrderStatus = 'pending' | 'processing' | 'ready_for_pickup' | 'ready_for_shipping' | 'shipped' | 'delivered' | 'cancelled' | 'issue';

// Order delivery type
type DeliveryType = 'pickup' | 'delivery';

// Order interface
interface Order {
  id: string;
  orderId: string; // Added database ID
  date: string;
  total: number;
  subtotal?: number | null;
  shipping?: number | null;
  status: OrderStatus;
  deliveryType: DeliveryType;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    image?: string;
    barcode?: string;
    isPrepared?: boolean; // Added for preparation tracking
  }[];
}

const statusTranslations: Record<OrderStatus, string> = {
  pending: 'معلق',
  processing: 'يتم التحضير',
  ready_for_pickup: 'جاهز للاستلام',
  ready_for_shipping: 'جاهز للشحن',
  shipped: 'مع شركة الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
  issue: 'مشكله'
};

const statusColors: Record<OrderStatus, string> = {
  pending: '#EF4444', // Red
  processing: '#F59E0B', // Yellow
  ready_for_pickup: '#86EFAC', // Light Green
  ready_for_shipping: '#FB923C', // Orange
  shipped: '#3B82F6', // Blue
  delivered: '#059669', // Dark Green
  cancelled: '#6B7280', // Gray
  issue: '#8B5CF6' // Purple
};

export default function OrdersPage() {
  const router = useRouter();
  const formatPrice = useFormatPrice();
  const { logoUrl, isLoading: isCompanyLoading } = useCompanySettings();
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();

  // Get store theme colors
  const { primaryColor, primaryHoverColor, isLoading: isThemeLoading } = useStoreTheme();
  const [activeTab, setActiveTab] = useState<'completed' | 'pending'>('completed');
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentProgress, setPaymentProgress] = useState<Record<string, any>>({});
  const [showPaymentAlert, setShowPaymentAlert] = useState(false);
  const [newOrderAmount, setNewOrderAmount] = useState<number>(0);

  // Receipt images states
  const [orderReceipts, setOrderReceipts] = useState<Record<string, PaymentReceipt[]>>({});
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [deletingReceiptId, setDeletingReceiptId] = useState<string | null>(null);
  

  // Load orders from database
  useEffect(() => {
    const loadOrders = async () => {
      // Wait for auth to be ready
      if (isAuthLoading) return;

      // If not authenticated, show empty orders
      if (!isAuthenticated || !user?.id) {
        setOrders([]);
        setLoading(false);
        return;
      }

      try {
        // Use API route instead of direct Supabase query
        const response = await fetch('/api/user/orders');

        if (!response.ok) {
          console.error('Error fetching orders:', response.statusText);
          setOrders([]);
          setLoading(false);
          return;
        }

        const ordersData = await response.json();

        // Transform data to match our Order interface and filter out orders with no items
        const transformedOrders: Order[] = (ordersData || [])
          .filter((order: any) => order.order_items && order.order_items.length > 0) // Filter out empty orders
          .map((order: any) => {
            // First, map all items
            const rawItems = order.order_items.map((item: any) => ({
              id: item.id.toString(),
              product_id: item.products?.id,
              name: item.products?.name || 'منتج غير معروف',
              quantity: item.quantity,
              price: parseFloat(item.unit_price),
              image: item.products?.main_image_url || undefined,
              barcode: item.products?.barcode || null,
              isPrepared: false // Initialize as not prepared
            }));

            // Group items by product_id and combine quantities
            const groupedItemsMap = new Map();
            rawItems.forEach((item: any) => {
              const key = item.product_id || item.name; // Use product_id as key, fallback to name
              if (groupedItemsMap.has(key)) {
                const existingItem = groupedItemsMap.get(key);
                existingItem.quantity += item.quantity;
                // Keep the prepared status as true if any of the items is prepared
                existingItem.isPrepared = existingItem.isPrepared || item.isPrepared;
              } else {
                groupedItemsMap.set(key, { ...item });
              }
            });

            // Convert back to array
            const groupedItems = Array.from(groupedItemsMap.values());

            return {
              id: order.order_number,
              orderId: order.id, // Store database ID
              date: order.created_at.split('T')[0], // Extract date part
              total: parseFloat(order.total_amount),
              subtotal: order.subtotal_amount ? parseFloat(order.subtotal_amount) : null,
              shipping: order.shipping_amount ? parseFloat(order.shipping_amount) : null,
              status: order.status,
              deliveryType: order.delivery_type || 'pickup',
              customerName: order.customer_name || 'غير محدد',
              customerPhone: order.customer_phone || 'غير محدد',
              customerAddress: order.customer_address || 'غير محدد',
              items: groupedItems
            };
          });

        setOrders(transformedOrders);
        setLoading(false);
      } catch (error) {
        console.error('Error loading orders:', error);
        setLoading(false);
      }
    };

    loadOrders();
  }, [user?.id, isAuthLoading, isAuthenticated]);

  // Filter orders based on active tab and date range
  useEffect(() => {
    let filtered = orders;

    // Filter by status
    if (activeTab === 'completed') {
      filtered = orders.filter(order => order.status === 'delivered');
    } else {
      filtered = orders.filter(order => order.status !== 'delivered');
    }

    // Filter by date range for completed orders
    if (activeTab === 'completed' && (dateFrom || dateTo)) {
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.date);
        const fromDate = dateFrom ? new Date(dateFrom) : null;
        const toDate = dateTo ? new Date(dateTo) : null;

        if (fromDate && orderDate < fromDate) return false;
        if (toDate && orderDate > toDate) return false;
        return true;
      });
    }

    setFilteredOrders(filtered);
    
    // Set default expanded state for orders
    const newExpandedOrders = new Set<string>();
    filtered.forEach(order => {
      // Auto-expand non-delivered orders (pending, processing, ready_for_pickup, ready_for_shipping, shipped)
      if (order.status !== 'delivered') {
        newExpandedOrders.add(order.id);
      }
    });
    setExpandedOrders(newExpandedOrders);
  }, [orders, activeTab, dateFrom, dateTo]);

  // Load payment progress for all orders
  useEffect(() => {
    const loadAllPaymentProgress = async () => {
      if (!orders || orders.length === 0) return;

      const progressMap: any = {};
      for (const order of orders) {
        try {
          const progress = await paymentService.getOrderPaymentProgress(order.orderId);
          progressMap[order.orderId] = progress;
        } catch (error) {
          console.error(`Failed to load payment progress for order ${order.orderId}:`, error);
          // Set default values if fetch fails
          progressMap[order.orderId] = {
            totalAmount: order.total,
            totalPaid: 0,
            paymentProgress: 0,
            fullyPaid: false
          };
        }
      }
      setPaymentProgress(progressMap);
    };

    loadAllPaymentProgress();
  }, [orders]);

  // Load payment receipts for all orders
  useEffect(() => {
    const loadAllReceipts = async () => {
      if (!orders || orders.length === 0) return;

      const receiptsMap: Record<string, PaymentReceipt[]> = {};
      for (const order of orders) {
        try {
          const receipts = await paymentService.getOrderPaymentReceipts(order.orderId);
          receiptsMap[order.orderId] = receipts;
        } catch (error) {
          console.error(`Failed to load receipts for order ${order.orderId}:`, error);
          receiptsMap[order.orderId] = [];
        }
      }
      setOrderReceipts(receiptsMap);
    };

    loadAllReceipts();
  }, [orders]);

  // Toggle order expansion
  const toggleOrderExpansion = (orderId: string) => {
    const newExpandedOrders = new Set(expandedOrders);
    if (newExpandedOrders.has(orderId)) {
      newExpandedOrders.delete(orderId);
    } else {
      newExpandedOrders.add(orderId);
    }
    setExpandedOrders(newExpandedOrders);
  };

  // Open payment modal
  const openPaymentModal = (orderId: string) => {
    if (!user?.id) {
      alert('يرجى تسجيل الدخول أولاً');
      return;
    }

    setSelectedOrderId(orderId);
    setSelectedCustomerId(user.id);
    setShowPaymentModal(true);
  };

  // Handle payment uploaded
  const handlePaymentUploaded = () => {
    // Reload payment progress and receipts
    const loadAllPaymentData = async () => {
      if (!orders || orders.length === 0) return;

      const progressMap: any = {};
      const receiptsMap: Record<string, PaymentReceipt[]> = {};

      for (const order of orders) {
        try {
          const progress = await paymentService.getOrderPaymentProgress(order.orderId);
          progressMap[order.orderId] = progress;

          const receipts = await paymentService.getOrderPaymentReceipts(order.orderId);
          receiptsMap[order.orderId] = receipts;
        } catch (error) {
          console.error(`Failed to load payment data for order ${order.orderId}:`, error);
        }
      }

      setPaymentProgress(progressMap);
      setOrderReceipts(receiptsMap);
    };

    loadAllPaymentData();
  };

  // Open image viewer
  const openImageViewer = (images: string[], index: number = 0) => {
    setSelectedImages(images);
    setSelectedImageIndex(index);
    setShowImageViewer(true);
  };

  // Handle delete receipt
  const handleDeleteReceipt = async (receiptId: string, imageUrl: string, orderId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الإيصال؟')) {
      return;
    }

    setDeletingReceiptId(receiptId);

    try {
      console.log('🗑️ UI: Starting receipt deletion...', { receiptId, orderId });
      console.log('📊 Current receipts count BEFORE deletion:', orderReceipts[orderId]?.length || 0);

      // Delete from database FIRST (no optimistic update to avoid confusion)
      await paymentService.deletePaymentReceipt(receiptId, imageUrl, orderId);

      console.log('✅ UI: Receipt deleted from database successfully');

      // Wait a moment to ensure database transaction completes
      await new Promise(resolve => setTimeout(resolve, 500));

      // Reload receipts from database
      console.log('📋 UI: Reloading receipts from database...');
      const receipts = await paymentService.getOrderPaymentReceipts(orderId);
      console.log('📊 UI: Reloaded receipts count AFTER deletion:', receipts.length);
      console.log('📋 UI: Receipt IDs after reload:', receipts.map(r => r.id));

      setOrderReceipts(prev => ({
        ...prev,
        [orderId]: receipts
      }));

      // Reload payment progress to get updated amounts
      console.log('💰 UI: Reloading payment progress...');
      const progress = await paymentService.getOrderPaymentProgress(orderId);
      console.log('💵 UI: Updated payment progress:', progress);

      setPaymentProgress(prev => ({
        ...prev,
        [orderId]: progress
      }));

      alert('تم حذف الإيصال بنجاح ✓');
    } catch (error: any) {
      console.error('❌ UI: Error deleting receipt:', error);
      console.error('❌ UI: Full error object:', JSON.stringify(error, null, 2));

      // Reload data on error to restore correct state
      try {
        const receipts = await paymentService.getOrderPaymentReceipts(orderId);
        console.log('🔄 UI: Restored receipts after error:', receipts.length);
        setOrderReceipts(prev => ({
          ...prev,
          [orderId]: receipts
        }));
      } catch (reloadError) {
        console.error('❌ UI: Failed to reload receipts after error:', reloadError);
      }

      alert(`فشل حذف الإيصال: ${error.message}\n\nتحقق من Console للمزيد من التفاصيل`);
    } finally {
      setDeletingReceiptId(null);
    }
  };



  if (loading || isCompanyLoading || isThemeLoading || isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: '#c0c0c0'}}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل الطلبات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-800" style={{backgroundColor: '#c0c0c0'}}>
      {/* Hide system blue header */}
      <style jsx global>{`
        body {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        html {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        /* Hide any potential system headers */
        iframe,
        .system-header,
        [class*="system"],
        [class*="navigation"] {
          display: none !important;
        }
      `}</style>

      {/* Store Header (Red) */}
      <header className="border-b border-gray-700 py-0 relative z-40" style={{backgroundColor: 'var(--primary-color)'}}>
        <div className="relative flex items-center min-h-[60px] md:min-h-[80px]">
          <div className="max-w-[95%] md:max-w-[95%] lg:max-w-[80%] mx-auto px-2 md:px-3 lg:px-4 flex items-center justify-between min-h-[60px] md:min-h-[80px] w-full">
            
            {/* زر العودة - اليسار */}
            <button
              onClick={() => router.back()}
              className="flex items-center p-2 text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden md:inline mr-2">العودة</span>
            </button>

            {/* النص الرئيسي - الوسط */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <h1 className="text-lg md:text-2xl font-bold text-white text-center whitespace-nowrap">
                قائمة الطلبات
              </h1>
            </div>

            {/* اللوجو - اليمين */}
            <div className="flex items-center">
              <img src={logoUrl || '/assets/logo/Hegazy.png'} alt="الفاروق" className="h-12 w-12 md:h-16 md:w-16 object-contain" />
            </div>

          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[98%] md:max-w-[95%] lg:max-w-[80%] mx-auto px-2 md:px-3 lg:px-4 py-4 md:py-5 lg:py-8">
        {/* Tabs */}
        <div className="flex flex-wrap md:flex-nowrap mb-4 md:mb-6 lg:mb-8 bg-white rounded-lg overflow-hidden shadow-lg">
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 min-w-0 py-2 md:py-4 px-2 md:px-6 text-sm md:text-base font-semibold transition-colors ${
              activeTab === 'completed'
                ? 'text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            style={{
              backgroundColor: activeTab === 'completed' ? 'var(--primary-color)' : 'transparent'
            }}
          >
            الطلبات المنفذة
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 min-w-0 py-2 md:py-4 px-2 md:px-6 text-sm md:text-base font-semibold transition-colors ${
              activeTab === 'pending'
                ? 'text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            style={{
              backgroundColor: activeTab === 'pending' ? 'var(--primary-color)' : 'transparent'
            }}
          >
            الطلبات قيد التنفيذ
          </button>
        </div>

        {/* Payment Alert */}
        {showPaymentAlert && newOrderAmount > 0 && (
          <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-4 md:p-6 mb-4 md:mb-5 lg:mb-6 shadow-lg relative">
            <button
              onClick={() => setShowPaymentAlert(false)}
              className="absolute top-2 left-2 text-orange-600 hover:text-orange-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-orange-500 text-3xl">⚠️</div>
              <div className="flex-1">
                <h3 className="text-lg md:text-xl font-bold text-orange-800 mb-2">تنبيه مهم</h3>
                <p className="text-base md:text-lg text-orange-900 mb-2">لقد قمت بطلب أوردر بنجاح!</p>
                <p className="text-base md:text-lg font-bold text-orange-900 mb-3">
                  المبلغ المطلوب: {formatPrice(newOrderAmount)}
                </p>
                <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 md:p-4">
                  <p className="text-sm md:text-base text-orange-900 leading-relaxed">
                    من فضلك قم بتحويل المبلغ المطلوب وارفع صورة إيصال التحويل حتى يتم مراجعتها وتأكيد طلبك.
                    <br />
                    <strong>لن يتم تنفيذ الطلب إلا بعد تأكيد الدفع.</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Date Filter (only for completed orders) */}
        {activeTab === 'completed' && (
          <div className="bg-white rounded-lg p-3 md:p-4 lg:p-6 mb-4 md:mb-5 lg:mb-6 shadow-lg">
            <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-800">فلتر التاريخ</h3>
            <div className="flex flex-wrap gap-2 md:gap-3 lg:gap-4">
              <div className="flex flex-col flex-1 min-w-[140px]">
                <label className="text-xs md:text-sm text-gray-600 mb-1">من تاريخ</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2 md:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 text-sm md:text-base"
                  style={{"--tw-ring-color": "var(--primary-color)"} as React.CSSProperties}
                />
              </div>
              <div className="flex flex-col flex-1 min-w-[140px]">
                <label className="text-xs md:text-sm text-gray-600 mb-1">إلى تاريخ</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2 md:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 text-sm md:text-base"
                  style={{"--tw-ring-color": "var(--primary-color)"} as React.CSSProperties}
                />
              </div>
              <div className="flex items-end w-full md:w-auto mt-2 md:mt-0">
                <button
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="w-full md:w-auto px-3 md:px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm md:text-base"
                >
                  مسح الفلتر
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Orders List */}
        <div className="space-y-2 md:space-y-3 lg:space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-lg p-4 md:p-8 shadow-lg text-center">
              <div className="text-gray-400 text-4xl md:text-6xl mb-2 md:mb-4">📦</div>
              <h3 className="text-lg md:text-xl font-semibold text-gray-600 mb-1 md:mb-2">
                {activeTab === 'completed' ? 'لا توجد طلبات منفذة' : 'لا توجد طلبات قيد التنفيذ'}
              </h3>
              <p className="text-gray-500 mb-4">
                {activeTab === 'completed' 
                  ? 'لم تقم بأي طلبات مكتملة بعد' 
                  : 'جميع طلباتك مكتملة'
                }
              </p>
              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-2 rounded-lg text-white transition-colors"
                style={{backgroundColor: 'var(--primary-color)'}}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)';
                }}
              >
                تصفح المنتجات
              </button>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isExpanded = expandedOrders.has(order.id);
              const orderProgress = paymentProgress[order.orderId] || {
                totalAmount: order.total,
                totalPaid: 0,
                paymentProgress: 0,
                fullyPaid: false
              };

              const { totalAmount, totalPaid, paymentProgress: progress, fullyPaid } = orderProgress;
              const remaining = totalAmount - totalPaid;

              const receipts = orderReceipts[order.orderId] || [];
              const receiptImages = receipts.map(r => r.receipt_image_url);

              return (
                <div key={order.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  {/* Order Header - Status + Order Info */}
                  <div className="px-3 md:px-4 lg:px-6 py-3 md:py-4 border-b border-gray-200">
                    <div className="flex items-center gap-4">
                      {/* Status Badge + Order Info grouped together */}
                      <div className="flex items-center gap-3 md:gap-4">
                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-full text-base md:text-lg font-bold ${
                            order.status === 'ready_for_pickup' ? 'text-green-800' : 'text-white'
                          }`}
                          style={{ backgroundColor: statusColors[order.status] }}
                        >
                          {statusTranslations[order.status]}
                        </span>

                        {/* Order Number + Date */}
                        <div className="text-right">
                          <span className="text-xs md:text-sm font-medium text-gray-700 block">
                            طلب رقم: {order.id}
                          </span>
                          <span className="text-sm md:text-base font-bold text-gray-700">
                            {new Date(order.date).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order Content - Always Visible */}
                  <div 
                    className="px-3 md:px-4 lg:px-6 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleOrderExpansion(order.id)}
                  >
                    
                    {/* Mobile View: Stacked Layout */}
                    <div className="md:hidden pt-2 pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-blue-600">معلومات الطلب</h4>
                        {/* Collapse/Expand Arrow */}
                        <svg 
                          className={`w-5 h-5 text-gray-500 transform transition-transform duration-200 ${
                            isExpanded ? 'rotate-90' : 'rotate-0'
                          }`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      
                      {/* Customer Information */}
                      <div className="space-y-1 text-sm">
                        <p className="text-gray-700">اسم العميل: {order.customerName}</p>
                        <p className="text-gray-700">رقم الهاتف: {order.customerPhone}</p>
                        <p className="text-gray-700">العنوان: {order.customerAddress}</p>
                      </div>
                      
                      {/* Separator Line */}
                      <hr className="border-t border-gray-300 my-3" />
                      
                      {/* Financial Details */}
                      <div className="space-y-1 text-sm">
                        {order.subtotal && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">مبلغ الفاتورة:</span>
                            <span className="text-gray-800 font-medium">{formatPrice(order.subtotal)}</span>
                          </div>
                        )}
                        {order.shipping && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">الشحن:</span>
                            <span className="text-gray-800 font-medium">{formatPrice(order.shipping)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold text-base pt-1 border-t border-gray-200">
                          <span className="text-gray-800">الإجمالي:</span>
                          <span className="text-gray-800">{formatPrice(order.total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Desktop/Tablet View: Side by Side Layout */}
                    <div className="hidden md:block pt-2 pb-4">
                      <div className="grid grid-cols-12 gap-4 md:gap-6 lg:gap-8">
                        {/* Customer Information - Left Side (takes more space) */}
                        <div className="col-span-5">
                          <h5 className="text-lg font-semibold text-blue-600 mb-4">معلومات العميل</h5>
                          <div className="space-y-3 text-lg">
                            <p className="text-gray-700">الاسم: {order.customerName}</p>
                            <p className="text-gray-700">الهاتف: {order.customerPhone}</p>
                            <p className="text-gray-700">العنوان: {order.customerAddress}</p>
                          </div>
                        </div>

                        {/* Financial Details - Middle */}
                        <div className="col-span-3 flex flex-col">
                          <div className="flex justify-between items-center mb-4">
                            <h5 className="text-lg font-semibold text-blue-600">التفاصيل المالية</h5>
                            {/* Collapse/Expand Arrow */}
                            <svg
                              className={`w-6 h-6 text-gray-500 transform transition-transform duration-200 ${
                                isExpanded ? 'rotate-90' : 'rotate-0'
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>

                          <div className="space-y-2 text-base bg-gray-50 rounded-lg p-3 md:p-4">
                            {order.subtotal && (
                              <div className="flex justify-between items-center gap-4">
                                <span className="text-gray-600 text-sm">مبلغ الفاتورة:</span>
                                <span className="text-gray-800 font-medium whitespace-nowrap text-sm">{formatPrice(order.subtotal)}</span>
                              </div>
                            )}
                            {order.shipping && (
                              <div className="flex justify-between items-center gap-4">
                                <span className="text-gray-600 text-sm">الشحن:</span>
                                <span className="text-gray-800 font-medium whitespace-nowrap text-sm">{formatPrice(order.shipping)}</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center gap-4 font-semibold text-base pt-2 border-t border-gray-200">
                              <span className="text-gray-800">المبلغ الإجمالي:</span>
                              <span className="text-gray-800 whitespace-nowrap">{formatPrice(order.total)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Payment Information - Right Side */}
                        <div className="col-span-4 flex flex-col">
                          <h5 className="text-lg font-semibold text-blue-600 mb-4">معلومات الدفع</h5>
                          <div className="space-y-3 text-base bg-gray-50 rounded-lg p-3 md:p-4">
                            {/* Payment Progress */}
                            <div className="space-y-2">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-gray-600 text-sm">المطلوب:</span>
                                <span className="text-gray-800 font-medium whitespace-nowrap text-sm">{formatPrice(totalAmount)}</span>
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-gray-600 text-sm">المدفوع:</span>
                                <span className="text-green-600 font-medium whitespace-nowrap text-sm">{formatPrice(totalPaid)}</span>
                              </div>
                              {!fullyPaid && (
                                <div className="flex justify-between items-center gap-2 border-t border-gray-200 pt-2">
                                  <span className="text-gray-600 text-sm">المتبقي:</span>
                                  <span className="text-orange-600 font-semibold whitespace-nowrap text-sm">{formatPrice(remaining)}</span>
                                </div>
                              )}
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-3">
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>نسبة الدفع</span>
                                <span className="font-semibold">{progress}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${fullyPaid ? 'bg-green-500' : 'bg-blue-500'}`}
                                  style={{width: `${progress}%`}}
                                />
                              </div>
                            </div>

                            {/* Receipt Images */}
                            {receiptImages.length > 0 && (
                              <div className="border-t border-gray-200 pt-3">
                                <div className="text-sm font-semibold text-gray-700 mb-2">إيصالات التحويل:</div>
                                <div className="grid grid-cols-2 gap-2">
                                  {receipts.map((receipt, idx) => {
                                    const isVerified = receipt.payment_status === 'verified';
                                    return (
                                    <div
                                      key={receipt.id}
                                      className="relative w-full h-20 bg-gray-200 rounded-lg overflow-hidden group"
                                    >
                                      {/* Receipt Image */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openImageViewer(receiptImages, idx);
                                        }}
                                        className="w-full h-full hover:ring-2 hover:ring-blue-500 transition-all"
                                      >
                                        <img
                                          src={receipt.receipt_image_url}
                                          alt={`إيصال ${idx + 1}`}
                                          className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                          <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                          </svg>
                                        </div>
                                      </button>

                                      {/* Verified Badge */}
                                      {isVerified && (
                                        <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full p-1">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        </div>
                                      )}

                                      {/* Delete Button - Only show for non-verified receipts */}
                                      {!isVerified && (
                                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteReceipt(receipt.id, receipt.receipt_image_url, order.orderId);
                                            }}
                                            disabled={deletingReceiptId === receipt.id}
                                            className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="حذف الإيصال"
                                          >
                                            {deletingReceiptId === receipt.id ? (
                                              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                              </svg>
                                            ) : (
                                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                            )}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    );
                                  })}
                                </div>

                                {/* Verified Receipts Summary */}
                                {receipts.some(r => r.payment_status === 'verified') && (
                                  <div className="mt-3 flex items-center gap-2 text-sm bg-green-50 border border-green-200 rounded-lg p-2">
                                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-green-800 font-medium">تم تأكيد التحويل</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Upload Button */}
                            {!fullyPaid && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPaymentModal(order.orderId);
                                }}
                                className="w-full py-2 bg-[#7d2e2e] hover:bg-[#6d2525] text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 mt-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                رفع إيصال الدفع
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order Items - Responsive: Mobile Cards, Desktop/Tablet Table */}
                  {isExpanded && (
                    <div className="px-3 md:px-4 lg:px-6 pb-4 md:pb-5 lg:pb-6 border-t border-gray-200">
                      <div className="pt-4">
                        <h4 className="text-sm font-semibold text-blue-600 mb-3">عناصر الطلب</h4>
                        
                        {/* Mobile View: Items as Cards */}
                        <div className="md:hidden space-y-3">
                          {order.items.map((item) => (
                            <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex gap-3">
                                {/* Product Image */}
                                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                  {item.image ? (
                                    <img 
                                      src={item.image} 
                                      alt={item.name}
                                      className="w-full h-full object-cover rounded-lg"
                                    />
                                  ) : (
                                    <span className="text-gray-400 text-xl">📦</span>
                                  )}
                                </div>

                                {/* Product Details */}
                                <div className="flex-1 min-w-0">
                                  {/* Product Name */}
                                  <h5 className="font-semibold text-gray-800 text-sm mb-1 line-clamp-2">{item.name}</h5>
                                  
                                  {/* Price and Quantity Info */}
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-600">السعر:</span>
                                      <span className="text-sm font-medium text-gray-800">{formatPrice(item.price || 0)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-600">الكمية:</span>
                                      <span className="text-sm font-bold text-blue-600">{item.quantity}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-gray-200 pt-1">
                                      <span className="text-xs text-gray-800 font-medium">الإجمالي:</span>
                                      <span className="text-sm font-bold text-gray-800">
                                        {formatPrice(item.quantity * (item.price || 0))}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Desktop View: Full Table with All Columns */}
                        <div className="hidden lg:block bg-gray-50 rounded-lg overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead style={{backgroundColor: '#f8f8f8'}}>
                                <tr className="text-right">
                                  <th className="px-6 py-4 text-base font-semibold text-gray-800">المنتج</th>
                                  <th className="px-6 py-4 text-base font-semibold text-gray-800 text-center">السعر</th>
                                  <th className="px-6 py-4 text-base font-semibold text-gray-800 text-center">الكمية</th>
                                  <th className="px-6 py-4 text-base font-semibold text-gray-800 text-center">الإجمالي</th>
                                  <th className="px-6 py-4 text-base font-semibold text-gray-800 text-center">ملاحظات</th>
                                  <th className="px-6 py-4 text-base font-semibold text-gray-800 text-center">الأوزان</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {order.items.map((item, index) => (
                                  <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                    <td className="px-6 py-4">
                                      <div className="flex gap-4 items-center">
                                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                          {item.image ? (
                                            <img 
                                              src={item.image} 
                                              alt={item.name}
                                              className="w-full h-full object-cover rounded-lg"
                                            />
                                          ) : (
                                            <span className="text-gray-400 text-lg">📦</span>
                                          )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <h6 className="font-medium text-gray-800 text-base break-words">{item.name}</h6>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span className="text-base font-medium text-gray-800">
                                        {formatPrice(item.price || 0)}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-800 rounded-full text-base font-bold">
                                        {item.quantity}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span className="text-base font-bold text-gray-800">
                                        {formatPrice(item.quantity * (item.price || 0))}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-base text-gray-600">-</td>
                                    <td className="px-6 py-4 text-center text-base text-gray-600">-</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Tablet View: Compact Table (No Notes/Weights) */}
                        <div className="hidden md:block lg:hidden bg-gray-50 rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead style={{backgroundColor: '#f8f8f8'}}>
                              <tr className="text-right">
                                <th className="px-4 py-3 text-base font-semibold text-gray-800">المنتج</th>
                                <th className="px-4 py-3 text-base font-semibold text-gray-800 text-center">السعر</th>
                                <th className="px-4 py-3 text-base font-semibold text-gray-800 text-center">الكمية</th>
                                <th className="px-4 py-3 text-base font-semibold text-gray-800 text-center">الإجمالي</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {order.items.map((item, index) => (
                                <tr key={`tablet-${item.id}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                  <td className="px-4 py-3">
                                    <div className="flex gap-3 items-center">
                                      <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                        {item.image ? (
                                          <img 
                                            src={item.image} 
                                            alt={item.name}
                                            className="w-full h-full object-cover rounded-lg"
                                          />
                                        ) : (
                                          <span className="text-gray-400 text-sm">📦</span>
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <h6 className="font-medium text-gray-800 text-sm break-words line-clamp-2">{item.name}</h6>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="text-sm font-medium text-gray-800 whitespace-nowrap">
                                      {formatPrice(item.price || 0)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-bold">
                                      {item.quantity}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="text-sm font-bold text-gray-800 whitespace-nowrap">
                                      {formatPrice(item.quantity * (item.price || 0))}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        orderId={selectedOrderId}
        customerId={selectedCustomerId}
        orderAmount={paymentProgress[selectedOrderId]?.totalAmount || 0}
        currentPaid={paymentProgress[selectedOrderId]?.totalPaid || 0}
        onPaymentUploaded={handlePaymentUploaded}
      />

      {/* Image Viewer Modal */}
      <ImageViewerModal
        isOpen={showImageViewer}
        onClose={() => setShowImageViewer(false)}
        images={selectedImages}
        initialIndex={selectedImageIndex}
      />
    </div>
  );
}