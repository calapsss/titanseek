"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useAttendance } from "@/hooks/use-attendance"

type DateRange = {
  from: Date | undefined
  to: Date | undefined
}

interface AttendanceTableProps {
  searchQuery: string
  dateRange: DateRange
}

export function AttendanceTable({ searchQuery, dateRange }: AttendanceTableProps) {
  const { getAllAttendance, getAttendanceByDateRange } = useAttendance()
  const [page, setPage] = useState(1)
  const [filteredData, setFilteredData] = useState<any[]>([])
  const rowsPerPage = 10

  // Update filtered data when search query or date range changes
  useEffect(() => {
    // Get attendance records based on date range
    let records =
      dateRange.from || dateRange.to ? getAttendanceByDateRange(dateRange.from, dateRange.to) : getAllAttendance()

    // Filter by search query
    if (searchQuery) {
      records = records.filter((record) => {
        const searchLower = searchQuery.toLowerCase()
        return (
          record.studentName.toLowerCase().includes(searchLower) || record.studentId.toLowerCase().includes(searchLower)
        )
      })
    }

    // Sort by timestamp (newest first)
    records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    setFilteredData(records)
    setPage(1) // Reset to first page when filters change
  }, [searchQuery, dateRange, getAllAttendance, getAttendanceByDateRange])

  // Calculate pagination
  const totalPages = Math.ceil(filteredData.length / rowsPerPage)
  const paginatedData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage)

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.studentId}</TableCell>
                  <TableCell>{record.studentName}</TableCell>
                  <TableCell>
                    {new Date(record.timestamp).toLocaleDateString()}{" "}
                    {new Date(record.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={record.status === "present" ? "default" : "destructive"}>{record.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit Record</DropdownMenuItem>
                        <DropdownMenuItem>Delete Record</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={page === 1}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

