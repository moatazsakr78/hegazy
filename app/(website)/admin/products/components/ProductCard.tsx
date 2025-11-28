'use client';

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

interface ProductCardProps {
  product: ProductManagementItem;
  isDragMode: boolean;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onToggleVisibility: () => void;
  onToggleFeatured: () => void;
  onManageSuggestions: () => void;
}

export default function ProductCard({
  product,
  isDragMode,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggleVisibility,
  onToggleFeatured,
  onManageSuggestions,
}: ProductCardProps) {
  return (
    <div
      draggable={isDragMode}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-lg p-4 border shadow-md transition-all duration-200 ${
        isDragMode 
          ? 'cursor-move hover:shadow-lg' 
          : 'cursor-default'
      } ${
        isDragging 
          ? 'opacity-50 scale-95 rotate-2' 
          : 'opacity-100 scale-100'
      } ${
        product.isHidden 
          ? 'border-red-300 bg-red-50' 
          : 'border-gray-300 bg-white'
      }`}
    >
      {/* Drag Indicator */}
      {isDragMode && (
        <div className="flex justify-center mb-2">
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-2 h-2 bg-gray-400 rounded-full"></div>
            ))}
          </div>
        </div>
      )}

      {/* Product Image */}
      <div className="relative mb-3">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="w-full h-60 object-cover rounded-lg"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src !== '/placeholder-product.svg') {
              target.src = '/placeholder-product.svg';
            }
          }}
        />
        
        {/* Status Badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {product.isFeatured && (
            <span className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold">
              مميز
            </span>
          )}
          {product.isHidden && (
            <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
              مخفي
            </span>
          )}
        </div>
      </div>

      {/* Product Info */}
      <div className="mb-4">
        <h4 className="font-semibold text-gray-800 mb-1 truncate">{product.name}</h4>
        <div className="h-10 mb-2">
          <p className="text-gray-600 text-sm overflow-hidden" style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: '1.25rem',
            maxHeight: '2.5rem'
          }}>
            {product.description}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold" style={{color: 'var(--primary-color)'}}>{product.price} ريال</span>
          <span className="text-sm text-gray-500">{product.category}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        {/* Toggle Switches */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!product.isHidden}
              onChange={onToggleVisibility}
              className="rounded"
              style={{
                accentColor: 'var(--primary-color)'
              }}
            />
            <span className={product.isHidden ? 'text-red-600' : 'text-green-600'}>
              {product.isHidden ? 'مخفي من المتجر' : 'ظاهر في المتجر'}
            </span>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={product.isFeatured}
              onChange={onToggleFeatured}
              className="rounded"
              style={{
                accentColor: 'var(--primary-color)'
              }}
            />
            <span className={product.isFeatured ? 'text-yellow-600' : 'text-gray-600'}>
              منتج مميز
            </span>
          </label>
        </div>

        {/* Suggestions Button */}
        <button
          onClick={onManageSuggestions}
          className="w-full text-white px-3 py-2 rounded text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--primary-color)'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)';
          }}
        >
          إدارة المقترحات ({product.suggestedProducts.length})
        </button>
      </div>
    </div>
  );
}