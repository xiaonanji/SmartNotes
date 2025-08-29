import { storage } from './firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { v4 as uuidv4 } from 'uuid'

export async function uploadScreenshotToFirebase(file: File): Promise<string> {
  try {
    const fileExtension = file.type.split('/')[1] || 'png'
    const fileName = `screenshots/${uuidv4()}.${fileExtension}`
    const storageRef = ref(storage, fileName)
    
    const snapshot = await uploadBytes(storageRef, file)
    const downloadURL = await getDownloadURL(snapshot.ref)
    
    return downloadURL
  } catch (error) {
    console.error('Error uploading file to Firebase:', error)
    throw new Error('Failed to upload image')
  }
}

export function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, {
    type: blob.type,
    lastModified: Date.now()
  })
}