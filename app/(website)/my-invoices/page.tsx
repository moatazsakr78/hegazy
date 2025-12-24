'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatPrice } from '@/lib/hooks/useCurrency';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { useStoreTheme } from '@/lib/hooks/useStoreTheme';
import { useAuth } from '@/app/lib/hooks/useAuth';
import SimpleDateFilterModal, { DateFilter } from '@/app/components/SimpleDateFilterModal';
import { CalendarDaysIcon, PrinterIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

// Types
interface SaleItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number | null;
  products?: {
    name: string;
    product_code: string | null;
    main_image_url: string | null;
  };
}

interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  tax_amount: number | null;
  discount_amount: number | null;
  payment_method: string;
  notes: string | null;
  created_at: string;
  time: string | null;
  invoice_type: string | null;
  records?: { name: string } | null;
  sale_items?: SaleItem[];
}

interface Payment {
  id: string;
  amount: number;
  payment_method: string | null;
  notes: string | null;
  payment_date: string | null;
  created_at: string;
  records?: { name: string } | null;
}

interface StatementEntry {
  id: string;
  date: string;
  time: string | null;
  type: string;
  description: string;
  invoiceValue: number;
  paidAmount: number;
  balance: number;
  record: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  governorate: string | null;
  account_balance: number | null;
  loyalty_points: number | null;
  rank: string | null;
  created_at: string | null;
}

interface Statistics {
  totalInvoices: number;
  totalInvoicesAmount: number;
  totalPayments: number;
  averageOrderValue: number;
  lastInvoiceDate: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

type TabType = 'invoices' | 'statement' | 'payments';

export default function MyInvoicesPage() {
  const router = useRouter();
  const formatPrice = useFormatPrice();
  const { logoUrl, companyName, isLoading: isCompanyLoading } = useCompanySettings();
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const { primaryColor, isLoading: isThemeLoading } = useStoreTheme();

  // State
  const [activeTab, setActiveTab] = useState<TabType>('invoices');
  const [loading, setLoading] = useState(true);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [statement, setStatement] = useState<StatementEntry[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  // Date filter state
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: 'all' });

  // Mobile: expanded customer details
  const [mobileDetailsExpanded, setMobileDetailsExpanded] = useState(false);

  // Expanded invoice details
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  // Ref for print
  const printRef = useRef<HTMLDivElement>(null);

  // Convert DateFilter to API parameters
  const getDateParams = useCallback(() => {
    const now = new Date();
    let startDate: string | undefined;
    let endDate: string | undefined;

    switch (dateFilter.type) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
        endDate = startDate;
        break;
      case 'current_week':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startDate = startOfWeek.toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
        break;
      case 'last_week':
        const lastWeekEnd = new Date(now);
        lastWeekEnd.setDate(now.getDate() - now.getDay() - 1);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
        startDate = lastWeekStart.toISOString().split('T')[0];
        endDate = lastWeekEnd.toISOString().split('T')[0];
        break;
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
        break;
      case 'last_month':
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = lastMonthStart.toISOString().split('T')[0];
        endDate = lastMonthEnd.toISOString().split('T')[0];
        break;
      case 'custom':
        if (dateFilter.startDate) {
          startDate = dateFilter.startDate.toISOString().split('T')[0];
        }
        if (dateFilter.endDate) {
          endDate = dateFilter.endDate.toISOString().split('T')[0];
        }
        break;
    }

    return { startDate, endDate };
  }, [dateFilter]);

  // Fetch all data at once (invoices, payments, statement)
  const fetchAllData = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;

    setLoading(true);
    try {
      const { startDate, endDate } = getDateParams();

      // Fetch all three tabs data in parallel
      const [invoicesRes, paymentsRes, statementRes] = await Promise.all([
        fetch(`/api/user/invoices?tab=invoices&page=1&limit=100${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`),
        fetch(`/api/user/invoices?tab=payments&page=1&limit=100${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`),
        fetch(`/api/user/invoices?tab=statement&page=1&limit=100${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`)
      ]);

      if (!invoicesRes.ok || !paymentsRes.ok || !statementRes.ok) {
        console.error('API Error fetching data');
        setLoading(false);
        return;
      }

      const [invoicesData, paymentsData, statementData] = await Promise.all([
        invoicesRes.json(),
        paymentsRes.json(),
        statementRes.json()
      ]);

      // Set customer and statistics from first response (they're the same across all)
      setCustomer(invoicesData.customer);
      setStatistics(invoicesData.statistics);

      // Set all data
      setInvoices(invoicesData.invoices || []);
      setPayments(paymentsData.payments || []);
      setStatement(statementData.statement || []);

      setInitialDataLoaded(true);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.id, getDateParams]);

  // Fetch data for specific tab (used for pagination/load more)
  const fetchTabData = useCallback(async (tab: TabType, page: number = 1) => {
    if (!isAuthenticated || !user?.id) return;

    try {
      const params = new URLSearchParams({
        tab,
        page: page.toString(),
        limit: '20'
      });

      const { startDate, endDate } = getDateParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/user/invoices?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        console.error('API Error:', error);
        return;
      }

      const data = await response.json();

      setPagination(data.pagination);

      if (tab === 'invoices') {
        setInvoices(prev => page === 1 ? (data.invoices || []) : [...prev, ...(data.invoices || [])]);
      } else if (tab === 'payments') {
        setPayments(prev => page === 1 ? (data.payments || []) : [...prev, ...(data.payments || [])]);
      } else if (tab === 'statement') {
        setStatement(prev => page === 1 ? (data.statement || []) : [...prev, ...(data.statement || [])]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [isAuthenticated, user?.id, getDateParams]);

  // Initial load - fetch all data once
  useEffect(() => {
    if (isAuthLoading) return;

    if (!isAuthenticated || !user?.id) {
      setLoading(false);
      return;
    }

    fetchAllData();
  }, [isAuthenticated, user?.id, isAuthLoading, fetchAllData]);

  // Refetch all data when date filter changes
  useEffect(() => {
    if (isAuthenticated && user?.id && initialDataLoaded) {
      fetchAllData();
    }
  }, [dateFilter]);

  // Handle tab change - NO API call, just switch tab (smooth transition)
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setExpandedInvoice(null);
    // No fetchData call - data is already loaded!
  };

  // Load more (pagination)
  const loadMore = () => {
    if (pagination && pagination.hasMore) {
      fetchTabData(activeTab, pagination.page + 1);
    }
  };

  // Get filter display text
  const getFilterDisplayText = () => {
    switch (dateFilter.type) {
      case 'all': return 'جميع الفواتير';
      case 'today': return 'اليوم';
      case 'current_week': return 'الأسبوع الحالي';
      case 'last_week': return 'الأسبوع الماضي';
      case 'current_month': return 'الشهر الحالي';
      case 'last_month': return 'الشهر الماضي';
      case 'custom':
        if (dateFilter.startDate && dateFilter.endDate) {
          return `${dateFilter.startDate.toLocaleDateString('en-GB')} - ${dateFilter.endDate.toLocaleDateString('en-GB')}`;
        }
        return 'فترة مخصصة';
      default: return 'جميع الفواتير';
    }
  };

  // Print function
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '', 'width=900,height=650');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <title>${activeTab === 'invoices' ? 'فواتيري' : activeTab === 'statement' ? 'كشف الحساب' : 'الدفعات'}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Cairo', sans-serif;
            direction: rtl;
            padding: 20px;
            background: white;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .logo { height: 60px; }
          .title { font-size: 24px; font-weight: bold; }
          .customer-info {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .customer-info h3 { margin-bottom: 10px; color: #333; }
          .customer-info p { margin: 5px 0; color: #666; }
          .balance {
            font-size: 20px;
            font-weight: bold;
            color: ${getActualBalance() > 0 ? '#dc2626' : '#16a34a'};
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: center;
          }
          th {
            background: #333;
            color: white;
          }
          tr:nth-child(even) { background: #f9f9f9; }
          .print-date {
            text-align: center;
            margin-top: 20px;
            color: #888;
            font-size: 12px;
          }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${activeTab === 'invoices' ? 'فواتيري' : activeTab === 'statement' ? 'كشف الحساب' : 'الدفعات'}</div>
          <img src="${logoUrl || '/assets/logo/Hegazy.png'}" class="logo" />
        </div>
        <div class="customer-info">
          <h3>بيانات العميل</h3>
          <p><strong>الاسم:</strong> ${customer?.name || '-'}</p>
          <p><strong>الهاتف:</strong> ${customer?.phone || '-'}</p>
          <p class="balance"><strong>الرصيد الحالي:</strong> ${formatPrice(getActualBalance())}</p>
        </div>
        ${printContent.innerHTML}
        <p class="print-date">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Translate invoice type to Arabic
  const translateInvoiceType = (type: string | null) => {
    if (!type) return 'فاتورة بيع';
    const translations: Record<string, string> = {
      'Sale Invoice': 'فاتورة بيع',
      'sale_invoice': 'فاتورة بيع',
      'Return Invoice': 'فاتورة مرتجع',
      'return_invoice': 'فاتورة مرتجع',
      'فاتورة بيع': 'فاتورة بيع',
      'فاتورة مرتجع': 'فاتورة مرتجع',
    };
    return translations[type] || type;
  };

  // Calculate actual balance from statistics (invoices - payments)
  const getActualBalance = () => {
    if (!statistics) return customer?.account_balance || 0;
    return statistics.totalInvoicesAmount - statistics.totalPayments;
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // Format time
  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-';
    return timeString.substring(0, 5);
  };

  // Toggle invoice details
  const toggleInvoiceDetails = (invoiceId: string) => {
    setExpandedInvoice(expandedInvoice === invoiceId ? null : invoiceId);
  };

  // Loading state
  if (loading || isCompanyLoading || isThemeLoading || isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#c0c0c0' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#c0c0c0' }}>
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-800 mb-2">تسجيل الدخول مطلوب</h2>
          <p className="text-gray-600 mb-4">يرجى تسجيل الدخول لعرض فواتيرك</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 text-white rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--primary-color)' }}
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  // No customer account
  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#c0c0c0' }}>
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <svg className="w-16 h-16 mx-auto mb-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-800 mb-2">لا يوجد حساب عميل</h2>
          <p className="text-gray-600 mb-4">لم يتم العثور على حساب عميل مرتبط بحسابك</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 text-white rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--primary-color)' }}
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#c0c0c0' }}>
      {/* Hide system headers */}
      <style jsx global>{`
        body { margin-top: 0 !important; padding-top: 0 !important; }
        html { margin-top: 0 !important; padding-top: 0 !important; }
      `}</style>

      {/* Header */}
      <header className="border-b border-gray-700 py-0 relative z-40 flex-shrink-0" style={{ backgroundColor: 'var(--primary-color)' }}>
        <div className="relative flex items-center min-h-[60px] md:min-h-[80px]">
          <div className="w-full px-4 flex items-center justify-between min-h-[60px] md:min-h-[80px]">
            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className="flex items-center p-2 text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden md:inline mr-2">العودة</span>
            </button>

            {/* Title */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <h1 className="text-lg md:text-2xl font-bold text-white text-center whitespace-nowrap">
                فواتيري
              </h1>
            </div>

            {/* Logo */}
            <div className="flex items-center">
              <img src={logoUrl || '/assets/logo/Hegazy.png'} alt={companyName} className="h-12 w-12 md:h-16 md:w-16 object-contain" />
            </div>
          </div>
        </div>
      </header>

      {/* ==================== MOBILE LAYOUT ==================== */}
      <div className="md:hidden flex-1 flex flex-col overflow-hidden">

        {/* Mobile: Customer Summary Card (Collapsible) */}
        <div className="bg-white mx-3 mt-3 rounded-xl shadow-md overflow-hidden">
          {/* Header - Always visible */}
          <div
            className="p-4 flex items-center justify-between cursor-pointer"
            onClick={() => setMobileDetailsExpanded(!mobileDetailsExpanded)}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold"
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                {customer.name?.charAt(0) || '؟'}
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{customer.name}</h3>
                <p className={`text-sm font-semibold ${getActualBalance() > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatPrice(getActualBalance())}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setShowDateFilter(true); }}
                className="p-2 rounded-lg text-white"
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                <CalendarDaysIcon className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handlePrint(); }}
                className="p-2 bg-green-600 rounded-lg text-white"
              >
                <PrinterIcon className="h-5 w-5" />
              </button>
              {mobileDetailsExpanded ? (
                <ChevronUpIcon className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-gray-500" />
              )}
            </div>
          </div>

          {/* Expanded Details */}
          {mobileDetailsExpanded && (
            <div className="border-t border-gray-100 px-4 pb-4">
              {/* Statistics */}
              {statistics && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-gray-50 p-3 rounded-lg text-center">
                    <p className="text-xs text-gray-500">عدد الفواتير</p>
                    <p className="text-lg font-bold text-gray-800">{statistics.totalInvoices}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg text-center">
                    <p className="text-xs text-gray-500">إجمالي الفواتير</p>
                    <p className="text-lg font-bold" style={{ color: 'var(--primary-color)' }}>{formatPrice(statistics.totalInvoicesAmount)}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg text-center">
                    <p className="text-xs text-gray-500">إجمالي الدفعات</p>
                    <p className="text-lg font-bold text-green-600">{formatPrice(statistics.totalPayments)}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg text-center">
                    <p className="text-xs text-gray-500">متوسط الفاتورة</p>
                    <p className="text-lg font-bold text-gray-800">{formatPrice(statistics.averageOrderValue)}</p>
                  </div>
                </div>
              )}

              {/* Date Filter Display */}
              {dateFilter.type !== 'all' && (
                <div className="mt-3 text-center">
                  <span
                    className="inline-block px-3 py-1 rounded-full text-xs text-white"
                    style={{ backgroundColor: 'var(--primary-color)' }}
                  >
                    {getFilterDisplayText()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile: Tabs */}
        <div className="flex mx-3 mt-3 bg-white rounded-xl shadow-md overflow-hidden">
          <button
            onClick={() => handleTabChange('invoices')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'invoices' ? 'text-white' : 'text-gray-600'
            }`}
            style={{ backgroundColor: activeTab === 'invoices' ? 'var(--primary-color)' : 'transparent' }}
          >
            الفواتير
          </button>
          <button
            onClick={() => handleTabChange('statement')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'statement' ? 'text-white' : 'text-gray-600'
            }`}
            style={{ backgroundColor: activeTab === 'statement' ? 'var(--primary-color)' : 'transparent' }}
          >
            كشف الحساب
          </button>
          <button
            onClick={() => handleTabChange('payments')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'payments' ? 'text-white' : 'text-gray-600'
            }`}
            style={{ backgroundColor: activeTab === 'payments' ? 'var(--primary-color)' : 'transparent' }}
          >
            الدفعات
          </button>
        </div>

        {/* Mobile: Content */}
        <div ref={printRef} className="flex-1 mx-3 mt-3 mb-3 bg-white rounded-xl shadow-md overflow-y-auto scrollbar-hide">
          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <div>
              {invoices.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500">لا توجد فواتير</p>
                </div>
              ) : (
                invoices.map((invoice, index) => (
                  <div key={invoice.id} className="border-b border-gray-100 last:border-b-0">
                    <div
                      onClick={() => toggleInvoiceDetails(invoice.id)}
                      className="p-4 cursor-pointer active:bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">#{index + 1}</span>
                        <span
                          className="px-2 py-0.5 text-xs rounded-full text-white"
                          style={{ backgroundColor: 'var(--primary-color)' }}
                        >
                          {translateInvoiceType(invoice.invoice_type)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{invoice.invoice_number}</p>
                          <p className="text-xs text-gray-500">{formatDate(invoice.created_at)}</p>
                        </div>
                        <div className="text-left">
                          <p className="font-bold" style={{ color: 'var(--primary-color)' }}>{formatPrice(invoice.total_amount)}</p>
                          <p className="text-xs text-gray-500">{invoice.payment_method}</p>
                        </div>
                      </div>
                    </div>
                    {expandedInvoice === invoice.id && invoice.sale_items && (
                      <div className="px-4 pb-4 bg-gray-50">
                        <p className="text-xs font-medium text-gray-600 mb-2">تفاصيل الفاتورة:</p>
                        {invoice.sale_items.map((item, i) => (
                          <div key={item.id} className="flex justify-between text-xs py-1">
                            <span className="text-gray-700">{item.products?.name || 'منتج'} x{item.quantity}</span>
                            <span className="text-gray-800">{formatPrice(item.unit_price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Statement Tab */}
          {activeTab === 'statement' && (
            <div>
              {statement.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500">لا توجد حركات</p>
                </div>
              ) : (
                statement.map((entry, index) => (
                  <div key={entry.id} className="border-b border-gray-100 last:border-b-0 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">#{index + 1}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${entry.type === 'سلفة' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {entry.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 mb-2">{entry.description}</p>
                    <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 p-2 rounded-lg">
                      <div>
                        <p className="text-xs text-gray-500">الفاتورة</p>
                        <p className="text-sm font-medium" style={{ color: 'var(--primary-color)' }}>{entry.invoiceValue > 0 ? formatPrice(entry.invoiceValue) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">المدفوع</p>
                        <p className="text-sm font-medium text-green-600">{entry.paidAmount > 0 ? formatPrice(entry.paidAmount) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">الرصيد</p>
                        <p className={`text-sm font-bold ${entry.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatPrice(entry.balance)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div>
              {payments.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-500">لا توجد دفعات</p>
                </div>
              ) : (
                payments.map((payment, index) => (
                  <div key={payment.id} className="border-b border-gray-100 last:border-b-0 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-800">{payment.notes || 'دفعة'}</p>
                        <p className="text-xs text-gray-500">{formatDate(payment.payment_date || payment.created_at)}</p>
                      </div>
                      <p className="text-lg font-bold text-green-600">{formatPrice(payment.amount)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.hasMore && (
            <div className="p-4 text-center">
              <button
                onClick={loadMore}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm"
              >
                تحميل المزيد
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ==================== DESKTOP LAYOUT ==================== */}
      <div className="hidden md:flex flex-1 overflow-hidden p-4 gap-4">

        {/* Right Sidebar - Customer Info (Light Theme) */}
        <div className="w-72 lg:w-80 bg-white rounded-xl shadow-lg flex flex-col flex-shrink-0 overflow-hidden">

          {/* Customer Avatar & Name */}
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-md"
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                {customer.name?.charAt(0) || '؟'}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-800 truncate">{customer.name}</h2>
                <p className="text-gray-500 text-sm">{customer.phone || 'لا يوجد رقم'}</p>
              </div>
            </div>
          </div>

          {/* Account Balance */}
          <div className="p-5 border-b border-gray-100">
            <div
              className="rounded-xl p-5 text-center shadow-inner"
              style={{ backgroundColor: 'var(--primary-color)' }}
            >
              <p className={`text-3xl font-bold ${getActualBalance() > 0 ? 'text-red-200' : 'text-green-200'}`}>
                {formatPrice(getActualBalance())}
              </p>
              <p className="text-white/80 text-sm mt-1">رصيد الحساب</p>
              <p className="text-white/60 text-xs mt-1">
                {getActualBalance() > 0 ? 'عليك' : getActualBalance() < 0 ? 'لك' : 'الحساب متوازن'}
              </p>
            </div>
          </div>

          {/* Statistics */}
          {statistics && (
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-gray-700 font-semibold flex items-center gap-2 mb-4">
                <span className="text-lg">📊</span>
                <span>إحصائيات</span>
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="font-medium text-gray-800">{statistics.totalInvoices}</span>
                  <span className="text-gray-500 text-sm">عدد الفواتير</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="font-medium" style={{ color: 'var(--primary-color)' }}>{formatPrice(statistics.totalInvoicesAmount)}</span>
                  <span className="text-gray-500 text-sm">إجمالي الفواتير</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="font-medium text-green-600">{formatPrice(statistics.totalPayments)}</span>
                  <span className="text-gray-500 text-sm">إجمالي الدفعات</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="font-medium text-gray-800">{formatPrice(statistics.averageOrderValue)}</span>
                  <span className="text-gray-500 text-sm">متوسط الفاتورة</span>
                </div>
              </div>
            </div>
          )}

          {/* Date Filter Button */}
          <div className="p-5 border-b border-gray-100">
            <button
              onClick={() => setShowDateFilter(true)}
              className="w-full text-white px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:scale-[1.02]"
              style={{ backgroundColor: 'var(--primary-color)' }}
            >
              <CalendarDaysIcon className="h-5 w-5" />
              <span>التاريخ</span>
            </button>
            {dateFilter.type !== 'all' && (
              <div className="mt-3 text-center">
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs text-white"
                  style={{ backgroundColor: 'var(--primary-color)', opacity: 0.8 }}
                >
                  {getFilterDisplayText()}
                </span>
              </div>
            )}
          </div>

          {/* Print Button */}
          <div className="p-5">
            <button
              onClick={handlePrint}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:scale-[1.02]"
            >
              <PrinterIcon className="h-5 w-5" />
              <span>طباعة</span>
            </button>
          </div>

          <div className="flex-1" />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white rounded-xl shadow-lg">

          {/* Tabs */}
          <div className="flex border-b border-gray-100 flex-shrink-0">
            <button
              onClick={() => handleTabChange('invoices')}
              className={`flex-1 py-4 px-6 text-base font-semibold transition-colors ${
                activeTab === 'invoices' ? 'text-white' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
              style={{ backgroundColor: activeTab === 'invoices' ? 'var(--primary-color)' : 'transparent' }}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                الفواتير
              </span>
            </button>
            <button
              onClick={() => handleTabChange('statement')}
              className={`flex-1 py-4 px-6 text-base font-semibold transition-colors ${
                activeTab === 'statement' ? 'text-white' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
              style={{ backgroundColor: activeTab === 'statement' ? 'var(--primary-color)' : 'transparent' }}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                كشف الحساب
              </span>
            </button>
            <button
              onClick={() => handleTabChange('payments')}
              className={`flex-1 py-4 px-6 text-base font-semibold transition-colors ${
                activeTab === 'payments' ? 'text-white' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
              style={{ backgroundColor: activeTab === 'payments' ? 'var(--primary-color)' : 'transparent' }}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                الدفعات
              </span>
            </button>
          </div>

          {/* Content Area */}
          <div ref={printRef} className="flex-1 overflow-y-auto scrollbar-hide">
            {/* Invoices Tab */}
            {activeTab === 'invoices' && (
              <div>
                {invoices.length === 0 ? (
                  <div className="p-12 text-center">
                    <svg className="w-20 h-20 mx-auto mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-400 text-lg">لا توجد فواتير</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-800 text-white sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-right text-sm font-medium">#</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">رقم الفاتورة</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">التاريخ</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">الوقت</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">النوع</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">طريقة الدفع</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">المبلغ</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">الخزنة</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">تفاصيل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {invoices.map((invoice, index) => (
                          <>
                            <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                              <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--primary-color)' }}>{invoice.invoice_number}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{formatDate(invoice.created_at)}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{formatTime(invoice.time)}</td>
                              <td className="px-4 py-3">
                                <span
                                  className="px-2 py-1 text-xs rounded-full text-white"
                                  style={{ backgroundColor: 'var(--primary-color)' }}
                                >
                                  {translateInvoiceType(invoice.invoice_type)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{invoice.payment_method}</td>
                              <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--primary-color)' }}>{formatPrice(invoice.total_amount)}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{invoice.records?.name || '-'}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => toggleInvoiceDetails(invoice.id)}
                                  className="hover:underline text-sm"
                                  style={{ color: 'var(--primary-color)' }}
                                >
                                  {expandedInvoice === invoice.id ? 'إخفاء' : 'عرض'}
                                </button>
                              </td>
                            </tr>
                            {expandedInvoice === invoice.id && invoice.sale_items && (
                              <tr>
                                <td colSpan={9} className="bg-gray-50 px-6 py-4">
                                  <div className="text-sm">
                                    <p className="font-medium text-gray-700 mb-3">تفاصيل المنتجات:</p>
                                    <table className="w-full bg-white rounded-lg overflow-hidden shadow-sm">
                                      <thead className="bg-gray-100">
                                        <tr>
                                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">#</th>
                                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">المنتج</th>
                                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">الكمية</th>
                                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">السعر</th>
                                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">الإجمالي</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {invoice.sale_items.map((item, itemIndex) => (
                                          <tr key={item.id} className="border-b border-gray-50">
                                            <td className="px-3 py-2 text-xs text-gray-500">{itemIndex + 1}</td>
                                            <td className="px-3 py-2 text-xs text-gray-800">{item.products?.name || 'منتج'}</td>
                                            <td className="px-3 py-2 text-xs text-gray-600">{item.quantity}</td>
                                            <td className="px-3 py-2 text-xs text-gray-600">{formatPrice(item.unit_price)}</td>
                                            <td className="px-3 py-2 text-xs font-medium text-gray-800">{formatPrice(item.unit_price * item.quantity)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Statement Tab */}
            {activeTab === 'statement' && (
              <div>
                {statement.length === 0 ? (
                  <div className="p-12 text-center">
                    <svg className="w-20 h-20 mx-auto mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-400 text-lg">لا توجد حركات</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-800 text-white sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-right text-sm font-medium">#</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">التاريخ</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">الوقت</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">نوع العملية</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">البيان</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">قيمة الفاتورة</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">المبلغ المدفوع</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">الرصيد</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">الخزنة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {statement.map((entry, index) => (
                          <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{formatDate(entry.date)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{formatTime(entry.time)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${entry.type === 'سلفة' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {entry.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-800">{entry.description}</td>
                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--primary-color)' }}>{entry.invoiceValue > 0 ? formatPrice(entry.invoiceValue) : '-'}</td>
                            <td className="px-4 py-3 text-sm text-green-600">{entry.paidAmount > 0 ? formatPrice(entry.paidAmount) : '-'}</td>
                            <td className={`px-4 py-3 text-sm font-bold ${entry.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatPrice(entry.balance)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{entry.record || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
              <div>
                {payments.length === 0 ? (
                  <div className="p-12 text-center">
                    <svg className="w-20 h-20 mx-auto mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-gray-400 text-lg">لا توجد دفعات</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-800 text-white sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-right text-sm font-medium">#</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">التاريخ</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">الوقت</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">المبلغ</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">طريقة الدفع</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">البيان</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">الخزنة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {payments.map((payment, index) => (
                          <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{formatDate(payment.payment_date || payment.created_at)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {payment.created_at ? formatTime(payment.created_at.split('T')[1]?.substring(0, 5)) : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-green-600">{formatPrice(payment.amount)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{payment.payment_method || 'نقدي'}</td>
                            <td className="px-4 py-3 text-sm text-gray-800">{payment.notes || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{payment.records?.name || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Pagination */}
            {pagination && pagination.hasMore && (
              <div className="p-4 text-center border-t border-gray-100">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-8 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50"
                >
                  {loading ? 'جاري التحميل...' : 'تحميل المزيد'}
                </button>
              </div>
            )}

            {/* Info Footer */}
            {pagination && (
              <div className="p-4 text-center text-xs text-gray-400 border-t border-gray-100">
                عرض {Math.min(pagination.page * pagination.limit, pagination.total)} من {pagination.total} سجل
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date Filter Modal */}
      <SimpleDateFilterModal
        isOpen={showDateFilter}
        onClose={() => setShowDateFilter(false)}
        onDateFilterChange={(filter) => {
          setDateFilter(filter);
        }}
        currentFilter={dateFilter}
      />
    </div>
  );
}
