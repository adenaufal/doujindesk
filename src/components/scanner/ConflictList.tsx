import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import type { QueuedScan } from '@/lib/scanQueue'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import { ScrollArea } from '../ui/scroll-area'
import { formatTime, nsKey } from './ScanResultSheet'

/**
 * The visible half of criterion 3.
 *
 * A scan the server refused — because another gate already admitted that pass,
 * because the code is not a ticket, because the order was never paid — is not a
 * toast. It sits here with a count on it until a human opens the list and
 * acknowledges each one. A conflict that disappears on a timer is
 * indistinguishable, from the operator's side, from the silent double-admit
 * this whole package exists to prevent.
 */
interface ConflictListProps {
  conflicts: QueuedScan[]
  onAcknowledge: (clientScanId: string) => void
  onAcknowledgeAll: () => void
}

export function ConflictList({ conflicts, onAcknowledge, onAcknowledgeAll }: ConflictListProps) {
  const { t } = useTranslation('scanner')
  const [open, setOpen] = useState(false)

  if (conflicts.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="coarse:min-h-11">
          <TriangleAlert className="size-4" aria-hidden="true" />
          {t('conflict.open', { count: conflicts.length })}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] gap-3">
        <DialogHeader>
          <DialogTitle>{t('conflict.title')}</DialogTitle>
          <DialogDescription>{t('conflict.body', { count: conflicts.length })}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50dvh] pr-3">
          <ul className="space-y-2">
            {conflicts.map((scan) => {
              const result = scan.server_result
              const code = result ? `scanner.result.${result.result}` : 'scanner.result.duplicate'
              return (
                <li
                  key={scan.client_scan_id}
                  className="rounded-lg border border-destructive/40 bg-destructive-subtle p-3"
                >
                  <p className="text-sm font-semibold text-foreground">{t(nsKey(code))}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('conflict.thisScan', { time: formatTime(scan.scanned_at) })}
                    {scan.gate_id ? ` · ${scan.gate_id}` : ''}
                  </p>
                  {result?.conflicting_scanned_at ? (
                    <p className="text-xs text-muted-foreground">
                      {t('conflict.firstScan', {
                        time: formatTime(result.conflicting_scanned_at),
                        gate: result.conflicting_gate ?? result.conflicting_device ?? '—',
                      })}
                    </p>
                  ) : null}
                  {/* The token, so the operator can find the person again. */}
                  <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                    {scan.qr_token}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => onAcknowledge(scan.client_scan_id)}
                  >
                    {t('conflict.acknowledge')}
                  </Button>
                </li>
              )
            })}
          </ul>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={onAcknowledgeAll}>
            {t('conflict.acknowledgeAll')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ConflictList
