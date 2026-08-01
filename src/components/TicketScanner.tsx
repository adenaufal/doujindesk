import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CameraOff, Download, Flashlight, Keyboard, X } from 'lucide-react'
import type { ScanOutcome, ScanType } from '@/lib/scanContract'
import { resolveScanOutcome } from '@/lib/scanContract'
import { parseTicketCode } from '@/lib/ticketCode'
import {
  acknowledgeAllConflicts,
  acknowledgeConflict,
  checkLocal,
  downloadMirror,
  enqueue,
  flush,
  getMirrorMeta,
  useQueueCounts,
  type MirrorMeta,
} from '@/lib/scanQueue'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import ConflictList from './scanner/ConflictList'
import ScanResultSheet, { OUTCOME_TONE, formatTime, nsKey } from './scanner/ScanResultSheet'

/**
 * The door. Full-bleed viewfinder, one visible sync state, and three ways in:
 * camera, manual entry, and the queue that catches everything when the venue
 * wifi dies mid-shift.
 *
 * Every scan goes to IndexedDB before anything else happens (`enqueue`), and
 * the result the operator sees comes from the one resolver in
 * `scanContract.ts` — the same function the sync loop uses, so "already used"
 * cannot mean two different things in two places.
 */

// ---------------------------------------------------------------------------
// Camera decode — a seam, not a dependency
// ---------------------------------------------------------------------------

interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance
  getSupportedFormats?(): Promise<string[]>
}

interface QrDetector {
  detect(video: HTMLVideoElement): Promise<string[]>
}

/**
 * `BarcodeDetector` is native on Android Chrome — the majority staff device —
 * costs zero bytes and needs no canvas round-trip.
 *
 * ponytail: there is no JS fallback decoder bundled, so iOS Safari and desktop
 * Firefox get manual entry only. `jsqr` is not installed and this package may
 * not add dependencies; the drop-in is one line here —
 * `const { default: jsQR } = await import('jsqr')` behind this same interface,
 * plus a hidden canvas to pull ImageData — and nothing else in the file
 * changes. Manual entry is deliberately a first-class control regardless,
 * because venue cameras fail and badges get scuffed.
 */
async function loadDetector(): Promise<QrDetector | null> {
  const Native = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  if (!Native) return null
  try {
    const formats = await Native.getSupportedFormats?.()
    if (formats && !formats.includes('qr_code')) return null
    const detector = new Native({ formats: ['qr_code'] })
    return {
      detect: async (video) => (await detector.detect(video)).map((code) => code.rawValue),
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Feedback — the operator is looking at the queue, not the phone
// ---------------------------------------------------------------------------

const VIBRATE: Record<ScanOutcome['kind'], number[]> = {
  admitted: [40],
  queued: [30, 60, 30],
  duplicate: [120, 80, 120],
  rejected: [200],
}

/** Two-tone chirp up for admitted, down for anything else. WebAudio, no assets. */
function beep(kind: ScanOutcome['kind']) {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    const up = kind === 'admitted'
    osc.frequency.setValueAtTime(up ? 660 : 380, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(up ? 990 : 200, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
    osc.onended = () => void ctx.close()
  } catch {
    /* audio is a nicety; a silent door still admits people */
  }
}

// ---------------------------------------------------------------------------

export interface TicketScannerProps {
  /** Falls back to the `:eventId` route param — the scanner lives at /e/:eventId/scan. */
  eventId?: string
  eventName?: string
  gateId?: string | null
  /**
   * `entry` is the gated one. `exit`/`reentry` sit outside the database's
   * one-admission index and are therefore always allowed.
   */
  mode?: ScanType
  /** Unused. Kept so the legacy TicketingSystem tab still type-checks until P13 replaces it. */
  staffId?: string
}

type CameraState = 'starting' | 'live' | 'denied' | 'unavailable' | 'nodecoder'

export default function TicketScanner({
  eventId: eventIdProp,
  eventName,
  gateId = null,
  mode = 'entry',
}: TicketScannerProps) {
  const { t } = useTranslation('scanner')
  const navigate = useNavigate()
  const params = useParams<{ eventId?: string }>()
  const eventId = eventIdProp ?? params.eventId ?? ''

  const { pending, admitted, conflicts } = useQueueCounts()
  const [online, setOnline] = useState(navigator.onLine)
  const [camera, setCamera] = useState<CameraState>('starting')
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [mirror, setMirror] = useState<MirrorMeta | null>(null)
  const [mirrorState, setMirrorState] = useState<'idle' | 'loading' | 'failed'>('idle')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null)
  const busyRef = useRef(false)

  // ---- the scan itself ----------------------------------------------------

  const handleCode = useCallback(
    async (raw: string) => {
      if (busyRef.current || !eventId) return
      const token = parseTicketCode(raw)
      if (!token) {
        // Not even shaped like a pass token. No queue row, no network: the old
        // scanner's JSON payload is exactly what lands here.
        setOutcome({
          kind: 'rejected',
          message: 'scanner.result.not_found',
          autoDismiss: false,
          detail: { code: 'not_found' },
        })
        return
      }

      busyRef.current = true
      try {
        const local = await checkLocal(token, eventId)
        // Enqueued unconditionally, including a code the mirror rejects: an
        // unknown code at a gate is something the organizer needs in the audit
        // log, and `ticket_scans.pass_id` is nullable precisely for that.
        const row = await enqueue({ event_id: eventId, qr_token: token, gate_id: gateId, scan_type: mode })
        setOutcome(resolveScanOutcome(local, null))

        if (navigator.onLine) {
          const results = await flush()
          const mine = results.find((r) => r.client_scan_id === row.client_scan_id)
          if (mine) setOutcome(resolveScanOutcome(local, mine))
        }
      } finally {
        busyRef.current = false
      }
    },
    [eventId, gateId, mode],
  )

  // The decode loop must not re-subscribe every render.
  const handleCodeRef = useRef(handleCode)
  handleCodeRef.current = handleCode

  // Stable, so the sheet's auto-dismiss timer is not restarted every time the
  // queue counter ticks.
  const dismiss = useCallback(() => setOutcome(null), [])

  // ---- feedback + auto-dismiss -------------------------------------------

  useEffect(() => {
    if (!outcome) return
    navigator.vibrate?.(VIBRATE[outcome.kind])
    beep(outcome.kind)
    // Dismissal is the sheet's own business: a success clears itself after ~2s,
    // a failure waits for a tap. There is no timer in this file, and there is no
    // timer anywhere that fakes a sync result.
  }, [outcome])

  // ---- connectivity -------------------------------------------------------

  useEffect(() => {
    const sync = () => {
      setOnline(navigator.onLine)
      if (navigator.onLine) void flush()
    }
    // Not Background Sync: iOS Safari does not implement it, so half the
    // venue's phones would silently never reconcile.
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    document.addEventListener('visibilitychange', sync)
    void flush()
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  // ---- mirror -------------------------------------------------------------

  useEffect(() => {
    if (eventId) void getMirrorMeta(eventId).then((meta) => setMirror(meta ?? null))
  }, [eventId])

  const download = async () => {
    setMirrorState('loading')
    try {
      setMirror(await downloadMirror(eventId))
      setMirrorState('idle')
    } catch {
      setMirrorState('failed')
    }
  }

  // ---- camera -------------------------------------------------------------

  useEffect(() => {
    let cancelled = false
    let frame = 0
    let last = 0

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera('unavailable')
        return
      }
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      } catch {
        setCamera('denied')
        return
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => {})
      }
      const capabilities = stream.getVideoTracks()[0]?.getCapabilities?.() as
        | { torch?: boolean }
        | undefined
      setTorchAvailable(Boolean(capabilities?.torch))

      const detector = await loadDetector()
      if (!detector) {
        setCamera('nodecoder')
        return
      }
      setCamera('live')

      const tick = async (now: number) => {
        // ~8 fps. A QR sitting in the frame decodes on the first pass; running
        // this at 60 cooks the battery an eight-hour shift depends on.
        if (video && !cancelled && now - last > 120) {
          last = now
          try {
            const codes = await detector.detect(video)
            const code = codes[0]
            const previous = lastCodeRef.current
            if (code && (!previous || previous.code !== code || now - previous.at > 2500)) {
              lastCodeRef.current = { code, at: now }
              void handleCodeRef.current(code)
            }
          } catch {
            /* a dropped frame is not an error worth showing anyone */
          }
        }
        if (!cancelled) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }

    void start()
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torchOn
    try {
      // `torch` is real on Android Chrome and absent from lib.dom's constraint type.
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints)
      setTorchOn(next)
    } catch {
      setTorchAvailable(false)
    }
  }

  // ---- render -------------------------------------------------------------

  if (!eventId) {
    return (
      <EmptyState
        icon={CameraOff}
        title={t('title')}
        description={t('camera.unavailableBody')}
        className="m-4"
      />
    )
  }

  const chip = online
    ? pending > 0
      ? t('sync.syncing', { count: pending })
      : t('sync.online')
    : pending > 0
      ? t('sync.queued', { count: pending })
      : t('sync.offline')

  const cameraProblem =
    camera === 'denied'
      ? { title: t('camera.denied'), body: t('camera.deniedBody') }
      : camera === 'unavailable' || camera === 'nodecoder'
        ? { title: t('camera.unavailable'), body: t('camera.unavailableBody') }
        : null

  return (
    // `dark` is scoped, not global: a viewfinder is a black surface whatever the
    // app theme is, and this keeps every colour on a token instead of a hex.
    <div className="dark relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="z-20 flex items-center gap-2 px-3 pt-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label={t('exit')}
          className="shrink-0"
        >
          <X className="size-5" aria-hidden="true" />
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{eventName ?? t('title')}</p>
        <Badge variant={online ? 'success' : 'warning'} aria-live="polite">
          {chip}
        </Badge>
      </header>

      <div className="z-20 flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
        <Button
          variant="outline"
          size="sm"
          onClick={download}
          disabled={mirrorState === 'loading'}
          className="shrink-0"
        >
          <Download className="size-4" aria-hidden="true" />
          {mirror ? t('mirror.update') : t('mirror.download')}
        </Button>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {mirrorState === 'loading'
            ? t('mirror.downloading')
            : mirrorState === 'failed'
              ? t('mirror.failed')
              : mirror
                ? t('mirror.ready', {
                    count: mirror.count,
                    time: formatTime(mirror.downloaded_at),
                  })
                : t('mirror.missing')}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {t('counter.session')} {admitted}
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden bg-foreground/5">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover"
        />

        {/* Corner brackets — Minna Bank / Uber reticle, primary-token edges. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative aspect-square w-[min(72vw,20rem)]">
            <span className="absolute left-0 top-0 size-8 rounded-tl-lg border-l-4 border-t-4 border-primary" />
            <span className="absolute right-0 top-0 size-8 rounded-tr-lg border-r-4 border-t-4 border-primary" />
            <span className="absolute bottom-0 left-0 size-8 rounded-bl-lg border-b-4 border-l-4 border-primary" />
            <span className="absolute bottom-0 right-0 size-8 rounded-br-lg border-b-4 border-r-4 border-primary" />
          </div>
        </div>

        <p className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-background/70 px-3 py-1 text-center text-xs text-foreground">
          {camera === 'starting' ? t('camera.requesting') : t('hint')}
        </p>

        {cameraProblem ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-4">
            <EmptyState
              icon={CameraOff}
              title={cameraProblem.title}
              description={cameraProblem.body}
              action={
                <Button onClick={() => setManualOpen(true)}>
                  <Keyboard className="size-4" aria-hidden="true" />
                  {t('manualEntry')}
                </Button>
              }
            />
          </div>
        ) : null}

        {/* Top toast pill: the answer, without covering the camera (Luma). */}
        {outcome ? (
          <div className="pointer-events-none absolute inset-x-0 top-12 flex justify-center px-4">
            <span
              className={`rounded-full px-4 py-1.5 text-sm font-semibold shadow-lg ${OUTCOME_TONE[outcome.kind]}`}
            >
              {t(nsKey(outcome.message))}
            </span>
          </div>
        ) : null}
      </div>

      <div className="z-20 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3">
        <div className="justify-self-start">
          <ConflictList
            conflicts={conflicts}
            onAcknowledge={(id) => void acknowledgeConflict(id)}
            onAcknowledgeAll={() => void acknowledgeAllConflicts()}
          />
        </div>

        <Button
          variant="link"
          onClick={() => setManualOpen(true)}
          className="coarse:min-h-11 text-foreground"
        >
          <Keyboard className="size-4" aria-hidden="true" />
          {t('manualEntry')}
        </Button>

        <div className="justify-self-end">
          {torchAvailable ? (
            <Button
              variant={torchOn ? 'default' : 'secondary'}
              size="icon"
              onClick={toggleTorch}
              aria-pressed={torchOn}
              aria-label={t('torch')}
              className="rounded-full"
            >
              <Flashlight className="size-5" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md">
        <ScanResultSheet outcome={outcome} onDismiss={dismiss} />
      </div>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('manualEntryTitle')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const code = manualCode.trim()
              setManualCode('')
              setManualOpen(false)
              void handleCode(code)
            }}
            className="space-y-3"
          >
            <Label htmlFor="manual-ticket-code">{t('manualEntryPlaceholder')}</Label>
            <Input
              id="manual-ticket-code"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="text"
              className="font-mono coarse:min-h-11"
            />
            <DialogFooter>
              <Button type="submit" disabled={!manualCode.trim()} className="w-full">
                {t('manualEntrySubmit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
