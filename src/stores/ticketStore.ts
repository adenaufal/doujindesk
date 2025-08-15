import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TicketType {
  id: string
  name: string
  description: string
  price_idr: number
  price_usd: number
  category: 'weekend' | 'single_day' | 'vip' | 'special'
  day?: 'saturday' | 'sunday' | 'both'
  benefits: string[]
  max_quantity: number
  available_quantity: number
  is_active: boolean
  early_bird_price_idr?: number
  early_bird_price_usd?: number
  early_bird_end_date?: string
  age_restriction?: 'adult' | 'all_ages'
  requires_id: boolean
}

export interface TicketPurchase {
  id: string
  ticket_type_id: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string
  attendee_age?: number
  attendee_id_number?: string
  quantity: number
  total_price_idr: number
  total_price_usd: number
  currency: 'IDR' | 'USD'
  discount_applied?: {
    type: 'pwd' | 'child' | 'early_bird' | 'bulk'
    amount: number
    percentage: number
  }
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
  payment_method?: string
  payment_reference?: string
  qr_code: string
  rfid_code?: string
  purchase_date: string
  valid_from: string
  valid_until: string
  is_used: boolean
  used_at?: string
  entry_gate?: string
  special_access?: string[]
}

export interface TicketValidation {
  id: string
  ticket_id: string
  validation_type: 'entry' | 'exit' | 'area_access'
  gate_id: string
  staff_id: string
  timestamp: string
  is_valid: boolean
  error_reason?: string
}

export interface TicketSalesStats {
  total_sales_idr: number
  total_sales_usd: number
  total_tickets_sold: number
  sales_by_type: Record<string, {
    quantity: number
    revenue_idr: number
    revenue_usd: number
  }>
  daily_sales: Record<string, {
    tickets: number
    revenue_idr: number
    revenue_usd: number
  }>
  refunds: {
    total_amount_idr: number
    total_amount_usd: number
    count: number
  }
}

interface TicketStore {
  // Ticket Types
  ticketTypes: TicketType[]
  setTicketTypes: (types: TicketType[]) => void
  addTicketType: (type: TicketType) => void
  updateTicketType: (id: string, updates: Partial<TicketType>) => void
  deleteTicketType: (id: string) => void
  getActiveTicketTypes: () => TicketType[]
  
  // Ticket Purchases
  purchases: TicketPurchase[]
  setPurchases: (purchases: TicketPurchase[]) => void
  addPurchase: (purchase: TicketPurchase) => void
  updatePurchase: (id: string, updates: Partial<TicketPurchase>) => void
  getPurchasesByEmail: (email: string) => TicketPurchase[]
  
  // Ticket Validation
  validations: TicketValidation[]
  addValidation: (validation: TicketValidation) => void
  validateTicket: (qrCode: string, gateId: string, staffId: string) => Promise<boolean>
  recordValidation: (validation: TicketValidation) => void
  getValidationHistory: () => TicketValidation[]
  
  // Sales Analytics
  salesStats: TicketSalesStats
  updateSalesStats: () => void
  
  // Pricing & Discounts
  calculateTicketPrice: (ticketTypeId: string, quantity: number, discounts?: {
    isPwd?: boolean
    isChild?: boolean
    age?: number
  }) => { price_idr: number; price_usd: number; discount_applied?: any }
  calculateTotal: (ticketTypeId: string, quantity: number) => number
  
  // Offline Support
  pendingSync: {
    purchases: TicketPurchase[]
    validations: TicketValidation[]
  }
  addPendingPurchase: (purchase: TicketPurchase) => void
  addPendingValidation: (validation: TicketValidation) => void
  syncPendingData: () => Promise<void>
  
  // QR/RFID Generation
  generateQRCode: (purchaseId: string) => string
  generateRFIDCode: () => string
  
  // Currency
  currency: 'IDR' | 'USD'
  setCurrency: (currency: 'IDR' | 'USD') => void
  exchangeRate: number
  setExchangeRate: (rate: number) => void
}

export const useTicketStore = create<TicketStore>()(persist(
  (set, get) => ({
    // Initial State
    ticketTypes: [
      {
        id: 'weekend-pass',
        name: 'Weekend Pass',
        description: 'Full access to both Saturday and Sunday events',
        price_idr: 150000,
        price_usd: 10,
        category: 'weekend',
        day: 'both',
        benefits: [
          'Access to both days',
          'Priority entry',
          'Event catalog included',
          'Free parking'
        ],
        max_quantity: 5000,
        available_quantity: 5000,
        is_active: true,
        early_bird_price_idr: 120000,
        early_bird_price_usd: 8,
        early_bird_end_date: '2025-06-01',
        age_restriction: 'all_ages',
        requires_id: false
      },
      {
        id: 'saturday-only',
        name: 'Saturday Pass',
        description: 'Access to Saturday events only',
        price_idr: 80000,
        price_usd: 6,
        category: 'single_day',
        day: 'saturday',
        benefits: [
          'Saturday access',
          'Event catalog included'
        ],
        max_quantity: 3000,
        available_quantity: 3000,
        is_active: true,
        age_restriction: 'all_ages',
        requires_id: false
      },
      {
        id: 'sunday-only',
        name: 'Sunday Pass',
        description: 'Access to Sunday events only',
        price_idr: 80000,
        price_usd: 6,
        category: 'single_day',
        day: 'sunday',
        benefits: [
          'Sunday access',
          'Event catalog included'
        ],
        max_quantity: 3000,
        available_quantity: 3000,
        is_active: true,
        age_restriction: 'all_ages',
        requires_id: false
      },
      {
        id: 'vip-pass',
        name: 'VIP Pass',
        description: 'Premium access with exclusive benefits',
        price_idr: 300000,
        price_usd: 20,
        category: 'vip',
        day: 'both',
        benefits: [
          'Access to both days',
          'VIP lounge access',
          'Priority entry',
          'Exclusive merchandise',
          'Meet & greet opportunities',
          'Premium event catalog',
          'Free parking',
          'Complimentary refreshments'
        ],
        max_quantity: 500,
        available_quantity: 500,
        is_active: true,
        age_restriction: 'adult',
        requires_id: true
      }
    ],
    purchases: [],
    validations: [],
    salesStats: {
      total_sales_idr: 0,
      total_sales_usd: 0,
      total_tickets_sold: 0,
      sales_by_type: {},
      daily_sales: {},
      refunds: {
        total_amount_idr: 0,
        total_amount_usd: 0,
        count: 0
      }
    },
    pendingSync: {
      purchases: [],
      validations: []
    },
    currency: 'IDR',
    exchangeRate: 15000, // 1 USD = 15000 IDR
    
    // Ticket Types Actions
    setTicketTypes: (types) => set({ ticketTypes: types }),
    
    addTicketType: (type) => set((state) => ({
      ticketTypes: [...state.ticketTypes, type]
    })),
    
    updateTicketType: (id, updates) => set((state) => ({
      ticketTypes: state.ticketTypes.map(type => 
        type.id === id ? { ...type, ...updates } : type
      )
    })),
    
    deleteTicketType: (id) => set((state) => ({
      ticketTypes: state.ticketTypes.filter(type => type.id !== id)
    })),
    
    getActiveTicketTypes: () => {
      return get().ticketTypes.filter(type => type.is_active && type.available_quantity > 0)
    },
    
    // Purchase Actions
    setPurchases: (purchases) => set({ purchases }),
    
    addPurchase: (purchase) => set((state) => {
      // Update available quantity
      const updatedTypes = state.ticketTypes.map(type => 
        type.id === purchase.ticket_type_id 
          ? { ...type, available_quantity: type.available_quantity - purchase.quantity }
          : type
      )
      
      return {
        purchases: [...state.purchases, purchase],
        ticketTypes: updatedTypes
      }
    }),
    
    updatePurchase: (id, updates) => set((state) => ({
      purchases: state.purchases.map(purchase => 
        purchase.id === id ? { ...purchase, ...updates } : purchase
      )
    })),
    
    getPurchasesByEmail: (email) => {
      return get().purchases.filter(purchase => purchase.attendee_email === email)
    },
    
    // Validation Actions
  addValidation: (validation) => set((state) => ({
    validations: [...state.validations, validation]
  })),
  
  getValidationHistory: () => {
    return get().validations
  },

  // Record a new validation
  recordValidation: (validation: TicketValidation) => {
    set((state) => ({
      validations: [...state.validations, validation]
    }))
  },

  // Calculate total price for tickets
  calculateTotal: (ticketTypeId: string, quantity: number) => {
    const state = get()
    const ticketType = state.ticketTypes.find(t => t.id === ticketTypeId)
    if (!ticketType) return 0
    
    const price = state.currency === 'IDR' ? ticketType.price_idr : ticketType.price_usd
    return price * quantity
  },
    
    validateTicket: async (qrCode, gateId, staffId) => {
      const state = get()
      const purchase = state.purchases.find(p => p.qr_code === qrCode)
      
      if (!purchase) {
        const validation: TicketValidation = {
          id: `val_${Date.now()}`,
          ticket_id: qrCode,
          validation_type: 'entry',
          gate_id: gateId,
          staff_id: staffId,
          timestamp: new Date().toISOString(),
          is_valid: false,
          error_reason: 'Ticket not found'
        }
        state.addValidation(validation)
        return false
      }
      
      const now = new Date()
      const validFrom = new Date(purchase.valid_from)
      const validUntil = new Date(purchase.valid_until)
      
      let isValid = true
      let errorReason = ''
      
      if (purchase.payment_status !== 'paid') {
        isValid = false
        errorReason = 'Payment not confirmed'
      } else if (purchase.is_used) {
        isValid = false
        errorReason = 'Ticket already used'
      } else if (now < validFrom || now > validUntil) {
        isValid = false
        errorReason = 'Ticket not valid for current date/time'
      }
      
      const validation: TicketValidation = {
        id: `val_${Date.now()}`,
        ticket_id: purchase.id,
        validation_type: 'entry',
        gate_id: gateId,
        staff_id: staffId,
        timestamp: new Date().toISOString(),
        is_valid: isValid,
        error_reason: isValid ? undefined : errorReason
      }
      
      state.addValidation(validation)
      
      if (isValid) {
        state.updatePurchase(purchase.id, {
          is_used: true,
          used_at: new Date().toISOString(),
          entry_gate: gateId
        })
      }
      
      return isValid
    },
    
    // Sales Analytics
    updateSalesStats: () => {
      const state = get()
      const paidPurchases = state.purchases.filter(p => p.payment_status === 'paid')
      
      const stats: TicketSalesStats = {
        total_sales_idr: paidPurchases.reduce((sum, p) => sum + (p.currency === 'IDR' ? p.total_price_idr : 0), 0),
        total_sales_usd: paidPurchases.reduce((sum, p) => sum + (p.currency === 'USD' ? p.total_price_usd : 0), 0),
        total_tickets_sold: paidPurchases.reduce((sum, p) => sum + p.quantity, 0),
        sales_by_type: {},
        daily_sales: {},
        refunds: {
          total_amount_idr: 0,
          total_amount_usd: 0,
          count: 0
        }
      }
      
      // Calculate sales by type
      paidPurchases.forEach(purchase => {
        if (!stats.sales_by_type[purchase.ticket_type_id]) {
          stats.sales_by_type[purchase.ticket_type_id] = {
            quantity: 0,
            revenue_idr: 0,
            revenue_usd: 0
          }
        }
        
        stats.sales_by_type[purchase.ticket_type_id].quantity += purchase.quantity
        stats.sales_by_type[purchase.ticket_type_id].revenue_idr += purchase.currency === 'IDR' ? purchase.total_price_idr : 0
        stats.sales_by_type[purchase.ticket_type_id].revenue_usd += purchase.currency === 'USD' ? purchase.total_price_usd : 0
      })
      
      set({ salesStats: stats })
    },
    
    // Pricing Calculation
    calculateTicketPrice: (ticketTypeId, quantity, discounts) => {
      const state = get()
      const ticketType = state.ticketTypes.find(t => t.id === ticketTypeId)
      
      if (!ticketType) {
        return { price_idr: 0, price_usd: 0 }
      }
      
      let basePrice_idr = ticketType.price_idr
      let basePrice_usd = ticketType.price_usd
      
      // Check for early bird pricing
      const now = new Date()
      const earlyBirdEnd = ticketType.early_bird_end_date ? new Date(ticketType.early_bird_end_date) : null
      
      if (earlyBirdEnd && now <= earlyBirdEnd && ticketType.early_bird_price_idr && ticketType.early_bird_price_usd) {
        basePrice_idr = ticketType.early_bird_price_idr
        basePrice_usd = ticketType.early_bird_price_usd
      }
      
      let finalPrice_idr = basePrice_idr * quantity
      let finalPrice_usd = basePrice_usd * quantity
      let discountApplied: any = undefined
      
      // Apply discounts
      if (discounts) {
        let discountPercentage = 0
        let discountType = ''
        
        // PWD discount (20%)
        if (discounts.isPwd) {
          discountPercentage = Math.max(discountPercentage, 20)
          discountType = 'pwd'
        }
        
        // Child discount (50% for under 12)
        if (discounts.isChild && discounts.age && discounts.age < 12) {
          discountPercentage = Math.max(discountPercentage, 50)
          discountType = 'child'
        }
        
        // Bulk discount (10% for 5+ tickets)
        if (quantity >= 5) {
          discountPercentage = Math.max(discountPercentage, 10)
          discountType = discountType || 'bulk'
        }
        
        if (discountPercentage > 0) {
          const discountAmount_idr = (finalPrice_idr * discountPercentage) / 100
          const discountAmount_usd = (finalPrice_usd * discountPercentage) / 100
          
          finalPrice_idr -= discountAmount_idr
          finalPrice_usd -= discountAmount_usd
          
          discountApplied = {
            type: discountType,
            amount: state.currency === 'IDR' ? discountAmount_idr : discountAmount_usd,
            percentage: discountPercentage
          }
        }
      }
      
      return {
        price_idr: Math.round(finalPrice_idr),
        price_usd: Math.round(finalPrice_usd * 100) / 100,
        discount_applied: discountApplied
      }
    },
    
    // Offline Support
    addPendingPurchase: (purchase) => set((state) => ({
      pendingSync: {
        ...state.pendingSync,
        purchases: [...state.pendingSync.purchases, purchase]
      }
    })),
    
    addPendingValidation: (validation) => set((state) => ({
      pendingSync: {
        ...state.pendingSync,
        validations: [...state.pendingSync.validations, validation]
      }
    })),
    
    syncPendingData: async () => {
      // This would sync with Supabase when online
      // For now, just move pending data to main arrays
      const state = get()
      
      state.pendingSync.purchases.forEach(purchase => {
        state.addPurchase(purchase)
      })
      
      state.pendingSync.validations.forEach(validation => {
        state.addValidation(validation)
      })
      
      set({
        pendingSync: {
          purchases: [],
          validations: []
        }
      })
    },
    
    // QR/RFID Generation
    generateQRCode: (purchaseId) => {
      return `QR_${purchaseId}_${Date.now()}`
    },
    
    generateRFIDCode: () => {
      return `RFID_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    
    // Currency
    setCurrency: (currency) => set({ currency }),
    setExchangeRate: (rate) => set({ exchangeRate: rate })
  }),
  {
    name: 'doujindesk-ticket-store',
    partialize: (state) => ({
      ticketTypes: state.ticketTypes,
      purchases: state.purchases,
      validations: state.validations,
      salesStats: state.salesStats,
      pendingSync: state.pendingSync,
      currency: state.currency,
      exchangeRate: state.exchangeRate
    })
  }
))