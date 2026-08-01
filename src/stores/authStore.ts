import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'

// -----------------------------------------------------------------------------
// Real Supabase Auth. There is no persist middleware here on purpose: the
// Supabase client already persists the session in localStorage and refreshes it,
// and a *second* persisted copy of `role` is a privilege bug — a stale 'organizer'
// rehydrated from localStorage renders an organizer shell for someone who was
// demoted. Role is read from `profiles` (migration 002) on every session change,
// and RLS is the thing that actually enforces it. Nothing on the client can be
// trusted; this store only decides which chrome to draw.
//
// The client holds no permission strings and no permission-check helper: any
// such string is editable from devtools, and no RLS policy may ever depend on
// one. Authority is `role`, read from `profiles` and enforced by RLS.
// -----------------------------------------------------------------------------

export const APP_ROLES = ['organizer', 'staff', 'circle', 'attendee'] as const
export type AppRole = (typeof APP_ROLES)[number]

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && (APP_ROLES as readonly string[]).includes(value)
}

export interface AppUser {
  id: string
  email: string
  /** `profiles.display_name`, falling back to the email local part. */
  name: string
  avatarUrl: string | null
  /**
   * ponytail: widened to `string` instead of `AppRole` so `Dashboard.tsx:157`
   * — which still compares against the retired `'admin'` — keeps compiling
   * while P14 owns that file. The typed value is `useAuthStore().role`; use
   * that one. Upgrade path: narrow this to `AppRole` in the same commit P14
   * rewrites Dashboard.
   */
  role: string
}

/** Error keys under the `auth` i18n namespace, so the message is localised. */
export type AuthErrorKey =
  | 'invalidCredentials'
  | 'emailTaken'
  | 'weakPassword'
  | 'rateLimited'
  | 'sessionExpired'
  | 'generic'

interface AuthStore {
  session: Session | null
  user: AppUser | null
  role: AppRole | null
  /** True until the first `getSession()` + profile read settles. */
  loading: boolean
  /** Set when the profile read fails — usually "migration 002 is not applied". */
  error: string | null
  signIn: (email: string, password: string) => Promise<AuthErrorKey | null>
  signUp: (input: SignUpInput) => Promise<AuthErrorKey | null>
  signOut: () => Promise<void>
}

export interface SignUpInput {
  email: string
  password: string
  displayName: string
  /** Only these two are self-serve. Staff and organizer are granted by an organizer. */
  accountType: 'circle' | 'attendee'
}

// `./lib/supabase` throws at module scope when the env vars are missing, so it
// is imported lazily — importing this store must stay free of side effects for
// tests (and for a bare jsdom render).
const client = () => import('@/lib/supabase').then((m) => m.supabase)

function mapAuthError(message: string): AuthErrorKey {
  const m = message.toLowerCase()
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'invalidCredentials'
  if (m.includes('already registered') || m.includes('already been registered')) return 'emailTaken'
  if (m.includes('rate limit') || m.includes('too many')) return 'rateLimited'
  if (m.includes('password')) return 'weakPassword'
  return 'generic'
}

export const useAuthStore = create<AuthStore>()((set) => ({
  session: null,
  user: null,
  role: null,
  loading: true,
  error: null,

  signIn: async (email, password) => {
    const supabase = await client()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return mapAuthError(error.message)
    return null
  },

  signUp: async ({ email, password, displayName, accountType }) => {
    const supabase = await client()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      // Read by the handle_new_user trigger in migration 002, which clamps the
      // requested role to circle|attendee. Asking for 'organizer' here does
      // nothing — the trigger writes 'attendee'.
      options: { data: { display_name: displayName, role: accountType } },
    })
    if (error) return mapAuthError(error.message)
    return null
  },

  signOut: async () => {
    const supabase = await client()
    await supabase.auth.signOut()
    // onAuthStateChange clears the store; this is only for the case where the
    // sign-out request itself fails offline — the local session is gone either
    // way, so the shell must not keep rendering as if it were not.
    set({ session: null, user: null, role: null, error: null, loading: false })
  },
}))

async function applySession(session: Session | null) {
  if (!session) {
    useAuthStore.setState({ session: null, user: null, role: null, loading: false })
    return
  }

  const supabase = await client()
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, role')
    .eq('id', session.user.id)
    .maybeSingle()

  const profile = data as { display_name?: string; avatar_url?: string; role?: string } | null
  const role = isAppRole(profile?.role) ? profile.role : null
  const email = session.user.email ?? ''

  useAuthStore.setState({
    session,
    user: {
      id: session.user.id,
      email,
      name: profile?.display_name || email.split('@')[0] || session.user.id.slice(0, 8),
      avatarUrl: profile?.avatar_url ?? null,
      role: role ?? '',
    },
    role,
    // A signed-in user with no readable profile row is the "migrations are not
    // applied yet" case. Surface it instead of spinning forever.
    error: error ? error.message : null,
    loading: false,
  })
}

let started = false

/**
 * Boot the session. Called once from App.tsx — StrictMode runs effects twice in
 * development, hence the guard. The `onAuthStateChange` subscription lives for
 * the lifetime of the tab and is deliberately never torn down.
 */
export async function initAuth() {
  if (started) return
  started = true
  try {
    const supabase = await client()
    const { data } = await supabase.auth.getSession()
    await applySession(data.session)
    supabase.auth.onAuthStateChange((_event, session) => {
      // Deferred to a macrotask: supabase-js holds an internal lock while this
      // callback runs, and the profile read inside applySession would deadlock
      // against it.
      setTimeout(() => void applySession(session), 0)
    })
  } catch (err) {
    started = false
    useAuthStore.setState({
      loading: false,
      error: err instanceof Error ? err.message : 'Auth unavailable',
    })
  }
}
