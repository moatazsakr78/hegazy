'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import {
  HomeIcon,
  ShoppingCartIcon,
  CubeIcon,
  ArchiveBoxIcon,
  UserGroupIcon,
  TruckIcon,
  BanknotesIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  CogIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline'
import { hasPageAccess, type UserRole } from '@/app/lib/auth/roleBasedAccess'

const allSidebarItems = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: HomeIcon },
  { href: '/pos', label: 'نقطة البيع', icon: ShoppingCartIcon },
  { href: '/products', label: 'المنتجات', icon: CubeIcon },
  { href: '/inventory', label: 'المخزون', icon: ArchiveBoxIcon },
  { href: '/customers', label: 'العملاء', icon: UserGroupIcon },
  { href: '/suppliers', label: 'الموردين', icon: TruckIcon },
  { href: '/customer-orders', label: 'طلبات العملاء', icon: ClipboardDocumentListIcon },
  { href: '/whatsapp', label: 'محادثات واتساب', icon: ChatBubbleLeftRightIcon },
  { href: '/safes', label: 'الخزن', icon: BanknotesIcon },
  { href: '/reports', label: 'التقارير', icon: ChartBarIcon },
  { href: '/permissions', label: 'الصلاحيات', icon: ShieldCheckIcon },
  { href: '/settings', label: 'الإعدادات', icon: CogIcon },
]

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const loading = status === 'loading'

  // Filter menu items based on user role
  const sidebarItems = useMemo(() => {
    const userRole = session?.user?.role as UserRole | null

    return allSidebarItems.filter(item => hasPageAccess(userRole, item.href))
  }, [session?.user?.role])

  // Close sidebar when pressing ESC
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onToggle()
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onToggle])

  return (
    <>
      {/* Backdrop - only covers area below top header */}
      <div 
        className={`fixed right-0 left-0 top-12 bottom-0 bg-black z-40 transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-50 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onToggle}
      />
      
      {/* Sidebar */}
      <div 
        id="sidebar"
        className={`fixed right-0 top-12 h-[calc(100vh-3rem)] w-80 bg-[#374151] flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
        }`}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-600">
          <h2 className="text-white text-lg font-semibold">القائمة</h2>
          <button
            onClick={onToggle}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onToggle}
                className={`flex items-center gap-4 px-6 py-4 text-base font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[#5DADE2] text-white border-r-4 border-[#4A9BD1]'
                    : 'text-gray-200 hover:bg-gray-600 hover:text-white hover:border-r-4 hover:border-gray-400'
                }`}
              >
                <Icon className="h-6 w-6 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer - User Profile */}
        <div className="border-t border-gray-600">
          <div className="px-6 py-4 bg-gray-700">
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-400 rounded-full animate-pulse"></div>
                <div>
                  <div className="h-4 bg-gray-400 rounded w-16 animate-pulse mb-1"></div>
                  <div className="h-3 bg-gray-400 rounded w-20 animate-pulse"></div>
                </div>
              </div>
            ) : session?.user ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center overflow-hidden">
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-base font-bold">
                      {session.user.name?.charAt(0)?.toUpperCase() || session.user.email?.charAt(0)?.toUpperCase() || 'M'}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-base font-medium text-white">
                    {session.user.name || session.user.email || 'مستخدم'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {session.user.role || 'مستخدم عادي'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center">
                  <span className="text-white text-base font-bold">?</span>
                </div>
                <div>
                  <p className="text-base font-medium text-white">غير محدد</p>
                  <p className="text-sm text-gray-400">لا توجد بيانات</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}