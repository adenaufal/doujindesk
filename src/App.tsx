import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './components/Dashboard';
import CircleApplicationForm from './components/CircleApplicationForm';
import CircleManagement from './components/CircleManagement';
import BoothAllocation from './components/BoothAllocation';
import TicketingSystem from './components/TicketingSystem';
import FinancialManagement from './components/FinancialManagement';
import StaffCoordination from './components/StaffCoordination';
import EventGuide from './components/EventGuide';
import NotificationCenter from './components/NotificationCenter';
import FontLoader from './components/FontLoader';
import Footer from './components/Footer';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <Router>
      <FontLoader />
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/apply" element={<CircleApplicationForm eventId="default-event-id" />} />
            <Route path="/manage" element={<CircleManagement />} />
            <Route path="/booths" element={<BoothAllocation />} />
            <Route path="/tickets" element={<TicketingSystem />} />
            <Route path="/financial" element={<FinancialManagement />} />
            <Route path="/staff" element={<StaffCoordination />} />
            <Route path="/guide" element={<EventGuide />} />
            <Route path="/notifications" element={<NotificationCenter />} />
          </Routes>
        </main>
        <Footer />
        <Toaster />
      </div>
    </Router>
  );
}

export default App
