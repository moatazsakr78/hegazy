'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useReducer, useRef, useCallback } from 'react';
import { CartService } from '../cart-service';
import { CartSession, CartItemData } from '../cart-utils';
import { CartSessionManager } from '../cart-session-manager';
import { useAuth } from '../useAuth';

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  selected_color?: string;
  selected_shape?: string;
  selected_size?: string;
  notes?: string;
  products?: {
    name: string;
    product_code: string | null;
    main_image_url: string | null;
  };
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (productId: string, quantity: number, price: number, selectedColor?: string, selectedShape?: string, selectedSize?: string, notes?: string) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  updateItemNotes: (itemId: string, notes: string) => Promise<void>;
  clearCart: () => Promise<void>;
  syncWithDatabase: () => Promise<void>;
}

type CartAction =
  | { type: 'SET_CART'; payload: CartItem[] }
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { itemId: string; quantity: number } }
  | { type: 'UPDATE_NOTES'; payload: { itemId: string; notes: string } }
  | { type: 'CLEAR_CART' };

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'SET_CART':
      return action.payload;
    
    case 'ADD_ITEM':
      const existingItem = state.find(item =>
        item.product_id === action.payload.product_id &&
        (item.selected_color || '') === (action.payload.selected_color || '') &&
        (item.selected_shape || '') === (action.payload.selected_shape || '') &&
        (item.selected_size || '') === (action.payload.selected_size || '')
      );
      
      if (existingItem) {
        return state.map(item =>
          item.id === existingItem.id
            ? { ...item, quantity: item.quantity + action.payload.quantity }
            : item
        );
      } else {
        return [...state, action.payload];
      }
    
    case 'REMOVE_ITEM':
      return state.filter(item => item.id !== action.payload);
    
    case 'UPDATE_QUANTITY':
      if (action.payload.quantity <= 0) {
        return state.filter(item => item.id !== action.payload.itemId);
      }
      return state.map(item =>
        item.id === action.payload.itemId
          ? { ...item, quantity: action.payload.quantity }
          : item
      );

    case 'UPDATE_NOTES':
      return state.map(item =>
        item.id === action.payload.itemId
          ? { ...item, notes: action.payload.notes }
          : item
      );

    case 'CLEAR_CART':
      return [];
    
    default:
      return state;
  }
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [cartItems, dispatch] = useReducer(cartReducer, []);
  const { user, isAuthenticated } = useAuth();
  const previousUserIdRef = useRef<string | null>(null);

  // Load initial cart from database
  const syncWithDatabase = useCallback(async () => {
    try {
      const sessionId = CartSession.getSessionId();
      const items = await CartService.getCartItems(sessionId);

      // Convert CartItemData to CartItem format
      const convertedItems: CartItem[] = items.map(item => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        selected_color: item.selected_color || undefined,
        selected_shape: item.selected_shape || undefined,
        selected_size: item.selected_size || undefined,
        notes: item.notes || undefined,
        products: item.products
      }));

      dispatch({ type: 'SET_CART', payload: convertedItems });
    } catch (error) {
      console.error('Error syncing cart with database:', error);
    }
  }, []);

  // Handle user authentication changes
  useEffect(() => {
    const currentUserId = isAuthenticated && user?.id ? user.id : null;

    // Only update if user ID actually changed
    if (currentUserId !== previousUserIdRef.current) {
      console.log('🔄 CartContext: User changed', { from: previousUserIdRef.current, to: currentUserId });

      // Update session manager with new user
      CartSessionManager.setAuthenticatedUser(currentUserId);
      previousUserIdRef.current = currentUserId;

      // Sync cart with new session
      syncWithDatabase();
    }
  }, [isAuthenticated, user?.id, syncWithDatabase]);

  // Local cart operations (immediate UI updates + database sync)
  const addToCart = async (productId: string, quantity: number, price: number, selectedColor?: string, selectedShape?: string, selectedSize?: string, notes?: string) => {
    // 1. Immediate UI update
    const newItem: CartItem = {
      id: `temp_${Date.now()}_${Math.random()}`, // Temporary ID for local state
      product_id: productId,
      quantity,
      price,
      selected_color: selectedColor,
      selected_shape: selectedShape,
      selected_size: selectedSize,
      notes: notes
    };

    dispatch({ type: 'ADD_ITEM', payload: newItem });

    // 2. Sync with database and refresh
    try {
      const sessionId = CartSession.getSessionId();
      await CartService.addToCart(sessionId, productId, quantity, price, selectedColor, selectedShape, selectedSize, notes);
      // Refresh cart from database to ensure accuracy
      await syncWithDatabase();
    } catch (error) {
      console.error('Error syncing add to cart:', error);
    }
  };

  const removeFromCart = async (itemId: string) => {
    // 1. Immediate UI update
    dispatch({ type: 'REMOVE_ITEM', payload: itemId });
    
    // 2. Sync with database and refresh
    try {
      await CartService.removeFromCart(itemId);
      // Refresh cart from database to ensure accuracy
      await syncWithDatabase();
    } catch (error) {
      console.error('Error syncing remove from cart:', error);
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    // 1. Immediate UI update
    dispatch({ type: 'UPDATE_QUANTITY', payload: { itemId, quantity } });

    // 2. Sync with database and refresh
    try {
      await CartService.updateCartItemQuantity(itemId, quantity);
      // Refresh cart from database to ensure accuracy
      await syncWithDatabase();
    } catch (error) {
      console.error('Error syncing quantity update:', error);
    }
  };

  const updateItemNotes = async (itemId: string, notes: string) => {
    // 1. Immediate UI update
    dispatch({ type: 'UPDATE_NOTES', payload: { itemId, notes } });

    // 2. Sync with database and refresh
    try {
      await CartService.updateCartItemNotes(itemId, notes);
      // Refresh cart from database to ensure accuracy
      await syncWithDatabase();
    } catch (error) {
      console.error('Error syncing notes update:', error);
    }
  };

  const clearCart = async () => {
    // 1. Immediate UI update
    dispatch({ type: 'CLEAR_CART' });
    
    // 2. Sync with database and refresh
    try {
      const sessionId = CartSession.getSessionId();
      await CartService.clearCart(sessionId);
      // Refresh cart from database to ensure accuracy
      await syncWithDatabase();
    } catch (error) {
      console.error('Error syncing clear cart:', error);
    }
  };

  // Load initial cart from database on mount
  useEffect(() => {
    syncWithDatabase();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value: CartContextType = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateItemNotes,
    clearCart,
    syncWithDatabase
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}