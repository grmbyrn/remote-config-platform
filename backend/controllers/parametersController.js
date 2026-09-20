import { normalizeCountry } from "../lib/country.js";
import { listParameters, createParameter, updateParameter, deleteParameter, setCountryOverride, removeCountryOverride, saveSuggestions, getParameter, approveSuggestion, rejectSuggestion } from "../services/parameters.js";
import { generateSuggestions } from "../services/suggestions.js";
import { isValidKey, isValidType, isValidDescription, VALID_TYPES } from "../lib/validate.js";

export async function getParametersHandler(req, res){
    try {
        const parameters = await listParameters()
        res.json(parameters)
    } catch (err) {
        if(err.code === 'INVALID_VALUE'){
            return res.status(400).json({error: err.message})
        }
        console.error('Failed to list parameters:', err)
        res.status(500).json({error: 'Failed to load parameters'})
    }
}

export async function postParameterHandler(req, res) {
    const {key, value, type, description} = req.body

    if(!isValidKey(key)){
        return res.status(400).json({error: 'key must be 1-100 characters, start with a letter, and can contain only letters, numbers, dot, underscore or hyphen'})
    }

    if(!isValidType(type)){
        return res.status(400).json({error: `type must be one of: ${VALID_TYPES.join(', ')}`})
    }

    if(description !== undefined && !isValidDescription(description)){
        return res.status(400).json({error: 'description must be a string of at most 500 characters'})
    }

    try {
        const created = await createParameter({key, value, type, description})
        res.status(201).json(created)
    } catch (err) {
        if(err.code === 'ALREADY_EXISTS'){
            return res.status(409).json({error: err.message})
        }
        if(err.code === 'INVALID_VALUE'){
            return res.status(400).json({error: err.message})
        }
        console.error('Failed to create parameter:', err)
        res.status(500).json({error: 'Failed to create parameter'})
    }
}

export async function putParameterHandler(req, res) {
    const {key} = req.params
    const {value, description, expectedVersion} = req.body

    if(value === undefined || expectedVersion === undefined){
        return res.status(400).json({error: 'value and expectedVersion are required'})
    }

    if(description !== undefined && !isValidDescription(description)){
        return res.status(400).json({error: 'description must be a string of at most 500 characters'})
    }

    const version = Number(expectedVersion)
    if(!Number.isInteger(version)){
        return res.status(400).json({error: 'expectedVersion must be an integer'})
    }

    try {
        const updated = await updateParameter({
            key,
            value,
            description,
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
        if(err.code === 'INVALID_VALUE'){
            return res.status(400).json({error: err.message})
        }
        console.error('Failed to remove country override:', err)
        res.status(500).json({error: 'Failed to remove country override'})
    }
}

export async function postSuggestionsHandler(req, res){
    const {key} = req.params
    const {countries} = req.body

    if(!Array.isArray(countries) || countries.length === 0){
        return res.status(400).json({error: 'countries must be a non-empty array'})
    }

    try {
        const param = await getParameter({key})

        const suggestions = await generateSuggestions({
            type: param.type,
            defaultValue: param.value,
            description: param.description,
            countries
        })

        const saved = await saveSuggestions({key, suggestions})
        res.json(saved)
    } catch (err){
        if(err.code === 'NOT_FOUND'){
            return res.status(404).json({error: err.message})
        }
        if(err.code === 'NO_API_KEY'){
            return res.status(500).json({error: 'AI suggestions are not configured'})
        }
        if(err.code === 'AI_REQUEST_FAILED' || err.code === 'AI_BAD_OUTPUT'){
            return res.status(502).json({error: 'Suggestion generation failed'})
        }
        console.error('Failed to generate suggestions:', err)
        res.status(500).json({error: 'Failed to generate suggestions'})
    }
}

export async function approveSuggestionHandler(req, res){
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
        const updated = await approveSuggestion({
            key, country, value, expectedVersion: version, updatedBy: req.user.email
        })
        res.json(updated)
    } catch (err) {
        if(err.code === 'NOT_FOUND') return res.status(404).json({error: err.message})
        if(err.code === 'NO_SUGGESTION') return res.status(404).json({error: err.message})
        if(err.code === 'VERSION_CONFLICT') return res.status(409).json({error: 'Version conflict', current: err.current})
        if(err.code === 'INVALID_VALUE') return res.status(400).json({error: err.message})
        console.error('Failed to approve suggestion:', err)
        res.status(500).json({error: 'Failed to approve suggestion'})
    }
}

export async function rejectSuggestionHandler(req, res) {
    const {key, country: rawCountry} = req.params

    const country = normalizeCountry(rawCountry)
    if(!country){
        return res.status(400).json({error: 'country must be a two-letter code'})
    }

    try {
        const result = await rejectSuggestion({key, country})
        res.json(result)
    } catch (err) {
        if(err.code === 'NOT_FOUND') return res.status(404).json({error: err.message})
        console.error('Failed to reject suggestion:', err)
        res.status(500).json({error: 'Failed to reject suggestion'})
    }
}