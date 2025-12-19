import { useState, useEffect, useCallback, useRef } from 'react';
import { CartService } from './cart-service';
import { CartSession, CartItemData } from './cart-utils';
import { CartSessionManager } from './cart-session-manager';

export interface RealCartHook {
  cart: CartItemData[];
  isLoading: boolean;
  error: string | null;
  addToCart: (productId: string, quantity: number, price: number, selectedColor?: string, selectedSize?: string) => Promise<boolean>;
  removeFromCart: (itemId: string) => Promise<boolean>;
  updateQuantity: (itemId: string, quantity: number) => Promise<boolean>;
  clearCart: () => Promise<boolean>;
  getCartTotal: () => number;
  getCartItemsCount: () => number;
  refreshCart: () => Promise<void>;
  setUserId: (userId: string | null) => void;
}

interface UseRealCartOptions {
  userId?: string | null;
}

export function useRealCart(options: UseRealCartOptions = {}): RealCartHook {
  const { userId } = options;
  const [cart, setCart] = useState<CartItemData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string>('');
  const subscriptionRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const previousUserIdRef = useRef<string | null>(null);
  
  const refreshCart = useCallback(async () => {
    if (!sessionIdRef.current || !isMountedRef.current) return;
    
    try {
      setIsLoading(true);
      setError(null);

      // Clear cache before fetching to ensure fresh data
      const { CartCache } = await import('./cart-utils');
      CartCache.clear(`cart_${sessionIdRef.current}`);

      const items = await CartService.getCartItems(sessionIdRef.current);

      if (isMountedRef.current) {
        setCart(items);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cart';
      console.error('❌ Error refreshing cart:', err);
      if (isMountedRef.current) {
        setError(errorMessage);
        setCart([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);
  
  const setupRealtimeSubscription = useCallback(() => {
    if (!sessionIdRef.current || subscriptionRef.current) return;
    
    subscriptionRef.current = CartService.subscribeToCartChanges(
      sessionIdRef.current,
      (payload) => {
        // Small delay to prevent race conditions
        setTimeout(() => {
          if (isMountedRef.current) {
            refreshCart();
          }
        }, 100);
      }
    );
  }, [refreshCart]);

  // Handle user authentication changes and cart migration
  const setUserId = useCallback((newUserId: string | null) => {
    if (newUserId === previousUserIdRef.current) return;

    console.log('🔄 User ID changed:', { from: previousUserIdRef.current, to: newUserId });

    // Set the authenticated user in session manager
    CartSessionManager.setAuthenticatedUser(newUserId);

    // Update session ID
    sessionIdRef.current = CartSession.getSessionId();
    previousUserIdRef.current = newUserId;

    // Clear existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    // Refresh cart with new session
    refreshCart();
    setupRealtimeSubscription();
  }, [refreshCart, setupRealtimeSubscription]);

  // Initialize session ID and handle user ID from props
  useEffect(() => {
    // If userId is provided, set it in the session manager
    if (userId !== undefined) {
      CartSessionManager.setAuthenticatedUser(userId);
      previousUserIdRef.current = userId;
    }

    sessionIdRef.current = CartSession.getSessionId();

    refreshCart();
    setupRealtimeSubscription();

    return () => {
      isMountedRef.current = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [refreshCart, setupRealtimeSubscription]);

  // Handle userId changes from props
  useEffect(() => {
    if (userId !== previousUserIdRef.current && userId !== undefined) {
      setUserId(userId);
    }
  }, [userId, setUserId]);

  // Handle page visibility changes and focus to refresh cart when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isMountedRef.current) {
        refreshCart();
        // Re-setup subscription if needed
        if (!subscriptionRef.current) {
          setupRealtimeSubscription();
        }
      }
    };

    const handleFocus = () => {
      if (isMountedRef.current) {
        refreshCart();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshCart, setupRealtimeSubscription]);
  
  const addToCart = useCallback(async (
    productId: string,
    quantity: number = 1,
    price: number,
    selectedColor?: string,
    selectedShape?: string,
    selectedSize?: string
  ): Promise<boolean> => {
    try {
      setError(null);

      // Ensure session ID is available
      if (!sessionIdRef.current) {
        sessionIdRef.current = CartSession.getSessionId();
      }
      
      // Optimistic UI update - check if item exists and update accordingly
      const existingItemIndex = cart.findIndex(item =>
        item.product_id === productId &&
        (item.selected_color || '') === (selectedColor || '') &&
        (item.selected_shape || '') === (selectedShape || '') &&
        (item.selected_size || '') === (selectedSize || '')
      );
      
      if (existingItemIndex >= 0) {
        // Update existing item quantity optimistically
        setCart(prevCart => 
          prevCart.map((item, index) => 
            index === existingItemIndex 
              ? { ...item, quantity: item.quantity + quantity }
              : item
          )
        );
      } else {
        // Add new item optimistically
        const optimisticItem: CartItemData = {
          id: `temp_${Date.now()}`, // Temporary ID
          session_id: sessionIdRef.current,
          product_id: productId,
          quantity,
          price,
          selected_color: selectedColor || null,
          selected_shape: selectedShape || null,
          selected_size: selectedSize || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          products: undefined // Will be populated by real-time update
        };
        setCart(prevCart => [optimisticItem, ...prevCart]);
      }
      
      const result = await CartService.addToCart(
        sessionIdRef.current,
        productId,
        quantity,
        price,
        selectedColor,
        selectedShape,
        selectedSize
      );

      if (result !== null) {
        // Real-time subscription will update with correct data
        return true;
      } else {
        // Revert optimistic update
        refreshCart();
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add to cart';
      console.error('Error adding to cart:', err);
      setError(errorMessage);
      // Revert optimistic update
      refreshCart();
      return false;
    }
  }, [cart, refreshCart]);
  
  const removeFromCart = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      setError(null);
      
      // Optimistic UI update - remove item immediately from local state
      setCart(prevCart => prevCart.filter(item => item.id !== itemId));
      
      const success = await CartService.removeFromCart(itemId);
      if (success) {
        return true;
      } else {
        // If deletion failed, restore the cart
        refreshCart();
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove from cart';
      console.error('Error removing from cart:', err);
      setError(errorMessage);
      // If deletion failed, restore the cart
      refreshCart();
      return false;
    }
  }, [refreshCart]);
  
  const updateQuantity = useCallback(async (itemId: string, quantity: number): Promise<boolean> => {
    try {
      setError(null);
      if (quantity <= 0) {
        return removeFromCart(itemId);
      }
      
      // Optimistic UI update - update quantity immediately
      setCart(prevCart => 
        prevCart.map(item => 
          item.id === itemId 
            ? { ...item, quantity }
            : item
        )
      );
      
      const result = await CartService.updateCartItemQuantity(itemId, quantity);
      if (result) {
        return true;
      } else {
        // If update failed, restore the cart
        refreshCart();
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update quantity';
      console.error('Error updating quantity:', err);
      setError(errorMessage);
      // If update failed, restore the cart
      refreshCart();
      return false;
    }
  }, [removeFromCart, refreshCart]);
  
  const clearCart = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      
      // Optimistic UI update - clear cart immediately from local state
      setCart([]);
      
      const success = await CartService.clearCart(sessionIdRef.current);
      if (success) {
        return true;
      } else {
        // If clearing failed, restore the cart
        refreshCart();
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear cart';
      console.error('Error clearing cart:', err);
      setError(errorMessage);
      // If clearing failed, restore the cart
      refreshCart();
      return false;
    }
  }, [refreshCart]);
  
  const getCartTotal = useCallback((): number => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [cart]);
  
  const getCartItemsCount = useCallback((): number => {
    const count = cart.reduce((count, item) => count + item.quantity, 0);
    return count;
  }, [cart]);
  
  return {
    cart,
    isLoading,
    error,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartItemsCount,
    refreshCart,
    setUserId
  };
}