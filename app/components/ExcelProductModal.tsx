'use client'

import { useState, useRef, useEffect } from 'react'
import {
  XMarkIcon,
  CloudArrowUpIcon,
  CloudArrowDownIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
  TableCellsIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { Product } from '../lib/hooks/useProducts'
import { supabase } from '../lib/supabase/client'
import * as XLSX from 'xlsx'

// Helper function to access product_import_history table
// This table was created in hegazy schema but may not be in TypeScript types yet
const getImportHistoryTable = () => (supabase as any).from('product_import_history')

// Supported file formats
const SUPPORTED_FORMATS = ['.xlsx', '.xls', '.csv']
const SUPPORTED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'text/csv', // csv
  'application/csv'
]

// System columns that can be mapped
const SYSTEM_COLUMNS = [
  { id: 'name', label: 'اسم المنتج', required: true },
  { id: 'category_name', label: 'الفئة', required: false },
  { id: 'code', label: 'الكود', required: false },
  { id: 'barcode', label: 'الباركود', required: false },
  { id: 'description', label: 'الوصف', required: false },
  { id: 'cost_price', label: 'سعر الشراء', required: false },
  { id: 'price', label: 'سعر البيع', required: false },
  { id: 'wholesale_price', label: 'سعر الجملة', required: false },
  { id: 'price1', label: 'سعر 1', required: false },
  { id: 'price2', label: 'سعر 2', required: false },
  { id: 'price3', label: 'سعر 3', required: false },
  { id: 'price4', label: 'سعر 4', required: false },
]

// Export columns (without images/videos)
const EXPORT_COLUMNS = [
  { id: 'name', label: 'اسم المنتج', checked: true },
  { id: 'code', label: 'الكود / الباركود', checked: true },
  { id: 'barcode', label: 'الباركود', checked: true },
  { id: 'description', label: 'الوصف', checked: true },
  { id: 'category_name', label: 'الفئة', checked: true },
  { id: 'cost_price', label: 'سعر الشراء', checked: true },
  { id: 'price', label: 'سعر البيع', checked: true },
  { id: 'wholesale_price', label: 'سعر الجملة', checked: true },
  { id: 'price1', label: 'سعر 1', checked: true },
  { id: 'price2', label: 'سعر 2', checked: true },
  { id: 'price3', label: 'سعر 3', checked: true },
  { id: 'price4', label: 'سعر 4', checked: true },
  { id: 'is_active', label: 'حالة المنتج (نشط/غير نشط)', checked: true },
]

interface ImportHistory {
  id: string
  import_date: string
  file_name: string
  file_type: string
  total_products: number
  successful_imports: number
  failed_imports: number
  status: string
  can_rollback: boolean
  rolled_back_at: string | null
}

interface ExcelProductModalProps {
  isOpen: boolean
  onClose: () => void
  products: Product[]
  selectedProductIds: string[]
  onImportComplete: () => void
  createProduct: (productData: Partial<Product>) => Promise<Product | null>
}

type TabType = 'export' | 'import' | 'history'

export default function ExcelProductModal({
  isOpen,
  onClose,
  products,
  selectedProductIds,
  onImportComplete,
  createProduct
}: ExcelProductModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('export')

  // Export state
  const [exportColumns, setExportColumns] = useState(EXPORT_COLUMNS)
  const [exportMode, setExportMode] = useState<'all' | 'selected'>('all')
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx')
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  // Import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileColumns, setFileColumns] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<{[key: string]: string}>({})
  const [previewData, setPreviewData] = useState<any[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResults, setImportResults] = useState<{
    total: number
    success: number
    failed: number
    errors: string[]
  } | null>(null)
  const [importCompleted, setImportCompleted] = useState(false) // New state to track completion
  const [showSuccessMessage, setShowSuccessMessage] = useState(false) // New state for success popup
  const fileInputRef = useRef<HTMLInputElement>(null)

  // History state
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isDeletingImport, setIsDeletingImport] = useState<string | null>(null)

  // Load import history when tab changes
  useEffect(() => {
    if (activeTab === 'history' && isOpen) {
      loadImportHistory()
    }
  }, [activeTab, isOpen])

  // Reset import states when modal opens
  useEffect(() => {
    if (isOpen) {
      setImportCompleted(false)
      setShowSuccessMessage(false)
      setImportResults(null)
      setSelectedFile(null)
      setFileColumns([])
      setColumnMapping({})
      setPreviewData([])
      setImportProgress(0)
    }
  }, [isOpen])

  const loadImportHistory = async () => {
    setIsLoadingHistory(true)
    try {
      const { data, error } = await getImportHistoryTable()
        .select('*')
        .order('import_date', { ascending: false })
        .limit(50)

      if (error) throw error
      setImportHistory(data || [])
    } catch (error) {
      console.error('Error loading import history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  if (!isOpen) return null

  // ==================== EXPORT FUNCTIONS ====================

  const handleExport = async () => {
    setIsExporting(true)
    setExportProgress(0)

    try {
      const productsToExport = exportMode === 'selected' && selectedProductIds.length > 0
        ? products.filter(p => selectedProductIds.includes(p.id))
        : products

      // Get selected column IDs
      const selectedColumnIds = exportColumns.filter(c => c.checked).map(c => c.id)

      // Prepare data for export
      const exportData = productsToExport.map((product, index) => {
        setExportProgress(Math.round((index / productsToExport.length) * 100))

        const row: any = {}

        selectedColumnIds.forEach(colId => {
          const col = EXPORT_COLUMNS.find(c => c.id === colId)
          if (col) {
            let value = (product as any)[colId]

            // Handle special cases
            if (colId === 'is_active') {
              value = value ? 'نشط' : 'غير نشط'
            } else if (colId === 'category_name') {
              value = (product as any).categories?.name || ''
            } else if (typeof value === 'number') {
              value = value || 0
            }

            row[col.label] = value ?? ''
          }
        })

        return row
      })

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'المنتجات')

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 10)
      const filename = `products_export_${timestamp}.${exportFormat}`

      // Download file
      if (exportFormat === 'xlsx') {
        XLSX.writeFile(wb, filename)
      } else {
        XLSX.writeFile(wb, filename, { bookType: 'csv' })
      }

      setExportProgress(100)
      setTimeout(() => {
        setIsExporting(false)
        setExportProgress(0)
      }, 1000)

    } catch (error) {
      console.error('Export error:', error)
      alert('حدث خطأ أثناء التصدير')
      setIsExporting(false)
    }
  }

  const toggleExportColumn = (id: string) => {
    setExportColumns(prev => prev.map(col =>
      col.id === id ? { ...col, checked: !col.checked } : col
    ))
  }

  // ==================== IMPORT FUNCTIONS ====================

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file type
    const isValidType = SUPPORTED_MIME_TYPES.includes(file.type) ||
      SUPPORTED_FORMATS.some(ext => file.name.toLowerCase().endsWith(ext))

    if (!isValidType) {
      alert(`صيغة الملف غير مدعومة. الصيغ المدعومة: ${SUPPORTED_FORMATS.join(', ')}`)
      return
    }

    setSelectedFile(file)
    setImportResults(null)
    parseFile(file)
  }

  const parseFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      if (jsonData.length === 0) {
        alert('الملف فارغ')
        return
      }

      // First row is headers
      const headers = (jsonData[0] as string[]).map(h => String(h || '').trim())
      setFileColumns(headers)

      // Parse preview data (first 5 rows)
      const preview = jsonData.slice(1, 6).map((row: any) => {
        const obj: any = {}
        headers.forEach((header, index) => {
          obj[header] = row[index] ?? ''
        })
        return obj
      })
      setPreviewData(preview)

      // Auto-map columns with similar names
      const autoMapping: {[key: string]: string} = {}
      SYSTEM_COLUMNS.forEach(sysCol => {
        const match = headers.find(h =>
          h.toLowerCase().includes(sysCol.label.toLowerCase()) ||
          h.toLowerCase().includes(sysCol.id.toLowerCase()) ||
          sysCol.label.toLowerCase().includes(h.toLowerCase())
        )
        if (match) {
          autoMapping[sysCol.id] = match
        }
      })
      setColumnMapping(autoMapping)

    } catch (error) {
      console.error('Error parsing file:', error)
      alert('حدث خطأ أثناء قراءة الملف')
    }
  }

  const handleImport = async () => {
    if (!selectedFile) {
      alert('الرجاء اختيار ملف أولاً')
      return
    }

    // Check if name column is mapped
    if (!columnMapping['name']) {
      alert('يجب تحديد عمود "اسم المنتج" على الأقل')
      return
    }

    setIsImporting(true)
    setImportProgress(0)
    const errors: string[] = []
    const importedProductIds: string[] = []

    try {
      // Read full file
      const data = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      let successCount = 0
      let failedCount = 0

      // Create import history record
      const { data: historyRecord, error: historyError } = await getImportHistoryTable()
        .insert({
          file_name: selectedFile.name,
          file_type: selectedFile.name.split('.').pop() || 'unknown',
          total_products: jsonData.length,
          column_mapping: columnMapping,
          status: 'in_progress'
        })
        .select()
        .single()

      if (historyError) {
        console.error('Error creating history record:', historyError)
      }

      const batchId = historyRecord?.id

      // Import products
      for (let i = 0; i < jsonData.length; i++) {
        try {
          const row = jsonData[i] as any
          setImportProgress(Math.round((i / jsonData.length) * 100))

          // Build product data from mapping
          const productData: Partial<Product> = {}

          Object.entries(columnMapping).forEach(([systemCol, fileCol]) => {
            if (fileCol && row[fileCol] !== undefined) {
              let value = row[fileCol]

              // Validate and convert numeric fields
              if (['cost_price', 'price', 'wholesale_price', 'price1', 'price2', 'price3', 'price4'].includes(systemCol)) {
                const numValue = parseFloat(String(value).replace(/[^\d.-]/g, ''))
                value = isNaN(numValue) ? 0 : numValue
              }

              // Handle is_active
              if (systemCol === 'is_active') {
                value = value === 'نشط' || value === true || value === 1 || value === '1'
              }

              (productData as any)[systemCol] = value
            }
          })

          // Ensure required fields
          if (!productData.name) {
            errors.push(`صف ${i + 2}: اسم المنتج مطلوب`)
            failedCount++
            continue
          }

          // Add batch ID for rollback capability
          if (batchId) {
            (productData as any).import_batch_id = batchId
          }

          // Create product
          const newProduct = await createProduct(productData)

          if (newProduct) {
            successCount++
            importedProductIds.push(newProduct.id)
          } else {
            failedCount++
            errors.push(`صف ${i + 2}: فشل في إنشاء المنتج "${productData.name}"`)
          }

        } catch (err: any) {
          failedCount++
          errors.push(`صف ${i + 2}: ${err.message || 'خطأ غير معروف'}`)
        }
      }

      // Update import history record
      if (batchId) {
        await getImportHistoryTable()
          .update({
            successful_imports: successCount,
            failed_imports: failedCount,
            imported_product_ids: importedProductIds,
            status: failedCount === jsonData.length ? 'failed' : failedCount > 0 ? 'partial' : 'completed',
            error_log: errors.length > 0 ? { errors: errors.slice(0, 100) } : null
          })
          .eq('id', batchId)
      }

      setImportResults({
        total: jsonData.length,
        success: successCount,
        failed: failedCount,
        errors: errors.slice(0, 20)
      })

      if (successCount > 0) {
        onImportComplete()
        setImportCompleted(true)
        setShowSuccessMessage(true)

        // Auto close after 3 seconds on successful import
        setTimeout(() => {
          setShowSuccessMessage(false)
          onClose()
        }, 3000)
      }

    } catch (error: any) {
      console.error('Import error:', error)
      setImportResults({
        total: 0,
        success: 0,
        failed: 1,
        errors: [error.message || 'حدث خطأ أثناء الاستيراد']
      })
    } finally {
      setIsImporting(false)
      setImportProgress(100)
    }
  }

  // ==================== HISTORY FUNCTIONS ====================

  const handleRollbackImport = async (historyId: string) => {
    if (!confirm('هل أنت متأكد من حذف جميع المنتجات المستوردة في هذه العملية؟')) {
      return
    }

    setIsDeletingImport(historyId)

    try {
      // Get the import record
      const { data: record, error: fetchError } = await getImportHistoryTable()
        .select('*')
        .eq('id', historyId)
        .single()

      if (fetchError) throw fetchError

      // Check if rollback is still allowed (24 hours)
      const importDate = new Date(record.import_date)
      const now = new Date()
      const hoursDiff = (now.getTime() - importDate.getTime()) / (1000 * 60 * 60)

      if (hoursDiff > 24) {
        alert('انتهت مدة السماح بالتراجع (24 ساعة)')
        await getImportHistoryTable()
          .update({ can_rollback: false })
          .eq('id', historyId)
        loadImportHistory()
        return
      }

      // Delete imported products
      if (record.imported_product_ids && record.imported_product_ids.length > 0) {
        const { error: deleteError } = await supabase
          .from('products')
          .delete()
          .in('id', record.imported_product_ids)

        if (deleteError) throw deleteError
      }

      // Update history record
      await getImportHistoryTable()
        .update({
          rolled_back_at: new Date().toISOString(),
          can_rollback: false
        })
        .eq('id', historyId)

      alert('تم التراجع عن عملية الاستيراد بنجاح')
      loadImportHistory()
      onImportComplete()

    } catch (error: any) {
      console.error('Rollback error:', error)
      alert(`حدث خطأ: ${error.message}`)
    } finally {
      setIsDeletingImport(null)
    }
  }

  const canRollback = (record: ImportHistory): boolean => {
    if (!record.can_rollback || record.rolled_back_at) return false
    const importDate = new Date(record.import_date)
    const now = new Date()
    const hoursDiff = (now.getTime() - importDate.getTime()) / (1000 * 60 * 60)
    return hoursDiff <= 24
  }

  const getRemainingTime = (importDate: string): string => {
    const date = new Date(importDate)
    const now = new Date()
    const hoursDiff = 24 - ((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    if (hoursDiff <= 0) return 'انتهت المدة'
    const hours = Math.floor(hoursDiff)
    const minutes = Math.floor((hoursDiff - hours) * 60)
    return `${hours} ساعة ${minutes} دقيقة`
  }

  // ==================== RENDER ====================

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#2B3544] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#374151] px-6 py-4 flex items-center justify-between border-b border-gray-600">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TableCellsIcon className="w-6 h-6 text-green-400" />
            Excel - تصدير واستيراد المنتجات
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-600 bg-[#374151]">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'export'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-[#2B3544]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <CloudArrowDownIcon className="w-5 h-5" />
            تصدير المنتجات
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'import'
                ? 'text-green-400 border-b-2 border-green-400 bg-[#2B3544]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <CloudArrowUpIcon className="w-5 h-5" />
            استيراد المنتجات
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'history'
                ? 'text-orange-400 border-b-2 border-orange-400 bg-[#2B3544]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ClockIcon className="w-5 h-5" />
            سجل الاستيراد
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ==================== EXPORT TAB ==================== */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              {/* Format Selection */}
              <div>
                <h3 className="text-white font-medium mb-3">صيغة الملف</h3>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="exportFormat"
                      value="xlsx"
                      checked={exportFormat === 'xlsx'}
                      onChange={() => setExportFormat('xlsx')}
                      className="text-blue-500"
                    />
                    <span className="text-gray-300">Excel (.xlsx)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="exportFormat"
                      value="csv"
                      checked={exportFormat === 'csv'}
                      onChange={() => setExportFormat('csv')}
                      className="text-blue-500"
                    />
                    <span className="text-gray-300">CSV (.csv)</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  الصيغ المدعومة للتصدير: xlsx, csv
                </p>
              </div>

              {/* Export Mode */}
              <div>
                <h3 className="text-white font-medium mb-3">نطاق التصدير</h3>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="exportMode"
                      value="all"
                      checked={exportMode === 'all'}
                      onChange={() => setExportMode('all')}
                      className="text-blue-500"
                    />
                    <span className="text-gray-300">جميع المنتجات ({products.length})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="exportMode"
                      value="selected"
                      checked={exportMode === 'selected'}
                      onChange={() => setExportMode('selected')}
                      className="text-blue-500"
                      disabled={selectedProductIds.length === 0}
                    />
                    <span className={selectedProductIds.length === 0 ? 'text-gray-500' : 'text-gray-300'}>
                      المنتجات المحددة ({selectedProductIds.length})
                    </span>
                  </label>
                </div>
              </div>

              {/* Columns Selection */}
              <div>
                <h3 className="text-white font-medium mb-3">الأعمدة للتصدير</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-[#374151] p-4 rounded-lg">
                  {exportColumns.map(col => (
                    <label key={col.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={col.checked}
                        onChange={() => toggleExportColumn(col.id)}
                        className="rounded text-blue-500"
                      />
                      <span className="text-gray-300 text-sm">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Export Progress */}
              {isExporting && (
                <div className="bg-[#374151] p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300">جاري التصدير...</span>
                    <span className="text-blue-400">{exportProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={isExporting || exportColumns.filter(c => c.checked).length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <DocumentArrowDownIcon className="w-5 h-5" />
                {isExporting ? 'جاري التصدير...' : 'تصدير المنتجات'}
              </button>
            </div>
          )}

          {/* ==================== IMPORT TAB ==================== */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-400 text-sm">
                  يمكنك استيراد المنتجات من ملف Excel أو CSV تم تصديره من نظام آخر.
                  <br />
                  الصيغ المدعومة: <strong>{SUPPORTED_FORMATS.join(' - ')}</strong>
                </p>
              </div>

              {/* File Upload */}
              <div>
                <h3 className="text-white font-medium mb-3">اختر الملف</h3>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept={SUPPORTED_FORMATS.join(',')}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-600 rounded-lg p-8 flex flex-col items-center gap-3 hover:border-green-500 transition-colors"
                >
                  <CloudArrowUpIcon className="w-12 h-12 text-gray-400" />
                  <span className="text-gray-300">
                    {selectedFile ? selectedFile.name : 'اضغط لاختيار ملف أو اسحب الملف هنا'}
                  </span>
                  <span className="text-xs text-gray-500">
                    الصيغ المدعومة: {SUPPORTED_FORMATS.join(', ')}
                  </span>
                </button>
              </div>

              {/* Column Mapping */}
              {fileColumns.length > 0 && (
                <div>
                  <h3 className="text-white font-medium mb-3">ربط الأعمدة</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    اختر العمود المناسب من ملفك لكل حقل في النظام
                  </p>
                  <div className="bg-[#374151] rounded-lg p-4 space-y-3 max-h-64 overflow-y-auto">
                    {SYSTEM_COLUMNS.map(sysCol => (
                      <div key={sysCol.id} className="flex items-center gap-4">
                        <div className="w-40 text-gray-300 text-sm flex items-center gap-1">
                          {sysCol.label}
                          {sysCol.required && <span className="text-red-400">*</span>}
                        </div>
                        <select
                          value={columnMapping[sysCol.id] || ''}
                          onChange={(e) => setColumnMapping(prev => ({
                            ...prev,
                            [sysCol.id]: e.target.value
                          }))}
                          className="flex-1 bg-[#2B3544] border border-gray-600 rounded px-3 py-2 text-white text-sm"
                        >
                          <option value="">-- اختر العمود --</option>
                          {fileColumns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Data */}
              {previewData.length > 0 && (
                <div>
                  <h3 className="text-white font-medium mb-3">معاينة البيانات (أول 5 صفوف)</h3>
                  <div className="overflow-x-auto bg-[#374151] rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-600">
                          {fileColumns.slice(0, 6).map(col => (
                            <th key={col} className="px-3 py-2 text-right text-gray-400 font-medium">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, idx) => (
                          <tr key={idx} className="border-b border-gray-700">
                            {fileColumns.slice(0, 6).map(col => (
                              <td key={col} className="px-3 py-2 text-gray-300">
                                {String(row[col] || '').slice(0, 30)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import Progress */}
              {isImporting && (
                <div className="bg-[#374151] p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300">جاري الاستيراد...</span>
                    <span className="text-green-400">{importProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Success Message Popup */}
              {showSuccessMessage && importResults && importResults.success > 0 && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]">
                  <div className="bg-[#2B3544] rounded-2xl p-8 text-center max-w-md mx-4 animate-pulse-once shadow-2xl border border-green-500/30">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircleIcon className="w-12 h-12 text-green-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">تم الاستيراد بنجاح!</h3>
                    <p className="text-gray-400 mb-4">
                      تم استيراد <span className="text-green-400 font-bold">{importResults.success}</span> منتج بنجاح
                      {importResults.failed > 0 && (
                        <span className="text-yellow-400"> ({importResults.failed} فشل)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">سيتم إغلاق النافذة تلقائياً...</p>
                    <button
                      onClick={() => {
                        setShowSuccessMessage(false)
                        onClose()
                      }}
                      className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      إغلاق الآن
                    </button>
                  </div>
                </div>
              )}

              {/* Import Results */}
              {importResults && !showSuccessMessage && (
                <div className={`p-4 rounded-lg ${
                  importResults.failed === 0 ? 'bg-green-500/10 border border-green-500/30' :
                  importResults.success === 0 ? 'bg-red-500/10 border border-red-500/30' :
                  'bg-yellow-500/10 border border-yellow-500/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {importResults.failed === 0 ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-400" />
                    ) : (
                      <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400" />
                    )}
                    <span className="text-white font-medium">نتائج الاستيراد</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">الإجمالي:</span>
                      <span className="text-white mr-2">{importResults.total}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">نجح:</span>
                      <span className="text-green-400 mr-2">{importResults.success}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">فشل:</span>
                      <span className="text-red-400 mr-2">{importResults.failed}</span>
                    </div>
                  </div>
                  {importResults.errors.length > 0 && (
                    <div className="mt-3 text-xs text-red-400 max-h-32 overflow-y-auto">
                      {importResults.errors.map((err, idx) => (
                        <div key={idx}>• {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Import Button */}
              <button
                onClick={handleImport}
                disabled={isImporting || importCompleted || !selectedFile || !columnMapping['name']}
                className={`w-full ${
                  importCompleted
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed'
                } text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors`}
              >
                <DocumentArrowUpIcon className="w-5 h-5" />
                {isImporting ? 'جاري الاستيراد...' : importCompleted ? 'تم الاستيراد بنجاح ✓' : 'استيراد المنتجات'}
              </button>
            </div>
          )}

          {/* ==================== HISTORY TAB ==================== */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* Refresh Button */}
              <div className="flex justify-between items-center">
                <h3 className="text-white font-medium">سجل عمليات الاستيراد</h3>
                <button
                  onClick={loadImportHistory}
                  disabled={isLoadingHistory}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowPathIcon className={`w-5 h-5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Info */}
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-sm text-orange-400">
                يمكنك التراجع عن عملية الاستيراد خلال 24 ساعة فقط من وقت الاستيراد
              </div>

              {/* History List */}
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin" />
                </div>
              ) : importHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  لا توجد عمليات استيراد سابقة
                </div>
              ) : (
                <div className="space-y-3">
                  {importHistory.map(record => (
                    <div
                      key={record.id}
                      className={`bg-[#374151] rounded-lg p-4 ${
                        record.rolled_back_at ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="text-white font-medium">{record.file_name}</div>
                          <div className="text-xs text-gray-400">
                            {new Date(record.import_date).toLocaleString('ar-EG')}
                          </div>
                          <div className="flex gap-4 text-sm">
                            <span className="text-gray-400">
                              الإجمالي: <span className="text-white">{record.total_products}</span>
                            </span>
                            <span className="text-gray-400">
                              نجح: <span className="text-green-400">{record.successful_imports}</span>
                            </span>
                            <span className="text-gray-400">
                              فشل: <span className="text-red-400">{record.failed_imports}</span>
                            </span>
                          </div>
                          {record.rolled_back_at && (
                            <div className="text-xs text-red-400">
                              تم التراجع بتاريخ: {new Date(record.rolled_back_at).toLocaleString('ar-EG')}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            record.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            record.status === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                            record.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {record.status === 'completed' ? 'مكتمل' :
                             record.status === 'partial' ? 'جزئي' :
                             record.status === 'failed' ? 'فشل' : record.status}
                          </span>
                          {canRollback(record) && !record.rolled_back_at && (
                            <>
                              <span className="text-xs text-orange-400">
                                متبقي: {getRemainingTime(record.import_date)}
                              </span>
                              <button
                                onClick={() => handleRollbackImport(record.id)}
                                disabled={isDeletingImport === record.id}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-xs rounded flex items-center gap-1"
                              >
                                {isDeletingImport === record.id ? (
                                  <ArrowPathIcon className="w-3 h-3 animate-spin" />
                                ) : (
                                  <TrashIcon className="w-3 h-3" />
                                )}
                                تراجع
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
