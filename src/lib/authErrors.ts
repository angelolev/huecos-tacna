import { FirebaseError } from 'firebase/app'

/** Mensaje entendible para los errores más comunes al iniciar sesión con Google. */
export function authErrorMessage(err: unknown) {
  const code = err instanceof FirebaseError ? err.code : ''
  switch (code) {
    case 'auth/unauthorized-domain':
      return `Este sitio (${window.location.hostname}) aún no está autorizado en Firebase para iniciar sesión con Google.`
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Cerraste la ventana de Google antes de terminar.'
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e intenta de nuevo.'
    case 'permission-denied':
    case 'unavailable':
      return 'No pudimos pasar tus reportes a tu cuenta de Google. Revisa tu conexión e intenta de nuevo; tus reportes siguen a salvo.'
    case 'auth/network-request-failed':
      return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
    default:
      return 'No se pudo iniciar sesión. Intenta de nuevo.'
  }
}
