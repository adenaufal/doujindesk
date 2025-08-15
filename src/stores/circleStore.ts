import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Circle {
  id: string
  name: string
  email: string
  description: string
  genre: string
  website?: string
  twitter?: string
  instagram?: string
  pixiv?: string
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'waitlisted'
  registrationType: 'circle_space' | 'circle_booth'
  spaceType?: '1_space' | '2_space' | '4_space'
  boothType?: 'booth_a' | 'booth_b'
  pricing: {
    basePrice: number
    currency: 'IDR' | 'USD'
    additionalFees: number
    totalPrice: number
  }
  sampleWorks: string[]
  circleCut?: string
  submittedAt?: string
  reviewedAt?: string
  approvedAt?: string
  createdAt: string
  updatedAt: string
}

export interface CircleApplication {
  id: string
  circleId: string
  eventId: string
  formData: Record<string, any>
  files: {
    sampleWorks: File[]
    circleCut?: File
  }
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected'
  submittedAt?: string
  reviewedAt?: string
  reviewNotes?: string
  createdAt: string
  updatedAt: string
}

interface CircleStore {
  circles: Circle[]
  applications: CircleApplication[]
  currentApplication: CircleApplication | null
  isLoading: boolean
  error: string | null
  
  // Actions
  addCircle: (circle: Omit<Circle, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateCircle: (id: string, updates: Partial<Circle>) => void
  deleteCircle: (id: string) => void
  getCircleById: (id: string) => Circle | undefined
  getCirclesByStatus: (status: Circle['status']) => Circle[]
  
  // Application actions
  createApplication: (application: Omit<CircleApplication, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateApplication: (id: string, updates: Partial<CircleApplication>) => void
  submitApplication: (id: string) => void
  reviewApplication: (id: string, status: 'approved' | 'rejected', notes?: string) => void
  setCurrentApplication: (application: CircleApplication | null) => void
  
  // Utility actions
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  fetchCircles: () => Promise<void>
  fetchApplications: () => Promise<void>
  
  // Statistics
  getStats: () => {
    total: number
    byStatus: Record<Circle['status'], number>
    byType: Record<string, number>
    revenue: { idr: number; usd: number }
  }
}

export const useCircleStore = create<CircleStore>()(
  persist(
    (set, get) => ({
      circles: [
        {
          id: '1',
          name: 'Sakura Studios',
          email: 'contact@sakurastudios.com',
          description: 'Original manga and illustrations featuring slice-of-life stories',
          genre: 'Original',
          website: 'https://sakurastudios.com',
          twitter: '@sakurastudios',
          instagram: 'sakura_studios_art',
          status: 'approved',
          registrationType: 'circle_space',
          spaceType: '2_space',
          pricing: {
            basePrice: 150000,
            currency: 'IDR',
            additionalFees: 25000,
            totalPrice: 175000
          },
          sampleWorks: ['sample1.jpg', 'sample2.jpg'],
          circleCut: 'circle_cut_1.jpg',
          submittedAt: '2025-07-15T10:00:00Z',
          reviewedAt: '2025-07-20T14:30:00Z',
          approvedAt: '2025-07-20T14:30:00Z',
          createdAt: '2025-07-15T09:45:00Z',
          updatedAt: '2025-07-20T14:30:00Z'
        },
        {
          id: '2',
          name: 'Digital Dreams',
          email: 'info@digitaldreams.id',
          description: 'Fan art and doujinshi for popular anime series',
          genre: 'Fanart',
          twitter: '@digitaldreams_id',
          status: 'under_review',
          registrationType: 'circle_booth',
          boothType: 'booth_a',
          pricing: {
            basePrice: 300000,
            currency: 'IDR',
            additionalFees: 50000,
            totalPrice: 350000
          },
          sampleWorks: ['sample3.jpg'],
          submittedAt: '2025-08-01T16:20:00Z',
          createdAt: '2025-08-01T15:45:00Z',
          updatedAt: '2025-08-01T16:20:00Z'
        }
      ],
      applications: [],
      currentApplication: null,
      isLoading: false,
      error: null,

      addCircle: (circleData) => {
        const newCircle: Circle = {
          ...circleData,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        set((state) => ({ circles: [...state.circles, newCircle] }))
      },
      
      updateCircle: (id, updates) => {
        set((state) => ({
          circles: state.circles.map(circle => 
            circle.id === id 
              ? { ...circle, ...updates, updatedAt: new Date().toISOString() }
              : circle
          )
        }))
      },
      
      deleteCircle: (id) => {
        set((state) => ({
          circles: state.circles.filter(circle => circle.id !== id)
        }))
      },
      
      getCircleById: (id) => {
        return get().circles.find(circle => circle.id === id)
      },
      
      getCirclesByStatus: (status) => {
        return get().circles.filter(circle => circle.status === status)
      },
      
      createApplication: (applicationData) => {
        const newApplication: CircleApplication = {
          ...applicationData,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        set((state) => ({ applications: [...state.applications, newApplication] }))
      },
      
      updateApplication: (id, updates) => {
        set((state) => ({
          applications: state.applications.map(app => 
            app.id === id 
              ? { ...app, ...updates, updatedAt: new Date().toISOString() }
              : app
          )
        }))
      },
      
      submitApplication: (id) => {
        set((state) => ({
          applications: state.applications.map(app => 
            app.id === id 
              ? { 
                  ...app, 
                  status: 'submitted', 
                  submittedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString() 
                }
              : app
          )
        }))
      },
      
      reviewApplication: (id, status, notes) => {
        set((state) => ({
          applications: state.applications.map(app => 
            app.id === id 
              ? { 
                  ...app, 
                  status, 
                  reviewNotes: notes,
                  reviewedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString() 
                }
              : app
          )
        }))
      },
      
      setCurrentApplication: (application) => {
        set({ currentApplication: application })
      },
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),
      
      fetchCircles: async () => {
        set({ isLoading: true, error: null })
        try {
          // TODO: Implement actual API call to Supabase
          await new Promise(resolve => setTimeout(resolve, 1000))
          set({ isLoading: false })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to fetch circles',
            isLoading: false 
          })
        }
      },
      
      fetchApplications: async () => {
        set({ isLoading: true, error: null })
        try {
          // TODO: Implement actual API call to Supabase
          await new Promise(resolve => setTimeout(resolve, 1000))
          set({ isLoading: false })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to fetch applications',
            isLoading: false 
          })
        }
      },
      
      getStats: () => {
        const { circles } = get()
        const stats = {
          total: circles.length,
          byStatus: {
            draft: 0,
            submitted: 0,
            under_review: 0,
            approved: 0,
            rejected: 0,
            waitlisted: 0
          } as Record<Circle['status'], number>,
          byType: {
            circle_space: 0,
            circle_booth: 0
          },
          revenue: { idr: 0, usd: 0 }
        }
        
        circles.forEach(circle => {
          stats.byStatus[circle.status]++
          stats.byType[circle.registrationType]++
          
          if (circle.status === 'approved') {
            if (circle.pricing.currency === 'IDR') {
              stats.revenue.idr += circle.pricing.totalPrice
            } else {
              stats.revenue.usd += circle.pricing.totalPrice
            }
          }
        })
        
        return stats
      }
    }),
    {
      name: 'circle-store',
      partialize: (state) => ({
        circles: state.circles,
        applications: state.applications,
        currentApplication: state.currentApplication
      })
    }
  )
)