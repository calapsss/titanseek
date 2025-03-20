"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  const router = useRouter()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">TitanSEEK</CardTitle>
          <CardDescription>Classroom Attendance System</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button size="lg" className="w-full" onClick={() => router.push("/kiosk")}>
            Launch Attendance Kiosk
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={() => router.push("/admin")}>
            Admin Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

