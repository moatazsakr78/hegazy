'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase/client'
import { useCustomers, Customer } from '../lib/hooks/useCustomers'
import { useCustomerGroups, CustomerGroup } from '../lib/hooks/useCustomerGroups'
import MD5 from 'crypto-js/md5'
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ListBulletIcon,
  EyeIcon,
  CheckIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import { ranks } from '@/app/lib/data/ranks'

interface CustomersFilterModalProps {
  isOpen: boolean
  onClose: () => void
  onFilterApply: (selectedCustomers: string[], selectedGroups: string[]) => void
  initialSelectedCustomers?: string[]
  initialSelectedGroups?: string[]
}

export default function CustomersFilterModal({
  isOpen,
  onClose,
  onFilterApply,
  initialSelectedCustomers = [],
  initialSelectedGroups = []
}: CustomersFilterModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid')
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set(initialSelectedCustomers))
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set(initialSelectedGroups))
  const [selectedGroup, setSelectedGroup] = useState<CustomerGroup | null>(null)

  // Get customers and groups data
  const { customers, isLoading, error } = useCustomers()
  const { groups, isLoading: groupsLoading, error: groupsError, getAllGroupsForFilter } = useCustomerGroups()
  const [allGroups, setAllGroups] = useState<any[]>([])

  // Fetch all groups for filtering
  useEffect(() => {
    if (isOpen && getAllGroupsForFilter) {
      getAllGroupsForFilter().then(setAllGroups)
    }
  }, [isOpen, getAllGroupsForFilter])

  // Filter customers based on search and selected group
  const filteredCustomers = useMemo(() => {
    let filtered = customers
    
    // Filter by group if one is selected
    if (selectedGroup) {
      // Get all subgroup IDs for the selected group
      const getAllSubGroupIds = (groupId: string): string[] => {
        const subGroups: string[] = [groupId]
        
        const findSubGroups = (parentId: string) => {
          allGroups.forEach(group => {
            if (group.parent_id === parentId) {
              subGroups.push(group.id)
              findSubGroups(group.id)
            }
          })
        }
        
        findSubGroups(groupId)
        return subGroups
      }

      const allGroupIds = getAllSubGroupIds(selectedGroup.id)
      filtered = filtered.filter(customer => customer.group_id && allGroupIds.includes(customer.group_id))
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(query) ||
        (customer.phone && customer.phone.toLowerCase().includes(query)) ||
        (customer.email && customer.email.toLowerCase().includes(query)) ||
        (customer.city && customer.city.toLowerCase().includes(query))
      )
    }
    
    return filtered
  }, [customers, selectedGroup, searchQuery, allGroups])

  // Handle group checkbox change
  const handleGroupToggle = useCallback((groupId: string) => {
    setSelectedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }, [])

  // Handle customer checkbox change
  const handleCustomerToggle = useCallback((customerId: string) => {
    setSelectedCustomers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(customerId)) {
        newSet.delete(customerId)
      } else {
        newSet.add(customerId)
      }
      return newSet
    })
  }, [])

  // Handle select all customers in current group
  const handleSelectAllCustomers = useCallback(() => {
    const currentGroupCustomers = filteredCustomers.map(c => c.id)
    setSelectedCustomers(prev => {
      const newSet = new Set(prev)
      currentGroupCustomers.forEach(id => newSet.add(id))
      return newSet
    })
  }, [filteredCustomers])

  // Handle deselect all customers in current group
  const handleDeselectAllCustomers = useCallback(() => {
    const currentGroupCustomers = filteredCustomers.map(c => c.id)
    setSelectedCustomers(prev => {
      const newSet = new Set(prev)
      currentGroupCustomers.forEach(id => newSet.delete(id))
      return newSet
    })
  }, [filteredCustomers])

  // Apply filter
  const handleApply = useCallback(() => {
    onFilterApply(Array.from(selectedCustomers), Array.from(selectedGroups))
    onClose()
  }, [selectedCustomers, selectedGroups, onFilterApply, onClose])

  // Generate customer avatar with real profile image (matching permissions page exactly)
  const generateCustomerAvatar = (customer: Customer) => {
    const initials = customer.name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)

    // Get avatar URL with priority: profile_image_url > Gravatar > UI Avatars
    const getAvatarUrl = (customer: Customer) => {
      // 1. أولاً: استخدم profile_image_url من جدول العملاء (صورة Google OAuth أو مرفوعة)
      if (customer.profile_image_url) {
        return customer.profile_image_url;
      }

      // 2. ثانياً: استخدم Gravatar إذا كان لديه بريد إلكتروني
      if (customer.email) {
        const emailHash = MD5(customer.email.toLowerCase().trim()).toString();
        return `https://www.gravatar.com/avatar/${emailHash}?d=404&s=200`;
      }

      // 3. أخيراً: استخدم UI Avatars كـ fallback
      const nameWords = customer.name.trim().split(' ').slice(0, 2);
      const displayName = nameWords.join(' ');
      const params = new URLSearchParams({
        name: displayName,
        size: '96',
        background: '3B82F6',
        color: 'ffffff',
        format: 'svg'
      });
      return `https://ui-avatars.com/api/?${params.toString()}`;
    };

    const avatarUrl = getAvatarUrl(customer);

    return (
      <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-blue-600 border-2 border-blue-400">
        <img
          src={avatarUrl}
          alt={customer.name || 'Customer Avatar'}
          className="w-full h-full object-cover rounded-full"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            // إذا فشل Gravatar، جرب UI Avatars
            if (target.src.includes('gravatar.com')) {
              const nameWords = customer.name.trim().split(' ').slice(0, 2);
              const displayName = nameWords.join(' ');
              const params = new URLSearchParams({
                name: displayName,
                size: '96',
                background: '3B82F6',
                color: 'ffffff',
                format: 'svg'
              });
              target.src = `https://ui-avatars.com/api/?${params.toString()}`;
            } else {
              // إذا فشل UI Avatars أيضاً، اعرض الأحرف الأولى
              target.style.display = 'none';
              target.parentElement!.innerHTML = `<span class="text-white text-lg font-bold">${initials}</span>`;
            }
          }}
        />
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] max-w-7xl w-full h-[95vh] overflow-hidden flex flex-col">
          
          {/* Header */}
          <div className="bg-[#374151] px-6 py-4 border-b border-[#4A5568] flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <UserIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">فلترة العملاء</h2>
                <p className="text-gray-400 text-sm">اختر المجموعات والعملاء المطلوبة للتقرير</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-600/30 rounded-full transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content Container */}
          <div className="flex flex-1 min-h-0">
            
            {/* Left Sidebar - Customer Groups */}
            <div className="w-80 bg-[#374151] border-r border-[#4A5568] flex flex-col min-h-0">
              <div className="p-4 border-b border-[#4A5568]">
                <h3 className="text-white font-medium mb-3">مجموعات العملاء</h3>
                
                {/* Groups List */}
                <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
                  {groupsLoading ? (
                    <div className="text-gray-400 text-center py-4">جاري التحميل...</div>
                  ) : groupsError ? (
                    <div className="text-red-400 text-center py-4 text-sm">{groupsError}</div>
                  ) : (
                    allGroups.map(group => (
                      <label
                        key={group.id}
                        className="flex items-center gap-3 p-3 bg-[#2B3544] hover:bg-[#3A4553] rounded-lg cursor-pointer transition-colors border border-gray-600/30"
                      >
                        {/* Group Checkbox */}
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={selectedGroups.has(group.id)}
                            onChange={() => handleGroupToggle(group.id)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            selectedGroups.has(group.id)
                              ? 'bg-blue-600 border-blue-600'
                              : 'bg-transparent border-gray-400'
                          }`}>
                            {selectedGroups.has(group.id) && (
                              <CheckIcon className="h-3 w-3 text-white" />
                            )}
                          </div>
                        </div>
                        
                        {/* Group Name */}
                        <span 
                          className="text-white text-base font-medium flex-1 text-right"
                          onClick={(e) => {
                            e.preventDefault()
                            setSelectedGroup(group.id === selectedGroup?.id ? null : group)
                          }}
                        >
                          {group.name}
                        </span>
                        
                        {/* Customer count in group */}
                        <span className="text-xs text-blue-300 bg-blue-900/30 px-2 py-1 rounded border border-blue-600/30">
                          {customers.filter(c => {
                            // Count customers in this group and all subgroups
                            const getAllSubGroupIds = (groupId: string): string[] => {
                              const subGroups: string[] = [groupId]
                              const findSubGroups = (parentId: string) => {
                                allGroups.forEach(g => {
                                  if (g.parent_id === parentId) {
                                    subGroups.push(g.id)
                                    findSubGroups(g.id)
                                  }
                                })
                              }
                              findSubGroups(groupId)
                              return subGroups
                            }
                            const allGroupIds = getAllSubGroupIds(group.id)
                            return c.group_id && allGroupIds.includes(c.group_id)
                          }).length}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Selection Summary */}
              <div className="p-4 border-t border-[#4A5568] mt-auto">
                <div className="text-center space-y-2">
                  <div className="text-sm text-blue-400">
                    {selectedGroups.size} مجموعة محددة
                  </div>
                  <div className="text-sm text-green-400">
                    {selectedCustomers.size} عميل محدد
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content - Customers */}
            <div className="flex-1 flex flex-col">
              
              {/* Customers Toolbar */}
              <div className="bg-[#374151] border-b border-[#4A5568] px-6 py-3">
                <div className="flex items-center justify-between">
                  
                  {/* Left Side - Controls */}
                  <div className="flex items-center gap-4">
                    {/* View Toggle */}
                    <div className="flex bg-[#2B3544] rounded-md overflow-hidden">
                      <button 
                        onClick={() => setViewMode('grid')}
                        className={`p-2 transition-colors ${
                          viewMode === 'grid' 
                            ? 'bg-blue-600 text-white' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-600'
                        }`}
                      >
                        <Squares2X2Icon className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => setViewMode('table')}
                        className={`p-2 transition-colors ${
                          viewMode === 'table' 
                            ? 'bg-blue-600 text-white' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-600'
                        }`}
                      >
                        <ListBulletIcon className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="اسم العميل..."
                        className="w-80 pl-4 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#5DADE2] focus:border-transparent text-sm"
                      />
                    </div>

                    {/* Select All/None */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSelectAllCustomers}
                        className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                      >
                        تحديد الكل
                      </button>
                      <button
                        onClick={handleDeselectAllCustomers}
                        className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                      >
                        إلغاء الكل
                      </button>
                    </div>
                  </div>

                  {/* Right Side - Info */}
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>عرض {filteredCustomers.length} من أصل {customers.length} عميل</span>
                    {selectedGroup && (
                      <span className="text-blue-400">المجموعة: {selectedGroup.name}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Customers Content */}
              <div className="flex-1 overflow-hidden bg-[#2B3544] min-h-0">
                {viewMode === 'grid' ? (
                  // Grid View - Customer Cards with Circular Avatars
                  <div className="h-full overflow-y-auto scrollbar-hide p-4">
                    <div className="grid grid-cols-6 gap-4">
                      {filteredCustomers.map((customer, index) => (
                        <div
                          key={customer.id}
                          className={`bg-[#374151] rounded-lg p-4 cursor-pointer transition-all duration-200 border-2 relative group ${
                            selectedCustomers.has(customer.id)
                              ? 'border-blue-500 bg-[#434E61]'
                              : 'border-transparent hover:border-gray-500 hover:bg-[#434E61]'
                          }`}
                        >
                          {/* Checkbox Overlay */}
                          <div className="absolute top-2 left-2 z-20">
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={selectedCustomers.has(customer.id)}
                                onChange={() => handleCustomerToggle(customer.id)}
                                className="sr-only"
                              />
                              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors shadow-lg ${
                                selectedCustomers.has(customer.id)
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'bg-black/70 border-white/70'
                              }`}>
                                {selectedCustomers.has(customer.id) && (
                                  <CheckIcon className="h-4 w-4 text-white" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Customer Avatar */}
                          <div className="mb-3 flex justify-center">
                            {generateCustomerAvatar(customer)}
                          </div>

                          {/* Customer Name */}
                          <h3 className="text-white font-medium text-sm text-center mb-2 line-clamp-2">
                            {customer.name}
                          </h3>

                          {/* Customer Details */}
                          <div className="space-y-1 text-xs">
                            {/* Phone */}
                            {customer.phone && (
                              <div className="text-center text-gray-300 font-mono">
                                {customer.phone}
                              </div>
                            )}
                            
                            {/* Loyalty Points */}
                            <div className="flex justify-between items-center">
                              <span className="text-blue-400 font-medium">
                                {(customer.loyalty_points || 0).toLocaleString()}
                              </span>
                              <span className="text-gray-400">النقاط</span>
                            </div>

                            {/* Rank */}
                            {customer.rank && (
                              <div className="flex justify-center items-center gap-1 mt-1">
                                {(() => {
                                  const rank = ranks.find(r => r.id === customer.rank)
                                  if (rank) {
                                    return (
                                      <>
                                        <span className="text-yellow-400 text-xs">{rank.name}</span>
                                        <div className="w-3 h-3 relative">
                                          <Image
                                            src={rank.icon}
                                            alt={rank.name}
                                            fill
                                            className="object-contain"
                                          />
                                        </div>
                                      </>
                                    )
                                  }
                                  return null
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Table View
                  <div className="h-full overflow-y-auto scrollbar-hide">
                    <table className="w-full">
                      <thead className="bg-[#374151] sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-right text-white font-medium">اختيار</th>
                          <th className="px-4 py-3 text-right text-white font-medium">الاسم</th>
                          <th className="px-4 py-3 text-right text-white font-medium">رقم الهاتف</th>
                          <th className="px-4 py-3 text-right text-white font-medium">النقاط</th>
                          <th className="px-4 py-3 text-right text-white font-medium">الرتبة</th>
                          <th className="px-4 py-3 text-right text-white font-medium">المدينة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.map((customer) => (
                          <tr 
                            key={customer.id}
                            className={`border-b border-gray-600 hover:bg-[#374151] ${
                              selectedCustomers.has(customer.id) ? 'bg-blue-500/10' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={selectedCustomers.has(customer.id)}
                                  onChange={() => handleCustomerToggle(customer.id)}
                                  className="sr-only"
                                />
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  selectedCustomers.has(customer.id)
                                    ? 'bg-blue-600 border-blue-600'
                                    : 'bg-transparent border-gray-400'
                                }`}>
                                  {selectedCustomers.has(customer.id) && (
                                    <CheckIcon className="h-3 w-3 text-white" />
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-white">{customer.name}</td>
                            <td className="px-4 py-3 text-gray-300 font-mono text-sm">{customer.phone || 'غير محدد'}</td>
                            <td className="px-4 py-3 text-blue-400">{(customer.loyalty_points || 0).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              {customer.rank ? (() => {
                                const rank = ranks.find(r => r.id === customer.rank)
                                if (rank) {
                                  return (
                                    <div className="flex items-center gap-2">
                                      <span className="text-white font-medium">{rank.name}</span>
                                      <div className="w-4 h-4 relative">
                                        <Image
                                          src={rank.icon}
                                          alt={rank.name}
                                          fill
                                          className="object-contain"
                                        />
                                      </div>
                                    </div>
                                  )
                                }
                                return <span className="text-white font-medium">{customer.rank}</span>
                              })() : (
                                <span className="text-gray-300">غير محدد</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-300">{customer.city || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-[#374151] px-6 py-4 border-t border-[#4A5568] flex items-center justify-between rounded-b-2xl flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-400">
                تم تحديد {selectedGroups.size} مجموعة و {selectedCustomers.size} عميل
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-300 hover:text-white bg-transparent hover:bg-gray-600/20 border border-gray-600 hover:border-gray-500 rounded transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleApply}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors font-medium"
              >
                تطبيق الفلترة
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </>
  )
}