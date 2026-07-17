import { pingFirestore } from "../services/firestore.js";

export async function checkFirestore(req, res){
    try {
        const data = await pingFirestore()
        res.json({success: true, data})
    } catch (error) {
        console.error("Firestore healthcheck failed:", error)
        res.status(500).json({success: false, error: error.message})
    }
}