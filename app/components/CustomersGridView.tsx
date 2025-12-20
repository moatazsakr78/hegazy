'use client'

import { useState, useEffect } from 'react'
import { Customer } from '../lib/hooks/useCustomers'
import { ranks } from '@/app/lib/data/ranks'
import { supabase } from '../lib/supabase/client'
import Image from 'next/image'
import MD5 from 'crypto-js/md5'
import {
  UserCircleIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  StarIcon,
  TrophyIcon
} from '@heroicons/react/24/outline'

interface CustomersGridViewProps {
  customers: Customer[]
  selectedCustomer: Customer | null
  onCustomerClick: (customer: Customer) => void
  onCustomerDoubleClick: (customer: Customer) => void
  isDefaultCustomer: (customerId: string) => boolean
}

export default function CustomersGridView({
  customers,
  selectedCustomer,
  onCustomerClick,
  onCustomerDoubleClick,
  isDefaultCustomer
}: CustomersGridViewProps) {

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB')
  }

  const getRankInfo = (rankId: string | null) => {
    if (!rankId) return null
    return ranks.find(r => r.id === rankId)
  }

  // دالة للحصول على صورة العميل من user_profiles
  const [userAvatars, setUserAvatars] = useState<{[key: string]: string}>({})

  // جلب avatars للمستخدمين الذين لديهم user_id
  useEffect(() => {
    const fetchUserAvatars = async () => {
      const customerUserIds = customers
        .filter(customer => customer.user_id)
        .map(customer => customer.user_id!)

      if (customerUserIds.length > 0) {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, avatar_url')
          .in('id', customerUserIds)

        if (data) {
          const avatarMap = data.reduce((acc, user) => {
            if (user.avatar_url) {
              acc[user.id] = user.avatar_url
            }
            return acc
          }, {} as {[key: string]: string})

          setUserAvatars(avatarMap)
        }
      }
    }

    if (customers.length > 0) {
      fetchUserAvatars()
    }
  }, [customers])

  const getCustomerAvatarUrl = (customer: Customer) => {
    // 1. أولاً: استخدم profile_image_url من جدول العملاء مباشرة (صورة Google OAuth أو صورة مرفوعة)
    if (customer.profile_image_url) {
      return customer.profile_image_url;
    }

    // 2. ثانياً: إذا كان لديه user_id، ابحث عن avatar_url في userAvatars
    if (customer.user_id && userAvatars[customer.user_id]) {
      return userAvatars[customer.user_id];
    }

    // 3. ثالثاً: استخدم Gravatar إذا كان لديه بريد إلكتروني
    if (customer.email) {
      const emailHash = MD5(customer.email.toLowerCase().trim()).toString();
      // d=404 يعني إرجاع خطأ 404 إذا لم تكن هناك صورة، مما يسمح بالـ fallback
      return `https://www.gravatar.com/avatar/${emailHash}?d=404&s=200`;
    }

    // 4. أخيراً: ارجع null للاعتماد على الأحرف الأولى
    return null;
  }

  // دالة بديلة لتوليد صور الأفاتار بناءً على الاسم
  const getInitialsAvatar = (name: string) => {
    const initials = name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase()

    // ألوان متنوعة للأفاتار
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ]

    const colorIndex = name.length % colors.length
    const backgroundColor = colors[colorIndex]

    return {
      initials,
      backgroundColor
    }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 p-4">
      {customers.map((customer) => {
        const isSelected = selectedCustomer?.id === customer.id
        const isDefault = isDefaultCustomer(customer.id)
        const rankInfo = getRankInfo(customer.rank)
        const avatarUrl = getCustomerAvatarUrl(customer)
        const initialsAvatar = getInitialsAvatar(customer.name)

        return (
          <div
            key={customer.id}
            onClick={() => onCustomerClick(customer)}
            onDoubleClick={() => onCustomerDoubleClick(customer)}
            className={`
              relative bg-[#374151] rounded-lg border-2 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg
              ${isSelected
                ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50'
                : 'border-gray-600 hover:border-gray-500'
              }
            `}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-600">
              <div className="flex flex-col items-center text-center">
                {/* Avatar */}
                <div className="flex-shrink-0 mb-3">
                  <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-blue-600 border-2 border-gray-600">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={customer.name}
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          // إذا فشل تحميل الصورة، اعرض الأحرف الأولى
                          e.currentTarget.style.display = 'none';
                          const parentDiv = e.currentTarget.parentNode as HTMLElement;
                          if (parentDiv) {
                            parentDiv.innerHTML = `<span class="text-white text-lg font-medium">${initialsAvatar.initials}</span>`;
                            parentDiv.style.backgroundColor = initialsAvatar.backgroundColor;
                          }
                        }}
                      />
                    ) : (
                      <div
                        className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xl"
                        style={{ backgroundColor: initialsAvatar.backgroundColor }}
                      >
                        {initialsAvatar.initials}
                      </div>
                    )}
                  </div>
                </div>

                {/* Name and Default Badge */}
                <div className="w-full">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <h3 className="text-white font-medium text-sm leading-tight">
                      {customer.name}
                    </h3>
                    {isDefault && (
                      <StarIcon className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                    )}
                  </div>

                  {/* Category */}
                  <p className="text-gray-400 text-xs">
                    {customer.category || 'غير محدد'}
                  </p>

                  {/* Rank Badge */}
                  {rankInfo && (
                    <div className="flex items-center justify-center gap-1 bg-gray-700 px-2 py-1 rounded-full mt-2 mx-auto w-fit">
                      <div className="w-3 h-3 relative">
                        <Image
                          src={rankInfo.icon}
                          alt={rankInfo.name}
                          fill
                          className="object-contain"
                        />
                      </div>
                      <span className="text-xs text-white font-medium">
                        {rankInfo.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-3 space-y-2">
              {/* Email - أضف البريد الإلكتروني إذا وجد */}
              {customer.email && (
                <div className="flex items-center gap-2">
                  <svg className="h-3 w-3 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                  <span className="text-gray-300 text-xs truncate">
                    {customer.email}
                  </span>
                </div>
              )}

              {/* Loyalty Points */}
              <div className="flex items-center gap-2">
                <TrophyIcon className="h-3 w-3 text-blue-400 flex-shrink-0" />
                <span className="text-xs text-gray-300">النقاط:</span>
                <span className="text-white font-medium text-xs">
                  {(customer.loyalty_points || 0).toLocaleString()}
                </span>
              </div>

              {/* Phone */}
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <PhoneIcon className="h-3 w-3 text-green-400 flex-shrink-0" />
                  <span className="text-gray-300 text-xs font-mono truncate">
                    {customer.phone}
                  </span>
                </div>
              )}

              {/* City */}
              {customer.city && (
                <div className="flex items-center gap-2">
                  <MapPinIcon className="h-3 w-3 text-red-400 flex-shrink-0" />
                  <span className="text-gray-300 text-xs truncate">
                    {customer.city}
                  </span>
                </div>
              )}

              {/* Created Date */}
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-3 w-3 text-purple-400 flex-shrink-0" />
                <span className="text-xs text-gray-300">منذ:</span>
                <span className="text-gray-400 text-xs">
                  {formatDate(customer.created_at)}
                </span>
              </div>
            </div>

            {/* Selection Indicator */}
            {isSelected && (
              <div className="absolute top-2 right-2 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
            )}
          </div>
        )
      })}
    </div>
  )
}