import {initializeApp, cert} from 'firebase-admin/app'
import {getFirestore} from 'firebase-admin/firestore'

const app = initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
})

export const db = getFirestore(app)

export async function pingFirestore(){
    const ref = db.collection('_healthcheck').doc('ping')
    await ref.set({pingedAt: new Date().toISOString()})
    const snapshot = await ref.get()
    return snapshot.data()
}