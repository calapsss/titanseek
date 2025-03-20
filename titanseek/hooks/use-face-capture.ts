"use client"

import { useState, useCallback, useEffect, type RefObject } from "react"
import * as faceapi from "face-api.js"

interface UseFaceCaptureProps {
  videoRef: RefObject<HTMLVideoElement>
  canvasRef: RefObject<HTMLCanvasElement>
}

export function useFaceCapture({ videoRef, canvasRef }: UseFaceCaptureProps) {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null)
  const [detectionInterval, setDetectionInterval] = useState<NodeJS.Timeout | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isStartingCamera, setIsStartingCamera] = useState(false)

  // Initialize face-api.js models
  const initialize = useCallback(async () => {
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
  }, [])

  // Start camera with retry mechanism
  const startCamera = useCallback(async () => {
    console.log("Starting camera...")

    // Prevent multiple simultaneous start attempts
    if (isStartingCamera) {
      console.log("Camera start already in progress")
      return
    }

    setIsStartingCamera(true)
    setCameraError(null)

    // Try to initialize models first if not already done
    if (!isInitialized) {
      const initSuccess = await initialize()
      if (!initSuccess) {
        console.error("Failed to initialize face-api.js models")
        setIsStartingCamera(false)
        return
      }
    }

    // Function to attempt camera start
    const attemptCameraStart = async (retryCount = 0, maxRetries = 5) => {
      console.log(`Camera start attempt ${retryCount + 1}/${maxRetries + 1}`)

      if (!videoRef.current) {
        if (retryCount >= maxRetries) {
          console.error("Video ref is not available after maximum retries")
          setCameraError("Video element not found. Please refresh the page.")
          setIsStartingCamera(false)
          return
        }

        // Wait and retry
        console.log("Video ref not available, retrying in 500ms...")
        setTimeout(() => attemptCameraStart(retryCount + 1, maxRetries), 500)
        return
      }

      try {
        console.log("Requesting camera access...")
        // Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
        })

        console.log("Camera access granted, setting up video stream")

        // Set video source
        if (videoRef.current) {
          videoRef.current.srcObject = stream

          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            console.log("Video metadata loaded, starting playback")
            if (videoRef.current) {
              videoRef.current
                .play()
                .then(() => {
                  console.log("Video playback started successfully")
                  setIsCameraActive(true)
                  setCameraError(null)
                  setIsStartingCamera(false)

                  // Start face detection interval
                  startFaceDetection()
                })
                .catch((err) => {
                  console.error("Error starting video playback:", err)
                  setCameraError("Failed to start video playback")
                  setIsStartingCamera(false)
                })
            }
          }
        } else {
          throw new Error("Video element became unavailable")
        }
      } catch (error) {
        console.error("Error starting camera:", error)
        setCameraError(error instanceof Error ? error.message : "Failed to access camera")
        setIsCameraActive(false)
        setIsStartingCamera(false)
      }
    }

    // Start the first attempt
    attemptCameraStart()
  }, [videoRef, isInitialized, initialize, isStartingCamera])

  // Start face detection interval
  const startFaceDetection = useCallback(() => {
    if (!videoRef.current || !isInitialized || detectionInterval) return

    console.log("Starting face detection interval")
    const interval = setInterval(async () => {
      if (!videoRef.current || !isInitialized) return

      try {
        const detections = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks()

        setFaceDetected(!!detections)
      } catch (error) {
        console.error("Error in face detection interval:", error)
      }
    }, 500) // Check for face every 500ms

    setDetectionInterval(interval)
  }, [videoRef, isInitialized, detectionInterval])

  // Stop camera
  const stopCamera = useCallback(() => {
    console.log("Stopping camera...")
    // Clear detection interval
    if (detectionInterval) {
      console.log("Clearing detection interval")
      clearInterval(detectionInterval)
      setDetectionInterval(null)
    }

    // Stop video stream
    if (videoRef.current && videoRef.current.srcObject) {
      console.log("Stopping video stream")
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }

    setIsCameraActive(false)
    setFaceDetected(false)
    setIsStartingCamera(false)
  }, [videoRef, detectionInterval])

  // Capture face
  const captureFace = useCallback(async () => {
    console.log("Capturing face...")
    if (!videoRef.current || !canvasRef.current || !isInitialized) {
      console.error("Missing refs or not initialized for face capture")
      return
    }

    try {
      // Detect face with landmarks and descriptor
      console.log("Detecting face with landmarks and descriptor")
      const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor()

      if (!detection) {
        console.error("No face detected during capture")
        setCameraError("No face detected. Please position your face in the camera view.")
        return
      }

      // Get canvas context
      const ctx = canvasRef.current.getContext("2d")
      if (!ctx) {
        console.error("Could not get canvas context")
        return
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

      // Calculate face position
      const { x, y, width, height } = detection.detection.box

      console.log("Drawing face on canvas", { x, y, width, height })
      // Draw face on canvas
      ctx.drawImage(videoRef.current, x, y, width, height, 0, 0, canvasRef.current.width, canvasRef.current.height)

      // Store face descriptor
      console.log("Face captured successfully")
      setFaceDescriptor(detection.descriptor)
      setCameraError(null)
    } catch (error) {
      console.error("Error capturing face:", error)
      setCameraError("Error processing face capture")
    }
  }, [videoRef, canvasRef, isInitialized])

  // Reset capture
  const resetCapture = useCallback(() => {
    console.log("Resetting face capture")
    if (!canvasRef.current) return

    // Clear canvas
    const ctx = canvasRef.current.getContext("2d")
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }

    // Reset face descriptor
    setFaceDescriptor(null)
    setCameraError(null)
  }, [canvasRef])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      console.log("Cleaning up camera resources")
      if (detectionInterval) {
        clearInterval(detectionInterval)
      }

      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [videoRef, detectionInterval])

  return {
    isInitialized,
    isCameraActive,
    faceDetected,
    faceDescriptor,
    cameraError,
    isStartingCamera,
    startCamera,
    stopCamera,
    captureFace,
    resetCapture,
  }
}

