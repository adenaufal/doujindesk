import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'staff' | 'volunteer' | 'circle' | 'attendee'
  avatar?: string
  permissions: string[]
  createdAt: string
  lastLoginAt: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  sessionToken: string | null
}

interface AuthStore extends AuthState {
  // Computed properties
  userRole: string | null
  
  // Actions
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (userData: Omit<User, 'id' | 'createdAt' | 'lastLoginAt'>) => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<void>
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  checkAuth: () => Promise<void>
  hasPermission: (permission: string) => boolean
  hasRole: (role: string | string[]) => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: {
        id: '1',
        email: 'admin@doujindesk.com',
        name: 'Admin User',
        role: 'admin',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        permissions: [
          'events.manage',
          'circles.manage',
          'booths.manage',
          'tickets.manage',
          'financial.view',
          'staff.manage',
          'reports.view'
        ],
        createdAt: '2025-01-15T00:00:00Z',
        lastLoginAt: new Date('2025-12-15T08:30:00').toISOString()
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      sessionToken: 'mock-session-token',
      
      // Computed properties
      get userRole() {
        return get().user?.role || null
      },

      login: async (email, _password) => {
        set({ isLoading: true, error: null })
        try {
          // TODO: Implement actual authentication with Supabase
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Mock user data based on email
          const mockUser: User = {
            id: '1',
            email,
            name: email.includes('admin') ? 'Admin User' : 'Staff User',
            role: email.includes('admin') ? 'admin' : 'staff',
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
            permissions: email.includes('admin') 
              ? ['events.manage', 'circles.manage', 'booths.manage', 'tickets.manage', 'financial.view', 'staff.manage', 'reports.view']
              : ['circles.view', 'booths.view', 'tickets.view'],
            createdAt: '2024-01-01T00:00:00Z',
            lastLoginAt: new Date().toISOString()
          }
          
          set({ 
            user: mockUser,
            isAuthenticated: true,
            sessionToken: 'mock-session-token',
            isLoading: false 
          })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false 
          })
        }
      },

      logout: () => {
        set({ 
          user: null,
          isAuthenticated: false,
          sessionToken: null,
          error: null 
        })
      },

      register: async (userData) => {
        set({ isLoading: true, error: null })
        try {
          // TODO: Implement actual registration with Supabase
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          const newUser: User = {
            ...userData,
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
          }
          
          set({ 
            user: newUser,
            isAuthenticated: true,
            sessionToken: 'mock-session-token',
            isLoading: false 
          })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Registration failed',
            isLoading: false 
          })
        }
      },

      updateProfile: async (updates) => {
        const { user } = get()
        if (!user) return
        
        set({ isLoading: true, error: null })
        try {
          // TODO: Implement actual profile update with Supabase
          await new Promise(resolve => setTimeout(resolve, 500))
          
          const updatedUser = { ...user, ...updates }
          set({ user: updatedUser, isLoading: false })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Profile update failed',
            isLoading: false 
          })
        }
      },

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),

      checkAuth: async () => {
        set({ isLoading: true })
        try {
          // TODO: Implement actual auth check with Supabase
          await new Promise(resolve => setTimeout(resolve, 500))
          
          const { sessionToken } = get()
          if (!sessionToken) {
            set({ user: null, isAuthenticated: false, isLoading: false })
            return
          }
          
          // Mock auth check - in real app, validate token with backend
          set({ isLoading: false })
        } catch (error) {
          set({ 
            user: null,
            isAuthenticated: false,
            sessionToken: null,
            error: error instanceof Error ? error.message : 'Auth check failed',
            isLoading: false 
          })
        }
      },

      hasPermission: (permission) => {
        const { user } = get()
        return user?.permissions.includes(permission) || false
      },

      hasRole: (role) => {
        const { user } = get()
        if (!user) return false
        
        if (Array.isArray(role)) {
          return role.includes(user.role)
        }
        return user.role === role
      }
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        sessionToken: state.sessionToken
      })
    }
  )
)