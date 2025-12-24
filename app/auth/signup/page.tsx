'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { useStoreTheme } from '@/lib/hooks/useStoreTheme';

export default function SignUpPage() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const { companyName, logoUrl, isLoading: isCompanyLoading } = useCompanySettings();

  // Get store theme colors
  const { primaryColor, primaryHoverColor, isLoading: isThemeLoading } = useStoreTheme();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('كلمات المرور غير متطابقة');
      setIsLoading(false);
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      setIsLoading(false);
      return;
    }

    try {
      const result = await signUpWithEmail(formData.email, formData.password, formData.name);
      if (result.success) {
        // Account created successfully - redirect to login or home
        alert('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.');
        router.push('/auth/login');
      } else {
        setError(result.error || 'فشل في إنشاء الحساب');
      }
    } catch (error) {
      setError('حدث خطأ غير متوقع');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    setError('');
    
    try {
      const result = await signInWithGoogle();
      if (!result.success) {
        setError(result.error || 'فشل في إنشاء الحساب بجوجل');
      }
      // Success will be handled by auth callback
    } catch (error) {
      setError('حدث خطأ في إنشاء الحساب بجوجل');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  if (isCompanyLoading || isThemeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: '#c0c0c0'}}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-['Cairo',Arial,sans-serif]" dir="rtl" style={{backgroundColor: '#c0c0c0'}}>
      {/* Header */}
      <header className="border-b border-gray-700 py-0 sticky top-0 z-10" style={{backgroundColor: 'var(--primary-color)'}}>
        <div className="max-w-[80%] mx-auto px-4 flex items-center justify-between min-h-[80px]">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="h-20 w-20 rounded-lg flex items-center justify-center">
                <img 
                  src={logoUrl || '/assets/logo/Hegazy.png'} 
                  alt="El Farouk Group Logo" 
                  className="h-full w-full object-contain rounded-lg"
                />
              </div>
              <h1 className="text-xl font-bold text-white">{companyName}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">إنشاء حساب جديد</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="text-gray-300 hover:text-red-400 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              العودة للمتجر
            </button>
          </div>
        </div>
      </header>

      {/* Sign Up Form */}
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">إنشاء حساب جديد</h2>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 text-center">
              {error}
            </div>
          )}

          {/* Google Sign Up Button - First */}
          <button
            onClick={handleGoogleSignUp}
            disabled={isGoogleLoading}
            className="w-full bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm mb-6"
          >
            {isGoogleLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            <span>{isGoogleLoading ? 'جاري الإنشاء...' : 'التسجيل بجوجل'}</span>
          </button>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-4 text-sm text-gray-500">أو</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          <form onSubmit={handleEmailSignUp} className="space-y-6">
            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                اسم المستخدم <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors text-right text-black"
                placeholder="أدخل اسمك الكامل"
              />
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                البريد الإلكتروني <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors text-right text-black"
                placeholder="أدخل بريدك الإلكتروني"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                كلمة المرور <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors text-right text-black"
                placeholder="أدخل كلمة المرور (6 أحرف على الأقل)"
              />
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                تأكيد كلمة المرور <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors text-right text-black"
                placeholder="أعد إدخال كلمة المرور"
              />
            </div>

            {/* Email Sign Up Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[var(--primary-color)] hover:bg-red-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  جاري إنشاء الحساب...
                </div>
              ) : (
                'إنشاء حساب'
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <span className="text-sm text-gray-600">لديك حساب بالفعل؟ </span>
            <button
              onClick={() => router.push('/auth/login')}
              className="text-sm text-[var(--primary-color)] hover:text-red-800 transition-colors font-medium"
            >
              تسجيل الدخول
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}