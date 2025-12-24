'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useProducts, Product as DatabaseProduct } from '@/app/lib/hooks/useProducts';
import { UserInfo, Product } from './shared/types';
import AuthButtons from '@/app/components/auth/AuthButtons';
import RightSidebar from '@/app/components/layout/RightSidebar';
import { useRightSidebar } from '@/app/lib/hooks/useRightSidebar';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useStoreCategoriesWithProducts } from '@/lib/hooks/useStoreCategories';
import { useCustomSections } from '@/lib/hooks/useCustomSections';
import InteractiveProductCard from './InteractiveProductCard';
import CategoryCarousel from './CategoryCarousel';
import ProductDetailsModal from '@/app/components/ProductDetailsModal';
import CartModal from '@/app/components/CartModal';
import SearchOverlay from './SearchOverlay';
import QuantityModal from './QuantityModal';
import { useCart } from '@/lib/contexts/CartContext';
import { useCartBadge } from '@/lib/hooks/useCartBadge';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { useProductDisplaySettings } from '@/lib/hooks/useProductDisplaySettings';
import { useStoreTheme } from '@/lib/hooks/useStoreTheme';
import { useStoreBackHandler } from '@/lib/hooks/useBackButton';

interface TabletHomeProps {
  userInfo: UserInfo;
  onCartUpdate: (cart: any[]) => void;
  onRemoveFromCart: (productId: string | number) => void;
  onUpdateQuantity: (productId: string | number, quantity: number) => void;
  onClearCart: () => void;
}

export default function TabletHome({ 
  userInfo, 
  onCartUpdate, 
  onRemoveFromCart, 
  onUpdateQuantity, 
  onClearCart 
}: TabletHomeProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [isCompactHeaderVisible, setIsCompactHeaderVisible] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [websiteProducts, setWebsiteProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  // Use right sidebar hook for the website menu
  const { isRightSidebarOpen, toggleRightSidebar, closeRightSidebar } = useRightSidebar();
  
  // Get user profile to check admin status
  const { isAdmin } = useUserProfile();

  // Get company settings
  const { companyName, logoUrl, logoShape, socialMedia, isLoading: isCompanyLoading } = useCompanySettings();

  // Get product display settings
  const { settings: displaySettings } = useProductDisplaySettings();

  // Get store theme colors
  const { primaryColor, primaryHoverColor, interactiveColor, isLoading: isThemeLoading } = useStoreTheme();

  // Get logo rounding class based on shape
  const logoRoundingClass = logoShape === 'circle' ? 'rounded-full' : 'rounded-lg';

  // Get cart badge count and cart functions
  const { cartBadgeCount } = useCartBadge();
  const { addToCart } = useCart();

  // Get store categories with their products
  const { categoriesWithProducts, isLoading: isCategoriesLoading } = useStoreCategoriesWithProducts();

  // Get custom sections with products
  const { sections: customSections, isLoading: isSectionsLoading, fetchSectionsWithProducts } = useCustomSections();
  const [sectionsWithProducts, setSectionsWithProducts] = useState<any[]>([]);
  const [isSectionsReady, setIsSectionsReady] = useState(false);
  const [rawSectionsData, setRawSectionsData] = useState<any[]>([]);

  // Add state for success message
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successProductName, setSuccessProductName] = useState('');

  // Handle adding products to cart - now opens quantity modal
  const handleAddToCart = async (product: Product) => {
    setSelectedProduct(product);
    setIsQuantityModalOpen(true);
  };

  // Handle quantity confirmation
  const handleQuantityConfirm = async (quantity: number) => {
    if (!selectedProduct) return;

    try {
      console.log('🛒 Tablet: Adding product to cart:', selectedProduct.name, 'Quantity:', quantity, 'Note:', selectedProduct.note);
      const selectedColorName = selectedProduct.selectedColor?.name || undefined;
      const selectedShapeName = selectedProduct.selectedShape?.name || undefined;
      const productNote = selectedProduct.note || undefined;
      await addToCart(String(selectedProduct.id), quantity, selectedProduct.price, selectedColorName, selectedShapeName, undefined, productNote);
      console.log('✅ Tablet: Product added successfully');

      // Show success message
      setSuccessProductName(selectedProduct.name);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } catch (error) {
      console.error('❌ Tablet: Error adding product to cart:', error);
    }
  };
  
  
  // Get real products from database
  const { products: databaseProducts, isLoading } = useProducts();

  // Convert database products to website format with colors
  useEffect(() => {
    const fetchProductsWithColors = async () => {
      try {
        if (databaseProducts && databaseProducts.length > 0) {
          // First, fetch all product color & shape definitions
          const { supabase } = await import('../../app/lib/supabase/client');
          const { data: variants, error: variantsError } = await supabase
            .from('product_color_shape_definitions')
            .select('*')
            .in('variant_type', ['color', 'shape'])
            .order('sort_order', { ascending: true });

          if (variantsError) {
            console.error('Error fetching product color/shape definitions:', variantsError);
          }

          // Fetch size groups with their items
          const { data: sizeGroups, error: sizeGroupsError } = await supabase
            .from('product_size_groups')
            .select(`
              *,
              product_size_group_items (
                *,
                products (
                  id,
                  name,
                  main_image_url,
                  price,
                  description
                )
              )
            `)
            .eq('is_active', true);

          if (sizeGroupsError) {
            console.error('Error fetching size groups:', sizeGroupsError);
          }

          // Create a map of products that are part of size groups
          const productsInSizeGroups = new Map();
          sizeGroups?.forEach(group => {
            if (group.product_size_group_items && group.product_size_group_items.length > 0) {
              // Use the first item as the representative for the group
              const representative = group.product_size_group_items[0];
              if (representative.products) {
                productsInSizeGroups.set(representative.products.id, {
                  sizeGroup: group,
                  sizes: group.product_size_group_items.map((item: any) => ({
                    id: item.product_id,
                    name: item.size_name,
                    product: item.products
                  }))
                });
              }
            }
          });

          // Create a set of product IDs that should be hidden (all except representatives)
          const hiddenProductIds = new Set();
          sizeGroups?.forEach(group => {
            if (group.product_size_group_items && group.product_size_group_items.length > 1) {
              // Hide all products except the first one (representative)
              group.product_size_group_items.slice(1).forEach((item: any) => {
                hiddenProductIds.add(item.product_id);
              });
            }
          });

          const convertedProducts: Product[] = databaseProducts
            .filter((dbProduct: DatabaseProduct) => {
              // Always hide hidden products and duplicate products in size groups
              if (dbProduct.is_hidden || hiddenProductIds.has(dbProduct.id)) {
                return false;
              }

              // Apply display mode filter
              if (displaySettings.display_mode === 'show_with_stock') {
                // Only show products with stock > 0
                const totalStock = (dbProduct as any).totalQuantity || dbProduct.stock || 0;
                return totalStock > 0;
              } else if (displaySettings.display_mode === 'show_with_stock_and_vote') {
                // Show all products (voting feature to be implemented later)
                return true;
              }

              // Default: show all products
              return true;
            })
            .map((dbProduct: DatabaseProduct) => {
              // Calculate if product has discount
              const hasDiscount = dbProduct.discount_percentage && dbProduct.discount_percentage > 0;
              const finalPrice = hasDiscount 
                ? Number(dbProduct.price) * (1 - Number(dbProduct.discount_percentage) / 100)
                : Number(dbProduct.price);
              
              // Get colors for this product
              const productColors = variants?.filter(v => v.product_id === dbProduct.id && v.variant_type === 'color') || [];
              const colors = productColors.map((variant: any) => ({
                id: variant.id,
                name: variant.color_name || variant.name || 'لون غير محدد',
                hex: variant.color_hex || '#000000',
                image_url: variant.image_url || null
              }));

              // Get shapes for this product
              const productShapes = variants?.filter(v => v.product_id === dbProduct.id && v.variant_type === 'shape') || [];
              const shapes = productShapes.map((variant: any) => ({
                id: variant.id,
                name: variant.name || 'شكل غير محدد',
                image_url: variant.image_url || null
              }));

              // Get sizes for this product (if it's part of a size group)
              const sizeGroupInfo = productsInSizeGroups.get(dbProduct.id);
              const sizes = sizeGroupInfo ? sizeGroupInfo.sizes : [];
              
              return {
                id: dbProduct.id,
                name: dbProduct.name || 'منتج بدون اسم',
                description: dbProduct.description || '',
                price: finalPrice,
                wholesale_price: Number(dbProduct.wholesale_price) || undefined,
                originalPrice: hasDiscount ? Number(dbProduct.price) : undefined,
                image: dbProduct.main_image_url || undefined,
                images: dbProduct.allImages || [], // Use allImages from useProducts hook
                colors: colors, // Real colors from product variants
                shapes: shapes, // Real shapes from product variants
                sizes: sizes,
                category: dbProduct.category?.name || 'عام',
                brand: companyName,
                stock: dbProduct.stock || 0,
                totalQuantity: (dbProduct as any).totalQuantity || dbProduct.stock || 0,
                rating: Number(dbProduct.rating) || 0,
                reviews: dbProduct.rating_count || 0,
                isOnSale: hasDiscount || false,
                discount: hasDiscount && dbProduct.discount_percentage ? Math.round(Number(dbProduct.discount_percentage)) : undefined,
                tags: [],
                isFeatured: dbProduct.is_featured || false
              };
            });
          setWebsiteProducts(convertedProducts);
        }
      } catch (error) {
        console.error('Error converting database products:', error);
        setWebsiteProducts([]);
      }
    };

    fetchProductsWithColors();
  }, [databaseProducts]);

  // Load raw sections data immediately on mount
  useEffect(() => {
    let isMounted = true;

    const loadRawSections = async () => {
      try {
        const sections = await fetchSectionsWithProducts();
        if (isMounted) {
          setRawSectionsData(sections);
        }
      } catch (error) {
        console.error('Error loading custom sections:', error);
      }
    };

    loadRawSections();

    return () => {
      isMounted = false;
    };
  }, [fetchSectionsWithProducts]);

  // Convert sections when website products are ready
  useEffect(() => {
    if (!rawSectionsData || rawSectionsData.length === 0) {
      setSectionsWithProducts([]);
      setIsSectionsReady(true);
      return;
    }

    if (!websiteProducts || websiteProducts.length === 0) {
      // Show sections with raw product data if website products aren't ready yet
      const quickSections = rawSectionsData
        .filter((section: any) => section.is_active && section.productDetails && section.productDetails.length > 0)
        .map((section: any) => ({
          ...section,
          products: section.productDetails.map((product: any) => ({
            id: product.id,
            name: product.name,
            description: product.description || '',
            price: product.finalPrice || product.price,
            originalPrice: product.hasDiscount ? product.price : undefined,
            image: product.main_image_url,
            images: [product.main_image_url, product.sub_image_url].filter(Boolean),
            category: 'عام',
            colors: [],
            shapes: [],
            sizes: [],
            brand: companyName,
            stock: 0,
            rating: product.rating || 0,
            reviews: product.rating_count || 0,
            isOnSale: product.hasDiscount || false,
            discount: product.discount_percentage ? Math.round(product.discount_percentage) : undefined,
            tags: [],
            isFeatured: false
          }))
        }));

      requestAnimationFrame(() => {
        setSectionsWithProducts(quickSections);
        setIsSectionsReady(true);
      });
      return;
    }

    // Full conversion with website products
    const activeSections = rawSectionsData
      .filter((section: any) => section.is_active && section.productDetails && section.productDetails.length > 0);

    const sectionsWithConvertedProducts = activeSections.map((section: any) => {
      const convertedProducts = section.productDetails.map((product: any) => {
        const dbProduct = websiteProducts.find(wp => wp.id === product.id);
        return dbProduct || {
          id: product.id,
          name: product.name,
          description: product.description || '',
          price: product.finalPrice || product.price,
          originalPrice: product.hasDiscount ? product.price : undefined,
          image: product.main_image_url,
          images: [product.main_image_url, product.sub_image_url].filter(Boolean),
          category: 'عام',
          colors: [],
          shapes: [],
          sizes: [],
          brand: companyName,
          stock: 0,
          rating: product.rating || 0,
          reviews: product.rating_count || 0,
          isOnSale: product.hasDiscount || false,
          discount: product.discount_percentage ? Math.round(product.discount_percentage) : undefined,
          tags: [],
          isFeatured: false
        };
      });

      return {
        ...section,
        products: convertedProducts
      };
    });

    requestAnimationFrame(() => {
      setSectionsWithProducts(sectionsWithConvertedProducts);
      setIsSectionsReady(true);
    });
  }, [rawSectionsData, websiteProducts]);

  // Convert store categories to website format
  useEffect(() => {
    if (categoriesWithProducts && categoriesWithProducts.length > 0) {
      const convertedCategories = categoriesWithProducts.map((storeCategory: any) => ({
        id: storeCategory.id,
        name: storeCategory.name,
        description: storeCategory.description || storeCategory.name,
        icon: '📦',
        image: storeCategory.image_url || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop',
        productCount: storeCategory.products?.length || 0
      }));

      setCategories(convertedCategories);
    } else {
      setCategories([]);
    }
  }, [categoriesWithProducts]);

  // Set client-side flag after component mounts
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Set CSS variables for colors
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--primary-color', primaryColor);
      document.documentElement.style.setProperty('--primary-hover-color', primaryHoverColor);
      document.documentElement.style.setProperty('--interactive-color', interactiveColor);
    }
  }, [primaryColor, primaryHoverColor, interactiveColor]);

  // Handle scroll for compact header
  useEffect(() => {
    if (!isClient) return;
    
    const handleScroll = () => {
      setIsCompactHeaderVisible(window.scrollY > 120);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isClient]);

  const filteredProducts = React.useMemo(() => {
    let productsToFilter = websiteProducts;

    // If a specific store category is selected, get products from that category
    if (selectedCategory !== 'الكل' && categoriesWithProducts.length > 0) {
      const selectedStoreCategory = categoriesWithProducts.find((cat: any) => cat.name === selectedCategory);
      if (selectedStoreCategory && selectedStoreCategory.products) {
        // Convert store category products to website product format
        productsToFilter = selectedStoreCategory.products.map((product: any) => {
          const dbProduct = websiteProducts.find(wp => wp.id === product.id);
          return dbProduct || {
            id: product.id,
            name: product.name,
            description: '',
            price: product.price,
            image: product.main_image_url,
            category: selectedCategory,
            colors: [],
            brand: companyName,
            stock: 0,
            rating: 0,
            reviews: 0,
            isOnSale: false,
            tags: [],
            isFeatured: false
          };
        });
      } else {
        // No products in this store category
        productsToFilter = [];
      }
    }

    // Apply search filter
    return productsToFilter.filter(product => {
      const matchesSearch = searchQuery === '' ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesSearch;
    });
  }, [websiteProducts, selectedCategory, searchQuery, categoriesWithProducts]);

  const featuredProducts = websiteProducts.filter(product => product.isFeatured || product.isOnSale);

  // Handle product click to show modal instead of navigation
  const handleProductClick = (productId: string) => {
    setSelectedProductId(productId);
    setIsProductModalOpen(true);
  };

  const handleCloseProductModal = () => {
    setIsProductModalOpen(false);
    setSelectedProductId('');
  };

  // Back button handler - manages browser back button behavior
  // This keeps users on the store page and closes modals on back press
  const modalsConfig = useMemo(() => [
    {
      id: 'product-details',
      isOpen: isProductModalOpen,
      onClose: () => {
        setIsProductModalOpen(false);
        setSelectedProductId('');
      }
    },
    {
      id: 'cart',
      isOpen: isCartModalOpen,
      onClose: () => setIsCartModalOpen(false)
    },
    {
      id: 'quantity',
      isOpen: isQuantityModalOpen,
      onClose: () => {
        setIsQuantityModalOpen(false);
        setSelectedProduct(null);
      }
    },
    {
      id: 'search',
      isOpen: isSearchOverlayOpen,
      onClose: () => setIsSearchOverlayOpen(false)
    },
    {
      id: 'sidebar',
      isOpen: isRightSidebarOpen,
      onClose: closeRightSidebar
    }
  ], [isProductModalOpen, isCartModalOpen, isQuantityModalOpen, isSearchOverlayOpen, isRightSidebarOpen, closeRightSidebar]);

  // Initialize back button handler for store
  useStoreBackHandler(modalsConfig);

  // Show loading state during hydration or while loading data
  if (!isClient || isLoading || isThemeLoading || isCompanyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: '#c0c0c0'}}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل التطبيق...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    {/* Right Sidebar for Website Menu */}
    <RightSidebar isOpen={isRightSidebarOpen} onClose={closeRightSidebar} />
    
    <div className="min-h-screen text-gray-800" style={{backgroundColor: '#c0c0c0'}}>
      {/* Hide system blue header */}
      <style jsx global>{`
        body {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        html {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        /* Hide any potential system headers - but exclude auth-related elements */
        .system-header:not([class*="auth"]):not([id*="auth"]):not([data-auth]),
        [class*="system"]:not([class*="auth"]):not([id*="auth"]):not([data-auth]),
        [class*="navigation"]:not([class*="auth"]):not([id*="auth"]):not([data-auth]),
        [style*="background: #374151"]:not([class*="auth"]):not([id*="auth"]):not([data-auth]),
        [style*="background-color: #374151"]:not([class*="auth"]):not([id*="auth"]):not([data-auth]) {
          display: none !important;
        }
        /* Ensure auth-related iframes and popups are visible */
        iframe[src*="google"],
        iframe[src*="auth"],
        iframe[id*="auth"],
        [class*="auth"],
        [id*="auth"],
        [data-auth] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `}</style>
      
      {/* Compact Sticky Header */}
      {isCompactHeaderVisible && (
        <header className="fixed top-0 left-0 right-0 border-b border-gray-700 py-2 z-50 transition-all duration-300" style={{backgroundColor: 'var(--primary-color)'}}>
          <div className="relative flex items-center min-h-[55px]">
            {/* Reserve space for menu button on the right */}
            <div className="flex items-center w-full pr-14">
              {/* Main Compact Content Container - New Layout */}
              <div className="w-full px-4 flex items-center min-h-[55px]">
                
                {/* Logo and Title - Left Side */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className={`h-12 w-12 ${logoRoundingClass} overflow-hidden bg-transparent flex items-center justify-center`}>
                    <img src={logoUrl || '/assets/logo/Hegazy.png'} alt={companyName} className="h-full w-full object-cover" />
                  </div>
                  <h1 className="text-lg font-bold text-white">{companyName}</h1>
                </div>
              
                {/* Search Bar - Expanded Width */}
                <div className="flex-1 max-w-xl mx-6">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="ابحث عن المنتجات..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border-0 rounded-full px-5 py-2.5 pr-12 text-sm text-gray-800 placeholder-gray-500 shadow-md focus:outline-none focus:ring-1 transition-all duration-300"
                      style={{"--tw-ring-color": "var(--primary-color)"} as React.CSSProperties}
                      onFocus={(e) => {
                        e.target.style.boxShadow = '0 0 0 1px var(--primary-color)';
                      }}
                      onBlur={(e) => {
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    <button
                      onClick={() => setIsSearchOverlayOpen(true)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-[var(--interactive-color)] transition-colors"
                      title="فتح البحث المتقدم"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Right Side: Cart + User Image */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  
                  {/* Cart Button */}
                  <button 
                    onClick={() => setIsCartModalOpen(true)}
                    className="relative p-2 rounded-lg transition-colors text-white bg-white bg-opacity-10 hover:bg-opacity-20"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6H19" />
                    </svg>
                    {cartBadgeCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold" style={{color: 'var(--primary-color)'}}>
                        {cartBadgeCount}
                      </span>
                    )}
                  </button>
                  
                  {/* User Profile Image Only - No Text */}
                  <div className="flex items-center">
                    <AuthButtons imageOnly compact />
                  </div>
                  
                </div>
              </div>
            </div>
            
            {/* Compact Menu Button - Absolute Right Edge, Full Height */}
            <div className="absolute right-0 top-0 h-full">
              <button 
                className="h-full px-3 text-white bg-transparent flex items-center justify-center hover:bg-black hover:bg-opacity-20 transition-colors"
                onClick={toggleRightSidebar}
                title="القائمة"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Tablet Header */}
      <header className="fixed top-0 left-0 right-0 border-b border-gray-700 py-0 z-40" style={{backgroundColor: 'var(--primary-color)'}}>
        <div className="relative flex items-center min-h-[75px]">
          {/* Reserve space for menu button on the right */}
          <div className="flex items-center w-full pr-16">
            {/* Main Content Container - New Layout */}
            <div className="w-full px-4 flex items-center min-h-[75px]">
              
              {/* Logo and Title - Left Side */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className={`h-16 w-16 ${logoRoundingClass} overflow-hidden bg-transparent flex items-center justify-center`}>
                  <img src={logoUrl || '/assets/logo/Hegazy.png'} alt={companyName} className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-lg font-bold text-white leading-tight">{companyName}</h1>
                </div>
              </div>
            
              {/* Search Bar - Expanded Width */}
              <div className="flex-1 max-w-2xl mx-6">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ابحث عن المنتجات..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border-0 rounded-full px-6 py-3 pr-14 text-gray-800 placeholder-gray-500 shadow-lg focus:outline-none focus:ring-2 transition-all duration-300"
                    style={{"--tw-ring-color": "var(--primary-color)"} as React.CSSProperties}
                    onFocus={(e) => {
                      e.target.style.boxShadow = '0 0 0 2px var(--primary-color)';
                    }}
                    onBlur={(e) => {
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    onClick={() => setIsSearchOverlayOpen(true)}
                    className="absolute right-5 top-1/2 transform -translate-y-1/2 p-1.5 text-gray-400 hover:text-[var(--interactive-color)] transition-colors"
                    title="فتح البحث المتقدم"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Right Side: Cart + User Image */}
              <div className="flex items-center gap-4 flex-shrink-0">
                
                {/* Cart Button */}
                <button 
                  onClick={() => setIsCartModalOpen(true)}
                  className="relative p-2.5 rounded-lg transition-colors text-white bg-white bg-opacity-10 hover:bg-opacity-20"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6H19" />
                  </svg>
                  {cartBadgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold" style={{color: 'var(--primary-color)'}}>
                      {cartBadgeCount}
                    </span>
                  )}
                </button>
                
                {/* User Profile Image Only - No Text */}
                <div className="flex items-center">
                  <AuthButtons imageOnly />
                </div>
                
              </div>
            </div>
          </div>
          
          {/* Menu Button - Absolute Right Edge, Full Height */}
          <div className="absolute right-0 top-0 h-full">
            <button 
              className="h-full px-4 text-white bg-transparent flex items-center justify-center hover:bg-black hover:bg-opacity-20 transition-colors"
              onClick={toggleRightSidebar}
              title="القائمة"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Tablet Main Content */}
      <main className="max-w-[96%] mx-auto px-3 py-7" style={{ marginTop: '75px' }}>

        {/* Custom Sections (Dynamic) - Show at the top, before categories */}
        {isSectionsReady && selectedCategory === 'الكل' && !searchQuery && sectionsWithProducts.length > 0 && (
          <>
            {sectionsWithProducts.map((section: any) => (
              section.products && section.products.length > 0 && (
                <section key={section.id} className="mb-7">
                  <h3 className="text-3xl font-bold mb-5 text-black">{section.name}</h3>
                  <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
                    {section.products.map((product: any) => (
                      <div key={product.id} className="flex-shrink-0 w-64">
                        <InteractiveProductCard
                          product={product}
                          onAddToCart={handleAddToCart}
                          deviceType="tablet"
                          onProductClick={handleProductClick}
                          displaySettings={displaySettings}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )
            ))}
          </>
        )}

        {/* Categories Section - Hide when searching or when no categories */}
        {!searchQuery && categories && categories.length > 0 && (
          <section id="categories" className="mb-7">
            <h3 className="text-3xl font-bold mb-5 text-black">فئات المنتجات</h3>
            <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
              {categories.slice(0, 8).map((category) => (
                <div
                  key={category.id}
                  className="bg-white rounded-lg text-center hover:shadow-lg transition-all duration-200 border border-gray-200 group flex-shrink-0 w-48 overflow-hidden"
                  onClick={() => setSelectedCategory(category.name)}
                  style={{ height: '200px' }} // زيادة الارتفاع أكثر للجهاز اللوحي
                >
                  <div className="h-full flex flex-col">
                    {/* الصورة تملأ معظم المكون */}
                    <div className="flex-1 overflow-hidden">
                      <img
                        src={category.image}
                        alt={category.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    {/* منطقة صغيرة للنص في الأسفل */}
                    <div className="bg-white p-3 border-t border-gray-100">
                      <h4 className="font-semibold text-sm text-gray-800 group-hover:text-[var(--interactive-color)] transition-colors truncate">{category.name}</h4>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All Products */}
        <section id="products" className="mb-7">
          <h3 className="text-3xl font-bold mb-5 text-black">
            {selectedCategory === 'الكل' ? 'جميع المنتجات' : selectedCategory}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <InteractiveProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
                deviceType="tablet"
                onProductClick={handleProductClick}
                displaySettings={displaySettings}
              />
            ))}
          </div>
          
        </section>
      </main>
    </div>

      {/* Tablet Footer */}
      <footer className="py-7 mt-0 w-full" style={{backgroundColor: '#4D4D4D', borderTop: '1px solid #666'}}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={logoUrl || '/assets/logo/Hegazy.png'} alt={companyName} className="h-7 w-7 object-contain" />
                <h5 className="font-bold text-lg text-white">{companyName}</h5>
              </div>
              <p className="text-gray-400 mb-4">متجرك المتكامل للحصول على أفضل المنتجات بأسعار مميزة وجودة عالية</p>
              <div className="space-y-2 text-gray-400">
                <p>📞 966+123456789</p>
                <p>✉️ info@hegazy-store.com</p>
                <p>📍 الرياض، المملكة العربية السعودية</p>
              </div>
            </div>
            <div>
              <h6 className="font-semibold mb-3">تابعنا علي</h6>
              <ul className="space-y-2 text-gray-400">
                {socialMedia && socialMedia.length > 0 && socialMedia.some(sm => sm.platform && sm.link) ? (
                  socialMedia
                    .filter(sm => sm.platform && sm.link)
                    .map((sm, index) => (
                      <li key={index}>
                        <a
                          href={sm.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="transition-colors hover:text-[var(--primary-color)] flex items-center gap-2"
                        >
                          {sm.platform}
                        </a>
                      </li>
                    ))
                ) : (
                  <li className="text-gray-500">لا توجد روابط متاحة</li>
                )}
              </ul>
            </div>
            <div>
              <h6 className="font-semibold mb-3">خدمة العملاء</h6>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="transition-colors hover:text-[var(--primary-color)]">المساعدة</a></li>
                <li><a href="#" className="transition-colors hover:text-[var(--primary-color)]">سياسة الإرجاع</a></li>
                <li><a href="#" className="transition-colors hover:text-[var(--primary-color)]">الشحن والتوصيل</a></li>
                <li><a href="#" className="transition-colors hover:text-[var(--primary-color)]">الدفع</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>

      {/* Product Details Modal */}
      <ProductDetailsModal
        isOpen={isProductModalOpen}
        onClose={handleCloseProductModal}
        productId={selectedProductId}
      />

      {/* Cart Modal */}
      <CartModal
        isOpen={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
      />

      {/* Search Overlay */}
      <SearchOverlay
        isOpen={isSearchOverlayOpen}
        onClose={() => setIsSearchOverlayOpen(false)}
        products={websiteProducts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onProductSelect={(product) => {
          setSelectedProductId(String(product.id));
          setIsProductModalOpen(true);
        }}
      />

      {/* Success Message Toast */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white p-4 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>تم إضافة &quot;{successProductName}&quot; إلى السلة بنجاح!</span>
          </div>
        </div>
      )}

      {/* Quantity Modal */}
      <QuantityModal
        isOpen={isQuantityModalOpen}
        onClose={() => {
          setIsQuantityModalOpen(false);
          setSelectedProduct(null);
        }}
        onConfirm={handleQuantityConfirm}
        productName={selectedProduct?.name}
      />
    </>
  );
}