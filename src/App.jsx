import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useSync } from './hooks/useSync'
import Dashboard from './pages/Dashboard'
import CachePage from './pages/CachePage'
import QueuePage from './pages/QueuePage'
import Layout from './components/Layout'

function AppInner() {
  useSync()
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cache" element={<CachePage />} />
        <Route path="/queue" element={<QueuePage />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}