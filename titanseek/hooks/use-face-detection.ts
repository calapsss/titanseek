"use client"

import { useCallback, useState } from "react"
import * as faceapi from "face-api.js"
import { useStudents } from "@/hooks/use-students"

interface UseFaceDetectionProps {
  onDetected: (name: string) => void
  onError: (error: string) => void
  onProcessing?: () => void
}

export function useFaceDetection({ onDetected, onError, onProcessing = () => {} }: UseFaceDetectionProps) {
  const [isInitialized, setIsInitialized] = useState(false)
  const { getStudentsWithFaceDescriptors } = useStudents()

  const initialize = useCallback(async () => {
    try {
      await Promise.all([
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
      ])

      setIsInitialized(true)
      return true
    } catch (error) {
      console.error("Error initializing face-api.js:", error)
      onError("Failed to initialize face recognition")
      return false
    }
  }, [onError])

  const detectFace = useCallback(
    async (videoElement: HTMLVideoElement) => {
      if (!isInitialized) {
        onError("Face recognition not initialized")
        return
      }

      onProcessing()

      try {
        // Detect all faces with landmarks and descriptors
        const detections = await faceapi.detectAllFaces(videoElement).withFaceLandmarks().withFaceDescriptors()

        if (detections.length === 0) {
          onError("No face detected")
          return
        }

        if (detections.length > 1) {
          onError("Multiple faces detected. Please ensure only one person is in view.")
          return
        }

        // Get students with face descriptors
        const students = getStudentsWithFaceDescriptors()

        if (students.length === 0) {
          onError("No students registered in the system")
          return
        }

        // Create labeled face descriptors for face matcher
        const labeledFaceDescriptors = students.map(
          (student) =>
            new faceapi.LabeledFaceDescriptors(`${student.firstName} ${student.lastName}|${student.id}`, [
              student.faceDescriptor,
            ]),
        )

        // Create face matcher with lower distance threshold for better accuracy
        // Lower threshold = more strict matching (0.6 is a good balance)
        const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6)
        const bestMatch = faceMatcher.findBestMatch(detections[0].descriptor)

        if (bestMatch.label === "unknown") {
          onError("Face not recognized")
          return
        }

        // Pass the full label (format: "Name|ID") to the callback
        onDetected(bestMatch.label)
      } catch (error) {
        console.error("Error detecting face:", error)
        onError("Error processing face recognition")
      }
    },
    [isInitialized, onDetected, onError, onProcessing, getStudentsWithFaceDescriptors],
  )

  return {
    initialize,
    detectFace,
    isInitialized,
  }
}

