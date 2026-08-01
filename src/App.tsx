import { useEffect } from 'react'
import { CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, BrowserRouter as Router, Route, Routes, useParams } from 'react-router-dom'

import RequireRole from './components/RequireRole'
import AppLayout from './components/layout/AppLayout'
import FocusLayout from './components/layout/FocusLayout'
import PublicLayout from './components/layout/PublicLayout'
import { Button } from './components/ui/button'
import { EmptyState } from './components/ui/empty-state'
import { Toaster } from './components/ui/toaster'
import { initAuth } from './stores/authStore'

import Home from './pages/Home'
import Login from './pages/Login'
import AnnouncementSystem from './components/AnnouncementSystem'
import BoothAllocation from './components/BoothAllocation'
import CircleApplicationForm from './components/CircleApplicationForm'
import CircleCatalog from './components/CircleCatalog'
import CircleManagement from './components/CircleManagement'
import Dashboard from './components/Dashboard'
import EventGuide from './components/EventGuide'
import EventSchedule from './components/EventSchedule'
import FinancialManagement from './components/FinancialManagement'
import InteractiveMap from './components/InteractiveMap'
import NotificationCenter from './components/NotificationCenter'
import QueueStatus from './components/QueueStatus'
import StaffCoordination from './components/StaffCoordination'
import TicketScanner from './components/TicketScanner'
import TicketWallet from './components/TicketWallet'
import TicketingSystem from './components/TicketingSystem'
import CircleStatus from './pages/CircleStatus'
import StaffTasks from './pages/StaffTasks'

// -----------------------------------------------------------------------------
// Route table. Guards and chrome nest together as layout routes, so there is no
// way to add a screen that renders without one or the other.
//
// `:eventId` is the single source of truth for event scope — screens read it
// with useParams. Nothing copies it into a store that could drift from the URL.
// -----------------------------------------------------------------------------

function App() {
  useEffect(() => {
    void initAuth()
  }, [])

  return (
    <Router>
      <Routes>
        {/* Public — anyone, signed in or not. */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/e/:eventId" element={<EventGuide />} />
          <Route path="/e/:eventId/catalog" element={<CircleCatalog />} />
          <Route path="/e/:eventId/map" element={<InteractiveMap />} />
          <Route path="/e/:eventId/schedule" element={<EventSchedule />} />
          <Route path="/e/:eventId/tickets" element={<TicketingSystem />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Attendee — the public chrome, because a wallet on a phone does not
            want an admin rail. */}
        <Route
          element={
            <RequireRole roles={['attendee']}>
              <PublicLayout />
            </RequireRole>
          }
        >
          {/* No `:eventId` — the wallet resolves one itself and offers a picker
              when the attendee holds passes for more than one event. */}
          <Route path="/wallet" element={<TicketWallet />} />
        </Route>

        {/* Circle. The apply route renders CircleStatus itself once an
            application exists, so an applicant is never shown an empty form. */}
        <Route
          element={
            <RequireRole roles={['circle']}>
              <PublicLayout />
            </RequireRole>
          }
        >
          <Route path="/e/:eventId/apply" element={<ApplyRoute />} />
          <Route path="/e/:eventId/status" element={<CircleStatus />} />
        </Route>

        {/* Staff scanner — Focus layout, no chrome to mis-tap at the door. */}
        <Route
          element={
            <RequireRole roles={['staff', 'organizer']}>
              <FocusLayout />
            </RequireRole>
          }
        >
          {/* TicketScanner reads :eventId itself and owns its own chrome. */}
          <Route path="/e/:eventId/scan" element={<TicketScanner />} />
        </Route>

        {/* Staff operations. */}
        <Route
          element={
            <RequireRole roles={['staff', 'organizer']}>
              <AppLayout />
            </RequireRole>
          }
        >
          <Route path="/e/:eventId/queue" element={<QueueStatus />} />
          {/* Not event-scoped: a staffer lands here on sign-in, before picking
              an event. The task query scopes on `assigned_to @> [me]` instead. */}
          <Route path="/tasks" element={<StaffTasks />} />
          <Route path="/notifications" element={<NotificationCenter />} />
        </Route>

        {/* Organizer. */}
        <Route
          element={
            <RequireRole roles={['organizer']}>
              <AppLayout />
            </RequireRole>
          }
        >
          <Route path="/e/:eventId/dashboard" element={<Dashboard />} />
          <Route path="/e/:eventId/circles" element={<CircleManagement />} />
          <Route path="/e/:eventId/booths" element={<BoothAllocation />} />
          <Route path="/e/:eventId/financial" element={<FinancialManagement />} />
          <Route path="/e/:eventId/staff" element={<StaffCoordination />} />
          <Route path="/e/:eventId/announcements" element={<AnnouncementSystem />} />
        </Route>
      </Routes>
      <Toaster />
    </Router>
  )
}

function ApplyRoute() {
  const { eventId } = useParams()
  return <CircleApplicationForm eventId={eventId!} />
}

function NotFound() {
  const { t } = useTranslation()
  return (
    <EmptyState
      className="py-20"
      icon={CalendarDays}
      title={t('error.notFound')}
      description={t('empty.noData.description')}
      action={
        <Button asChild>
          <Link to="/">{t('app.name')}</Link>
        </Button>
      }
    />
  )
}

export default App
