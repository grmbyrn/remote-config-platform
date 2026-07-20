import { normalizeCountry } from "../lib/country.js";
import { listParameters, createParameter, updateParameter, deleteParameter, setCountryOverride, removeCountryOverride } from "../services/parameters.js";

export async function getParametersHandler(req, res){
    try {
        const parameters = await listParameters()
        res.json(parameters)
    } catch (err) {
        console.error('Failed to list parameters:', err)
        res.status(500).json({error: 'Failed to load parameters'})
    }
}

export async function postParameterHandler(req, res) {
    const {key, value, type, description} = req.body

    if(!key || !type){
        return res.status(400).json({error: "key and type are required"})
    }

    try {
        const created = await createParameter({key, value, type, description})
        res.status(201).json(created)
    } catch (err) {
        if(err.code === 'ALREADY_EXISTS'){
            return res.status(409).json({error: err.message})
        }
        console.error('Failed to create parameter:', err)
        res.status(500).json({error: 'Failed to create parameter'})
    }
}

export async function putParameterHandler(req, res) {
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

export async function deleteParameterHandler(req, res){
    const {key} = req.params

    try {
        await deleteParameter({key})
        res.status(204).send()
    } catch (err) {
        if(err.code === 'NOT_FOUND'){
            return res.status(404).json({error: err.message})
        }
        console.error('Failed to delete parameter:', err)
        res.status(500).json({error: 'Failed to delete parameter'})
    }
}

export async function putOverrideHandler(req, res){
    const {key, country: rawCountry} = req.params
    const {value, expectedVersion} = req.body

    const country = normalizeCountry(rawCountry)
    if(!country){
        return res.status(400).json({error: 'country must be a two-letter code'})
    }

    const version = Number(expectedVersion)
    if(!Number.isInteger(version)){
        return res.status(400).json({error: 'expectedVersion must be an integer'})
    }

    try {
        const updated = await setCountryOverride({
            key,
            country,
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
        if(err.code === 'INVALID_VALUE'){
            return res.status(400).json({error: err.message})
        }
        console.error('Failed to set country override:', err)
        res.status(500).json({error: 'Failed to set country override'})
    }
}

export async function deleteOverrideHandler(req, res) {
    const {key, country: rawCountry} = req.params
    const {expectedVersion} = req.body

    const country = normalizeCountry(rawCountry)
    if(!country){
        return res.status(400).json({error: 'country must be a two-letter code'})
    }

    const version = Number(expectedVersion)
    if(!Number.isInteger(version)){
        return res.status(400).json({error: 'expectedVersion must be an integer'})
    }

    try {
        const updated = await removeCountryOverride({
            key,
            country,
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
        console.error('Failed to remove country override:', err)
        res.status(500).json({error: 'Failed to remove country override'})
    }
}