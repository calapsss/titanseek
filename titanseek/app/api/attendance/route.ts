// /app/api/attendance/route.ts
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

interface AttendanceInput {
  studentId: number;
  pin?: string | null;
  recognitionStatus?: string;
}

// POST: Record a new attendance event
export async function POST(request: Request): Promise<Response> {
  try {
    const { studentId, pin, recognitionStatus }: AttendanceInput = await request.json();

    // Here you can add validation logic if needed.
    const query = `
      INSERT INTO attendance (student_id, attendance_date, timestamp)
      VALUES ($1, CURRENT_DATE, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const values = [studentId];
    const result = await pool.query(query, values);

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error: any) {
    console.error('Attendance POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET: Retrieve attendance logs with associated student info
export async function GET(request: Request): Promise<Response> {
  try {
    const query = `
      SELECT a.*, s.name, s.email
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      ORDER BY a.timestamp DESC;
    `;
    const result = await pool.query(query);
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error: any) {
    console.error('Attendance GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
