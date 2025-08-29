'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { PlusIcon, BookOpenIcon, TrashIcon, SearchIcon, BookIcon } from 'lucide-react'

interface Notebook {
  id: string
  name: string
  subtitle?: string
  coverImage?: string
  createdAt: string
  _count: {
    notes: number
  }
}

interface Book {
  id: string
  title: string
  authors: string[]
  description: string
  thumbnail: string
  publishedDate: string
  pageCount: number
}

export default function NotebooksPage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newNotebookName, setNewNotebookName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [books, setBooks] = useState<Book[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [createFromBook, setCreateFromBook] = useState(false)

  useEffect(() => {
    fetchNotebooks()
  }, [])

  const fetchNotebooks = async () => {
    try {
      const response = await fetch('/api/notebooks')
      const data = await response.json()
      setNotebooks(data)
    } catch (error) {
      console.error('Error fetching notebooks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const createNotebook = async () => {
    if (!newNotebookName.trim()) return

    try {
      const response = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newNotebookName })
      })

      if (response.ok) {
        resetCreateModal()
        fetchNotebooks()
      } else {
        const errorText = await response.text()
        console.error('Failed to create notebook:', response.status, errorText)
        alert(`Failed to create notebook: ${errorText}`)
      }
    } catch (error) {
      console.error('Error creating notebook:', error)
      alert(`Error creating notebook: ${error}`)
    }
  }

  const searchBooks = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/books/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      
      if (response.ok) {
        setBooks(data.books)
      } else {
        console.error('Error searching books:', data.error)
      }
    } catch (error) {
      console.error('Error searching books:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const createNotebookFromBook = async (book: Book) => {
    try {
      console.log('Creating notebook from book:', { name: book.title, subtitle: 'Reading notes', coverImage: book.thumbnail })
      
      const response = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: book.title,
          subtitle: 'Reading notes',
          coverImage: book.thumbnail
        })
      })

      console.log('Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Notebook created successfully:', data)
        resetCreateModal()
        fetchNotebooks()
      } else {
        const errorText = await response.text()
        console.error('Failed to create notebook:', response.status, errorText)
        alert(`Failed to create notebook: ${errorText}`)
      }
    } catch (error) {
      console.error('Error creating notebook from book:', error)
      alert(`Error creating notebook: ${error}`)
    }
  }

  const resetCreateModal = () => {
    setShowCreateModal(false)
    setNewNotebookName('')
    setSearchQuery('')
    setBooks([])
    setSelectedBook(null)
    setCreateFromBook(false)
  }

  const deleteNotebook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notebook and all its notes?')) return

    try {
      const response = await fetch(`/api/notebooks/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchNotebooks()
      }
    } catch (error) {
      console.error('Error deleting notebook:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading notebooks...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">My Notebooks</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          New Notebook
        </button>
      </div>

      {notebooks.length === 0 ? (
        <div className="text-center py-12">
          <BookOpenIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No notebooks yet</h3>
          <p className="text-gray-500 mb-4">Create your first notebook to start taking notes</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Notebook
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notebooks.map((notebook) => (
            <div key={notebook.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow relative group">
              <button
                onClick={() => deleteNotebook(notebook.id)}
                className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
              
              <Link href={`/notebooks/${notebook.id}`}>
                {notebook.coverImage ? (
                  <div className="flex h-40 bg-gradient-to-r from-white to-gray-50">
                    {/* Content area */}
                    <div className="flex-1 p-6 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-800 mb-1 line-clamp-2">{notebook.name}</h3>
                        {notebook.subtitle && (
                          <p className="text-sm text-gray-600 mb-3 italic">{notebook.subtitle}</p>
                        )}
                        <div className="flex items-center gap-2 text-blue-600">
                          <BookOpenIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {notebook._count.notes} {notebook._count.notes === 1 ? 'note' : 'notes'}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 font-medium">
                        {new Date(notebook.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {/* Book cover - no margins, full height */}
                    <div className="w-28 h-40 relative">
                      <img 
                        src={notebook.coverImage} 
                        alt={notebook.name}
                        className="w-full h-full object-cover rounded-r-lg shadow-lg"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-6 h-40 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-3">{notebook.name}</h3>
                      <div className="flex items-center gap-2 text-blue-600">
                        <BookOpenIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          {notebook._count.notes} {notebook._count.notes === 1 ? 'note' : 'notes'}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 font-medium">
                      {new Date(notebook.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Create Notebook Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Notebook</h3>
            
            {!createFromBook ? (
              <div className="space-y-4">
                {/* Manual notebook creation */}
                <input
                  type="text"
                  value={newNotebookName}
                  onChange={(e) => setNewNotebookName(e.target.value)}
                  placeholder="Notebook name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && createNotebook()}
                />
                
                <div className="text-center">
                  <span className="text-gray-500 text-sm">or</span>
                </div>
                
                {/* Book search option */}
                <button
                  onClick={() => setCreateFromBook(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <BookIcon className="w-5 h-5 text-blue-600" />
                  <span className="text-blue-600 font-medium">Search for a book</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Book search */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for book titles..."
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      onKeyDown={(e) => e.key === 'Enter' && searchBooks()}
                    />
                    <SearchIcon className="w-5 h-5 text-gray-400 absolute right-3 top-2.5" />
                  </div>
                  <button
                    onClick={searchBooks}
                    disabled={!searchQuery.trim() || isSearching}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSearching ? 'Searching...' : 'Search'}
                  </button>
                </div>
                
                {books.length > 0 && (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {books.map((book) => (
                      <div
                        key={book.id}
                        className="flex gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => createNotebookFromBook(book)}
                      >
                        {book.thumbnail && (
                          <img
                            src={book.thumbnail}
                            alt={book.title}
                            className="w-12 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{book.title}</h4>
                          {book.authors.length > 0 && (
                            <p className="text-xs text-gray-600 mt-1">by {book.authors.join(', ')}</p>
                          )}
                          {book.publishedDate && (
                            <p className="text-xs text-gray-500 mt-1">{book.publishedDate}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <button
                  onClick={() => setCreateFromBook(false)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  ← Back to manual entry
                </button>
              </div>
            )}
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={resetCreateModal}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {!createFromBook && (
                <button
                  onClick={createNotebook}
                  disabled={!newNotebookName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}