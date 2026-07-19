import {db} from './firestore.js'

let config = {}

function buildConfig(snapshot){
    const next = {}
    for(const doc of snapshot.docs){
        next[doc.id] = doc.data().value
    }
    return next
}

export function getConfig(){
    return config
}

export function startConfigListener(){
    return new Promise((resolve, reject) => {
        let settled = false

        db.collection('parameters').onSnapshot(
            (snapshot) => {
                config = buildConfig(snapshot)
                if(!settled){
                    settled = true
                    resolve()
                }
            },
            (err) => {
                console.error('Config listener failed:', err)
                if(!settled){
                    settled = true
                    reject(err)
                }
            }
        )
    })
}