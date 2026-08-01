import { useMemo, useState } from 'react'
import { Banknote, Download, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { Async, Page, PageHeader, Section, StatTile, TrendChart } from '@/components/ops'
import { useDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useEvent, useFinancialSummary, useTransactions } from '@/lib/queries'
import {
  PERIODS,
  csvBlob,
  cumulativeSeries,
  netTotal,
  summariseByType,
  toLedgerCsv,
  withinPeriod,
  type Period,
} from '@/lib/ledger'
import { formatMoney } from '@/lib/money'
import type { FinancialTransactionRow, TransactionType } from '@/lib/database.types'
import { cn } from '@/lib/utils'

/**
 * The money screen. Criterion 4 in one sentence: every figure on it traces to a
 * `financial_transactions` row, and no amount is added up in this file.
 *
 *   - the four KPIs and the footer total come from `event_financial_summary`,
 *     a view that sums the ledger in Postgres `numeric`
 *   - the table is the ledger itself, newest first
 *   - the two charts walk raw rows because the view has no time dimension; they
 *     draw a shape, and their endpoint is labelled as a running total rather
 *     than presented as the headline figure
 *
 * There is no edit and no delete, and there will not be one: 004 installs a
 * BEFORE UPDATE OR DELETE trigger on the ledger that raises unconditionally, so
 * an edit button could only ever produce an error dialog. A correction is a
 * reversing row carrying `reverses_transaction_id`.
 *
 * No realtime and no auto-refetch either — numbers moving while an organizer is
 * reconciling is actively harmful. The refresh is a button.
 */
export default function FinancialManagement() {
  const { t, i18n } = useTranslation(['organizer', 'common'])
  const { eventId } = useParams()
  const [period, setPeriod] = useState<Period>('all')
  const dateTime = useDateTime()

  const event = useEvent(eventId)
  const summary = useFinancialSummary(eventId)
  const ledger = useTransactions(eventId)

  const currency = event.data?.currency ?? 'IDR'
  const money = (amount: number) => formatMoney(amount, currency, i18n.language)

  const totals = useMemo(() => summariseByType(summary.data, currency), [summary.data, currency])
  const rows = useMemo(
    () => ledger.data.filter((row) => withinPeriod(row.occurred_at, period)),
    [ledger.data, period],
  )
  const circleSeries = useMemo(
    () => cumulativeSeries(rows, 'circle_payment', currency),
    [rows, currency],
  )
  const ticketSeries = useMemo(
    () => cumulativeSeries(rows, 'ticket_sale', currency),
    [rows, currency],
  )

  const exportCsv = () => {
    const url = URL.createObjectURL(csvBlob(toLedgerCsv(rows)))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ledger-${event.data?.name ?? eventId}-${period}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Page>
      <PageHeader
        title={t('finance.title')}
        description={t('finance.ledgerNote')}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                summary.refetch()
                ledger.refetch()
              }}
              disabled={summary.isFetching || ledger.isFetching}
            >
              <RefreshCw
                className={cn('size-4', (summary.isFetching || ledger.isFetching) && 'animate-spin')}
                aria-hidden="true"
              />
              {t('common:action.refresh')}
            </Button>
            <Button onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="size-4" aria-hidden="true" />
              {t('common:action.export')}
            </Button>
          </>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label={t('finance.circleFees')} total={totals.circle_payment} money={money} t={t} />
        <KpiTile label={t('finance.ticketRevenue')} total={totals.ticket_sale} money={money} t={t} />
        <KpiTile label={t('finance.refunds')} total={totals.refund} money={money} t={t} />
        <StatTile
          accent
          label={t('finance.net')}
          loading={summary.isLoading}
          value={money(netTotal(summary.data, currency))}
          hint={t('finance.netHint')}
        />
      </div>

      {summary.error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {t('common:error.network')}{' '}
          <Button
            variant="link"
            className="h-auto p-0 align-baseline"
            onClick={() => summary.refetch()}
          >
            {t('common:action.retry')}
          </Button>
        </p>
      )}

      <Section title={t('finance.trend')} description={t('finance.trendNote')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TrendChart
            points={circleSeries}
            label={t('finance.circleFees')}
            colorClass="text-chart-1"
            format={money}
            emptyLabel={t('finance.trendEmpty')}
          />
          <TrendChart
            points={ticketSeries}
            label={t('finance.ticketRevenue')}
            colorClass="text-chart-2"
            format={money}
            emptyLabel={t('finance.trendEmpty')}
          />
        </div>
      </Section>

      <Section
        title={t('finance.ledger')}
        description={t('finance.appendOnly')}
        actions={
          <div
            role="group"
            aria-label={t('finance.period')}
            className="inline-flex rounded-md border border-border p-0.5"
          >
            {PERIODS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={period === value}
                onClick={() => setPeriod(value)}
                className={cn(
                  'rounded px-3 py-1.5 text-sm font-medium transition-colors coarse:min-h-11',
                  period === value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {t(`finance.periodOption.${value}`)}
              </button>
            ))}
          </div>
        }
      >
        <Async
          state={{ ...ledger, isEmpty: !ledger.isLoading && !ledger.error && rows.length === 0 }}
          icon={Banknote}
          emptyTitle={t('finance.emptyTitle')}
          emptyDescription={t('finance.emptyBody')}
          emptyAction={
            period === 'all' ? undefined : (
              <Button variant="outline" onClick={() => setPeriod('all')}>
                {t('common:action.clearFilters')}
              </Button>
            )
          }
          skeleton={<div className="h-64 animate-pulse rounded-lg bg-muted" />}
        >
          {/* A contained scroll region, not a page-level one: the table keeps its
              columns on a 320px phone and the page never scrolls sideways. */}
          <div
            role="region"
            aria-label={t('finance.ledger')}
            tabIndex={0}
            className="overflow-x-auto rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <caption className="sr-only">{t('finance.ledger')}</caption>
              <thead className="bg-muted/50 text-left">
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('finance.column.date')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('finance.column.type')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('finance.column.payer')}
                  </th>
                  <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">
                    {t('finance.column.method')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {t('finance.column.amount')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <LedgerRow key={row.id} row={row} money={money} dateTime={dateTime} t={t} />
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 border-t border-border bg-card">
                <tr>
                  <th scope="row" colSpan={3} className="px-3 py-3 text-left font-medium">
                    {t('finance.netAllTime')}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {t('finance.rowsShown', { count: rows.length })}
                    </span>
                  </th>
                  <td className="hidden sm:table-cell" />
                  <td className="px-3 py-3 text-right text-base font-semibold tabular-nums">
                    {money(netTotal(summary.data, currency))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Async>
      </Section>
    </Page>
  )
}

// ---------------------------------------------------------------------------

type Translate = (key: string, options?: Record<string, unknown>) => string

function KpiTile({
  label,
  total,
  money,
  t,
}: {
  label: string
  total: { net: number; count: number; pending: number } | undefined
  money: (amount: number) => string
  t: Translate
}) {
  return (
    <StatTile
      label={label}
      value={money(total?.net ?? 0)}
      hint={
        <>
          {t('finance.transactions', { count: total?.count ?? 0 })}
          {total && total.pending > 0
            ? ` · ${t('finance.pending', { amount: money(total.pending) })}`
            : ''}
        </>
      }
    />
  )
}

const TYPE_LABEL: Record<TransactionType, string> = {
  circle_payment: 'finance.type.circleFee',
  ticket_sale: 'finance.type.ticketSale',
  refund: 'finance.type.refund',
  expense: 'finance.type.expense',
  commission: 'finance.type.commission',
}

function LedgerRow({
  row,
  money,
  dateTime,
  t,
}: {
  row: FinancialTransactionRow
  money: (amount: number) => string
  dateTime: (iso: string | null) => string
  t: Translate
}) {
  const debit = row.direction === 'debit'
  const signed = (debit ? -1 : 1) * Number(row.amount)

  return (
    <tr className="align-top">
      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">
        {dateTime(row.occurred_at)}
      </td>
      <td className="px-3 py-2.5">
        {/* Identity, not status — a neutral pill. The sign and colour of the
            amount carry direction, which is the part that means something. */}
        <Badge variant="outline">{t(TYPE_LABEL[row.transaction_type])}</Badge>
        {row.status !== 'completed' && (
          <Badge variant={row.status === 'failed' ? 'danger' : 'warning'} className="ml-1.5">
            {t(`finance.status.${row.status}`)}
          </Badge>
        )}
      </td>
      <td className="px-3 py-2.5 text-card-foreground">
        <span className="text-pretty">{row.description ?? '—'}</span>
        {row.reverses_transaction_id && (
          <span className="mt-0.5 block text-xs text-muted-foreground">{t('finance.reverses')}</span>
        )}
        <span className="mt-0.5 block font-mono text-xs text-muted-foreground sm:hidden">
          {row.payment_method ?? '—'}
        </span>
      </td>
      <td className="hidden whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground sm:table-cell">
        {row.payment_method ?? '—'}
      </td>
      <td
        className={cn(
          'whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums',
          debit ? 'text-destructive' : 'text-card-foreground',
        )}
      >
        {money(signed)}
      </td>
    </tr>
  )
}
