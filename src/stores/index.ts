// Export stores
export { useAuthStore } from './authStore'
export { useEventStore } from './eventStore'
export { useCircleStore } from './circleStore'

// Re-export commonly used types
export type UserRole = 'admin' | 'staff' | 'volunteer' | 'circle' | 'attendee'
export type EventStatus = 'draft' | 'published' | 'active' | 'completed'
export type CircleStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'waitlisted'