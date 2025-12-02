'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProductsAdmin } from '../../../lib/hooks/useProductsAdmin';
import { useStoreCategories } from '../../../../lib/hooks/useStoreCategories';
import { DragDropProvider } from './components/DragDropProvider';
import ProductManagementGrid from './components/ProductManagementGrid';
import CategoryManagementGrid from './components/CategoryManagementGrid';
import AddStoreCategoryModal from './components/AddStoreCategoryModal';
import ProductSizeModal from './components/ProductSizeModal';
import ManageSizeGroupsModal from './components/ManageSizeGroupsModal';
import { supabase } from '../../../lib/supabase/client';
import { revalidateAll } from '../../../../lib/utils/revalidate';

interface ProductManagementItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isHidden: boolean;
  isFeatured: boolean;
  displayOrder: number;
  suggestedProducts: string[];
}

export default function ProductManagementPage() {
  const router = useRouter();
  const { products: databaseProducts, isLoading, fetchProducts } = useProductsAdmin();
  const { categories: storeCategories, isLoading: isCategoriesLoading, fetchCategories: fetchStoreCategories, deleteCategory: deleteStoreCategory, reorderCategories } = useStoreCategories();
  const [products, setProducts] = useState<ProductManagementItem[]>([]);
  const [originalProducts, setOriginalProducts] = useState<ProductManagementItem[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDragMode, setIsDragMode] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [managementMode, setManagementMode] = useState<'products' | 'categories'>('products');
  const [categories, setCategories] = useState<any[]>([]);
  const [originalCategories, setOriginalCategories] = useState<any[]>([]);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isProductSizeModalOpen, setIsProductSizeModalOpen] = useState(false);
  const [isManageSizeGroupsModalOpen, setIsManageSizeGroupsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Set client-side flag after component mounts
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Warn user when leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'لديك تغييرات غير محفوظة. هل تريد المغادرة دون حفظ؟';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Convert database products to management format
  useEffect(() => {
    // Only update from database if we don't have unsaved changes
    if (databaseProducts && databaseProducts.length > 0 && !hasUnsavedChanges && !isSaving) {
      const convertedProducts: ProductManagementItem[] = databaseProducts.map((dbProduct: any, index: number) => ({
        id: dbProduct.id,
        name: dbProduct.name || 'منتج بدون اسم',
        description: dbProduct.description || '',
        price: dbProduct.price || 0,
        image: dbProduct.main_image_url || '/placeholder-product.svg',
        category: dbProduct.category?.name || 'عام',
        isHidden: dbProduct.is_hidden || false,
        isFeatured: dbProduct.is_featured || false,
        displayOrder: dbProduct.display_order || index,
        suggestedProducts: dbProduct.suggested_products || []
      }));

      // Already sorted by display_order in the query
      setProducts(convertedProducts);
      setOriginalProducts(JSON.parse(JSON.stringify(convertedProducts))); // Deep copy
      setHasUnsavedChanges(false);
    }
  }, [databaseProducts, hasUnsavedChanges, isSaving]);

  // Convert store categories to management format
  useEffect(() => {
    if (storeCategories && storeCategories.length >= 0 && managementMode === 'categories' && !isSaving) {
      const convertedCategories = storeCategories.map((cat: any, index: number) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description || '',
        image: cat.image_url || '',
        isHidden: !cat.is_active,
        displayOrder: cat.sort_order || index,
        color: cat.color || '#3B82F6'
      }));

      setCategories(convertedCategories);
      setOriginalCategories(JSON.parse(JSON.stringify(convertedCategories)));
      setHasUnsavedChanges(false);
    }
  }, [storeCategories, managementMode, isSaving]);

  // Load store categories when switching to categories mode
  useEffect(() => {
    if (managementMode === 'categories') {
      fetchStoreCategories();
    }
  }, [managementMode]);

  const toggleDragMode = () => {
    setIsDragMode(!isDragMode);
  };


  const toggleVisibility = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newHiddenState = !product.isHidden;
    
    setProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, isHidden: newHiddenState } : p
    ));
    setHasUnsavedChanges(true);
  };

  const toggleFeatured = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newFeaturedState = !product.isFeatured;
    
    setProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, isFeatured: newFeaturedState } : p
    ));
    setHasUnsavedChanges(true);
  };

  const updateSuggestedProducts = (productId: string, suggestedIds: string[]) => {
    setProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, suggestedProducts: suggestedIds } : p
    ));
    setHasUnsavedChanges(true);
  };

  // Category management functions
  const toggleCategoryVisibility = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    const newHiddenState = !category.isHidden;

    setCategories(prev => prev.map(c =>
      c.id === categoryId ? { ...c, isHidden: newHiddenState } : c
    ));
    setHasUnsavedChanges(true);
  };

  // Handle category selection
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(selectedCategoryId === categoryId ? null : categoryId);
  };

  // Handle edit category
  const handleEditCategory = () => {
    if (selectedCategoryId) {
      const category = categories.find(c => c.id === selectedCategoryId);
      if (category) {
        setEditingCategory(category);
        setIsEditCategoryModalOpen(true);
      }
    }
  };

  // Handle delete category
  const handleDeleteCategory = async () => {
    if (selectedCategoryId) {
      const category = categories.find(c => c.id === selectedCategoryId);
      if (category && confirm(`هل أنت متأكد من حذف فئة "${category.name}"؟`)) {
        try {
          await deleteStoreCategory(selectedCategoryId);
          setSelectedCategoryId(null);
          // Remove from local state
          setCategories(prev => prev.filter(c => c.id !== selectedCategoryId));
          alert(`تم حذف فئة "${category.name}" بنجاح`);
        } catch (error) {
          console.error('Error deleting category:', error);
          alert('حدث خطأ أثناء حذف الفئة');
        }
      }
    }
  };

  const handleCategoryReorder = (reorderedCategories: any[]) => {
    setCategories(reorderedCategories);
    setHasUnsavedChanges(true);
  };

  const saveAllChanges = async () => {
    setIsSaving(true);
    console.log('🟢 Starting save process...');
    
    if (managementMode === 'categories') {
      return await saveCategoryChanges();
    } else {
      return await saveProductChanges();
    }
  };

  const saveProductChanges = async () => {
    console.log('Current products:', products);
    console.log('Original products:', originalProducts);
    
    try {
      // Prepare all updates - use Promise.all for better performance
      const updates: Array<{
        id: string;
        display_order: number;
        is_hidden: boolean;
        is_featured: boolean;
        suggested_products: string[];
        hasChanges: boolean;
      }> = [];

      for (let index = 0; index < products.length; index++) {
        const product = products[index];
        const original = originalProducts.find(op => op.id === product.id);
        
        const hasChanges = !original || (
          original.displayOrder !== index ||
          original.isHidden !== product.isHidden ||
          original.isFeatured !== product.isFeatured ||
          JSON.stringify(original.suggestedProducts || []) !== JSON.stringify(product.suggestedProducts || [])
        );
        
        console.log(`Product ${product.name}:`, {
          id: product.id,
          hasChanges,
          changes: {
            displayOrder: { from: original?.displayOrder, to: index },
            isHidden: { from: original?.isHidden, to: product.isHidden },
            isFeatured: { from: original?.isFeatured, to: product.isFeatured },
            suggestedProducts: { from: original?.suggestedProducts, to: product.suggestedProducts }
          }
        });

        if (hasChanges) {
          updates.push({
            id: product.id,
            display_order: index,
            is_hidden: product.isHidden,
            is_featured: product.isFeatured,
            suggested_products: product.suggestedProducts || [],
            hasChanges: true
          });
        }
      }

      console.log('Updates to be processed:', updates);

      if (updates.length === 0) {
        console.log('🟡 No changes to save');
        alert('لا توجد تغييرات للحفظ');
        setIsSaving(false);
        return;
      }

      // Update database using Promise.all for better performance
      console.log('🔄 Updating database...');
      const updatePromises = updates.map(async (update) => {
        console.log(`Updating product ${update.id}:`, {
          display_order: update.display_order,
          is_hidden: update.is_hidden,
          is_featured: update.is_featured,
          suggested_products: update.suggested_products
        });
        
        const { data, error } = await supabase
          .from('products')
          .update({
            display_order: update.display_order,
            is_hidden: update.is_hidden,
            is_featured: update.is_featured,
            suggested_products: update.suggested_products,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.id)
          .select('id, name');
        
        if (error) {
          console.error(`❌ Error updating product ${update.id}:`, error);
          throw new Error(`Failed to update product ${update.id}: ${error.message}`);
        }
        
        console.log(`✅ Successfully updated product ${update.id}:`, data);
        return { id: update.id, success: true, data };
      });

      // Execute all updates in parallel
      const results = await Promise.all(updatePromises);
      const successCount = results.filter(r => r.success).length;
      
      console.log(`🎉 Successfully updated ${successCount} products`);

      // Update original products state to match current state
      setOriginalProducts(JSON.parse(JSON.stringify(products)));
      setHasUnsavedChanges(false);

      // ✨ Refresh website cache instantly (On-Demand ISR)
      console.log('🔄 Refreshing website cache...');
      revalidateAll().then((result) => {
        if (result.success) {
          console.log('✅ Website cache refreshed successfully!', result);
        } else {
          console.warn('⚠️ Failed to refresh website cache:', result.error);
        }
      }).catch((error) => {
        console.error('❌ Error refreshing website cache:', error);
      });

      // Refresh products from database to get the latest state
      setTimeout(async () => {
        try {
          await fetchProducts();
        } catch (error) {
          console.error('Error refreshing products:', error);
        }
      }, 500);

      alert(`تم حفظ ${successCount} تغيير بنجاح!\n\nسيظهر التحديث في المتجر خلال 30 ثانية أو فوراً إذا تم تفعيل التحديث الفوري.`);
      
    } catch (error) {
      console.error('❌ Error saving changes:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      alert(`حدث خطأ أثناء حفظ التغييرات: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const saveCategoryChanges = async () => {
    console.log('🟢 Starting category save process...');
    console.log('Current categories:', categories);
    console.log('Original categories:', originalCategories);

    try {
      // Check if there are changes to save
      const hasOrderChanges = categories.some((category, index) => {
        const original = originalCategories.find(oc => oc.id === category.id);
        return !original || original.displayOrder !== index;
      });

      const hasVisibilityChanges = categories.some((category) => {
        const original = originalCategories.find(oc => oc.id === category.id);
        return !original || original.isHidden !== category.isHidden;
      });

      if (!hasOrderChanges && !hasVisibilityChanges) {
        console.log('🟡 No category changes to save');
        alert('لا توجد تغييرات للحفظ');
        setIsSaving(false);
        return;
      }

      // Convert management format back to store categories format for reordering
      const reorderedStoreCategories = categories.map((category, index) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        image_url: category.image,
        color: category.color,
        is_active: !category.isHidden,
        sort_order: index,
        created_at: null,
        updated_at: null,
        created_by: null,
        name_en: null
      }));

      // Use the hook's reorder function for order changes
      if (hasOrderChanges) {
        console.log('🔄 Updating category order...');
        await reorderCategories(reorderedStoreCategories);
      }

      // Handle visibility changes separately if needed
      if (hasVisibilityChanges && !hasOrderChanges) {
        console.log('🔄 Updating category visibility...');
        const visibilityUpdatePromises = categories
          .filter(category => {
            const original = originalCategories.find(oc => oc.id === category.id);
            return original && original.isHidden !== category.isHidden;
          })
          .map(category =>
            supabase
              .from('store_categories')
              .update({
                is_active: !category.isHidden,
                updated_at: new Date().toISOString()
              })
              .eq('id', category.id)
          );

        await Promise.all(visibilityUpdatePromises);
      }

      console.log('🎉 Successfully updated store categories');

      // Update original categories state to match current state
      setOriginalCategories(JSON.parse(JSON.stringify(categories)));
      setHasUnsavedChanges(false);

      // ✨ Refresh website cache instantly (On-Demand ISR)
      console.log('🔄 Refreshing website cache...');
      revalidateAll().then((result) => {
        if (result.success) {
          console.log('✅ Website cache refreshed successfully!', result);
        } else {
          console.warn('⚠️ Failed to refresh website cache:', result.error);
        }
      }).catch((error) => {
        console.error('❌ Error refreshing website cache:', error);
      });

      // Refresh categories from database to get the latest state
      setTimeout(async () => {
        try {
          await fetchStoreCategories();
        } catch (error) {
          console.error('Error refreshing categories:', error);
        }
      }, 500);

      alert('تم حفظ تغييرات الفئات بنجاح!\n\nسيظهر التحديث في المتجر خلال 30 ثانية أو فوراً إذا تم تفعيل التحديث الفوري.');

    } catch (error) {
      console.error('❌ Error saving category changes:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      alert(`حدث خطأ أثناء حفظ التغييرات: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const discardChanges = () => {
    if (!hasUnsavedChanges) return;
    
    if (confirm('هل أنت متأكد من إلغاء جميع التغييرات؟')) {
      if (managementMode === 'categories') {
        setCategories(JSON.parse(JSON.stringify(originalCategories)));
      } else {
        setProducts(JSON.parse(JSON.stringify(originalProducts)));
      }
      setHasUnsavedChanges(false);
      setIsDragMode(false);
    }
  };

  const handleReorder = (reorderedProducts: ProductManagementItem[]) => {
    setProducts(reorderedProducts);
    setHasUnsavedChanges(true);
  };

  // Handle product selection
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(selectedProductId === productId ? null : productId);
  };

  // Filter products based on search term
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Filter categories based on search term
  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Show loading state during hydration or while loading data
  if (!isClient || isLoading || (managementMode === 'categories' && isCategoriesLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: '#c0c0c0'}}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل صفحة إدارة المنتجات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col text-gray-800" style={{backgroundColor: '#c0c0c0'}}>
      {/* Header - Fixed */}
      <header className="flex-shrink-0 border-b border-gray-700 py-1" style={{backgroundColor: 'var(--primary-color)'}}>
        <div className="w-full px-6 flex items-center justify-between">
          {/* Right side - Title and Action buttons */}
          <div className="flex items-center gap-1">
            <h1 className="text-2xl font-bold text-white">
              {managementMode === 'products' ? 'إدارة المنتجات' : 'إدارة الفئات'}
            </h1>
            
            {/* White separator line */}
            <div className="w-px h-8 bg-white/30 mx-3"></div>
            
            {/* Switch Centers Button - System Style */}
            <button
              onClick={toggleDragMode}
              className={`flex flex-col items-center justify-center p-4 transition-colors group min-w-[100px] ${
                isDragMode
                  ? 'hover:text-yellow-200'
                  : 'hover:text-gray-200'
              }`}
            >
              <svg
                className={`w-8 h-8 mb-2 transition-colors ${
                  isDragMode
                    ? 'text-yellow-300 group-hover:text-yellow-200'
                    : 'text-white group-hover:text-gray-200'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
              <span className={`text-sm font-bold text-center leading-tight transition-colors ${
                isDragMode
                  ? 'text-yellow-300 group-hover:text-yellow-200'
                  : 'text-white group-hover:text-gray-200'
              }`}>
                {isDragMode ? 'إلغاء تبديل' : 'تبديل المراكز'}
              </span>
            </button>

            {/* Product Size Button - Only show in products mode */}
            {managementMode === 'products' && (
              <>
                <div className="w-px h-8 bg-white/30 mx-2"></div>

                <button
                  onClick={() => setIsProductSizeModalOpen(true)}
                  className="flex flex-col items-center justify-center p-4 transition-colors group min-w-[100px] hover:bg-white/10"
                >
                  <svg className="w-8 h-8 mb-2 text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="text-sm font-bold text-center leading-tight text-white transition-colors">
                    حجم المنتج
                  </span>
                </button>

                <div className="w-px h-8 bg-white/30 mx-2"></div>

                <button
                  onClick={() => setIsManageSizeGroupsModalOpen(true)}
                  className="flex flex-col items-center justify-center p-4 transition-colors group min-w-[100px] hover:bg-white/10"
                >
                  <svg className="w-8 h-8 mb-2 text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  <span className="text-sm font-bold text-center leading-tight text-white transition-colors">
                    فك الربط
                  </span>
                </button>

              </>
            )}

            {/* Category Management Buttons - Only show in categories mode */}
            {managementMode === 'categories' && (
              <>
                <div className="w-px h-8 bg-white/30 mx-2"></div>

                {/* Add Category Button */}
                <button
                  onClick={() => setIsAddCategoryModalOpen(true)}
                  className="flex flex-col items-center justify-center p-4 transition-colors group min-w-[100px] hover:bg-white/10"
                >
                  <svg className="w-8 h-8 mb-2 text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm font-bold text-center leading-tight text-white transition-colors">
                    إضافة فئة
                  </span>
                </button>

                <div className="w-px h-8 bg-white/30 mx-1"></div>

                {/* Edit Category Button */}
                <button
                  onClick={handleEditCategory}
                  disabled={!selectedCategoryId}
                  className={`flex flex-col items-center justify-center p-4 transition-colors group min-w-[100px] ${
                    selectedCategoryId
                      ? 'hover:bg-white/10 text-white'
                      : 'text-white/30 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-8 h-8 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="text-sm font-bold text-center leading-tight transition-colors">
                    تعديل فئة
                  </span>
                </button>

                <div className="w-px h-8 bg-white/30 mx-1"></div>

                {/* Delete Category Button */}
                <button
                  onClick={handleDeleteCategory}
                  disabled={!selectedCategoryId}
                  className={`flex flex-col items-center justify-center p-4 transition-colors group min-w-[100px] ${
                    selectedCategoryId
                      ? 'hover:bg-white/10 text-white'
                      : 'text-white/30 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-8 h-8 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="text-sm font-bold text-center leading-tight transition-colors">
                    حذف فئة
                  </span>
                </button>
              </>
            )}

            {/* Save Order Button - appears when in drag mode */}
            {isDragMode && (
              <>
                <div className="w-px h-8 bg-white/30 mx-2"></div>
                <button
                  onClick={saveAllChanges}
                  disabled={isSaving}
                  className="flex flex-col items-center justify-center p-4 transition-colors group min-w-[100px] hover:text-green-200"
                >
                  <svg className="w-8 h-8 mb-2 text-green-300 group-hover:text-green-200 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-bold text-center leading-tight text-green-300 group-hover:text-green-200 transition-colors">
                    {isSaving ? 'جاري الحفظ' : 'حفظ الترتيب'}
                  </span>
                </button>
              </>
            )}
          </div>
          
          {/* Center - Empty space */}
          <div></div>
          
          {/* Left side - Exit button */}
          <button
            onClick={() => router.back()}
            className="text-white hover:text-red-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content Container - Flex */}
      <div className="flex-1 flex min-h-0">
        {/* Save Changes Bar - Fixed at Bottom */}
        {hasUnsavedChanges && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-amber-50 border-t-2 border-amber-200 px-6 py-3" style={{marginRight: '320px'}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></div>
              <span className="text-amber-800 font-semibold">
                لديك تغييرات غير محفوظة
              </span>
              <span className="text-sm text-amber-600">
                احفظ التغييرات لتطبيقها على المتجر
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={discardChanges}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isSaving}
              >
                إلغاء التغييرات
              </button>
              <button
                onClick={saveAllChanges}
                disabled={isSaving}
                className="px-6 py-2 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--primary-color)'
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
                }}
                onMouseLeave={(e) => {
                  if (!isSaving) (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)';
                }}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    حفظ جميع التغييرات
                  </>
                )}
              </button>
            </div>
          </div>
          </div>
        )}

        {/* Sidebar - Fixed */}
        <div className="flex-shrink-0 w-80 bg-white border-l border-gray-300 flex flex-col">
          <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">لوحة التحكم</h2>
            
            
            {/* Management Mode Buttons */}
            <div className="space-y-3">
              <button 
                onClick={() => setManagementMode('products')}
                className={`w-full flex items-center justify-between px-4 py-3 text-right rounded-lg transition-colors ${
                  managementMode === 'products' 
                    ? 'bg-red-100 border-2 border-red-300' 
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <svg className={`w-5 h-5 ${managementMode === 'products' ? 'text-red-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className={`font-medium ${managementMode === 'products' ? 'text-red-600' : 'text-gray-700'}`}>إدارة المنتجات</span>
              </button>
              
              <button
                onClick={() => setManagementMode('categories')}
                className={`w-full flex items-center justify-between px-4 py-3 text-right rounded-lg transition-colors ${
                  managementMode === 'categories'
                    ? 'bg-red-100 border-2 border-red-300'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <svg className={`w-5 h-5 ${managementMode === 'categories' ? 'text-red-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className={`font-medium ${managementMode === 'categories' ? 'text-red-600' : 'text-gray-700'}`}>إدارة الفئات</span>
              </button>

              <button
                onClick={() => router.push('/admin/products/store-design')}
                className="w-full flex items-center justify-between px-4 py-3 text-right rounded-lg transition-colors bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 border-2 border-purple-200"
              >
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                <span className="font-medium text-purple-600">تصميم المتجر</span>
              </button>

            </div>
          </div>
          </div>
        </div>

        {/* Products Content - Scrollable Main Area */}
        <main className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
          {/* Search and View Controls Bar */}
          <div className="bg-white border border-gray-300 rounded-lg py-3 px-4 mb-6">
            <div className="flex items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={managementMode === 'products' ? 'البحث في المنتجات...' : 'البحث في الفئات...'}
                    className="w-full px-4 py-2 pr-10 text-right border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{
                      '--tw-ring-color': 'var(--primary-color)',
                      '--tw-ring-opacity': '0.5'
                    } as React.CSSProperties}
                    onFocus={(e) => {
                      e.target.style.boxShadow = '0 0 0 2px rgba(93, 31, 31, 0.5)';
                    }}
                    onBlur={(e) => {
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <svg 
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* View Mode Toggle Buttons */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 mr-3">وضع العرض:</span>
                
                {/* Grid View Button */}
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'grid'
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={viewMode === 'grid' ? { backgroundColor: 'var(--primary-color)' } : {}}
                  title="عرض الصور"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>

                {/* List View Button */}
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'list'
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={viewMode === 'list' ? { backgroundColor: 'var(--primary-color)' } : {}}
                  title="عرض الصفوف"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>

              {/* Search Results Count */}
              <div className="text-sm text-gray-500">
                {searchTerm && (
                  <span>
                    {managementMode === 'products' 
                      ? `${filteredProducts.length} من ${products.length} منتج`
                      : `${filteredCategories.length} من ${categories.length} فئة`
                    }
                  </span>
                )}
              </div>
            </div>
          </div>

          {managementMode === 'products' ? (
            <DragDropProvider>
              <ProductManagementGrid
                products={filteredProducts}
                isDragMode={isDragMode}
                onReorder={handleReorder}
                onToggleVisibility={toggleVisibility}
                onToggleFeatured={toggleFeatured}
                onUpdateSuggestedProducts={updateSuggestedProducts}
                selectedProductId={selectedProductId}
                onProductSelect={handleProductSelect}
              />
            </DragDropProvider>
          ) : (
            // Category Management Grid with Drag & Drop
            <DragDropProvider>
              <CategoryManagementGrid
                categories={filteredCategories}
                isDragMode={isDragMode}
                onReorder={handleCategoryReorder}
                onToggleVisibility={toggleCategoryVisibility}
                selectedCategoryId={selectedCategoryId}
                onCategorySelect={handleCategorySelect}
              />
            </DragDropProvider>
          )}
          </div>
        </main>
      </div>

      {/* Add Store Category Modal */}
      <AddStoreCategoryModal
        isOpen={isAddCategoryModalOpen}
        onClose={() => setIsAddCategoryModalOpen(false)}
        products={products}
        onCategoryCreated={() => {
          // Refresh data after category creation
          fetchStoreCategories();
          fetchProducts();
        }}
      />

      {/* Edit Store Category Modal */}
      <AddStoreCategoryModal
        isOpen={isEditCategoryModalOpen}
        onClose={() => {
          setIsEditCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        products={products}
        editingCategory={editingCategory}
        onCategoryCreated={() => {
          // Refresh data after category update
          fetchStoreCategories();
          fetchProducts();
          setIsEditCategoryModalOpen(false);
          setEditingCategory(null);
          setSelectedCategoryId(null);
        }}
      />

      {/* Product Size Modal */}
      <ProductSizeModal
        isOpen={isProductSizeModalOpen}
        onClose={() => setIsProductSizeModalOpen(false)}
        products={products}
        onSizeGroupCreated={() => {
          // Refresh data after product size group creation
          fetchProducts();
          setIsProductSizeModalOpen(false);
        }}
      />

      {/* Manage Size Groups Modal */}
      <ManageSizeGroupsModal
        isOpen={isManageSizeGroupsModalOpen}
        onClose={() => setIsManageSizeGroupsModalOpen(false)}
        onSizeGroupDeleted={() => {
          // Refresh data after size group deletion
          fetchProducts();
        }}
      />

    </div>
  );
}