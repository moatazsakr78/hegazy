'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { detectDeviceClient, DeviceInfo } from '../../../lib/device-detection';
import { UserInfo, Product, ProductColor } from '../../../components/website/shared/types';
import { supabase } from '../../lib/supabase/client';
import { useRatingsDisplay } from '../../../lib/hooks/useRatingSettings';
import { useStoreDisplaySettings } from '../../../lib/hooks/useStoreDisplaySettings';
import { useCart } from '../../../lib/contexts/CartContext';
import { useFormatPrice } from '../../../lib/hooks/useCurrency';
import { useCompanySettings } from '../../../lib/hooks/useCompanySettings';
import CartModal from '../../components/CartModal';

interface DatabaseProduct {
  id: string;
  name: string;
  name_en?: string | null;
  description?: string | null;
  description_en?: string | null;
  barcode?: string | null;
  price: number;
  cost_price: number;
  category_id?: string | null;
  video_url?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  product_code?: string | null;
  wholesale_price?: number | null;
  price1?: number | null;
  price2?: number | null;
  price3?: number | null;
  price4?: number | null;
  main_image_url?: string | null;
  sub_image_url?: string | null;
  barcodes?: string[] | null;
  unit?: string | null;
  stock?: number | null;
  min_stock?: number | null;
  max_stock?: number | null;
  location?: string | null;
  status?: string | null;
  warehouse?: string | null;
  branch?: string | null;
  tax_price?: number | null;
  rating?: number | null;
  rating_count?: number | null;
  discount_percentage?: number | null;
  discount_amount?: number | null;
  discount_start_date?: string | null;
  discount_end_date?: string | null;
  is_hidden?: boolean | null;
  is_featured?: boolean | null;
  display_order?: number | null;
  suggested_products?: string[] | null;
  category?: {
    id: string;
    name: string;
    name_en?: string | null;
  } | null;
}

interface ProductDetail extends Omit<Product, 'sizes'> {
  gallery: string[];
  specifications: { [key: string]: string };
  shapes: { id: string; name: string; image_url?: string; available: boolean }[];
  sizes: {
    id: string;
    name: string;
    price?: number;
    product_id?: string;
    available: boolean;
    type: 'variant' | 'related_product';
  }[];
  detailedDescription: string;
}

// Function to get sub-images for a product from database or fallback
const getProductSubImages = async (
  productId: string,
  productName: string = '',
  videoUrl: string | null = null,
  additionalImagesUrls: any = null
): Promise<string[]> => {
  try {
    // ✨ HIGHEST PRIORITY: Check additional_images_urls (new field)
    if (additionalImagesUrls && Array.isArray(additionalImagesUrls) && additionalImagesUrls.length > 0) {
      console.log(`✅ Loaded ${additionalImagesUrls.length} images from additional_images_urls for ${productName}`);
      return additionalImagesUrls;
    }

    // Second priority: Check if sub-images are stored in video_url field (old system)
    if (videoUrl) {
      try {
        const additionalImages = JSON.parse(videoUrl);
        if (Array.isArray(additionalImages) && additionalImages.length > 0) {
          console.log(`Loaded ${additionalImages.length} admin sub-images from video_url for ${productName}`);
          return additionalImages;
        }
      } catch (parseError) {
        // video_url is not JSON, it's a video link
      }
    }

    // Third priority: Check product_images table
    const { data: productImages, error } = await supabase
      .from('product_images')
      .select('image_url')
      .eq('product_id', productId)
      .order('sort_order');

    if (!error && productImages && productImages.length > 0) {
      console.log(`Loaded ${productImages.length} database sub-images for product ${productName}`);
      return productImages.map(img => img.image_url);
    }

    // No sub-images found - return empty array instead of placeholders
    console.log(`ℹ️ No sub-images found for product ${productName}`);
    return [];
  } catch (err) {
    console.error('Error fetching product images:', err);
    return [];
  }
};

// Utility function to populate product_images table (for testing/setup)
const populateProductImages = async (productId: string, imageUrls: string[]) => {
  try {
    // First, delete existing images for this product
    await supabase
      .from('product_images')
      .delete()
      .eq('product_id', productId);

    // Insert new images
    const imagesToInsert = imageUrls.map((url, index) => ({
      product_id: productId,
      image_url: url,
      alt_text: `Product Image ${index + 1}`,
      sort_order: index + 1
    }));

    const { error } = await supabase
      .from('product_images')
      .insert(imagesToInsert);

    if (error) {
      console.error('Error inserting product images:', error);
    } else {
      console.log(`Successfully added ${imageUrls.length} images for product ${productId}`);
    }
  } catch (err) {
    console.error('Error in populateProductImages:', err);
  }
};

// Product-specific sub-images mapping
const getProductSpecificSubImages = (productId: string, productName: string): string[] | null => {
  // This function can be customized to assign specific sub-images to specific products
  // You can map by product ID, name, or any other criteria
  
  const productMappings: Record<string, string[]> = {
    // Example mappings - you can customize these
    '3f2d97c6-c4b7-491d-8ee3-55f03dbf13c9': ['/sub-images/1.png', '/sub-images/2.png', '/sub-images/3.png', '/sub-images/4.png'],
    '769bff92-57eb-45bd-bb59-6cef56a2fba0': ['/sub-images/5.png', '/sub-images/6.png', '/sub-images/7.png', '/sub-images/8.png'],
    '5c0b1b90-2e6d-425f-972d-aafae451f4e2': ['/sub-images/9.png', '/sub-images/10.png', '/sub-images/11.png', '/sub-images/12.png'],
  };

  // Check if we have a specific mapping for this product ID
  if (productMappings[productId]) {
    return productMappings[productId];
  }

  // Map by product name patterns - more comprehensive coverage
  if (productName.includes('زجاجه') || productName.includes('لابوبو')) {
    return ['/sub-images/13.png', '/sub-images/14.png', '/sub-images/15.png', '/sub-images/16.png'];
  }
  
  if (productName.includes('دابل فيس')) {
    return ['/sub-images/17.png', '/sub-images/18.png', '/sub-images/19.png', '/sub-images/20.png'];
  }

  if (productName.includes('باسكت') || productName.includes('ألعاب')) {
    return ['/sub-images/21.png', '/sub-images/22.png', '/sub-images/23.png', '/sub-images/24.png'];
  }

  // Additional pattern mappings for common product types
  if (productName.includes('ورق') || productName.includes('زبده')) {
    return ['/sub-images/25.png', '/sub-images/1.png', '/sub-images/2.png', '/sub-images/3.png'];
  }

  if (productName.includes('فاست') || productName.includes('بوش')) {
    return ['/sub-images/4.png', '/sub-images/5.png', '/sub-images/6.png', '/sub-images/7.png'];
  }

  if (productName.includes('طقم') || productName.includes('حمام')) {
    return ['/sub-images/8.png', '/sub-images/9.png', '/sub-images/10.png', '/sub-images/11.png'];
  }

  if (productName.includes('مج') || productName.includes('تاج')) {
    return ['/sub-images/12.png', '/sub-images/13.png', '/sub-images/14.png', '/sub-images/15.png'];
  }

  return null; // Will fall back to deterministic assignment
};

// Fallback system for assigning sub-images to products
const getProductSubImagesFallback = (productId: string, productName: string = ''): string[] => {
  // First try to get product-specific sub-images
  const specificImages = getProductSpecificSubImages(productId, productName);
  if (specificImages) {
    return specificImages;
  }

  // ALWAYS provide sub-images using deterministic assignment for ANY product
  const images: string[] = [];
  const totalSubImages = 27; // We now have 27 sub-images (1-27)
  
  // Create a more robust hash from the product ID
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    const char = productId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Ensure positive number and get starting index
  const startIndex = Math.abs(hash) % totalSubImages;
  
  // Always return exactly 5 different sub-images for every product
  for (let i = 0; i < 5; i++) {
    const imageNumber = ((startIndex + i) % totalSubImages) + 1;
    images.push(`/sub-images/${imageNumber}.png`);
  }
  
  console.log(`Assigned sub-images for product ${productName} (${productId}):`, images);
  return images;
};

// منتجات مقترحة
const suggestedProducts: Product[] = [
  {
    id: 2,
    name: 'ماوس لاسلكي من Apple',
    description: 'ماوس أنيق وعملي للاستخدام اليومي',
    price: 299,
    originalPrice: 349,
    image: 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=300&h=300&fit=crop',
    category: 'إكسسوارات',
    rating: 4.5,
    reviews: 89,
    isOnSale: true,
    discount: 15
  },
  {
    id: 3,
    name: 'لوحة مفاتيح مكانيكية',
    description: 'لوحة مفاتيح احترافية للكتابة والألعاب',
    price: 459,
    originalPrice: 529,
    image: 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=300&h=300&fit=crop',
    category: 'إكسسوارات',
    rating: 4.7,
    reviews: 124,
    isOnSale: true,
    discount: 13
  },
  {
    id: 4,
    name: 'سماعات بلوتوث AirPods Pro',
    description: 'سماعات لاسلكية بتقنية إلغاء الضوضاء',
    price: 899,
    originalPrice: 999,
    image: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=300&h=300&fit=crop',
    category: 'إلكترونيات',
    rating: 4.9,
    reviews: 203,
    isOnSale: true,
    discount: 10
  },
  {
    id: 5,
    name: 'شاحن لاسلكي سريع',
    description: 'شاحن لاسلكي سريع لجميع الأجهزة المتوافقة',
    price: 199,
    originalPrice: 249,
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300&h=300&fit=crop',
    category: 'إكسسوارات',
    rating: 4.3,
    reviews: 67,
    isOnSale: true,
    discount: 20
  }
];

interface ProductDetailContentProps {
  productId: string;
  serverData?: {
    product: any;
    variants: any[];
    videos: any[];
    suggestedProducts: any[];
    relatedSizeProducts: any[];
  } | null;
}

export default function ProductDetailContent({ productId, serverData }: ProductDetailContentProps) {
  // Create params object for compatibility with existing code
  const params = { id: productId };

  const router = useRouter();
  const { showRatings } = useRatingsDisplay();
  const { showProductStarRating } = useStoreDisplaySettings();
  const { cartItems, addToCart } = useCart();
  const formatPrice = useFormatPrice();
  const [showCartModal, setShowCartModal] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    type: 'desktop',
    userAgent: '',
    isMobile: false,
    isTablet: false,
    isDesktop: true
  });

  const [userInfo, setUserInfo] = useState<UserInfo>({
    id: '1',
    name: 'عميل تجريبي',
    email: 'customer@example.com',
    cart: []
  });

  const [productDetails, setProductDetails] = useState<ProductDetail | null>(null);
  const [suggestedProductsList, setSuggestedProductsList] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<ProductColor | null>(null);
  const [currentGallery, setCurrentGallery] = useState<string[]>([]);
  const [selectedShape, setSelectedShape] = useState<{ id: string; name: string; image_url?: string; available: boolean } | null>(null);
  const [selectedSize, setSelectedSize] = useState<{
    id: string;
    name: string;
    price?: number;
    product_id?: string;
    available: boolean;
    type: 'variant' | 'related_product';
  } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isCompactHeaderVisible, setIsCompactHeaderVisible] = useState(false);
  const [currentSuggestedIndex, setCurrentSuggestedIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showShapeImageModal, setShowShapeImageModal] = useState(false);
  const [selectedShapeImage, setSelectedShapeImage] = useState<string | null>(null);
  const [productVideos, setProductVideos] = useState<any[]>([]);


  // Fetch product data
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let product: any;
        let colorVariants: any[] = [];
        let shapeVariants: any[] = [];
        let sizeVariants: any[] = [];
        let relatedSizeProducts: any[] = [];

        //✨ OPTIMIZATION: Use server data if available (ISR - no client queries)
        if (serverData && serverData.product) {
          console.log('✅ Using server-fetched data (ISR) - saving ~95% Egress');
          product = serverData.product;
          colorVariants = serverData.variants.filter((v: any) => v.variant_type === 'color');
          shapeVariants = serverData.variants.filter((v: any) => v.variant_type === 'shape');
          sizeVariants = serverData.variants.filter((v: any) => v.variant_type === 'size');
          relatedSizeProducts = serverData.relatedSizeProducts || [];
          setProductVideos(serverData.videos || []);
        } else {
          // ❌ FALLBACK: Fetch on client if server data not available
          console.warn('⚠️ Fallback: Fetching on client');

          const { data: rawProduct, error: productError } = await supabase
            .from('products')
            .select(`
              *,
              additional_images_urls,
              category:categories(
                id,
                name,
                name_en
              )
            `)
            .eq('id', params.id)
            .eq('is_active', true)
            .eq('is_hidden', false)
            .single();

          if (productError) throw productError;

          // Cast to DatabaseProduct with additional_images_urls
          product = rawProduct as unknown as DatabaseProduct;

          if (!product) {
            setError('المنتج غير موجود');
            return;
          }

          // Get all product color & shape definitions from the correct table
          const { data: fetchedColorVariants } = await supabase
            .from('product_color_shape_definitions')
            .select('id, name, color_hex, image_url, barcode')
            .eq('product_id', product.id)
            .eq('variant_type', 'color')
            .order('sort_order', { ascending: true }) as { data: any[] | null };
          colorVariants = fetchedColorVariants || [];

          const { data: fetchedShapeVariants } = await supabase
            .from('product_color_shape_definitions')
            .select('id, name, image_url, barcode')
            .eq('product_id', product.id)
            .eq('variant_type', 'shape')
            .order('sort_order', { ascending: true }) as { data: any[] | null };
          shapeVariants = fetchedShapeVariants || [];

          console.log('🔶 Fetched shape variants from DB:', {
            count: shapeVariants.length,
            shapes: shapeVariants
          });

          // Note: Size variants are not managed in the new system (product_color_shape_definitions)
          // They remain as separate products with different names
          sizeVariants = [];

          // البحث عن منتجات مترابطة (أحجام مختلفة) بناءً على اسم المنتج
          try {
            // استخراج الاسم الأساسي للمنتج (بدون مقياس/مقاس)
            const baseName = product.name
              .replace(/\s*مقاس\s*\d+\s*/g, '')
              .replace(/\s*مقياس\s*\d+\s*/g, '')
              .replace(/\s*حجم\s*(صغير|متوسط|كبير)\s*/g, '')
              .trim();

            if (baseName && baseName !== product.name) {
              // البحث عن منتجات أخرى تحتوي على نفس الاسم الأساسي
              const { data: relatedProducts } = await supabase
                .from('products')
                .select('id, name, price')
                .ilike('name', `%${baseName}%`)
                .neq('id', product.id)
                .eq('is_active', true)
                .limit(10);

              if (relatedProducts && relatedProducts.length > 0) {
                // فلترة المنتجات التي تحتوي على مقاس/مقياس
                relatedSizeProducts = relatedProducts.filter(p =>
                  /مقاس|مقياس|حجم/.test(p.name)
                ).map(p => {
                  // استخراج المقاس من الاسم
                  const sizeMatch = p.name.match(/مقاس\s*(\d+)|مقياس\s*(\d+)|حجم\s*(صغير|متوسط|كبير)/);
                  const sizeName = sizeMatch ? (sizeMatch[1] || sizeMatch[2] || sizeMatch[3]) : 'غير محدد';

                  return {
                    id: p.id,
                    name: `مقاس ${sizeName}`,
                    price: p.price,
                    product_id: p.id,
                    available: true
                  };
                });
              }
            }
          } catch (error) {
            console.log('Error finding related size products:', error);
          }
        } // End of else block (client-side fetch)

        // Parse product description if it's JSON
        let actualDescription: string = product.description || "";
        try {
          if (product.description && product.description.trim().startsWith('{')) {
            const descriptionData = JSON.parse(product.description);
            // Extract text field and replace escaped newlines with actual newlines
            actualDescription = (descriptionData.text || "")
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .trim();
          } else {
            // Plain text description - just clean it up
            actualDescription = product.description.trim();
          }
        } catch (e) {
          console.error('Failed to parse product description JSON:', e);
          // If parsing fails, use original description
          actualDescription = product.description || "";
        }

        // Get sub-images for this product
        const subImages = await getProductSubImages(
          product.id,
          product.name,
          product.video_url,
          (product as any).additional_images_urls // ✨ تمرير الحقل الجديد
        );

        // Get product videos from product_videos table using any type workaround
        try {
          const { data: videos, error: videoError } = await (supabase as any)
            .from('product_videos')
            .select('*')
            .eq('product_id', product.id)
            .order('sort_order', { ascending: true });

          if (!videoError && videos) {
            setProductVideos(videos);
          } else {
            setProductVideos([]);
          }
        } catch (videoError) {
          console.error('Error fetching product videos:', videoError);
          setProductVideos([]);
        }
        
        // Build gallery array
        const gallery: string[] = [];

        console.log('🖼️ Gallery Debug for:', product.name);
        console.log('  - main_image_url:', product.main_image_url);
        console.log('  - subImages count:', subImages.length);
        console.log('  - subImages:', subImages);
        console.log('  - additional_images_urls from DB:', (product as any).additional_images_urls);

        // Add main image first
        if (product.main_image_url) {
          gallery.push(product.main_image_url);
        }

        // Add sub-images
        gallery.push(...subImages);

        // Add sub_image_url if it exists and is different from main
        if ((product as any).sub_image_url && (product as any).sub_image_url !== product.main_image_url) {
          gallery.push((product as any).sub_image_url);
        }

        console.log('  - Final gallery count:', gallery.length);
        console.log('  - Final gallery:', gallery);

        // Calculate discount information
        const now = new Date();
        const discountStart = (product as any).discount_start_date ? new Date((product as any).discount_start_date) : null;
        const discountEnd = (product as any).discount_end_date ? new Date((product as any).discount_end_date) : null;
        
        const discountPercentage = (product as any).discount_percentage || 0;
        const discountAmount = (product as any).discount_amount || 0;
        
        const isDiscountActive = (
          (discountPercentage > 0 || discountAmount > 0) &&
          (!discountStart || now >= discountStart) &&
          (!discountEnd || now <= discountEnd)
        );
        
        let finalPrice = product.price;
        let calculatedDiscountPercentage = 0;
        
        if (isDiscountActive && discountPercentage > 0) {
          finalPrice = product.price * (1 - (discountPercentage / 100));
          calculatedDiscountPercentage = discountPercentage;
        } else if (isDiscountActive && discountAmount > 0) {
          finalPrice = Math.max(0, product.price - discountAmount);
          calculatedDiscountPercentage = Math.round((discountAmount / product.price) * 100);
        }

        // Create product detail object
        const productDetail: ProductDetail = {
          id: parseInt(product.id.split('-')[0], 16) % 1000, // Convert UUID to number for compatibility
          name: product.name,
          description: actualDescription,
          detailedDescription: actualDescription || 'لا يوجد وصف تفصيلي متاح حالياً.',
          price: finalPrice,
          originalPrice: isDiscountActive ? product.price : undefined,
          image: product.main_image_url || '/placeholder-image.jpg',
          gallery: gallery,
          category: product.category?.name || 'غير محدد',
          rating: (product as any).rating || 0,
          reviews: (product as any).rating_count || 0,
          isOnSale: isDiscountActive,
          discount: calculatedDiscountPercentage,
          specifications: {
            'الكود': product.product_code || 'غير محدد',
            'الباركود': product.barcode || 'غير محدد',
            'الوحدة': product.unit || 'قطعة',
            'المخزون': product.stock?.toString() || '0',
            'الحد الأدنى للمخزون': product.min_stock?.toString() || '0',
            'سعر الجملة': product.wholesale_price ? `${product.wholesale_price} ريال` : 'غير محدد'
          },
          colors: colorVariants?.map(variant => ({
            id: variant.id,
            name: variant.color_name || variant.name,
            hex: variant.color_hex,
            image_url: variant.image_url,
            quantity: variant.quantity || 0
          }))
          .sort((a, b) => (b.quantity || 0) - (a.quantity || 0)) || [], // Sort by quantity descending
          shapes: shapeVariants?.map(variant => ({
            id: variant.id,
            name: variant.name || null,
            image_url: variant.image_url || null,
            available: true  // Always available by default (quantity not tracked for shapes)
          })) || [],
          sizes: [
            // أولاً: المقاسات من product_variants
            ...(sizeVariants?.map(variant => ({
              id: variant.id,
              name: variant.name,
              available: (variant.quantity || 0) > 0,
              type: 'variant' as const
            })) || []),
            // ثانياً: المنتجات المترابطة كأحجام
            ...relatedSizeProducts.map(product => ({
              id: product.id,
              name: product.name,
              price: product.price,
              product_id: product.product_id,
              available: product.available,
              type: 'related_product' as const
            }))
          ]
        };

        setProductDetails(productDetail);
        setCurrentGallery(gallery);
        
        // Set initial selections
        if (productDetail.colors && productDetail.colors.length > 0) {
          const firstColor = productDetail.colors[0];
          setSelectedColor(firstColor);
          // If first color has image, prioritize it in gallery
          if (firstColor?.image_url) {
            const newGallery = [firstColor.image_url, ...gallery.filter(img => img !== firstColor.image_url)];
            setCurrentGallery(newGallery);
          }
        }
        if (productDetail.shapes && productDetail.shapes.length > 0) {
          setSelectedShape(productDetail.shapes[0]);
        }
        if (productDetail.sizes && productDetail.sizes.length > 0) {
          setSelectedSize(productDetail.sizes[0]);
        }

        // Fetch suggested products if available
        //✨ Use serverData.suggestedProducts if available
        let suggestedData: any[] = [];
        if (serverData && serverData.suggestedProducts && serverData.suggestedProducts.length > 0) {
          console.log('✅ Using server-fetched suggested products');
          suggestedData = serverData.suggestedProducts;
        } else if (product.suggested_products && Array.isArray(product.suggested_products) && product.suggested_products.length > 0) {
          console.warn('⚠️ Fetching suggested products on client');
          const suggestedIds = product.suggested_products;

          const { data: rawSuggestedData, error: suggestedError } = await supabase
            .from('products')
            .select(`
              *,
              category:categories(
                id,
                name,
                name_en
              )
            `)
            .in('id', suggestedIds)
            .eq('is_active', true)
            .eq('is_hidden', false);

          suggestedData = rawSuggestedData as unknown as DatabaseProduct[] || [];
        }

        if (suggestedData && suggestedData.length > 0) {
          const convertedSuggestedProducts: Product[] = suggestedData.map((suggestedProduct: any) => {
            // Calculate discount for suggested products
              const now = new Date();
              const discountStart = suggestedProduct.discount_start_date ? new Date(suggestedProduct.discount_start_date) : null;
              const discountEnd = suggestedProduct.discount_end_date ? new Date(suggestedProduct.discount_end_date) : null;
              
              const isDiscountActive = (
                (suggestedProduct.discount_percentage > 0 || suggestedProduct.discount_amount > 0) &&
                (!discountStart || now >= discountStart) &&
                (!discountEnd || now <= discountEnd)
              );
              
              let finalPrice = suggestedProduct.price;
              let calculatedDiscountPercentage = 0;
              
              if (isDiscountActive && suggestedProduct.discount_percentage > 0) {
                finalPrice = suggestedProduct.price * (1 - (suggestedProduct.discount_percentage / 100));
                calculatedDiscountPercentage = suggestedProduct.discount_percentage;
              } else if (isDiscountActive && suggestedProduct.discount_amount > 0) {
                finalPrice = Math.max(0, suggestedProduct.price - suggestedProduct.discount_amount);
                calculatedDiscountPercentage = Math.round((suggestedProduct.discount_amount / suggestedProduct.price) * 100);
              }

              return {
                id: parseInt(suggestedProduct.id.split('-')[0], 16) % 1000,
                name: suggestedProduct.name,
                description: suggestedProduct.description || '',
                price: finalPrice,
                originalPrice: isDiscountActive ? suggestedProduct.price : undefined,
                image: suggestedProduct.main_image_url || '/placeholder-image.jpg',
                category: suggestedProduct.category?.name || 'غير محدد',
                rating: suggestedProduct.rating || 0,
                reviews: suggestedProduct.rating_count || 0,
                isOnSale: isDiscountActive,
                discount: calculatedDiscountPercentage
              };
          });

          setSuggestedProductsList(convertedSuggestedProducts);
        }

      } catch (err) {
        console.error('Error fetching product:', err);
        setError(err instanceof Error ? err.message : 'فشل في تحميل المنتج');
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) {
      fetchProduct();
    }
  }, [params.id]);

  useEffect(() => {
    const detected = detectDeviceClient();
    setDeviceInfo(detected);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsCompactHeaderVisible(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAddToCart = async () => {
    if (!productDetails) return;

    try {
      // إذا كان هناك حجم محدد وهو منتج مترابط، استخدم معرف ذلك المنتج وسعره
      const productIdToAdd = selectedSize?.type === 'related_product' && selectedSize.product_id
        ? selectedSize.product_id
        : params.id;

      const priceToUse = selectedSize?.type === 'related_product' && selectedSize.price
        ? selectedSize.price
        : productDetails.price;

      await addToCart(
        productIdToAdd,
        quantity,
        priceToUse,
        selectedColor?.name,
        selectedShape?.name,
        selectedSize?.name
      );
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('حدث خطأ أثناء إضافة المنتج. يرجى المحاولة مرة أخرى.');
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen text-gray-800 flex items-center justify-center" style={{backgroundColor: '#c0c0c0'}}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{borderBottomColor: 'var(--primary-color)'}}></div>
          <p className="text-lg">جاري تحميل المنتج...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !productDetails) {
    return (
      <div className="min-h-screen text-gray-800 flex items-center justify-center" style={{backgroundColor: '#c0c0c0'}}>
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">خطأ</h1>
          <p className="text-lg mb-4">{error || 'المنتج غير موجود'}</p>
          <button 
            onClick={() => router.back()}
            className="text-white px-6 py-2 rounded-lg transition-colors"
            style={{backgroundColor: 'var(--primary-color)'}}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)';
            }}
          >
            العودة
          </button>
        </div>
      </div>
    );
  }

  return (
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
        iframe,
        .system-header,
        [class*="system"],
        [class*="navigation"],
        [style*="background: #374151"],
        [style*="background-color: #374151"] {
          display: none !important;
        }
        /* Hide scrollbar but keep functionality */
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        /* Custom border width */
        .border-3 {
          border-width: 3px;
        }
      `}</style>

      {/* Compact Sticky Header */}
      {isCompactHeaderVisible && (
        <header className="fixed top-0 left-0 right-0 border-b border-gray-700 py-2 z-40 transition-all duration-300" style={{backgroundColor: 'var(--primary-color)'}}>
          <div className="max-w-[90%] mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/assets/logo/Hegazy.png" alt="الفاروق" className="h-10 w-10 object-contain" />
              <h1 className="text-base font-bold text-white">El Farouk Group</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.back()}
                className="text-gray-300 hover:text-white transition-colors text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                العودة
              </button>
              
              <button className="relative p-2 hover:bg-red-700 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6H19" />
                </svg>
                {(cartItems?.length || 0) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-white text-red-600 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {cartItems?.length || 0}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Header */}
      <header className="border-b border-gray-700 py-0 relative z-40" style={{backgroundColor: 'var(--primary-color)'}}>
        <div className="max-w-[80%] mx-auto px-4 flex items-center justify-between min-h-[80px]">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <img src="/assets/logo/Hegazy.png" alt="الفاروق" className="h-20 w-20 object-contain" />
              <h1 className="text-xl font-bold text-white">El Farouk Group</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="text-gray-300 hover:text-red-400 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              العودة للمتجر
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            {userInfo.name && (
              <span className="text-sm text-gray-300">مرحباً، {userInfo.name}</span>
            )}
            <button
              onClick={() => setShowCartModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-white"
              style={{backgroundColor: 'var(--primary-color)'}}
              onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)'; }}
              onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)'; }}
            >
              <span>السلة ({cartItems?.length || 0})</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6H19" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Product Details Content */}
      <main className="ml-0 px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
          <button onClick={() => router.push('/')} className="transition-colors hover:text-[var(--primary-color)]">الرئيسية</button>
          <span>›</span>
          <span className="text-gray-800">{productDetails.category}</span>
          <span>›</span>
          <span className="text-gray-800 font-medium">{productDetails.name}</span>
        </nav>

        {/* Product Main Section - Amazon Layout */}
        <div className="grid grid-cols-12 gap-6 mb-12 md:grid-cols-12 grid-cols-1">
          {/* Side Thumbnails - Hidden on mobile */}
          <div className="col-span-1 hidden md:block">
            <div className="space-y-2 sticky top-4">
              {/* Image Thumbnails */}
              {currentGallery.map((image, index) => (
                <button
                  key={`image-${index}`}
                  onClick={() => {
                    setSelectedImage(index);
                    setSelectedVideo(null);
                  }}
                  onMouseEnter={() => {
                    setSelectedImage(index);
                    setSelectedVideo(null);
                  }}
                  className={`w-full aspect-square rounded border-2 overflow-hidden transition-all duration-200 ${
                    selectedImage === index && !selectedVideo
                      ? 'border-red-500 ring-1 ring-red-500'
                      : 'border-gray-300 hover:border-red-300'
                  }`}
                >
                  <img
                    src={image}
                    alt={`${productDetails.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}

              {/* Video Thumbnails */}
              {productVideos.map((video, index) => (
                <button
                  key={`video-${index}`}
                  onClick={() => {
                    setSelectedVideo(video.video_url);
                    setSelectedImage(-1);
                  }}
                  onMouseEnter={() => {
                    setSelectedVideo(video.video_url);
                    setSelectedImage(-1);
                  }}
                  className={`relative w-full aspect-square rounded border-2 overflow-hidden transition-all duration-200 ${
                    selectedVideo === video.video_url
                      ? 'border-red-500 ring-1 ring-red-500'
                      : 'border-gray-300 hover:border-red-300'
                  }`}
                >
                  <video
                    src={video.video_url}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                  {/* Video Play Icon Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Display Area */}
          <div className="md:col-span-7 col-span-1 md:px-0 px-4">
            <div
              className={`relative w-full md:aspect-square aspect-square bg-white rounded-lg overflow-hidden shadow-lg ${selectedVideo ? 'cursor-pointer' : 'cursor-zoom-in'}`}
              onMouseEnter={() => !selectedVideo && setIsZooming(true)}
              onMouseLeave={() => !selectedVideo && setIsZooming(false)}
              onMouseMove={(e) => {
                if (isZooming && !selectedVideo) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  setZoomPosition({ x, y });
                }
              }}
            >
              {selectedVideo ? (
                <div className="relative w-full h-full">
                  <video
                    src={selectedVideo}
                    className="w-full h-full object-cover"
                    controls={false}
                    muted
                    preload="metadata"
                  />
                  {/* Video Play Button */}
                  <button
                    onClick={() => setShowVideoModal(true)}
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 hover:bg-opacity-50 transition-all"
                  >
                    <div className="w-20 h-20 bg-white bg-opacity-90 rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </button>
                </div>
              ) : (
                <>
                  <img
                    src={currentGallery[selectedImage]}
                    alt={productDetails.name}
                    className={`w-full h-full object-cover transition-transform duration-200 ${
                      isZooming && !selectedVideo ? 'scale-150' : 'scale-100'
                    }`}
                    style={{
                      transformOrigin: (isZooming && !selectedVideo) ? `${zoomPosition.x}% ${zoomPosition.y}%` : 'center'
                    }}
                  />
                  {/* Zoom Overlay - only for images, not videos */}
                  {isZooming && !selectedVideo && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle 100px at ${zoomPosition.x}% ${zoomPosition.y}%, transparent 30%, rgba(0,0,0,0.1) 100%)`
                      }}
                    />
                  )}
                </>
              )}
            </div>

            {/* Mobile Thumbnails - Only shown on mobile */}
            <div className="md:hidden mt-4 px-4">
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                {/* Image Thumbnails */}
                {currentGallery.map((image, index) => (
                  <button
                    key={`mobile-image-${index}`}
                    onClick={() => {
                      setSelectedImage(index);
                      setSelectedVideo(null);
                    }}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden transition-all duration-200 ${
                      selectedImage === index && !selectedVideo
                        ? 'border-red-500 ring-2 ring-red-500'
                        : 'border-gray-300'
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${productDetails.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}

                {/* Video Thumbnails */}
                {productVideos.map((video, index) => (
                  <button
                    key={`mobile-video-${index}`}
                    onClick={() => {
                      setSelectedVideo(video.video_url);
                      setSelectedImage(-1);
                    }}
                    className={`relative flex-shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden transition-all duration-200 ${
                      selectedVideo === video.video_url
                        ? 'border-red-500 ring-2 ring-red-500'
                        : 'border-gray-300'
                    }`}
                  >
                    <video
                      src={video.video_url}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                    {/* Video Play Icon Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Product Info */}
          <div className="md:col-span-4 col-span-1 space-y-6 md:max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-hide md:pb-12 pb-8 md:pr-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{productDetails.name}</h1>
              <p className="text-gray-600" style={{whiteSpace: 'pre-line'}}>{productDetails.description}</p>
            </div>

            {/* Rating and Reviews - conditionally shown based on settings */}
            {showRatings && showProductStarRating && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={i < Math.floor(productDetails.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}>
                      ⭐
                    </span>
                  ))}
                  <span className="text-sm text-gray-600 mr-2">
                    {productDetails.rating} ({productDetails.reviews} تقييم)
                  </span>
                </div>
              </div>
            )}

            {/* Price */}
            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold" style={{color: 'var(--primary-color)'}}>{productDetails.price} ريال</span>
              {productDetails.originalPrice && (
                <span className="text-xl text-gray-500 line-through">{productDetails.originalPrice} ريال</span>
              )}
              {productDetails.isOnSale && (
                <span className="px-3 py-1 rounded-full text-sm font-bold" style={{backgroundColor: '#F5F1F1', color: 'var(--primary-color)'}}>
                  خصم {productDetails.discount}%
                </span>
              )}
            </div>

            {/* Colors */}
            {productDetails.colors && productDetails.colors.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">اللون المتاح:</h3>
                <div className="flex gap-3 flex-wrap max-h-[200px] md:max-h-[250px] overflow-y-auto scrollbar-hide pr-2 pb-2">
                  {productDetails.colors?.map((color) => (
                    <button
                      key={color.id}
                      onClick={() => {
                        if (selectedColor?.id === color.id) {
                          setSelectedColor(null);
                          setCurrentGallery(productDetails.gallery || []);
                          setSelectedImage(0);
                        } else {
                          setSelectedColor(color);
                          if (color.image_url && productDetails.gallery) {
                            const newGallery = [color.image_url, ...productDetails.gallery.filter(img => img !== color.image_url)];
                            setCurrentGallery(newGallery);
                            setSelectedImage(0);
                          } else {
                            setCurrentGallery(productDetails.gallery || []);
                          }
                        }
                      }}
                      className={`relative w-12 h-12 rounded-full border-2 transition-all flex-shrink-0 ${
                        selectedColor?.id === color.id
                          ? 'border-red-500 shadow-lg scale-110'
                          : 'border-gray-300 hover:border-red-300'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    >
                      {selectedColor?.id === color.id && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-6 h-6 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-2">اللون المحدد: {selectedColor?.name}</p>
              </div>
            )}

            {/* Shapes - Clean & Simple */}
            {productDetails.shapes && productDetails.shapes.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">الشكل المتاح:</h3>
                <div className="flex gap-3 flex-wrap">
                  {productDetails.shapes.map((shape) => (
                    <button
                      key={shape.id}
                      onClick={() => setSelectedShape(selectedShape?.id === shape.id ? null : shape)}
                      className={`border-2 rounded-lg p-2 transition-all ${
                        selectedShape?.id === shape.id
                          ? 'border-red-500 bg-red-50 shadow-lg'
                          : 'border-gray-300 hover:border-red-400 bg-white'
                      }`}
                    >
                      {/* Show image if available */}
                      {shape.image_url ? (
                        <div className="flex flex-col items-center gap-1">
                          <div className="relative">
                            <img
                              src={shape.image_url}
                              alt={shape.name || 'شكل'}
                              className="w-16 h-16 object-cover rounded"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedShapeImage(shape.image_url || null);
                                setShowShapeImageModal(true);
                              }}
                            />
                            {selectedShape?.id === shape.id && (
                              <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          {shape.name && (
                            <span className="text-xs text-gray-700 text-center max-w-[80px] truncate">
                              {shape.name}
                            </span>
                          )}
                        </div>
                      ) : (
                        /* Show name only if no image */
                        <span className="px-3 py-1 text-sm">
                          {shape.name || 'شكل'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sizes */}
            {productDetails.sizes && productDetails.sizes.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">الحجم المتاح:</h3>
                <div className="flex gap-3 flex-wrap max-h-[200px] md:max-h-[250px] overflow-y-auto scrollbar-hide pr-2 pb-2">
                  {productDetails.sizes?.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => {
                        if (selectedSize?.id === size.id) {
                          setSelectedSize(null);
                        } else {
                          setSelectedSize(size);
                        }
                      }}
                      disabled={!size.available}
                      className={`px-4 py-2 border-2 rounded-lg transition-all text-sm font-medium ${
                        selectedSize?.id === size.id
                          ? 'border-red-500 bg-red-50 text-red-600 shadow-lg'
                          : size.available
                          ? 'border-gray-300 hover:border-red-300 bg-white text-gray-700 hover:bg-red-50'
                          : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      title={size.type === 'related_product' ? `${size.name} - ${formatPrice(size.price || 0)}` : size.name}
                    >
                      <div className="flex flex-col items-center">
                        <span>{size.name}</span>
                        {size.type === 'related_product' && size.price && (
                          <span className="text-xs opacity-75">{formatPrice(size.price)}</span>
                        )}
                      </div>
                      {selectedSize?.id === size.id && (
                        <span className="mr-2">
                          <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {selectedSize && (
                  <p className="text-sm text-gray-600 mt-2">الحجم المحدد: {selectedSize?.name}</p>
                )}
              </div>
            )}

            {/* Quantity */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">الكمية:</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <input
                  type="number"
                  value={quantity}
                  min="1"
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setQuantity(Math.max(1, value));
                  }}
                  className="text-xl font-semibold px-4 py-2 w-20 text-center border border-gray-300 rounded-lg focus:outline-none focus:border-red-500"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Add to Cart Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={handleAddToCart}
                className="flex-1 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                style={{backgroundColor: 'var(--primary-color)'}}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)';
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6H19" />
                </svg>
                أضف إلى السلة
              </button>
              <button className="px-6 py-3 border rounded-lg font-semibold transition-colors flex items-center justify-center" style={{borderColor: 'var(--primary-color)', color: 'var(--primary-color)'}} onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = '#F5F1F1'; }} onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>


        {/* Suggested Products - Only show if there are suggested products */}
        {suggestedProductsList.length > 0 && (
          <section>
            <div className="mx-16">
              <h3 className="text-2xl font-bold mb-6" style={{color: 'var(--primary-color)'}}>منتجات مقترحة</h3>
            </div>
            <div className="relative">
              {/* Navigation Arrows - Only show if there are more than 4 products */}
              {suggestedProductsList.length > 4 && (
                <>
                  <button 
                    onClick={() => setCurrentSuggestedIndex(Math.max(0, currentSuggestedIndex - 4))}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={currentSuggestedIndex === 0}
                  >
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <button 
                    onClick={() => setCurrentSuggestedIndex(Math.min(suggestedProductsList.length - 4, currentSuggestedIndex + 4))}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={currentSuggestedIndex >= suggestedProductsList.length - 4}
                  >
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}

              {/* Products Grid with Margins for Arrows */}
              <div className="mx-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {suggestedProductsList.slice(currentSuggestedIndex, currentSuggestedIndex + 4).map((product) => (
                    <div 
                      key={product.id} 
                      className="bg-white rounded-lg p-4 hover:bg-gray-100 transition-colors border border-gray-300 shadow-md group cursor-pointer"
                      onClick={() => router.push(`/product/${product.id}`)}
                    >
                      <div className="relative mb-4">
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        {product.isOnSale && (
                          <span className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                            -{product.discount}%
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold mb-2 text-gray-800 truncate transition-colors group-hover:text-[var(--primary-color)]">{product.name}</h4>
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {product.originalPrice && (
                            <span className="text-sm text-gray-500 line-through">{product.originalPrice} ريال</span>
                          )}
                          <span className="text-lg font-bold" style={{color: 'var(--primary-color)'}}>{product.price} ريال</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        {showRatings && showProductStarRating && (
                          <div className="flex items-center gap-1">
                            <span className="text-yellow-400">⭐</span>
                            <span className="text-sm text-gray-400">{product.rating} ({product.reviews})</span>
                          </div>
                        )}
                        {(!showRatings || !showProductStarRating) && <div></div>}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await addToCart(String(product.id), 1, product.price);
                            } catch (error) {
                              console.error('Error adding to cart:', error);
                              alert('حدث خطأ أثناء إضافة المنتج.');
                            }
                          }}
                          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white"
                          style={{backgroundColor: 'var(--primary-color)'}}
                          onMouseEnter={(e) => {
                            (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
                          }}
                          onMouseLeave={(e) => {
                            (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)';
                          }}
                        >
                          أضف للسلة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Elegant White Video/Image Modal */}
      {showVideoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setShowVideoModal(false)}
        >
          <div
            className="relative bg-white w-full h-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">{productDetails.name}</h3>
              <button
                onClick={() => setShowVideoModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex h-[calc(100vh-88px)]">
              {/* Sidebar - Media Selection */}
              <div className="w-96 border-r border-gray-200 bg-gray-50 overflow-y-auto">
                <div className="p-6">
                  {/* Images Section */}
                  {currentGallery.length > 0 && (
                    <div className="mb-8">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <h4 className="font-semibold text-gray-800">الصور ({currentGallery.length})</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {currentGallery.map((imageUrl, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setSelectedImage(index);
                              setSelectedVideo('');
                            }}
                            className={`aspect-square rounded-md overflow-hidden border-2 transition-all ${
                              !selectedVideo && selectedImage === index
                                ? 'border-blue-500 shadow-lg'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <img
                              src={imageUrl}
                              alt={`${productDetails.name} ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Videos Section */}
                  {productVideos.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 bg-red-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                          </svg>
                        </div>
                        <h4 className="font-semibold text-gray-800">الفيديوهات ({productVideos.length})</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {productVideos.map((video, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedVideo(video.video_url)}
                            className={`aspect-video rounded-md overflow-hidden border-2 transition-all relative ${
                              selectedVideo === video.video_url
                                ? 'border-red-500 shadow-lg'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <video
                              src={video.video_url}
                              className="w-full h-full object-cover"
                              muted
                              preload="metadata"
                            />
                            {/* Play Icon Overlay */}
                            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                              <div className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-800 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Content Area - Video/Image Display */}
              <div className="flex-1 p-8">
                <div className="w-full h-full bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center">
                  {selectedVideo ? (
                    <video
                      src={selectedVideo}
                      className="max-w-full max-h-full object-contain"
                      controls
                      autoPlay
                    />
                  ) : (
                    <img
                      src={currentGallery[selectedImage]}
                      alt={productDetails.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-8 mt-12" style={{backgroundColor: '#4D4D4D', borderTop: '1px solid #666'}}>
        <div className="max-w-[80%] mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src="/assets/logo/Hegazy.png" alt="الفاروق" className="h-8 w-8 object-contain" />
                <h5 className="font-bold text-lg text-white">El Farouk Group</h5>
              </div>
              <p className="text-gray-400">متجرك المتكامل للحصول على أفضل المنتجات بأسعار مميزة وجودة عالية</p>
            </div>
            <div>
              <h6 className="font-semibold mb-3">روابط سريعة</h6>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-red-400 transition-colors">الرئيسية</a></li>
                <li><a href="#" className="hover:text-red-400 transition-colors">المنتجات</a></li>
                <li><a href="#" className="hover:text-red-400 transition-colors">من نحن</a></li>
                <li><a href="#" className="hover:text-red-400 transition-colors">اتصل بنا</a></li>
              </ul>
            </div>
            <div>
              <h6 className="font-semibold mb-3">خدمة العملاء</h6>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-red-400 transition-colors">المساعدة</a></li>
                <li><a href="#" className="hover:text-red-400 transition-colors">سياسة الإرجاع</a></li>
                <li><a href="#" className="hover:text-red-400 transition-colors">الشحن والتوصيل</a></li>
                <li><a href="#" className="hover:text-red-400 transition-colors">الدفع</a></li>
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

      {/* Shape Image Modal */}
      {showShapeImageModal && selectedShapeImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowShapeImageModal(false);
            setSelectedShapeImage(null);
          }}
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => {
                setShowShapeImageModal(false);
                setSelectedShapeImage(null);
              }}
              className="absolute -top-10 left-0 text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Image */}
            <img
              src={selectedShapeImage}
              alt="شكل المنتج"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/placeholder-product.svg';
              }}
            />
          </div>
        </div>
      )}

      {/* Cart Modal */}
      <CartModal
        isOpen={showCartModal}
        onClose={() => setShowCartModal(false)}
      />
    </div>
  );
}