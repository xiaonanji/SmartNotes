import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  
  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
  }

  try {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY
    const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(query)}&key=${apiKey}&maxResults=10`
    
    const response = await fetch(url)
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to fetch books')
    }

    const books = data.items?.map((item: any) => ({
      id: item.id,
      title: item.volumeInfo.title,
      authors: item.volumeInfo.authors || [],
      description: item.volumeInfo.description || '',
      thumbnail: item.volumeInfo.imageLinks?.thumbnail || '',
      publishedDate: item.volumeInfo.publishedDate || '',
      pageCount: item.volumeInfo.pageCount || 0
    })) || []

    return NextResponse.json({ books })
  } catch (error) {
    console.error('Error searching books:', error)
    return NextResponse.json({ error: 'Failed to search books' }, { status: 500 })
  }
}