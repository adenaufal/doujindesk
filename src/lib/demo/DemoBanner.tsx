import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'

import { DEMO_ACCOUNTS, DEMO_MODE, DEMO_SCAN_CODES } from '.'
import { demoSignInAs } from './client'

/**
 * The demo banner and role picker.
 *
 * Mounted from `src/main.tsx` outside the router, so it is visible on every route
 * including `/login`, and so no layout owned by another package has to change.
 * It returns null when demo mode is off — and `main.tsx` does not even render it
 * then, so the picker is not wired, not merely hidden.
 *
 * Deliberately not translated: this is a development affordance, not product
 * surface, and an i18n namespace here would have to be kept key-identical across
 * three locales forever for text the end user never sees.
 */
export function DemoBanner() {
  const [open, setOpen] = useState(false)
  const [minimised, setMinimised] = useState(false)
  const role = useAuthStore((s) => s.role)
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)

  if (!DEMO_MODE) return null

  if (minimised) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-2">
        <Button
          variant="outline"
          size="sm"
          className="pointer-events-auto coarse:min-h-11 border-warning/50 bg-warning-subtle text-warning-foreground"
          onClick={() => setMinimised(false)}
        >
          Demo mode
        </Button>
      </div>
    )
  }

  return (
    <aside
      aria-label="Demo mode"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-warning/40 bg-warning-subtle text-warning-foreground shadow-lg"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 p-3">
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">Demo mode.</span>{' '}
          <span className="text-warning-foreground/85">
            Fixture data, no database. Changes are lost on reload.
          </span>
        </p>

        <span className="text-sm">
          {role ? (
            <>
              Signed in as <strong className="font-semibold">{user?.name}</strong> ({role})
            </>
          ) : (
            'Not signed in'
          )}
        </span>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="coarse:min-h-11 border-warning/50 bg-transparent"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {role ? 'Switch role' : 'Sign in'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="coarse:min-h-11"
            onClick={() => setMinimised(true)}
          >
            Hide
          </Button>
        </div>

        {open && (
          <div className="w-full border-t border-warning/30 pt-3">
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.role}>
                  <button
                    type="button"
                    onClick={() => {
                      demoSignInAs(account.id)
                      setOpen(false)
                    }}
                    aria-current={role === account.role || undefined}
                    className="flex w-full flex-col items-start gap-0.5 rounded-md border border-warning/40 bg-background/70 px-3 py-2 text-left coarse:min-h-11 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current]:border-primary aria-[current]:ring-1 aria-[current]:ring-primary"
                  >
                    <span className="text-sm font-semibold capitalize text-foreground">
                      {account.role}
                    </span>
                    <span className="text-xs text-muted-foreground">{account.name}</span>
                    <span className="text-xs text-muted-foreground">{account.blurb}</span>
                  </button>
                </li>
              ))}
            </ul>

            <p className="mt-3 text-xs text-warning-foreground/85">
              Scanner test codes — valid:{' '}
              <code className="font-mono">{DEMO_SCAN_CODES.valid}</code>, already used:{' '}
              <code className="font-mono">{DEMO_SCAN_CODES.alreadyUsed}</code>
            </p>

            {role && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 coarse:min-h-11"
                onClick={() => {
                  void signOut()
                  setOpen(false)
                }}
              >
                Sign out
              </Button>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

export default DemoBanner
