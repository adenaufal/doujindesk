import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useSearchParams } from 'react-router-dom'

import { homeForRole } from '@/components/layout/nav'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore, type SignUpInput } from '@/stores/authStore'

/**
 * Sign in / create account. Validation is the browser's — `type="email"`,
 * `required`, `minLength` — because a login form is the one place where the
 * native behaviour is already correct, localised by the OS, and free.
 *
 * Only `circle` and `attendee` are self-serve. Staff and organizer are granted
 * by an organizer, and migration 002's trigger clamps anything else to
 * `attendee`, so there is nothing to gain by posting a different value.
 */
export default function Login() {
  const { t } = useTranslation(['auth', 'common'])
  const [params] = useSearchParams()
  const next = params.get('next')

  const loading = useAuthStore((s) => s.loading)
  const session = useAuthStore((s) => s.session)
  const role = useAuthStore((s) => s.role)
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)

  const [pending, setPending] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const [accountType, setAccountType] = useState<SignUpInput['accountType']>('attendee')

  if (session && !loading) {
    return <Navigate to={next || homeForRole(role)} replace />
  }

  const errorText = errorKey
    ? t(`error.${errorKey}`, { defaultValue: t('common:error.generic') })
    : null

  async function onSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setErrorKey(await signIn(String(form.get('email')), String(form.get('password'))))
    setPending(false)
  }

  async function onSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    const failed = await signUp({
      email: String(form.get('email')),
      password: String(form.get('password')),
      displayName: String(form.get('displayName')),
      accountType,
    })
    setErrorKey(failed)
    setCheckEmail(!failed)
    setPending(false)
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-10 sm:py-16">
      <Tabs defaultValue="signIn" onValueChange={() => setErrorKey(null)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signIn">{t('signIn.title')}</TabsTrigger>
          <TabsTrigger value="signUp">{t('signUp.title')}</TabsTrigger>
        </TabsList>

        <TabsContent value="signIn" className="mt-6">
          <h1 className="text-xl font-semibold text-foreground">{t('signIn.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('signIn.subtitle')}</p>

          <form className="mt-6 space-y-4" onSubmit={onSignIn}>
            <Field id="signin-email" label={t('field.email')}>
              <Input id="signin-email" name="email" type="email" autoComplete="email" required />
            </Field>
            <Field id="signin-password" label={t('field.password')}>
              <Input
                id="signin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            {errorText && <FormError>{errorText}</FormError>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t('common:status.loading') : t('signIn.submit')}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signUp" className="mt-6">
          <h1 className="text-xl font-semibold text-foreground">{t('signUp.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('signUp.subtitle')}</p>

          {checkEmail ? (
            <Alert className="mt-6">
              <AlertDescription>{t('signUp.checkEmail')}</AlertDescription>
            </Alert>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={onSignUp}>
              <Field id="signup-name" label={t('field.displayName')}>
                <Input id="signup-name" name="displayName" autoComplete="name" required />
              </Field>
              <Field id="signup-email" label={t('field.email')}>
                <Input id="signup-email" name="email" type="email" autoComplete="email" required />
              </Field>
              <Field id="signup-password" label={t('field.password')}>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <p className="text-xs text-muted-foreground">{t('error.weakPassword')}</p>
              </Field>
              <Field id="signup-type" label={t('field.accountType')}>
                <Select
                  value={accountType}
                  onValueChange={(value) => setAccountType(value as SignUpInput['accountType'])}
                >
                  <SelectTrigger id="signup-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="circle">{t('common:role.circle')}</SelectItem>
                    <SelectItem value="attendee">{t('common:role.attendee')}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {errorText && <FormError>{errorText}</FormError>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? t('common:status.loading') : t('signUp.submit')}
              </Button>
            </form>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function FormError({ children }: { children: React.ReactNode }) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
