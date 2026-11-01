import { Link } from 'react-router'
import { AuthForm } from '../components/AuthForm'
import { login } from '../auth-api'
import { useSignIn } from '../use-sign-in'

export function CustomerLoginPage() {
  const signIn = useSignIn('customer')

  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Hola de nuevo</h1>
        <p className="text-sm text-muted-foreground">Entra para ver tu pase de acceso y tus compras.</p>
      </div>
      <AuthForm
        submitLabel="Entrar"
        fields={[
          { name: 'email', label: 'Correo', type: 'email', autoComplete: 'email', placeholder: 'tu@correo.com' },
          { name: 'password', label: 'Contraseña', type: 'password', autoComplete: 'current-password' },
        ]}
        onSubmit={async ({ email = '', password = '' }) => {
          const auth = await login('customer', { email, password })
          if (auth.user.role !== 'CUSTOMER') {
            throw new Error('Esta cuenta es de propietario: entra desde el panel de administración')
          }
          signIn(auth)
        }}
        footer={
          <p className="text-center text-sm text-muted-foreground">
            ¿Primera vez?{' '}
            <Link to="/app/register" className="font-medium text-primary underline-offset-4 hover:underline">
              Crea tu cuenta
            </Link>
          </p>
        }
      />
    </div>
  )
}
