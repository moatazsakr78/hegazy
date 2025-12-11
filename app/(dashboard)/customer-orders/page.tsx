'use client';

import { useState, useEffect } from 'react';
import PrepareOrderModal from '../../components/PrepareOrderModal';
import OrderPaymentReceipts from '../../components/OrderPaymentReceipts';
import { useFormatPrice } from '@/lib/hooks/useCurrency';
import { supabase } from '../../lib/supabase/client';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { useStoreTheme } from '@/lib/hooks/useStoreTheme';
import { paymentService, PaymentReceipt } from '@/lib/services/paymentService';
import { useOrders, Order, OrderStatus, DeliveryType } from '../../lib/hooks/useOrders';

const statusTranslations: Record<OrderStatus, string> = {
  pending: 'معلق',
  processing: 'يتم التحضير',
  ready_for_pickup: 'جاهز للاستلام',
  ready_for_shipping: 'جاهز للشحن',
  shipped: 'تم الشحن',
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

const statusIcons: Record<OrderStatus, string> = {
  pending: '⏳',
  processing: '👨‍🍳',
  ready_for_pickup: '✅',
  ready_for_shipping: '📦',
  shipped: '🚛',
  delivered: '✅',
  cancelled: '❌',
  issue: '⚠️'
};

export default function CustomerOrdersPage() {
  const formatPrice = useFormatPrice();
  const { companyName, logoUrl, isLoading: isCompanyLoading } = useCompanySettings();

  // Get store theme colors
  const { primaryColor, primaryHoverColor, isLoading: isThemeLoading } = useStoreTheme();

  // ✨ OPTIMIZED: Use optimized orders hook
  const { orders, setOrders, branches, records, isLoading, error } = useOrders();
  const loading = isLoading; // Alias for compatibility

  const [activeTab, setActiveTab] = useState<'all' | 'preparation' | 'followup' | 'completed' | 'issues'>('all');
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedOrderForProcessing, setSelectedOrderForProcessing] = useState<string | null>(null);
  const [showPrepareModal, setShowPrepareModal] = useState(false);
  const [selectedOrderForPreparation, setSelectedOrderForPreparation] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<Order | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    orderId: string;
  }>({
    show: false,
    x: 0,
    y: 0,
    orderId: ''
  });

  // Invoice creation states
  const [showInvoiceConfirmModal, setShowInvoiceConfirmModal] = useState(false);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [nextStatus, setNextStatus] = useState<OrderStatus | null>(null);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState({
    paidAmount: 0,
    selectedBranch: '',
    selectedRecord: '',
    notes: ''
  });
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  // Payment receipts states
  const [orderReceipts, setOrderReceipts] = useState<Record<string, PaymentReceipt[]>>({});

  // Add product to order states
  const [showAddProductSection, setShowAddProductSection] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debug: Log context menu state changes
  useEffect(() => {
    console.log('Context menu state changed:', contextMenu);
    if (contextMenu.show) {
      console.log('Context menu is now showing at position:', contextMenu.x, contextMenu.y, 'for order:', contextMenu.orderId);
    }
  }, [contextMenu]);

  // Load payment receipts for all orders
  useEffect(() => {
    const loadAllReceipts = async () => {
      if (!orders || orders.length === 0) return;

      const receiptsMap: Record<string, PaymentReceipt[]> = {};
      for (const order of orders) {
        if (order.orderId) {
          try {
            const receipts = await paymentService.getOrderPaymentReceipts(order.orderId);
            receiptsMap[order.orderId] = receipts;
          } catch (error) {
            console.error(`Failed to load receipts for order ${order.orderId}:`, error);
            receiptsMap[order.orderId] = [];
          }
        }
      }
      setOrderReceipts(receiptsMap);
    };

    loadAllReceipts();
  }, [orders]);

  // Verify all pending receipts for an order
  const handleVerifyAllReceipts = async (orderId: string) => {
    try {
      // Get all pending receipts for this order
      const receipts = orderReceipts[orderId] || [];
      const pendingReceipts = receipts.filter(r => r.payment_status === 'pending');

      if (pendingReceipts.length === 0) {
        alert('لا توجد إيصالات معلقة لتأكيدها');
        return;
      }

      // Verify all pending receipts
      for (const receipt of pendingReceipts) {
        await paymentService.verifyPaymentReceipt(
          receipt.id,
          true,
          'تم التأكيد من صفحة طلبات العملاء'
        );
      }

      // Reload receipts for all orders
      const receiptsMap: Record<string, PaymentReceipt[]> = {};
      for (const order of orders) {
        if (order.orderId) {
          try {
            const receipts = await paymentService.getOrderPaymentReceipts(order.orderId);
            receiptsMap[order.orderId] = receipts;
          } catch (error) {
            console.error(`Failed to load receipts for order ${order.orderId}:`, error);
            receiptsMap[order.orderId] = [];
          }
        }
      }
      setOrderReceipts(receiptsMap);

      alert(`تم تأكيد ${pendingReceipts.length} إيصال بنجاح ✓`);
    } catch (error: any) {
      console.error('Error verifying receipts:', error);
      alert(`فشل تأكيد الإيصالات: ${error.message}`);
    }
  };

  // Handle page visibility changes (important for mobile devices)
  useEffect(() => {
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtimeSubscription = () => {
      // Clean up existing channel if any
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }

      // Create new channel
      realtimeChannel = supabase.channel('customer_orders_realtime');

      // Listen for order items preparation status updates
      realtimeChannel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'order_items'
        },
        async (payload) => {
          console.log('Real-time preparation update received:', payload);

          // Fetch the product_id for the updated item
          const { data: itemData } = await supabase
            .from('order_items')
            .select('product_id, order_id')
            .eq('id', payload.new.id)
            .single();

          if (!itemData) return;

          // Update the specific order's progress
          setOrders(prevOrders => {
            return prevOrders.map(order => {
              if (order.orderId !== itemData.order_id) {
                return order;
              }

              const updatedItemIndex = order.items.findIndex(item =>
                item.product_id === itemData.product_id
              );

              if (updatedItemIndex !== -1) {
                const updatedItems = [...order.items];
                updatedItems[updatedItemIndex] = {
                  ...updatedItems[updatedItemIndex],
                  isPrepared: payload.new.is_prepared || false
                };

                const preparedItems = updatedItems.filter(item => item.isPrepared).length;
                const totalItems = updatedItems.length;
                const preparationProgress = totalItems > 0 ? (preparedItems / totalItems) * 100 : 0;

                console.log(`Order ${order.id}: Progress updated to ${preparationProgress}%`);

                return {
                  ...order,
                  items: updatedItems,
                  preparationProgress
                };
              }

              return order;
            });
          });
        }
      );

      // Listen for order status updates
      realtimeChannel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Real-time order status update received:', payload);

          setOrders(prevOrders => {
            return prevOrders.map(order => {
              if (order.orderId === payload.new.id) {
                console.log(`Order ${order.id}: Status updated from ${order.status} to ${payload.new.status}`);

                return {
                  ...order,
                  status: payload.new.status,
                  updated_at: payload.new.updated_at,
                  total: payload.new.total_amount ? parseFloat(payload.new.total_amount) : order.total,
                  subtotal: payload.new.subtotal_amount ? parseFloat(payload.new.subtotal_amount) : order.subtotal,
                  shipping: payload.new.shipping_amount ? parseFloat(payload.new.shipping_amount) : order.shipping,
                };
              }
              return order;
            });
          });
        }
      );

      // Subscribe to the channel
      realtimeChannel.subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });
    };

    // Initial setup
    setupRealtimeSubscription();

    // Handle page visibility changes (crucial for mobile browsers)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible - reconnecting real-time subscriptions');
        setupRealtimeSubscription();
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, []);

  // Filter orders based on active tab and date range
  useEffect(() => {
    let filtered = orders;

    // Filter by status
    switch (activeTab) {
      case 'all':
        // Show all orders
        filtered = orders;
        break;
      case 'preparation':
        // Show orders in preparation phase (معلق، يتم التحضير)
        filtered = orders.filter(order => ['pending', 'processing'].includes(order.status));
        break;
      case 'followup':
        // Show orders in follow-up phase (جاهز للاستلام، جاهز للشحن، تم الشحن)
        filtered = orders.filter(order => ['ready_for_pickup', 'ready_for_shipping', 'shipped'].includes(order.status));
        break;
      case 'completed':
        // Show completed orders (تم التسليم)
        filtered = orders.filter(order => order.status === 'delivered');
        break;
      case 'issues':
        // Show orders with issues (ملغي، مشكله)
        filtered = orders.filter(order => ['cancelled', 'issue'].includes(order.status));
        break;
    }

    // Filter by date range for both tabs
    if (dateFrom || dateTo) {
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.date);
        const fromDate = dateFrom ? new Date(dateFrom) : null;
        const toDate = dateTo ? new Date(dateTo) : null;

        if (fromDate && orderDate < fromDate) return false;
        if (toDate && orderDate > toDate) return false;
        return true;
      });
    }

    // Apply custom sorting based on active tab
    const sortOrders = (orders: Order[]) => {
      return [...orders].sort((a, b) => {
        if (activeTab === 'preparation') {
          // For preparation tab: sort by status first, then by progress/date
          if (a.status === 'processing' && b.status === 'pending') return -1;
          if (a.status === 'pending' && b.status === 'processing') return 1;
          
          // If both are processing, sort by progress (highest first)
          if (a.status === 'processing' && b.status === 'processing') {
            const progressA = a.preparationProgress || 0;
            const progressB = b.preparationProgress || 0;
            if (progressA !== progressB) return progressB - progressA;
          }
          
          // If both are pending, sort by date (newest first)
          if (a.status === 'pending' && b.status === 'pending') {
            return new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime();
          }
        } else if (activeTab === 'followup') {
          // For followup tab: ready_for_pickup first, then ready_for_shipping, then shipped last
          const statusOrder = { 'ready_for_pickup': 1, 'ready_for_shipping': 2, 'shipped': 3 };
          const orderA = statusOrder[a.status as keyof typeof statusOrder] || 999;
          const orderB = statusOrder[b.status as keyof typeof statusOrder] || 999;
          
          if (orderA !== orderB) return orderA - orderB;
          
          // If same status, sort by date (newest first for ready_for_pickup)
          if (a.status === 'ready_for_pickup' && b.status === 'ready_for_pickup') {
            return new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime();
          }
        } else if (activeTab === 'all') {
          // For all tab: delivered and shipped at bottom, others by date
          const isACompleted = ['delivered', 'shipped'].includes(a.status);
          const isBCompleted = ['delivered', 'shipped'].includes(b.status);
          
          if (isACompleted && !isBCompleted) return 1;
          if (!isACompleted && isBCompleted) return -1;
          
          // If both completed, sort delivered after shipped
          if (isACompleted && isBCompleted) {
            if (a.status === 'delivered' && b.status === 'shipped') return 1;
            if (a.status === 'shipped' && b.status === 'delivered') return -1;
          }
        }
        
        // Default sort by date (newest first)
        return new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime();
      });
    };

    const sortedFiltered = sortOrders(filtered);
    setFilteredOrders(sortedFiltered);
    
    // Set default expanded state for orders
    const newExpandedOrders = new Set<string>();
    filtered.forEach(order => {
      // Auto-expand orders in preparation, followup, and issues tabs
      if ((activeTab === 'preparation' && ['pending', 'processing'].includes(order.status)) ||
          (activeTab === 'followup' && ['ready_for_pickup', 'ready_for_shipping', 'shipped'].includes(order.status)) ||
          (activeTab === 'issues' && ['cancelled', 'issue'].includes(order.status))) {
        newExpandedOrders.add(order.id);
      }
    });
    setExpandedOrders(newExpandedOrders);
  }, [orders, activeTab, dateFrom, dateTo]);

  // Handle click outside context menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenu.show) {
        console.log('Click outside detected, closing context menu');
        setContextMenu({ show: false, x: 0, y: 0, orderId: '' });
      }
    };

    if (contextMenu.show) {
      // Add a small delay to prevent immediate closing
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.show]);

  // Auto-cleanup and status update system
  useEffect(() => {
    const checkOrdersForAutoUpdate = async () => {
      const now = new Date();
      
      for (const order of orders) {
        const updatedAt = new Date(order.updated_at || order.created_at || order.date);
        const timeDiff = now.getTime() - updatedAt.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

        try {
    
          // Rule 1: Delete cancelled orders after 24 hours
          if (order.status === 'cancelled' && hoursDiff >= 24) {
            console.log(`Deleting cancelled order ${order.id} after 24 hours`);
            
            // First delete related sale_items
            await supabase
              .from('sale_items')
              .delete()
              .eq('order_number', order.id);

            // Then delete the order itself
            const { error } = await supabase
              .from('orders')
              .delete()
              .eq('order_number', order.id);

            if (!error) {
              // Remove from local state
              setOrders(prevOrders => 
                prevOrders.filter(o => o.id !== order.id)
              );
              console.log(`Successfully deleted order ${order.id}`);
            } else {
              console.error('Error deleting order:', error);
            }
          }

          // Rule 2: Auto-convert shipped orders to delivered after 6 days
          if (order.status === 'shipped' && daysDiff >= 6) {
            console.log(`Auto-converting shipped order ${order.id} to delivered after 6 days`);
            
            const { error } = await supabase
              .from('orders')
              .update({ 
                status: 'delivered',
                updated_at: new Date().toISOString()
              })
              .eq('order_number', order.id);

            if (!error) {
              // Update local state
              setOrders(prevOrders => 
                prevOrders.map(o => 
                  o.id === order.id 
                    ? { ...o, status: 'delivered' as OrderStatus }
                    : o
                )
              );
              console.log(`Successfully converted order ${order.id} to delivered`);
            } else {
              console.error('Error updating order status:', error);
            }
          }
        } catch (error) {
          console.error('Error in auto-update system:', error);
        }
      }
    };

    // Run the check when orders change
    if (orders.length > 0) {
      checkOrdersForAutoUpdate();
    }

    // Set up interval to check every hour
    const interval = setInterval(checkOrdersForAutoUpdate, 60 * 60 * 1000); // Every hour

    return () => clearInterval(interval);
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

  // Handle start preparation button click
  const handleStartPreparation = (orderId: string) => {
    setSelectedOrderForProcessing(orderId);
    setShowConfirmModal(true);
  };

  // Confirm start preparation
  const confirmStartPreparation = async () => {
    if (!selectedOrderForProcessing) return;
    
    // Update order status
    await updateOrderStatus(selectedOrderForProcessing, 'processing');
    
    // Close modal
    setShowConfirmModal(false);
    setSelectedOrderForProcessing(null);
  };

  // Complete preparation and move to next status based on delivery type
  const completePreparation = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    let nextStatus: OrderStatus;
    if (order.deliveryType === 'pickup') {
      nextStatus = 'ready_for_pickup';
    } else if (order.deliveryType === 'delivery') {
      nextStatus = 'ready_for_shipping';
    } else {
      // Default to pickup if deliveryType is null or undefined
      nextStatus = 'ready_for_pickup';
    }

    await updateOrderStatus(orderId, nextStatus);
  };

  // Move to next status with invoice creation
  const moveToNextStatus = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    let nextStatusValue: OrderStatus;
    
    switch (order.status) {
      case 'ready_for_pickup':
        nextStatusValue = 'delivered';
        break;
      case 'ready_for_shipping':
        nextStatusValue = 'shipped';
        break;
      case 'shipped':
        nextStatusValue = 'delivered';
        break;
      default:
        return;
    }

    // Check if this transition requires invoice creation
    if ((order.status === 'ready_for_pickup' && nextStatusValue === 'delivered') ||
        (order.status === 'ready_for_shipping' && nextStatusValue === 'shipped')) {
      // Show invoice confirmation modal
      setSelectedOrderForInvoice(order);
      setNextStatus(nextStatusValue);
      setInvoiceData({
        paidAmount: order.subtotal || order.total, // Use subtotal (invoice amount) if available, fallback to total
        selectedBranch: branches.length > 0 ? branches[0].id : '',
        selectedRecord: records.length > 0 ? records[0].id : '',
        notes: ''
      });
      setShowInvoiceConfirmModal(true);
    } else {
      // Direct status update for other transitions
      await updateOrderStatus(orderId, nextStatusValue);
    }
  };

  // Handle invoice creation confirmation
  const handleInvoiceConfirmation = (confirmed: boolean) => {
    if (confirmed) {
      setShowInvoiceConfirmModal(false);
      setShowCreateInvoiceModal(true);
    } else {
      setShowInvoiceConfirmModal(false);
      setSelectedOrderForInvoice(null);
      setNextStatus(null);
    }
  };

  // Create invoice using database function to bypass RLS
  const createInvoice = async () => {
    if (!selectedOrderForInvoice || !nextStatus) return;

    if (!invoiceData.selectedBranch || !invoiceData.selectedRecord) {
      alert('يرجى التأكد من اختيار الفرع والسجل');
      return;
    }

    if (invoiceData.paidAmount < 0 || invoiceData.paidAmount > selectedOrderForInvoice.total) {
      alert('المبلغ المدفوع غير صحيح');
      return;
    }

    setCreatingInvoice(true);

    try {

      // Use database function to create invoice - bypasses RLS policies
      const { data: result, error: functionError } = await (supabase as any)
        .rpc('create_invoice', {
          p_order_number: selectedOrderForInvoice.id,
          p_paid_amount: invoiceData.paidAmount,
          p_branch_id: invoiceData.selectedBranch,
          p_record_id: invoiceData.selectedRecord,
          p_notes: invoiceData.notes || `فاتورة للطلب رقم: ${selectedOrderForInvoice.id}`,
          p_next_status: nextStatus
        });

      if (functionError) {
        console.error('Error calling create_invoice function:', functionError);
        throw functionError;
      }

      // Parse the JSON result
      const parsedResult = result as any;
      
      if (!parsedResult || !parsedResult.success) {
        console.error('Invoice creation failed:', parsedResult?.error);
        throw new Error(parsedResult?.error || 'فشل في إنشاء الفاتورة');
      }

      // Show print confirmation
      const shouldPrint = confirm('تم إنشاء الفاتورة بنجاح! هل تريد طباعتها الآن؟');
      if (shouldPrint) {
        printInvoice(parsedResult.sale_id, parsedResult.invoice_number);
      }

      // Close modals
      setShowCreateInvoiceModal(false);
      setSelectedOrderForInvoice(null);
      setNextStatus(null);

      // Orders will refresh automatically on next render

    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('حدث خطأ أثناء إنشاء الفاتورة. يرجى المحاولة مرة أخرى.');
    } finally {
      setCreatingInvoice(false);
    }
  };

  // Print invoice function
  const printInvoice = (saleId: string, invoiceNumber: string) => {
    if (!selectedOrderForInvoice) return;

    const printContent = `
      <div style="font-family: 'Cairo', Arial, sans-serif; max-width: 300px; margin: 0 auto; direction: rtl;">
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
          <h2 style="margin: 0; font-size: 18px;">${companyName}</h2>
          <p style="margin: 5px 0; font-size: 12px;">فاتورة بيع</p>
        </div>
        
        <div style="margin-bottom: 15px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>${invoiceNumber}</span>
            <span>رقم الفاتورة:</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>${new Date().toLocaleDateString('en-GB')}</span>
            <span>التاريخ:</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            <span>الوقت:</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>${selectedOrderForInvoice.customerName}</span>
            <span>العميل:</span>
          </div>
          ${selectedOrderForInvoice.customerPhone ? `
          <div style="display: flex; justify-content: space-between;">
            <span>${selectedOrderForInvoice.customerPhone}</span>
            <span>الهاتف:</span>
          </div>
          ` : ''}
        </div>
        
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin-bottom: 15px;">
          ${selectedOrderForInvoice.items.map(item => `
            <div style="margin-bottom: 8px; font-size: 10px;">
              <div style="font-weight: bold;">${item.name}</div>
              <div style="display: flex; justify-content: space-between;">
                <span>${formatPrice(item.price * item.quantity)}</span>
                <span>${item.quantity} × ${formatPrice(item.price)}</span>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div style="font-size: 12px; margin-bottom: 15px;">
          ${selectedOrderForInvoice.subtotal !== null && selectedOrderForInvoice.subtotal !== undefined && selectedOrderForInvoice.shipping !== null && selectedOrderForInvoice.shipping !== undefined ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span style="font-weight: bold;">${formatPrice(selectedOrderForInvoice.subtotal!)}</span>
              <span>مبلغ الفاتورة:</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span style="font-weight: bold;">${formatPrice(selectedOrderForInvoice.shipping!)}</span>
              <span>الشحن:</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; border-top: 1px solid #ccc; padding-top: 5px;">
              <span style="font-weight: bold;">${formatPrice(selectedOrderForInvoice.total)}</span>
              <span>الإجمالي:</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span style="font-weight: bold; color: green;">${formatPrice(invoiceData.paidAmount)}</span>
              <span>المدفوع (فاتورة فقط):</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 5px;">
              <span style="font-weight: bold; color: ${selectedOrderForInvoice.subtotal! - invoiceData.paidAmount > 0 ? 'red' : 'green'};">
                ${formatPrice(selectedOrderForInvoice.subtotal! - invoiceData.paidAmount)}
              </span>
              <span>المتبقي من الفاتورة:</span>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span style="font-weight: bold;">${formatPrice(selectedOrderForInvoice.total)}</span>
              <span>الإجمالي:</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span style="font-weight: bold; color: green;">${formatPrice(invoiceData.paidAmount)}</span>
              <span>المدفوع:</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 5px;">
              <span style="font-weight: bold; color: ${selectedOrderForInvoice.total - invoiceData.paidAmount > 0 ? 'red' : 'green'};">
                ${formatPrice(selectedOrderForInvoice.total - invoiceData.paidAmount)}
              </span>
              <span>المتبقي:</span>
            </div>
          `}
        </div>
        
        <div style="text-align: center; font-size: 10px; color: #666;">
          <p style="margin: 5px 0;">شكراً لزيارتكم</p>
          <p style="margin: 5px 0;">يرجى الاحتفاظ بالفاتورة</p>
        </div>
      </div>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>فاتورة ${invoiceNumber}</title>
          <style>
            @media print {
              body { margin: 0; }
              @page { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
        </html>
      `);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  // Handle preparation page button click
  const handlePreparationPage = (orderId: string) => {
    setSelectedOrderForPreparation(orderId);
    setShowPrepareModal(true);
  };

  // Close prepare modal
  const closePrepareModal = () => {
    setShowPrepareModal(false);
    setSelectedOrderForPreparation(null);
  };

  // Handle edit order button click
  const handleEditOrder = (order: Order) => {
    setSelectedOrderForEdit(order);
    setShowEditModal(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedOrderForEdit(null);
    // Reset add product states
    setShowAddProductSection(false);
    setProductSearchQuery('');
    setSearchResults([]);
  };

  // Handle marking order as cancelled
  const handleMarkAsCancelled = async (orderId: string) => {
    try {
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('order_number', orderId);

      if (error) {
        console.error('Error marking order as cancelled:', error);
        alert('خطأ في تحديث حالة الطلب');
        return;
      }

      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, status: 'cancelled' as OrderStatus }
            : order
        )
      );

      alert('تم تحديث حالة الطلب إلى ملغي');
    } catch (error) {
      console.error('Error marking order as cancelled:', error);
      alert('خطأ في تحديث حالة الطلب');
    }
  };

  // Handle marking order as having an issue
  const handleMarkAsIssue = async (orderId: string) => {
    try {
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'issue',
          updated_at: new Date().toISOString()
        })
        .eq('order_number', orderId);

      if (error) {
        console.error('Error marking order as issue:', error);
        alert('خطأ في تحديث حالة الطلب');
        return;
      }

      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, status: 'issue' as OrderStatus }
            : order
        )
      );

      alert('تم تحديث حالة الطلب إلى مشكله');
    } catch (error) {
      console.error('Error marking order as issue:', error);
      alert('خطأ في تحديث حالة الطلب');
    }
  };

  // Handle right-click on status tag
  const handleStatusRightClick = (e: React.MouseEvent, orderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Right-click detected on order:', orderId);
    console.log('Mouse position:', e.clientX, e.clientY);
    
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      orderId: orderId
    });
    
    console.log('Context menu state set to show');
  };

  // Handle context menu option selection
  const handleContextMenuAction = async (action: 'cancelled' | 'issue') => {
    if (!contextMenu.orderId) return;

    try {
      if (action === 'cancelled') {
        if (confirm('هل أنت متأكد من إلغاء هذا الطلب؟')) {
          await handleMarkAsCancelled(contextMenu.orderId);
        }
      } else if (action === 'issue') {
        if (confirm('هل أنت متأكد من وضع علامة مشكله على هذا الطلب؟')) {
          await handleMarkAsIssue(contextMenu.orderId);
        }
      }
    } catch (error) {
      console.error('Error handling context menu action:', error);
    }

    // Close context menu
    setContextMenu({ show: false, x: 0, y: 0, orderId: '' });
  };

  // Helper function to calculate time remaining for auto-actions
  const getTimeRemaining = (order: Order) => {
    if (!order.updated_at && !order.created_at && !order.date) return null;
    
    const now = new Date();
    const updatedAt = new Date(order.updated_at || order.created_at || order.date);
    const timeDiff = now.getTime() - updatedAt.getTime();
    
    if (order.status === 'cancelled') {
      const hoursRemaining = 24 - (timeDiff / (1000 * 60 * 60));
      if (hoursRemaining > 0) {
        return {
          type: 'deletion',
          time: Math.ceil(hoursRemaining),
          unit: 'hours',
          text: `سيتم حذف الطلب خلال ${Math.ceil(hoursRemaining)} ساعة`
        };
      }
    } else if (order.status === 'shipped') {
      const daysRemaining = 6 - (timeDiff / (1000 * 60 * 60 * 24));
      if (daysRemaining > 0) {
        return {
          type: 'delivery',
          time: Math.ceil(daysRemaining),
          unit: 'days',
          text: `سيتم تحويله إلى "تم التسليم" خلال ${Math.ceil(daysRemaining)} يوم`
        };
      }
    }
    
    return null;
  };

  // Update item quantity
  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (!selectedOrderForEdit || newQuantity <= 0) return;
    
    const updatedItems = selectedOrderForEdit.items.map(item =>
      item.id === itemId ? { ...item, quantity: newQuantity } : item
    );
    
    const newTotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    setSelectedOrderForEdit({
      ...selectedOrderForEdit,
      items: updatedItems,
      total: newTotal
    });
  };

  // Update item notes
  const updateItemNotes = (itemId: string, notes: string) => {
    if (!selectedOrderForEdit) return;
    
    const updatedItems = selectedOrderForEdit.items.map(item =>
      item.id === itemId ? { ...item, notes } : item
    );
    
    setSelectedOrderForEdit({
      ...selectedOrderForEdit,
      items: updatedItems
    });
  };

  // Remove item from order
  const removeItem = (itemId: string) => {
    if (!selectedOrderForEdit) return;

    const updatedItems = selectedOrderForEdit.items.filter(item => item.id !== itemId);
    const newTotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    setSelectedOrderForEdit({
      ...selectedOrderForEdit,
      items: updatedItems,
      total: newTotal
    });
  };

  // Search products for adding to order
  const searchProducts = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, product_code, price, main_image_url')
        .or(`name.ilike.%${query}%,product_code.ilike.%${query}%`)
        .eq('is_active', true)
        .limit(10);

      if (error) {
        console.error('Error searching products:', error);
        setSearchResults([]);
        return;
      }

      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching products:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Add product to order
  const addProductToOrder = (product: any) => {
    if (!selectedOrderForEdit) return;

    // Check if product already exists in order
    const existingItem = selectedOrderForEdit.items.find(
      item => item.product_id === product.id
    );

    if (existingItem) {
      // Increase quantity if product already exists
      updateItemQuantity(existingItem.id, existingItem.quantity + 1);
    } else {
      // Add new item with temporary ID (will be created in database on save)
      const newItem = {
        id: `new_${Date.now()}_${product.id}`,
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.main_image_url,
        notes: '',
        isNew: true // Flag to identify new items when saving
      };

      const updatedItems = [...selectedOrderForEdit.items, newItem];
      const newTotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      setSelectedOrderForEdit({
        ...selectedOrderForEdit,
        items: updatedItems,
        total: newTotal
      });
    }

    // Clear search after adding
    setProductSearchQuery('');
    setSearchResults([]);
    setShowAddProductSection(false);
  };

  // Save order changes
  const saveOrderChanges = async () => {
    if (!selectedOrderForEdit) return;

    try {
      // Get the order's database ID first
      const { data: orderData, error: orderFetchError } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', selectedOrderForEdit.id)
        .single();

      if (orderFetchError || !orderData) {
        console.error('Error fetching order:', orderFetchError);
        return;
      }

      const orderId = orderData.id;

      // Update order total
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          total_amount: selectedOrderForEdit.total,
          updated_at: new Date().toISOString()
        })
        .eq('order_number', selectedOrderForEdit.id);

      if (orderError) {
        console.error('Error updating order:', orderError);
        return;
      }

      // Separate new items from existing items
      const newItems = selectedOrderForEdit.items.filter((item: any) => item.isNew);
      const existingItems = selectedOrderForEdit.items.filter((item: any) => !item.isNew);

      // Update existing order items quantities and notes
      for (const item of existingItems) {
        const { error: itemError } = await supabase
          .from('order_items')
          .update({
            quantity: item.quantity,
            notes: item.notes || null
          })
          .eq('id', item.id);

        if (itemError) {
          console.error('Error updating item:', itemError);
        }
      }

      // Insert new items
      for (const newItem of newItems) {
        const { error: insertError } = await supabase
          .from('order_items')
          .insert({
            order_id: orderId,
            product_id: (newItem as any).product_id,
            quantity: newItem.quantity,
            unit_price: newItem.price,
            notes: newItem.notes || null
          });

        if (insertError) {
          console.error('Error inserting new item:', insertError);
        }
      }

      // Remove items that were deleted
      const originalItems = orders.find(o => o.id === selectedOrderForEdit.id)?.items || [];
      const deletedItems = originalItems.filter(original =>
        !selectedOrderForEdit.items.find(current => current.id === original.id)
      );

      for (const deletedItem of deletedItems) {
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('id', deletedItem.id);

        if (deleteError) {
          console.error('Error deleting item:', deleteError);
        }
      }

      // Refetch order items to get proper IDs for newly inserted items
      const { data: updatedItems, error: refetchError } = await supabase
        .from('order_items')
        .select(`
          id,
          product_id,
          quantity,
          unit_price,
          notes,
          products (
            id,
            name,
            main_image_url
          )
        `)
        .eq('order_id', orderId);

      if (refetchError) {
        console.error('Error refetching items:', refetchError);
      }

      // Update local state with refetched data
      const updatedOrder = {
        ...selectedOrderForEdit,
        items: updatedItems?.map((item: any) => ({
          id: item.id,
          productId: item.product_id,
          name: item.products?.name || 'منتج غير معروف',
          price: item.unit_price,
          quantity: item.quantity,
          image: item.products?.main_image_url || null,
          notes: item.notes
        })) || selectedOrderForEdit.items
      };

      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === selectedOrderForEdit.id ? updatedOrder : order
        )
      );

      closeEditModal();
    } catch (error) {
      console.error('Error saving order changes:', error);
    }
  };

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('order_number', orderId);

      if (error) {
        console.error('Error updating order status:', error);
        return;
      }

      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, status: newStatus }
            : order
        )
      );
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  if (loading || isCompanyLoading || isThemeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: '#c0c0c0'}}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل طلبات العملاء...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-800" style={{backgroundColor: '#c0c0c0'}}>

      {/* Store Header (Red) */}
      <header className="border-b border-gray-700 py-0 relative z-40" style={{backgroundColor: 'var(--primary-color)'}}>
        <div className="relative flex items-center min-h-[60px] md:min-h-[80px]">
          <div className="max-w-[95%] md:max-w-[95%] lg:max-w-[80%] mx-auto px-2 md:px-3 lg:px-4 flex items-center justify-between min-h-[60px] md:min-h-[80px] w-full">
            
            {/* زر العودة - اليسار */}
            <button
              onClick={() => window.history.back()}
              className="flex items-center p-2 text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* النص الرئيسي - الوسط */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <h1 className="text-lg md:text-2xl font-bold text-white text-center whitespace-nowrap">
                قائمة الطلبات
              </h1>
            </div>

            {/* اللوجو - اليمين */}
            <div className="flex items-center">
              <img src={logoUrl || '/assets/logo/El Farouk Group2.png'} alt="الفاروق" className="h-12 w-12 md:h-16 md:w-16 object-contain" />
            </div>

          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[98%] md:max-w-[95%] lg:max-w-[80%] mx-auto px-2 md:px-3 lg:px-4 py-4 md:py-5 lg:py-8">
        {/* Tabs */}
        <div className="flex flex-wrap md:flex-nowrap mb-4 md:mb-8 bg-white rounded-lg overflow-hidden shadow-lg">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 min-w-0 py-2 md:py-4 px-2 md:px-6 text-sm md:text-base font-semibold transition-colors ${
              activeTab === 'all'
                ? 'text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            style={{
              backgroundColor: activeTab === 'all' ? 'var(--primary-color)' : 'transparent'
            }}
          >
            الكل
          </button>
          <button
            onClick={() => setActiveTab('preparation')}
            className={`flex-1 min-w-0 py-2 md:py-4 px-2 md:px-6 text-sm md:text-base font-semibold transition-colors ${
              activeTab === 'preparation'
                ? 'text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            style={{
              backgroundColor: activeTab === 'preparation' ? 'var(--primary-color)' : 'transparent'
            }}
          >
            التحضير
          </button>
          <button
            onClick={() => setActiveTab('followup')}
            className={`flex-1 min-w-0 py-2 md:py-4 px-2 md:px-6 text-sm md:text-base font-semibold transition-colors ${
              activeTab === 'followup'
                ? 'text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            style={{
              backgroundColor: activeTab === 'followup' ? 'var(--primary-color)' : 'transparent'
            }}
          >
            المتابعة
          </button>
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
            المنفذ
          </button>
          <button
            onClick={() => setActiveTab('issues')}
            className={`flex-1 min-w-0 py-2 md:py-4 px-2 md:px-6 text-sm md:text-base font-semibold transition-colors ${
              activeTab === 'issues'
                ? 'text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            style={{
              backgroundColor: activeTab === 'issues' ? 'var(--primary-color)' : 'transparent'
            }}
          >
            مشكله
          </button>
        </div>

        {/* Date Filter (for both tabs) */}
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

        {/* Orders List */}
        <div className="space-y-2 md:space-y-3 lg:space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-lg p-4 md:p-8 shadow-lg text-center">
              <div className="text-gray-400 text-4xl md:text-6xl mb-2 md:mb-4">📦</div>
              <h3 className="text-lg md:text-xl font-semibold text-gray-600 mb-1 md:mb-2">
                {activeTab === 'all' && 'لا توجد طلبات'}
                {activeTab === 'preparation' && 'لا توجد طلبات قيد التحضير'}
                {activeTab === 'followup' && 'لا توجد طلبات في المتابعة'}
                {activeTab === 'completed' && 'لا توجد طلبات مكتملة'}
                {activeTab === 'issues' && 'لا توجد طلبات بها مشاكل'}
              </h3>
              <p className="text-sm md:text-base text-gray-500">
                {activeTab === 'all' && 'لا توجد طلبات في قاعدة البيانات'}
                {activeTab === 'preparation' && 'جميع الطلبات تم تحضيرها'}
                {activeTab === 'followup' && 'لا توجد طلبات تحتاج متابعة'}
                {activeTab === 'completed' && 'لم يتم تسليم أي طلبات بعد'}
                {activeTab === 'issues' && 'جميع الطلبات تسير بسلاسة'}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isExpanded = expandedOrders.has(order.id);
              return (
                <div key={order.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  {/* Status Tag with Order Info */}
                  <div className="px-3 md:px-4 lg:px-6 pt-3 md:pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Status Tag + Time Remaining */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 md:gap-2 px-3 md:px-4 py-1 md:py-2 rounded-full text-sm md:text-base font-semibold cursor-pointer ${
                            order.status === 'ready_for_pickup' ? 'text-green-800' : 'text-white'
                          }`}
                          style={{ backgroundColor: statusColors[order.status] }}
                          onContextMenu={(e) => {
                            console.log('Right-click on order:', order.id, 'status:', order.status);
                            // Show context menu for all orders except delivered, cancelled, and issue
                            if (!['cancelled', 'issue', 'delivered'].includes(order.status)) {
                              console.log('Showing context menu for order:', order.id);
                              handleStatusRightClick(e, order.id);
                            } else {
                              console.log('Context menu blocked for status:', order.status);
                              e.preventDefault(); // Still prevent default browser context menu
                            }
                          }}
                          title={
                            !['cancelled', 'issue', 'delivered'].includes(order.status)
                              ? "انقر بالزر الأيمن لتغيير الحالة إلى (ملغي) أو (مشكله)"
                              : "لا يمكن تغيير حالة هذا الطلب"
                          }
                        >
                          <span className="text-sm md:text-base">{statusIcons[order.status]}</span>
                          <span className="text-sm md:text-base">{statusTranslations[order.status]}</span>
                        </span>

                        {/* Time Remaining Indicator for Auto-Actions */}
                        {(() => {
                          const timeRemaining = getTimeRemaining(order);
                          if (timeRemaining) {
                            return (
                              <div
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                  timeRemaining.type === 'deletion'
                                    ? 'bg-red-100 text-red-800 border border-red-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}
                                title={timeRemaining.text}
                              >
                                <span>{timeRemaining.type === 'deletion' ? '🗑️' : '📦'}</span>
                                <span>
                                  {timeRemaining.time} {timeRemaining.unit === 'hours' ? 'س' : 'ي'}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Order Number and Date */}
                      <div className="flex flex-col items-start text-left">
                        <span className="text-xs md:text-sm font-medium text-gray-700">طلب رقم: {order.id}</span>
                        <span className="text-sm md:text-base font-bold text-gray-700">{new Date(order.date).toLocaleDateString('en-GB')}</span>
                      </div>
                    </div>
                  </div>


                  {/* Order Content - Always Visible */}
                  <div 
                    className="px-3 md:px-4 lg:px-6 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleOrderExpansion(order.id)}
                  >
                    
                    {/* Mobile View: Stacked Layout */}
                    <div className="md:hidden">
                      <div className="py-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-blue-600">معلومات العميل</h4>
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
                        <div className="space-y-1">
                          <p className="text-gray-800 font-medium text-base">الاسم: {order.customerName}</p>
                          {order.customerPhone && (
                            <p className="text-gray-600 text-sm">الهاتف: {order.customerPhone}</p>
                          )}
                          {order.customerAddress && (
                            <p className="text-gray-600 text-sm">العنوان: {order.customerAddress}</p>
                          )}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-gray-200"></div>

                      {/* Financial Information Section */}
                      <div className="py-3">
                        <h4 className="text-sm font-semibold text-blue-600 mb-2">التفاصيل المالية</h4>
                        <div className="space-y-1">
                          {order.subtotal !== null && order.subtotal !== undefined && order.shipping !== null && order.shipping !== undefined ? (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-600">مبلغ الفاتورة:</span>
                                <span className="text-gray-800 font-medium">{formatPrice(order.subtotal!)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">الشحن:</span>
                                <span className="text-gray-800 font-medium">{formatPrice(order.shipping!)}</span>
                              </div>
                              <div className="flex justify-between border-t border-gray-200 pt-1 mt-2">
                                <span className="text-gray-800 font-semibold">الإجمالي:</span>
                                <span className="text-gray-800 font-bold text-lg">{formatPrice(order.total)}</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex justify-between">
                              <span className="text-gray-800 font-semibold">المبلغ الإجمالي:</span>
                              <span className="text-gray-800 font-bold text-lg">{formatPrice(order.total)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Payment Receipts Section - Mobile */}
                      {order.orderId && (
                        <>
                          <div className="border-t border-gray-200"></div>
                          <div className="py-3">
                            <h4 className="text-sm font-semibold text-blue-600 mb-3">إيصال الدفع</h4>
                            <OrderPaymentReceipts
                              receipts={orderReceipts[order.orderId] || []}
                              onVerifyAllReceipts={async () => {
                                if (order.orderId) {
                                  await handleVerifyAllReceipts(order.orderId);
                                }
                              }}
                              formatPrice={formatPrice}
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Desktop/Tablet View: Side by Side Layout */}
                    <div className="hidden md:block py-4">
                      <div className="grid grid-cols-3 gap-4 md:gap-6 lg:gap-8">
                        {/* Customer Information - Right Side (takes more space) */}
                        <div className="col-span-2">
                          <h5 className="text-lg font-semibold text-blue-600 mb-4">معلومات العميل</h5>
                          <div className="space-y-3 text-lg">
                            <p className="text-gray-700">الاسم: {order.customerName}</p>
                            {order.customerPhone && (
                              <p className="text-gray-700">الهاتف: {order.customerPhone}</p>
                            )}
                            {order.customerAddress && (
                              <p className="text-gray-700">العنوان: {order.customerAddress}</p>
                            )}
                          </div>
                        </div>

                        {/* Financial Details + Payment Receipts - Left Side (compact column) */}
                        <div className="space-y-4">
                          {/* Financial Details */}
                          <div className="flex flex-col">
                            {/* Title aligned with Customer Info title */}
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
                              {order.subtotal !== null && order.subtotal !== undefined && order.shipping !== null && order.shipping !== undefined ? (
                                <>
                                  <div className="flex justify-between items-center gap-4">
                                    <span className="text-gray-600 text-base">مبلغ الفاتورة:</span>
                                    <span className="text-gray-800 font-medium whitespace-nowrap text-base">{formatPrice(order.subtotal!)}</span>
                                  </div>
                                  <div className="flex justify-between items-center gap-4">
                                    <span className="text-gray-600 text-base">الشحن:</span>
                                    <span className="text-gray-800 font-medium whitespace-nowrap text-base">{formatPrice(order.shipping!)}</span>
                                  </div>
                                  <div className="flex justify-between items-center gap-4 font-semibold text-lg pt-2 border-t border-gray-200">
                                    <span className="text-gray-800">المبلغ الإجمالي:</span>
                                    <span className="text-gray-800 whitespace-nowrap">{formatPrice(order.total)}</span>
                                  </div>
                                </>
                              ) : (
                                <div className="flex justify-between items-center gap-4 font-semibold text-lg">
                                  <span className="text-gray-800">المبلغ الإجمالي:</span>
                                  <span className="text-gray-800 whitespace-nowrap">{formatPrice(order.total)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Payment Receipts Section - Below Financial Details */}
                          {order.orderId && (
                            <div>
                              <h5 className="text-lg font-semibold text-blue-600 mb-4">إيصال الدفع</h5>
                              <OrderPaymentReceipts
                                receipts={orderReceipts[order.orderId] || []}
                                onVerifyAllReceipts={async () => {
                                  if (order.orderId) {
                                    await handleVerifyAllReceipts(order.orderId);
                                  }
                                }}
                                formatPrice={formatPrice}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Section */}
                    <div className="pb-3 md:pb-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-2 justify-start">
                        {/* Start Preparation Button - Only for pending orders */}
                        {order.status === 'pending' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartPreparation(order.id);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            بدء التحضير
                          </button>
                        )}
                        
                        {/* Preparation Page Button - Only for processing orders */}
                        {order.status === 'processing' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreparationPage(order.id);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                            style={{ backgroundColor: '#F59E0B' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#D97706';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#F59E0B';
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            صفحة التحضير
                          </button>
                        )}

                        {/* Edit Order Button - For pending and processing orders */}
                        {(order.status === 'pending' || order.status === 'processing') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditOrder(order);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            تعديل
                          </button>
                        )}

                        {/* Complete Preparation Button - For processing orders with all items prepared */}
                        {order.status === 'processing' && order.preparationProgress === 100 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              completePreparation(order.id);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            إتمام الطلب
                          </button>
                        )}

                        {/* Next Status Button - For ready orders */}
                        {(order.status === 'ready_for_pickup' || order.status === 'ready_for_shipping' || order.status === 'shipped') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveToNextStatus(order.id);
                            }}
                            className={`inline-flex items-center gap-1 px-3 py-1 text-white text-xs font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 ${
                              order.status === 'ready_for_pickup' ? 'bg-green-600 hover:bg-green-700' :
                              order.status === 'ready_for_shipping' ? 'bg-blue-600 hover:bg-blue-700' :
                              'bg-green-600 hover:bg-green-700'
                            }`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {order.status === 'ready_for_pickup' ? 'تم التسليم' :
                             order.status === 'ready_for_shipping' ? 'تم الشحن' :
                             'تم التسليم'}
                          </button>
                        )}
                      </div>
                      
                      {/* Progress Bar at the top - Only for processing orders */}
                      {order.status === 'processing' && order.preparationProgress !== undefined && (
                        <div className="mt-3 min-w-[250px]">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-gray-600">
                              {order.items.filter(item => item.isPrepared).length}/{order.items.length}
                            </span>
                            <span className="text-xs font-medium text-gray-600">
                              {Math.round(order.preparationProgress)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                order.preparationProgress === 100 ? 'bg-green-500' : 'bg-yellow-500'
                              }`}
                              style={{ width: `${order.preparationProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Items - Collapsible */}
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
                                      <span className="text-sm font-medium text-gray-800">{item.price?.toFixed(0) || '0'} جنيه</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-600">الكمية:</span>
                                      <span className="text-sm font-bold text-blue-600">{item.quantity}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-gray-200 pt-1">
                                      <span className="text-xs text-gray-800 font-medium">الإجمالي:</span>
                                      <span className="text-sm font-bold text-gray-800">
                                        {((item.quantity * (item.price || 0))).toFixed(0)} جنيه
                                      </span>
                                    </div>
                                  </div>

                                  {/* Notes */}
                                  {item.notes && (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                      <p className="text-xs text-gray-600">
                                        <span className="font-medium">ملاحظات:</span> {item.notes}
                                      </p>
                                    </div>
                                  )}
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
                                        {item.price?.toFixed(0) || '0'} جنيه
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-800 rounded-full text-base font-bold">
                                        {item.quantity}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span className="text-base font-bold text-gray-800">
                                        {((item.quantity * (item.price || 0))).toFixed(0)} جنيه
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-base text-gray-600">
                                      {item.notes || '-'}
                                    </td>
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
                                      {item.price?.toFixed(0) || '0'} جنيه
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-bold">
                                      {item.quantity}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="text-sm font-bold text-gray-800 whitespace-nowrap">
                                      {((item.quantity * (item.price || 0))).toFixed(0)} جنيه
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

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">تأكيد بدء التحضير</h3>
            <p className="text-gray-600 mb-6">هل أنت متأكد أنك تريد تفعيل وضع التحضير لهذا الطلب؟</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedOrderForProcessing(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={confirmStartPreparation}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                نعم، بدء التحضير
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prepare Order Modal */}
      {showPrepareModal && selectedOrderForPreparation && (
        <PrepareOrderModal
          isOpen={showPrepareModal}
          onClose={closePrepareModal}
          orderId={selectedOrderForPreparation}
        />
      )}

      {/* Edit Order Modal - Full Screen */}
      {showEditModal && selectedOrderForEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
          <div className="bg-white w-full h-full overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 md:p-6 border-b border-gray-200 flex-shrink-0" style={{ backgroundColor: 'var(--primary-color)' }}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl md:text-2xl font-semibold text-white">تعديل الطلب: {selectedOrderForEdit.id}</h3>
                <button
                  onClick={closeEditModal}
                  className="text-white hover:text-gray-300 transition-colors p-2"
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 md:p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                {/* Order Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">معلومات الطلب</h4>
                  <p className="text-gray-600 text-sm">العميل: {selectedOrderForEdit.customerName}</p>
                  {selectedOrderForEdit.customerPhone && (
                    <p className="text-gray-600 text-sm">الهاتف: {selectedOrderForEdit.customerPhone}</p>
                  )}
                  <p className="text-gray-600 text-sm">التاريخ: {new Date(selectedOrderForEdit.date).toLocaleDateString('en-GB')}</p>
                </div>

                {/* Items List */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-gray-800">عناصر الطلب</h4>
                    <button
                      onClick={() => setShowAddProductSection(!showAddProductSection)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      إضافة منتج
                    </button>
                  </div>

                  {/* Add Product Section */}
                  {showAddProductSection && (
                    <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex justify-between items-center mb-3">
                        <h5 className="font-semibold text-blue-800">البحث عن منتج لإضافته</h5>
                        <button
                          onClick={() => {
                            setShowAddProductSection(false);
                            setProductSearchQuery('');
                            setSearchResults([]);
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Search Input */}
                      <div className="relative mb-3">
                        <input
                          type="text"
                          value={productSearchQuery}
                          onChange={(e) => {
                            setProductSearchQuery(e.target.value);
                            searchProducts(e.target.value);
                          }}
                          placeholder="ابحث بالاسم أو كود المنتج..."
                          className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        />
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                          {isSearching ? (
                            <svg className="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Search Results */}
                      {searchResults.length > 0 && (
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {searchResults.map((product) => (
                            <div
                              key={product.id}
                              className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors"
                              onClick={() => addProductToOrder(product)}
                            >
                              <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                {product.main_image_url ? (
                                  <img
                                    src={product.main_image_url}
                                    alt={product.name}
                                    className="w-full h-full object-cover rounded-lg"
                                  />
                                ) : (
                                  <span className="text-gray-400 text-xl">📦</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h6 className="font-semibold text-gray-800 truncate">{product.name}</h6>
                                <p className="text-gray-500 text-sm">كود: {product.product_code || 'غير محدد'}</p>
                              </div>
                              <div className="text-left">
                                <p className="font-bold text-green-600">{formatPrice(product.price)}</p>
                                <button className="text-blue-600 text-sm font-medium hover:text-blue-800">
                                  + إضافة
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* No Results */}
                      {productSearchQuery && !isSearching && searchResults.length === 0 && (
                        <div className="text-center py-4 text-gray-500">
                          لم يتم العثور على منتجات
                        </div>
                      )}
                    </div>
                  )}

                  {selectedOrderForEdit.items.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">لا توجد عناصر في الطلب</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedOrderForEdit.items.map((item) => (
                        <div key={item.id} className={`rounded-lg p-4 space-y-3 ${(item as any).isNew ? 'bg-green-50 border-2 border-green-300' : 'bg-gray-50'}`}>
                          {/* New Item Badge */}
                          {(item as any).isNew && (
                            <div className="flex justify-end">
                              <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full font-medium">
                                منتج جديد
                              </span>
                            </div>
                          )}

                          {/* First Row: Product Info and Controls */}
                          <div className="flex items-center gap-4">
                            {/* Product Image */}
                            <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              ) : (
                                <span className="text-gray-400 text-2xl">📦</span>
                              )}
                            </div>

                            {/* Product Info */}
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-800">{item.name}</h5>
                              <p className="text-gray-600 text-sm">{formatPrice(item.price)} لكل قطعة</p>
                            </div>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                                className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                              >
                                -
                              </button>
                              <span className="w-12 text-center font-semibold">{item.quantity}</span>
                              <button
                                onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                                className="w-8 h-8 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                              >
                                +
                              </button>
                            </div>

                            {/* Item Total */}
                            <div className="text-right min-w-[80px]">
                              <p className="font-semibold text-gray-800">{formatPrice(item.price * item.quantity)}</p>
                            </div>

                            {/* Remove Button */}
                            <button
                              onClick={() => removeItem(item.id)}
                              className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                              title="حذف المنتج"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>

                          {/* Second Row: Notes */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              ملاحظات على المنتج:
                            </label>
                            <textarea
                              value={item.notes || ''}
                              onChange={(e) => updateItemNotes(item.id, e.target.value)}
                              placeholder="أضف ملاحظات على هذا المنتج..."
                              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                              rows={2}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Order Total */}
                <div className="bg-gray-100 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700">إجمالي الطلب:</span>
                    <span className="font-bold text-xl text-gray-800">{formatPrice(selectedOrderForEdit.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 md:p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex gap-3 justify-start">
                <button
                  onClick={saveOrderChanges}
                  className="px-8 py-3 text-white rounded-lg transition-colors text-lg font-medium"
                  style={{ backgroundColor: 'var(--primary-color)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#4a1919';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--primary-color)';
                  }}
                >
                  حفظ التغييرات
                </button>
                <button
                  onClick={closeEditModal}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors text-lg"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu for Status Change */}
      {contextMenu.show && (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-xl py-2"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            minWidth: '150px',
            zIndex: 9999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleContextMenuAction('cancelled')}
            className="w-full px-4 py-2 text-right hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <span className="w-3 h-3 bg-gray-500 rounded-full"></span>
            <span>ملغي</span>
          </button>
          <button
            onClick={() => handleContextMenuAction('issue')}
            className="w-full px-4 py-2 text-right hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8B5CF6' }}></span>
            <span>مشكله</span>
          </button>
        </div>
      )}

      {/* Invoice Creation Confirmation Modal */}
      {showInvoiceConfirmModal && selectedOrderForInvoice && nextStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">إنشاء فاتورة</h3>
            <p className="text-gray-600 mb-2">
              يتطلب تغيير حالة الطلب إلى <span className="font-bold text-gray-800">&quot;{statusTranslations[nextStatus]}&quot;</span> إنشاء فاتورة أولاً.
            </p>
            <p className="text-gray-600 mb-6">
              هل تريد إنشاء فاتورة للطلب رقم: <span className="font-bold text-blue-600">{selectedOrderForInvoice.id}</span>؟
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleInvoiceConfirmation(false)}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleInvoiceConfirmation(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                نعم، إنشاء فاتورة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreateInvoiceModal && selectedOrderForInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200" style={{ backgroundColor: 'var(--primary-color)' }}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-white">إنشاء فاتورة للطلب: {selectedOrderForInvoice.id}</h3>
                <button
                  onClick={() => setShowCreateInvoiceModal(false)}
                  className="text-white hover:text-gray-300 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Order Details */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">تفاصيل الطلب</h4>
                  
                  <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-lg">
                    <div><span className="font-semibold">رقم الطلب:</span> {selectedOrderForInvoice.id}</div>
                    <div><span className="font-semibold">اسم العميل:</span> {selectedOrderForInvoice.customerName}</div>
                    {selectedOrderForInvoice.customerPhone && (
                      <div><span className="font-semibold">رقم الهاتف:</span> {selectedOrderForInvoice.customerPhone}</div>
                    )}
                    <div><span className="font-semibold">التاريخ:</span> {new Date(selectedOrderForInvoice.date).toLocaleDateString('en-GB')}</div>
                    
                    {/* Display detailed breakdown if subtotal and shipping are available */}
                    {selectedOrderForInvoice.subtotal !== null && selectedOrderForInvoice.subtotal !== undefined && selectedOrderForInvoice.shipping !== null && selectedOrderForInvoice.shipping !== undefined ? (
                      <div className="border-t pt-3">
                        <div><span className="font-semibold">مبلغ الفاتورة:</span> {formatPrice(selectedOrderForInvoice.subtotal!)}</div>
                        <div><span className="font-semibold">الشحن:</span> {formatPrice(selectedOrderForInvoice.shipping!)}</div>
                        <div><span className="font-semibold">الإجمالي:</span> {formatPrice(selectedOrderForInvoice.total)}</div>
                      </div>
                    ) : (
                      <div><span className="font-semibold">الإجمالي:</span> {formatPrice(selectedOrderForInvoice.total)}</div>
                    )}
                  </div>

                  {/* Order Items */}
                  <h5 className="text-md font-semibold text-gray-800 mb-3">المنتجات</h5>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {selectedOrderForInvoice.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
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
                        <div className="flex-1">
                          <h6 className="font-semibold text-gray-800 text-sm">{item.name}</h6>
                          <p className="text-gray-600 text-sm">الكمية: {item.quantity} × {formatPrice(item.price)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-800">{formatPrice(item.price * item.quantity)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Invoice Creation Form */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">بيانات الفاتورة</h4>
                  
                  <div className="space-y-4">
                    {/* Paid Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">المبلغ المدفوع</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={selectedOrderForInvoice.total}
                        value={invoiceData.paidAmount}
                        onChange={(e) => setInvoiceData({...invoiceData, paidAmount: parseFloat(e.target.value) || 0})}
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                        placeholder="0.00"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setInvoiceData({...invoiceData, paidAmount: selectedOrderForInvoice.total})}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                        >
                          كامل المبلغ
                        </button>
                        <button
                          onClick={() => setInvoiceData({...invoiceData, paidAmount: selectedOrderForInvoice.total / 2})}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors"
                        >
                          نصف المبلغ
                        </button>
                      </div>
                    </div>

                    {/* Branch Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">الفرع</label>
                      <select
                        value={invoiceData.selectedBranch}
                        onChange={(e) => setInvoiceData({...invoiceData, selectedBranch: e.target.value})}
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                      >
                        <option value="">اختر الفرع</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Record Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">السجل</label>
                      <select
                        value={invoiceData.selectedRecord}
                        onChange={(e) => setInvoiceData({...invoiceData, selectedRecord: e.target.value})}
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                      >
                        <option value="">اختر السجل</option>
                        {records.map((record) => (
                          <option key={record.id} value={record.id}>
                            {record.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات (اختياري)</label>
                      <textarea
                        value={invoiceData.notes}
                        onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
                        rows={3}
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900 resize-none"
                        placeholder="أدخل أي ملاحظات إضافية..."
                      />
                    </div>

                    {/* Remaining Balance */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      {/* Show detailed breakdown for customer */}
                      {selectedOrderForInvoice.subtotal !== null && selectedOrderForInvoice.subtotal !== undefined && selectedOrderForInvoice.shipping !== null && selectedOrderForInvoice.shipping !== undefined ? (
                        <>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-700">مبلغ الفاتورة:</span>
                            <span className="font-bold text-gray-800">{formatPrice(selectedOrderForInvoice.subtotal!)}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-700">الشحن:</span>
                            <span className="font-bold text-gray-800">{formatPrice(selectedOrderForInvoice.shipping!)}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2 border-t pt-2">
                            <span className="text-gray-700">إجمالي المبلغ:</span>
                            <span className="font-bold text-gray-800">{formatPrice(selectedOrderForInvoice.total)}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-700">المبلغ المدفوع (فاتورة فقط):</span>
                            <span className="font-bold text-green-600">{formatPrice(invoiceData.paidAmount)}</span>
                          </div>
                          <div className="flex justify-between items-center border-t pt-2">
                            <span className="text-gray-700">المتبقي من الفاتورة:</span>
                            <span className={`font-bold ${(selectedOrderForInvoice.subtotal! - invoiceData.paidAmount) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatPrice(selectedOrderForInvoice.subtotal! - invoiceData.paidAmount)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-700">إجمالي المبلغ:</span>
                            <span className="font-bold text-gray-800">{formatPrice(selectedOrderForInvoice.total)}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-700">المبلغ المدفوع:</span>
                            <span className="font-bold text-green-600">{formatPrice(invoiceData.paidAmount)}</span>
                          </div>
                          <div className="flex justify-between items-center border-t pt-2">
                            <span className="text-gray-700">المتبقي:</span>
                            <span className={`font-bold ${(selectedOrderForInvoice.total - invoiceData.paidAmount) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatPrice(selectedOrderForInvoice.total - invoiceData.paidAmount)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowCreateInvoiceModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={createInvoice}
                  disabled={creatingInvoice || !invoiceData.selectedBranch || !invoiceData.selectedRecord}
                  className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                    creatingInvoice || !invoiceData.selectedBranch || !invoiceData.selectedRecord
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {creatingInvoice ? 'جاري إنشاء الفاتورة...' : 'إنشاء الفاتورة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}