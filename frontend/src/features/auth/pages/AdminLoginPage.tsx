import { AuthForm } from '../components/AuthForm'
import { login } from '../auth-api'
import { useSignIn } from '../use-sign-in'

export function AdminLoginPage() {
  const signIn = useSignIn('admin')

  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Panel del propietario</h1>
        <p className="text-sm text-muted-foreground">Acceso exclusivo para administradores de la tienda.</p>
      </div>
      <AuthForm
        submitLabel="Entrar al panel"
        fields={[
          { name: 'email', label: 'Correo', type: 'email', autoComplete: 'username' },
          { name: 'password', label: 'Contraseña', type: 'password', autoComplete: 'current-password' },
        ]}
        onSubmit={async ({ email = '', password = '' }) => signIn(await login('admin', { email, password }))}
      />
    </div>
  )
}
