"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Camera, CheckCircle2, XCircle } from "lucide-react"
import { useFaceDetection } from "@/hooks/use-face-detection"
import { useAttendance } from "@/hooks/use-attendance"
import { useToast } from "@/hooks/use-toast"
import * as faceapi from "face-api.js"

export default function KioskPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { recordAttendance } = useAttendance()

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)

  // State
  const [message, setMessage] = useState("Initializing camera and face detection...")
  const [status, setStatus] = useState<"initializing" | "idle" | "detecting" | "success" | "error">("initializing")
  const [lastDetectedStudent, setLastDetectedStudent] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(false)
  const [autoDetectionActive, setAutoDetectionActive] = useState(true)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  // Face detection hook
  const { initialize, detectFace, isInitialized } = useFaceDetection({
    onDetected: async (name) => {
      // Extract student ID from the label (format: "Name|ID")
      const parts = name.split("|")
      const studentName = parts[0]
      const studentId = parts[1] || "unknown"

      // Prevent duplicate attendance records in quick succession
      if (lastDetectedStudent === studentId && cooldown) {
        return
      }

      setLastDetectedStudent(studentId)
      setCooldown(true)

      // Record attendance
      try {
        await recordAttendance(studentId, studentName)

        setStatus("success")
        setMessage(`Attendance marked for ${studentName}`)

        toast({
          title: "Attendance Recorded",
          description: `${studentName} has been marked present`,
        })
      } catch (error) {
        console.error("Error recording attendance:", error)
        setStatus("error")
        setMessage("Error recording attendance")
      }

      // Reset after 3 seconds
      setTimeout(() => {
        setStatus("idle")
        setMessage("Please face the camera to mark your attendance")
        setCooldown(false)
      }, 3000)
    },
    onError: (error) => {
      setStatus("error")
      setMessage(error)

      // Reset after 3 seconds
      setTimeout(() => {
        setStatus("idle")
        setMessage("Please face the camera to mark your attendance")
      }, 3000)
    },
    onProcessing: () => {
      setStatus("detecting")
      setMessage("Detecting face...")
    },
  })

  // Step 1: Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log("Loading face-api.js models...")

        await Promise.all([
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
        ])

        console.log("Face-api.js models loaded successfully")
        setModelsLoaded(true)
        await initialize()
      } catch (error) {
        console.error("Error loading face-api.js models:", error)
        setStatus("error")
        setMessage("Failed to load face recognition models. Please refresh the page.")
      }
    }

    loadModels()
  }, [initialize])

  // Step 2: Setup camera after models are loaded
  useEffect(() => {
    if (!modelsLoaded) return

    const setupCamera = async () => {
      try {
        console.log("Setting up camera...")

        // Stop any existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
        }

        // Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
        })

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream

          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current
                .play()
                .then(() => {
                  console.log("Camera started successfully")
                  setCameraReady(true)
                  setStatus("idle")
                  setMessage("Please face the camera to mark your attendance")
                })
                .catch((err) => {
                  console.error("Error starting video playback:", err)
                  setStatus("error")
                  setMessage("Failed to start camera. Please check permissions and refresh.")
                })
            }
          }
        }
      } catch (error) {
        console.error("Error accessing camera:", error)
        setStatus("error")
        setMessage("Failed to access camera. Please check permissions and refresh.")
      }
    }

    setupCamera()

    // Cleanup function
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [modelsLoaded])

  // Step 3: Setup canvas and start detection loop when everything is ready
  useEffect(() => {
    if (!cameraReady || !modelsLoaded || !videoRef.current || !canvasRef.current) {
      return
    }

    console.log("Setting up canvas and detection loop")

    const video = videoRef.current
    const canvas = canvasRef.current

    // Set canvas size to match video display size
    const resizeCanvas = () => {
      if (!video || !canvas) return

      const { clientWidth, clientHeight } = video
      canvas.width = clientWidth
      canvas.height = clientHeight

      console.log(`Canvas resized to ${clientWidth}x${clientHeight}`)
    }

    // Initial resize
    resizeCanvas()

    // Handle window resize
    window.addEventListener("resize", resizeCanvas)

    // Face detection and rendering function
    const detectAndRender = async () => {
      if (!video || !canvas || !autoDetectionActive || status === "detecting" || cooldown) {
        // Continue the animation loop even if we're not detecting
        animationRef.current = requestAnimationFrame(detectAndRender)
        return
      }

      try {
        // Detect faces
        const detections = await faceapi.detectAllFaces(video).withFaceLandmarks()

        // Draw results on canvas
        const ctx = canvas.getContext("2d")
        if (ctx) {
          // Clear previous drawings
          ctx.clearRect(0, 0, canvas.width, canvas.height)

          if (detections.length > 0) {
            // Calculate display ratio
            const displaySize = { width: canvas.width, height: canvas.height }

            // Resize detections to match display size
            const resizedDetections = faceapi.resizeResults(detections, displaySize)

            // Draw face detection overlay
            resizedDetections.forEach((detection) => {
              const { x, y, width, height } = detection.detection.box

              // Draw face rectangle with rounded corners
              ctx.strokeStyle = status === "success" ? "#10b981" : status === "error" ? "#ef4444" : "#3b82f6"
              ctx.lineWidth = 3
              ctx.beginPath()

              // Draw rounded rectangle
              const radius = 10
              ctx.moveTo(x + radius, y)
              ctx.lineTo(x + width - radius, y)
              ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
              ctx.lineTo(x + width, y + height - radius)
              ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
              ctx.lineTo(x + radius, y + height)
              ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
              ctx.lineTo(x, y + radius)
              ctx.quadraticCurveTo(x, y, x + radius, y)
              ctx.closePath()
              ctx.stroke()

              // Add scanning effect
              const scanLineY = y + ((Date.now() % 1000) / 1000) * height
              ctx.strokeStyle =
                status === "success"
                  ? "rgba(16, 185, 129, 0.5)"
                  : status === "error"
                    ? "rgba(239, 68, 68, 0.5)"
                    : "rgba(59, 130, 246, 0.5)"
              ctx.beginPath()
              ctx.moveTo(x, scanLineY)
              ctx.lineTo(x + width, scanLineY)
              ctx.stroke()

              // Add corners for a more high-tech look
              const cornerLength = 15
              ctx.strokeStyle = status === "success" ? "#10b981" : status === "error" ? "#ef4444" : "#3b82f6"
              ctx.lineWidth = 4

              // Top-left corner
              ctx.beginPath()
              ctx.moveTo(x, y + cornerLength)
              ctx.lineTo(x, y)
              ctx.lineTo(x + cornerLength, y)
              ctx.stroke()

              // Top-right corner
              ctx.beginPath()
              ctx.moveTo(x + width - cornerLength, y)
              ctx.lineTo(x + width, y)
              ctx.lineTo(x + width, y + cornerLength)
              ctx.stroke()

              // Bottom-right corner
              ctx.beginPath()
              ctx.moveTo(x + width, y + height - cornerLength)
              ctx.lineTo(x + width, y + height)
              ctx.lineTo(x + width - cornerLength, y + height)
              ctx.stroke()

              // Bottom-left corner
              ctx.beginPath()
              ctx.moveTo(x + cornerLength, y + height)
              ctx.lineTo(x, y + height)
              ctx.lineTo(x, y + height - cornerLength)
              ctx.stroke()
            })

            // If face is detected and we're not in cooldown, trigger face recognition
            if (detections.length > 0 && !cooldown && status === "idle") {
              console.log("Face detected, triggering recognition")
              detectFace(video)
            }
          }
        }
      } catch (error) {
        console.error("Error in face detection loop:", error)
      }

      // Continue the animation loop
      animationRef.current = requestAnimationFrame(detectAndRender)
    }

    // Start the detection loop
    animationRef.current = requestAnimationFrame(detectAndRender)

    // Cleanup function
    return () => {
      window.removeEventListener("resize", resizeCanvas)

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [cameraReady, modelsLoaded, autoDetectionActive, status, cooldown, detectFace])

  const handleManualCapture = () => {
    if (status !== "detecting" && videoRef.current) {
      detectFace(videoRef.current)
    }
  }

  const toggleAutoDetection = () => {
    setAutoDetectionActive(!autoDetectionActive)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold ml-4">TitanSEEK Attendance Kiosk</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoDetectionActive ? "default" : "outline"}
            onClick={toggleAutoDetection}
            disabled={status === "initializing"}
            className="gap-2"
          >
            {autoDetectionActive ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Auto Detection On
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                Auto Detection Off
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-3xl overflow-hidden">
          <CardContent className="p-0">
            <div className="relative">
              {/* Video element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto rounded-t-lg"
                style={{ transform: "scaleX(-1)" }} // Mirror the video
              />

              {/* Canvas overlay for face detection visualization */}
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ transform: "scaleX(-1)" }} // Mirror the canvas to match video
              />

              {/* Loading overlay */}
              {status === "initializing" && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent mx-auto"></div>
                    <p>Initializing camera and face detection...</p>
                  </div>
                </div>
              )}

              {/* Status bar */}
              <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white p-4 text-center">
                <p className="text-lg font-medium">{message}</p>
                <div
                  className={`mt-2 h-1 w-full rounded-full overflow-hidden ${
                    status === "detecting"
                      ? "bg-yellow-200"
                      : status === "success"
                        ? "bg-green-200"
                        : status === "error"
                          ? "bg-red-200"
                          : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`h-full ${
                      status === "detecting"
                        ? "bg-yellow-500 animate-pulse"
                        : status === "success"
                          ? "bg-green-500"
                          : status === "error"
                            ? "bg-red-500"
                            : "bg-gray-500"
                    }`}
                    style={{
                      width: status === "success" ? "100%" : status === "error" ? "100%" : "0%",
                    }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="p-4 flex justify-center">
              <Button
                size="lg"
                onClick={handleManualCapture}
                disabled={status === "initializing" || status === "detecting" || cooldown}
                className="gap-2"
              >
                <Camera className="h-5 w-4" />
                Manual Capture
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {status === "initializing" ? (
            <p>Please wait while the system initializes...</p>
          ) : autoDetectionActive ? (
            <p>Automatic face detection is enabled. Just look at the camera to mark attendance.</p>
          ) : (
            <p>Automatic detection is disabled. Click the Manual Capture button to mark attendance.</p>
          )}
        </div>

        {/* Debug info */}
        <div className="mt-2 text-xs text-muted-foreground">
          <p>
            Models loaded: {modelsLoaded ? "Yes" : "No"} | Camera ready: {cameraReady ? "Yes" : "No"}
          </p>
          <p>
            Status: {status} | Auto detection: {autoDetectionActive ? "On" : "Off"}
          </p>
        </div>
      </main>
    </div>
  )
}

