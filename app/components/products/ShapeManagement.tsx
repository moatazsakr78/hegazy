'use client'

import { useState } from 'react'
import { useShapes, Shape } from '../../lib/hooks/useShapes'
import { ShapeModal } from './ShapeModal'

interface ShapeManagementProps {
  productShapes?: any[]
  setProductShapes?: (shapes: any[]) => void
  isEditMode?: boolean
}

export function ShapeManagement({ productShapes = [], setProductShapes, isEditMode = false }: ShapeManagementProps) {
  const { shapes: allShapes, loading, addShape, updateShape, deleteShape } = useShapes()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingShape, setEditingShape] = useState<Shape | null>(null)

  // Use productShapes for editing mode, empty array for new product mode
  const displayShapes = isEditMode ? productShapes : []

  const handleEdit = (shape: Shape) => {
    setEditingShape(shape)
    setIsModalOpen(true)
  }

  const handleDelete = async (shape: Shape) => {
    try {
      await deleteShape(shape.id)
    } catch (error) {
      alert('فشل في حذف الشكل')
    }
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingShape(null)
  }

  const handleModalSave = async (name: string, imageUrl?: string | null) => {
    try {
      if (editingShape) {
        await updateShape(editingShape.id, name, imageUrl)
      } else {
        await addShape(name, imageUrl)
      }
      handleModalClose()
    } catch (error) {
      // Error is handled in the hook
      throw error
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-gray-400">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          إضافة شكل الوصف
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {displayShapes.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {isEditMode ? 'لا توجد أشكال مرتبطة بهذا المنتج' : 'لا توجد أشكال مضافة بعد'}
          </div>
        ) : (
          displayShapes.map((shape) => (
            <div
              key={shape.id}
              className="bg-[#374151] rounded-lg p-3 flex items-center justify-between hover:bg-[#4B5563] transition-colors"
            >
              <div className="flex items-center gap-3">
                {shape.image_url && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#2B3544] flex-shrink-0">
                    <img
                      src={shape.image_url}
                      alt={shape.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <span className="text-white font-medium">{shape.name}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(shape)}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(shape)}
                  className="bg-red-600 hover:bg-red-700 text-white p-2 rounded transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <ShapeModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleModalSave}
        shape={editingShape}
      />
    </div>
  )
}