"use client"

import { useState, useEffect, useCallback } from "react"

interface Attendance {
  id: string
  studentId: string
  studentName: string
  timestamp: string
  status: "present" | "absent"
}

export function useAttendance() {
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load attendance records from localStorage on mount
  useEffect(() => {
    const loadAttendance = () => {
      try {
        const storedAttendance = localStorage.getItem("titanseek_attendance")
        if (storedAttendance) {
          setAttendanceRecords(JSON.parse(storedAttendance))
        }
      } catch (error) {
        console.error("Error loading attendance records:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadAttendance()
  }, [])

  // Save attendance records to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem("titanseek_attendance", JSON.stringify(attendanceRecords))
    }
  }, [attendanceRecords, isLoading])

  // Record a new attendance
  const recordAttendance = useCallback(
    async (studentId: string, studentName: string, status: "present" | "absent" = "present") => {
      const newAttendance: Attendance = {
        id: `${Date.now()}-${studentId}`,
        studentId,
        studentName,
        timestamp: new Date().toISOString(),
        status,
      }

      setAttendanceRecords((prev) => [newAttendance, ...prev])
      return newAttendance
    },
    [],
  )

  // Get attendance records for a specific student
  const getStudentAttendance = useCallback(
    (studentId: string) => {
      return attendanceRecords.filter((record) => record.studentId === studentId)
    },
    [attendanceRecords],
  )

  // Get all attendance records
  const getAllAttendance = useCallback(() => {
    return attendanceRecords
  }, [attendanceRecords])

  // Get attendance records for a specific date range
  const getAttendanceByDateRange = useCallback(
    (startDate?: Date, endDate?: Date) => {
      if (!startDate && !endDate) return attendanceRecords

      return attendanceRecords.filter((record) => {
        const recordDate = new Date(record.timestamp)

        if (startDate && endDate) {
          return recordDate >= startDate && recordDate <= endDate
        } else if (startDate) {
          return recordDate >= startDate
        } else if (endDate) {
          return recordDate <= endDate
        }

        return true
      })
    },
    [attendanceRecords],
  )

  return {
    attendanceRecords,
    isLoading,
    recordAttendance,
    getStudentAttendance,
    getAllAttendance,
    getAttendanceByDateRange,
  }
}

