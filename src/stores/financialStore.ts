import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Types for Financial Management
export interface Transaction {
  id: string
  type: 'payment' | 'refund' | 'fee' | 'commission'
  amount: number
  currency: 'IDR' | 'USD'
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  description: string
  reference: string
  circleId?: string
  ticketId?: string
  createdAt: string
  updatedAt: string
  paymentMethod?: string
  exchangeRate?: number
  metadata?: Record<string, any>
}

export interface FinancialSummary {
  totalRevenue: { IDR: number; USD: number }
  totalRefunds: { IDR: number; USD: number }
  totalFees: { IDR: number; USD: number }
  netRevenue: { IDR: number; USD: number }
  transactionCount: number
  pendingAmount: { IDR: number; USD: number }
  averageTransactionValue: { IDR: number; USD: number }
  refundRate: number
  processingTime: number
}

export interface ExchangeRate {
  from: string
  to: string
  rate: number
  lastUpdated: string
  source?: string
}

export interface PaymentMethod {
  id: string
  name: string
  type: 'bank_transfer' | 'credit_card' | 'e_wallet' | 'cash'
  enabled: boolean
  fees: {
    fixed: number
    percentage: number
    currency: 'IDR' | 'USD'
  }
  processingTime: string
  description?: string
}

export interface FinancialSettings {
  defaultCurrency: 'IDR' | 'USD'
  autoUpdateRates: 'hourly' | 'daily' | 'manual'
  processingFeePercentage: number
  largeTransactionThreshold: { IDR: number; USD: number }
  notifications: {
    paymentReceived: boolean
    refundProcessed: boolean
    dailySummary: boolean
    largeTransactions: boolean
  }
  taxSettings: {
    enabled: boolean
    rate: number
    includeInPrice: boolean
  }
}

export interface RefundRequest {
  id: string
  transactionId: string
  amount: number
  currency: 'IDR' | 'USD'
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'processed'
  requestedBy: string
  requestedAt: string
  processedAt?: string
  processedBy?: string
  notes?: string
}

interface FinancialState {
  // Data
  transactions: Transaction[]
  financialSummary: FinancialSummary
  exchangeRates: ExchangeRate[]
  paymentMethods: PaymentMethod[]
  refundRequests: RefundRequest[]
  settings: FinancialSettings
  
  // UI State
  isLoading: boolean
  selectedCurrency: 'IDR' | 'USD' | 'ALL'
  dateRange: string
  searchTerm: string
  filterStatus: string
  
  // Actions
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTransaction: (id: string, updates: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void
  
  processRefund: (transactionId: string, amount: number, reason: string) => Promise<void>
  approveRefund: (refundId: string) => Promise<void>
  rejectRefund: (refundId: string, reason: string) => Promise<void>
  
  updateExchangeRates: () => Promise<void>
  convertCurrency: (amount: number, from: 'IDR' | 'USD', to: 'IDR' | 'USD') => number
  
  calculateSummary: () => void
  exportTransactions: (format: 'csv' | 'pdf' | 'excel', filters?: any) => Promise<void>
  
  updateSettings: (settings: Partial<FinancialSettings>) => void
  
  // Filters and Search
  setSelectedCurrency: (currency: 'IDR' | 'USD' | 'ALL') => void
  setDateRange: (range: string) => void
  setSearchTerm: (term: string) => void
  setFilterStatus: (status: string) => void
  
  // Loading state
  setLoading: (loading: boolean) => void
  
  // Initialize with mock data
  initializeMockData: () => void
}

export const useFinancialStore = create<FinancialState>()(
  persist(
    (set, get) => ({
      // Initial state
      transactions: [],
      financialSummary: {
        totalRevenue: { IDR: 0, USD: 0 },
        totalRefunds: { IDR: 0, USD: 0 },
        totalFees: { IDR: 0, USD: 0 },
        netRevenue: { IDR: 0, USD: 0 },
        transactionCount: 0,
        pendingAmount: { IDR: 0, USD: 0 },
        averageTransactionValue: { IDR: 0, USD: 0 },
        refundRate: 0,
        processingTime: 0
      },
      exchangeRates: [
        { from: 'USD', to: 'IDR', rate: 15800, lastUpdated: new Date().toISOString(), source: 'Bank Indonesia' },
        { from: 'IDR', to: 'USD', rate: 0.0000633, lastUpdated: new Date().toISOString(), source: 'Bank Indonesia' }
      ],
      paymentMethods: [
        {
          id: 'bank_transfer',
          name: 'Bank Transfer',
          type: 'bank_transfer',
          enabled: true,
          fees: { fixed: 0, percentage: 0, currency: 'IDR' },
          processingTime: '1-2 business days',
          description: 'Direct bank transfer'
        },
        {
          id: 'credit_card',
          name: 'Credit Card',
          type: 'credit_card',
          enabled: true,
          fees: { fixed: 0, percentage: 2.9, currency: 'IDR' },
          processingTime: 'Instant',
          description: 'Visa, Mastercard, JCB'
        },
        {
          id: 'e_wallet',
          name: 'E-Wallet',
          type: 'e_wallet',
          enabled: true,
          fees: { fixed: 0, percentage: 1.5, currency: 'IDR' },
          processingTime: 'Instant',
          description: 'GoPay, OVO, DANA'
        }
      ],
      refundRequests: [],
      settings: {
        defaultCurrency: 'IDR',
        autoUpdateRates: 'daily',
        processingFeePercentage: 2.5,
        largeTransactionThreshold: { IDR: 10000000, USD: 1000 },
        notifications: {
          paymentReceived: true,
          refundProcessed: true,
          dailySummary: false,
          largeTransactions: true
        },
        taxSettings: {
          enabled: true,
          rate: 11,
          includeInPrice: true
        }
      },
      
      // UI State
      isLoading: false,
      selectedCurrency: 'ALL',
      dateRange: '30d',
      searchTerm: '',
      filterStatus: 'all',
      
      // Actions
      addTransaction: (transactionData) => {
        const transaction: Transaction = {
          ...transactionData,
          id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        set((state) => ({
          transactions: [transaction, ...state.transactions]
        }))
        
        // Recalculate summary
        get().calculateSummary()
      },
      
      updateTransaction: (id, updates) => {
        set((state) => ({
          transactions: state.transactions.map(transaction =>
            transaction.id === id
              ? { ...transaction, ...updates, updatedAt: new Date().toISOString() }
              : transaction
          )
        }))
        
        get().calculateSummary()
      },
      
      deleteTransaction: (id) => {
        set((state) => ({
          transactions: state.transactions.filter(transaction => transaction.id !== id)
        }))
        
        get().calculateSummary()
      },
      
      processRefund: async (transactionId, amount, reason) => {
        const { transactions, addTransaction } = get()
        const originalTransaction = transactions.find(t => t.id === transactionId)
        
        if (!originalTransaction) {
          throw new Error('Transaction not found')
        }
        
        // Create refund request
        const refundRequest: RefundRequest = {
          id: `ref_${Date.now()}`,
          transactionId,
          amount,
          currency: originalTransaction.currency,
          reason,
          status: 'pending',
          requestedBy: 'system', // In real app, this would be the current user
          requestedAt: new Date().toISOString()
        }
        
        set((state) => ({
          refundRequests: [refundRequest, ...state.refundRequests]
        }))
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Create refund transaction
        addTransaction({
          type: 'refund',
          amount,
          currency: originalTransaction.currency,
          status: 'pending',
          description: `Refund for ${originalTransaction.description}`,
          reference: `REF_${originalTransaction.reference}`,
          circleId: originalTransaction.circleId,
          paymentMethod: originalTransaction.paymentMethod,
          metadata: {
            originalTransactionId: transactionId,
            refundRequestId: refundRequest.id,
            reason
          }
        })
      },
      
      approveRefund: async (refundId) => {
        set((state) => ({
          refundRequests: state.refundRequests.map(request =>
            request.id === refundId
              ? {
                  ...request,
                  status: 'approved' as const,
                  processedAt: new Date().toISOString(),
                  processedBy: 'admin'
                }
              : request
          )
        }))
        
        // Update corresponding transaction
        const refundRequest = get().refundRequests.find(r => r.id === refundId)
        if (refundRequest) {
          const refundTransaction = get().transactions.find(t => 
            t.metadata?.refundRequestId === refundId
          )
          if (refundTransaction) {
            get().updateTransaction(refundTransaction.id, { status: 'completed' })
          }
        }
      },
      
      rejectRefund: async (refundId, reason) => {
        set((state) => ({
          refundRequests: state.refundRequests.map(request =>
            request.id === refundId
              ? {
                  ...request,
                  status: 'rejected' as const,
                  processedAt: new Date().toISOString(),
                  processedBy: 'admin',
                  notes: reason
                }
              : request
          )
        }))
        
        // Update corresponding transaction
        const refundRequest = get().refundRequests.find(r => r.id === refundId)
        if (refundRequest) {
          const refundTransaction = get().transactions.find(t => 
            t.metadata?.refundRequestId === refundId
          )
          if (refundTransaction) {
            get().updateTransaction(refundTransaction.id, { status: 'failed' })
          }
        }
      },
      
      updateExchangeRates: async () => {
        set({ isLoading: true })
        
        try {
          // Simulate API call to get latest rates
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Mock updated rates (in real app, this would fetch from an API)
          const newRates: ExchangeRate[] = [
            {
              from: 'USD',
              to: 'IDR',
              rate: 15800 + (Math.random() - 0.5) * 100, // Simulate rate fluctuation
              lastUpdated: new Date().toISOString(),
              source: 'Bank Indonesia'
            },
            {
              from: 'IDR',
              to: 'USD',
              rate: 1 / (15800 + (Math.random() - 0.5) * 100),
              lastUpdated: new Date().toISOString(),
              source: 'Bank Indonesia'
            }
          ]
          
          set({ exchangeRates: newRates })
        } catch (error) {
          console.error('Failed to update exchange rates:', error)
          throw error
        } finally {
          set({ isLoading: false })
        }
      },
      
      convertCurrency: (amount, from, to) => {
        if (from === to) return amount
        
        const { exchangeRates } = get()
        const rate = exchangeRates.find(r => r.from === from && r.to === to)?.rate || 1
        return amount * rate
      },
      
      calculateSummary: () => {
        const { transactions } = get()
        
        const summary: FinancialSummary = {
          totalRevenue: { IDR: 0, USD: 0 },
          totalRefunds: { IDR: 0, USD: 0 },
          totalFees: { IDR: 0, USD: 0 },
          netRevenue: { IDR: 0, USD: 0 },
          transactionCount: transactions.length,
          pendingAmount: { IDR: 0, USD: 0 },
          averageTransactionValue: { IDR: 0, USD: 0 },
          refundRate: 0,
          processingTime: 1.2
        }
        
        let totalPayments = { IDR: 0, USD: 0 }
        let totalRefunds = { IDR: 0, USD: 0 }
        let paymentCount = 0
        let refundCount = 0
        
        transactions.forEach(transaction => {
          const currency = transaction.currency
          
          if (transaction.type === 'payment' && transaction.status === 'completed') {
            summary.totalRevenue[currency] += transaction.amount
            totalPayments[currency] += transaction.amount
            paymentCount++
          } else if (transaction.type === 'refund' && transaction.status === 'completed') {
            summary.totalRefunds[currency] += transaction.amount
            totalRefunds[currency] += transaction.amount
            refundCount++
          } else if (transaction.type === 'fee' && transaction.status === 'completed') {
            summary.totalFees[currency] += transaction.amount
          }
          
          if (transaction.status === 'pending') {
            summary.pendingAmount[currency] += transaction.amount
          }
        })
        
        // Calculate net revenue
        summary.netRevenue.IDR = summary.totalRevenue.IDR - summary.totalRefunds.IDR - summary.totalFees.IDR
        summary.netRevenue.USD = summary.totalRevenue.USD - summary.totalRefunds.USD - summary.totalFees.USD
        
        // Calculate average transaction value
        if (paymentCount > 0) {
          summary.averageTransactionValue.IDR = totalPayments.IDR / paymentCount
          summary.averageTransactionValue.USD = totalPayments.USD / paymentCount
        }
        
        // Calculate refund rate
        if (paymentCount > 0) {
          summary.refundRate = (refundCount / paymentCount) * 100
        }
        
        set({ financialSummary: summary })
      },
      
      exportTransactions: async (format, filters) => {
        set({ isLoading: true })
        
        try {
          // Simulate export processing
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // In real app, this would generate and download the file
          console.log(`Exporting transactions as ${format}`, filters)
          
        } catch (error) {
          console.error('Failed to export transactions:', error)
          throw error
        } finally {
          set({ isLoading: false })
        }
      },
      
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        }))
      },
      
      // Filter and search actions
      setSelectedCurrency: (currency) => set({ selectedCurrency: currency }),
      setDateRange: (range) => set({ dateRange: range }),
      setSearchTerm: (term) => set({ searchTerm: term }),
      setFilterStatus: (status) => set({ filterStatus: status }),
      setLoading: (loading) => set({ isLoading: loading }),
      
      // Initialize with mock data
      initializeMockData: () => {
        const mockTransactions: Transaction[] = [
          {
            id: 'txn_001',
            type: 'payment',
            amount: 2500000,
            currency: 'IDR',
            status: 'completed',
            description: 'Circle Space Registration - Anime Lovers Circle',
            reference: 'CIR_001',
            circleId: 'circle_001',
            createdAt: '2025-01-15T10:30:00Z',
            updatedAt: '2025-01-15T10:35:00Z',
            paymentMethod: 'Bank Transfer'
          },
          {
            id: 'txn_002',
            type: 'payment',
            amount: 150,
            currency: 'USD',
            status: 'completed',
            description: 'Circle Booth Registration - Manga Masters',
            reference: 'CIR_002',
            circleId: 'circle_002',
            createdAt: '2025-01-14T14:20:00Z',
            updatedAt: '2025-01-14T14:25:00Z',
            paymentMethod: 'Credit Card',
            exchangeRate: 15800
          },
          {
            id: 'txn_003',
            type: 'refund',
            amount: 1000000,
            currency: 'IDR',
            status: 'pending',
            description: 'Refund for cancelled registration',
            reference: 'REF_001',
            circleId: 'circle_003',
            createdAt: '2025-01-13T09:15:00Z',
            updatedAt: '2025-01-13T09:15:00Z',
            paymentMethod: 'Bank Transfer'
          },
          {
            id: 'txn_004',
            type: 'payment',
            amount: 3500000,
            currency: 'IDR',
            status: 'completed',
            description: 'Circle Booth Registration - Digital Art Studio',
            reference: 'CIR_004',
            circleId: 'circle_004',
            createdAt: '2025-01-12T16:45:00Z',
            updatedAt: '2025-01-12T16:50:00Z',
            paymentMethod: 'E-Wallet'
          },
          {
            id: 'txn_005',
            type: 'payment',
            amount: 200,
            currency: 'USD',
            status: 'completed',
            description: 'Premium Booth Registration - International Comics',
            reference: 'CIR_005',
            circleId: 'circle_005',
            createdAt: '2025-01-11T11:20:00Z',
            updatedAt: '2025-01-11T11:25:00Z',
            paymentMethod: 'Credit Card',
            exchangeRate: 15750
          }
        ]
        
        set({ transactions: mockTransactions })
        get().calculateSummary()
      }
    }),
    {
      name: 'financial-store',
      partialize: (state) => ({
        transactions: state.transactions,
        settings: state.settings,
        exchangeRates: state.exchangeRates,
        paymentMethods: state.paymentMethods
      })
    }
  )
)