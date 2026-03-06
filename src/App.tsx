import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import { Toaster } from '@/components/ui/toaster'

function App() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Dashboard />
      <Toaster />
    </div>
  )
}

export default App
