// Centralized cart session manager
// Supports both authenticated users (using user_id) and guests (using localStorage)

let globalSessionId: string | null = null;
let currentUserId: string | null = null;
const STORAGE_KEY = 'cart_session_id';

export class CartSessionManager {
  /**
   * Set the authenticated user's ID
   * This should be called when the user logs in
   * The cart will be linked to their user_id permanently
   */
  static setAuthenticatedUser(userId: string | null): void {
    if (userId) {
      // User logged in - use their user_id as session_id
      currentUserId = userId;
      globalSessionId = `user_${userId}`;

      // Also save to localStorage for persistence
      this.saveToStorage(globalSessionId);

      console.log('🔐 Cart session linked to user:', globalSessionId);
    } else {
      // User logged out - clear user reference but keep guest session
      currentUserId = null;
      globalSessionId = null;
      console.log('🔓 User logged out from cart session');
    }
  }

  /**
   * Get the global session ID, ensuring consistency across all components
   * - For authenticated users: returns user_<userId>
   * - For guests: returns a persistent localStorage-based session
   */
  static getSessionId(): string {
    if (typeof window === 'undefined') return '';

    // If we have a logged-in user, always use their user_id
    if (currentUserId) {
      globalSessionId = `user_${currentUserId}`;
      return globalSessionId;
    }

    // If we already have a global session ID (guest), return it
    if (globalSessionId) {
      return globalSessionId;
    }

    // Try to get from localStorage (persistent across browser sessions)
    try {
      const storedSessionId = localStorage.getItem(STORAGE_KEY);
      if (storedSessionId) {
        globalSessionId = storedSessionId;
        return globalSessionId;
      }
    } catch (error) {
      console.warn('localStorage not available:', error);
    }

    // Generate new session ID if none exists (for guests)
    globalSessionId = this.generateSessionId();

    // Save to localStorage for persistence
    this.saveToStorage(globalSessionId);

    console.log('🔑 New guest cart session created:', globalSessionId);
    return globalSessionId;
  }

  /**
   * Generate unique session ID for guests
   */
  private static generateSessionId(): string {
    return `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Save session ID to localStorage (persistent)
   */
  private static saveToStorage(sessionId: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, sessionId);
    } catch (error) {
      console.warn('Could not save session ID to localStorage:', error);
    }
  }

  /**
   * Force refresh session ID (for testing or when needed)
   */
  static refreshSession(): string {
    globalSessionId = this.generateSessionId();
    this.saveToStorage(globalSessionId);
    console.log('🔄 Cart session refreshed:', globalSessionId);
    return globalSessionId;
  }

  /**
   * Clear session (for logout or testing)
   * Note: This only clears the current memory reference
   * Guest sessions remain in localStorage for next visit
   */
  static clearSession(): void {
    globalSessionId = null;
    currentUserId = null;
    // Don't remove from localStorage - guest cart should persist
    console.log('🗑️ Cart session reference cleared');
  }

  /**
   * Completely clear all cart session data
   * Use this when you want to start fresh
   */
  static clearAllData(): void {
    globalSessionId = null;
    currentUserId = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Could not clear localStorage:', error);
    }
    console.log('🗑️ All cart session data cleared');
  }

  /**
   * Check if current session belongs to an authenticated user
   */
  static isAuthenticated(): boolean {
    return currentUserId !== null;
  }

  /**
   * Get the current user ID if authenticated
   */
  static getCurrentUserId(): string | null {
    return currentUserId;
  }

  /**
   * Check if current session is active
   */
  static hasActiveSession(): boolean {
    return globalSessionId !== null;
  }

  /**
   * Get session info for debugging
   */
  static getSessionInfo() {
    return {
      globalSessionId,
      currentUserId,
      storageSessionId: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null,
      hasActiveSession: this.hasActiveSession(),
      isAuthenticated: this.isAuthenticated()
    };
  }

  /**
   * Migrate guest cart to user cart
   * Call this after user logs in to transfer their guest cart items
   */
  static async migrateGuestCartToUser(userId: string): Promise<{ guestSessionId: string; userSessionId: string } | null> {
    if (typeof window === 'undefined') return null;

    try {
      // Get current guest session before switching
      const guestSessionId = localStorage.getItem(STORAGE_KEY);

      if (!guestSessionId || guestSessionId.startsWith('user_')) {
        // No guest cart or already a user cart
        return null;
      }

      const userSessionId = `user_${userId}`;

      console.log('🔄 Migrating cart from guest to user:', { guestSessionId, userSessionId });

      return {
        guestSessionId,
        userSessionId
      };
    } catch (error) {
      console.error('Error preparing cart migration:', error);
      return null;
    }
  }
}
