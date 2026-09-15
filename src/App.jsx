import { useState } from 'react'
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
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setIsSubmitting(true)

    const { error } = await supabase.from('users').insert([form])

    setIsSubmitting(false)

    if (error) {
      setMessage(`Could not create user: ${error.message}`)
      return
    }

    setForm(initialForm)
    setMessage('User created successfully.')
  }

  return (
    <main className="user-form-page">
      <form className="user-form" onSubmit={handleSubmit}>
        <h1>Create user</h1>
        <p className="form-description">Add a new user.</p>

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
