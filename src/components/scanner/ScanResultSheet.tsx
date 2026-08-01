import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, CloudOff, TriangleAlert, XCircle } from 'lucide-react'
import type { ScanOutcome, ScanOutcomeKind } from '@/lib/scanContract'
import { Button } from '../ui/button'

/**
 * The bottom sheet, following the Luma check-in pattern: the camera never
 * leaves the screen, the answer slides up over it.
 *
 * Four colours, and the amber one is the point. `queued` means "this device
 * accepted it, the server has not agreed yet" and it must never look like the
 * green one — an operator working a door has to be able to tell an admission
 * from a probable admission at a glance, in a loud hall, without reading.
 */

/** Shared with the top pill in TicketScanner so one outcome never gets two colours. */
export const OUTCOME_TONE: Record<ScanOutcomeKind, string> = {
  admitted: 'bg-success text-success-foreground',
  duplicate: 'bg-destructive text-destructive-foreground',
  rejected: 'bg-destructive text-destructive-foreground',
  queued: 'bg-warning text-warning-foreground',
}

const OUTCOME_ICON = {
  admitted: CheckCircle2,
  duplicate: TriangleAlert,
  rejected: XCircle,
  queued: CloudOff,
}

/** `scanner.result.duplicate` (an i18next key from the contract) → `scanner:result.duplicate`. */
export const nsKey = (contractKey: string) => contractKey.replace('.', ':')

export function formatTime(iso?: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

interface ScanResultSheetProps {
  outcome: ScanOutcome | null
  onDismiss: () => void
}

export function ScanResultSheet({ outcome, onDismiss }: ScanResultSheetProps) {
  const { t } = useTranslation('scanner')
  const dismissRef = useRef<HTMLButtonElement>(null)

  // A failure has to be dismissed deliberately, so put the keyboard on the
  // button that does it and leave it on screen until someone taps. A success
  // clears itself after ~2s — the queue is moving — and stealing focus for it
  // would fight the operator's next scan.
  //
  // `autoDismiss` comes from the contract, not from this component: it is false
  // for every outcome except a confirmed admission, which is what stops a
  // conflict from fading away unseen.
  useEffect(() => {
    if (!outcome) return
    if (!outcome.autoDismiss) {
      dismissRef.current?.focus()
      return
    }
    const timer = window.setTimeout(onDismiss, 2000)
    return () => window.clearTimeout(timer)
  }, [outcome, onDismiss])

  if (!outcome) return null

  const Icon = OUTCOME_ICON[outcome.kind]
  const title = t(nsKey(outcome.message))
  const body = t(`${nsKey(outcome.message)}Body`, {
    defaultValue: '',
    time: formatTime(outcome.detail?.at),
    staff: outcome.detail?.device ?? outcome.detail?.gate ?? '—',
  })

  const rows: Array<[string, string]> = []
  if (outcome.detail?.holder) rows.push([t('ticket.holder'), outcome.detail.holder])
  if (outcome.detail?.tier) rows.push([t('ticket.tier'), outcome.detail.tier])
  if (outcome.kind === 'admitted' && outcome.detail?.at) {
    rows.push([t('ticket.scannedAt'), formatTime(outcome.detail.at)])
  }
  if (outcome.kind === 'duplicate') {
    rows.push([
      t('conflict.firstScan', {
        time: formatTime(outcome.detail?.at),
        gate: outcome.detail?.gate ?? outcome.detail?.device ?? '—',
      }),
      '',
    ])
  }

  return (
    <div
      // `role=alert` for anything that stops a person at the door; a success is
      // polite so it does not interrupt a screen reader mid-sentence.
      role={outcome.autoDismiss ? 'status' : 'alert'}
      aria-live={outcome.autoDismiss ? 'polite' : 'assertive'}
      className="pointer-events-auto w-full rounded-t-xl border-t bg-card shadow-lg animate-in slide-in-from-bottom duration-200"
    >
      <div className={`flex items-center gap-3 rounded-t-xl px-4 py-3 ${OUTCOME_TONE[outcome.kind]}`}>
        <Icon className="size-6 shrink-0" aria-hidden="true" />
        <p className="text-base font-semibold leading-tight">{title}</p>
      </div>

      <div className="space-y-3 px-4 py-4">
        {body ? <p className="text-sm text-muted-foreground">{body}</p> : null}

        {rows.length > 0 ? (
          <dl className="space-y-1.5">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <Button
          ref={dismissRef}
          variant={outcome.kind === 'admitted' ? 'outline' : 'default'}
          className="w-full"
          onClick={onDismiss}
        >
          {t('result.dismiss')}
        </Button>
        {/* ponytail: no Undo button. Undoing an admission needs a `void_scan`
            RPC that 003 does not have and this package cannot add a migration
            for — and a button that lies about reversing a door admission is
            worse than no button. Upgrade path: migration 007 adds
            void_scan(client_scan_id) writing a compensating row, then this sheet
            grows the control. */}
      </div>
    </div>
  )
}

export default ScanResultSheet
