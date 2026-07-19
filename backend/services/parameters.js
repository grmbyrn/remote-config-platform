import { db } from "./firestore.js";

export async function listParameters() {
    const snapshot = await db.collection('parameters').get()
    return snapshot.docs.map(doc => ({key: doc.id, ...doc.data()}))
}

export async function createParameter({key, value, type, description}) {
    const ref = db.collection('parameters').doc(key)

    try {     
        await ref.create({
            value,
            type,
            description,
            version: 1,
            createdAt: new Date().toISOString()
        })
    } catch (err) {
        if(err.code === 6){   // gRPC ALREADY_EXISTS — doc.create() fails if the doc exists
            const e = new Error(`Parameter '${key}' already exists.`)
            e.code = 'ALREADY_EXISTS'
            throw e
        }
        throw err
    }

    return {key, value, type, description, version: 1}
}

export async function updateParameter({key, value, expectedVersion, updatedBy}){
    const ref = db.collection('parameters').doc(key)

    return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref)

        if(!snapshot.exists){
            const err = new Error(`Parameter '${key}' not found.`)
            err.code = 'NOT_FOUND'
            throw err
        }

        const current = snapshot.data()

        if(current.version !== expectedVersion){
            const err = new Error('Version conflict')
            err.code = 'VERSION_CONFLICT'
            err.current = {
                value: current.value,
                version: current.version,
                updatedBy: current.updatedBy,
                updatedAt: current.updatedAt
            }
            throw err
        }
        const newVersion = current.version + 1
        const updatedAt = new Date().toISOString()

        transaction.update(ref, {value, version: newVersion, updatedAt, updatedBy})

        return {key, ...current, value, version: newVersion, updatedAt, updatedBy}
    })
}

export async function deleteParameter({key}){
    const ref = db.collection('parameters').doc(key)

    return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref)

        if(!snapshot.exists){
            const err = new Error(`Parameter '${key}' not found.`)
            err.code = 'NOT_FOUND'
            throw err
        }

        transaction.delete(ref)

        return {key}
    })
}