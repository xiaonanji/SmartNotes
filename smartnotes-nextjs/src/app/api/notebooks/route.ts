import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const notebooks = await prisma.notebook.findMany({
      include: {
        _count: {
          select: { notes: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json(notebooks)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch notebooks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, subtitle, coverImage } = await request.json()
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    
    const notebookData: any = { name }
    if (subtitle) {
      notebookData.subtitle = subtitle
    }
    if (coverImage) {
      notebookData.coverImage = coverImage
    }
    
    const notebook = await prisma.notebook.create({
      data: notebookData
    })
    
    return NextResponse.json(notebook, { status: 201 })
  } catch (error) {
    console.error('Error creating notebook:', error)
    return NextResponse.json({ error: 'Failed to create notebook' }, { status: 500 })
  }
}