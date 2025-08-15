import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Event {
  id: string
  name: string
  description: string
  startDate: string
  endDate: string
  venue: string
  status: 'draft' | 'published' | 'active' | 'completed'
  totalBooths: number
  allocatedBooths: number
  totalTickets: number
  soldTickets: number
  revenue: {
    idr: number
    usd: number
  }
  createdAt: string
  updatedAt: string
}

export interface EventStats {
  totalCircles: number
  totalBooths: number
  allocatedBooths: number
  totalTickets: number
  soldTickets: number
  revenue: {
    idr: number
    usd: number
  }
  staffCount: number
  activeStaff: number
}

interface EventStore {
  currentEvent: Event | null
  events: Event[]
  stats: EventStats
  isLoading: boolean
  error: string | null
  
  // Actions
  setCurrentEvent: (event: Event) => void
  addEvent: (event: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateEvent: (id: string, updates: Partial<Event>) => void
  deleteEvent: (id: string) => void
  updateStats: (stats: Partial<EventStats>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  fetchEvents: () => Promise<void>
  fetchStats: () => Promise<void>
}

export const useEventStore = create<EventStore>()(
  persist(
    (set, _get) => ({
      currentEvent: {
        id: '1',
        name: 'Comic Frontier 18',
        description: 'The biggest doujin convention in Indonesia',
        startDate: '2025-09-14',
        endDate: '2025-09-15',
        venue: 'Jakarta Convention Center',
        status: 'active',
        totalBooths: 500,
        allocatedBooths: 387,
        totalTickets: 10000,
        soldTickets: 7543,
        revenue: {
          idr: 2500000000,
          usd: 165000
        },
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-08-14T00:00:00Z'
      },
      events: [],
      stats: {
        totalCircles: 387,
        totalBooths: 500,
        allocatedBooths: 387,
        totalTickets: 10000,
        soldTickets: 7543,
        revenue: {
          idr: 2500000000,
          usd: 165000
        },
        staffCount: 25,
        activeStaff: 18
      },
      isLoading: false,
      error: null,

      setCurrentEvent: (event) => set({ currentEvent: event }),
      
      addEvent: (eventData) => {
        const newEvent: Event = {
          ...eventData,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        set((state) => ({ events: [...state.events, newEvent] }))
      },
      
      updateEvent: (id, updates) => {
        set((state) => ({
          events: state.events.map(event => 
            event.id === id 
              ? { ...event, ...updates, updatedAt: new Date().toISOString() }
              : event
          ),
          currentEvent: state.currentEvent?.id === id 
            ? { ...state.currentEvent, ...updates, updatedAt: new Date().toISOString() }
            : state.currentEvent
        }))
      },
      
      deleteEvent: (id) => {
        set((state) => ({
          events: state.events.filter(event => event.id !== id),
          currentEvent: state.currentEvent?.id === id ? null : state.currentEvent
        }))
      },
      
      updateStats: (newStats) => {
        set((state) => ({
          stats: { ...state.stats, ...newStats }
        }))
      },
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),
      
      fetchEvents: async () => {
        set({ isLoading: true, error: null })
        try {
          // TODO: Implement actual API call to Supabase
          // For now, using mock data
          await new Promise(resolve => setTimeout(resolve, 1000))
          set({ isLoading: false })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to fetch events',
            isLoading: false 
          })
        }
      },
      
      fetchStats: async () => {
        set({ isLoading: true, error: null })
        try {
          // TODO: Implement actual API call to Supabase
          // For now, using mock data
          await new Promise(resolve => setTimeout(resolve, 500))
          set({ isLoading: false })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to fetch stats',
            isLoading: false 
          })
        }
      }
    }),
    {
      name: 'event-store',
      partialize: (state) => ({
        currentEvent: state.currentEvent,
        events: state.events,
        stats: state.stats
      })
    }
  )
)