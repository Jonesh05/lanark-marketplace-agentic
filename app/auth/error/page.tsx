import Link from "next/link"

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6">
      <div className="flex max-w-sm flex-col gap-4 text-center">
        <h1 className="font-serif text-3xl">Sign-in failed.</h1>
        <p className="text-sm text-muted-foreground">
          The auth code expired or was already used. Try again from the
          login screen.
        </p>
        <Link
          href="/auth/login"
          className="text-sm text-accent underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  )
}
