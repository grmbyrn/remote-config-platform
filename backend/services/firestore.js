import {initializeApp, cert} from 'firebase-admin/app'
import {getFirestore} from 'firebase-admin/firestore'

const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)

const app = initializeApp(
    useEmulator
        ? {projectId: process.env.FIREBASE_PROJECT_ID}
        : {
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            })
        }
)

export const db = getFirestore(app)
db.settings({ignoreUndefinedProperties: true})

export async function pingFirestore(){
    const ref = db.collection('_healthcheck').doc('ping')
    await ref.set({pingedAt: new Date().toISOString()})
    const snapshot = await ref.get()
    return snapshot.data()
}