import { useEffect, useState } from 'react'
import L from 'leaflet'
import {
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from './supabaseDB'
// import './App.css'   <-- remove this if you're fully converting to Tailwind

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

const initialTravelPlan = {
  destination: '',
  start_date: '',
  end_date: '',
  travelers: '1',
  budget: '',
  notes: '',
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

const defaultMapCenter = [20, 0]
const bordersUrl =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'
const overpassUrl = 'https://overpass-api.de/api/interpreter'

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

function MapCenterUpdater({ location }) {
  const map = useMap()

  useEffect(() => {
    if (location) {
      map.flyTo([location.lat, location.lon], 10, { duration: 1.2 })
    }
  }, [location, map])

  return null
}

function MapLocationPicker({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({
        lat: event.latlng.lat,
        lon: event.latlng.lng,
        display_name: `${event.latlng.lat.toFixed(4)}, ${event.latlng.lng.toFixed(4)}`,
      })
    },
  })

  return null
}

function TravelMap({
  location,
  onPick,
  borders,
  bordersError,
  hotels,
  restaurants,
}) {
  return (
    <div className="h-[360px] overflow-hidden rounded-xl border border-slate-600">
      <MapContainer
        className="h-full w-full"
        center={location ? [location.lat, location.lon] : defaultMapCenter}
        zoom={location ? 10 : 2}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {borders && (
          <GeoJSON
            data={borders}
            style={() => ({
              color: '#60a5fa',
              weight: 1,
              fillColor: '#2563eb',
              fillOpacity: 0.08,
            })}
          />
        )}
        <MapLocationPicker onPick={onPick} />
        <MapCenterUpdater location={location} />
        {location && (
          <Marker position={[location.lat, location.lon]} icon={markerIcon}>
            <Popup>{location.display_name}</Popup>
          </Marker>
        )}
        {hotels.map((hotel) => (
          <Marker
            key={hotel.id}
            position={[hotel.lat, hotel.lon]}
            icon={markerIcon}
          >
            <Popup>
              <strong>{hotel.name}</strong>
              {hotel.address && <div>{hotel.address}</div>}
            </Popup>
          </Marker>
        ))}
        {restaurants.map((restaurant) => (
          <Marker
            key={restaurant.id}
            position={[restaurant.lat, restaurant.lon]}
            icon={markerIcon}
          >
            <Popup>
              <strong>{restaurant.name}</strong>
              {restaurant.address && <div>{restaurant.address}</div>}
              {restaurant.cuisine && <div>Cuisine: {restaurant.cuisine}</div>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {bordersError && (
        <p className="bg-amber-950 px-3 py-2 text-xs text-amber-200">
          Country borders could not be loaded, but the street map is still available.
        </p>
      )}
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [createdUser, setCreatedUser] = useState(null)
  const [travelPlan, setTravelPlan] = useState(initialTravelPlan)
  const [savedPlan, setSavedPlan] = useState(null)
  const [mapLocation, setMapLocation] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [borders, setBorders] = useState(null)
  const [bordersError, setBordersError] = useState('')
  const [hotels, setHotels] = useState([])
  const [isLoadingHotels, setIsLoadingHotels] = useState(false)
  const [hotelsError, setHotelsError] = useState('')
  const [restaurants, setRestaurants] = useState([])
  const [isLoadingRestaurants, setIsLoadingRestaurants] = useState(false)
  const [restaurantsError, setRestaurantsError] = useState('')

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

  useEffect(() => {
    let isMounted = true

    async function loadBorders() {
      try {
        const response = await fetch(bordersUrl)
        if (!response.ok) {
          throw new Error(`Border data request failed with status ${response.status}`)
        }
        const data = await response.json()
        if (isMounted) {
          setBorders(data)
        }
      } catch (error) {
        if (isMounted) {
          setBordersError(
            error instanceof Error ? error.message : 'Unknown border loading error',
          )
        }
      }
    }

    loadBorders()

    return () => {
      isMounted = false
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

  function handleTravelPlanChange(event) {
    const { name, value } = event.target
    setTravelPlan((currentPlan) => ({ ...currentPlan, [name]: value }))
  }

  function handleTravelPlanSubmit(event) {
    event.preventDefault()
    setSavedPlan({ ...travelPlan })
  }

  async function handleDestinationSearch(event) {
    event.preventDefault()
    const query = travelPlan.destination.trim()

    if (!query) {
      return
    }

    setIsSearching(true)
    setSearchResults([])

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`,
      )
      if (!response.ok) {
        throw new Error(`Destination search failed with status ${response.status}`)
      }
      setSearchResults(await response.json())
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Destination search failed.',
      )
    } finally {
      setIsSearching(false)
    }
  }

  async function handleHotelSearch() {
    if (!mapLocation) {
      setHotelsError('Search for or select a destination first.')
      return
    }

    setIsLoadingHotels(true)
    setHotelsError('')
    setHotels([])

    const query = `
      [out:json][timeout:25];
      (
        nwr["tourism"="hotel"](around:5000,${mapLocation.lat},${mapLocation.lon});
        nwr["tourism"="hostel"](around:5000,${mapLocation.lat},${mapLocation.lon});
        nwr["tourism"="guest_house"](around:5000,${mapLocation.lat},${mapLocation.lon});
      );
      out center tags;
    `

    try {
      const response = await fetch(overpassUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ data: query }),
      })

      if (!response.ok) {
        throw new Error(`Hotel search failed with status ${response.status}`)
      }

      const data = await response.json()
      const nearbyHotels = data.elements
        .map((element) => {
          const lat = element.lat ?? element.center?.lat
          const lon = element.lon ?? element.center?.lon
          const tags = element.tags ?? {}

          if (lat == null || lon == null) {
            return null
          }

          return {
            id: `${element.type}-${element.id}`,
            lat,
            lon,
            name: tags.name || 'Unnamed accommodation',
            address:
              tags['addr:full'] ||
              [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']]
                .filter(Boolean)
                .join(' '),
          }
        })
        .filter(Boolean)
        .slice(0, 50)

      setHotels(nearbyHotels)
    } catch (error) {
      setHotelsError(
        error instanceof Error ? error.message : 'Hotel search failed.',
      )
    } finally {
      setIsLoadingHotels(false)
    }
  }

  async function handleRestaurantSearch() {
    if (!mapLocation) {
      setRestaurantsError('Search for or select a destination first.')
      return
    }

    setIsLoadingRestaurants(true)
    setRestaurantsError('')
    setRestaurants([])

    const query = `
      [out:json][timeout:25];
      nwr["amenity"="restaurant"](around:5000,${mapLocation.lat},${mapLocation.lon});
      out center tags;
    `

    try {
      const response = await fetch(overpassUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ data: query }),
      })

      if (!response.ok) {
        throw new Error(
          `Restaurant search failed with status ${response.status}`,
        )
      }

      const data = await response.json()
      const nearbyRestaurants = data.elements
        .map((element) => {
          const lat = element.lat ?? element.center?.lat
          const lon = element.lon ?? element.center?.lon
          const tags = element.tags ?? {}

          if (lat == null || lon == null) {
            return null
          }

          return {
            id: `${element.type}-${element.id}`,
            lat,
            lon,
            name: tags.name || 'Unnamed restaurant',
            cuisine: tags.cuisine,
            address:
              tags['addr:full'] ||
              [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']]
                .filter(Boolean)
                .join(' '),
          }
        })
        .filter(Boolean)
        .slice(0, 50)

      setRestaurants(nearbyRestaurants)
    } catch (error) {
      setRestaurantsError(
        error instanceof Error
          ? error.message
          : 'Restaurant search failed.',
      )
    } finally {
      setIsLoadingRestaurants(false)
    }
  }

  function selectDestination(result) {
    const location = {
      lat: Number(result.lat),
      lon: Number(result.lon),
      display_name: result.display_name,
    }
    setMapLocation(location)
    setHotels([])
    setHotelsError('')
    setRestaurants([])
    setRestaurantsError('')
    setTravelPlan((currentPlan) => ({
      ...currentPlan,
      destination: result.display_name,
    }))
    setSearchResults([])
  }

  function selectMapLocation(location) {
    setMapLocation(location)
    setHotels([])
    setHotelsError('')
    setRestaurants([])
    setRestaurantsError('')
    setTravelPlan((currentPlan) => ({
      ...currentPlan,
      destination: location.display_name,
    }))
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

      setCreatedUser(userRecord)
      setForm(initialForm)
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
      <main className="grid min-h-screen place-items-center bg-slate-900 px-4 py-8 text-slate-50">
        <p className="text-slate-200">Loading your account...</p>
      </main>
    )
  }

  if (session || createdUser) {
    const user = session?.user
    const metadata = user?.user_metadata ?? {}
    const displayName =
      metadata.full_name ||
      metadata.name ||
      createdUser?.full_name ||
      user?.email ||
      createdUser?.email
    const avatarUrl = metadata.avatar_url || metadata.picture

    return (
      <main className="min-h-screen bg-slate-900 px-4 py-8 text-slate-50">
        <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-[0_20px_45px_rgba(0,0,0,0.25)] sm:p-10">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-blue-400">
                Travel Mate
              </p>
              <h1 className="m-0 text-3xl sm:text-5xl">Welcome, {displayName}</h1>
              <p className="mt-2 text-slate-300">
                Your account is ready. Let&apos;s plan your next trip.
              </p>
            </div>

            {avatarUrl && (
              <img
                className="h-16 w-16 rounded-full object-cover"
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            )}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <article className="rounded-xl border border-slate-600 bg-slate-900 p-5">
              <span className="mb-2 block text-xs text-slate-400">Account email</span>
              <strong className="block break-all">
                {user?.email || createdUser?.email}
              </strong>
            </article>

            <article className="rounded-xl border border-slate-600 bg-slate-900 p-5">
              <span className="mb-2 block text-xs text-slate-400">Sign-in provider</span>
              <strong className="block">
                {user ? (metadata.iss ? 'Google' : 'Supabase') : 'Account created'}
              </strong>
            </article>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <form
              className="rounded-xl border border-slate-700 bg-slate-900/60 p-5"
              onSubmit={handleTravelPlanSubmit}
            >
              <h2 className="text-2xl font-semibold">Create a travel plan</h2>
              <p className="mt-2 text-sm text-slate-400">
                Add the details for your next adventure.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm text-slate-200 sm:col-span-2">
                  <span>Destination</span>
                  <div className="flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-50 focus:outline-2 focus:outline-blue-400"
                      name="destination"
                      value={travelPlan.destination}
                      onChange={handleTravelPlanChange}
                      placeholder="e.g. Kyoto, Japan"
                      required
                    />
                    <button
                      className="rounded-md border border-blue-400 px-3 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-950 disabled:cursor-wait disabled:opacity-60"
                      type="button"
                      onClick={handleDestinationSearch}
                      disabled={isSearching}
                    >
                      {isSearching ? 'Searching...' : 'Find'}
                    </button>
                  </div>
                </label>

                {searchResults.length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-xs text-slate-400">
                      Select a location to place it on the map:
                    </p>
                    <div className="space-y-2">
                      {searchResults.map((result) => (
                        <button
                          className="block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-blue-400 hover:bg-slate-700"
                          key={`${result.place_id}-${result.lat}-${result.lon}`}
                          type="button"
                          onClick={() => selectDestination(result)}
                        >
                          {result.display_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <label className="flex flex-col gap-2 text-sm text-slate-200">
                  <span>Start date</span>
                  <input
                    className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-50 focus:outline-2 focus:outline-blue-400"
                    name="start_date"
                    type="date"
                    value={travelPlan.start_date}
                    onChange={handleTravelPlanChange}
                    required
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm text-slate-200">
                  <span>End date</span>
                  <input
                    className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-50 focus:outline-2 focus:outline-blue-400"
                    name="end_date"
                    type="date"
                    value={travelPlan.end_date}
                    onChange={handleTravelPlanChange}
                    required
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm text-slate-200">
                  <span>Travelers</span>
                  <input
                    className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-50 focus:outline-2 focus:outline-blue-400"
                    name="travelers"
                    type="number"
                    min="1"
                    value={travelPlan.travelers}
                    onChange={handleTravelPlanChange}
                    required
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm text-slate-200">
                  <span>Budget</span>
                  <input
                    className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-50 focus:outline-2 focus:outline-blue-400"
                    name="budget"
                    value={travelPlan.budget}
                    onChange={handleTravelPlanChange}
                    placeholder="e.g. $1,500"
                  />
                </label>
              </div>

              <label className="mt-4 flex flex-col gap-2 text-sm text-slate-200">
                <span>Notes and interests</span>
                <textarea
                  className="min-h-24 resize-y rounded-md border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-50 focus:outline-2 focus:outline-blue-400"
                  name="notes"
                  value={travelPlan.notes}
                  onChange={handleTravelPlanChange}
                  placeholder="Food, beaches, museums, hiking..."
                />
              </label>

              <button
                className="mt-5 w-full rounded-md bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700"
                type="submit"
              >
                Save travel plan
              </button>
            </form>

            <aside className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
              <h2 className="text-2xl font-semibold">Your trip preview</h2>
              {savedPlan ? (
                <div className="mt-6 space-y-4">
                  <div>
                    <p className="text-sm text-slate-400">Destination</p>
                    <p className="text-xl font-semibold">{savedPlan.destination}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-400">Dates</p>
                      <p>{savedPlan.start_date} to {savedPlan.end_date}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Travelers</p>
                      <p>{savedPlan.travelers}</p>
                    </div>
                  </div>
                  {savedPlan.budget && (
                    <div>
                      <p className="text-sm text-slate-400">Budget</p>
                      <p>{savedPlan.budget}</p>
                    </div>
                  )}
                  {savedPlan.notes && (
                    <div>
                      <p className="text-sm text-slate-400">Notes</p>
                      <p className="whitespace-pre-wrap">{savedPlan.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-6 text-slate-400">
                  Complete the form to see your travel plan here.
                </p>
              )}
            </aside>
          </div>

          <section className="mt-8 rounded-xl border border-slate-700 bg-slate-900/60 p-5">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold">Explore your destination</h2>
              <p className="mt-2 text-sm text-slate-400">
                Search for a place or click the map to choose a location. Blue outlines show country borders.
              </p>
            </div>
            <TravelMap
              location={mapLocation}
              onPick={selectMapLocation}
              borders={borders}
              bordersError={bordersError}
              hotels={hotels}
              restaurants={restaurants}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                className="rounded-md border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={handleHotelSearch}
                disabled={!mapLocation || isLoadingHotels}
              >
                {isLoadingHotels ? 'Finding hotels...' : 'Find nearby hotels'}
              </button>
              <button
                className="rounded-md border border-orange-400 px-4 py-2 text-sm font-semibold text-orange-300 transition hover:bg-orange-950 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={handleRestaurantSearch}
                disabled={!mapLocation || isLoadingRestaurants}
              >
                {isLoadingRestaurants
                  ? 'Finding restaurants...'
                  : 'Find nearby restaurants'}
              </button>
              {mapLocation && (
                <span className="text-sm text-slate-400">
                  Searching within 5 km of {mapLocation.display_name}
                </span>
              )}
            </div>
            {hotelsError && (
              <p className="mt-3 text-sm text-amber-300">{hotelsError}</p>
            )}
            {!hotelsError && hotels.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-200">
                  Nearby accommodations ({hotels.length})
                </p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {hotels.slice(0, 10).map((hotel) => (
                    <li
                      className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                      key={hotel.id}
                    >
                      <p className="font-medium text-slate-100">{hotel.name}</p>
                      {hotel.address && (
                        <p className="mt-1 text-xs text-slate-400">{hotel.address}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {restaurantsError && (
              <p className="mt-3 text-sm text-amber-300">{restaurantsError}</p>
            )}
            {!restaurantsError && restaurants.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-200">
                  Nearby restaurants ({restaurants.length})
                </p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {restaurants.slice(0, 10).map((restaurant) => (
                    <li
                      className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                      key={restaurant.id}
                    >
                      <p className="font-medium text-slate-100">
                        {restaurant.name}
                      </p>
                      {restaurant.cuisine && (
                        <p className="mt-1 text-xs capitalize text-orange-300">
                          {restaurant.cuisine.replaceAll(';', ', ')}
                        </p>
                      )}
                      {restaurant.address && (
                        <p className="mt-1 text-xs text-slate-400">
                          {restaurant.address}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Map, hotel, and restaurant data &copy; OpenStreetMap contributors. Search powered by Nominatim and Overpass.
            </p>
          </section>

          {user && (
            <button
              className="mt-8 rounded-md border border-slate-500 bg-transparent px-4 py-3 font-semibold text-slate-50 transition hover:bg-slate-700"
              type="button"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          )}

          {message && (
            <p className="mt-4 text-slate-200 break-all">{message}</p>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-900 px-4 py-8">
      <form
        className="w-full max-w-[560px] rounded-xl border border-slate-700 bg-slate-800 p-8 text-slate-50 shadow-[0_20px_45px_rgba(0,0,0,0.25)]"
        onSubmit={handleSubmit}
      >
        <h1 className="m-0 text-3xl font-semibold">Create user</h1>
        <p className="mt-2 mb-6 text-slate-300">Add a new user.</p>

        <button
          className="w-full rounded-md border border-slate-500 bg-slate-50 px-4 py-3 font-semibold text-slate-900 transition hover:bg-slate-200 disabled:cursor-wait disabled:opacity-70"
          type="button"
          onClick={handleGoogleLogin}
          disabled={isSigningIn || isSubmitting}
        >
          {isSigningIn ? 'Redirecting to Google...' : 'Continue with Google'}
        </button>

        <div className="my-6 flex items-center gap-3 text-[13px] text-slate-400 before:h-px before:flex-1 before:bg-slate-600 before:content-[''] after:h-px after:flex-1 after:bg-slate-600 after:content-['']">
          <span>or create an account</span>
        </div>

        {fields.map((field) => (
          <label
            className="mb-4 flex flex-col gap-2 text-sm text-slate-200"
            key={field.name}
          >
            <span>{field.label}</span>
            <input
              name={field.name}
              type={field.type}
              value={form[field.name]}
              onChange={handleChange}
              required={field.name !== 'contact_number'}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2.5 text-slate-50 placeholder:text-slate-400 focus:outline-2 focus:outline-blue-400 focus:outline-offset-1"
            />
          </label>
        ))}

        <button
          className="mt-2 w-full rounded-md bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating user...' : 'Create user'}
        </button>

        {message && (
          <p className="mt-4 break-all text-slate-200">{message}</p>
        )}
      </form>
    </main>
  )
}

export default App
