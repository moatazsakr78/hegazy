'use client'

import Image from 'next/image'
import { useState, useCallback, useEffect } from 'react'
import { isImagePreloaded } from '@/lib/utils/imagePreloader'

interface OptimizedImageProps {
  src: string | null | undefined
  alt: string
  width?: number
  height?: number
  className?: string
  fill?: boolean
  priority?: boolean
  sizes?: string
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  onError?: (error: any) => void
  fallbackIcon?: React.ReactNode
  containerClassName?: string
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  unoptimized?: boolean
}

// Default blur placeholder (base64 encoded 1x1 pixel)
const DEFAULT_BLUR_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=='

// Default fallback placeholder component
const DefaultFallback = ({ className }: { className?: string }) => (
  <div className={`bg-yellow-400 rounded-full flex items-center justify-center ${className}`}>
    <span className="text-2xl">😊</span>
  </div>
)

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  fill = false,
  priority = false,
  sizes,
  quality = 80,
  placeholder = 'blur',
  blurDataURL = DEFAULT_BLUR_DATA_URL,
  onError,
  fallbackIcon,
  containerClassName = '',
  objectFit = 'cover',
  unoptimized = false
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false)
  // Start with isLoading=false if image is already preloaded in our cache
  const [isLoading, setIsLoading] = useState(() => !isImagePreloaded(src))

  // Update loading state when src changes
  useEffect(() => {
    if (src && isImagePreloaded(src)) {
      setIsLoading(false)
    } else if (src) {
      setIsLoading(true)
    }
  }, [src])

  const handleError = useCallback((error: any) => {
    setHasError(true)
    setIsLoading(false)
    onError?.(error)
  }, [onError])

  const handleLoadComplete = useCallback(() => {
    setIsLoading(false)
  }, [])

  // If no src provided or error occurred, show fallback
  if (!src || hasError) {
    return (
      <div className={`${containerClassName} ${className} flex items-center justify-center`}>
        {fallbackIcon || <DefaultFallback className="w-16 h-16" />}
      </div>
    )
  }

  // Generate responsive sizes if not provided
  const responsiveSizes = sizes || (
    fill 
      ? '100vw'
      : '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
  )

  const imageProps = {
    src,
    alt,
    quality,
    priority,
    placeholder,
    blurDataURL,
    onError: handleError,
    onLoad: handleLoadComplete,
    unoptimized,
    ...(fill 
      ? { 
          fill: true,
          sizes: responsiveSizes,
          style: { objectFit }
        }
      : {
          width: width || 400,
          height: height || 300,
          sizes: responsiveSizes
        }
    )
  }

  return (
    <div className={`${containerClassName} ${fill ? 'relative' : ''}`}>
      <Image
        {...imageProps}
        className={`${className} transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className={`absolute inset-0 flex items-center justify-center bg-gray-800/50`}>
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  )
}

// Specialized components for different use cases

export function ProductGridImage({ 
  src, 
  alt, 
  priority = false,
  onError 
}: { 
  src: string | null | undefined
  alt: string
  priority?: boolean
  onError?: (error: any) => void
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
      className="object-cover"
      containerClassName="w-full h-40 bg-[#2B3544] rounded-md overflow-hidden relative z-0"
      onError={onError}
      fallbackIcon={<DefaultFallback className="w-16 h-16" />}
    />
  )
}

export function ProductModalImage({ 
  src, 
  alt, 
  priority = true,
  onError 
}: { 
  src: string | null | undefined
  alt: string
  priority?: boolean
  onError?: (error: any) => void
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 60vw, 40vw"
      className="object-cover"
      containerClassName="w-full h-64 bg-[#2B3544] rounded-lg border border-gray-600/30 overflow-hidden relative"
      onError={onError}
      fallbackIcon={<DefaultFallback className="w-20 h-20" />}
    />
  )
}

export function ProductThumbnail({ 
  src, 
  alt,
  isSelected = false,
  onClick,
  onError 
}: { 
  src: string | null | undefined
  alt: string
  isSelected?: boolean
  onClick?: () => void
  onError?: (error: any) => void
}) {
  
  return (
    <button
      onClick={onClick}
      className={`w-full h-16 bg-[#2B3544] rounded-md overflow-hidden border-2 transition-colors relative ${
        isSelected ? 'border-blue-500' : 'border-gray-600/50 hover:border-gray-500'
      }`}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 25vw, 10vw"
        className="object-cover"
        containerClassName="w-full h-full"
        onError={onError}
        unoptimized={true}
        fallbackIcon={
          <div className="w-full h-full bg-gray-600 flex items-center justify-center">
            <span className="text-gray-400 text-xs">🖼️</span>
          </div>
        }
      />
    </button>
  )
}