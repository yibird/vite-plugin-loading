import { useEffect } from 'react'
import { hideAppLoading } from 'virtual:app-loading'
import LoadingDemo from './components/LoadingDemo'

export default function App() {
  useEffect(() => {
    hideAppLoading()
  }, [])

  return <LoadingDemo />
}
