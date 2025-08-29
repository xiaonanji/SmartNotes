'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, PlusIcon, FileTextIcon, ImageIcon, ClipboardIcon, TrashIcon } from 'lucide-react'
import { uploadScreenshotToFirebase, blobToFile } from '@/lib/storage'

interface Connection {
  id: string
  fromNoteId: string
  toNoteId: string
  fromSide: 'top' | 'right' | 'bottom' | 'left'
  toSide: 'top' | 'right' | 'bottom' | 'left'
}

interface Note {
  id: string
  type: 'text' | 'image'
  content: string
  x: number
  y: number
  width: number
  height: number
  createdAt: string
  connectionsFrom?: Connection[]
  connectionsTo?: Connection[]
}

interface Notebook {
  id: string
  name: string
  notes: Note[]
  connections?: Connection[]
}

export default function NotebookPage() {
  const params = useParams()
  const router = useRouter()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [notebook, setNotebook] = useState<Notebook | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [noteType, setNoteType] = useState<'text' | 'image' | null>(null)
  const [noteContent, setNoteContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; startWidth: number; startHeight: number; handle: string } | null>(null)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [canvasHeight, setCanvasHeight] = useState(600)
  const [canvasWidth, setCanvasWidth] = useState(1400)
  const [connecting, setConnecting] = useState<{ noteId: string; side: 'top' | 'right' | 'bottom' | 'left' } | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [dragLine, setDragLine] = useState<{ fromX: number; fromY: number; toX: number; toY: number } | null>(null)
  const [hoveredConnection, setHoveredConnection] = useState<{ noteId: string; side: 'top' | 'right' | 'bottom' | 'left' } | null>(null)
  const [hoveredConnectionLine, setHoveredConnectionLine] = useState<string | null>(null)
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchNotebook()
    }
  }, [params.id])

  // Update canvas dimensions when notebook changes (but not during drag/resize)
  useEffect(() => {
    if (notebook && notebook.notes.length > 0 && !dragging && !resizing) {
      const maxY = Math.max(600, ...notebook.notes.map(note => note.y + note.height + 300))
      // Use a reasonable minimum width
      const minWidth = 1400
      const maxX = Math.max(minWidth, ...notebook.notes.map(note => note.x + note.width + 300))
      setCanvasHeight(maxY)
      setCanvasWidth(maxX)
    }
  }, [notebook, dragging, resizing])

  // Update connections separately - always sync with server data
  useEffect(() => {
    if (notebook?.connections) {
      setConnections(notebook.connections)
    }
  }, [notebook?.connections])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && hoveredConnectionLine) {
        e.preventDefault()
        deleteConnection(hoveredConnectionLine)
        setHoveredConnectionLine(null)
      }
    }

    const handlePaste = async (e: ClipboardEvent) => {
      if (editingNote) return // Don't handle paste if editing a note
      
      const items = Array.from(e.clipboardData?.items || [])
      const imageItem = items.find(item => item.type.startsWith('image/'))
      const textData = e.clipboardData?.getData('text/plain')
      
      if (imageItem) {
        e.preventDefault()
        
        const file = imageItem.getAsFile()
        if (!file) return

        setUploadingScreenshot(true)
        
        try {
          const imageUrl = await uploadScreenshotToFirebase(file)
          
          let x = 100
          const y = Math.max(100, canvasHeight - 300)
          
          if (notebook) {
            const notesAtSameLevel = notebook.notes.filter(note => 
              Math.abs(note.y - y) < 50
            )
            if (notesAtSameLevel.length > 0) {
              const rightmostX = Math.max(...notesAtSameLevel.map(note => note.x + note.width))
              x = rightmostX + 50
            }
          }

          const response = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'image',
              content: imageUrl,
              notebookId: params.id,
              x,
              y
            })
          })

          if (response.ok) {
            fetchNotebook()
          }
        } catch (error) {
          console.error('Error uploading screenshot:', error)
          alert('Failed to upload screenshot. Please check your Firebase configuration.')
        } finally {
          setUploadingScreenshot(false)
        }
      } else if (textData && textData.trim()) {
        e.preventDefault()
        
        try {
          let x = 100
          const y = Math.max(100, canvasHeight - 300)
          
          if (notebook) {
            const notesAtSameLevel = notebook.notes.filter(note => 
              Math.abs(note.y - y) < 50
            )
            if (notesAtSameLevel.length > 0) {
              const rightmostX = Math.max(...notesAtSameLevel.map(note => note.x + note.width))
              x = rightmostX + 50
            }
          }

          const response = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'text',
              content: textData.trim(),
              notebookId: params.id,
              x,
              y
            })
          })

          if (response.ok) {
            fetchNotebook()
          }
        } catch (error) {
          console.error('Error creating text note:', error)
          alert('Failed to create text note.')
        }
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return

      if (connecting) {
        const rect = canvasRef.current.getBoundingClientRect()
        const note = notebook?.notes.find(n => n.id === connecting.noteId)
        if (!note) return

        const fromPos = getConnectionPoint(note, connecting.side)
        const toX = e.clientX - rect.left
        const toY = e.clientY - rect.top
        
        console.log('Dragging line:', fromPos, 'to', { toX, toY })
        setDragLine({
          fromX: fromPos.x,
          fromY: fromPos.y,
          toX,
          toY
        })
      }

      if (dragging) {
        const rect = canvasRef.current.getBoundingClientRect()
        const note = notebook?.notes.find(n => n.id === dragging.id)
        if (!note) return

        const x = Math.max(0, e.clientX - rect.left - dragging.offsetX)
        const y = Math.max(0, e.clientY - rect.top - dragging.offsetY)

        setNotebook(prev => {
          if (!prev) return prev
          return {
            ...prev,
            notes: prev.notes.map(n =>
              n.id === dragging.id ? { ...n, x, y } : n
            )
          }
        })
      }

      if (resizing) {
        const deltaX = e.clientX - resizing.startX
        const deltaY = e.clientY - resizing.startY
        
        // Only handle bottom-right corner resize (se)
        const newWidth = Math.max(200, resizing.startWidth + deltaX)
        const newHeight = Math.max(150, resizing.startHeight + deltaY)

        setNotebook(prev => {
          if (!prev) return prev
          return {
            ...prev,
            notes: prev.notes.map(note =>
              note.id === resizing.id ? { ...note, width: newWidth, height: newHeight } : note
            )
          }
        })
      }
    }

    const handleMouseUp = async (e: MouseEvent) => {
      if (connecting) {
        console.log('Mouse up during connection:', { connecting, hoveredConnection })
        
        // Find which connection node we're over by checking mouse position
        const rect = canvasRef.current?.getBoundingClientRect()
        if (rect && notebook) {
          const mouseX = e.clientX - rect.left
          const mouseY = e.clientY - rect.top
          
          // Check each note's connection nodes
          for (const note of notebook.notes) {
            if (note.id === connecting.noteId) continue // Skip the source note
            
            const sides = ['top', 'right', 'bottom', 'left'] as const
            for (const side of sides) {
              const connectionPoint = getConnectionPoint(note, side)
              const distance = Math.sqrt(
                Math.pow(mouseX - connectionPoint.x, 2) + 
                Math.pow(mouseY - connectionPoint.y, 2)
              )
              
              // If mouse is within 10 pixels of a connection node
              if (distance <= 10) {
                console.log('Found target node:', note.id, side, 'distance:', distance)
                await createConnection(connecting.noteId, note.id, connecting.side, side)
                setConnecting(null)
                setDragLine(null)
                setHoveredConnection(null)
                return
              }
            }
          }
        }
        
        console.log('No valid target for connection')
        setConnecting(null)
        setDragLine(null)
        setHoveredConnection(null)
      }
      
      if (dragging && notebook) {
        const note = notebook.notes.find(n => n.id === dragging.id)
        if (note) {
          try {
            await fetch('/api/notes', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: note.id, x: note.x, y: note.y })
            })
          } catch (error) {
            console.error('Error updating note position:', error)
          }
        }
      }

      if (resizing && notebook) {
        const note = notebook.notes.find(n => n.id === resizing.id)
        if (note) {
          try {
            await fetch('/api/notes', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: note.id, width: note.width, height: note.height })
            })
          } catch (error) {
            console.error('Error updating note size:', error)
          }
        }
      }

      // Update canvas dimensions after drag/resize is complete
      if ((dragging || resizing) && notebook) {
        const maxY = Math.max(600, ...notebook.notes.map(note => note.y + note.height + 300))
        // Use a reasonable minimum width
        const minWidth = 1400
        const maxX = Math.max(minWidth, ...notebook.notes.map(note => note.x + note.width + 300))
        setCanvasHeight(maxY)
        setCanvasWidth(maxX)
      }

      setDragging(null)
      setResizing(null)
    }

    if (dragging || resizing || connecting) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    // Always listen for delete key and paste events
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('paste', handlePaste)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('paste', handlePaste)
    }
  }, [dragging, resizing, connecting, notebook, hoveredConnectionLine, editingNote, canvasHeight, params.id])

  const fetchNotebook = async () => {
    try {
      const response = await fetch(`/api/notebooks/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setNotebook(data)
      } else if (response.status === 404) {
        router.push('/')
      }
    } catch (error) {
      console.error('Error fetching notebook:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const createNote = async () => {
    if (!noteType || !noteContent.trim() || !params.id) return

    try {
      // Position new notes at the same vertical level as the create button
      // Create button is at bottom-20 (20px from bottom), which is roughly at the bottom third
      // For canvas positioning, we'll place it around the same height
      let x = 100 // Start from left side of canvas with some padding
      const y = Math.max(100, canvasHeight - 300) // Near bottom but with some space
      
      // If there are existing notes at this Y level, position the new note to the right
      if (notebook) {
        const notesAtSameLevel = notebook.notes.filter(note => 
          Math.abs(note.y - y) < 50 // Within 50px vertically
        )
        if (notesAtSameLevel.length > 0) {
          // Find the rightmost note and place the new note to its right
          const rightmostX = Math.max(...notesAtSameLevel.map(note => note.x + note.width))
          x = rightmostX + 50 // 50px gap between notes
        }
      }
      
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: noteType,
          content: noteContent,
          notebookId: params.id,
          x,
          y
        })
      })

      if (response.ok) {
        setNoteContent('')
        setNoteType(null)
        setShowCreateModal(false)
        setImageFile(null)
        fetchNotebook()
      }
    } catch (error) {
      console.error('Error creating note:', error)
    }
  }

  const deleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchNotebook()
      }
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }

  const handleMouseDown = (e: React.MouseEvent, noteId: string) => {
    e.preventDefault()
    if (!canvasRef.current) return
    
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const note = notebook?.notes.find(n => n.id === noteId)
    if (!note) return
    
    // Calculate offset from mouse position to note's current position
    const offsetX = e.clientX - canvasRect.left - note.x
    const offsetY = e.clientY - canvasRect.top - note.y
    
    setDragging({ id: noteId, offsetX, offsetY })
  }

  const handleResizeStart = (e: React.MouseEvent, noteId: string, handle: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    const note = notebook?.notes.find(n => n.id === noteId)
    if (!note) return
    
    setResizing({
      id: noteId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: note.width,
      startHeight: note.height,
      handle
    })
  }

  const handleDoubleClick = (note: Note) => {
    if (note.type === 'text' && !dragging && !resizing) {
      setEditingNote(note.id)
      setEditContent(note.content)
    }
  }

  const getConnectionPoint = (note: Note, side: 'top' | 'right' | 'bottom' | 'left') => {
    const centerX = note.x + note.width / 2
    const centerY = note.y + note.height / 2
    
    switch (side) {
      case 'top':
        return { x: centerX, y: note.y }
      case 'right':
        return { x: note.x + note.width, y: centerY }
      case 'bottom':
        return { x: centerX, y: note.y + note.height }
      case 'left':
        return { x: note.x, y: centerY }
    }
  }

  const handleConnectionStart = (e: React.MouseEvent, noteId: string, side: 'top' | 'right' | 'bottom' | 'left') => {
    e.preventDefault()
    e.stopPropagation()
    console.log('Connection started:', noteId, side)
    setConnecting({ noteId, side })
  }


  const createConnection = async (fromNoteId: string, toNoteId: string, fromSide: string, toSide: string) => {
    try {
      console.log('Creating connection:', { fromNoteId, toNoteId, fromSide, toSide, notebookId: params.id })
      
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromNoteId, toNoteId, fromSide, toSide, notebookId: params.id })
      })
      
      const data = await response.json()
      console.log('Connection response:', response.status, data)
      
      if (response.ok) {
        console.log('Connection created successfully')
        // Refresh notebook data to get updated connections
        fetchNotebook()
      } else {
        console.error('Failed to create connection:', data.error)
        alert(`Failed to create connection: ${data.error}`)
      }
    } catch (error) {
      console.error('Error creating connection:', error)
      alert('Error creating connection')
    }
  }

  const deleteConnection = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/connections?id=${connectionId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        console.log('Connection deleted successfully')
        fetchNotebook() // Refresh to get updated connections
      } else {
        console.error('Failed to delete connection')
      }
    } catch (error) {
      console.error('Error deleting connection:', error)
    }
  }

  const saveEdit = async () => {
    if (!editingNote) return

    try {
      const response = await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingNote, content: editContent })
      })

      if (response.ok) {
        setNotebook(prev => {
          if (!prev) return prev
          return {
            ...prev,
            notes: prev.notes.map(note =>
              note.id === editingNote ? { ...note, content: editContent } : note
            )
          }
        })
      }
    } catch (error) {
      console.error('Error updating note content:', error)
    }

    setEditingNote(null)
    setEditContent('')
  }

  const cancelEdit = () => {
    setEditingNote(null)
    setEditContent('')
  }

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setNoteContent(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(item => item.type.startsWith('image/'))
    
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) {
        setImageFile(file)
        const reader = new FileReader()
        reader.onload = (e) => {
          setNoteContent(e.target?.result as string)
        }
        reader.readAsDataURL(file)
      }
    }
  }

  const resetCreateModal = () => {
    setShowCreateModal(false)
    setNoteType(null)
    setNoteContent('')
    setImageFile(null)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <FileTextIcon className="w-5 h-5" />
      case 'image': return <ImageIcon className="w-5 h-5" />
      case 'paste': return <ClipboardIcon className="w-5 h-5" />
      default: return null
    }
  }

  const getTypeEmoji = (type: string) => {
    switch (type) {
      case 'text': return '📝'
      case 'image': return '🖼️'
      case 'paste': return '📋'
      default: return '📄'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading notebook...</div>
      </div>
    )
  }

  if (!notebook) {
    return (
      <div className="text-center py-12">
        <h1 className="text-xl text-gray-900">Notebook not found</h1>
        <Link href="/" className="text-blue-600 hover:underline mt-2 inline-block">
          Go back to notebooks
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center gap-4 mb-4 px-4 pt-4">
        <h1 className="text-2xl font-semibold text-gray-300">{notebook.name}</h1>
      </div>
      
      {/* Floating Action Buttons */}
      <div className="fixed bottom-20 left-20 flex flex-col gap-3 z-50">
        <Link 
          href="/" 
          className="bg-gray-700 hover:bg-gray-600 text-gray-200 p-3 rounded-full shadow-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Canvas Area */}
      <div 
        ref={canvasRef}
        className="relative bg-gray-700 border-2 border-dashed border-gray-500 mx-4 mb-4 rounded-lg p-6"
        style={{ height: `${canvasHeight}px`, width: `${canvasWidth}px` }}
      >
        {uploadingScreenshot && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-lg p-6 flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-gray-700">Uploading screenshot...</span>
            </div>
          </div>
        )}
        {notebook.notes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <FileTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notes yet</h3>
              <p className="text-gray-500 mb-2">Create your first note card</p>
              <p className="text-gray-400 text-sm mb-4">💡 Tip: Paste text or screenshots directly (Ctrl+V) to create notes</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Note
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Connection Lines and Drag Line */}
            <svg 
              className="absolute inset-0 pointer-events-none z-20"
              style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="#22c55e"
                  />
                </marker>
                <marker
                  id="arrowhead-blue"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="#3b82f6"
                  />
                </marker>
                <marker
                  id="arrowhead-red"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="#ef4444"
                  />
                </marker>
              </defs>
              
              {/* Existing Connections */}
              {connections.map((connection) => {
                const fromNote = notebook?.notes.find(n => n.id === connection.fromNoteId)
                const toNote = notebook?.notes.find(n => n.id === connection.toNoteId)
                
                if (!fromNote || !toNote) return null
                
                const fromPos = getConnectionPoint(fromNote, connection.fromSide)
                const toPos = getConnectionPoint(toNote, connection.toSide)
                const isHovered = hoveredConnectionLine === connection.id
                
                // Calculate midpoint for X button
                const midX = (fromPos.x + toPos.x) / 2
                const midY = (fromPos.y + toPos.y) / 2
                
                return (
                  <g key={connection.id}>
                    {/* Invisible wider line for easier hovering */}
                    <line
                      x1={fromPos.x}
                      y1={fromPos.y}
                      x2={toPos.x}
                      y2={toPos.y}
                      stroke="transparent"
                      strokeWidth="12"
                      style={{ pointerEvents: 'all', cursor: isHovered ? 'pointer' : 'default' }}
                      onMouseEnter={() => setHoveredConnectionLine(connection.id)}
                      onMouseLeave={() => setHoveredConnectionLine(null)}
                    />
                    {/* Visible line */}
                    <line
                      x1={fromPos.x}
                      y1={fromPos.y}
                      x2={toPos.x}
                      y2={toPos.y}
                      stroke={isHovered ? "#ef4444" : "#3b82f6"}
                      strokeWidth={isHovered ? "3" : "2"}
                      markerEnd={isHovered ? "url(#arrowhead-red)" : "url(#arrowhead-blue)"}
                      style={{ pointerEvents: 'none' }}
                    />
                    {/* Delete X icon */}
                    {isHovered && (
                      <g>
                        <circle
                          cx={midX}
                          cy={midY}
                          r="8"
                          fill="white"
                          stroke="#ef4444"
                          strokeWidth="2"
                          style={{ pointerEvents: 'none' }}
                        />
                        <text
                          x={midX}
                          y={midY + 1}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#ef4444"
                          fontSize="10"
                          fontWeight="bold"
                          style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >
                          ×
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}
              
              {/* Drag Line */}
              {dragLine && (
                <line
                  x1={dragLine.fromX}
                  y1={dragLine.fromY}
                  x2={dragLine.toX}
                  y2={dragLine.toY}
                  stroke="#22c55e"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </svg>
            
            {notebook.notes.map((note) => (
            <div
              key={note.id}
              className={`bg-white rounded-lg border-2 select-none group relative overflow-hidden ${
                dragging?.id === note.id ? 'z-50 border-red-500' : resizing?.id === note.id ? 'z-50 border-purple-400 shadow-lg' : 'z-10 border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200'
              }`}
              style={{
                position: 'absolute',
                left: `${note.x}px`,
                top: `${note.y}px`,
                width: `${note.width}px`,
                height: `${note.height}px`,
                cursor: dragging?.id === note.id ? 'grabbing' : resizing?.id === note.id ? 'nwse-resize' : 'grab'
              }}
            >
              {/* Drag Handle - Top Area */}
              <div 
                className="absolute top-0 left-0 right-0 h-6 bg-gray-50 border-b border-gray-200 rounded-t-lg cursor-grab active:cursor-grabbing flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                onMouseDown={(e) => !resizing && !editingNote && handleMouseDown(e, note.id)}
              >
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                </div>
              </div>
              
              {/* Delete Button */}
              <div className="absolute top-2 right-2 z-30">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteNote(note.id)
                  }}
                  className="p-1 text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
              
              {/* Content Area */}
              <div 
                className="px-6 pb-6 h-full overflow-auto pt-6"
                onDoubleClick={() => handleDoubleClick(note)}
              >
                {note.type === 'image' ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <img 
                      src={note.content} 
                      alt="Screenshot Note" 
                      className="max-w-full max-h-full object-contain rounded-md"
                      draggable={false}
                      onError={(e) => {
                        console.error('Image load error:', note.content)
                        e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                      }}
                    />
                  </div>
                ) : editingNote === note.id ? (
                  /* In-place editing for text notes */
                  <div className="h-full flex flex-col">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="flex-1 w-full border-none outline-none resize-none text-gray-700 text-sm leading-relaxed bg-transparent"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          saveEdit()
                        } else if (e.key === 'Escape') {
                          cancelEdit()
                        }
                      }}
                    />
                    <div className="flex gap-2 mt-2 pt-2 border-t">
                      <button
                        onClick={saveEdit}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed cursor-text">
                    {note.content}
                  </p>
                )}
              </div>

              {/* Connection Nodes */}
              <div className="opacity-100 transition-opacity z-40">
                {/* Top connection node */}
                <div 
                  className={`absolute left-1/2 -top-2 w-4 h-4 rounded-full cursor-pointer transform -translate-x-1/2 border-2 border-white shadow-lg z-50 ${
                    hoveredConnection?.noteId === note.id && hoveredConnection?.side === 'top' ? 'bg-blue-500' : 'bg-green-500 hover:bg-green-600'
                  }`}
                  onClick={() => console.log('TOP NODE CLICKED!', note.id)}
                  onMouseDown={(e) => {
                    console.log('Top node clicked!', note.id)
                    handleConnectionStart(e, note.id, 'top')
                  }}
                  onMouseEnter={() => {
                    console.log('Mouse enter on top node:', note.id, 'connecting:', !!connecting)
                    if (connecting) {
                      console.log('Hover enter on top node:', note.id)
                      setHoveredConnection({ noteId: note.id, side: 'top' })
                    }
                  }}
                  onMouseLeave={() => {
                    console.log('Hover leave on top node:', note.id)
                    setHoveredConnection(null)
                  }}
                />
                {/* Right connection node */}
                <div 
                  className={`absolute top-1/2 -right-2 w-4 h-4 rounded-full cursor-pointer transform -translate-y-1/2 border-2 border-white shadow-lg z-50 ${
                    hoveredConnection?.noteId === note.id && hoveredConnection?.side === 'right' ? 'bg-blue-500' : 'bg-green-500 hover:bg-green-600'
                  }`}
                  onMouseDown={(e) => handleConnectionStart(e, note.id, 'right')}
                  onMouseEnter={() => {
                    if (connecting) {
                      console.log('Hover enter on right node:', note.id)
                      setHoveredConnection({ noteId: note.id, side: 'right' })
                    }
                  }}
                  onMouseLeave={() => {
                    console.log('Hover leave on right node:', note.id)
                    setHoveredConnection(null)
                  }}
                />
                {/* Bottom connection node */}
                <div 
                  className={`absolute left-1/2 -bottom-2 w-4 h-4 rounded-full cursor-pointer transform -translate-x-1/2 border-2 border-white shadow-lg z-50 ${
                    hoveredConnection?.noteId === note.id && hoveredConnection?.side === 'bottom' ? 'bg-blue-500' : 'bg-green-500 hover:bg-green-600'
                  }`}
                  onMouseDown={(e) => handleConnectionStart(e, note.id, 'bottom')}
                  onMouseEnter={() => {
                    if (connecting) {
                      console.log('Hover enter on bottom node:', note.id)
                      setHoveredConnection({ noteId: note.id, side: 'bottom' })
                    }
                  }}
                  onMouseLeave={() => {
                    console.log('Hover leave on bottom node:', note.id)
                    setHoveredConnection(null)
                  }}
                />
                {/* Left connection node */}
                <div 
                  className={`absolute top-1/2 -left-2 w-4 h-4 rounded-full cursor-pointer transform -translate-y-1/2 border-2 border-white shadow-lg z-50 ${
                    hoveredConnection?.noteId === note.id && hoveredConnection?.side === 'left' ? 'bg-blue-500' : 'bg-green-500 hover:bg-green-600'
                  }`}
                  onMouseDown={(e) => handleConnectionStart(e, note.id, 'left')}
                  onMouseEnter={() => {
                    if (connecting) {
                      console.log('Hover enter on left node:', note.id)
                      setHoveredConnection({ noteId: note.id, side: 'left' })
                    }
                  }}
                  onMouseLeave={() => {
                    console.log('Hover leave on left node:', note.id)
                    setHoveredConnection(null)
                  }}
                />
              </div>

              {/* Resize Handle - Bottom Right Corner Only */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <div 
                  className="absolute -bottom-1 -right-1 w-4 h-4 cursor-nwse-resize flex items-center justify-center"
                  onMouseDown={(e) => handleResizeStart(e, note.id, 'se')}
                >
                  {/* Resize grip dots */}
                  <div className="grid grid-cols-2 gap-[1px]">
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          </>
        )}
      </div>


      {/* Create Note Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Note</h3>
            
            {!noteType ? (
              <div className="space-y-3">
                <button
                  onClick={() => setNoteType('text')}
                  className="w-full flex items-center gap-3 p-4 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <FileTextIcon className="w-5 h-5 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium">Text Note</div>
                    <div className="text-sm text-gray-500">Write or paste text content</div>
                  </div>
                </button>
                
                <button
                  onClick={() => setNoteType('image')}
                  className="w-full flex items-center gap-3 p-4 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <ImageIcon className="w-5 h-5 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium">Image Note</div>
                    <div className="text-sm text-gray-500">Upload or paste images</div>
                  </div>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {getTypeIcon(noteType)}
                  <span className="capitalize">{noteType} Note</span>
                </div>
                
                {noteType === 'text' && (
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Enter or paste your text here..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
                    rows={6}
                    autoFocus
                  />
                )}
                
                {noteType === 'image' && (
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors"
                    onPaste={handlePasteImage}
                  >
                    {noteContent ? (
                      <div>
                        <img 
                          src={noteContent} 
                          alt="Preview" 
                          className="max-w-full h-auto max-h-48 mx-auto rounded-md mb-2"
                        />
                        <p className="text-sm text-gray-500">Image ready to save</p>
                      </div>
                    ) : (
                      <div>
                        <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 mb-2">Drop an image here, paste (Ctrl+V), or</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="hidden"
                          id="image-upload"
                        />
                        <label 
                          htmlFor="image-upload"
                          className="text-blue-600 hover:text-blue-700 cursor-pointer underline"
                        >
                          choose a file
                        </label>
                      </div>
                    )}
                  </div>
                )}
                
              </div>
            )}
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={resetCreateModal}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {noteType && (
                <>
                  {noteType !== null && (
                    <button
                      onClick={() => {
                        setNoteType(null)
                        setNoteContent('')
                        setImageFile(null)
                      }}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={createNote}
                    disabled={!noteContent.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Note
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}