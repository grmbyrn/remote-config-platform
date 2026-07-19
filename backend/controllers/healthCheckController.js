import { pingFirestore } from "../services/firestore.js";

export async function checkFirestore(req, res){
    try {
        const data = await pingFirestore()
        res.json({success: true, data})
    } catch (err) {
        console.error("Firestore healthcheck failed:", err)
        res.status(500).json({success: false, error: err.message})
    }
}