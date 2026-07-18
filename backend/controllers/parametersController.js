import { listParameters, createParameter, updateParameter } from "../services/parameters.js";

export async function getParameters(req, res){
    try {
        const parameters = await listParameters()
        res.json(parameters)
    } catch (error) {
        console.error('Failed to list parameters:', err)
        res.status(500).json({error: 'Failed to load parameters'})
    }
}

export async function postParameter(req, res) {
    const {key, value, type, description} = req.body

    if(!key || !type){
        return res.status(400).json({error: "key and type are required"})
    }

    try {
        const created = await createParameter({key, value, type, description})
        res.status(201).json(created)
    } catch (err) {
        if(err.code === 6){
            return res.status(409).json({error: `Parameter '${key}`})
        }
        console.error('Failed to create parameter:', err)
        res.status(500).json({error: 'Failed to create parameter'})
    }
}

export async function putParameter(req, res) {
    const {key} = req.params
    const {value, expectedVersion} = req.body

    if(value === undefined || expectedVersion === undefined){
        return res.status(400).json({error: 'value and expectedVersion are required'})
    }

    const version = Number(expectedVersion)
    if(!Number.isInteger(version)){
        return res.status(400).json({error: 'expectedVersion must be an integer'})
    }

    try {
        const updated = await updateParameter({
            key,
            value,
            expectedVersion: version,
            updatedBy: req.user.email
        })
        res.json(updated)
    } catch (err) {
        if(err.code === 'NOT_FOUND'){
            return res.status(404).json({error: err.message})
        }
        if(err.code === 'VERSION_CONFLICT'){
            return res.status(409).json({error: 'Version conflict', current: err.current})
        }
        console.error('Failed to update parameter:', err)
        res.status(500).json({error: 'Failed to update parameter'})
    }
}