import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface StaffMember {
  id: string
  name: string
  email: string
  role: 'Admin' | 'Staff Manager' | 'Staff Member' | 'Volunteer'
  department: string
  status: 'Active' | 'Inactive' | 'On Break'
  joinDate: string
  avatar?: string
  phone?: string
  emergencyContact?: string
  skills: string[]
  certifications: string[]
  permissions: string[]
  lastLogin?: string
  notes?: string
}

export interface Task {
  id: string
  title: string
  description: string
  assignedTo: string[]
  assignedBy: string
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled'
  dueDate: string
  createdAt: string
  updatedAt?: string
  category: 'Setup' | 'Operations' | 'Security' | 'Customer Service' | 'Cleanup' | 'Emergency'
  location?: string
  estimatedHours?: number
  actualHours?: number
  notes?: string
  attachments?: string[]
  completedAt?: string
  completedBy?: string
}

export interface Shift {
  id: string
  staffId: string
  date: string
  startTime: string
  endTime: string
  position: string
  location: string
  status: 'Scheduled' | 'Confirmed' | 'Completed' | 'No Show' | 'Cancelled'
  breakTime?: number
  notes?: string
  checkInTime?: string
  checkOutTime?: string
  actualHours?: number
  overtime?: number
}

export interface Incident {
  id: string
  title: string
  description: string
  reportedBy: string
  severity: 'Low' | 'Medium' | 'High' | 'Critical'
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed'
  category: 'Safety' | 'Security' | 'Technical' | 'Customer' | 'Staff' | 'Equipment'
  location: string
  timestamp: string
  assignedTo?: string
  resolution?: string
  resolvedAt?: string
  resolvedBy?: string
  followUpRequired?: boolean
  attachments?: string[]
  witnesses?: string[]
}

export interface Message {
  id: string
  senderId: string
  senderName: string
  content: string
  timestamp: string
  channel: 'General' | 'Security' | 'Operations' | 'Emergency' | 'Management'
  priority: 'Normal' | 'High' | 'Urgent'
  readBy: string[]
  attachments?: string[]
  replyTo?: string
  edited?: boolean
  editedAt?: string
}

export interface StaffInvitation {
  id: string
  email: string
  role: StaffMember['role']
  department: string
  invitedBy: string
  invitedAt: string
  status: 'Pending' | 'Accepted' | 'Declined' | 'Expired'
  expiresAt: string
  token: string
}

export interface PerformanceMetric {
  staffId: string
  period: string // YYYY-MM format
  tasksCompleted: number
  tasksAssigned: number
  averageCompletionTime: number // in hours
  shiftsWorked: number
  shiftsScheduled: number
  punctualityScore: number // 0-100
  incidentsReported: number
  incidentsResolved: number
  rating: number // 1-5
  feedback?: string
  goals?: string[]
}

interface StaffState {
  // Staff Management
  staffMembers: StaffMember[]
  currentUser: StaffMember | null
  invitations: StaffInvitation[]
  
  // Task Management
  tasks: Task[]
  taskFilters: {
    status?: string
    priority?: string
    assignedTo?: string
    category?: string
    search?: string
  }
  
  // Schedule Management
  shifts: Shift[]
  scheduleFilters: {
    date?: string
    staffId?: string
    position?: string
    status?: string
  }
  
  // Incident Management
  incidents: Incident[]
  incidentFilters: {
    severity?: string
    status?: string
    category?: string
    assignedTo?: string
    search?: string
  }
  
  // Communication
  messages: Message[]
  activeChannel: string
  unreadCounts: Record<string, number>
  
  // Performance
  performanceMetrics: PerformanceMetric[]
  
  // UI State
  loading: boolean
  error: string | null
  selectedStaffId: string | null
  selectedTaskId: string | null
  selectedIncidentId: string | null
}

interface StaffActions {
  // Staff Management Actions
  addStaffMember: (staff: Omit<StaffMember, 'id'>) => void
  updateStaffMember: (id: string, updates: Partial<StaffMember>) => void
  removeStaffMember: (id: string) => void
  setCurrentUser: (user: StaffMember) => void
  inviteStaff: (invitation: Omit<StaffInvitation, 'id' | 'invitedAt' | 'token'>) => void
  updateInvitation: (id: string, status: StaffInvitation['status']) => void
  
  // Task Management Actions
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  assignTask: (taskId: string, staffIds: string[]) => void
  completeTask: (id: string, completedBy: string, actualHours?: number, notes?: string) => void
  setTaskFilters: (filters: Partial<StaffState['taskFilters']>) => void
  
  // Schedule Management Actions
  addShift: (shift: Omit<Shift, 'id'>) => void
  updateShift: (id: string, updates: Partial<Shift>) => void
  deleteShift: (id: string) => void
  checkInShift: (id: string, checkInTime: string) => void
  checkOutShift: (id: string, checkOutTime: string) => void
  setScheduleFilters: (filters: Partial<StaffState['scheduleFilters']>) => void
  
  // Incident Management Actions
  reportIncident: (incident: Omit<Incident, 'id' | 'timestamp'>) => void
  updateIncident: (id: string, updates: Partial<Incident>) => void
  assignIncident: (id: string, assignedTo: string) => void
  resolveIncident: (id: string, resolution: string, resolvedBy: string) => void
  setIncidentFilters: (filters: Partial<StaffState['incidentFilters']>) => void
  
  // Communication Actions
  sendMessage: (message: Omit<Message, 'id' | 'timestamp' | 'readBy'>) => void
  markMessageAsRead: (messageId: string, userId: string) => void
  setActiveChannel: (channel: string) => void
  updateUnreadCount: (channel: string, count: number) => void
  
  // Performance Actions
  updatePerformanceMetric: (metric: PerformanceMetric) => void
  getStaffPerformance: (staffId: string, period?: string) => PerformanceMetric | undefined
  
  // UI Actions
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setSelectedStaffId: (id: string | null) => void
  setSelectedTaskId: (id: string | null) => void
  setSelectedIncidentId: (id: string | null) => void
  
  // Utility Actions
  clearFilters: () => void
  resetStore: () => void
}

const initialState: StaffState = {
  staffMembers: [],
  currentUser: null,
  invitations: [],
  tasks: [],
  taskFilters: {},
  shifts: [],
  scheduleFilters: {},
  incidents: [],
  incidentFilters: {},
  messages: [],
  activeChannel: 'General',
  unreadCounts: {},
  performanceMetrics: [],
  loading: false,
  error: null,
  selectedStaffId: null,
  selectedTaskId: null,
  selectedIncidentId: null
}

export const useStaffStore = create<StaffState & StaffActions>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Staff Management Actions
      addStaffMember: (staff) => {
        const newStaff: StaffMember = {
          ...staff,
          id: `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
        set((state) => ({
          staffMembers: [...state.staffMembers, newStaff]
        }))
      },
      
      updateStaffMember: (id, updates) => {
        set((state) => ({
          staffMembers: state.staffMembers.map(staff => 
            staff.id === id ? { ...staff, ...updates } : staff
          )
        }))
      },
      
      removeStaffMember: (id) => {
        set((state) => ({
          staffMembers: state.staffMembers.filter(staff => staff.id !== id)
        }))
      },
      
      setCurrentUser: (user) => {
        set({ currentUser: user })
      },
      
      inviteStaff: (invitation) => {
        const newInvitation: StaffInvitation = {
          ...invitation,
          id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          invitedAt: new Date().toISOString(),
          token: Math.random().toString(36).substr(2, 32),
          status: 'Pending'
        }
        set((state) => ({
          invitations: [...state.invitations, newInvitation]
        }))
      },
      
      updateInvitation: (id, status) => {
        set((state) => ({
          invitations: state.invitations.map(inv => 
            inv.id === id ? { ...inv, status } : inv
          )
        }))
      },
      
      // Task Management Actions
      addTask: (task) => {
        const newTask: Task = {
          ...task,
          id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          status: 'Pending'
        }
        set((state) => ({
          tasks: [...state.tasks, newTask]
        }))
      },
      
      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map(task => 
            task.id === id ? { ...task, ...updates, updatedAt: new Date().toISOString() } : task
          )
        }))
      },
      
      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter(task => task.id !== id)
        }))
      },
      
      assignTask: (taskId, staffIds) => {
        set((state) => ({
          tasks: state.tasks.map(task => 
            task.id === taskId ? { ...task, assignedTo: staffIds, updatedAt: new Date().toISOString() } : task
          )
        }))
      },
      
      completeTask: (id, completedBy, actualHours, notes) => {
        set((state) => ({
          tasks: state.tasks.map(task => 
            task.id === id ? {
              ...task,
              status: 'Completed' as const,
              completedAt: new Date().toISOString(),
              completedBy,
              actualHours,
              notes: notes || task.notes,
              updatedAt: new Date().toISOString()
            } : task
          )
        }))
      },
      
      setTaskFilters: (filters) => {
        set((state) => ({
          taskFilters: { ...state.taskFilters, ...filters }
        }))
      },
      
      // Schedule Management Actions
      addShift: (shift) => {
        const newShift: Shift = {
          ...shift,
          id: `shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
        set((state) => ({
          shifts: [...state.shifts, newShift]
        }))
      },
      
      updateShift: (id, updates) => {
        set((state) => ({
          shifts: state.shifts.map(shift => 
            shift.id === id ? { ...shift, ...updates } : shift
          )
        }))
      },
      
      deleteShift: (id) => {
        set((state) => ({
          shifts: state.shifts.filter(shift => shift.id !== id)
        }))
      },
      
      checkInShift: (id, checkInTime) => {
        set((state) => ({
          shifts: state.shifts.map(shift => 
            shift.id === id ? { ...shift, checkInTime, status: 'Confirmed' as const } : shift
          )
        }))
      },
      
      checkOutShift: (id, checkOutTime) => {
        set((state) => ({
          shifts: state.shifts.map(shift => {
            if (shift.id === id) {
              const startTime = new Date(`${shift.date}T${shift.startTime}`)
              const endTime = new Date(`${shift.date}T${checkOutTime}`)
              const actualHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
              
              return {
                ...shift,
                checkOutTime,
                actualHours,
                status: 'Completed' as const
              }
            }
            return shift
          })
        }))
      },
      
      setScheduleFilters: (filters) => {
        set((state) => ({
          scheduleFilters: { ...state.scheduleFilters, ...filters }
        }))
      },
      
      // Incident Management Actions
      reportIncident: (incident) => {
        const newIncident: Incident = {
          ...incident,
          id: `inc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          status: 'Open'
        }
        set((state) => ({
          incidents: [...state.incidents, newIncident]
        }))
      },
      
      updateIncident: (id, updates) => {
        set((state) => ({
          incidents: state.incidents.map(incident => 
            incident.id === id ? { ...incident, ...updates } : incident
          )
        }))
      },
      
      assignIncident: (id, assignedTo) => {
        set((state) => ({
          incidents: state.incidents.map(incident => 
            incident.id === id ? { ...incident, assignedTo, status: 'In Progress' as const } : incident
          )
        }))
      },
      
      resolveIncident: (id, resolution, resolvedBy) => {
        set((state) => ({
          incidents: state.incidents.map(incident => 
            incident.id === id ? {
              ...incident,
              status: 'Resolved' as const,
              resolution,
              resolvedBy,
              resolvedAt: new Date().toISOString()
            } : incident
          )
        }))
      },
      
      setIncidentFilters: (filters) => {
        set((state) => ({
          incidentFilters: { ...state.incidentFilters, ...filters }
        }))
      },
      
      // Communication Actions
      sendMessage: (message) => {
        const newMessage: Message = {
          ...message,
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          readBy: [message.senderId]
        }
        set((state) => ({
          messages: [...state.messages, newMessage]
        }))
      },
      
      markMessageAsRead: (messageId, userId) => {
        set((state) => ({
          messages: state.messages.map(message => 
            message.id === messageId && !message.readBy.includes(userId)
              ? { ...message, readBy: [...message.readBy, userId] }
              : message
          )
        }))
      },
      
      setActiveChannel: (channel) => {
        set({ activeChannel: channel })
      },
      
      updateUnreadCount: (channel, count) => {
        set((state) => ({
          unreadCounts: { ...state.unreadCounts, [channel]: count }
        }))
      },
      
      // Performance Actions
      updatePerformanceMetric: (metric) => {
        set((state) => {
          const existingIndex = state.performanceMetrics.findIndex(
            m => m.staffId === metric.staffId && m.period === metric.period
          )
          
          if (existingIndex >= 0) {
            const updated = [...state.performanceMetrics]
            updated[existingIndex] = metric
            return { performanceMetrics: updated }
          } else {
            return { performanceMetrics: [...state.performanceMetrics, metric] }
          }
        })
      },
      
      getStaffPerformance: (staffId, period) => {
        const state = get()
        return state.performanceMetrics.find(
          m => m.staffId === staffId && (!period || m.period === period)
        )
      },
      
      // UI Actions
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setSelectedStaffId: (id) => set({ selectedStaffId: id }),
      setSelectedTaskId: (id) => set({ selectedTaskId: id }),
      setSelectedIncidentId: (id) => set({ selectedIncidentId: id }),
      
      // Utility Actions
      clearFilters: () => {
        set({
          taskFilters: {},
          scheduleFilters: {},
          incidentFilters: {}
        })
      },
      
      resetStore: () => {
        set(initialState)
      }
    }),
    {
      name: 'doujindesk-staff-store',
      partialize: (state) => ({
        staffMembers: state.staffMembers,
        currentUser: state.currentUser,
        tasks: state.tasks,
        shifts: state.shifts,
        incidents: state.incidents,
        messages: state.messages,
        performanceMetrics: state.performanceMetrics
      })
    }
  )
)

// Selectors for computed values
export const useStaffSelectors = () => {
  const store = useStaffStore()
  
  return {
    // Staff selectors
    getActiveStaff: () => store.staffMembers.filter(s => s.status === 'Active'),
    getStaffByRole: (role: StaffMember['role']) => store.staffMembers.filter(s => s.role === role),
    getStaffByDepartment: (department: string) => store.staffMembers.filter(s => s.department === department),
    
    // Task selectors
    getActiveTasks: () => store.tasks.filter(t => t.status === 'In Progress' || t.status === 'Pending'),
    getTasksByPriority: (priority: Task['priority']) => store.tasks.filter(t => t.priority === priority),
    getTasksByAssignee: (staffId: string) => store.tasks.filter(t => t.assignedTo.includes(staffId)),
    getOverdueTasks: () => store.tasks.filter(t => 
      (t.status === 'Pending' || t.status === 'In Progress') && 
      new Date(t.dueDate) < new Date()
    ),
    
    // Schedule selectors
    getTodayShifts: () => {
      const today = new Date().toISOString().split('T')[0]
      return store.shifts.filter(s => s.date === today)
    },
    getShiftsByStaff: (staffId: string) => store.shifts.filter(s => s.staffId === staffId),
    getUpcomingShifts: () => {
      const today = new Date().toISOString().split('T')[0]
      return store.shifts.filter(s => s.date >= today && s.status === 'Scheduled')
    },
    
    // Incident selectors
    getOpenIncidents: () => store.incidents.filter(i => i.status === 'Open' || i.status === 'In Progress'),
    getCriticalIncidents: () => store.incidents.filter(i => i.severity === 'Critical' || i.severity === 'High'),
    getIncidentsByAssignee: (staffId: string) => store.incidents.filter(i => i.assignedTo === staffId),
    
    // Message selectors
    getChannelMessages: (channel: string) => store.messages.filter(m => m.channel === channel),
    getUnreadMessages: (userId: string) => store.messages.filter(m => !m.readBy.includes(userId)),
    getUrgentMessages: () => store.messages.filter(m => m.priority === 'Urgent'),
    
    // Performance selectors
    getStaffPerformanceMetrics: (staffId: string) => 
      store.performanceMetrics.filter(m => m.staffId === staffId),
    getTopPerformers: (period?: string) => {
      const metrics = period 
        ? store.performanceMetrics.filter(m => m.period === period)
        : store.performanceMetrics
      return metrics.sort((a, b) => b.rating - a.rating).slice(0, 5)
    }
  }
}