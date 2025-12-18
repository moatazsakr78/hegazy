'use client'

import { useState, useRef } from 'react'
import {
  XMarkIcon,
  PlusIcon,
  ShoppingCartIcon,
  ArrowLeftIcon,
  PhotoIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

interface QuickAddProductModalProps {
  isOpen: boolean
  onClose: () => void
  onAddToCart: (productData: any) => void
}

export default function QuickAddProductModal({ isOpen, onClose, onAddToCart }: QuickAddProductModalProps) {
  const [productName, setProductName] = useState('')
  const [productQuantity, setProductQuantity] = useState('1')
  const [productCostPrice, setProductCostPrice] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [wholesalePrice, setWholesalePrice] = useState('')
  const [price1, setPrice1] = useState('')
  const [price2, setPrice2] = useState('')
  const [price3, setPrice3] = useState('')
  const [price4, setPrice4] = useState('')
  const [productBarcode, setProductBarcode] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [productImage, setProductImage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetForm = () => {
    setProductName('')
    setProductQuantity('1')
    setProductCostPrice('')
    setProductPrice('')
    setWholesalePrice('')
    setPrice1('')
    setPrice2('')
    setPrice3('')
    setPrice4('')
    setProductBarcode('')
    setProductDescription('')
    setProductImage(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  // Generate random barcode
  const generateBarcode = () => {
    const timestamp = Date.now().toString().slice(-8)
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    setProductBarcode(`${timestamp}${random}`)
  }

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('حجم الصورة يجب أن يكون أقل من 5 ميجابايت')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setProductImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAddToCart = async () => {
    // Validate required fields
    if (!productName.trim()) {
      alert('يجب إدخال اسم المنتج')
      return
    }

    const quantity = parseInt(productQuantity) || 1
    if (quantity <= 0) {
      alert('يجب إدخال كمية صحيحة')
      return
    }

    if (!productCostPrice || parseFloat(productCostPrice) < 0) {
      alert('يجب إدخال سعر الشراء')
      return
    }

    setIsProcessing(true)

    try {
      // Create temporary product data for cart
      const tempProductData = {
        id: `temp-${Date.now()}`,
        name: productName.trim(),
        price: productPrice ? parseFloat(productPrice) : 0,
        cost_price: parseFloat(productCostPrice) || 0,
        wholesale_price: wholesalePrice ? parseFloat(wholesalePrice) : 0,
        price_1: price1 ? parseFloat(price1) : 0,
        price_2: price2 ? parseFloat(price2) : 0,
        price_3: price3 ? parseFloat(price3) : 0,
        price_4: price4 ? parseFloat(price4) : 0,
        barcode: productBarcode.trim() || null,
        description: productDescription.trim() || null,
        main_image_url: productImage,
        quantity: quantity,
        isNewProduct: true
      }

      onAddToCart(tempProductData)
      handleClose()
    } catch (error: any) {
      alert(`خطأ في إضافة المنتج: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Side Panel */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-[#1F2937] z-50 shadow-2xl transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#374151] bg-[#1F2937]">
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#374151] rounded-lg transition-colors"
            disabled={isProcessing}
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold text-white">إضافة منتج سريع</h2>
          <div className="w-9" /> {/* Spacer for alignment */}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 h-[calc(100vh-140px)] scrollbar-hide">

          {/* Product Name */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              اسم المنتج <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full bg-[#374151] border border-[#4A5568] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="أدخل اسم المنتج"
              disabled={isProcessing}
              autoFocus
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              الكمية <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={productQuantity}
              onChange={(e) => setProductQuantity(e.target.value)}
              className="w-full bg-[#374151] border border-[#4A5568] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="1"
              disabled={isProcessing}
            />
          </div>

          {/* Purchase Price (Cost Price) */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              سعر الشراء <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={productCostPrice}
              onChange={(e) => setProductCostPrice(e.target.value)}
              className="w-full bg-[#374151] border border-[#4A5568] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="0.00"
              disabled={isProcessing}
            />
          </div>

          {/* Selling Prices - Row 1: سعر البيع + سعر الجملة */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                سعر البيع
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                className="w-full bg-[#374151] border border-[#4A5568] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="0.00"
                disabled={isProcessing}
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                سعر الجملة
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(e.target.value)}
                className="w-full bg-[#374151] border border-[#4A5568] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="0.00"
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Prices - Row 2: سعر 1 + سعر 2 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                سعر 1
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price1}
                onChange={(e) => setPrice1(e.target.value)}
                className="w-full bg-[#374151] border border-[#4A5568] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="0.00"
                disabled={isProcessing}
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                سعر 2
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price2}
                onChange={(e) => setPrice2(e.target.value)}
                className="w-full bg-[#374151] border border-[#4A5568] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="0.00"
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Prices - Row 3: سعر 3 + سعر 4 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                سعر 3
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price3}
                onChange={(e) => setPrice3(e.target.value)}
                className="w-full bg-[#374151] border border-[#4A5568] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="0.00"
                disabled={isProcessing}
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                سعر 4
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price4}
                onChange={(e) => setPrice4(e.target.value)}
                className="w-full bg-[#374151] border border-[#4A5568] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="0.00"
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Barcode with Generate Button */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              الباركود
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={productBarcode}
                onChange={(e) => setProductBarcode(e.target.value)}
                className="flex-1 bg-[#374151] border border-[#4A5568] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="أدخل باركود جديد"
                disabled={isProcessing}
              />
              <button
                type="button"
                onClick={generateBarcode}
                disabled={isProcessing}
                className="px-4 py-3 bg-[#374151] hover:bg-[#4A5568] border border-[#4A5568] text-gray-300 rounded-lg transition-colors flex items-center gap-2"
                title="توليد باركود"
              >
                <ArrowPathIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Main Image Upload */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              الصورة الرئيسية
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
              disabled={isProcessing}
            />

            {productImage ? (
              <div className="relative">
                <img
                  src={productImage}
                  alt="صورة المنتج"
                  className="w-full h-40 object-cover rounded-lg border border-[#4A5568]"
                />
                <button
                  type="button"
                  onClick={() => setProductImage(null)}
                  className="absolute top-2 left-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute top-2 right-2 p-1.5 bg-[#374151] hover:bg-[#4A5568] text-white rounded-full transition-colors"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full h-32 border-2 border-dashed border-[#4A5568] rounded-lg flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-green-500 hover:text-green-400 transition-colors"
              >
                <PhotoIcon className="h-8 w-8" />
                <span className="text-sm">اضغط لاختيار صورة</span>
              </button>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              الوصف
            </label>
            <textarea
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              rows={3}
              className="w-full bg-[#374151] border border-[#4A5568] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none transition-all"
              placeholder="أدخل وصف المنتج"
              disabled={isProcessing}
            />
          </div>

        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#374151] bg-[#1F2937]">
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="flex-1 bg-[#374151] hover:bg-[#4A5568] disabled:opacity-50 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <XMarkIcon className="h-5 w-5" />
              إلغاء
            </button>
            <button
              onClick={handleAddToCart}
              disabled={isProcessing || !productName.trim() || !productCostPrice}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  جاري الإضافة...
                </>
              ) : (
                <>
                  <ShoppingCartIcon className="h-5 w-5" />
                  إضافة للسلة
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  )
}
