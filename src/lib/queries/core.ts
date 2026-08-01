import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'

import { supabase } from '../supabase'

/**
 * Shared plumbing for every query module. Read `./index.ts` first — it states the
 * pattern; this file is the three functions that implement it.
 */

/** Cache-time tiers, named so a hook declares intent instead of a magic number. */
export const STALE = {
  /** Default. Anything an organizer edits and expects to see again. */
  live: 30_000,
  /** Catalog: circles do not change during doors-open. Realtime here is waste. */
  catalog: 5 * 60_000,
  /** Schedule, map, guide: fixed before the event opens. */
  reference: 60 * 60_000,
} as const

export type PostgrestLike<T> = PromiseLike<{
  data: T | null
  error: { message: string; code?: string } | null
}>

/** Unwrap a PostgREST response, turning `error` into a thrown Error for Query. */
export async function unwrap<T>(builder: PostgrestLike<T>): Promise<T> {
  const { data, error } = await builder
  if (error) throw new Error(error.message)
  return data as T
}

/**
 * The standard list result. Every list hook returns this shape so a screen writes
 * one set of loading / error / empty branches, not three hand-rolled booleans.
 */
export interface ListResult<T> {
  data: T[]
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  /** True only when the query succeeded and returned zero rows. */
  isEmpty: boolean
  refetch: () => void
}

export function useList<T>(
  queryKey: QueryKey,
  select: () => PostgrestLike<T[]>,
  options?: Partial<UseQueryOptions<T[], Error>>,
): ListResult<T> {
  const query = useQuery<T[], Error>({
    queryKey,
    queryFn: () => unwrap(select()),
    ...options,
  })
  return {
    data: query.data ?? [],
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error ?? null,
    isEmpty: query.isSuccess && (query.data?.length ?? 0) === 0,
    refetch: () => void query.refetch(),
  }
}

export interface ItemResult<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useItem<T>(
  queryKey: QueryKey,
  select: () => PostgrestLike<T>,
  options?: Partial<UseQueryOptions<T | null, Error>>,
): ItemResult<T> {
  const query = useQuery<T | null, Error>({
    queryKey,
    queryFn: () => unwrap(select()),
    ...options,
  })
  return {
    data: query.data ?? null,
    isLoading: query.isPending,
    error: query.error ?? null,
    refetch: () => void query.refetch(),
  }
}

/**
 * A write plus the keys it invalidates, declared together. Passing the keys is
 * not optional: a mutation that forgets them is how a screen shows a row the
 * server no longer has.
 */
export function useWrite<TArgs, TResult>(
  run: (args: TArgs) => Promise<TResult>,
  invalidate: (args: TArgs) => QueryKey[],
  options?: Partial<UseMutationOptions<TResult, Error, TArgs>>,
) {
  const client = useQueryClient()
  return useMutation<TResult, Error, TArgs>({
    mutationFn: run,
    ...options,
    onSuccess: (data, args, ...rest) => {
      for (const queryKey of invalidate(args)) void client.invalidateQueries({ queryKey })
      ;(options?.onSuccess as ((...a: unknown[]) => void) | undefined)?.(data, args, ...rest)
    },
  })
}

export { supabase }
