'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import TopHeader from '../../components/layout/TopHeader'
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  CheckIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'

interface Message {
  id: string
  message_id: string
  from_number: string
  customer_name: string
  message_text: string
  message_type: 'incoming' | 'outgoing'
  created_at: string
  is_read?: boolean
}

interface Conversation {
  phoneNumber: string
  customerName: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
}

export default function WhatsAppPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  // Fetch messages and conversations
  const fetchMessages = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch('/api/whatsapp/messages')
      const data = await response.json()

      setMessages(data.messages || [])
      setConversations(data.conversations || [])
    } catch (err) {
      console.error('Error fetching messages:', err)
      setError('فشل في تحميل الرسائل')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch and polling
  useEffect(() => {
    fetchMessages()

    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedConversation])

  // Filter messages for selected conversation
  const conversationMessages = messages.filter(
    msg => msg.from_number === selectedConversation
  )

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv =>
    conv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.phoneNumber.includes(searchQuery)
  )

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim() || !selectedConversation) return

    setIsSending(true)

    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: selectedConversation,
          message: newMessage,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setNewMessage('')
        // Refresh messages
        fetchMessages()
      } else {
        setError(data.error || 'فشل في إرسال الرسالة')
      }
    } catch (err) {
      console.error('Error sending message:', err)
      setError('فشل في إرسال الرسالة')
    } finally {
      setIsSending(false)
    }
  }

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'اليوم'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'أمس'
    }
    return date.toLocaleDateString('ar-EG')
  }

  return (
    <div className="h-screen bg-[#2B3544] overflow-hidden">
      {/* Top Header */}
      <TopHeader onMenuClick={toggleSidebar} isMenuOpen={isSidebarOpen} />

      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

      {/* Main Content Container */}
      <div className="h-full pt-12 overflow-hidden flex flex-col">

        {/* Page Header */}
        <div className="bg-[#374151] border-b border-gray-600 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChatBubbleLeftRightIcon className="h-6 w-6 text-green-500" />
              <h1 className="text-xl font-bold text-white">محادثات واتساب</h1>
            </div>
            <button
              onClick={fetchMessages}
              className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md transition-colors"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="text-sm">تحديث</span>
            </button>
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 flex overflow-hidden">

          {/* Conversations List */}
          <div className="w-80 bg-[#374151] border-l border-gray-600 flex flex-col">
            {/* Search */}
            <div className="p-3 border-b border-gray-600">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث في المحادثات..."
                  className="w-full pl-4 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-400">جاري التحميل...</div>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4">
                  <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-500 mb-3" />
                  <p className="text-gray-400 text-sm text-center">
                    لا توجد محادثات بعد
                  </p>
                  <p className="text-gray-500 text-xs text-center mt-1">
                    ستظهر الرسائل هنا عندما يتواصل معك العملاء
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <div
                    key={conv.phoneNumber}
                    onClick={() => setSelectedConversation(conv.phoneNumber)}
                    className={`p-3 border-b border-gray-600/50 cursor-pointer transition-colors ${
                      selectedConversation === conv.phoneNumber
                        ? 'bg-green-600/20 border-r-2 border-r-green-500'
                        : 'hover:bg-gray-600/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center flex-shrink-0">
                        <UserCircleIcon className="h-6 w-6 text-gray-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium text-sm truncate">
                            {conv.customerName}
                          </span>
                          <span className="text-gray-400 text-xs">
                            {formatTime(conv.lastMessageTime)}
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs truncate mt-1">
                          {conv.lastMessage}
                        </p>
                        <p className="text-gray-500 text-xs mt-1 font-mono">
                          +{conv.phoneNumber}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="bg-green-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-[#2B3544]">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="bg-[#374151] px-4 py-3 border-b border-gray-600">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center">
                      <UserCircleIcon className="h-6 w-6 text-gray-300" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">
                        {conversations.find(c => c.phoneNumber === selectedConversation)?.customerName || selectedConversation}
                      </h3>
                      <p className="text-gray-400 text-sm font-mono">
                        +{selectedConversation}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3">
                  {conversationMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-400">لا توجد رسائل في هذه المحادثة</p>
                    </div>
                  ) : (
                    <>
                      {conversationMessages.map((msg, index) => {
                        const showDate = index === 0 ||
                          formatDate(msg.created_at) !== formatDate(conversationMessages[index - 1].created_at)

                        return (
                          <div key={msg.id || index}>
                            {showDate && (
                              <div className="flex justify-center my-4">
                                <span className="bg-gray-600/50 text-gray-300 text-xs px-3 py-1 rounded-full">
                                  {formatDate(msg.created_at)}
                                </span>
                              </div>
                            )}
                            <div className={`flex ${msg.message_type === 'outgoing' ? 'justify-start' : 'justify-end'}`}>
                              <div
                                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                  msg.message_type === 'outgoing'
                                    ? 'bg-green-600 text-white rounded-bl-none'
                                    : 'bg-[#374151] text-white rounded-br-none'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
                                <div className={`flex items-center gap-1 mt-1 ${
                                  msg.message_type === 'outgoing' ? 'justify-start' : 'justify-end'
                                }`}>
                                  <span className="text-xs opacity-70">
                                    {formatTime(msg.created_at)}
                                  </span>
                                  {msg.message_type === 'outgoing' && (
                                    <CheckCircleIcon className="h-3 w-3 opacity-70" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="bg-[#374151] px-4 py-3 border-t border-gray-600">
                  {error && (
                    <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
                      <ExclamationCircleIcon className="h-4 w-4" />
                      <span>{error}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="اكتب رسالتك هنا..."
                      className="flex-1 px-4 py-2 bg-[#2B3544] border border-gray-600 rounded-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      disabled={isSending}
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || isSending}
                      className={`p-3 rounded-full transition-colors ${
                        newMessage.trim() && !isSending
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isSending ? (
                        <ClockIcon className="h-5 w-5 animate-pulse" />
                      ) : (
                        <PaperAirplaneIcon className="h-5 w-5 rotate-180" />
                      )}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* No Conversation Selected */
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <ChatBubbleLeftRightIcon className="h-24 w-24 text-gray-500 mb-4" />
                <h3 className="text-xl font-medium mb-2">مرحباً بك في محادثات واتساب</h3>
                <p className="text-sm">اختر محادثة من القائمة للبدء</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Styles */}
      <style jsx global>{`
        .scrollbar-hide {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}
