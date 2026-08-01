import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The single empty / no-results / offline surface for every list screen.
 *
 * No illustration, by design: headline + one sentence + a primary CTA, and an
 * optional secondary path. Nothing to commission, nothing that reads as stock
 * AI art.
 *
 * Distinguishing *no data* from *no results* is the caller's job, not a variant
 * here: when the emptiness is filter-induced, keep the table headers and the
 * filter row mounted and pass a description naming the filter, e.g.
 *   description="No circles match “horror” in Hall B. Try clearing the genre filter."
 * A bare "Nothing here" over a wiped-out table is how people conclude their data
 * is gone.
 */
export interface EmptyStateProps extends React.ComponentProps<"div"> {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  /** Primary CTA. Pass a <Button>, or an <a>/<Link> wrapped in one. */
  action?: React.ReactNode
  /** Alternative path — usually "Clear filters" or a link to docs. */
  secondaryAction?: React.ReactNode
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      // role=status so a screen reader announces the transition from
      // loading -> empty without the user having to go hunting for it.
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className
      )}
      {...props}
    >
      {Icon ? (
        <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
      ) : null}
      <h3 className="text-base font-semibold text-foreground text-balance">
        {title}
      </h3>
      {description ? (
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          {description}
        </p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-2 flex flex-col-reverse items-center gap-2 sm:flex-row sm:justify-center">
          {secondaryAction}
          {action}
        </div>
      ) : null}
    </div>
  )
}

export { EmptyState }
