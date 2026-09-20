export async function clearFirestore(){
    const host = process.env.FIRESTORE_EMULATOR_HOST
    const project = process.env.FIREBASE_PROJECT_ID

    const res = await fetch(
        `http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`,
        {method: 'DELETE'}
    )

    if(!res.ok){
        throw new Error(`Failed to clear Firestore: ${res.status}`)
    }
}
