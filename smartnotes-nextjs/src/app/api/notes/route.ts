import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const { type, content, notebookId, x: providedX, y: providedY } = await request.json()
    
    if (!type || !content || !notebookId) {
      return NextResponse.json({ error: 'Type, content, and notebookId are required' }, { status: 400 })
    }
    
    if (!['text', 'image'].includes(type)) {
      return NextResponse.json({ error: 'Invalid note type' }, { status: 400 })
    }
    
    // Use provided position or generate a random position for new notes
    const x = providedX !== undefined ? providedX : Math.random() * 400 + 50
    const y = providedY !== undefined ? providedY : Math.random() * 300 + 50
    
    const note = await prisma.note.create({
      data: {
        type,
        content,
        notebookId,
        x,
        y
      }
    })
    
    return NextResponse.json(note, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, x, y, width, height, content } = await request.json()
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }
    
    // Build update data object with only provided fields
    const updateData: Prisma.NoteUpdateInput = {}
    if (typeof x === 'number') updateData.x = x
    if (typeof y === 'number') updateData.y = y
    if (typeof width === 'number') updateData.width = width
    if (typeof height === 'number') updateData.height = height
    if (typeof content === 'string') updateData.content = content
    
    // Update note properties
    const note = await prisma.note.update({
      where: { id },
      data: updateData
    })
    
    return NextResponse.json(note)
  } catch {
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}