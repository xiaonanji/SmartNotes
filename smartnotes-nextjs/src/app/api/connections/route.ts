import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { fromNoteId, toNoteId, fromSide, toSide, notebookId } = await request.json()
    
    if (!fromNoteId || !toNoteId || !fromSide || !toSide || !notebookId) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }
    
    // Check if connection already exists
    const existingConnection = await prisma.connection.findFirst({
      where: {
        fromNoteId,
        toNoteId,
        fromSide,
        toSide
      }
    })
    
    if (existingConnection) {
      return NextResponse.json({ error: 'Connection already exists' }, { status: 400 })
    }
    
    const connection = await prisma.connection.create({
      data: {
        fromNoteId,
        toNoteId,
        fromSide,
        toSide
      }
    })
    
    return NextResponse.json(connection, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 })
    }
    
    await prisma.connection.delete({
      where: { id }
    })
    
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 })
  }
}