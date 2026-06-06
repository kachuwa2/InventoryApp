import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

interface SidebarContextType {
  isCollapsed: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  toggle: () => {},
})

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return true
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setIsCollapsed(true)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const toggle = () => {
    setIsCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => useContext(SidebarContext)
