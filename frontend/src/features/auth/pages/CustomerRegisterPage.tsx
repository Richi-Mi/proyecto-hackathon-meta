import { Link } from 'react-router'
import { AuthForm } from '../components/AuthForm'
import { registerCustomer } from '../auth-api'
import { useSignIn } from '../use-sign-in'

export function CustomerRegisterPage() {
  const signIn = useSignIn('customer')

  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Crea tu cuenta</h1>
        <p className="text-sm text-muted-foreground">Entra a la tienda con tu QR y paga sin hacer fila.</p>
      </div>
      <AuthForm
        submitLabel="Crear cuenta"
        fields={[
          { name: 'name', label: 'Nombre', type: 'text', autoComplete: 'name', minLength: 2 },
          { name: 'email', label: 'Correo', type: 'email', autoComplete: 'email', placeholder: 'tu@correo.com' },
          { name: 'password', label: 'Contraseña', type: 'password', autoComplete: 'new-password', minLength: 8 },
        ]}
        onSubmit={async ({ name = '', email = '', password = '' }) => signIn(await registerCustomer({ name, email, password }))}
        footer={
          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link to="/app/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Inicia sesión
            </Link>
          </p>
        }
      />
    </div>
  )
}
