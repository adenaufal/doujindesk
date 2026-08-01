import { Outlet } from 'react-router-dom'

/**
 * No nav chrome at all, full-bleed, one screen filling the device.
 *
 * This is what the scanner renders into: a scanner with a sidebar is a scanner
 * that gets mis-tapped at the door, and the operator is looking at the queue,
 * not the phone.
 *
 * The exit affordance belongs to the screen, not to this layout — the scanner
 * draws its own top bar (close ×, event name, sync chip) because only it knows
 * what the sync state is, and a second back button stacked above a `100dvh`
 * viewfinder would push it below the fold.
 */
export function FocusLayout() {
  return (
    <div id="main" className="h-dvh w-full overflow-hidden bg-background">
      <Outlet />
    </div>
  )
}

export default FocusLayout
