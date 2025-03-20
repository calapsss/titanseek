"use client"

import { useState, useEffect } from "react"

interface UseAuthReturn {
  isAuthenticated: boolean
  login: (username: string, password: string) => boolean
  logout: () => void
}

export function useAuth(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check if user is already authenticated on mount
  useEffect(() => {
    const authStatus = localStorage.getItem("titanseek_auth")
    if (authStatus === "true") {
      setIsAuthenticated(true)
    }
  }, [])

  const login = (username: string, password: string): boolean => {
    // In a real app, you would validate credentials against your backend
    // For this demo, we'll use a simple check
    if (username === "admin" && password === "password") {
      setIsAuthenticated(true)
      localStorage.setItem("titanseek_auth", "true")
      return true
    }

    return false
  }

  const logout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem("titanseek_auth")
  }

  return {
    isAuthenticated,
    login,
    logout,
  }
}

