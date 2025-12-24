'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CartService } from '@/lib/cart-service';
import { CartSession, CartItemData } from '@/lib/cart-utils';
import { useCart } from '@/lib/contexts/CartContext';
import { useFormatPrice } from '@/lib/hooks/useCurrency';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';

interface CustomerData {
  name: string;
  phone: string;
  altPhone: string;
  address: string;
}

interface ShippingCompany {
  id: string;
  name: string;
  status: string;
}

interface ShippingGovernorate {
  id: string;
  name: string;
  type: 'simple' | 'complex';
  price?: number;
  areas?: ShippingArea[];
}

interface ShippingArea {
  id: string;
  name: string;
  price: number;
}

type DeliveryMethod = 'pickup' | 'delivery';

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCartChange?: () => void;
}

const CartModal = ({ isOpen, onClose, onCartChange }: CartModalProps) => {
  const router = useRouter();
  const formatPrice = useFormatPrice();
  const { logoUrl, companyName } = useCompanySettings();
  const [isLoading, setIsLoading] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData>({
    name: '',
    phone: '',
    altPhone: '',
    address: ''
  });
  
  // Get cart data from context
  const { cartItems, removeFromCart, updateQuantity, updateItemNotes, clearCart, syncWithDatabase } = useCart();

  // State for editing notes
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');
  const notesInputRef = useRef<HTMLInputElement>(null);

  // Start editing notes for an item
  const handleStartEditNotes = (itemId: string, currentNotes: string) => {
    setEditingNotesId(itemId);
    setTempNotes(currentNotes || '');
    // Focus the input after state update
    setTimeout(() => notesInputRef.current?.focus(), 50);
  };

  // Save notes for an item
  const handleSaveNotes = async (itemId: string) => {
    await updateItemNotes(itemId, tempNotes);
    setEditingNotesId(null);
    setTempNotes('');
  };

  // Cancel editing notes
  const handleCancelEditNotes = () => {
    setEditingNotesId(null);
    setTempNotes('');
  };
  
  // Delivery and shipping states
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup');
  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [governorates, setGovernorates] = useState<ShippingGovernorate[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [shippingCost, setShippingCost] = useState<number>(0);

  // Save scroll position to restore when modal closes
  const [savedScrollPosition, setSavedScrollPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });


  // Sync with database when modal opens and load customer profile
  useEffect(() => {
    if (isOpen) {
      syncWithDatabase();
      loadCustomerProfile();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load customer profile data to auto-fill form
  const loadCustomerProfile = async () => {
    try {
      const { data: { user } } = await CartService.supabase.auth.getUser();

      if (!user) return; // Not logged in, skip auto-fill

      // Load customer profile from customers table
      const { data: customerData, error } = await (CartService.supabase as any)
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading customer profile:', error);
        return;
      }

      if (customerData) {
        // Auto-fill customer data from profile
        setCustomerData({
          name: customerData.name || '',
          phone: customerData.phone || '',
          altPhone: customerData.backup_phone || '',
          address: customerData.address || ''
        });

        // Auto-fill governorate if exists
        if (customerData.governorate && deliveryMethod === 'delivery') {
          // Try to find and select matching governorate
          const matchingGov = governorates.find(g =>
            g.name.toLowerCase().includes(customerData.governorate.toLowerCase())
          );
          if (matchingGov) {
            setSelectedGovernorate(matchingGov.id);
            if (matchingGov.type === 'simple') {
              setShippingCost(matchingGov.price || 0);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading customer profile for auto-fill:', error);
    }
  };

  // Prevent body scroll when modal is open and change theme color
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position to sessionStorage for mobile reliability
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft || window.scrollX || 0;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;

      // Save to both state and sessionStorage
      setSavedScrollPosition({ x: scrollX, y: scrollY });
      sessionStorage.setItem('cartModalScrollPosition', JSON.stringify({ x: scrollX, y: scrollY }));

      // Simple and reliable scroll lock for all devices
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = `-${scrollX}px`;

      // Change theme color for cart modal
      const grayColor = '#C0C0C0'; // Gray color to match cart background

      // Function to update all meta tags
      const updateThemeColor = (color: string) => {
        // Update theme-color meta tag
        const themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
        if (themeColorMeta) {
          themeColorMeta.content = color;
        }

        // Update msapplication-navbutton-color for Windows Phone
        const msNavColorMeta = document.querySelector('meta[name="msapplication-navbutton-color"]') as HTMLMetaElement;
        if (msNavColorMeta) {
          msNavColorMeta.content = color;
        }

        // Update apple-mobile-web-app-status-bar-style for iOS
        const appleStatusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement;
        if (appleStatusBarMeta) {
          appleStatusBarMeta.content = 'default';
        }
      };

      // Apply the gray color immediately and with delays to ensure browser picks it up
      updateThemeColor(grayColor);

      setTimeout(() => updateThemeColor(grayColor), 10);
      setTimeout(() => updateThemeColor(grayColor), 100);
      setTimeout(() => updateThemeColor(grayColor), 250);

    } else {
      // Simple and reliable scroll restoration for all devices
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      document.body.style.left = '';

      // Get saved position from sessionStorage as backup
      let positionToRestore = savedScrollPosition;
      try {
        const sessionPosition = sessionStorage.getItem('cartModalScrollPosition');
        if (sessionPosition) {
          positionToRestore = JSON.parse(sessionPosition);
          sessionStorage.removeItem('cartModalScrollPosition');
        }
      } catch (e) {
        // Fallback to state if sessionStorage fails
      }

      // Robust restoration that works on mobile and desktop
      const restoreScroll = () => {
        window.scrollTo({
          left: positionToRestore.x,
          top: positionToRestore.y,
          behavior: 'instant'
        });
      };

      // Immediate restoration
      restoreScroll();

      // Delayed restoration as backup (essential for mobile browsers)
      requestAnimationFrame(() => {
        restoreScroll();
        setTimeout(restoreScroll, 0);
        setTimeout(restoreScroll, 10);
        setTimeout(restoreScroll, 50);
      });

      // Restore original theme colors
      const blueColor = '#3B82F6'; // Original blue color

      // Function to restore theme color
      const restoreThemeColor = (color: string) => {
        const themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
        if (themeColorMeta) {
          themeColorMeta.content = color;
        }

        const msNavColorMeta = document.querySelector('meta[name="msapplication-navbutton-color"]') as HTMLMetaElement;
        if (msNavColorMeta) {
          msNavColorMeta.content = color;
        }

        const appleStatusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement;
        if (appleStatusBarMeta) {
          appleStatusBarMeta.content = 'default';
        }
      };

      // Restore the blue color
      restoreThemeColor(blueColor);
      setTimeout(() => restoreThemeColor(blueColor), 10);
    }
  }, [isOpen]);

  // Load shipping companies
  const loadShippingCompanies = useCallback(async () => {
    try {
      const { data, error } = await (CartService.supabase as any)
        .from('shipping_companies')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setShippingCompanies((data as any) || []);
      
      // If only one company, auto-select it
      if (data && data.length === 1) {
        setSelectedCompany(data[0].id);
        loadGovernorates(data[0].id);
      }
    } catch (error) {
      console.error('Error loading shipping companies:', error);
      setShippingCompanies([]);
    }
  }, []);

  // Load shipping companies on mount
  useEffect(() => {
    if (isOpen) {
      loadShippingCompanies();
    }
  }, [isOpen, loadShippingCompanies]);

  // Load governorates for selected company
  const loadGovernorates = useCallback(async (companyId: string) => {
    if (!companyId) {
      setGovernorates([]);
      return;
    }

    try {
      const { data, error } = await (CartService.supabase as any)
        .from('shipping_governorates')
        .select(`
          *,
          shipping_areas (
            id,
            name,
            price
          )
        `)
        .eq('shipping_company_id', companyId)
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      const transformedGovernorates = (data as any).map((gov: any) => ({
        id: gov.id,
        name: gov.name,
        type: gov.type as 'simple' | 'complex',
        price: gov.price,
        areas: gov.shipping_areas?.map((area: any) => ({
          id: area.id,
          name: area.name,
          price: area.price
        })) || []
      }));
      
      setGovernorates(transformedGovernorates);
    } catch (error) {
      console.error('Error loading governorates:', error);
      setGovernorates([]);
    }
  }, []);

  // Handle delivery method change
  const handleDeliveryMethodChange = (method: DeliveryMethod) => {
    setDeliveryMethod(method);
    if (method === 'pickup') {
      setShippingCost(0);
      setSelectedCompany('');
      setSelectedGovernorate('');
      setSelectedArea('');
      // Clear address since it's not needed for pickup
      setCustomerData(prev => ({ ...prev, address: '' }));
    } else if (method === 'delivery') {
      // If only one company, auto-select it
      if (shippingCompanies.length === 1) {
        setSelectedCompany(shippingCompanies[0].id);
        loadGovernorates(shippingCompanies[0].id);
      }
    }
  };

  // Handle company selection
  const handleCompanySelect = (companyId: string) => {
    setSelectedCompany(companyId);
    setSelectedGovernorate('');
    setSelectedArea('');
    setShippingCost(0);
    loadGovernorates(companyId);
  };

  // Handle governorate selection
  const handleGovernorateSelect = (governorateId: string) => {
    setSelectedGovernorate(governorateId);
    setSelectedArea('');
    
    const governorate = governorates.find(g => g.id === governorateId);
    if (governorate) {
      if (governorate.type === 'simple') {
        setShippingCost(governorate.price || 0);
      } else {
        setShippingCost(0); // Will be set when area is selected
      }
    }
  };

  // Handle area selection
  const handleAreaSelect = (areaId: string) => {
    setSelectedArea(areaId);

    const governorate = governorates.find(g => g.id === selectedGovernorate);
    const area = governorate?.areas?.find(a => a.id === areaId);
    if (area) {
      setShippingCost(area.price);
    }
  };
  
  // Group cart items by product_id
  const groupedCartItems = cartItems.reduce((groups, item) => {
    const key = item.product_id;
    if (!groups[key]) {
      groups[key] = {
        product: item.products,
        items: []
      };
    }
    groups[key].items.push(item);
    return groups;
  }, {} as Record<string, { product: any; items: any[] }>);

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = deliveryMethod === 'pickup' ? 0 : shippingCost;
  const total = subtotal + shipping;
  
  const handleInputChange = (field: keyof CustomerData, value: string) => {
    // Phone number validation for Egyptian numbers (11 digits starting with 01)
    if (field === 'phone' || field === 'altPhone') {
      // Only allow digits
      const digits = value.replace(/\D/g, '');

      // Limit to 11 digits
      const limitedDigits = digits.slice(0, 11);

      setCustomerData(prev => ({
        ...prev,
        [field]: limitedDigits
      }));
    } else {
      setCustomerData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };
  
  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    // Use context for immediate local update + database sync
    await updateQuantity(itemId, newQuantity);
  };
  
  const handleRemoveItem = async (itemId: string) => {
    // Use context for immediate local update + database sync
    await removeFromCart(itemId);
  };

  const handleGroupQuantityChange = async (group: any, newTotalQuantity: number) => {
    if (newTotalQuantity < 1) return;

    const currentTotalQuantity = group.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    const quantityDifference = newTotalQuantity - currentTotalQuantity;

    if (quantityDifference === 0) return;

    // Calculate proportional distribution of the new quantity
    const items = group.items;

    if (quantityDifference > 0) {
      // Increase: add to the first item
      await updateQuantity(items[0].id, items[0].quantity + quantityDifference);
    } else {
      // Decrease: subtract proportionally, starting from last items
      let remaining = Math.abs(quantityDifference);
      for (let i = items.length - 1; i >= 0 && remaining > 0; i--) {
        const item = items[i];
        const reduceBy = Math.min(item.quantity, remaining);
        const newQty = item.quantity - reduceBy;

        if (newQty > 0) {
          await updateQuantity(item.id, newQty);
        } else {
          await removeFromCart(item.id);
        }
        remaining -= reduceBy;
      }
    }
  };
  
  const handleClearCart = async () => {
    // Use context for immediate local update + database sync
    await clearCart();
  };
  
  // Save order to database via API (uses NextAuth session for proper user_id)
  const saveOrderToDatabase = async (orderData: any) => {
    try {
      const response = await fetch('/api/user/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: orderData.items.map((item: CartItemData) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes || null
          })),
          customer: orderData.customer,
          delivery_method: orderData.delivery_method,
          shipping_details: orderData.shipping_details,
          subtotal: orderData.subtotal,
          shipping: orderData.shipping,
          total: orderData.total
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error creating order:', result.error);
        throw new Error(result.error || 'Failed to create order');
      }

      console.log('Order saved successfully:', result.orderNumber);
      return result;

    } catch (error) {
      console.error('Error saving order to database:', error);
      throw error;
    }
  };

  const handleConfirmOrder = async () => {
    try {
      if (cartItems.length === 0) {
        alert('السلة فارغة! يرجى إضافة منتجات أولاً.');
        return;
      }
      
      if (!customerData.name.trim()) {
        alert('يرجى إدخال اسم العميل');
        return;
      }
      
      if (!customerData.phone.trim()) {
        alert('يرجى إدخال رقم الهاتف');
        return;
      }

      // Validate phone number format (11 digits starting with 01)
      if (customerData.phone.length !== 11) {
        alert('رقم الهاتف يجب أن يكون 11 رقم');
        return;
      }

      if (!customerData.phone.startsWith('01')) {
        alert('رقم الهاتف يجب أن يبدأ بـ 01');
        return;
      }

      // Validate alternative phone if provided
      if (customerData.altPhone.trim()) {
        if (customerData.altPhone.length !== 11) {
          alert('رقم الهاتف الثاني يجب أن يكون 11 رقم');
          return;
        }

        if (!customerData.altPhone.startsWith('01')) {
          alert('رقم الهاتف الثاني يجب أن يبدأ بـ 01');
          return;
        }
      }
      
      // Only require address for delivery method
      if (deliveryMethod === 'delivery' && !customerData.address.trim()) {
        alert('يرجى إدخال العنوان');
        return;
      }
      
      // Validate delivery method requirements
      if (deliveryMethod === 'delivery') {
        if (shippingCompanies.length > 1 && !selectedCompany) {
          alert('يرجى اختيار شركة الشحن');
          return;
        }
        
        if (!selectedGovernorate) {
          alert('يرجى اختيار المحافظة');
          return;
        }
        
        const selectedGov = governorates.find(g => g.id === selectedGovernorate);
        if (selectedGov?.type === 'complex' && !selectedArea) {
          alert('يرجى اختيار المنطقة');
          return;
        }
        
        if (shippingCost === 0) {
          alert('لم يتم تحديد تكلفة الشحن. يرجى اختيار المنطقة.');
          return;
        }
      }
      
      // Prepare shipping details
      let shippingDetails = null;
      if (deliveryMethod === 'delivery') {
        const selectedGov = governorates.find(g => g.id === selectedGovernorate);
        const selectedAreaData = selectedGov?.areas?.find(a => a.id === selectedArea);
        
        shippingDetails = {
          company_id: selectedCompany || (shippingCompanies.length === 1 ? shippingCompanies[0].id : null),
          company_name: shippingCompanies.find(c => c.id === (selectedCompany || shippingCompanies[0]?.id))?.name,
          governorate_id: selectedGovernorate,
          governorate_name: selectedGov?.name,
          governorate_type: selectedGov?.type,
          area_id: selectedArea || null,
          area_name: selectedAreaData?.name || null,
          shipping_cost: shippingCost
        };
      }
      
      const orderData = {
        items: cartItems,
        customer: customerData,
        delivery_method: deliveryMethod,
        shipping_details: shippingDetails,
        subtotal,
        shipping,
        total,
        timestamp: new Date().toISOString()
      };
      
      console.log('Order confirmed:', orderData);
      
      // Save order to database
      await saveOrderToDatabase(orderData);
      
      alert('تم تأكيد الطلب بنجاح! سيتم التواصل معك قريباً.');
      
      // Clear cart after confirmation
      handleClearCart();
      
      // Close modal and redirect to homepage
      onClose();
      router.push('/');
    } catch (error) {
      console.error('Error confirming order:', error);
      alert('حدث خطأ أثناء تأكيد الطلب. يرجى المحاولة مرة أخرى.');
    }
  };
  
  if (!isOpen) return null;
  
  if (isLoading) {
    return (
      <div className="cart-modal-overlay">
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="text-gray-600">جاري التحميل...</div>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <div
        className="fixed inset-0 w-screen h-screen bg-white z-[99999] flex flex-col overflow-hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          backgroundColor: 'white',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'Cairo', Arial, sans-serif"
        }}
        dir="rtl"
      >
        {/* Responsive Header */}
        <header className="border-b border-gray-600 py-0 flex-shrink-0" style={{backgroundColor: 'var(--primary-color)'}}>
          {/* Desktop/Tablet Header */}
          <div className="hidden md:block">
            <div className="px-8 flex items-center justify-between" style={{minHeight: '80px'}}>
              <button
                onClick={onClose}
                className="text-white hover:text-red-300 transition-colors p-3 text-lg flex items-center"
              >
                <svg className="w-8 h-8 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>العودة للمتجر</span>
              </button>

              <div className="text-white text-2xl font-bold">
                ملخص الطلب
              </div>

              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-lg flex items-center justify-center">
                  <img
                    src={logoUrl || '/assets/logo/Hegazy.png'}
                    alt={`${companyName} Logo`}
                    className="h-full w-full object-contain rounded-lg"
                  />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-white text-lg font-bold">{companyName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Header */}
          <div className="md:hidden">
            <div className="px-3 flex items-center justify-between min-h-[60px]">
              <button
                onClick={onClose}
                className="text-white hover:text-red-300 transition-colors p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center">
                  <img
                    src={logoUrl || '/assets/logo/Hegazy.png'}
                    alt={`${companyName} Logo`}
                    className="h-full w-full object-contain rounded-lg"
                  />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-white text-sm font-bold">{companyName}</span>
                </div>
              </div>

              <div className="text-white text-sm font-medium">
                ملخص الطلب
              </div>
            </div>
          </div>
        </header>

        {/* Responsive Content Container */}
        <div className="flex-1 overflow-y-auto bg-[#C0C0C0] px-3 py-4 md:px-16 md:py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {cartItems.length === 0 ? (
            // Empty cart message
            <div className="text-center py-12">
              <div className="bg-white rounded-lg p-8 shadow-md mx-auto max-w-md">
                <div className="text-gray-400 text-4xl mb-4">🛒</div>
                <h2 className="text-lg font-bold text-gray-800 mb-3">السلة فارغة</h2>
                <p className="text-gray-600 text-sm mb-6">لم تقم بإضافة أي منتجات إلى السلة بعد</p>
                <button
                  onClick={onClose}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors text-sm"
                >
                  تصفح المنتجات
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop/Tablet Layout */}
              <div className="hidden md:block">
                {/* Tablet Only: Products Table at Top */}
                <div className="xl:hidden mb-6">
                  <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="p-4 text-center border-b">
                      <h3 className="text-xl font-semibold" style={{color: 'var(--primary-color)'}}>ملخص الطلب</h3>
                    </div>
                    
                    {/* Products Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead style={{backgroundColor: '#f8f9fa'}}>
                          <tr className="text-gray-700 text-sm font-medium">
                            <th className="p-4 text-right">المنتج</th>
                            <th className="p-4 text-right">السعر</th>
                            <th className="p-4 text-center">الكمية</th>
                            <th className="p-4 text-right">الإجمالي</th>
                            <th className="p-4 text-right">ملاحظات</th>
                            <th className="p-4 text-right">حذف</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.values(groupedCartItems).map((group) => {
                            const productTotal = group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                            const totalQuantity = group.items.reduce((sum, item) => sum + item.quantity, 0);
                            
                            // Group items by color
                            const colorGroups = group.items.reduce((colors, item) => {
                              const colorKey = item.selected_color || 'بدون لون';
                              if (!colors[colorKey]) {
                                colors[colorKey] = { items: [], totalQuantity: 0 };
                              }
                              colors[colorKey].items.push(item);
                              colors[colorKey].totalQuantity += item.quantity;
                              return colors;
                            }, {} as Record<string, { items: CartItemData[]; totalQuantity: number }>);

                            return (
                              <tr key={group.product?.id || group.items[0]?.product_id} className="border-b hover:bg-gray-50">
                                {/* Product */}
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                                      <img 
                                        src={group.product?.main_image_url || '/placeholder-product.svg'} 
                                        alt={group.product?.name || 'منتج'}
                                        className="w-full h-full object-cover rounded-lg"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          if (target.src !== '/placeholder-product.svg') {
                                            target.src = '/placeholder-product.svg';
                                          }
                                        }}
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-gray-900 text-base truncate">{group.product?.name || 'منتج غير معروف'}</h4>
                                      <div className="text-sm text-gray-500 mt-1">
                                        كود {group.product?.product_code || 'غير محدد'}
                                      </div>
                                      {/* Colors */}
                                      {Object.keys(colorGroups).some(colorName => colorName !== 'بدون لون') && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {Object.entries(colorGroups).map(([colorName, colorGroup]) => {
                                            if (colorName === 'بدون لون') return null;
                                            
                                            return (
                                              <span
                                                key={colorName}
                                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                              >
                                                {colorName} ({(colorGroup as any).totalQuantity})
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                
                                {/* Price */}
                                <td className="p-4">
                                  <span className="text-gray-700">{formatPrice(group.items[0].price)}</span>
                                </td>
                                
                                {/* Quantity */}
                                <td className="p-4">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => handleGroupQuantityChange(group, totalQuantity + 1)}
                                      className="w-7 h-7 rounded-md bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                    </button>
                                    <input
                                      type="number"
                                      value={totalQuantity}
                                      onChange={(e) => {
                                        const newValue = parseInt(e.target.value);
                                        if (!isNaN(newValue) && newValue >= 1) {
                                          handleGroupQuantityChange(group, newValue);
                                        }
                                      }}
                                      onFocus={(e) => e.target.select()}
                                      className="w-14 h-7 text-center font-medium text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      min="1"
                                    />
                                    <button
                                      onClick={() => totalQuantity > 1 && handleGroupQuantityChange(group, totalQuantity - 1)}
                                      disabled={totalQuantity <= 1}
                                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                                        totalQuantity <= 1
                                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                          : 'bg-gray-200 hover:bg-gray-300'
                                      }`}
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                                
                                {/* Total */}
                                <td className="p-4">
                                  <span className="font-bold text-gray-900">{formatPrice(productTotal)}</span>
                                </td>
                                
                                {/* Notes */}
                                <td className="p-4">
                                  {group.items.map((item, itemIndex) => (
                                    <div key={item.id} className={itemIndex > 0 ? 'mt-2 pt-2 border-t border-gray-200' : ''}>
                                      {editingNotesId === item.id ? (
                                        <div className="flex items-center gap-1">
                                          <input
                                            ref={notesInputRef}
                                            type="text"
                                            value={tempNotes}
                                            onChange={(e) => setTempNotes(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') handleSaveNotes(item.id);
                                              if (e.key === 'Escape') handleCancelEditNotes();
                                            }}
                                            placeholder="أدخل ملاحظة..."
                                            className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                                          />
                                          <button
                                            onClick={() => handleSaveNotes(item.id)}
                                            className="p-1 text-green-600 hover:text-green-700"
                                            title="حفظ"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                          </button>
                                          <button
                                            onClick={handleCancelEditNotes}
                                            className="p-1 text-red-500 hover:text-red-600"
                                            title="إلغاء"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => handleStartEditNotes(item.id, item.notes || '')}
                                          className="text-sm text-gray-700 hover:text-blue-600 hover:underline cursor-pointer max-w-[150px] text-right"
                                          title="انقر للتعديل"
                                        >
                                          {item.notes || <span className="text-gray-400">+ إضافة ملاحظة</span>}
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </td>

                                {/* Delete */}
                                <td className="p-4">
                                  <button
                                    onClick={() => {
                                      group.items.forEach(item => handleRemoveItem(item.id));
                                    }}
                                    className="text-red-500 hover:text-red-700 transition-colors bg-red-50 rounded-full p-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Second Section - Desktop: 3 columns (1:2 ratio), Tablet: Vertical */}
                <div className="xl:grid xl:grid-cols-3 xl:gap-6 space-y-6 xl:space-y-0">
                  {/* Desktop: Right Sidebar (appears on left) - Takes 1 column - All three components vertically */}
                  <div className="xl:col-span-1 xl:order-2 order-2 space-y-6">
                    {/* Section 1: Delivery Method */}
                    <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-md">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">طريقة استلام الطلب</h3>
                      
                      {/* Desktop & Tablet: Horizontal buttons, Mobile: Vertical */}
                      <div className="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
                        {/* Pickup Option */}
                        <button
                          onClick={() => handleDeliveryMethodChange('pickup')}
                          className={`w-full p-3 rounded-lg border-2 transition-all ${
                            deliveryMethod === 'pickup'
                              ? 'bg-green-50 border-green-500'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="xl:flex-col xl:items-center xl:text-center md:flex-col md:items-center md:text-center flex items-center gap-3 xl:gap-2 md:gap-2">
                            <div className="text-2xl xl:text-lg md:text-lg">🏪</div>
                            <div className="flex-1 text-right xl:text-center xl:flex-none md:text-center md:flex-none">
                              <div className={`font-medium text-sm xl:text-xs md:text-xs ${deliveryMethod === 'pickup' ? 'text-green-700' : 'text-gray-700'}`}>حجز واستلام</div>
                              <div className={`text-xs xl:text-[10px] md:text-[10px] mt-1 ${deliveryMethod === 'pickup' ? 'text-green-600' : 'text-gray-500'}`}>استلام من المتجر مجاناً</div>
                            </div>
                            <div className={`w-4 h-4 xl:w-3 xl:h-3 md:w-3 md:h-3 rounded-full border-2 xl:mt-1 md:mt-1 ${
                              deliveryMethod === 'pickup'
                                ? 'bg-green-500 border-green-500'
                                : 'border-gray-300'
                            }`}>
                              {deliveryMethod === 'pickup' && (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-2 h-2 xl:w-1.5 xl:h-1.5 md:w-1.5 md:h-1.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </div>
                        </button>

                        {/* Delivery Option */}
                        <button
                          onClick={() => handleDeliveryMethodChange('delivery')}
                          className={`w-full p-3 rounded-lg border-2 transition-all ${
                            deliveryMethod === 'delivery'
                              ? 'bg-blue-50 border-blue-500'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="xl:flex-col xl:items-center xl:text-center md:flex-col md:items-center md:text-center flex items-center gap-3 xl:gap-2 md:gap-2">
                            <div className="text-2xl xl:text-lg md:text-lg">🚚</div>
                            <div className="flex-1 text-right xl:text-center xl:flex-none md:text-center md:flex-none">
                              <div className={`font-medium text-sm xl:text-xs md:text-xs ${deliveryMethod === 'delivery' ? 'text-blue-700' : 'text-gray-700'}`}>شحن وتوصيل للمنزل</div>
                              <div className={`text-xs xl:text-[10px] md:text-[10px] mt-1 ${deliveryMethod === 'delivery' ? 'text-blue-600' : 'text-gray-500'}`}>توصيل حتى باب المنزل</div>
                            </div>
                            <div className={`w-4 h-4 xl:w-3 xl:h-3 md:w-3 md:h-3 rounded-full border-2 xl:mt-1 md:mt-1 ${
                              deliveryMethod === 'delivery'
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-gray-300'
                            }`}>
                              {deliveryMethod === 'delivery' && (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-2 h-2 xl:w-1.5 xl:h-1.5 md:w-1.5 md:h-1.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      </div>

                      {/* Shipping Details - Only show when delivery is selected */}
                      {deliveryMethod === 'delivery' && (
                        <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
                          <h4 className="text-sm font-semibold text-gray-900">تفاصيل الشحن</h4>
                          
                          {/* Shipping Company - Only show if multiple companies */}
                          {shippingCompanies.length > 1 && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">شركة الشحن</label>
                              <select
                                value={selectedCompany}
                                onChange={(e) => handleCompanySelect(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 bg-white"
                              >
                                <option value="" className="text-gray-900">اختر شركة الشحن</option>
                                {shippingCompanies.map((company) => (
                                  <option key={company.id} value={company.id} className="text-gray-900">
                                    {company.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Governorate Selection */}
                          {(shippingCompanies.length > 0 && ((shippingCompanies.length === 1) || (shippingCompanies.length > 1 && selectedCompany))) && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">المحافظة</label>
                              <select
                                value={selectedGovernorate}
                                onChange={(e) => handleGovernorateSelect(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 bg-white"
                              >
                                <option value="" className="text-gray-900">اختر المحافظة</option>
                                {governorates.map((gov) => (
                                  <option key={gov.id} value={gov.id} className="text-gray-900">
                                    {gov.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Area Selection - Only for complex governorates */}
                          {selectedGovernorate && governorates.find(g => g.id === selectedGovernorate)?.type === 'complex' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">المنطقة</label>
                              <select
                                value={selectedArea}
                                onChange={(e) => handleAreaSelect(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 bg-white"
                              >
                                <option value="" className="text-gray-900">اختر المنطقة</option>
                                {governorates.find(g => g.id === selectedGovernorate)?.areas?.map((area) => (
                                  <option key={area.id} value={area.id} className="text-gray-900">
                                    {area.name} - {formatPrice(area.price)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Shipping Cost Display */}
                          {shippingCost > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded p-2">
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-blue-700">تكلفة الشحن:</div>
                                <div className="text-sm font-bold text-blue-700">{formatPrice(shippingCost)}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Section 2: Customer Data */}
                    <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-md">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">بيانات العميل</h3>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
                          <input
                            type="text"
                            value={customerData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            placeholder="أدخل اسم العميل"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors text-gray-900 bg-white placeholder-gray-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
                          <input
                            type="tel"
                            value={customerData.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            placeholder="أدخل رقم الهاتف (يفضل أن يكون عليه واتساب)"
                            maxLength={11}
                            pattern="^01[0-9]{9}$"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors text-gray-900 bg-white placeholder-gray-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">رقم هاتف آخر (اختياري)</label>
                          <input
                            type="tel"
                            value={customerData.altPhone}
                            onChange={(e) => handleInputChange('altPhone', e.target.value)}
                            placeholder="أدخل رقم هاتف آخر"
                            maxLength={11}
                            pattern="^01[0-9]{9}$"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors text-gray-900 bg-white placeholder-gray-500"
                          />
                        </div>

                        {/* Address field - only show for delivery */}
                        {deliveryMethod === 'delivery' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                            <textarea
                              value={customerData.address}
                              onChange={(e) => handleInputChange('address', e.target.value)}
                              placeholder="أدخل عنوان التوصيل"
                              rows={3}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors resize-none text-gray-900 bg-white placeholder-gray-500"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section 3: Order Summary */}
                    <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-md">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">ملخص الطلب</h3>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>المجموع الفرعي:</span>
                          <span>{formatPrice(subtotal)}</span>
                        </div>
                        
                        {/* Only show shipping row if delivery method is selected */}
                        {deliveryMethod === 'delivery' && (
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>الشحن:</span>
                            <span>
                              {shipping > 0 ? formatPrice(shipping) : (
                                <span className="text-orange-500 text-xs">يرجى اختيار المنطقة</span>
                              )}
                            </span>
                          </div>
                        )}
                        
                        <div className="border-t border-gray-200 pt-2">
                          <div className="flex justify-between text-lg font-bold text-gray-900">
                            <span>الإجمالي:</span>
                            <span>{formatPrice(total)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="space-y-3 mt-6">
                        <button
                          onClick={handleConfirmOrder}
                          disabled={cartItems.length === 0}
                          className={`w-full font-medium py-3 px-4 rounded-lg transition-colors duration-200 text-sm ${
                            cartItems.length === 0
                              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                              : 'text-white hover:opacity-90'
                          }`}
                          style={cartItems.length > 0 ? {backgroundColor: 'var(--primary-color)'} : {}}
                        >
                          تأكيد الطلب ({Object.keys(groupedCartItems).length} منتج)
                        </button>
                        
                        <button
                          onClick={handleClearCart}
                          disabled={cartItems.length === 0}
                          className={`w-full font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm ${
                            cartItems.length === 0
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-600 hover:bg-gray-700 text-white'
                          }`}
                        >
                          مسح السلة
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Only: Left Area (appears on right) - Takes 2 columns - Products Table */}
                  <div className="xl:col-span-2 xl:order-1 hidden xl:block">
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                      <div className="p-4 text-center border-b">
                        <h3 className="text-xl font-semibold" style={{color: 'var(--primary-color)'}}>ملخص الطلب</h3>
                      </div>
                      
                      {/* Products Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead style={{backgroundColor: '#f8f9fa'}}>
                            <tr className="text-gray-700 text-sm font-medium">
                              <th className="p-4 text-right">المنتج</th>
                              <th className="p-4 text-right">السعر</th>
                              <th className="p-4 text-center">الكمية</th>
                              <th className="p-4 text-right">الإجمالي</th>
                              <th className="p-4 text-right">ملاحظات</th>
                              <th className="p-4 text-right">حذف</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.values(groupedCartItems).map((group) => {
                              const productTotal = group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                              const totalQuantity = group.items.reduce((sum, item) => sum + item.quantity, 0);
                              
                              // Group items by color
                              const colorGroups = group.items.reduce((colors, item) => {
                                const colorKey = item.selected_color || 'بدون لون';
                                if (!colors[colorKey]) {
                                  colors[colorKey] = { items: [], totalQuantity: 0 };
                                }
                                colors[colorKey].items.push(item);
                                colors[colorKey].totalQuantity += item.quantity;
                                return colors;
                              }, {} as Record<string, { items: CartItemData[]; totalQuantity: number }>);

                              return (
                                <tr key={group.product?.id || group.items[0]?.product_id} className="border-b hover:bg-gray-50">
                                  {/* Product */}
                                  <td className="p-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                                        <img 
                                          src={group.product?.main_image_url || '/placeholder-product.svg'} 
                                          alt={group.product?.name || 'منتج'}
                                          className="w-full h-full object-cover rounded-lg"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            if (target.src !== '/placeholder-product.svg') {
                                              target.src = '/placeholder-product.svg';
                                            }
                                          }}
                                        />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-gray-900 text-base truncate">{group.product?.name || 'منتج غير معروف'}</h4>
                                        <div className="text-sm text-gray-500 mt-1">
                                          كود {group.product?.product_code || 'غير محدد'}
                                        </div>
                                        {/* Colors */}
                                        {Object.keys(colorGroups).some(colorName => colorName !== 'بدون لون') && (
                                          <div className="flex flex-wrap gap-1 mt-2">
                                            {Object.entries(colorGroups).map(([colorName, colorGroup]) => {
                                              if (colorName === 'بدون لون') return null;
                                              
                                              return (
                                                <span
                                                  key={colorName}
                                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                                >
                                                  {colorName} ({(colorGroup as any).totalQuantity})
                                                </span>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  
                                  {/* Price */}
                                  <td className="p-4">
                                    <span className="text-gray-700">{formatPrice(group.items[0].price)}</span>
                                  </td>
                                  
                                  {/* Quantity */}
                                  <td className="p-4">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => handleGroupQuantityChange(group, totalQuantity + 1)}
                                        className="w-7 h-7 rounded-md bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                      </button>
                                      <input
                                        type="number"
                                        value={totalQuantity}
                                        onChange={(e) => {
                                          const newValue = parseInt(e.target.value);
                                          if (!isNaN(newValue) && newValue >= 1) {
                                            handleGroupQuantityChange(group, newValue);
                                          }
                                        }}
                                        onFocus={(e) => e.target.select()}
                                        className="w-14 h-7 text-center font-medium text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        min="1"
                                      />
                                      <button
                                        onClick={() => totalQuantity > 1 && handleGroupQuantityChange(group, totalQuantity - 1)}
                                        disabled={totalQuantity <= 1}
                                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                                          totalQuantity <= 1
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-gray-200 hover:bg-gray-300'
                                        }`}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                  
                                  {/* Total */}
                                  <td className="p-4">
                                    <span className="font-bold text-gray-900">{formatPrice(productTotal)}</span>
                                  </td>
                                  
                                  {/* Notes */}
                                  <td className="p-4">
                                    {group.items.map((item, itemIndex) => (
                                      <div key={item.id} className={itemIndex > 0 ? 'mt-2 pt-2 border-t border-gray-200' : ''}>
                                        {editingNotesId === item.id ? (
                                          <div className="flex items-center gap-1">
                                            <input
                                              ref={notesInputRef}
                                              type="text"
                                              value={tempNotes}
                                              onChange={(e) => setTempNotes(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveNotes(item.id);
                                                if (e.key === 'Escape') handleCancelEditNotes();
                                              }}
                                              placeholder="أدخل ملاحظة..."
                                              className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                                            />
                                            <button
                                              onClick={() => handleSaveNotes(item.id)}
                                              className="p-1 text-green-600 hover:text-green-700"
                                              title="حفظ"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                              </svg>
                                            </button>
                                            <button
                                              onClick={handleCancelEditNotes}
                                              className="p-1 text-red-500 hover:text-red-600"
                                              title="إلغاء"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                              </svg>
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => handleStartEditNotes(item.id, item.notes || '')}
                                            className="text-sm text-gray-700 hover:text-blue-600 hover:underline cursor-pointer max-w-[150px] text-right"
                                            title="انقر للتعديل"
                                          >
                                            {item.notes || <span className="text-gray-400">+ إضافة ملاحظة</span>}
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </td>

                                  {/* Delete */}
                                  <td className="p-4">
                                    <button
                                      onClick={() => {
                                        group.items.forEach(item => handleRemoveItem(item.id));
                                      }}
                                      className="text-red-500 hover:text-red-700 transition-colors bg-red-50 rounded-full p-2"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Layout */}
              <div className="md:hidden space-y-4">
                {/* Mobile Products Cards Section */}
                <div className="bg-white rounded-lg shadow-md">
                  <div className="p-4 text-center border-b">
                    <h3 className="text-base font-semibold" style={{color: 'var(--primary-color)'}}>ملخص الطلب</h3>
                  </div>
                  
                  {/* Products as Cards */}
                  <div className="p-4 space-y-4">
                    {Object.values(groupedCartItems).map((group) => {
                      const productTotal = group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                      const totalQuantity = group.items.reduce((sum, item) => sum + item.quantity, 0);
                      const firstPrice = group.items[0]?.price || 0;
                      
                      return (
                        <div key={group.product?.id || group.items[0]?.product_id} style={{backgroundColor: '#f1f1f1'}} className="rounded-lg p-3 relative">
                          {/* Delete button */}
                          <button
                            onClick={() => {
                              group.items.forEach(item => handleRemoveItem(item.id));
                            }}
                            className="absolute top-2 left-2 text-red-500 hover:text-red-700 transition-colors bg-white rounded-full p-1 shadow-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>

                          {/* Product header with image and name */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                              <img 
                                src={group.product?.main_image_url || '/placeholder-product.svg'} 
                                alt={group.product?.name || 'منتج'}
                                className="w-full h-full object-cover rounded-lg"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  if (target.src !== '/placeholder-product.svg') {
                                    target.src = '/placeholder-product.svg';
                                  }
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 text-sm">{group.product?.name || 'منتج غير معروف'}</h4>
                              <div className="text-xs text-gray-500">
                                كود {group.product?.product_code || 'غير محدد'}
                              </div>
                            </div>
                          </div>

                          {/* Four data boxes */}
                          <div className="grid grid-cols-2 gap-2">
                            {/* Unit Price */}
                            <div className="bg-white rounded-lg p-2 text-center">
                              <div className="text-xs text-gray-500 mb-1">سعر القطعة</div>
                              <div className="text-sm font-medium text-gray-900">{formatPrice(firstPrice)}</div>
                            </div>
                            
                            {/* Quantity */}
                            <div className="bg-white rounded-lg p-2">
                              <div className="text-xs text-gray-500 mb-1 text-center">الكمية</div>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleGroupQuantityChange(group, totalQuantity + 1)}
                                  className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                                <input
                                  type="number"
                                  value={totalQuantity}
                                  onChange={(e) => {
                                    const newValue = parseInt(e.target.value);
                                    if (!isNaN(newValue) && newValue >= 1) {
                                      handleGroupQuantityChange(group, newValue);
                                    }
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  className="w-10 h-6 text-center text-sm font-medium text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  min="1"
                                />
                                <button
                                  onClick={() => totalQuantity > 1 && handleGroupQuantityChange(group, totalQuantity - 1)}
                                  disabled={totalQuantity <= 1}
                                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                                    totalQuantity <= 1
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'bg-gray-200 hover:bg-gray-300'
                                  }`}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            
                            {/* Total */}
                            <div className="bg-white rounded-lg p-2 text-center">
                              <div className="text-xs text-gray-500 mb-1">الإجمالي</div>
                              <div className="text-sm font-bold text-gray-900">{formatPrice(productTotal)}</div>
                            </div>
                            
                            {/* Notes */}
                            <div className="bg-white rounded-lg p-2 text-center">
                              <div className="text-xs text-gray-500 mb-1">ملاحظات</div>
                              {group.items.map((item, itemIndex) => (
                                <div key={item.id} className={itemIndex > 0 ? 'mt-1 pt-1 border-t border-gray-100' : ''}>
                                  {editingNotesId === item.id ? (
                                    <div className="flex items-center gap-1 justify-center">
                                      <input
                                        ref={notesInputRef}
                                        type="text"
                                        value={tempNotes}
                                        onChange={(e) => setTempNotes(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveNotes(item.id);
                                          if (e.key === 'Escape') handleCancelEditNotes();
                                        }}
                                        placeholder="ملاحظة..."
                                        className="w-16 px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                                      />
                                      <button
                                        onClick={() => handleSaveNotes(item.id)}
                                        className="p-0.5 text-green-600 hover:text-green-700"
                                        title="حفظ"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={handleCancelEditNotes}
                                        className="p-0.5 text-red-500 hover:text-red-600"
                                        title="إلغاء"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleStartEditNotes(item.id, item.notes || '')}
                                      className="text-xs text-gray-700 hover:text-blue-600 hover:underline cursor-pointer truncate max-w-full"
                                      title="انقر للتعديل"
                                    >
                                      {item.notes || <span className="text-gray-400">+ إضافة</span>}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Delivery Method Section */}
                <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-md">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">طريقة استلام الطلب</h3>
                  
                  <div className="space-y-3">
                    {/* Pickup Option */}
                    <button
                      onClick={() => handleDeliveryMethodChange('pickup')}
                      className={`w-full p-3 rounded-lg border-2 transition-all ${
                        deliveryMethod === 'pickup'
                          ? 'bg-green-50 border-green-500'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-lg">🏪</div>
                        <div className="flex-1 text-right">
                          <div className={`font-medium text-sm ${deliveryMethod === 'pickup' ? 'text-green-700' : 'text-gray-700'}`}>حجز واستلام</div>
                          <div className={`text-xs mt-1 ${deliveryMethod === 'pickup' ? 'text-green-600' : 'text-gray-500'}`}>استلام من المتجر مجاناً</div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          deliveryMethod === 'pickup'
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-300'
                        }`}>
                          {deliveryMethod === 'pickup' && (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Delivery Option */}
                    <button
                      onClick={() => handleDeliveryMethodChange('delivery')}
                      className={`w-full p-3 rounded-lg border-2 transition-all ${
                        deliveryMethod === 'delivery'
                          ? 'bg-blue-50 border-blue-500'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-lg">🚚</div>
                        <div className="flex-1 text-right">
                          <div className={`font-medium text-sm ${deliveryMethod === 'delivery' ? 'text-blue-700' : 'text-gray-700'}`}>شحن وتوصيل للمنزل</div>
                          <div className={`text-xs mt-1 ${deliveryMethod === 'delivery' ? 'text-blue-600' : 'text-gray-500'}`}>توصيل حتى باب المنزل</div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          deliveryMethod === 'delivery'
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-300'
                        }`}>
                          {deliveryMethod === 'delivery' && (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Shipping Details - Only show when delivery is selected */}
                  {deliveryMethod === 'delivery' && (
                    <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
                      <h4 className="text-sm font-semibold text-gray-900">تفاصيل الشحن</h4>
                      
                      {/* Shipping Company - Only show if multiple companies */}
                      {shippingCompanies.length > 1 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">شركة الشحن</label>
                          <select
                            value={selectedCompany}
                            onChange={(e) => handleCompanySelect(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 bg-white"
                          >
                            <option value="" className="text-gray-900">اختر شركة الشحن</option>
                            {shippingCompanies.map((company) => (
                              <option key={company.id} value={company.id} className="text-gray-900">
                                {company.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Governorate Selection */}
                      {(shippingCompanies.length > 0 && ((shippingCompanies.length === 1) || (shippingCompanies.length > 1 && selectedCompany))) && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">المحافظة</label>
                          <select
                            value={selectedGovernorate}
                            onChange={(e) => handleGovernorateSelect(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 bg-white"
                          >
                            <option value="" className="text-gray-900">اختر المحافظة</option>
                            {governorates.map((gov) => (
                              <option key={gov.id} value={gov.id} className="text-gray-900">
                                {gov.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Area Selection - Only for complex governorates */}
                      {selectedGovernorate && governorates.find(g => g.id === selectedGovernorate)?.type === 'complex' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">المنطقة</label>
                          <select
                            value={selectedArea}
                            onChange={(e) => handleAreaSelect(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 bg-white"
                          >
                            <option value="" className="text-gray-900">اختر المنطقة</option>
                            {governorates.find(g => g.id === selectedGovernorate)?.areas?.map((area) => (
                              <option key={area.id} value={area.id} className="text-gray-900">
                                {area.name} - {formatPrice(area.price)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Shipping Cost Display */}
                      {shippingCost > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-blue-700">تكلفة الشحن:</div>
                            <div className="text-sm font-bold text-blue-700">{formatPrice(shippingCost)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Customer Data Section */}
                <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-md">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">بيانات العميل</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
                      <input
                        type="text"
                        value={customerData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="أدخل اسم العميل"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors text-gray-900 bg-white placeholder-gray-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
                      <input
                        type="tel"
                        value={customerData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="أدخل رقم الهاتف (يفضل أن يكون عليه واتساب)"
                        maxLength={11}
                        pattern="^01[0-9]{9}$"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors text-gray-900 bg-white placeholder-gray-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">رقم هاتف آخر (اختياري)</label>
                      <input
                        type="tel"
                        value={customerData.altPhone}
                        onChange={(e) => handleInputChange('altPhone', e.target.value)}
                        placeholder="أدخل رقم هاتف آخر"
                        maxLength={11}
                        pattern="^01[0-9]{9}$"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors text-gray-900 bg-white placeholder-gray-500"
                      />
                    </div>

                    {/* Address field - only show for delivery */}
                    {deliveryMethod === 'delivery' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                        <textarea
                          value={customerData.address}
                          onChange={(e) => handleInputChange('address', e.target.value)}
                          placeholder="أدخل عنوان التوصيل"
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors resize-none text-gray-900 bg-white placeholder-gray-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Summary Section */}
                <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-md">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">ملخص الطلب</h3>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>المجموع الفرعي:</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    
                    {/* Only show shipping row if delivery method is selected */}
                    {deliveryMethod === 'delivery' && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>الشحن:</span>
                        <span>
                          {shipping > 0 ? formatPrice(shipping) : (
                            <span className="text-orange-500 text-xs">يرجى اختيار المنطقة</span>
                          )}
                        </span>
                      </div>
                    )}
                    
                    <div className="border-t border-gray-200 pt-2">
                      <div className="flex justify-between text-base font-bold text-gray-900">
                        <span>الإجمالي:</span>
                        <span>{formatPrice(total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="space-y-3 mt-6">
                    <button
                      onClick={handleConfirmOrder}
                      disabled={cartItems.length === 0}
                      className={`w-full font-medium py-3 px-4 rounded-lg transition-colors duration-200 text-sm ${
                        cartItems.length === 0
                          ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                          : 'text-white hover:opacity-90'
                      }`}
                      style={cartItems.length > 0 ? {backgroundColor: 'var(--primary-color)'} : {}}
                    >
                      تأكيد الطلب ({Object.keys(groupedCartItems).length} منتج)
                    </button>
                    
                    <button
                      onClick={handleClearCart}
                      disabled={cartItems.length === 0}
                      className={`w-full font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm ${
                        cartItems.length === 0
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-600 hover:bg-gray-700 text-white'
                      }`}
                    >
                      مسح السلة
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default CartModal;