import { useEffect, useState } from 'react'
import { supabase } from './supabaseDB'
import './App.css'

const initialForm = {
  full_name: '',
  username: '',
  email: '',
  password: '',
  contact_number: '',
  address: '',
  travel_preference: '',
  account_status: 'active',
}

const fields = [
  { name: 'full_name', label: 'Full name', type: 'text' },
  { name: 'username', label: 'Username', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'password', label: 'Password', type: 'password' },
  { name: 'contact_number', label: 'Contact number', type: 'tel' },
  { name: 'address', label: 'Address', type: 'text' },
  { name: 'travel_preference', label: 'Travel preference', type: 'text' },
  { name: 'account_status', label: 'Account status', type: 'text' },
]

function App() {
  const [session, setSession] = useState(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (isMounted) {
        setSession(currentSession)
        setIsLoadingSession(false)
      }
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      setIsLoadingSession(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSignOut() {
    setMessage('')
    const { error } = await supabase.auth.signOut()

    if (error) {
      setMessage(`Could not sign out: ${error.message}`)
    }
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  async function handleGoogleLogin() {
    setMessage('')
    setIsSigningIn(true)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: 'select_account',
          },
        },
      })

      if (error) {
        throw new Error(`Google sign-in failed: ${error.message}`)
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Google sign-in failed.',
      )
      setIsSigningIn(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setIsSubmitting(true)

    try {
      const email = form.email.trim().toLowerCase()

      if (!email.endsWith('@gmail.com')) {
        throw new Error('Please enter a valid Gmail address.')
      }

      const userRecord = {
        ...form,
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        email,
        contact_number: form.contact_number.trim(),
        address: form.address.trim(),
        travel_preference: form.travel_preference.trim(),
        account_status: form.account_status.trim(),
      }

      const { error: insertError } = await supabase
        .from('USER_INFO')
        .insert([userRecord])

      if (insertError) {
        throw new Error(`USER_INFO insert failed: ${insertError.message}`)
      }

      setForm(initialForm)
      setMessage('User created successfully.')
    } catch (error) {
      setMessage(
        `Could not create user: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingSession) {
    return (
      <main className="user-form-page">
        <p className="session-loading">Loading your account...</p>
      </main>
    )
  }

  if (session) {
    const user = session.user
    const metadata = user.user_metadata ?? {}
    const displayName = metadata.full_name || metadata.name || user.email
    const avatarUrl = metadata.avatar_url || metadata.picture

    return (
      <main className="dashboard-page">
        <section className="dashboard-card">
          <div className="dashboard-header">
            <div>
              <p className="dashboard-eyebrow">Travel Mate</p>
              <h1>Welcome, {displayName}</h1>
              <p className="form-description">
                You are signed in and ready to plan your next trip.
              </p>
            </div>
            {avatarUrl && (
              <img
                className="profile-avatar"
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            )}
          </div>

          <div className="dashboard-grid">
            <article className="dashboard-stat">
              <span>Account email</span>
              <strong>{user.email}</strong>
            </article>
            <article className="dashboard-stat">
              <span>Sign-in provider</span>
              <strong>{metadata.iss ? 'Google' : 'Supabase'}</strong>
            </article>
          </div>

          <button className="sign-out-button" type="button" onClick={handleSignOut}>
            Sign out
          </button>
          {message && <p className="form-message">{message}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="user-form-page">
      <form className="user-form" onSubmit={handleSubmit}>
        <h1>Create user</h1>
        <p className="form-description">Add a new user.</p>

        <button
          className="google-login-button"
          type="button"
          onClick={handleGoogleLogin}
          disabled={isSigningIn || isSubmitting}
        >
          {isSigningIn ? 'Redirecting to Google...' : 'Continue with Google'}
        </button>
        <div className="form-divider" aria-hidden="true">
          <span>or create an account</span>
        </div>

        {fields.map((field) => (
          <label className="form-field" key={field.name}>
            <span>{field.label}</span>
            <input
              name={field.name}
              type={field.type}
              value={form[field.name]}
              onChange={handleChange}
              required={field.name !== 'contact_number'}
            />
          </label>
        ))}

        <button className="submit-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating user...' : 'Create user'}
        </button>
        {message && <p className="form-message">{message}</p>}
      </form>
    </main>
  )
}

export default App
