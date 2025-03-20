//@ts-nocheck
"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ArrowLeft, Camera, RefreshCw, Save, AlertTriangle } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useStudents } from "@/hooks/use-students"
import { useToast } from "@/hooks/use-toast"
import * as faceapi from "face-api.js"

export default function EditStudentPage() {
  const router = useRouter()
  const params = useParams()
  const studentId = params.id as string

  const { isAuthenticated } = useAuth()
  const { toast } = useToast()
  const { getStudent, updateStudent } = useStudents()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [detectionInterval, setDetectionInterval] = useState<NodeJS.Timeout | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Check authentication
  useEffect(() => {
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

  // Load student data
  useEffect(() => {
    if (isAuthenticated) {
      const student = getStudent(studentId)

      if (student) {
        setFirstName(student.firstName)
        setLastName(student.lastName)
        setEmail(student.email)

        // Convert the stored array back to Float32Array
        if (student.faceDescriptor && student.faceDescriptor.length > 0) {
          setFaceDescriptor(new Float32Array(student.faceDescriptor))

          // Draw the face on the canvas when loaded
          setTimeout(() => {
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext("2d")
              if (ctx) {
                // Just fill with a placeholder color since we don't have the actual face image
                ctx.fillStyle = "#4CAF50"
                ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
                ctx.fillStyle = "#FFFFFF"
                ctx.font = "14px Arial"
                ctx.textAlign = "center"
                ctx.fillText("Face Data", canvasRef.current.width / 2, canvasRef.current.height / 2)
              }
            }
          }, 100)
        }
      } else {
        toast({
          title: "Student not found",
          description: "The requested student could not be found",
          variant: "destructive",
        })
        router.push("/admin/students")
      }

      setIsLoading(false)
    }
  }, [isAuthenticated, studentId, getStudent, toast, router])

  // Initialize face-api.js models
  const initialize = async () => {
    try {
      console.log("Initializing face-api.js models...")
      await Promise.all([
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
      ])

      console.log("Face-api.js models initialized successfully")
      setIsInitialized(true)
      return true
    } catch (error) {
      console.error("Error initializing face-api.js:", error)
      setCameraError("Failed to initialize face recognition models")
      return false
    }
  }

  // Setup camera
  const startCamera = async () => {
    try {
      console.log("Setting up camera...")

      // Initialize models first
      await initialize()

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      })

      // Set video source
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current
              .play()
              .then(() => {
                console.log("Camera started successfully")
                setIsCameraActive(true)
                setCameraError(null)

                // Start face detection interval
                const interval = setInterval(async () => {
                  if (!videoRef.current || !isInitialized) return

                  try {
                    const detections = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks()

                    setFaceDetected(!!detections)
                  } catch (error) {
                    console.error("Error in face detection interval:", error)
                  }
                }, 500)

                setDetectionInterval(interval)
              })
              .catch((err) => {
                console.error("Error starting video playback:", err)
                setCameraError("Failed to start video playback")
              })
          }
        }
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      setCameraError(error instanceof Error ? error.message : "Failed to access camera")
      setIsCameraActive(false)
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (detectionInterval) {
      clearInterval(detectionInterval)
      setDetectionInterval(null)
    }

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }

    setIsCameraActive(false)
    setFaceDetected(false)
  }

  // Capture face
  const captureFace = async () => {
    if (!videoRef.current || !canvasRef.current || !isInitialized) {
      console.error("Missing refs or not initialized for face capture")
      return
    }

    try {
      // Detect face with landmarks and descriptor
      const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor()

      if (!detection) {
        setCameraError("No face detected. Please position your face in the camera view.")
        return
      }

      // Get canvas context
      const ctx = canvasRef.current.getContext("2d")
      if (!ctx) return

      // Clear canvas
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

      // Calculate face position
      const { x, y, width, height } = detection.detection.box

      // Draw face on canvas
      ctx.drawImage(videoRef.current, x, y, width, height, 0, 0, canvasRef.current.width, canvasRef.current.height)

      // Store face descriptor
      setFaceDescriptor(detection.descriptor)
      setCameraError(null)
    } catch (error) {
      console.error("Error capturing face:", error)
      setCameraError("Error processing face capture")
    }
  }

  // Reset capture
  const resetCapture = () => {
    if (!canvasRef.current) return

    // Clear canvas
    const ctx = canvasRef.current.getContext("2d")
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }

    // Reset face descriptor
    setFaceDescriptor(null)
    setCameraError(null)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!faceDescriptor) {
      toast({
        title: "Face data required",
        description: "Please capture the student's face before submitting",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Update student in the system
      await updateStudent(studentId, {
        firstName,
        lastName,
        email,
        faceDescriptor: Array.from(faceDescriptor),
      })

      toast({
        title: "Student updated",
        description: "Student has been successfully updated in the system",
      })

      // Navigate back to students list
      router.push("/admin/students")
    } catch (error) {
      console.error("Error updating student:", error)
      toast({
        title: "Update failed",
        description: "There was an error updating the student",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show loading or redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Checking authentication...</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading student data...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="flex items-center p-4 border-b">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/students")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold ml-4">Edit Student</h1>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Face Capture</CardTitle>
              <CardDescription>Update the student's face for recognition</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cameraError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Camera Error</AlertTitle>
                  <AlertDescription>{cameraError}</AlertDescription>
                </Alert>
              )}

              {!isCameraActive ? (
                <div className="relative aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center">
                  <p className="text-muted-foreground">Camera inactive</p>
                </div>
              ) : (
                <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }} // Mirror the video
                  />

                  {faceDetected && (
                    <div className="absolute inset-0 border-4 border-green-500 rounded-md pointer-events-none" />
                  )}
                </div>
              )}

              <div className="flex justify-center">
                <canvas
                  ref={canvasRef}
                  width="128"
                  height="128"
                  className={`w-32 h-32 rounded-md ${faceDescriptor ? "border-2 border-green-500" : "border border-dashed border-muted-foreground"}`}
                />
              </div>

              {!isCameraActive ? (
                <div className="flex justify-center">
                  <Button type="button" onClick={startCamera} className="gap-2">
                    <Camera className="h-4 w-4" />
                    Start Camera
                  </Button>
                </div>
              ) : (
                <div className="flex justify-center gap-2">
                  <Button
                    type="button"
                    onClick={captureFace}
                    disabled={!isCameraActive || isSubmitting}
                    className="gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Capture Face
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetCapture}
                    disabled={!faceDescriptor || isSubmitting}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reset
                  </Button>
                  <Button type="button" variant="outline" onClick={stopCamera} className="gap-2">
                    Stop Camera
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>Student Information</CardTitle>
                <CardDescription>Update the student's details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="studentId">Student ID</Label>
                  <Input id="studentId" value={studentId} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button
                  type="submit"
                  disabled={!faceDescriptor || !firstName || !lastName || !email || isSubmitting}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  Update Student
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
    </div>
  )
}

