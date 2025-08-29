import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Connection } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const notebook = await prisma.notebook.findUnique({
      where: { id },
      include: { 
        notes: { 
          orderBy: { createdAt: 'asc' }
        }
      }
    })
    
    // Get all connections for this notebook (only if notebook exists)
    let connections: Connection[] = []
    if (notebook) {
      try {
        connections = await prisma.connection.findMany({
          where: {
            OR: [
              { fromNote: { notebookId: id } },
              { toNote: { notebookId: id } }
            ]
          }
        })
      } catch (connectionError) {
        console.log('Connections not available yet:', connectionError)
        connections = []
      }
    }
    
    if (!notebook) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 })
    }
    
    return NextResponse.json({ ...notebook, connections })
  } catch (error) {
    console.error('Notebook fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch notebook' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.notebook.delete({
      where: { id }
    })
    
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete notebook' }, { status: 500 })
  }
}