'use client'

import { useState, useEffect } from 'react'

export interface Shape {
  id: string
  name: string
  image_url?: string | null
  created_at: string
  updated_at: string
}

const STORAGE_KEY = 'pos_shapes'

export function useShapes() {
  const [shapes, setShapes] = useState<Shape[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchShapes()
  }, [])

  const fetchShapes = async () => {
    try {
      setLoading(true)
      
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const storedShapes = localStorage.getItem(STORAGE_KEY)
      const shapesData = storedShapes ? JSON.parse(storedShapes) : []
      
      setShapes(shapesData.sort((a: Shape, b: Shape) => a.name.localeCompare(b.name)))
    } catch (err) {
      console.error('Error:', err)
      setError('حدث خطأ غير متوقع')
    } finally {
      setLoading(false)
    }
  }

  const saveToStorage = (updatedShapes: Shape[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedShapes))
  }

  const addShape = async (name: string, imageUrl?: string | null) => {
    try {
      const newShape: Shape = {
        id: Date.now().toString(),
        name,
        image_url: imageUrl || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const updatedShapes = [...shapes, newShape].sort((a, b) => a.name.localeCompare(b.name))
      setShapes(updatedShapes)
      saveToStorage(updatedShapes)

      return newShape
    } catch (err) {
      console.error('Error:', err)
      throw new Error('فشل في إضافة الشكل')
    }
  }

  const updateShape = async (id: string, name: string, imageUrl?: string | null) => {
    try {
      const updatedShapes = shapes.map(shape =>
        shape.id === id
          ? { ...shape, name, image_url: imageUrl !== undefined ? imageUrl : shape.image_url, updated_at: new Date().toISOString() }
          : shape
      ).sort((a, b) => a.name.localeCompare(b.name))

      setShapes(updatedShapes)
      saveToStorage(updatedShapes)

      return updatedShapes.find(shape => shape.id === id)!
    } catch (err) {
      console.error('Error:', err)
      throw new Error('فشل في تحديث الشكل')
    }
  }

  const deleteShape = async (id: string) => {
    try {
      const updatedShapes = shapes.filter(shape => shape.id !== id)
      setShapes(updatedShapes)
      saveToStorage(updatedShapes)
    } catch (err) {
      console.error('Error:', err)
      throw new Error('فشل في حذف الشكل')
    }
  }

  return {
    shapes,
    loading,
    error,
    addShape,
    updateShape,
    deleteShape,
    refetch: fetchShapes
  }
}