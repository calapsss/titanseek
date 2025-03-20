"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Search, UserPlus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { StudentTable } from "@/components/student-table"
import { useStudents } from "@/hooks/use-students"
import { useToast } from "@/hooks/use-toast"

export default function StudentsPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const { students } = useStudents()

  // Check authentication
  useEffect(() => {
    // Small delay to ensure auth state is loaded from localStorage
    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        toast({
          title: "Authentication required",
          description: "Please log in to access this page",
          variant: "destructive",
        })
        router.push("/admin")
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [isAuthenticated, router, toast])

  // Show loading or redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Checking authentication...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="flex items-center p-4 border-b">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold ml-4">Student Management</h1>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Students</CardTitle>
              <CardDescription>Manage student records and face recognition data</CardDescription>
            </div>
            <Button onClick={() => router.push("/admin/students/register")} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Register New Student
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or ID..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <StudentTable searchQuery={searchQuery} students={students} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

