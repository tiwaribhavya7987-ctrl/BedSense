import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Activity, AlertOctagon, ArrowDownRight, ArrowUpRight, Bell, Bed, ChartNoAxesCombined, ChevronDown, CircleHelp, Clock3, Cloud, Download, Gauge, HeartPulse, LayoutDashboard, LogOut, Menu, Moon, MoreHorizontal, Settings, ShieldCheck, Sun, Thermometer, Users, Wind, Wifi, WifiOff, Droplets, LockKeyhole, Mail, Eye, EyeOff, ArrowRight, CheckCircle2, Flame, Radio, SlidersHorizontal, CalendarDays, Search, X } from 'lucide-react'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail, signOut, getIdTokenResult, User } from 'firebase/auth'
import { onValue, ref, set } from 'firebase/database'
import { auth, db, demoMode, firebaseConfigured, googleProvider } from './firebase'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line } from 'recharts'

type Reading = {
  deviceId?: string
  mode?: string
  heartRate?: number | null
  spo2?: number | null
  temperature?: number | null
  humidity?: number | null
  bedAngle?: number | null
  sos?: boolean
  fireAlarm?: boolean
  temperatureMonitoring?: boolean
  lastUpdated?: number
}

const demoReading: Reading = {
  deviceId: 'BED-001',
  mode: 'active',
  heartRate: 78,
  spo2: 98,
  temperature: 36.4,
  humidity: 52,
  bedAngle: 32,
  sos: false,
  fireAlarm: false,
  temperatureMonitoring: true,
  lastUpdated: Date.now()
}

const chartData = Array.from({ length: 16 }, (_, i) => ({
  time: `${String(10 + Math.floor(i / 4)).padStart(2, '0')}:${String((i * 4) % 60).padStart(2, '0')}`,
  heart: 76 + Math.sin(i * 1.4) * 5,
  spo2: 97 + Math.cos(i) * 1.4,
  temp: 36.2 + Math.sin(i * 0.7) * 0.3
}))

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/bed', label: 'Bed details', icon: Bed },
  { to: '/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
  { to: '/alerts', label: 'Alerts & events', icon: Bell },
  { to: '/admin', label: 'Administration', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings }
]

const fmt = (n: number | null | undefined, unit: string) =>
  n == null ? '—' : `${n}${unit}`

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [reading, setReading] = useState<Reading | null>(demoMode ? demoReading : null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [sidebar, setSidebar] = useState(true)
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (!auth) {
      setAuthReady(true)
      return
    }

    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setIsAdmin(false)
      if (u) {
        getIdTokenResult(u, true)
          .then((token) => setIsAdmin(token.claims.admin === true))
          .catch(() => setIsAdmin(false))
      }
      setAuthReady(true)
    })
  }, [])

  // Firebase listener: read the path shown in your Firebase Rules.
  useEffect(() => {
    if (!db || !user) {
      setReading(demoMode ? demoReading : null)
      return
    }

    setNotice('')

    const databaseRef = ref(db, 'bedsense/bed1')

    const unsubscribe = onValue(
      databaseRef,
      (snapshot) => {
        const data = snapshot.val()

        console.log('BedSense Firebase path: bedsense/bed1')
        console.log('BedSense Firebase data:', data)

        if (!data || typeof data !== 'object') {
          setReading(null)
          setNotice(
            'No sensor data found at bedsense/bed1. Check where your NodeMCU writes its readings.'
          )
          return
        }

        const raw = data as Record<string, unknown>

        const getValue = (...keys: string[]): unknown => {
          for (const key of keys) {
            if (raw[key] !== undefined && raw[key] !== null) {
              return raw[key]
            }
          }
          return undefined
        }

        const toNumber = (value: unknown): number | null => {
          if (value === undefined || value === null || value === '') {
            return null
          }

          const result = Number(value)
          return Number.isFinite(result) ? result : null
        }

        const toBoolean = (value: unknown): boolean | undefined => {
          if (value === undefined || value === null) return undefined
          if (typeof value === 'boolean') return value
          if (typeof value === 'number') return value !== 0

          const normalized = String(value).toLowerCase().trim()

          if (['true', '1', 'on', 'active', 'yes'].includes(normalized)) {
            return true
          }

          if (['false', '0', 'off', 'inactive', 'no'].includes(normalized)) {
            return false
          }

          return undefined
        }

        const nextReading: Reading = {
          deviceId: String(getValue('deviceId', 'device_id') ?? 'BED-001'),
          mode: String(getValue('mode', 'bedMode', 'bed_mode') ?? 'Unknown'),

          heartRate: toNumber(
            getValue('heartRate', 'heart_rate', 'hr', 'bpm')
          ),

          spo2: toNumber(
            getValue('spo2', 'SpO2', 'spo2Value', 'oxygen')
          ),

          temperature: toNumber(
            getValue('temperature', 'temp', 'temperatureC')
          ),

          humidity: toNumber(
            getValue('humidity', 'hum')
          ),

          bedAngle: toNumber(
            getValue('bedAngle', 'bed_angle', 'angle')
          ),

          sos: toBoolean(
            getValue('sos', 'SOS', 'sosActive')
          ),

          fireAlarm: toBoolean(
            getValue('fireAlarm', 'fire_alarm', 'fire', 'fireStatus')
          ),

          temperatureMonitoring: toBoolean(
            getValue('temperatureMonitoring', 'temperature_monitoring')
          ),

          lastUpdated:
            toNumber(getValue('lastUpdated', 'last_updated', 'timestamp')) ??
            Date.now()
        }

        setReading(nextReading)
        setNotice('')
      },

      (firebaseError) => {
  const errorCode =
    (firebaseError as Error & { code?: string }).code ?? 'unknown'

  console.error(
    'BedSense Firebase read failed:',
    errorCode,
    firebaseError.message
  )

  setNotice(
    `Firebase read failed: ${errorCode} — ${firebaseError.message}`
  )
}
)

    return unsubscribe
  }, [user, db, demoMode])

  const configured = firebaseConfigured

  const deviceState =
    reading?.lastUpdated && Date.now() - reading.lastUpdated < 90000
      ? 'Online'
      : reading
        ? 'Stale'
        : 'Waiting for data'

  const activeAlerts = Boolean(reading?.sos || reading?.fireAlarm)

  const currentTitle =
    navItems.find((n) => n.to === location.pathname)?.label || 'Overview'

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)

    try {
      if (!auth) {
        throw new Error(
          'Firebase is not configured. Add your Firebase values to .env.local first.'
        )
      }

      if (loginMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        await createUserWithEmailAndPassword(auth, email, password)
      }

      navigate('/')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in. Please try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError('')

    if (!auth) {
      setError(
        'Firebase is not configured. Add your Firebase values to .env.local first.'
      )
      return
    }

    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed.')
    }
  }

  const logout = async () => {
    if (auth) await signOut(auth)
    setUser(null)
    navigate('/login')
  }

  if (!authReady) {
    return (
      <div className="boot">
        <div className="brand-mark"><Activity /></div>
        <span>Initialising BedSense</span>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route
          path="*"
          element={
            <div className="login-shell">
              <div className="login-art">
                <div className="art-top">
                  <Brand />
                  <button
                    className="theme-toggle"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  >
                    {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                  </button>
                </div>

                <div className="art-copy">
                  <div className="eyebrow">
                    <span className="pulse-dot" /> INTELLIGENT BED MONITORING
                  </div>

                  <h1>
                    Care that sees<br />
                    <em>the whole picture.</em>
                  </h1>

                  <p>
                    One connected view of patient vitals, bed position and environmental safety.
                  </p>

                  <div className="art-feature">
                    <span><HeartPulse /></span>
                    <div>
                      <b>Vital signs, in context</b>
                      <small>Sensor readings in one considered view</small>
                    </div>
                  </div>

                  <div className="art-feature">
                    <span><Radio /></span>
                    <div>
                      <b>Connected by design</b>
                      <small>Live device status with honest data freshness</small>
                    </div>
                  </div>
                </div>

                <div className="art-foot">
                  <span>BEDSense / SYSTEM 01</span>
                  <span>BUILT FOR BETTER VISIBILITY</span>
                </div>
              </div>

              <div className="login-side">
                <div className="mobile-brand"><Brand /></div>

                <div className="login-card">
                  <div className="eyebrow">
                    SECURE ACCESS <span className="line" />
                  </div>

                  <h2>{loginMode === 'login' ? 'Welcome back' : 'Create your access'}</h2>

                  <p className="muted">
                    Sign in to your BedSense monitoring workspace.
                  </p>

                  <form onSubmit={signIn}>
                    <label>Email address</label>

                    <div className="input-wrap">
                      <Mail size={17} />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@hospital.org"
                      />
                    </div>

                    <label>Password</label>

                    <div className="input-wrap">
                      <LockKeyhole size={17} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                      />

                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {loginMode === 'login' && (
                      <button
                        type="button"
                        className="forgot"
                        onClick={async () => {
                          if (!auth || !email) {
                            setError('Enter your email first, then select forgot password.')
                            return
                          }

                          try {
                            await sendPasswordResetEmail(auth, email)
                            setError('Password reset email sent.')
                          } catch (e) {
                            setError(
                              e instanceof Error
                                ? e.message
                                : 'Unable to send reset email.'
                            )
                          }
                        }}
                      >
                        Forgot password?
                      </button>
                    )}

                    {error && <div className="error-message">{error}</div>}

                    <button className="primary-button full" disabled={busy}>
                      {busy
                        ? 'Please wait…'
                        : loginMode === 'login'
                          ? 'Sign in securely'
                          : 'Create account'}
                      <ArrowRight size={16} />
                    </button>
                  </form>

                  <div className="separator">
                    <span />or continue with<span />
                  </div>

                  <button className="google-button" onClick={google}>
                    <GoogleMark /> Continue with Google
                  </button>

                  <p className="switch-auth">
                    {loginMode === 'login' ? 'New to BedSense?' : 'Already registered?'}
                    {' '}
                    <button
                      onClick={() => {
                        setLoginMode(loginMode === 'login' ? 'register' : 'login')
                        setError('')
                      }}
                    >
                      {loginMode === 'login' ? 'Create account' : 'Sign in'}
                    </button>
                  </p>

                  <div className="security-note">
                    <ShieldCheck size={15} /> Protected access · Firebase Authentication
                  </div>
                </div>

                <div className="login-bottom">
                  BEDSense <span>•</span> SMART BED MONITORING
                  <span className="right">v1.0.0</span>
                </div>
              </div>
            </div>
          }
        />
      </Routes>
    )
  }

  return (
    <div className={`app-layout ${sidebar ? '' : 'sidebar-collapsed'}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Brand />
          <button className="collapse-btn" onClick={() => setSidebar(false)}>
            <Menu size={17} />
          </button>
        </div>

        <div className="workspace-label">MONITORING WORKSPACE</div>

        <nav>
          {navItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => 'nav-link ' + (isActive ? 'active' : '')}
            >
              <n.icon size={17} />
              <span>{n.label}</span>
              {n.to === '/alerts' && activeAlerts && <i className="nav-alert" />}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="connection-mini">
            <span className={`status-dot ${deviceState === 'Online' ? 'green' : 'amber'}`} />
            <div>
              <b>{deviceState === 'Online' ? 'Device connected' : 'Device ' + deviceState.toLowerCase()}</b>
              <small>BED-001 · NodeMCU</small>
            </div>
          </div>

          <button className="user-mini" onClick={logout}>
            <div className="avatar">{(user.email || 'U').slice(0, 1).toUpperCase()}</div>
            <div>
              <b>{user.displayName || user.email}</b>
              <small>Signed-in user</small>
            </div>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="top-left">
            <button
              className="icon-button menu-mobile"
              onClick={() => setSidebar(!sidebar)}
            >
              <Menu size={18} />
            </button>

            <div>
              <div className="breadcrumb">
                BEDSENSE <span>/</span> {currentTitle.toUpperCase()}
              </div>
              <h2>{currentTitle}</h2>
            </div>
          </div>

          <div className="top-actions">
            <div className="device-chip">
              <span className={`status-dot ${deviceState === 'Online' ? 'green' : 'amber'}`} />
              <span>{deviceState}</span>
              <small>BED-001</small>
            </div>

            <button
              className="icon-button"
              title="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button className="profile-button" onClick={logout}>
              <div className="avatar">{(user.email || 'U').slice(0, 1).toUpperCase()}</div>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>

        {notice && (
          <div className="notice">
            <AlertOctagon size={16} />
            {notice}
            <button onClick={() => setNotice('')}>
              <X size={15} />
            </button>
          </div>
        )}

        <div className="page-content">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  reading={reading}
                  deviceState={deviceState}
                  activeAlerts={activeAlerts}
                  demo={demoMode}
                />
              }
            />
            <Route
              path="/bed"
              element={<BedDetails reading={reading} deviceState={deviceState} />}
            />
            <Route path="/analytics" element={<Analytics reading={reading} />} />
            <Route path="/alerts" element={<Alerts reading={reading} user={user} isAdmin={isAdmin} />} />
            <Route path="/admin" element={<Admin configured={configured} />} />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  theme={theme}
                  setTheme={setTheme}
                  configured={configured}
                  demo={demoMode}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        <footer className="app-footer">
          <span>BedSense <i>•</i> Prototype monitoring interface</span>
          <span><ShieldCheck size={13} /> Not a certified medical device</span>
        </footer>
      </main>
    </div>
  )
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-icon"><Activity size={22} /></div>
      <div>
        <b>BedSense</b>
        <small>INTELLIGENT BED MONITORING</small>
      </div>
    </div>
  )
}

function GoogleMark() {
  return <span className="google-mark">G</span>
}

function PageHeading({
  kicker,
  title,
  desc,
  action
}: {
  kicker: string
  title: string
  desc: string
  action?: React.ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{kicker}</div>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {action}
    </div>
  )
}

function Metric({
  title,
  value,
  unit,
  icon: Icon,
  accent,
  caption
}: {
  title: string
  value: string
  unit?: string
  icon: any
  accent: string
  caption: string
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span className={`metric-icon ${accent}`}><Icon size={18} /></span>
        <span className="metric-caption">{caption}</span>
      </div>
      <div className="metric-label">{title}</div>
      <div className="metric-value">{value}<small>{unit}</small></div>
      <div className="metric-foot">
        <span className="tiny-line" />
        <span>Live sensor reading</span>
      </div>
    </div>
  )
}

function Dashboard({
  reading,
  deviceState,
  activeAlerts,
  demo
}: {
  reading: Reading | null
  deviceState: string
  activeAlerts: boolean
  demo: boolean
}) {
  const vitals = [
    {
      title: 'Heart rate',
      value: fmt(reading?.heartRate, ''),
      unit: 'BPM',
      icon: HeartPulse,
      accent: 'coral',
      caption: 'MAX30102'
    },
    {
      title: 'Blood oxygen',
      value: fmt(reading?.spo2, ''),
      unit: '%',
      icon: Activity,
      accent: 'cyan',
      caption: 'SpO₂'
    },
    {
      title: 'Temperature',
      value:
        reading?.temperature == null || reading?.temperatureMonitoring === false
          ? '—'
          : fmt(reading.temperature, ''),
      unit:
        reading?.temperature == null || reading?.temperatureMonitoring === false
          ? ''
          : '°C',
      icon: Thermometer,
      accent: 'orange',
      caption: 'DHT22'
    },
    {
      title: 'Humidity',
      value: fmt(reading?.humidity, ''),
      unit: '%',
      icon: Droplets,
      accent: 'blue',
      caption: 'DHT22'
    }
  ]

  return (
    <>
      <PageHeading
        kicker="LIVE MONITORING / BED-001"
        title="A clearer view of care."
        desc="Your connected bed, its environment, and every signal that matters."
        action={
          <div className="date-display">
            <CalendarDays size={15} />
            {new Date().toLocaleDateString(undefined, {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })}
          </div>
        }
      />

      {demo && (
        <div className="demo-banner">
          <Radio size={15} />
          DEMO MODE — sample readings are displayed for interface preview. They are not real patient data.
        </div>
      )}

      <div className="overview-strip">
        <div className="overview-bed">
          <div className="bed-copy">
            <div className="section-kicker">
              <span className="status-dot teal" /> BED OVERVIEW
            </div>

            <h3>
              Bed 001 <span className="tag">{reading?.mode || 'Unknown'}</span>
            </h3>

            <p>
              {deviceState === 'Online'
                ? 'Device is reporting recent readings.'
                : deviceState === 'Stale'
                  ? 'Last readings are old; live status is uncertain.'
                  : 'Waiting for device data from Firebase.'}
            </p>

            <div className="bed-meta">
              <span>
                <Gauge size={15} /> Bed angle <b>{fmt(reading?.bedAngle, '°')}</b>
              </span>
              <span>
                <Clock3 size={15} /> Updated{' '}
                <b>
                  {reading?.lastUpdated
                    ? new Date(reading.lastUpdated).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '—'}
                </b>
              </span>
            </div>
          </div>

          <BedScene angle={reading?.bedAngle} />
        </div>

        <div className="safety-panel">
          <div className="section-kicker">SAFETY MONITOR</div>

          <div className={`safety-state ${activeAlerts ? 'danger' : ''}`}>
            <span className="safety-icon">
              {activeAlerts ? <AlertOctagon size={21} /> : <ShieldCheck size={21} />}
            </span>
            <div>
              <b>{activeAlerts ? 'Attention required' : 'No active alerts reported'}</b>
              <small>
                {activeAlerts
                  ? 'An alert is active on the device.'
                  : 'SOS and temperature alert status from device.'}
              </small>
            </div>
          </div>

          <div className="safety-row">
            <span><AlertOctagon size={15} /> SOS button</span>
            <b className={reading?.sos ? 'text-danger' : ''}>
              {reading?.sos ? 'ACTIVE' : reading ? 'Inactive' : 'Unknown'}
            </b>
          </div>

          <div className="safety-row">
            <span><Flame size={15} /> Temperature alert</span>
            <b className={reading?.fireAlarm ? 'text-danger' : ''}>
              {reading?.fireAlarm ? 'ACTIVE' : reading ? 'Clear' : 'Unknown'}
            </b>
          </div>
        </div>
      </div>

      <div className="section-title-row">
        <div>
          <div className="section-kicker">SENSOR TELEMETRY</div>
          <h3>Vital signs & environment</h3>
        </div>
        <span className="quiet-label">
          <span className="status-dot teal" /> {reading ? 'Database values' : 'No readings yet'}
        </span>
      </div>

      <div className="metric-grid">
        {vitals.map((v) => <Metric key={v.title} {...v} />)}
      </div>

      <div className="content-grid">
        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">RECENT HISTORY</div>
              <h3>Vitals trend</h3>
            </div>
            <span className="chart-period">Preview only</span>
          </div>

          {reading && reading.heartRate != null
            ? <TrendChart />
            : <EmptyChart text="Historical readings will appear when the device writes records to Firebase." />}
        </div>

        <div className="panel device-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">DEVICE HEALTH</div>
              <h3>Connection details</h3>
            </div>
            <MoreHorizontal size={18} />
          </div>

          <div className="device-visual">
            <div className="device-ring"><Radio size={28} /></div>
            <div>
              <b>NodeMCU ESP8266</b>
              <small>Device ID · BED-001</small>
            </div>
          </div>

          <div className="device-detail">
            <span>Connection</span>
            <b>
              <span className={`status-dot ${deviceState === 'Online' ? 'green' : 'amber'}`} />
              {deviceState}
            </b>
          </div>

          <div className="device-detail">
            <span>Operating mode</span>
            <b>{reading?.mode || 'Unknown'}</b>
          </div>

          <div className="device-detail">
            <span>Temperature sensor</span>
            <b>
              {reading?.temperatureMonitoring === false
                ? 'Paused'
                : reading?.temperature != null
                  ? 'Reporting'
                  : 'Unavailable'}
            </b>
          </div>

          <Link to="/bed" className="text-link">
            View bed details <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </>
  )
}

function BedScene({ angle }: { angle?: number | null }) {
  return (
    <div className="bed-scene">
      <div className="scene-glow" />
      <div
        className="bed-art"
        style={{
          transform: `perspective(500px) rotateY(-13deg) rotateZ(-${Math.max(-5, Math.min(45, angle || 0)) * 0.18}deg)`
        }}
      >
        <div className="bed-head" />
        <div className="mattress" />
        <div className="bed-base" />
        <div className="bed-leg leg-one" />
        <div className="bed-leg leg-two" />
        <div className="bed-wheel wheel-one" />
        <div className="bed-wheel wheel-two" />
        <div className="bed-rail" />
      </div>
      <div className="angle-orbit">
        <span>{angle == null ? '—' : `${angle}°`}</span>
        <small>BED ANGLE</small>
      </div>
      <div className="scene-caption">
        POSITION VISUALISATION <span>•</span> READ ONLY
      </div>
    </div>
  )
}

function TrendChart() {
  return (
    <div className="chart-area">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4de0c0" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#4de0c0" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 5" stroke="var(--chart-grid)" />
          <XAxis dataKey="time" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
          <Area type="monotone" dataKey="heart" name="Heart rate" stroke="#4de0c0" fill="url(#hrFill)" strokeWidth={2} />
          <Line type="monotone" dataKey="spo2" name="SpO₂" stroke="#55bdf7" strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="chart-disclaimer">
        Illustrative trend styling only. Replace with stored Firebase history before production.
      </div>
    </div>
  )
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="empty-chart">
      <div className="empty-chart-icon"><ChartNoAxesCombined size={22} /></div>
      <b>No historical data available</b>
      <p>{text}</p>
    </div>
  )
}

function BedDetails({
  reading,
  deviceState
}: {
  reading: Reading | null
  deviceState: string
}) {
  return (
    <>
      <PageHeading
        kicker="DEVICE / BED-001"
        title="Bed details"
        desc="Position, sensor inventory and device health at a glance."
      />

      <div className="bed-detail-layout">
        <div className="panel bed-detail-hero">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">POSITION VISUALISATION</div>
              <h3>Adjustable bed</h3>
            </div>
            <span className="tag">Read only</span>
          </div>

          <BedScene angle={reading?.bedAngle} />

          <div className="angle-summary">
            <div>
              <small>Current angle</small>
              <b>{fmt(reading?.bedAngle, '°')}</b>
            </div>
            <div>
              <small>Operating mode</small>
              <b>{reading?.mode || 'Unknown'}</b>
            </div>
            <div>
              <small>Device state</small>
              <b>{deviceState}</b>
            </div>
          </div>
        </div>

        <div className="panel sensor-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">HARDWARE INVENTORY</div>
              <h3>Connected sensors</h3>
            </div>
          </div>

          {[
            {
              name: 'MAX30102',
              detail: 'Heart rate & SpO₂',
              icon: HeartPulse,
              val: reading?.heartRate != null || reading?.spo2 != null
            },
            {
              name: 'DHT22',
              detail: 'Temperature & humidity',
              icon: Thermometer,
              val: reading?.temperature != null || reading?.humidity != null
            },
            {
              name: 'ADXL345',
              detail: 'Bed angle',
              icon: Gauge,
              val: reading?.bedAngle != null
            },
            {
              name: 'SOS input',
              detail: 'Emergency push button',
              icon: AlertOctagon,
              val: reading?.sos != null
            }
          ].map((s) => (
            <div className="sensor-row" key={s.name}>
              <span className="sensor-icon"><s.icon size={17} /></span>
              <div>
                <b>{s.name}</b>
                <small>{s.detail}</small>
              </div>
              <span className={`sensor-state ${s.val ? '' : 'unknown'}`}>
                {s.val ? 'Data received' : 'No reading'}
              </span>
            </div>
          ))}

          <div className="info-note">
            <CircleHelp size={16} />
            <span>
              Sensor status here reflects available readings, not a hardware self-test.
              Firmware heartbeat and error fields can be added to the schema.
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

function Analytics({ reading }: { reading: Reading | null }) {
  const [period, setPeriod] = useState('1 hour')

  return (
    <>
      <PageHeading
        kicker="TRENDS / REPORTING"
        title="Analytics"
        desc="Explore available readings over time. Historical summaries require stored device records."
        action={
          <select
            className="select-control"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option>15 minutes</option>
            <option>1 hour</option>
            <option>6 hours</option>
            <option>24 hours</option>
          </select>
        }
      />

      <div className="analytics-summary">
        {[
          { label: 'Latest heart rate', value: fmt(reading?.heartRate, ' BPM'), icon: HeartPulse },
          { label: 'Latest SpO₂', value: fmt(reading?.spo2, ' %'), icon: Activity },
          {
            label: 'Latest temperature',
            value:
              reading?.temperature == null || reading?.temperatureMonitoring === false
                ? '—'
                : fmt(reading.temperature, ' °C'),
            icon: Thermometer
          },
          { label: 'Latest bed angle', value: fmt(reading?.bedAngle, '°'), icon: Gauge }
        ].map((x) => (
          <div className="summary-stat" key={x.label}>
            <x.icon size={17} />
            <span>{x.label}</span>
            <b>{x.value}</b>
          </div>
        ))}
      </div>

      <div className="panel analytics-chart">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">HEALTH TELEMETRY</div>
            <h3>Heart rate & oxygen saturation</h3>
          </div>
          <span className="chart-period">{period}</span>
        </div>
        <EmptyChart text="Connect Firebase history records to populate analytics. No historical values are fabricated." />
      </div>

      <div className="panel analytics-chart">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">ENVIRONMENT</div>
            <h3>Temperature & humidity</h3>
          </div>
        </div>
        <EmptyChart text="Environmental charts will render when timestamped history is available." />
      </div>
    </>
  )
}

function Alerts({
  reading,
  user,
  isAdmin
}: {
  reading: Reading | null
  user: User | null
  isAdmin: boolean
}) {
  const [sending, setSending] = useState<'silence_sos' | 'silence_fire' | null>(null)
  const [commandMessage, setCommandMessage] = useState('')
  const [commandId, setCommandId] = useState('')
  const [ack, setAck] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (!db || !commandId) {
      setAck(null)
      return
    }
    return onValue(ref(db, `bedsense/commandAcks/${commandId}`), (snapshot) => {
      const value = snapshot.val()
      if (value && typeof value === 'object') {
        setAck(value as Record<string, unknown>)
        const status = String((value as Record<string, unknown>).status ?? '')
        if (status === 'success' || status === 'rejected' || status === 'expired') {
          setSending(null)
          setCommandMessage(
            status === 'success'
              ? 'Device acknowledged the command.'
              : `Device command ${status}. Check the device connection.`
          )
        }
      }
    }, () => setCommandMessage('Could not read the device acknowledgement. Check database permissions.'))
  }, [commandId])

  const sendCommand = async (action: 'silence_sos' | 'silence_fire') => {
    if (!db || !user || !isAdmin) {
      setCommandMessage('Administrator permission is required to control the buzzer.')
      return
    }
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    setSending(action)
    setCommandMessage('Sending command to BED-001…')
    setCommandId(id)
    setAck(null)
    try {
      await set(ref(db, 'bedsense/commands/current'), {
        commandId: id,
        action,
        requestedAtMs: Date.now(),
        issuedBy: user.uid,
        status: 'pending'
      })
      window.setTimeout(() => {
        setSending((current) => {
          if (current === action) {
            setCommandMessage('Command is still awaiting the NodeMCU acknowledgement. Hardware command handling is not installed yet or the device is offline.')
            return null
          }
          return current
        })
      }, 15000)
    } catch (error) {
      setSending(null)
      setCommandMessage(error instanceof Error ? error.message : 'Unable to send command.')
    }
  }

  const items = [
    {
      active: reading?.sos === true,
      title: 'SOS button',
      detail: 'Emergency button state reported by device',
      icon: AlertOctagon
    },
    {
      active: reading?.fireAlarm === true,
      title: 'Temperature alert',
      detail: 'Temperature-threshold alert reported by device',
      icon: Flame
    }
  ]

  return (
    <>
      <PageHeading
        kicker="EVENTS / SAFETY"
        title="Alerts & events"
        desc="Review active device alerts and, with administrator permission, silence their buzzers remotely."
      />

      <div className="alert-intro">
        <div className="alert-intro-icon"><Bell size={22} /></div>
        <div>
          <b>{items.some((x) => x.active) ? 'An active alert needs attention' : 'No active alerts reported'}</b>
          <p>Silencing a buzzer does not clear the SOS or temperature alert. The device must report the event as cleared.</p>
        </div>
      </div>

      <div className="panel event-list">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">CURRENT STATUS</div>
            <h3>Alert channels</h3>
          </div>
          <span className="tag">{items.filter((x) => x.active).length} active</span>
        </div>

        {items.map((x) => (
          <div className="event-row" key={x.title}>
            <div className={`event-icon ${x.active ? 'danger' : 'safe'}`}>
              <x.icon size={18} />
            </div>
            <div className="event-copy">
              <b>{x.title}</b>
              <small>{x.detail}</small>
            </div>
            <span className={`event-status ${x.active ? 'danger' : 'safe'}`}>
              {x.active ? 'ACTIVE' : reading ? 'CLEAR' : 'UNKNOWN'}
            </span>
            <button
              className="primary-button"
              type="button"
              disabled={!isAdmin || !x.active || sending !== null}
              onClick={() => sendCommand(x.title === 'SOS button' ? 'silence_sos' : 'silence_fire')}
              title={!isAdmin ? 'Administrator permission required' : !x.active ? 'No active alert' : 'Silence this alert buzzer'}
            >
              {sending === (x.title === 'SOS button' ? 'silence_sos' : 'silence_fire')
                ? 'Sending…'
                : 'Silence buzzer'}
            </button>
          </div>
        ))}
      </div>

      <div className="panel event-list">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">REMOTE CONTROL</div>
            <h3>Device command status</h3>
          </div>
          <span className="tag">{isAdmin ? 'Administrator' : 'Read only'}</span>
        </div>
        <p className="muted small">
          {isAdmin
            ? 'Commands are sent to the device and remain pending until its firmware acknowledges them.'
            : 'Your account does not have the administrator permission required to send device commands.'}
        </p>
        {commandMessage && <div className="info-note"><CircleHelp size={16} /><span>{commandMessage}</span></div>}
        {ack && <div className="device-detail"><span>Device acknowledgement</span><b>{String(ack.status ?? 'Received')}</b></div>}
      </div>

      <div className="info-note wide">
        <CircleHelp size={16} />
        <span>
          Remote controls will work only after the NodeMCU firmware is updated to poll the command path and write acknowledgements. Local hardware alarms must remain functional. This prototype is not a substitute for clinical monitoring or emergency procedures.
        </span>
      </div>
    </>
  )
}

function Admin({ configured }: { configured: boolean }) {
  return (
    <>
      <PageHeading
        kicker="SYSTEM / ACCESS CONTROL"
        title="Administration"
        desc="Device configuration and role-based access setup."
      />

      <div className="admin-warning">
        <ShieldCheck size={20} />
        <div>
          <b>Administrator authorization must be configured</b>
          <p>
            Admin access is not granted by this page. Implement Firebase custom claims or a
            trusted backend role check and enforce matching Realtime Database rules before using
            administrative actions.
          </p>
        </div>
      </div>

      <div className="admin-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">REGISTERED DEVICE</div>
              <h3>Device registry</h3>
            </div>
            <Bed size={18} />
          </div>

          <div className="admin-device">
            <div className="device-icon-large"><Radio size={23} /></div>
            <div>
              <b>BED-001</b>
              <small>NodeMCU ESP8266</small>
            </div>
            <span className="tag">Prototype</span>
          </div>

          <p className="muted small">
            One logical device is preconfigured in the interface. Additional device registration
            is not yet enabled.
          </p>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">CONFIGURATION</div>
              <h3>Backend status</h3>
            </div>
            <SlidersHorizontal size={18} />
          </div>

          <div className="device-detail">
            <span>Firebase web config</span>
            <b>{configured ? 'Configured' : 'Missing'}</b>
          </div>
          <div className="device-detail">
            <span>Role enforcement</span>
            <b className="text-warn">Setup required</b>
          </div>
          <div className="device-detail">
            <span>Audit trail</span>
            <b>Not configured</b>
          </div>
        </div>
      </div>
    </>
  )
}

function SettingsPage({
  theme,
  setTheme,
  configured,
  demo
}: {
  theme: string
  setTheme: (v: 'dark' | 'light') => void
  configured: boolean
  demo: boolean
}) {
  return (
    <>
      <PageHeading
        kicker="PREFERENCES / SYSTEM"
        title="Settings"
        desc="Manage the display preferences and review the connection setup."
      />

      <div className="settings-layout">
        <div className="panel settings-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">APPEARANCE</div>
              <h3>Interface preferences</h3>
            </div>
            <Sun size={18} />
          </div>

          <div className="setting-row">
            <div>
              <b>Color theme</b>
              <small>Choose the monitoring workspace appearance.</small>
            </div>
            <div className="segmented">
              <button
                className={theme === 'dark' ? 'selected' : ''}
                onClick={() => setTheme('dark')}
              >
                <Moon size={15} /> Dark
              </button>
              <button
                className={theme === 'light' ? 'selected' : ''}
                onClick={() => setTheme('light')}
              >
                <Sun size={15} /> Light
              </button>
            </div>
          </div>
        </div>

        <div className="panel settings-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">CONNECTIVITY</div>
              <h3>Data source</h3>
            </div>
            <Cloud size={18} />
          </div>

          <div className="device-detail">
            <span>Firebase configuration</span>
            <b>{configured ? 'Detected' : 'Not configured'}</b>
          </div>

          <div className="device-detail">
            <span>Realtime database</span>
            <b>{db ? 'Available' : 'Not connected'}</b>
          </div>

          <div className="device-detail">
            <span>Demo mode</span>
            <b>{demo ? 'Enabled' : 'Disabled'}</b>
          </div>

          <p className="muted small">
            Set environment variables in .env.local, then restart the development server.
            Keep demo mode disabled when using actual sensor data.
          </p>
        </div>

        <div className="info-note">
          <ShieldCheck size={16} />
          <span>
            BedSense is a prototype monitoring interface, not a certified medical device or a
            substitute for clinical monitoring and emergency procedures.
          </span>
        </div>
      </div>
    </>
  )
}

export default App