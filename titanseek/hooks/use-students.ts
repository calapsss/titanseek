"use client"

import { useState, useEffect, useCallback } from "react"

interface Student {
  id: string
  firstName: string
  lastName: string
  email: string
  registeredAt: string
  faceDescriptor: number[]
}

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load students from localStorage on mount
  useEffect(() => {
    const loadStudents = () => {
      try {
        const storedStudents = localStorage.getItem("titanseek_students")
        if (storedStudents) {
          setStudents(JSON.parse(storedStudents))
        }
      } catch (error) {
        console.error("Error loading students:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadStudents()
  }, [])

  // Save students to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem("titanseek_students", JSON.stringify(students))
    }
  }, [students, isLoading])

  // Add a new student
  const addStudent = useCallback(
    async (student: Student) => {
      // Check if student ID already exists
      if (students.some((s) => s.id === student.id)) {
        throw new Error("Student ID already exists")
      }

      setStudents((prev) => [...prev, student])
      return student
    },
    [students],
  )

  // Update an existing student
  const updateStudent = useCallback(
    async (id: string, updatedData: Partial<Omit<Student, "id">>) => {
      const studentIndex = students.findIndex((s) => s.id === id)

      if (studentIndex === -1) {
        throw new Error("Student not found")
      }

      const updatedStudents = [...students]
      updatedStudents[studentIndex] = {
        ...updatedStudents[studentIndex],
        ...updatedData,
      }

      setStudents(updatedStudents)
      return updatedStudents[studentIndex]
    },
    [students],
  )

  // Remove a student
  const removeStudent = useCallback(
    async (id: string) => {
      const studentIndex = students.findIndex((s) => s.id === id)

      if (studentIndex === -1) {
        throw new Error("Student not found")
      }

      const updatedStudents = students.filter((s) => s.id !== id)
      setStudents(updatedStudents)
      return true
    },
    [students],
  )

  // Get a student by ID
  const getStudent = useCallback(
    (id: string) => {
      return students.find((s) => s.id === id) || null
    },
    [students],
  )

  // Get all students with face descriptors as Float32Array
  const getStudentsWithFaceDescriptors = useCallback(() => {
    return students.map((student) => ({
      ...student,
      faceDescriptor: new Float32Array(student.faceDescriptor),
    }))
  }, [students])

  return {
    students,
    isLoading,
    addStudent,
    updateStudent,
    removeStudent,
    getStudent,
    getStudentsWithFaceDescriptors,
  }
}

