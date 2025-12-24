'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProducts, Product as DatabaseProduct } from '@/app/lib/hooks/useProducts';
import { UserInfo, Product } from './shared/types';
import AuthButtons from '@/app/components/auth/AuthButtons';
import RightSidebar from '@/app/components/layout/RightSidebar';
import { useRightSidebar } from '@/app/lib/hooks/useRightSidebar';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useStoreCategoriesWithProducts } from '@/lib/hooks/useStoreCategories';
import { useCustomSections } from '@/lib/hooks/useCustomSections';
import CategoryCarousel from './CategoryCarousel';
import CustomSectionCarousel from './CustomSectionCarousel';
import InteractiveProductCard from './InteractiveProductCard';
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

interface DesktopHomeProps {
  userInfo: UserInfo;
  onCartUpdate: (cart: any[]) => void;
  onRemoveFromCart: (productId: string | number) => void;
  onUpdateQuantity: (productId: string | number, quantity: number) => void;
  onClearCart: () => void;
}

export default function DesktopHome({ 
  userInfo, 
  onCartUpdate, 
  onRemoveFromCart, 
  onUpdateQuantity, 
  onClearCart 
}: DesktopHomeProps) {
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
  
  // Use right sidebar hook for the website menu
  const { isRightSidebarOpen, toggleRightSidebar, closeRightSidebar } = useRightSidebar();
  const [websiteProducts, setWebsiteProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  // Get user profile to check admin status
  const { isAdmin } = useUserProfile();

  // Get company settings
  const { companyName, logoUrl, logoShape, socialMedia, isLoading: isCompanyLoading } = useCompanySettings();

  // Get cart badge count and cart functions
  const { cartBadgeCount } = useCartBadge();
  const { addToCart } = useCart();

  // Get product display settings
  const { settings: displaySettings } = useProductDisplaySettings();

  // Get store theme colors
  const { primaryColor, primaryHoverColor, interactiveColor, isLoading: isThemeLoading } = useStoreTheme();

  // Get logo rounding class based on shape
  const logoRoundingClass = logoShape === 'circle' ? 'rounded-full' : 'rounded-lg';

  // Get store categories with their products
  const { categoriesWithProducts, isLoading: isCategoriesLoading } = useStoreCategoriesWithProducts();

  // Get custom sections with products
  const { sections: customSections, isLoading: isSectionsLoading, fetchSectionsWithProducts } = useCustomSections();
  const [sectionsWithProducts, setSectionsWithProducts] = useState<any[]>([]);
  const [isSectionsReady, setIsSectionsReady] = useState(false);
  const [rawSectionsData, setRawSectionsData] = useState<any[]>([]);
  
  // Handle adding products to cart - now opens quantity modal
  const handleAddToCart = async (product: Product) => {
    setSelectedProduct(product);
    setIsQuantityModalOpen(true);
  };

  // Handle quantity confirmation
  const handleQuantityConfirm = async (quantity: number) => {
    if (!selectedProduct) return;

    try {
      console.log('🛒 Desktop: Adding product to cart:', selectedProduct.name, 'Quantity:', quantity, 'Note:', selectedProduct.note);
      const selectedColorName = selectedProduct.selectedColor?.name || undefined;
      const selectedShapeName = selectedProduct.selectedShape?.name || undefined;
      const productNote = selectedProduct.note || undefined;
      await addToCart(String(selectedProduct.id), quantity, selectedProduct.price, selectedColorName, selectedShapeName, undefined, productNote);
      console.log('✅ Desktop: Product added successfully');
    } catch (error) {
      console.error('❌ Desktop: Error adding product to cart:', error);
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

              // Use allImages from useProducts hook which includes variant images
              const productImages = dbProduct.allImages || [];


              return {
                id: dbProduct.id,
                name: dbProduct.name || 'منتج بدون اسم',
                description: dbProduct.description || '',
                price: finalPrice,
                wholesale_price: Number(dbProduct.wholesale_price) || undefined,
                originalPrice: hasDiscount ? Number(dbProduct.price) : undefined,
                image: dbProduct.main_image_url || undefined,
                images: productImages, // Include both main and sub images
                colors: colors, // Real colors from product variants
                shapes: shapes, // Real shapes from product variants
                sizes: sizes, // Real sizes from size groups
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
        } else {
          setWebsiteProducts([]);
        }
      } catch (error) {
        console.error('Error converting database products:', error);
        setWebsiteProducts([]);
      }
    };

    fetchProductsWithColors();
  }, [databaseProducts]);

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

  // Handle scroll for compact header
  useEffect(() => {
    if (!isClient) return;
    
    const handleScroll = () => {
      setIsCompactHeaderVisible(window.scrollY > 100);
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
        /* Hide any potential system headers */
        iframe,
        .system-header,
        [class*="system"],
        [class*="navigation"],
        [style*="background: #374151"],
        [style*="background-color: #374151"] {
          display: none !important;
        }
      `}</style>
      {/* Compact Sticky Header */}
      {isCompactHeaderVisible && (
        <header className="fixed top-0 left-0 right-0 border-b border-gray-700 py-2 z-50 transition-all duration-300" style={{backgroundColor: 'var(--primary-color)'}}>
          <div className="relative flex items-center min-h-[50px]">
            {/* Main Compact Content Container */}
            <div className="max-w-[90%] mx-auto px-4 flex items-center justify-between w-full min-h-[50px]">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 ${logoRoundingClass} overflow-hidden bg-transparent flex items-center justify-center`}>
                  <img src={logoUrl || '/assets/logo/Hegazy.png'} alt={companyName} className="h-full w-full object-cover" />
                </div>
                <h1 className="text-base font-bold text-white">{companyName}</h1>
              </div>
            
            {/* Compact Search Bar */}
            <div className="flex-1 max-w-xs mx-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث عن المنتجات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border-0 rounded-full px-4 py-1.5 pr-8 text-sm text-gray-800 placeholder-gray-500 shadow-sm focus:outline-none focus:ring-1"
                  style={{"--tw-ring-color": "var(--primary-color)"} as React.CSSProperties}
                  onFocus={(e) => {
                    e.target.style.boxShadow = '0 0 0 1px var(--primary-color)';
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            {/* Compact Navigation Links */}
            <nav className="hidden md:flex gap-4">
              <a href="#about" className="text-gray-300 hover:text-white transition-colors text-sm">عن المتجر</a>
              <a href="#offers" className="text-gray-300 hover:text-white transition-colors text-sm">العروض</a>
              <a href="#categories" className="text-gray-300 hover:text-white transition-colors text-sm">الفئات</a>
              <a href="#products" className="text-gray-300 hover:text-white transition-colors text-sm">المنتجات</a>
            </nav>
            
            {/* Compact Auth & Cart & Dashboard with better spacing */}
            <div className="flex items-center gap-4">
              <div className="mr-2">
                <AuthButtons compact />
              </div>
              
              
              <div className="ml-1">
                <button 
                  onClick={() => setIsCartModalOpen(true)}
                  className="relative p-2 rounded-lg transition-colors"
                  onMouseEnter={(e) => {
                    (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6H19" />
                  </svg>
                  {cartBadgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold" style={{color: 'var(--primary-color)'}}>
                      {cartBadgeCount}
                    </span>
                  )}
                </button>
              </div>
              </div>
            </div>
            
            {/* Compact Menu Button - Absolute Right Edge, Full Height */}
            <div className="absolute right-0 top-0 h-full">
              <button 
                className="h-full px-4 text-white bg-transparent flex items-center justify-center"
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
      )}

      {/* Main Desktop Header */}
      <header className="border-b border-gray-700 py-0 relative z-40" style={{backgroundColor: 'var(--primary-color)'}}>
        <div className="relative flex items-center min-h-[80px]">
          {/* Main Content Container */}
          <div className="max-w-[80%] mx-auto px-4 flex items-center justify-between min-h-[80px] w-full">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className={`h-20 w-20 ${logoRoundingClass} overflow-hidden bg-transparent flex items-center justify-center`}>
                  <img src={logoUrl || '/assets/logo/Hegazy.png'} alt={companyName} className="h-full w-full object-cover" />
                </div>
                <h1 className="text-xl font-bold text-white">{companyName}</h1>
              </div>
            </div>
          
          {/* Search Bar in Header */}
          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث عن المنتجات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border-0 rounded-full px-5 py-2.5 pr-12 text-gray-800 placeholder-gray-500 shadow-md focus:outline-none focus:ring-2 transition-all duration-300"
                style={{"--tw-ring-color": "var(--primary-color)"} as React.CSSProperties}
                onFocus={(e) => {
                  e.target.style.boxShadow = '0 0 0 2px var(--primary-color)';
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = 'none';
                }}
              />
              <svg className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="flex gap-6">
              <a href="#products" className="text-gray-300 transition-colors font-medium" style={{'--tw-hover-text-opacity': '1'} as React.CSSProperties} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-color)'} onMouseLeave={(e) => e.currentTarget.style.color = ''}>المنتجات</a>
              <a href="#categories" className="text-gray-300 transition-colors font-medium" onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-color)'} onMouseLeave={(e) => e.currentTarget.style.color = ''}>الفئات</a>
              <a href="#offers" className="text-gray-300 transition-colors font-medium" onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-color)'} onMouseLeave={(e) => e.currentTarget.style.color = ''}>العروض</a>
              <a href="#about" className="text-gray-300 transition-colors font-medium" onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-color)'} onMouseLeave={(e) => e.currentTarget.style.color = ''}>عن المتجر</a>
            </nav>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Authentication Buttons with margin */}
            <div className="mr-8">
              <AuthButtons />
            </div>
            
            
            {/* Cart Button pushed to the right */}
            <div className="ml-4">
              <button 
                onClick={() => setIsCartModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-white"
                style={{backgroundColor: 'var(--primary-color)'}}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)';
                }}
              >
                <span>السلة ({cartBadgeCount})</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6H19" />
                </svg>
              </button>
            </div>
            </div>
          </div>
          
          {/* Menu Button - Absolute Right Edge, Full Height */}
          <div className="absolute right-0 top-0 h-full">
            <button 
              className="h-full px-6 text-white bg-transparent flex items-center justify-center"
              onClick={toggleRightSidebar}
              title="القائمة"
            >
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Main Content */}
      <main className="max-w-[80%] mx-auto px-4 py-8">

        {/* Custom Sections - Only show when ready, no specific category is selected and no search query */}
        {isSectionsReady && selectedCategory === 'الكل' && !searchQuery && sectionsWithProducts.length > 0 && (
          <>
            {sectionsWithProducts.map((section: any) => (
              section.products && section.products.length > 0 && (
                <section key={section.id} className="mb-8">
                  <h3 className="text-3xl font-bold mb-6 text-black">{section.name}</h3>
                  <CustomSectionCarousel
                    sectionName={section.name}
                    products={section.products}
                    onAddToCart={handleAddToCart}
                    itemsPerView={4}
                    onProductClick={handleProductClick}
                  />
                </section>
              )
            ))}
          </>
        )}

        {/* Categories Section - Hide when searching or when no categories */}
        {!searchQuery && categories && categories.length > 0 && (
          <section id="categories" className="mb-8">
            <h3 className="text-3xl font-bold mb-6 text-black">فئات المنتجات</h3>
            <CategoryCarousel
              categories={categories}
              onCategorySelect={setSelectedCategory}
              itemsPerView={4}
            />
          </section>
        )}

        {/* All Products */}
        <section id="products" className="mb-8">
          <h3 className="text-3xl font-bold mb-6 text-black">
            {selectedCategory === 'الكل' ? 'جميع المنتجات' : selectedCategory}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredProducts.map((product) => (
              <InteractiveProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
                deviceType="desktop"
                onProductClick={handleProductClick}
                displaySettings={displaySettings}
              />
            ))}
          </div>
        </section>
      </main>
    </div>

      {/* Desktop Footer */}
      <footer className="py-8 mt-0 w-full" style={{backgroundColor: '#4D4D4D', borderTop: '1px solid #666'}}>
        <div className="max-w-6xl mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={logoUrl || '/assets/logo/Hegazy.png'} alt={companyName} className="h-8 w-8 object-contain" />
                <h5 className="font-bold text-lg text-white">{companyName}</h5>
              </div>
              <p className="text-gray-400">متجرك المتكامل للحصول على أفضل المنتجات بأسعار مميزة وجودة عالية</p>
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
                          className="transition-colors flex items-center gap-2"
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-color)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
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
                <li><a href="#" className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-color)'} onMouseLeave={(e) => e.currentTarget.style.color = ''}>المساعدة</a></li>
                <li><a href="#" className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-color)'} onMouseLeave={(e) => e.currentTarget.style.color = ''}>سياسة الإرجاع</a></li>
                <li><a href="#" className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-color)'} onMouseLeave={(e) => e.currentTarget.style.color = ''}>الشحن والتوصيل</a></li>
                <li><a href="#" className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-color)'} onMouseLeave={(e) => e.currentTarget.style.color = ''}>الدفع</a></li>
              </ul>
            </div>
            <div>
              <h6 className="font-semibold mb-3">تواصل معنا</h6>
              <div className="space-y-2 text-gray-400">
                <p>📞 966+123456789</p>
                <p>✉️ info@hegazy-store.com</p>
                <p>📍 الرياض، المملكة العربية السعودية</p>
              </div>
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