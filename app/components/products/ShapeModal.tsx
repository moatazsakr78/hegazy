'use client'

import { useState, useEffect, useRef } from 'react'
import { Shape } from '../../lib/hooks/useShapes'

interface ShapeModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string, imageUrl?: string | null) => Promise<void>
  shape?: Shape | null
}

export function ShapeModal({ isOpen, onClose, onSave, shape }: ShapeModalProps) {
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName(shape?.name || '')
      setImageUrl(shape?.image_url || null)
      setError('')
    }
  }, [isOpen, shape])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (max 1MB)
    if (file.size > 1024 * 1024) {
      setError('حجم الصورة يجب أن يكون أقل من 1 ميجابايت')
      return
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار ملف صورة')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setImageUrl(reader.result as string)
      setError('')
    }
    reader.onerror = () => {
      setError('فشل في قراءة الصورة')
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setImageUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('يرجى إدخال اسم الشكل')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onSave(name.trim(), imageUrl)
    } catch (err) {
      setError('فشل في حفظ الشكل')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#2B3544] rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">
            {shape ? 'تعديل الشكل' : 'إضافة شكل جديد'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white p-1 transition-colors"
            disabled={loading}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              اسم الشكل
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="أدخل اسم الشكل"
              className="w-full px-3 py-2 bg-[#374151] border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              صورة الشكل
            </label>

            {imageUrl ? (
              <div className="space-y-2">
                <div className="relative w-full h-40 bg-[#374151] rounded-lg overflow-hidden border border-gray-600">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  إزالة الصورة
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={loading}
                  className="hidden"
                  id="shape-image-input"
                />
                <label
                  htmlFor="shape-image-input"
                  className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer bg-[#374151] hover:bg-[#4B5563] transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-400 text-center">
                    <span className="font-medium text-blue-400">اضغط لاختيار صورة</span>
                    <br />
                    <span className="text-xs">الحد الأقصى: 1 ميجابايت</span>
                  </p>
                </label>
              </div>
            )}
          </div>

          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50 transition-colors font-medium"
            >
              {loading ? 'جاري الحفظ...' : (shape ? 'تحديث' : 'إضافة')}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg disabled:opacity-50 transition-colors font-medium"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
