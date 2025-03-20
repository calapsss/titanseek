// /app/api/students/route.ts
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

interface StudentInput {
  name: string;
  email: string;
  raw_image_path?: string;
  face_descriptor?: Record<string, unknown>; // Using Record for JSONB; adjust as needed
}

// GET: Retrieve all student records
export async function GET(request: Request): Promise<Response> {
  try {
    const query = `SELECT * FROM students ORDER BY name;`;
    const result = await pool.query(query);
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error: any) {
    console.error('Students GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Create a new student record
export async function POST(request: Request): Promise<Response> {
  try {
    const { name, email, raw_image_path, face_descriptor }: StudentInput = await request.json();

    const query = `
      INSERT INTO students (name, email, raw_image_path, face_descriptor)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [name, email, raw_image_path || null, face_descriptor || null];
    const result = await pool.query(query, values);

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error: any) {
    console.error('Students POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
