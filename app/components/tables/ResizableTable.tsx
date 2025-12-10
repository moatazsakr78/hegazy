'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { updateColumnWidth, updateColumnOrder, updateColumnVisibility, loadTableConfig } from '@/app/lib/utils/hybridTableStorage'

// Removed unused constant

interface Column {
  id: string
  header: string
  accessor: string
  minWidth?: number
  width?: number
  render?: (value: any, item: any, rowIndex: number) => React.ReactNode
}

interface ResizableTableProps {
  columns: Column[]
  data: any[]
  className?: string
  onRowClick?: (item: any, index: number) => void
  onRowDoubleClick?: (item: any, index: number) => void
  selectedRowId?: string | null
  reportType?: 'MAIN_REPORT' | 'PRODUCTS_REPORT' | 'CATEGORIES_REPORT' | 'CUSTOMERS_REPORT' | 'CUSTOMER_INVOICES_REPORT' | 'DAILY_SALES_REPORT' | 'HOURLY_SALES_REPORT' | 'PROFIT_MARGIN_REPORT' // for localStorage key
  onColumnsChange?: (columns: Column[]) => void // callback for parent component
  showToast?: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void
}

interface SortableHeaderProps {
  column: Column
  width: number
  onResize: (columnId: string, newWidth: number) => void
  onResizeStateChange: (isResizing: boolean) => void
  onResizeComplete?: (columnId: string, newWidth: number) => void
}

function SortableHeader({ column, width, onResize, onResizeStateChange, onResizeComplete }: SortableHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: column.id,
    data: { type: 'column' }
  })

  const [isResizing, setIsResizing] = useState(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: `${width}px`,
    minWidth: `${width}px`,
    maxWidth: `${width}px`,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Set resizing state immediately
    setIsResizing(true)
    onResizeStateChange(true)

    // Store initial values
    resizeStartX.current = e.clientX
    resizeStartWidth.current = width

    // Prevent text selection during resize
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }, [width, onResizeStateChange])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartX.current
      const newWidth = Math.max(20, resizeStartWidth.current - deltaX) // Minimum 20px width
      onResize(column.id, newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      onResizeStateChange(false)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''

      // Save the final width on mouse up (when user releases the mouse)
      if (onResizeComplete) {
        onResizeComplete(column.id, width) // Use current width state
      }
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, column.id, width, onResize, onResizeStateChange, onResizeComplete])

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="relative px-4 py-3 text-right font-medium bg-[#374151] border-b border-r border-gray-600 select-none"
      {...attributes}
    >
      {/* Resize areas - completely separate from draggable content */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-20 hover:bg-blue-400/50"
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleResizeStart(e)
        }}
        style={{ pointerEvents: 'auto' }}
      />
      <div
        className="absolute -left-2 top-0 bottom-0 w-4 cursor-col-resize z-10"
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleResizeStart(e)
        }}
        style={{ pointerEvents: 'auto' }}
      />

      {/* Draggable header content */}
      <div
        className="flex items-center justify-between relative z-0"
        {...(isResizing ? {} : listeners)}
      >
        <span className="text-gray-200 truncate">{column.header}</span>
      </div>
    </th>
  )
}

export default function ResizableTable({
  columns: initialColumns,
  data,
  className = '',
  onRowClick,
  onRowDoubleClick,
  selectedRowId,
  reportType,
  onColumnsChange,
  showToast
}: ResizableTableProps) {
  const [columns, setColumns] = useState<Column[]>([])
  const [isAnyColumnResizing, setIsAnyColumnResizing] = useState(false)
  const [tableId, setTableId] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [currentVisibleState, setCurrentVisibleState] = useState<{[key: string]: boolean}>({})
  const isInitializing = useRef(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastConfigHash = useRef<string>('')

  // Helper function to generate config hash for change detection
  const generateConfigHash = useCallback((columns: Column[], visibleState: {[key: string]: boolean}) => {
    const configString = JSON.stringify({
      columns: columns.map(col => ({ id: col.id, width: col.width })),
      visible: visibleState
    })
    return btoa(configString).substring(0, 16) // Short hash for comparison
  }, [])

  // Helper function to check if configuration actually changed
  const hasConfigChanged = useCallback((newColumns: Column[], newVisibleState: {[key: string]: boolean}) => {
    const newHash = generateConfigHash(newColumns, newVisibleState)
    if (newHash !== lastConfigHash.current) {
      lastConfigHash.current = newHash
      return true
    }
    return false
  }, [generateConfigHash])

  // Column width saving is now handled directly in handleResizeComplete

  // Enhanced save function for column reorder - preserves ALL current state
  const saveColumnOrder = useCallback(async (newOrder: string[], reorderedColumns: Column[]) => {
    if (!reportType || isInitializing.current) return

    // Prepare storage data preserving current visible state and widths
    const visibleColumnsForStorage = reorderedColumns.map((col, index) => ({
      id: col.id,
      width: col.width || 100,
      visible: true,
      order: index
    }))

    // Add hidden columns from current state
    const hiddenColumnsForStorage = initialColumns
      .filter(initCol => !reorderedColumns.find(rc => rc.id === initCol.id))
      .filter(initCol => currentVisibleState[initCol.id] === false)
      .map((col, index) => ({
        id: col.id,
        width: 100,
        visible: false,
        order: visibleColumnsForStorage.length + index
      }))

    const allColumnsForStorage = [...visibleColumnsForStorage, ...hiddenColumnsForStorage]

    // Save with immediate persistence
    try {
      await updateColumnOrder(reportType, newOrder, allColumnsForStorage)
    } catch (error) {
      console.error('❌ Error saving column order:', error)
      if (showToast) {
        showToast('خطأ في حفظ ترتيب الأعمدة', 'error', 3000)
      }
    }
  }, [reportType, currentVisibleState, initialColumns, showToast])

  // Enhanced visibility update that preserves current state
  const updateColumnVisibilityPreservingOrder = useCallback(async (visibilityMap: { [columnId: string]: boolean }) => {
    if (!reportType || isInitializing.current) return

    try {
      // Update internal visible state
      setCurrentVisibleState(prev => ({ ...prev, ...visibilityMap }))

      // Prepare storage data preserving current order and widths
      const columnsForStorage: any[] = []
      let orderIndex = 0

      // Add currently visible columns that should remain visible (preserve order)
      columns.forEach(col => {
        if (visibilityMap[col.id] !== false) {
          columnsForStorage.push({
            id: col.id,
            width: col.width || 100,
            visible: true,
            order: orderIndex++
          })
        }
      })

      // Add newly visible columns that weren't displayed before
      Object.entries(visibilityMap).forEach(([columnId, visible]) => {
        if (visible && !columns.find(col => col.id === columnId)) {
          const originalCol = initialColumns.find(col => col.id === columnId)
          if (originalCol) {
            columnsForStorage.push({
              id: columnId,
              width: originalCol.width || 100,
              visible: true,
              order: orderIndex++
            })
          }
        }
      })

      // Add hidden columns with preserved widths
      Object.entries(visibilityMap).forEach(([columnId, visible]) => {
        if (!visible) {
          const currentCol = columns.find(col => col.id === columnId) ||
                           initialColumns.find(col => col.id === columnId)
          columnsForStorage.push({
            id: columnId,
            width: currentCol?.width || 100,
            visible: false,
            order: orderIndex++
          })
        }
      })

      // Save configuration immediately
      await updateColumnVisibility(reportType, visibilityMap, columnsForStorage)

    } catch (error) {
      console.error('❌ Error updating column visibility:', error)
      if (showToast) {
        showToast('خطأ في حفظ إعدادات الأعمدة', 'error', 3000)
      }
    }
  }, [reportType, columns, initialColumns, showToast])

  // Enhanced column initialization with deduplication
  const initializeColumns = useCallback(async (preserveCurrentOrder = false) => {
    if (isInitializing.current) return
    isInitializing.current = true

    try {
      if (!reportType) {
        // No reportType - use basic columns
        const basicColumns = initialColumns.map(col => ({
          ...col,
          width: col.width || col.minWidth || 100
        }))
        setColumns(basicColumns)
        // Update visible state
        const visibleState: {[key: string]: boolean} = {}
        basicColumns.forEach(col => { visibleState[col.id] = true })
        setCurrentVisibleState(visibleState)
        return
      }

      // Load saved configuration
      const savedConfig = await loadTableConfig(reportType)

      if (savedConfig && savedConfig.columns.length > 0) {
        // Build visibility state from saved config
        const savedVisibilityState: {[key: string]: boolean} = {}
        savedConfig.columns.forEach(col => {
          savedVisibilityState[col.id] = col.visible !== false
        })

        // Use saved order (simplified logic)
        const finalColumns = savedConfig.columns
          .filter(savedCol => savedCol.visible)
          .sort((a, b) => a.order - b.order)
          .map(savedCol => {
            const originalCol = initialColumns.find(col => col.id === savedCol.id)
            return originalCol ? {
              ...originalCol,
              width: savedCol.width || 100
            } : null
          })
          .filter(Boolean) as Column[]

        // Add any new columns not in saved config
        const savedIds = new Set(savedConfig.columns.map(col => col.id))
        const newColumns = initialColumns
          .filter(col => !savedIds.has(col.id))
          .map(col => ({ ...col, width: col.width || col.minWidth || 100 }))

        const allColumns = [...finalColumns, ...newColumns]
        newColumns.forEach(col => { savedVisibilityState[col.id] = true })

        setColumns(allColumns)
        setCurrentVisibleState(savedVisibilityState)
      } else {
        // No saved config, use defaults
        const defaultColumns = initialColumns.map(col => ({
          ...col,
          width: col.width || col.minWidth || 100
        }))
        setColumns(defaultColumns)

        const defaultVisibleState: {[key: string]: boolean} = {}
        defaultColumns.forEach(col => { defaultVisibleState[col.id] = true })
        setCurrentVisibleState(defaultVisibleState)
      }
    } catch (error) {
      console.error('❌ Error loading table config:', error)
      // Fallback to initial columns
      const fallbackColumns = initialColumns.map(col => ({
        ...col,
        width: col.width || col.minWidth || 100
      }))
      setColumns(fallbackColumns)

      const fallbackVisibleState: {[key: string]: boolean} = {}
      fallbackColumns.forEach(col => { fallbackVisibleState[col.id] = true })
      setCurrentVisibleState(fallbackVisibleState)
    } finally {
      isInitializing.current = false
    }
  }, [initialColumns, reportType])

  // Initialize table when component mounts or reportType changes (with debounce)
  useEffect(() => {
    if (isInitializing.current) return

    const timeoutId = setTimeout(() => {
      initializeColumns(false)
    }, 50) // Small delay to prevent rapid re-initialization

    return () => clearTimeout(timeoutId)
  }, [reportType, initialColumns.length, initializeColumns])

  // Debounced event handler to prevent excessive updates
  const eventHandlerRef = useRef<NodeJS.Timeout | null>(null)

  // Enhanced event listener for external changes - SMART filtering to prevent double refresh
  useEffect(() => {
    if (!reportType) return

    const handleStorageChange = (event?: any) => {
      const eventDetail = event?.detail

      // Only ignore resize events from ResizableTable to prevent double refresh
      if (eventDetail?.source === 'ResizableTable' ||
          eventDetail?.source === 'hybridStorage' ||
          isInitializing.current) {
        return
      }

      // Check if event is for our report type
      const eventReportType = eventDetail?.reportType
      const isRelevant = !eventReportType ||
        eventReportType === reportType ||
        (reportType === 'MAIN_REPORT' && eventReportType === 'main') ||
        (reportType === 'PRODUCTS_REPORT' && eventReportType === 'products')

      if (!isRelevant) {
        return
      }

      // Handle external column visibility changes from ColumnManagement
      if (eventDetail?.source === 'ColumnManagement') {
        // Clear any pending event handling
        if (eventHandlerRef.current) {
          clearTimeout(eventHandlerRef.current)
        }

        // Clear any pending save operations
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
          saveTimeoutRef.current = null
        }

        // Immediate column reload for visibility changes
        eventHandlerRef.current = setTimeout(() => {
          if (!isInitializing.current) {
            initializeColumns(true) // Preserve current order
          }
        }, 100) // Shorter delay for immediate feedback
      }
    }

    // Listen for table configuration changes
    window.addEventListener('tableConfigChanged', handleStorageChange)

    return () => {
      window.removeEventListener('tableConfigChanged', handleStorageChange)
      // Clear any pending operations on unmount
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      if (eventHandlerRef.current) {
        clearTimeout(eventHandlerRef.current)
      }
    }
  }, [reportType, initializeColumns])

  // Fix hydration mismatch by setting tableId on client side only
  useEffect(() => {
    setTableId(`table-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  }, [])

  // Monitor container width to determine scrollbar visibility
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }

    updateContainerWidth()
    window.addEventListener('resize', updateContainerWidth)

    return () => {
      window.removeEventListener('resize', updateContainerWidth)
    }
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event

    if (active.id !== over.id && !isInitializing.current) {
      setColumns((currentColumns) => {
        const oldIndex = currentColumns.findIndex(col => col.id === active.id)
        const newIndex = currentColumns.findIndex(col => col.id === over.id)
        const reorderedColumns = arrayMove(currentColumns, oldIndex, newIndex)

        // Save order asynchronously without blocking UI
        setTimeout(async () => {
          if (reportType) {
            try {
              const newOrder = reorderedColumns.map(col => col.id)
              await saveColumnOrder(newOrder, reorderedColumns)

              // Send order update event with proper source identification
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('tableConfigChanged', {
                  detail: {
                    reportType: reportType === 'PRODUCTS_REPORT' ? 'products' : 'main',
                    source: 'ResizableTable',
                    action: 'orderUpdate',
                    newOrder,
                    timestamp: Date.now()
                  }
                }));
              }
            } catch (error) {
              console.error('❌ Error saving column order:', error)
            }
          }
        }, 0)

        // Notify parent component
        if (onColumnsChange) {
          onColumnsChange(reorderedColumns)
        }

        return reorderedColumns
      })
    }
  }, [reportType, onColumnsChange, saveColumnOrder])

  const emptyDragEnd = useCallback(() => {}, [])

  const handleColumnResize = useCallback((columnId: string, newWidth: number) => {
    setColumns(prev => {
      // Only update if width actually changed to prevent unnecessary re-renders
      const currentCol = prev.find(col => col.id === columnId)
      if (currentCol && Math.abs((currentCol.width || 100) - newWidth) < 1) {
        return prev // No change needed (ignore sub-pixel changes)
      }

      const updatedColumns = prev.map(col =>
        col.id === columnId ? { ...col, width: newWidth } : col
      )

      return updatedColumns
    })
  }, [])

  // Enhanced resize complete handler with immediate save
  const handleResizeComplete = useCallback((columnId: string, finalWidth: number) => {
    if (!reportType || isInitializing.current) return

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Immediate save with current state
    const saveWidth = async () => {
      try {
        // Prepare storage data from current state
        const columnsForStorage: any[] = []

        // Add all currently visible columns with updated width
        columns.forEach((col, index) => {
          columnsForStorage.push({
            id: col.id,
            width: col.id === columnId ? finalWidth : (col.width || 100),
            visible: true,
            order: index
          })
        })

        // Add hidden columns from current visible state
        initialColumns.forEach(initCol => {
          if (currentVisibleState[initCol.id] === false) {
            columnsForStorage.push({
              id: initCol.id,
              width: 100,
              visible: false,
              order: columnsForStorage.length
            })
          }
        })

        // Save immediately with source identification
        await updateColumnWidth(reportType, columnId, finalWidth, columnsForStorage)

        // Send resize event with proper source identification
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tableConfigChanged', {
            detail: {
              reportType: reportType === 'PRODUCTS_REPORT' ? 'products' : 'main',
              source: 'ResizableTable',
              action: 'widthUpdate',
              columnId,
              width: finalWidth,
              timestamp: Date.now()
            }
          }));
        }

        // Remove toast notification to avoid UI clutter
        // if (showToast) {
        //   showToast(`✅ تم حفظ عرض العمود`, 'success', 1500)
        // }
      } catch (error) {
        console.error('❌ Error saving column width:', error)
        if (showToast) {
          showToast('خطأ في حفظ عرض العمود', 'error', 3000)
        }
      }
    }

    // Execute save immediately
    saveWidth()
  }, [reportType, columns, currentVisibleState, initialColumns, showToast])

  // Update container width whenever columns change
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }
    updateWidth()
  }, [columns])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending saves
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
      // Reset initializing flag
      isInitializing.current = false
    }
  }, [])

  const totalWidth = columns.reduce((sum, col) => sum + (col.width || 100), 0)
  // Add some buffer for borders and padding
  const needsHorizontalScroll = totalWidth > (containerWidth - 20) && containerWidth > 0

  return (
    <div className={`h-full ${className}`} ref={containerRef}>
      {/* Simplified loading indicator */}
      {isInitializing.current && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-blue-500/5 border-b border-blue-400/50">
          <div className="flex items-center justify-center gap-2 py-1 text-blue-400 text-xs">
            <div className="animate-spin rounded-full h-2 w-2 border border-blue-400 border-t-transparent"></div>
            <span>تحديث...</span>
          </div>
        </div>
      )}

      <div
        className={`h-full ${
          needsHorizontalScroll ? 'custom-scrollbar' : 'scrollbar-hide overflow-y-auto'
        }`}
        style={{
          overflowX: needsHorizontalScroll ? 'auto' : 'hidden'
        }}
      >
        <DndContext
          id={tableId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={isAnyColumnResizing || isInitializing.current ? emptyDragEnd : handleDragEnd}
        >
          <table className="text-sm w-full" style={{ minWidth: `${totalWidth}px`, tableLayout: 'fixed' }}>
          <thead className="bg-[#374151] border-b border-gray-600 sticky top-0">
            <SortableContext items={columns.map(col => col.id)} strategy={horizontalListSortingStrategy}>
              <tr>
                {columns.map((column) => (
                  <SortableHeader
                    key={column.id}
                    column={column}
                    width={column.width || 100}
                    onResize={handleColumnResize}
                    onResizeStateChange={setIsAnyColumnResizing}
                    onResizeComplete={handleResizeComplete}
                  />
                ))}
              </tr>
            </SortableContext>
          </thead>
          <tbody className="bg-[#2B3544]">
            {data.map((item, rowIndex) => (
              <tr
                key={item.id || rowIndex}
                className={`border-b border-gray-700 cursor-pointer transition-colors ${
                  selectedRowId === item.id 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'hover:bg-[#374151]'
                }`}
                onClick={() => onRowClick?.(item, rowIndex)}
                onDoubleClick={() => onRowDoubleClick?.(item, rowIndex)}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className="px-4 py-3 text-gray-300 border-r border-gray-700"
                    style={{
                      width: `${column.width}px`,
                      minWidth: `${column.width}px`,
                      maxWidth: `${column.width}px`
                    }}
                  >
                    <div className="truncate">
                      {column.render
                        ? column.render(item[column.accessor], item, rowIndex)
                        : column.accessor === '#'
                        ? rowIndex + 1
                        : item[column.accessor]
                      }
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          </table>
        </DndContext>
      </div>
    </div>
  )
}