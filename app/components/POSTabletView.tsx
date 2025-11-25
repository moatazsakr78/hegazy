'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { ProductGridImage } from './ui/OptimizedImage'
import Sidebar from './layout/Sidebar'
import TopHeader from './layout/TopHeader'
import PaymentSplit from './PaymentSplit'
import ResizableTable from './tables/ResizableTable'
import {
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ListBulletIcon,
  PlusIcon,
  ShoppingCartIcon,
  ShoppingBagIcon,
  XMarkIcon,
  HomeIcon,
  BuildingOfficeIcon,
  ArrowsRightLeftIcon,
  UserIcon,
  DocumentTextIcon,
  ArrowUturnLeftIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { useFormatPrice } from '@/lib/hooks/useCurrency'

interface POSTabletViewProps {
  // Products
  products: any[]
  filteredProducts: any[]
  isLoading: boolean
  error: string | null

  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void

  // View Mode
  viewMode: 'table' | 'grid'
  setViewMode: (mode: 'table' | 'grid') => void

  // Cart
  cartItems: any[]
  setCartItems: React.Dispatch<React.SetStateAction<any[]>>
  isCartOpen: boolean
  setIsCartOpen: (open: boolean) => void
  cartTotal: number
  removeFromCart: (itemId: string) => void
  clearCart: () => void
  updateActiveTabCart: (cart: any[]) => void

  // Selections
  selections: any
  isPurchaseMode: boolean
  isTransferMode: boolean
  isReturnMode: boolean
  selectedSupplier: any
  selectedWarehouse: any

  // Modals
  setIsRecordsModalOpen: (open: boolean) => void
  setIsCustomerModalOpen: (open: boolean) => void
  setIsBranchModalOpen: (open: boolean) => void
  setIsHistoryModalOpen: (open: boolean) => void
  setIsSupplierModalOpen: (open: boolean) => void
  setIsWarehouseModalOpen: (open: boolean) => void
  setShowQuickAddProductModal: (open: boolean) => void
  setShowColumnsModal: (open: boolean) => void

  // Product Actions
  handleProductClick: (product: any) => void
  selectedProduct: any

  // Invoice
  handleCreateInvoice: () => void
  hasAllRequiredSelections: () => boolean
  isProcessingInvoice: boolean

  // Payment Split
  setPaymentSplitData: React.Dispatch<React.SetStateAction<any[]>>
  setCreditAmount: React.Dispatch<React.SetStateAction<number>>

  // Sidebar
  isSidebarOpen: boolean
  setIsSidebarOpen: (open: boolean) => void

  // POS Tabs
  posTabs: any[]
  activeTab: any
  switchTab: (tabId: string) => void
  closeTab: (tabId: string) => void
  setShowAddTabModal: (show: boolean) => void

  // Mode Toggles
  setShowPurchaseModeConfirm: (show: boolean) => void
  setIsTransferMode: (mode: boolean) => void
  setTransferFromLocation: (location: any) => void
  setTransferToLocation: (location: any) => void
  setIsTransferLocationModalOpen: (open: boolean) => void
  setIsReturnMode: (mode: boolean) => void
  clearSelections: () => void
}

export default function POSTabletView({
  products,
  filteredProducts,
  isLoading,
  error,
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  cartItems,
  setCartItems,
  isCartOpen,
  setIsCartOpen,
  cartTotal,
  removeFromCart,
  clearCart,
  updateActiveTabCart,
  selections,
  isPurchaseMode,
  isTransferMode,
  isReturnMode,
  selectedSupplier,
  selectedWarehouse,
  setIsRecordsModalOpen,
  setIsCustomerModalOpen,
  setIsBranchModalOpen,
  setIsHistoryModalOpen,
  setIsSupplierModalOpen,
  setIsWarehouseModalOpen,
  setShowQuickAddProductModal,
  setShowColumnsModal,
  handleProductClick,
  selectedProduct,
  handleCreateInvoice,
  hasAllRequiredSelections,
  isProcessingInvoice,
  setPaymentSplitData,
  setCreditAmount,
  isSidebarOpen,
  setIsSidebarOpen,
  posTabs,
  activeTab,
  switchTab,
  closeTab,
  setShowAddTabModal,
  setShowPurchaseModeConfirm,
  setIsTransferMode,
  setTransferFromLocation,
  setTransferToLocation,
  setIsTransferLocationModalOpen,
  setIsReturnMode,
  clearSelections,
}: POSTabletViewProps) {
  const formatPrice = useFormatPrice()
  const toolbarRef = useRef<HTMLDivElement>(null)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  // Determine grid columns based on cart state
  // Cart open: 2 products per row, Cart closed: 4 products per row
  const gridCols = isCartOpen ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'

  // Table columns for products
  const tableColumns = useMemo(() => [
    {
      id: 'index',
      header: '#',
      accessor: '#',
      width: 60,
      render: (value: any, item: any, index: number) => (
        <span className="text-gray-400 font-medium">{index + 1}</span>
      ),
    },
    {
      id: 'name',
      header: 'اسم المنتج',
      accessor: 'name',
      width: 200,
      render: (value: string) => <span className="text-white font-medium">{value}</span>,
    },
    {
      id: 'category',
      header: 'المجموعة',
      accessor: 'category',
      width: 120,
      render: (value: any) => (
        <span className="text-gray-300">
          {value?.name || 'غير محدد'}
        </span>
      ),
    },
    {
      id: 'price',
      header: 'سعر البيع',
      accessor: 'price',
      width: 120,
      render: (value: number) => (
        <span className="text-white">{formatPrice(value || 0, 'system')}</span>
      ),
    },
    {
      id: 'barcode',
      header: 'الباركود',
      accessor: 'barcode',
      width: 150,
      render: (value: string) => (
        <span className="text-gray-300 font-mono text-sm">{value || '-'}</span>
      ),
    },
    {
      id: 'is_active',
      header: 'نشيط',
      accessor: 'is_active',
      width: 80,
      render: (value: boolean) => (
        <div className="flex justify-center">
          <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-500' : 'bg-red-500'}`}></div>
        </div>
      ),
    },
  ], [formatPrice])

  return (
    <div className="h-screen bg-[#2B3544] overflow-hidden flex flex-col">
      {/* Top Header */}
      <TopHeader onMenuClick={toggleSidebar} isMenuOpen={isSidebarOpen} />

      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

      {/* Main Content Container */}
      <div className="flex-1 pt-12 overflow-hidden flex flex-col">

        {/* POS Tabs Bar - Compact Design */}
        <div className="bg-[#2B3544] border-b border-gray-600 flex items-center justify-between flex-shrink-0">
          {/* Right Side: Selection Display */}
          <div className="flex items-center gap-2 text-xs px-2 py-0.5 overflow-x-auto scrollbar-hide">
            {/* Customer/Supplier */}
            <span className="text-gray-300 whitespace-nowrap">
              {isPurchaseMode ? 'المورد' : 'العميل'}:{' '}
              <span className="text-white font-medium">
                {isPurchaseMode
                  ? selectedSupplier
                    ? selectedSupplier.name
                    : 'غير محدد'
                  : selections.customer
                    ? selections.customer.name
                    : 'غير محدد'}
              </span>
            </span>

            {/* Branch/Warehouse */}
            <span className="text-gray-300 whitespace-nowrap">
              {isPurchaseMode
                ? selectedWarehouse
                  ? selectedWarehouse.locationType === 'branch'
                    ? 'الفرع'
                    : 'المخزن'
                  : 'فرع / مخزن'
                : 'الفرع'}
              :{' '}
              <span className="text-white font-medium">
                {isPurchaseMode
                  ? selectedWarehouse
                    ? selectedWarehouse.name
                    : 'غير محدد'
                  : selections.branch
                    ? selections.branch.name
                    : 'غير محدد'}
              </span>
            </span>

            {/* Record */}
            <span className="text-gray-300 whitespace-nowrap">
              السجل:{' '}
              <span className="text-white font-medium">
                {selections.record ? selections.record.name : 'غير محدد'}
              </span>
            </span>

            {/* Clear all button */}
            {(selections.customer ||
              selections.branch ||
              selections.record ||
              selectedSupplier ||
              selectedWarehouse) && (
              <button
                onClick={() => {
                  clearSelections()
                }}
                className="text-xs text-gray-400 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded whitespace-nowrap"
              >
                مسح الكل
              </button>
            )}
          </div>

          {/* Vertical Divider */}
          <div className="h-5 w-px bg-gray-600"></div>

          {/* Left Side: POS Tabs */}
          <div className="flex items-center overflow-x-auto scrollbar-hide flex-1">
            {posTabs.map((tab) => (
              <div
                key={tab.id}
                className={`flex items-center border-l border-gray-600 ${
                  tab.active
                    ? 'bg-[#F97316] text-white'
                    : 'text-gray-300 hover:text-white hover:bg-[#4B5563]'
                }`}
              >
                <button
                  onClick={() => switchTab(tab.id)}
                  className="px-2 py-0.5 text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap"
                >
                  <span>{tab.title}</span>
                </button>

                {tab.id !== 'main' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.id)
                    }}
                    className="ml-0.5 p-0.5 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title="إغلاق"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {/* Add New Tab Button */}
            <button
              onClick={() => setShowAddTabModal(true)}
              className="px-1.5 py-0.5 text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors flex items-center gap-0.5 border-l border-gray-600"
              title="إضافة نافذة بيع جديدة"
            >
              <PlusIcon className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Action Buttons Bar - Horizontal Design */}
        <div className="bg-[#374151] border-b border-gray-600 px-4 py-2 w-full flex-shrink-0 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 min-w-max">
            {/* First 3 Selection Buttons with Red Dot Indicator */}
            <button
              onClick={() => setIsRecordsModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md transition-all relative"
            >
              <DocumentTextIcon className="h-4 w-4" />
              <span>السجل</span>
              {!selections.record && (
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full absolute top-1 right-1"></div>
              )}
            </button>

            <button
              onClick={() => isPurchaseMode ? setIsSupplierModalOpen(true) : setIsCustomerModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md transition-all relative"
            >
              <UserIcon className="h-4 w-4" />
              <span>{isPurchaseMode ? 'المورد' : 'العميل'}</span>
              {isPurchaseMode ? (
                !selectedSupplier && <div className="w-1.5 h-1.5 bg-red-400 rounded-full absolute top-1 right-1"></div>
              ) : (
                !selections.customer && <div className="w-1.5 h-1.5 bg-red-400 rounded-full absolute top-1 right-1"></div>
              )}
            </button>

            <button
              onClick={() => isPurchaseMode ? setIsWarehouseModalOpen(true) : setIsBranchModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md transition-all relative"
            >
              <BuildingOfficeIcon className="h-4 w-4" />
              <span>{isPurchaseMode ? 'المخزن' : 'الفرع'}</span>
              {isPurchaseMode ? (
                !selectedWarehouse && <div className="w-1.5 h-1.5 bg-red-400 rounded-full absolute top-1 right-1"></div>
              ) : (
                !selections.branch && <div className="w-1.5 h-1.5 bg-red-400 rounded-full absolute top-1 right-1"></div>
              )}
            </button>

            {/* Vertical Divider */}
            <div className="h-6 w-px bg-gray-600"></div>

            {/* Other Action Buttons */}
            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md transition-all"
            >
              <ClockIcon className="h-4 w-4" />
              <span>التاريخ</span>
            </button>

            <button
              onClick={() => setShowQuickAddProductModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md transition-all"
            >
              <PlusIcon className="h-4 w-4" />
              <span>إضافة منتج</span>
            </button>

            {/* Vertical Divider */}
            <div className="h-6 w-px bg-gray-600"></div>

            {/* Mode Buttons */}
            <button
              onClick={() => {
                setIsTransferMode(false)
                setIsReturnMode(false)
                setShowPurchaseModeConfirm(false)
                setTransferFromLocation(null)
                setTransferToLocation(null)
              }}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-all ${
                !isPurchaseMode && !isTransferMode && !isReturnMode
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600/30'
              }`}
            >
              <HomeIcon className="h-4 w-4" />
              <span>بيع</span>
            </button>

            <button
              onClick={() => setShowPurchaseModeConfirm(true)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-all ${
                isPurchaseMode && !isTransferMode && !isReturnMode
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600/30'
              }`}
            >
              <BuildingOfficeIcon className="h-4 w-4" />
              <span>شراء</span>
            </button>

            <button
              onClick={() => {
                setIsTransferMode(true)
                setIsReturnMode(false)
                setShowPurchaseModeConfirm(false)
                setIsTransferLocationModalOpen(true)
              }}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-all ${
                isTransferMode && !isReturnMode
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600/30'
              }`}
            >
              <ArrowsRightLeftIcon className="h-4 w-4" />
              <span>نقل</span>
            </button>

            <button
              onClick={() => setIsReturnMode(!isReturnMode)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-all ${
                isReturnMode
                  ? 'bg-red-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600/30'
              }`}
            >
              <ArrowUturnLeftIcon className="h-4 w-4" />
              <span>مرتجع</span>
            </button>
          </div>
        </div>

        {/* Search and Controls Section */}
        <div className="bg-[#374151] border-b border-gray-600 px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Search Bar */}
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="اسم المنتج..."
                className="w-full pl-4 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#5DADE2] focus:border-transparent text-sm"
              />
            </div>

            {/* Product Count */}
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {filteredProducts.length} منتج
            </span>

            {/* View Mode Toggle */}
            <div className="flex bg-[#2B3544] rounded-md overflow-hidden flex-shrink-0 border border-gray-600">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                }`}
                title="عرض الصور"
              >
                <Squares2X2Icon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 transition-colors ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                }`}
                title="عرض الجداول"
              >
                <ListBulletIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Cart Toggle Button */}
            <button
              onClick={() => setIsCartOpen(!isCartOpen)}
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md transition-colors bg-[#2B3544] border border-gray-600 flex-shrink-0"
              title={isCartOpen ? 'إخفاء السلة' : 'إظهار السلة'}
            >
              <ShoppingBagIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main Content Area - Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Products Area */}
          <div className={`${isCartOpen ? 'w-1/2' : 'w-full'} transition-all duration-300 overflow-hidden flex flex-col`}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-white">جاري التحميل...</div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-red-400">خطأ: {error}</div>
              </div>
            ) : (
              <>
                {viewMode === 'table' ? (
                  /* Table View */
                  <div className="flex-1 min-h-0">
                    <ResizableTable
                      className="h-full w-full"
                      columns={tableColumns}
                      data={filteredProducts}
                      selectedRowId={selectedProduct?.id || null}
                      onRowClick={(product, index) => {
                        if (selectedProduct?.id === product.id) {
                          handleProductClick(null)
                        } else {
                          handleProductClick(product)
                        }
                      }}
                    />
                  </div>
                ) : (
                  /* Grid View */
                  <div className="h-full overflow-y-auto scrollbar-hide p-4">
                    <div className={`grid ${gridCols} gap-4`}>
                      {filteredProducts.map((product) => (
                        <div
                          key={product.id}
                          onClick={() => handleProductClick(product)}
                          className={`bg-[#374151] rounded-lg p-3 cursor-pointer transition-all duration-200 border-2 ${
                            selectedProduct?.id === product.id
                              ? 'border-blue-500 bg-[#434E61]'
                              : 'border-transparent hover:border-gray-500 hover:bg-[#434E61]'
                          }`}
                        >
                          {/* Product Image */}
                          <div className="w-full h-32 bg-[#2B3544] rounded-md mb-3 flex items-center justify-center overflow-hidden">
                            {product.main_image_url ? (
                              <img
                                src={product.main_image_url}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  target.nextElementSibling?.classList.remove('hidden')
                                }}
                              />
                            ) : null}
                            <div className={`w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center ${product.main_image_url ? 'hidden' : ''}`}>
                              <span className="text-2xl">📦</span>
                            </div>
                          </div>

                          {/* Product Name */}
                          <h3 className="text-white font-medium text-xs text-center mb-2 line-clamp-2">
                            {product.name}
                          </h3>

                          {/* Product Price */}
                          <div className="text-center">
                            <span className="text-blue-400 font-medium text-sm">
                              {formatPrice(product.price || 0, 'system')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Cart Panel - Tablet Split View */}
          {isCartOpen && (
            <div className="w-1/2 bg-[#374151] border-l-2 border-gray-500 flex flex-col">
              {/* Cart Items Area */}
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
                          <span className="text-white font-medium text-sm">السلة</span>
                          <span className="bg-blue-600 px-2 py-1 rounded text-xs text-white">
                            {cartItems.length}
                          </span>
                        </div>
                        {cartItems.length > 0 && (
                          <button
                            onClick={() => clearCart()}
                            className="text-red-400 hover:text-red-300 text-xs"
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
                              {item.product.main_image_url ? (
                                <img
                                  src={item.product.main_image_url}
                                  alt={item.product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl">
                                  📦
                                </div>
                              )}
                            </div>

                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1">
                                <h4 className="font-medium text-white text-xs truncate">
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
                                      const newQuantity = parseInt(e.target.value) || 1
                                      setCartItems((prev) => {
                                        const newCart = prev.map((cartItem) => {
                                          if (cartItem.id === item.id) {
                                            return {
                                              ...cartItem,
                                              quantity: newQuantity,
                                              totalPrice: cartItem.isCustomPrice
                                                ? cartItem.totalPrice
                                                : cartItem.price * newQuantity,
                                            }
                                          }
                                          return cartItem
                                        })
                                        updateActiveTabCart(newCart)
                                        return newCart
                                      })
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
                                      const newPrice = parseFloat(e.target.value) || 0
                                      setCartItems((prev) => {
                                        const newCart = prev.map((cartItem) =>
                                          cartItem.id === item.id
                                            ? {
                                                ...cartItem,
                                                isCustomPrice: true,
                                                totalPrice: cartItem.quantity * newPrice,
                                              }
                                            : cartItem,
                                        )
                                        updateActiveTabCart(newCart)
                                        return newCart
                                      })
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
                              {formatPrice(item.totalPrice || (item.price * item.quantity) || 0, 'system')}
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
                {/* Payment Split Component */}
                {!isTransferMode && !isPurchaseMode && !isReturnMode && (
                  <PaymentSplit
                    totalAmount={cartTotal}
                    onPaymentsChange={(payments, credit) => {
                      setPaymentSplitData(payments)
                      setCreditAmount(credit)
                    }}
                  />
                )}

                {/* Total and Button */}
                <div className="flex items-center justify-between gap-3 mt-3">
                  {/* Total */}
                  <div className="flex-shrink-0">
                    {!isTransferMode ? (
                      <div className="text-right">
                        <div className="text-white text-xs font-medium">الإجمالي:</div>
                        <div className="text-green-400 font-bold text-lg">
                          {formatPrice(cartTotal, 'system')}
                        </div>
                      </div>
                    ) : (
                      <div className="text-right">
                        <div className="text-orange-400 text-xs font-medium">وضع النقل</div>
                        <div className="text-white font-bold text-lg">
                          {cartItems.reduce((sum, item) => sum + item.quantity, 0)} قطعة
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Button */}
                  <button
                    disabled={
                      cartItems.length === 0 ||
                      !hasAllRequiredSelections() ||
                      isProcessingInvoice
                    }
                    className={`flex-1 py-2 px-4 rounded-lg font-medium text-xs transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed text-white ${
                      isTransferMode
                        ? 'bg-orange-600 hover:bg-orange-700'
                        : isReturnMode
                          ? 'bg-red-600 hover:bg-red-700'
                          : isPurchaseMode
                            ? 'bg-purple-600 hover:bg-purple-700'
                            : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    onClick={handleCreateInvoice}
                  >
                    {isProcessingInvoice
                      ? 'جاري المعالجة...'
                      : cartItems.length === 0
                        ? 'السلة فارغة'
                        : !hasAllRequiredSelections()
                          ? 'يجب إكمال التحديدات'
                          : isTransferMode
                            ? `تأكيد النقل (${cartItems.length})`
                            : isReturnMode
                              ? isPurchaseMode
                                ? `مرتجع شراء (${cartItems.length})`
                                : `مرتجع بيع (${cartItems.length})`
                              : isPurchaseMode
                                ? `تأكيد الشراء (${cartItems.length})`
                                : `تأكيد الطلب (${cartItems.length})`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tablet-optimized styles */}
      <style jsx global>{`
        /* Hide scrollbars but keep functionality */
        .scrollbar-hide {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        /* Touch-friendly interactions */
        @media (max-width: 1024px) {
          button, .cursor-pointer {
            min-height: 44px;
          }
        }

        /* Line clamp utility */
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}
